import { PrismaClient, Campaign, RecommendationType } from '@prisma/client';
import { StatisticalAnalysisService, PerformanceAnalysis } from './statistical-analysis';
import { KeywordAnalyzer, KeywordRecommendation } from './keyword-analyzer';
import { SearchTermAnalyzer, SearchTermRecommendation } from './search-term-analyzer';
import { GeneratedRecommendation } from './ml-recommendation-engine';

const prisma = new PrismaClient();

/**
 * Budget reallocation recommendation with detailed analysis
 */
export interface BudgetReallocationRecommendation extends GeneratedRecommendation {
  type: 'BUDGET_REALLOCATION';
  budgetAnalysis: {
    currentDailyBudget: number;
    suggestedDailyBudget: number;
    changeAmount: number;
    changePercentage: number;
    roi: number;
    efficiency: 'high' | 'medium' | 'low';
    reasoning: string[];
  };
}

/**
 * Keyword optimization recommendation with actionable items
 */
export interface KeywordOptimizationRecommendation extends GeneratedRecommendation {
  type: 'KEYWORD_OPTIMIZATION' | 'ADD_NEGATIVE_KEYWORD' | 'PAUSE_KEYWORD';
  keywordAnalysis: {
    totalKeywords: number;
    underperformingCount: number;
    highPerformingCount: number;
    negativeKeywordCandidates: string[];
    pauseKeywordCandidates: string[];
    potentialSavings: number;
    actionableItems: {
      action: 'pause' | 'add_negative' | 'increase_bid' | 'decrease_bid';
      keyword: string;
      reason: string;
      expectedImpact: number;
    }[];
  };
}

/**
 * Bid management recommendation with specific adjustments
 */
export interface BidManagementRecommendation extends GeneratedRecommendation {
  type: 'BID_ADJUSTMENT';
  bidAnalysis: {
    currentStrategy: string;
    performanceScore: number;
    suggestedAdjustments: {
      keyword?: string;
      currentBid?: number;
      suggestedBid?: number;
      changePercentage: number;
      reason: string;
    }[];
    deviceBidAdjustments?: {
      device: 'mobile' | 'desktop' | 'tablet';
      currentModifier: number;
      suggestedModifier: number;
      reason: string;
    }[];
    locationBidAdjustments?: {
      location: string;
      currentModifier: number;
      suggestedModifier: number;
      reason: string;
    }[];
  };
}

/**
 * Ad creative recommendation with A/B testing suggestions
 */
export interface AdCreativeRecommendation extends GeneratedRecommendation {
  type: 'AD_CREATIVE';
  creativeAnalysis: {
    totalAds: number;
    underperformingAds: number;
    topPerformers: {
      adId: string;
      headline: string;
      ctr: number;
      conversionRate: number;
    }[];
    bottomPerformers: {
      adId: string;
      headline: string;
      ctr: number;
      conversionRate: number;
      reason: string;
    }[];
    suggestions: {
      type: 'pause' | 'a_b_test' | 'refresh_creative';
      targetAd: string;
      reasoning: string;
      expectedImprovement: string;
    }[];
    abTestingOpportunities: {
      element: 'headline' | 'description' | 'cta';
      currentVersion: string;
      suggestedVariations: string[];
      expectedUplift: number;
    }[];
  };
}

/**
 * Category-Specific Recommendation Engines
 *
 * Provides specialized analysis and recommendations for each category:
 * - Budget reallocation based on ROI and spend efficiency
 * - Keyword optimization with negative keyword suggestions
 * - Bid management with device/location adjustments
 * - Ad creative analysis with A/B testing suggestions
 */
export class RecommendationCategories {
  /**
   * Budget Reallocation Category Engine
   * Analyzes campaign spend patterns and ROI to suggest budget reallocations
   */
  static async generateBudgetRecommendations(
    campaignId: string,
    adAccountId: string,
    analysis: PerformanceAnalysis
  ): Promise<BudgetReallocationRecommendation[]> {
    const recommendations: BudgetReallocationRecommendation[] = [];

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || !campaign.budget) {
      return recommendations;
    }

    // Analyze ROI and efficiency
    const costBenchmark = analysis.benchmarks.find(b => b.metric === 'cost');
    const conversionsBenchmark = analysis.benchmarks.find(b => b.metric === 'conversions');
    const cpaTrend = analysis.trends.find(t => t.metric === 'CPA');
    const conversionsTrend = analysis.trends.find(t => t.metric === 'conversions');

    const currentDailyBudget = campaign.budget;

    // Calculate ROI and efficiency
    const roi = conversionsBenchmark ? conversionsBenchmark.currentValue / costBenchmark!.currentValue : 0;
    const efficiency = this.calculateEfficiency(analysis);

    // HIGH EFFICIENCY: Increase budget
    if (
      efficiency === 'high' &&
      analysis.summary.overallHealth === 'excellent' &&
      cpaTrend?.trend === 'decreasing'
    ) {
      const increasePercentage = 20; // Recommend 20% increase
      const suggestedBudget = currentDailyBudget * (1 + increasePercentage / 100);

      recommendations.push({
        type: 'BUDGET_REALLOCATION',
        campaignId,
        title: 'Increase budget for high-performing campaign',
        description: `Campaign is highly efficient with improving CPA trend. Recommend increasing daily budget from $${currentDailyBudget} to $${suggestedBudget.toFixed(2)} (${increasePercentage}% increase).`,
        reasoning: `Campaign shows excellent health, high ROI (${roi.toFixed(2)}), and decreasing CPA trend. Budget increase can capture more profitable traffic.`,
        expectedImpact: `${increasePercentage * 0.7}% increase in conversions`,
        impactMetric: 'conversions',
        impactValue: increasePercentage * 0.7,
        confidenceScore: 0.85,
        priority: 'high',
        suggestedChanges: {
          budgetChange: {
            from: currentDailyBudget,
            to: suggestedBudget,
            changeAmount: suggestedBudget - currentDailyBudget,
          },
        },
        budgetAnalysis: {
          currentDailyBudget,
          suggestedDailyBudget: suggestedBudget,
          changeAmount: suggestedBudget - currentDailyBudget,
          changePercentage: increasePercentage,
          roi,
          efficiency,
          reasoning: [
            'Excellent overall campaign health',
            `High ROI of ${roi.toFixed(2)}`,
            'CPA is decreasing consistently',
            'No significant performance outliers',
            'Budget increase likely to maintain or improve efficiency',
          ],
        },
      });
    }

    // LOW EFFICIENCY: Decrease budget
    if (
      (efficiency === 'low' || analysis.summary.overallHealth === 'poor') &&
      cpaTrend?.trend === 'increasing'
    ) {
      const decreasePercentage = 30; // Recommend 30% decrease
      const suggestedBudget = currentDailyBudget * (1 - decreasePercentage / 100);

      recommendations.push({
        type: 'BUDGET_REALLOCATION',
        campaignId,
        title: 'Reduce budget for underperforming campaign',
        description: `Campaign shows low efficiency with increasing CPA. Recommend reducing daily budget from $${currentDailyBudget} to $${suggestedBudget.toFixed(2)} (${decreasePercentage}% decrease) to minimize waste.`,
        reasoning: `Poor campaign health, low ROI (${roi.toFixed(2)}), and increasing CPA trend indicate inefficient spend. Budget reduction recommended until performance improves.`,
        expectedImpact: `${decreasePercentage * 0.8}% cost reduction`,
        impactMetric: 'cost',
        impactValue: -decreasePercentage * 0.8,
        confidenceScore: 0.8,
        priority: 'critical',
        suggestedChanges: {
          budgetChange: {
            from: currentDailyBudget,
            to: suggestedBudget,
            changeAmount: suggestedBudget - currentDailyBudget,
          },
        },
        budgetAnalysis: {
          currentDailyBudget,
          suggestedDailyBudget: suggestedBudget,
          changeAmount: suggestedBudget - currentDailyBudget,
          changePercentage: -decreasePercentage,
          roi,
          efficiency,
          reasoning: [
            'Poor overall campaign health',
            `Low ROI of ${roi.toFixed(2)}`,
            'CPA is increasing significantly',
            `${analysis.outliers.length} performance outliers detected`,
            'Budget reduction necessary to minimize losses',
          ],
        },
      });
    }

    // MEDIUM EFFICIENCY: Maintain with optimization
    if (efficiency === 'medium' && conversionsTrend?.trend === 'stable') {
      recommendations.push({
        type: 'BUDGET_REALLOCATION',
        campaignId,
        title: 'Maintain budget while optimizing performance',
        description: `Campaign has moderate efficiency. Maintain current budget of $${currentDailyBudget} while focusing on keyword and bid optimizations.`,
        reasoning: `Stable performance with room for improvement. Budget changes not recommended until optimization efforts show results.`,
        expectedImpact: 'No budget change, focus on optimization',
        impactMetric: 'efficiency',
        impactValue: 0,
        confidenceScore: 0.7,
        priority: 'medium',
        suggestedChanges: {
          action: 'maintain',
          focusAreas: ['keyword_optimization', 'bid_adjustments'],
        },
        budgetAnalysis: {
          currentDailyBudget,
          suggestedDailyBudget: currentDailyBudget,
          changeAmount: 0,
          changePercentage: 0,
          roi,
          efficiency,
          reasoning: [
            'Moderate campaign efficiency',
            'Stable conversion trends',
            'Optimization opportunities exist',
            'Wait for optimization results before budget changes',
          ],
        },
      });
    }

    return recommendations;
  }

  /**
   * Keyword Optimization Category Engine
   * Analyzes keywords and suggests optimizations including negative keywords
   */
  static async generateKeywordRecommendations(
    campaignId: string,
    adAccountId: string,
    days: number = 30
  ): Promise<KeywordOptimizationRecommendation[]> {
    const recommendations: KeywordOptimizationRecommendation[] = [];

    // Get keywords for the campaign
    const keywords = await prisma.keyword.findMany({
      where: { campaignId },
    });

    if (keywords.length === 0) {
      return recommendations;
    }

    // Get search terms for negative keyword analysis
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const searchTerms = await prisma.searchTerm.findMany({
      where: {
        campaignId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Analyze keywords
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    const keywordAnalysis = KeywordAnalyzer.analyzeKeywords(
      keywords.map(k => ({
        keywordId: k.keywordId,
        keywordText: k.keywordText,
        matchType: k.matchType,
        status: k.status,
        impressions: k.impressions,
        clicks: k.clicks,
        cost: k.cost,
        conversions: k.conversions,
        ctr: k.ctr / 100, // Convert from percentage
        cpc: k.cpc,
        cpa: k.cpa,
        qualityScore: k.qualityScore || undefined,
      })),
      {
        targetCpa: campaign?.targetCpa || undefined,
        minConversionRate: 1,
        minQualityScore: 5,
      }
    );

    // Analyze search terms for negative keywords
    const searchTermAnalysis = SearchTermAnalyzer.analyzeSearchTerms(
      searchTerms.map(st => ({
        searchTerm: st.searchTerm,
        matchedKeyword: st.matchedKeyword || undefined,
        matchType: st.matchType || undefined,
        impressions: st.impressions,
        clicks: st.clicks,
        cost: st.cost,
        conversions: st.conversions,
        ctr: st.impressions > 0 ? st.clicks / st.impressions : 0,
        cpc: st.clicks > 0 ? st.cost / st.clicks : 0,
        cpa: st.conversions > 0 ? st.cost / st.conversions : 0,
        conversionRate: st.impressions > 0 ? (st.conversions / st.impressions) * 100 : 0,
        date: st.date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD
      })),
      {
        targetCpa: campaign?.targetCpa || undefined,
        minConversionRate: 1,
      }
    );

    // HIGH PRIORITY: Negative keyword recommendations
    const negativeKeywordCandidates = searchTermAnalysis
      .filter(st => st.priority === 'high' || st.priority === 'medium')
      .map(st => st.searchTerm);

    if (negativeKeywordCandidates.length > 0) {
      const totalSavings = searchTermAnalysis
        .filter(st => st.priority === 'high' || st.priority === 'medium')
        .reduce((sum, st) => sum + st.estimatedSavings, 0);

      recommendations.push({
        type: 'ADD_NEGATIVE_KEYWORD',
        campaignId,
        title: `Add ${negativeKeywordCandidates.length} negative keywords`,
        description: `Identified ${negativeKeywordCandidates.length} search terms with poor performance. Adding as negative keywords can save approximately $${totalSavings.toFixed(2)}.`,
        reasoning: `Search term analysis shows ${negativeKeywordCandidates.length} queries with zero or poor conversions consuming budget. These should be excluded.`,
        expectedImpact: `$${totalSavings.toFixed(2)} monthly savings`,
        impactMetric: 'cost',
        impactValue: -(totalSavings / days * 30),
        confidenceScore: 0.9,
        priority: totalSavings > 100 ? 'critical' : 'high',
        suggestedChanges: {
          negativeKeywords: negativeKeywordCandidates.slice(0, 20), // Top 20
        },
        keywordAnalysis: {
          totalKeywords: keywords.length,
          underperformingCount: keywordAnalysis.pause.length,
          highPerformingCount: keywordAnalysis.scale.length,
          negativeKeywordCandidates: negativeKeywordCandidates.slice(0, 20),
          pauseKeywordCandidates: [],
          potentialSavings: totalSavings,
          actionableItems: searchTermAnalysis
            .filter(st => st.priority === 'high' || st.priority === 'medium')
            .slice(0, 10)
            .map(st => ({
              action: 'add_negative' as const,
              keyword: st.searchTerm,
              reason: st.reason,
              expectedImpact: st.estimatedSavings,
            })),
        },
      });
    }

    // PAUSE KEYWORD recommendations
    if (keywordAnalysis.pause.length > 0) {
      const pauseSavings = keywordAnalysis.pause.reduce((sum, k) => sum + k.metrics.cost, 0);

      recommendations.push({
        type: 'PAUSE_KEYWORD',
        campaignId,
        title: `Pause ${keywordAnalysis.pause.length} underperforming keywords`,
        description: `${keywordAnalysis.pause.length} keywords are consistently underperforming. Pausing them can save $${pauseSavings.toFixed(2)}.`,
        reasoning: `Keyword analysis shows these keywords have high cost with zero or very poor conversions, indicating they should be paused.`,
        expectedImpact: `$${pauseSavings.toFixed(2)} savings`,
        impactMetric: 'cost',
        impactValue: -pauseSavings,
        confidenceScore: 0.85,
        priority: 'high',
        suggestedChanges: {
          keywordsToPause: keywordAnalysis.pause.slice(0, 10).map(k => ({
            keywordId: k.keywordId,
            keywordText: k.keywordText,
            reason: k.reason,
            cost: k.metrics.cost,
          })),
        },
        keywordAnalysis: {
          totalKeywords: keywords.length,
          underperformingCount: keywordAnalysis.pause.length,
          highPerformingCount: keywordAnalysis.scale.length,
          negativeKeywordCandidates: [],
          pauseKeywordCandidates: keywordAnalysis.pause.slice(0, 10).map(k => k.keywordText),
          potentialSavings: pauseSavings,
          actionableItems: keywordAnalysis.pause.slice(0, 10).map(k => ({
            action: 'pause' as const,
            keyword: k.keywordText,
            reason: k.reason,
            expectedImpact: k.metrics.cost,
          })),
        },
      });
    }

    // SCALE KEYWORD recommendations
    if (keywordAnalysis.scale.length > 0) {
      recommendations.push({
        type: 'KEYWORD_OPTIMIZATION',
        campaignId,
        title: `Scale ${keywordAnalysis.scale.length} high-performing keywords`,
        description: `${keywordAnalysis.scale.length} keywords are performing exceptionally well. Consider increasing bids to capture more volume.`,
        reasoning: `These keywords have excellent CPA and conversion rates, significantly below target. Scaling can increase profitable conversions.`,
        expectedImpact: '15-25% conversion increase',
        impactMetric: 'conversions',
        impactValue: 20,
        confidenceScore: 0.8,
        priority: 'medium',
        suggestedChanges: {
          keywordsToScale: keywordAnalysis.scale.slice(0, 10).map(k => ({
            keywordId: k.keywordId,
            keywordText: k.keywordText,
            reason: k.reason,
            suggestedBidIncrease: 15, // 15% increase
          })),
        },
        keywordAnalysis: {
          totalKeywords: keywords.length,
          underperformingCount: keywordAnalysis.pause.length,
          highPerformingCount: keywordAnalysis.scale.length,
          negativeKeywordCandidates: [],
          pauseKeywordCandidates: [],
          potentialSavings: 0,
          actionableItems: keywordAnalysis.scale.slice(0, 10).map(k => ({
            action: 'increase_bid' as const,
            keyword: k.keywordText,
            reason: k.reason,
            expectedImpact: 15,
          })),
        },
      });
    }

    return recommendations;
  }

  /**
   * Bid Management Category Engine
   * Analyzes bidding performance and suggests specific adjustments
   */
  static async generateBidManagementRecommendations(
    campaignId: string,
    adAccountId: string,
    analysis: PerformanceAnalysis
  ): Promise<BidManagementRecommendation[]> {
    const recommendations: BidManagementRecommendation[] = [];

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return recommendations;
    }

    const cpaTrend = analysis.trends.find(t => t.metric === 'CPA');
    const conversionsTrend = analysis.trends.find(t => t.metric === 'conversions');

    // Calculate performance score
    const performanceScore = this.calculateBidPerformanceScore(analysis);

    // MANUAL CPC with increasing CPA
    if (campaign.biddingStrategy === 'MANUAL_CPC' && cpaTrend?.trend === 'increasing') {
      recommendations.push({
        type: 'BID_ADJUSTMENT',
        campaignId,
        title: 'Lower bids to improve CPA',
        description: `CPA is increasing under manual bidding. Recommend 10-15% bid reduction to improve efficiency.`,
        reasoning: `Manual CPC showing ${cpaTrend.changePercentage.toFixed(1)}% CPA increase. Bid reduction can help control costs while maintaining conversion volume.`,
        expectedImpact: '10-15% CPA improvement',
        impactMetric: 'CPA',
        impactValue: -12.5,
        confidenceScore: cpaTrend.confidence,
        priority: 'high',
        suggestedChanges: {
          bidAdjustment: {
            type: 'decrease',
            percentage: 12,
            reason: 'CPA increasing trend',
          },
        },
        bidAnalysis: {
          currentStrategy: campaign.biddingStrategy || 'UNKNOWN',
          performanceScore,
          suggestedAdjustments: [
            {
              changePercentage: -12,
              reason: `CPA increased by ${cpaTrend.changePercentage.toFixed(1)}%. Bid reduction recommended.`,
            },
          ],
        },
      });
    }

    // Excellent performance - increase bids
    if (
      analysis.summary.overallHealth === 'excellent' &&
      cpaTrend?.trend === 'decreasing' &&
      conversionsTrend?.trend !== 'decreasing'
    ) {
      recommendations.push({
        type: 'BID_ADJUSTMENT',
        campaignId,
        title: 'Increase bids to capture more volume',
        description: `Excellent performance with decreasing CPA. Recommend 10-15% bid increase to scale results.`,
        reasoning: `Strong performance metrics indicate opportunity to increase bids and capture more profitable traffic without significantly impacting CPA.`,
        expectedImpact: '15-20% conversion increase',
        impactMetric: 'conversions',
        impactValue: 17.5,
        confidenceScore: 0.75,
        priority: 'medium',
        suggestedChanges: {
          bidAdjustment: {
            type: 'increase',
            percentage: 12,
            reason: 'Excellent performance with room to scale',
          },
        },
        bidAnalysis: {
          currentStrategy: campaign.biddingStrategy || 'UNKNOWN',
          performanceScore,
          suggestedAdjustments: [
            {
              changePercentage: 12,
              reason: `CPA decreased by ${Math.abs(cpaTrend.changePercentage).toFixed(1)}%. Bid increase can capture more volume.`,
            },
          ],
        },
      });
    }

    return recommendations;
  }

  /**
   * Ad Creative Category Engine
   * Placeholder for future ad creative analysis
   * Requires Ad model and ad performance data
   */
  static async generateAdCreativeRecommendations(
    campaignId: string,
    adAccountId: string
  ): Promise<AdCreativeRecommendation[]> {
    // Placeholder - will be implemented when Ad models are available
    // This would analyze ad performance, suggest A/B tests, and identify underperforming creative
    return [];
  }

  // ========== Helper Methods ==========

  /**
   * Calculate campaign efficiency rating
   */
  private static calculateEfficiency(analysis: PerformanceAnalysis): 'high' | 'medium' | 'low' {
    const health = analysis.summary.overallHealth;
    const outlierCount = analysis.outliers.filter(o => o.severity === 'high').length;

    if (health === 'excellent' && outlierCount === 0) {
      return 'high';
    } else if (health === 'poor' || outlierCount > 3) {
      return 'low';
    }
    return 'medium';
  }

  /**
   * Calculate bid performance score (0-100)
   */
  private static calculateBidPerformanceScore(analysis: PerformanceAnalysis): number {
    let score = 50; // Base score

    // Health contributes 40 points
    const healthScores = { excellent: 40, good: 30, fair: 20, poor: 10 };
    score += healthScores[analysis.summary.overallHealth];

    // Outliers reduce score
    const highSeverityOutliers = analysis.outliers.filter(o => o.severity === 'high').length;
    score -= highSeverityOutliers * 5;

    // CPA trend affects score
    const cpaTrend = analysis.trends.find(t => t.metric === 'CPA');
    if (cpaTrend) {
      if (cpaTrend.trend === 'decreasing') {
        score += 10;
      } else if (cpaTrend.trend === 'increasing') {
        score -= 10;
      }
    }

    return Math.max(0, Math.min(100, score));
  }
}
