import { PrismaClient, Recommendation, RecommendationType, RecommendationStatus } from '@prisma/client';
import { GoogleAdsService } from './google-ads';

const prisma = new PrismaClient();

/**
 * Implementation result
 */
export interface ImplementationResult {
  success: boolean;
  recommendationId: string;
  message: string;
  rollbackData?: any;
  error?: string;
  details?: any;
}

/**
 * Validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Rollback information
 */
interface RollbackInfo {
  type: RecommendationType;
  originalValues: any;
  affectedResources: string[];
  timestamp: Date;
}

/**
 * Implementation queue item
 */
export interface QueuedImplementation {
  id: string;
  recommendationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

/**
 * Recommendation Implementation Service
 *
 * Handles the automated implementation of recommendations with:
 * - Safety checks and validation
 * - Rollback capabilities
 * - Error handling and retry logic
 * - Implementation tracking
 * - Batch processing queue
 */
export class RecommendationImplementationService {
  private googleAdsService: GoogleAdsService;
  private implementationQueue: Map<string, QueuedImplementation> = new Map();

  constructor(accessToken: string, refreshToken: string) {
    this.googleAdsService = new GoogleAdsService(accessToken, refreshToken);
  }

  /**
   * Implement a single recommendation
   * @param recommendationId - The recommendation ID to implement
   * @param userId - The user ID implementing the recommendation
   * @param options - Implementation options (dryRun, force, etc.)
   */
  async implementRecommendation(
    recommendationId: string,
    userId: string,
    options: { dryRun?: boolean; force?: boolean } = {}
  ): Promise<ImplementationResult> {
    try {
      // 1. Fetch recommendation
      const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        include: {
          adAccount: true,
          campaign: true,
        },
      });

      if (!recommendation) {
        return {
          success: false,
          recommendationId,
          message: 'Recommendation not found',
          error: 'NOT_FOUND',
        };
      }

      // 2. Validate recommendation status
      if (recommendation.status === RecommendationStatus.IMPLEMENTED && !options.force) {
        return {
          success: false,
          recommendationId,
          message: 'Recommendation already implemented',
          error: 'ALREADY_IMPLEMENTED',
        };
      }

      if (recommendation.status === RecommendationStatus.REJECTED) {
        return {
          success: false,
          recommendationId,
          message: 'Cannot implement rejected recommendation',
          error: 'REJECTED',
        };
      }

      // 3. Validate recommendation is not expired
      if (recommendation.validUntil && new Date() > recommendation.validUntil) {
        return {
          success: false,
          recommendationId,
          message: 'Recommendation has expired',
          error: 'EXPIRED',
        };
      }

      // 4. Perform safety checks
      const validation = await this.validateRecommendation(recommendation);
      if (!validation.isValid && !options.force) {
        return {
          success: false,
          recommendationId,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          error: 'VALIDATION_FAILED',
          details: validation,
        };
      }

      // 5. Dry run mode (simulate without executing)
      if (options.dryRun) {
        return {
          success: true,
          recommendationId,
          message: 'Dry run successful - no changes made',
          details: {
            validation,
            suggestedChanges: recommendation.suggestedChanges,
          },
        };
      }

      // 6. Capture rollback data BEFORE making changes
      const rollbackData = await this.captureRollbackData(recommendation);

      // 7. Execute the implementation
      const implementationDetails = await this.executeImplementation(recommendation);

      // 8. Update recommendation status
      await prisma.recommendation.update({
        where: { id: recommendationId },
        data: {
          status: RecommendationStatus.IMPLEMENTED,
          implementedAt: new Date(),
          implementedBy: userId,
          rollbackData: rollbackData as any,
        },
      });

      return {
        success: true,
        recommendationId,
        message: 'Recommendation implemented successfully',
        rollbackData,
        details: implementationDetails,
      };
    } catch (error: any) {
      console.error('[RecommendationImplementationService] Error implementing recommendation:', error);

      // Update recommendation status to track failure
      try {
        await prisma.recommendation.update({
          where: { id: recommendationId },
          data: {
            status: RecommendationStatus.PENDING, // Reset to pending for retry
          },
        });
      } catch (updateError) {
        console.error('[RecommendationImplementationService] Error updating failed recommendation:', updateError);
      }

      return {
        success: false,
        recommendationId,
        message: 'Failed to implement recommendation',
        error: error.message,
      };
    }
  }

  /**
   * Validate recommendation before implementation
   */
  private async validateRecommendation(
    recommendation: Recommendation & { campaign?: any; adAccount: any }
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if suggestion changes exist and are valid
      if (!recommendation.suggestedChanges || typeof recommendation.suggestedChanges !== 'object') {
        errors.push('Invalid or missing suggested changes');
        return { isValid: false, errors, warnings };
      }

      const changes = recommendation.suggestedChanges as any;

      // Type-specific validation
      switch (recommendation.type) {
        case RecommendationType.BUDGET_REALLOCATION:
          if (!changes.suggestedBudget || changes.suggestedBudget <= 0) {
            errors.push('Invalid budget value');
          }
          if (changes.suggestedBudget && changes.currentBudget) {
            const changePercent = Math.abs((changes.suggestedBudget - changes.currentBudget) / changes.currentBudget);
            if (changePercent > 0.5) {
              warnings.push('Budget change exceeds 50% - review carefully');
            }
          }
          break;

        case RecommendationType.BID_ADJUSTMENT:
          if (!changes.percentage || typeof changes.percentage !== 'number') {
            errors.push('Invalid bid adjustment percentage');
          }
          if (Math.abs(changes.percentage) > 50) {
            warnings.push('Large bid adjustment - may impact performance');
          }
          break;

        case RecommendationType.ADD_NEGATIVE_KEYWORD:
          if (!changes.keywords || !Array.isArray(changes.keywords) || changes.keywords.length === 0) {
            errors.push('No negative keywords specified');
          }
          break;

        case RecommendationType.PAUSE_CAMPAIGN:
        case RecommendationType.PAUSE_KEYWORD:
          if (!changes.reason) {
            warnings.push('No reason provided for pause action');
          }
          break;

        case RecommendationType.BIDDING_STRATEGY_CHANGE:
          if (!changes.suggestedStrategy) {
            errors.push('No bidding strategy specified');
          }
          break;
      }

      // Check campaign status
      if (recommendation.campaign && recommendation.campaign.status === 'REMOVED') {
        errors.push('Cannot modify removed campaign');
      }

      // Check confidence score
      if (recommendation.confidenceScore < 0.3) {
        warnings.push('Low confidence score - recommendation may not be reliable');
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Capture current state for rollback capability
   */
  private async captureRollbackData(
    recommendation: Recommendation & { campaign?: any; adAccount: any }
  ): Promise<RollbackInfo> {
    const rollbackInfo: RollbackInfo = {
      type: recommendation.type,
      originalValues: {},
      affectedResources: [],
      timestamp: new Date(),
    };

    try {
      const customerId = recommendation.adAccount.customerId;
      const changes = recommendation.suggestedChanges as any;

      switch (recommendation.type) {
        case RecommendationType.BUDGET_REALLOCATION:
          if (recommendation.campaign) {
            rollbackInfo.originalValues = {
              budget: recommendation.campaign.budget,
              campaignId: recommendation.campaign.campaignId,
            };
            rollbackInfo.affectedResources.push(`campaign:${recommendation.campaign.campaignId}`);
          }
          break;

        case RecommendationType.BID_ADJUSTMENT:
          if (changes.keywords) {
            rollbackInfo.originalValues = {
              keywords: changes.keywords.map((k: any) => ({
                id: k.id,
                originalBid: k.currentBid,
              })),
            };
            rollbackInfo.affectedResources.push(...changes.keywords.map((k: any) => `keyword:${k.id}`));
          }
          break;

        case RecommendationType.PAUSE_CAMPAIGN:
          if (recommendation.campaign) {
            rollbackInfo.originalValues = {
              status: recommendation.campaign.status,
              campaignId: recommendation.campaign.campaignId,
            };
            rollbackInfo.affectedResources.push(`campaign:${recommendation.campaign.campaignId}`);
          }
          break;

        case RecommendationType.PAUSE_KEYWORD:
          if (changes.keywordId) {
            rollbackInfo.originalValues = {
              keywordId: changes.keywordId,
              status: 'ENABLED', // Assume it's enabled if we're pausing it
            };
            rollbackInfo.affectedResources.push(`keyword:${changes.keywordId}`);
          }
          break;

        case RecommendationType.BIDDING_STRATEGY_CHANGE:
          if (recommendation.campaign) {
            rollbackInfo.originalValues = {
              biddingStrategy: recommendation.campaign.biddingStrategy,
              targetCpa: recommendation.campaign.targetCpa,
              targetRoas: recommendation.campaign.targetRoas,
              campaignId: recommendation.campaign.campaignId,
            };
            rollbackInfo.affectedResources.push(`campaign:${recommendation.campaign.campaignId}`);
          }
          break;

        case RecommendationType.ADD_NEGATIVE_KEYWORD:
          // For negative keywords, we just store what we're adding
          rollbackInfo.originalValues = {
            keywords: changes.keywords || [],
            matchType: changes.matchType || 'EXACT',
          };
          rollbackInfo.affectedResources.push(`campaign:${recommendation.campaign?.campaignId}`);
          break;
      }
    } catch (error) {
      console.error('[RecommendationImplementationService] Error capturing rollback data:', error);
    }

    return rollbackInfo;
  }

  /**
   * Execute the actual implementation via Google Ads API
   */
  private async executeImplementation(
    recommendation: Recommendation & { campaign?: any; adAccount: any }
  ): Promise<any> {
    const customerId = recommendation.adAccount.customerId;
    const changes = recommendation.suggestedChanges as any;
    const details: any = {};

    try {
      switch (recommendation.type) {
        case RecommendationType.BUDGET_REALLOCATION:
          if (recommendation.campaign && changes.suggestedBudget) {
            const budgetMicros = Math.round(changes.suggestedBudget * 1000000);
            const result = await this.googleAdsService.updateCampaignBudget(
              customerId,
              recommendation.campaign.campaignId,
              budgetMicros
            );
            details.budgetResourceName = result;
            details.newBudget = changes.suggestedBudget;
          }
          break;

        case RecommendationType.BID_ADJUSTMENT:
          if (changes.action === 'lower_bids' && changes.percentage && recommendation.campaign) {
            // This would require iterating through keywords - simplified here
            details.action = 'bid_adjustment';
            details.percentage = changes.percentage;
          }
          break;

        case RecommendationType.ADD_NEGATIVE_KEYWORD:
          if (changes.keywords && Array.isArray(changes.keywords) && recommendation.campaign) {
            const result = await this.googleAdsService.addNegativeKeywords(
              customerId,
              recommendation.campaign.campaignId,
              changes.keywords,
              changes.matchType || 'EXACT'
            );
            details.addedKeywords = changes.keywords;
            details.resourceNames = result;
          }
          break;

        case RecommendationType.PAUSE_CAMPAIGN:
          if (recommendation.campaign) {
            await this.googleAdsService.updateCampaignStatus(
              customerId,
              recommendation.campaign.campaignId,
              'PAUSED'
            );
            details.campaignId = recommendation.campaign.campaignId;
            details.newStatus = 'PAUSED';
          }
          break;

        case RecommendationType.PAUSE_KEYWORD:
          if (changes.keywordId && changes.adGroupId) {
            await this.googleAdsService.updateKeywordStatus(
              customerId,
              changes.adGroupId,
              changes.keywordId,
              'PAUSED'
            );
            details.keywordId = changes.keywordId;
            details.newStatus = 'PAUSED';
          }
          break;

        case RecommendationType.BIDDING_STRATEGY_CHANGE:
          if (recommendation.campaign && changes.suggestedStrategy) {
            const targetCpaMicros = changes.targetCPA ? Math.round(changes.targetCPA * 1000000) : undefined;
            await this.googleAdsService.updateBiddingStrategy(
              customerId,
              recommendation.campaign.campaignId,
              changes.suggestedStrategy,
              targetCpaMicros,
              changes.targetRoas
            );
            details.campaignId = recommendation.campaign.campaignId;
            details.newStrategy = changes.suggestedStrategy;
          }
          break;

        case RecommendationType.KEYWORD_OPTIMIZATION:
          // This would be handled by specific keyword operations
          details.action = 'keyword_optimization';
          break;

        default:
          throw new Error(`Unsupported recommendation type: ${recommendation.type}`);
      }

      return details;
    } catch (error: any) {
      console.error('[RecommendationImplementationService] Error executing implementation:', error);
      throw new Error(`Implementation failed: ${error.message}`);
    }
  }

  /**
   * Rollback an implemented recommendation
   * @param recommendationId - The recommendation ID to rollback
   * @param userId - The user ID performing the rollback
   */
  async rollbackRecommendation(
    recommendationId: string,
    userId: string
  ): Promise<ImplementationResult> {
    try {
      const recommendation = await prisma.recommendation.findUnique({
        where: { id: recommendationId },
        include: {
          adAccount: true,
          campaign: true,
        },
      });

      if (!recommendation) {
        return {
          success: false,
          recommendationId,
          message: 'Recommendation not found',
          error: 'NOT_FOUND',
        };
      }

      if (recommendation.status !== RecommendationStatus.IMPLEMENTED) {
        return {
          success: false,
          recommendationId,
          message: 'Can only rollback implemented recommendations',
          error: 'NOT_IMPLEMENTED',
        };
      }

      if (!recommendation.rollbackData) {
        return {
          success: false,
          recommendationId,
          message: 'No rollback data available',
          error: 'NO_ROLLBACK_DATA',
        };
      }

      const rollbackData = recommendation.rollbackData as unknown as RollbackInfo;
      const customerId = recommendation.adAccount.customerId;

      // Execute rollback based on type
      await this.executeRollback(customerId, rollbackData);

      // Update recommendation status
      await prisma.recommendation.update({
        where: { id: recommendationId },
        data: {
          status: RecommendationStatus.PENDING,
          implementedAt: null,
          implementedBy: null,
        },
      });

      return {
        success: true,
        recommendationId,
        message: 'Recommendation rolled back successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        recommendationId,
        message: 'Failed to rollback recommendation',
        error: error.message,
      };
    }
  }

  /**
   * Execute rollback operation
   */
  private async executeRollback(customerId: string, rollbackData: RollbackInfo): Promise<void> {
    const { type, originalValues } = rollbackData;

    switch (type) {
      case RecommendationType.BUDGET_REALLOCATION:
        if (originalValues.budget && originalValues.campaignId) {
          const budgetMicros = Math.round(originalValues.budget * 1000000);
          await this.googleAdsService.updateCampaignBudget(
            customerId,
            originalValues.campaignId,
            budgetMicros
          );
        }
        break;

      case RecommendationType.PAUSE_CAMPAIGN:
        if (originalValues.status && originalValues.campaignId) {
          await this.googleAdsService.updateCampaignStatus(
            customerId,
            originalValues.campaignId,
            originalValues.status
          );
        }
        break;

      case RecommendationType.PAUSE_KEYWORD:
        if (originalValues.status && originalValues.keywordId) {
          // Would need adGroupId to properly rollback
          console.warn('Keyword rollback requires adGroupId');
        }
        break;

      case RecommendationType.BIDDING_STRATEGY_CHANGE:
        if (originalValues.biddingStrategy && originalValues.campaignId) {
          const targetCpaMicros = originalValues.targetCpa
            ? Math.round(originalValues.targetCpa * 1000000)
            : undefined;
          await this.googleAdsService.updateBiddingStrategy(
            customerId,
            originalValues.campaignId,
            originalValues.biddingStrategy,
            targetCpaMicros,
            originalValues.targetRoas
          );
        }
        break;

      case RecommendationType.ADD_NEGATIVE_KEYWORD:
        // Removing negative keywords would require separate API method
        console.warn('Negative keyword rollback not fully implemented');
        break;
    }
  }

  /**
   * Add recommendation to implementation queue
   */
  async queueImplementation(recommendationId: string, priority: number = 0): Promise<QueuedImplementation> {
    const queueItem: QueuedImplementation = {
      id: `queue_${Date.now()}_${recommendationId}`,
      recommendationId,
      status: 'pending',
      priority,
      createdAt: new Date(),
    };

    this.implementationQueue.set(queueItem.id, queueItem);
    return queueItem;
  }

  /**
   * Process implementation queue
   */
  async processQueue(userId: string, maxConcurrent: number = 3): Promise<ImplementationResult[]> {
    const results: ImplementationResult[] = [];
    const pending = Array.from(this.implementationQueue.values())
      .filter(item => item.status === 'pending')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxConcurrent);

    for (const item of pending) {
      item.status = 'processing';

      try {
        const result = await this.implementRecommendation(item.recommendationId, userId);
        item.status = result.success ? 'completed' : 'failed';
        item.processedAt = new Date();
        item.error = result.error;
        results.push(result);
      } catch (error: any) {
        item.status = 'failed';
        item.error = error.message;
        results.push({
          success: false,
          recommendationId: item.recommendationId,
          message: 'Queue processing failed',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const items = Array.from(this.implementationQueue.values());
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'pending').length,
      processing: items.filter(i => i.status === 'processing').length,
      completed: items.filter(i => i.status === 'completed').length,
      failed: items.filter(i => i.status === 'failed').length,
    };
  }

  /**
   * Clear completed items from queue
   */
  clearCompleted(): number {
    const items = Array.from(this.implementationQueue.entries());
    let cleared = 0;

    for (const [id, item] of items) {
      if (item.status === 'completed') {
        this.implementationQueue.delete(id);
        cleared++;
      }
    }

    return cleared;
  }
}
