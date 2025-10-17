import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Duplicate keyword interface
 */
export interface DuplicateKeyword {
  keywordText: string;
  matchType: string;
  occurrences: {
    keywordId: string;
    campaignId: string;
    campaignName: string;
    status: string;
    cost: number;
    conversions: number;
    cpa: number;
  }[];
  totalCost: number;
  totalConversions: number;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

/**
 * Duplicate Keyword Detector
 *
 * Identifies duplicate keywords across:
 * - Multiple campaigns
 * - Different match types
 * - Active vs paused keywords
 */
export class DuplicateKeywordDetector {
  /**
   * Find all duplicate keywords in an account
   */
  static async findDuplicates(adAccountId: string): Promise<DuplicateKeyword[]> {
    try {
      // Get all keywords for the account
      const keywords = await prisma.keyword.findMany({
        where: {
          campaign: {
            adAccountId,
          },
        },
        include: {
          campaign: {
            select: {
              campaignId: true,
              campaignName: true,
            },
          },
        },
      });

      // Group by normalized keyword text
      const grouped = new Map<string, typeof keywords>();

      for (const keyword of keywords) {
        // Normalize keyword text (lowercase, trim)
        const normalized = keyword.keywordText.toLowerCase().trim();

        if (!grouped.has(normalized)) {
          grouped.set(normalized, []);
        }

        grouped.get(normalized)!.push(keyword);
      }

      // Find duplicates (keywords appearing more than once)
      const duplicates: DuplicateKeyword[] = [];

      for (const [keywordText, occurrences] of Array.from(grouped.entries())) {
        if (occurrences.length > 1) {
          const totalCost = occurrences.reduce((sum, k) => sum + k.cost, 0);
          const totalConversions = occurrences.reduce((sum, k) => sum + k.conversions, 0);

          // Determine severity
          let severity: 'high' | 'medium' | 'low' = 'low';
          let recommendation = '';

          // Check if duplicates are in different campaigns
          const uniqueCampaigns = new Set(occurrences.map(k => k.campaign.campaignId));
          const activeCount = occurrences.filter(k => k.status === 'ENABLED').length;

          if (activeCount > 1) {
            if (uniqueCampaigns.size > 1) {
              // Multiple active duplicates across campaigns
              severity = 'high';
              recommendation =
                'Multiple active instances across campaigns causing internal competition. Consolidate to best-performing campaign and pause others.';
            } else {
              // Multiple active duplicates in same campaign
              severity = 'medium';
              recommendation =
                'Multiple active instances in same campaign. Keep only one and pause others to avoid wasted spend.';
            }
          } else if (activeCount === 1) {
            // One active, others paused
            severity = 'low';
            recommendation =
              'Some instances are paused. Consider removing paused duplicates to clean up account.';
          }

          // Check for different match types
          const uniqueMatchTypes = new Set(occurrences.map(k => k.matchType));
          if (uniqueMatchTypes.size > 1) {
            recommendation +=
              ' Note: Different match types detected - ensure match type hierarchy is appropriate (Exact > Phrase > Broad).';
          }

          duplicates.push({
            keywordText: occurrences[0].keywordText, // Use original casing
            matchType: Array.from(uniqueMatchTypes).join(', '),
            occurrences: occurrences.map(k => ({
              keywordId: k.keywordId,
              campaignId: k.campaign.campaignId,
              campaignName: k.campaign.campaignName,
              status: k.status,
              cost: k.cost,
              conversions: k.conversions,
              cpa: k.cpa,
            })),
            totalCost,
            totalConversions,
            severity,
            recommendation,
          });
        }
      }

      // Sort by severity and cost
      return duplicates.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        if (a.severity !== b.severity) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return b.totalCost - a.totalCost;
      });
    } catch (error) {
      console.error('[DuplicateKeywordDetector] Error finding duplicates:', error);
      return [];
    }
  }

  /**
   * Find cross-campaign duplicates
   * (keywords appearing in multiple campaigns)
   */
  static async findCrossCampaignDuplicates(adAccountId: string): Promise<DuplicateKeyword[]> {
    const allDuplicates = await this.findDuplicates(adAccountId);

    // Filter to only cross-campaign duplicates
    return allDuplicates.filter(dup => {
      const uniqueCampaigns = new Set(dup.occurrences.map(o => o.campaignId));
      return uniqueCampaigns.size > 1;
    });
  }

  /**
   * Find exact match type conflicts
   * (same keyword with different match types)
   */
  static async findMatchTypeConflicts(adAccountId: string): Promise<DuplicateKeyword[]> {
    const allDuplicates = await this.findDuplicates(adAccountId);

    // Filter to only match type conflicts
    return allDuplicates.filter(dup => {
      const uniqueMatchTypes = new Set(dup.occurrences.map(o => dup.matchType));
      return uniqueMatchTypes.size > 1;
    });
  }

  /**
   * Calculate potential savings from resolving duplicates
   */
  static calculatePotentialSavings(duplicates: DuplicateKeyword[]): {
    totalSavings: number;
    bySeverity: { high: number; medium: number; low: number };
    count: { high: number; medium: number; low: number };
  } {
    const bySeverity = { high: 0, medium: 0, low: 0 };
    const count = { high: 0, medium: 0, low: 0 };

    for (const dup of duplicates) {
      // Calculate potential savings (waste from keeping multiple active)
      const activeOccurrences = dup.occurrences.filter(o => o.status === 'ENABLED');

      if (activeOccurrences.length > 1) {
        // Sort by performance (lowest CPA or highest conversions)
        activeOccurrences.sort((a, b) => {
          if (a.conversions === 0 && b.conversions === 0) {
            return b.cost - a.cost; // If neither converting, higher cost is worse
          }
          if (a.conversions === 0) return 1;
          if (b.conversions === 0) return -1;
          return a.cpa - b.cpa; // Lower CPA is better
        });

        // Potential savings = cost of all but best performer
        const savings = activeOccurrences.slice(1).reduce((sum, o) => sum + o.cost, 0);

        bySeverity[dup.severity] += savings;
        count[dup.severity]++;
      }
    }

    return {
      totalSavings: bySeverity.high + bySeverity.medium + bySeverity.low,
      bySeverity,
      count,
    };
  }

  /**
   * Generate consolidation plan
   * Recommends which keywords to keep and which to pause
   */
  static generateConsolidationPlan(duplicate: DuplicateKeyword): {
    keep: {
      keywordId: string;
      campaignName: string;
      reason: string;
    };
    pause: {
      keywordId: string;
      campaignName: string;
      reason: string;
    }[];
  } {
    const activeOccurrences = duplicate.occurrences.filter(o => o.status === 'ENABLED');

    if (activeOccurrences.length === 0) {
      // No active keywords, pick best of paused
      const best = duplicate.occurrences.reduce((prev, curr) =>
        curr.conversions > prev.conversions ? curr : prev
      );

      return {
        keep: {
          keywordId: best.keywordId,
          campaignName: best.campaignName,
          reason: 'Best historical performance among paused keywords',
        },
        pause: duplicate.occurrences
          .filter(o => o.keywordId !== best.keywordId)
          .map(o => ({
            keywordId: o.keywordId,
            campaignName: o.campaignName,
            reason: 'Duplicate - already paused',
          })),
      };
    }

    // Sort by performance
    const sorted = [...activeOccurrences].sort((a, b) => {
      // Prioritize converting keywords
      if (a.conversions > 0 && b.conversions === 0) return -1;
      if (b.conversions > 0 && a.conversions === 0) return 1;

      // If both converting, prefer lower CPA
      if (a.conversions > 0 && b.conversions > 0) {
        return a.cpa - b.cpa;
      }

      // If neither converting, prefer higher volume (more data)
      return b.cost - a.cost;
    });

    const best = sorted[0];

    return {
      keep: {
        keywordId: best.keywordId,
        campaignName: best.campaignName,
        reason:
          best.conversions > 0
            ? `Best CPA: $${best.cpa.toFixed(2)} with ${best.conversions} conversions`
            : `Highest spend: $${best.cost.toFixed(2)} (most data)`,
      },
      pause: activeOccurrences
        .filter(o => o.keywordId !== best.keywordId)
        .map(o => ({
          keywordId: o.keywordId,
          campaignName: o.campaignName,
          reason: `Duplicate - worse performance than ${best.campaignName}`,
        })),
    };
  }
}
