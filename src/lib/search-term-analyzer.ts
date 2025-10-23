import { SearchTermData } from './google-ads';

export interface SearchTermRecommendation {
  searchTerm: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  estimatedSavings: number;
  metrics: {
    cost: number;
    clicks: number;
    conversions: number;
    cpa: number;
    conversionRate: number;
  };
}

/**
 * Analyze search terms and generate negative keyword recommendations
 */
export class SearchTermAnalyzer {
  /**
   * Analyze search terms and prioritize negative keyword candidates
   * Based on:
   * - High cost with zero conversions = HIGH priority
   * - Moderate cost with zero conversions = MEDIUM priority
   * - Low conversion rate with moderate cost = LOW priority
   */
  static analyzeSearchTerms(searchTerms: SearchTermData[], accountGoals?: {
    targetCpa?: number;
    minConversionRate?: number;
  }): SearchTermRecommendation[] {
    const recommendations: SearchTermRecommendation[] = [];

    // Default thresholds
    const HIGH_COST_THRESHOLD = 50; // $50+
    const MEDIUM_COST_THRESHOLD = 20; // $20+
    const LOW_CONVERSION_RATE = accountGoals?.minConversionRate || 1; // 1%
    const targetCpa = accountGoals?.targetCpa;

    // Aggregate search terms by unique term
    const aggregated = this.aggregateSearchTerms(searchTerms);

    for (const [term, data] of Object.entries(aggregated)) {
      const cost = data.cost;
      const conversions = data.conversions;
      const clicks = data.clicks;
      const conversionRate = data.conversionRate;
      const cpa = data.cpa;

      // Skip if already converting well
      if (conversions > 0 && (!targetCpa || cpa <= targetCpa)) {
        continue;
      }

      // HIGH PRIORITY: High cost + zero conversions
      if (cost >= HIGH_COST_THRESHOLD && conversions === 0) {
        recommendations.push({
          searchTerm: term,
          priority: 'high',
          reason: `Spent $${cost.toFixed(2)} with 0 conversions - immediate waste`,
          estimatedSavings: cost,
          metrics: {
            cost,
            clicks,
            conversions,
            cpa,
            conversionRate,
          },
        });
        continue;
      }

      // HIGH PRIORITY: Above target CPA with high cost
      if (targetCpa && cpa > targetCpa * 2 && cost >= MEDIUM_COST_THRESHOLD) {
        recommendations.push({
          searchTerm: term,
          priority: 'high',
          reason: `CPA of $${cpa.toFixed(2)} is ${((cpa / targetCpa - 1) * 100).toFixed(0)}% above target`,
          estimatedSavings: cost * 0.8, // Estimate 80% of cost is waste
          metrics: {
            cost,
            clicks,
            conversions,
            cpa,
            conversionRate,
          },
        });
        continue;
      }

      // MEDIUM PRIORITY: Moderate cost + zero conversions
      if (cost >= MEDIUM_COST_THRESHOLD && cost < HIGH_COST_THRESHOLD && conversions === 0) {
        recommendations.push({
          searchTerm: term,
          priority: 'medium',
          reason: `Spent $${cost.toFixed(2)} with 0 conversions`,
          estimatedSavings: cost,
          metrics: {
            cost,
            clicks,
            conversions,
            cpa,
            conversionRate,
          },
        });
        continue;
      }

      // MEDIUM PRIORITY: Low conversion rate with moderate cost
      if (conversionRate < LOW_CONVERSION_RATE && cost >= MEDIUM_COST_THRESHOLD && conversions > 0) {
        recommendations.push({
          searchTerm: term,
          priority: 'medium',
          reason: `Low conversion rate (${conversionRate.toFixed(2)}%) with $${cost.toFixed(2)} spend`,
          estimatedSavings: cost * 0.5, // Estimate 50% of cost is waste
          metrics: {
            cost,
            clicks,
            conversions,
            cpa,
            conversionRate,
          },
        });
        continue;
      }

      // LOW PRIORITY: Low cost + zero conversions (but could add up)
      if (cost < MEDIUM_COST_THRESHOLD && conversions === 0 && clicks >= 5) {
        recommendations.push({
          searchTerm: term,
          priority: 'low',
          reason: `$${cost.toFixed(2)} spent with 0 conversions - minor waste`,
          estimatedSavings: cost,
          metrics: {
            cost,
            clicks,
            conversions,
            cpa,
            conversionRate,
          },
        });
      }
    }

    // Sort by estimated savings (highest first)
    return recommendations.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  /**
   * Aggregate search term data by term
   */
  private static aggregateSearchTerms(searchTerms: SearchTermData[]): Record<string, {
    cost: number;
    clicks: number;
    conversions: number;
    cpa: number;
    conversionRate: number;
    impressions: number;
  }> {
    const aggregated: Record<string, any> = {};

    for (const term of searchTerms) {
      if (!aggregated[term.searchTerm]) {
        aggregated[term.searchTerm] = {
          cost: 0,
          clicks: 0,
          conversions: 0,
          impressions: 0,
        };
      }

      aggregated[term.searchTerm].cost += term.cost;
      aggregated[term.searchTerm].clicks += term.clicks;
      aggregated[term.searchTerm].conversions += term.conversions;
      aggregated[term.searchTerm].impressions += term.impressions;
    }

    // Calculate derived metrics
    for (const term in aggregated) {
      const data = aggregated[term];
      data.cpa = data.conversions > 0 ? data.cost / data.conversions : 0;
      data.conversionRate = data.clicks > 0 ? (data.conversions / data.clicks) * 100 : 0;
    }

    return aggregated;
  }

  /**
   * Calculate total estimated savings from all recommendations
   */
  static calculateTotalSavings(recommendations: SearchTermRecommendation[]): {
    total: number;
    byPriority: { high: number; medium: number; low: number };
  } {
    const byPriority = { high: 0, medium: 0, low: 0 };

    for (const rec of recommendations) {
      byPriority[rec.priority] += rec.estimatedSavings;
    }

    return {
      total: byPriority.high + byPriority.medium + byPriority.low,
      byPriority,
    };
  }
}
