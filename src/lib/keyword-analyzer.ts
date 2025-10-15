import { KeywordData } from './google-ads';

export interface KeywordRecommendation {
  keywordId: string;
  keywordText: string;
  action: 'pause' | 'scale' | 'optimize';
  priority: 'high' | 'medium' | 'low';
  reason: string;
  metrics: {
    cost: number;
    clicks: number;
    conversions: number;
    cpa: number;
    ctr: number;
    qualityScore?: number;
  };
}

/**
 * Analyze keyword performance and generate recommendations
 */
export class KeywordAnalyzer {
  /**
   * Analyze keywords and generate actionable recommendations
   * Based on account goals and performance thresholds
   */
  static analyzeKeywords(keywords: KeywordData[], accountGoals: {
    targetCpa?: number;
    targetRoas?: number;
    minConversionRate?: number;
    minQualityScore?: number;
  }): {
    pause: KeywordRecommendation[];
    scale: KeywordRecommendation[];
    optimize: KeywordRecommendation[];
  } {
    const pause: KeywordRecommendation[] = [];
    const scale: KeywordRecommendation[] = [];
    const optimize: KeywordRecommendation[] = [];

    // Default thresholds
    const targetCpa = accountGoals.targetCpa || 100;
    const minConversionRate = accountGoals.minConversionRate || 1;
    const minQualityScore = accountGoals.minQualityScore || 5;

    for (const keyword of keywords) {
      const { cost, conversions, cpa, ctr, qualityScore } = keyword;

      // Skip if not enough data
      if (cost < 10) continue;

      // PAUSE recommendations
      // 1. High cost + zero conversions
      if (cost >= 50 && conversions === 0) {
        pause.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'pause',
          priority: 'high',
          reason: `Spent $${cost.toFixed(2)} with 0 conversions - pure waste`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
        continue;
      }

      // 2. CPA significantly above target
      if (conversions > 0 && cpa > targetCpa * 2) {
        pause.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'pause',
          priority: 'high',
          reason: `CPA of $${cpa.toFixed(2)} is ${((cpa / targetCpa - 1) * 100).toFixed(0)}% above target`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
        continue;
      }

      // 3. Low quality score + poor performance
      if (qualityScore && qualityScore < minQualityScore && (conversions === 0 || cpa > targetCpa * 1.5)) {
        pause.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'pause',
          priority: 'medium',
          reason: `Low quality score (${qualityScore}) with poor performance`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
        continue;
      }

      // SCALE recommendations
      // 1. CPA well below target + good volume
      if (conversions >= 5 && cpa < targetCpa * 0.5) {
        scale.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'scale',
          priority: 'high',
          reason: `Excellent CPA of $${cpa.toFixed(2)} (${((1 - cpa / targetCpa) * 100).toFixed(0)}% below target) - increase bids`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
        continue;
      }

      // 2. Good conversion rate + reasonable CPA
      const conversionRate = keyword.clicks > 0 ? (conversions / keyword.clicks) * 100 : 0;
      if (conversions >= 3 && conversionRate >= minConversionRate * 2 && cpa <= targetCpa) {
        scale.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'scale',
          priority: 'medium',
          reason: `Strong conversion rate (${conversionRate.toFixed(1)}%) at target CPA - scale up`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
        continue;
      }

      // OPTIMIZE recommendations
      // 1. Near target CPA but could improve
      if (conversions > 0 && cpa > targetCpa && cpa < targetCpa * 1.5) {
        optimize.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'optimize',
          priority: 'medium',
          reason: `CPA of $${cpa.toFixed(2)} slightly above target - optimize bids or landing page`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
        continue;
      }

      // 2. Low CTR but converting
      if (conversions > 0 && ctr < 1.0) {
        optimize.push({
          keywordId: keyword.keywordId,
          keywordText: keyword.keywordText,
          action: 'optimize',
          priority: 'low',
          reason: `Low CTR (${(ctr * 100).toFixed(2)}%) - improve ad relevance`,
          metrics: {
            cost,
            clicks: keyword.clicks,
            conversions,
            cpa,
            ctr,
            qualityScore,
          },
        });
      }
    }

    // Sort each category by priority and cost
    const sortFn = (a: KeywordRecommendation, b: KeywordRecommendation) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.metrics.cost - a.metrics.cost;
    };

    return {
      pause: pause.sort(sortFn),
      scale: scale.sort(sortFn),
      optimize: optimize.sort(sortFn),
    };
  }

  /**
   * Calculate potential impact of recommendations
   */
  static calculateImpact(recommendations: {
    pause: KeywordRecommendation[];
    scale: KeywordRecommendation[];
    optimize: KeywordRecommendation[];
  }) {
    const pauseSavings = recommendations.pause.reduce((sum, rec) => sum + rec.metrics.cost, 0);
    const scaleOpportunity = recommendations.scale.reduce((sum, rec) => sum + rec.metrics.cost, 0);

    return {
      potentialSavings: pauseSavings,
      scaleOpportunity: scaleOpportunity * 0.5, // Estimate 50% increase opportunity
      totalRecommendations: recommendations.pause.length + recommendations.scale.length + recommendations.optimize.length,
      byAction: {
        pause: recommendations.pause.length,
        scale: recommendations.scale.length,
        optimize: recommendations.optimize.length,
      },
    };
  }
}
