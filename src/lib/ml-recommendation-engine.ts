import { StatisticalAnalysisService, PerformanceAnalysis } from './statistical-analysis';
import { KeywordAnalyzer } from './keyword-analyzer';
import { SearchTermAnalyzer } from './search-term-analyzer';
import { PrismaClient, RecommendationType, Campaign } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Campaign performance segment
 */
export interface CampaignSegment {
  segment: 'high_performer' | 'average_performer' | 'underperformer' | 'needs_attention';
  campaigns: string[];
  characteristics: string[];
  recommendations: string[];
}

/**
 * CPA prediction result
 */
export interface CPAPrediction {
  campaignId: string;
  currentCPA: number;
  predictedCPA: number;
  confidenceScore: number;
  trend: 'improving' | 'degrading' | 'stable';
  factors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }[];
}

/**
 * Generated recommendation
 */
export interface GeneratedRecommendation {
  type: RecommendationType;
  campaignId: string;
  title: string;
  description: string;
  reasoning: string;
  expectedImpact: string;
  impactMetric: string;
  impactValue: number;
  confidenceScore: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  suggestedChanges: any;
}

/**
 * ML-based Recommendation Engine
 *
 * Generates intelligent optimization recommendations using:
 * - Statistical analysis from StatisticalAnalysisService
 * - Pattern recognition algorithms
 * - Performance prediction models
 * - Campaign segmentation
 * - Rule-based optimization logic
 */
export class MLRecommendationEngine {
  /**
   * Generate comprehensive recommendations for a campaign
   */
  static async generateRecommendations(
    campaignId: string,
    adAccountId: string,
    days: number = 30
  ): Promise<GeneratedRecommendation[]> {
    const recommendations: GeneratedRecommendation[] = [];

    // Get statistical analysis
    const analysis = await StatisticalAnalysisService.analyzePerformance(campaignId, days);

    // Get campaign details
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Generate different types of recommendations
    const budgetRecs = await this.generateBudgetRecommendations(campaign, analysis);
    const performanceRecs = await this.generatePerformanceRecommendations(campaign, analysis);
    const biddingRecs = await this.generateBiddingRecommendations(campaign, analysis);
    const pauseRecs = await this.generatePauseRecommendations(campaign, analysis);

    recommendations.push(
      ...budgetRecs,
      ...performanceRecs,
      ...biddingRecs,
      ...pauseRecs
    );

    // Sort by priority and confidence
    return this.prioritizeRecommendations(recommendations);
  }

  /**
   * Predict future CPA based on historical trends
   */
  static async predictCPA(campaignId: string, days: number = 30): Promise<CPAPrediction> {
    const analysis = await StatisticalAnalysisService.analyzePerformance(campaignId, days);

    // Get CPA trend
    const cpaTrend = analysis.trends.find(t => t.metric === 'CPA');
    const cpaConfidenceInterval = analysis.confidenceIntervals.find(ci => ci.metric === 'CPA');

    if (!cpaTrend || !cpaConfidenceInterval) {
      throw new Error('Insufficient CPA data for prediction');
    }

    // Simple linear extrapolation for prediction
    const currentCPA = cpaConfidenceInterval.mean;
    const predictedCPA = currentCPA + (cpaTrend.slope * 7); // Predict 7 days ahead

    // Analyze factors affecting CPA
    const factors = this.analyzeCPAFactors(analysis);

    // Determine trend direction
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (cpaTrend.trend === 'increasing') {
      trend = 'degrading';
    } else if (cpaTrend.trend === 'decreasing') {
      trend = 'improving';
    }

    return {
      campaignId,
      currentCPA,
      predictedCPA,
      confidenceScore: cpaTrend.confidence,
      trend,
      factors,
    };
  }

  /**
   * Segment campaigns based on performance patterns
   */
  static async segmentCampaigns(
    adAccountId: string,
    days: number = 30
  ): Promise<CampaignSegment[]> {
    // Get all campaigns for the account
    const campaigns = await prisma.campaign.findMany({
      where: { adAccountId },
    });

    // Analyze each campaign
    const analyses = await Promise.all(
      campaigns.map(c =>
        StatisticalAnalysisService.analyzePerformance(c.id, days)
          .catch(() => null) // Skip campaigns with insufficient data
      )
    );

    // Group campaigns by performance
    const highPerformers: string[] = [];
    const averagePerformers: string[] = [];
    const underperformers: string[] = [];
    const needsAttention: string[] = [];

    analyses.forEach((analysis, index) => {
      if (!analysis) return;

      const campaign = campaigns[index];
      const health = analysis.summary.overallHealth;
      const hasSignificantIssues = analysis.outliers.filter(o => o.severity === 'high').length > 2;

      if (hasSignificantIssues || health === 'poor') {
        needsAttention.push(campaign.id);
      } else if (health === 'excellent') {
        highPerformers.push(campaign.id);
      } else if (health === 'fair' || health === 'good') {
        averagePerformers.push(campaign.id);
      }
    });

    // Create segments
    const segments: CampaignSegment[] = [];

    if (highPerformers.length > 0) {
      segments.push({
        segment: 'high_performer',
        campaigns: highPerformers,
        characteristics: [
          'Stable performance',
          'Low outlier occurrence',
          'Consistent conversion rates'
        ],
        recommendations: [
          'Scale budget to maximize returns',
          'Maintain current bidding strategy',
          'Monitor for sustainability'
        ],
      });
    }

    if (averagePerformers.length > 0) {
      segments.push({
        segment: 'average_performer',
        campaigns: averagePerformers,
        characteristics: [
          'Moderate performance',
          'Some optimization opportunities',
          'Room for improvement'
        ],
        recommendations: [
          'Test bid adjustments',
          'Optimize keyword selection',
          'Review ad creative performance'
        ],
      });
    }

    if (needsAttention.length > 0) {
      segments.push({
        segment: 'needs_attention',
        campaigns: needsAttention,
        characteristics: [
          'Performance issues detected',
          'High variability or outliers',
          'Potential wasteful spending'
        ],
        recommendations: [
          'Immediate review required',
          'Consider pausing or reducing budget',
          'Investigate root causes of poor performance'
        ],
      });
    }

    return segments;
  }

  // ========== Private Helper Methods ==========

  /**
   * Generate budget reallocation recommendations
   */
  private static async generateBudgetRecommendations(
    campaign: Campaign,
    analysis: PerformanceAnalysis
  ): Promise<GeneratedRecommendation[]> {
    const recommendations: GeneratedRecommendation[] = [];

    // Check if campaign is underperforming
    const costTrend = analysis.trends.find(t => t.metric === 'cost');
    const conversionsTrend = analysis.trends.find(t => t.metric === 'conversions');

    if (costTrend?.trend === 'increasing' && conversionsTrend?.trend === 'decreasing') {
      recommendations.push({
        type: RecommendationType.BUDGET_REALLOCATION,
        campaignId: campaign.id,
        title: 'Reduce budget for declining performance',
        description: `Campaign costs are increasing while conversions are decreasing. Consider reducing budget by ${this.calculateBudgetChange(analysis)}% to minimize waste.`,
        reasoning: `Statistical analysis shows ${costTrend.changePercentage.toFixed(1)}% cost increase with ${Math.abs(conversionsTrend.changePercentage).toFixed(1)}% conversion decrease. This indicates deteriorating efficiency.`,
        expectedImpact: `${this.calculateBudgetChange(analysis)}% cost reduction`,
        impactMetric: 'cost',
        impactValue: -this.calculateBudgetChange(analysis),
        confidenceScore: Math.min(costTrend.confidence, conversionsTrend.confidence),
        priority: 'high',
        suggestedChanges: {
          currentBudget: campaign.budget,
          suggestedBudget: campaign.budget ? campaign.budget * (1 - this.calculateBudgetChange(analysis) / 100) : null,
          action: 'reduce',
        },
      });
    }

    // Check if campaign is high performer
    if (analysis.summary.overallHealth === 'excellent') {
      const cpaBenchmark = analysis.benchmarks.find(b => b.metric === 'CPA');
      if (cpaBenchmark && cpaBenchmark.status === 'below') {
        recommendations.push({
          type: RecommendationType.BUDGET_REALLOCATION,
          campaignId: campaign.id,
          title: 'Increase budget for high-performing campaign',
          description: `Campaign is performing ${Math.abs(cpaBenchmark.percentageDifference).toFixed(1)}% better than benchmark. Consider increasing budget to scale returns.`,
          reasoning: `Excellent overall health with CPA significantly below benchmark indicates efficient spending with scaling opportunity.`,
          expectedImpact: `Potential ${(Math.abs(cpaBenchmark.percentageDifference) * 0.5).toFixed(1)}% increase in conversions`,
          impactMetric: 'conversions',
          impactValue: Math.abs(cpaBenchmark.percentageDifference) * 0.5,
          confidenceScore: 0.75,
          priority: 'medium',
          suggestedChanges: {
            currentBudget: campaign.budget,
            suggestedBudget: campaign.budget ? campaign.budget * 1.2 : null,
            action: 'increase',
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate performance optimization recommendations
   */
  private static async generatePerformanceRecommendations(
    campaign: Campaign,
    analysis: PerformanceAnalysis
  ): Promise<GeneratedRecommendation[]> {
    const recommendations: GeneratedRecommendation[] = [];

    // Check for significant performance changes
    const significantTests = analysis.significanceTests.filter(t => t.isSignificant);

    significantTests.forEach(test => {
      if (test.metric === 'CPA' && test.interpretation.includes('increased')) {
        recommendations.push({
          type: RecommendationType.BID_ADJUSTMENT,
          campaignId: campaign.id,
          title: 'CPA increase detected - Adjust bids',
          description: `${test.interpretation}. Consider lowering bids to improve efficiency.`,
          reasoning: `Statistical significance test indicates meaningful CPA degradation (p=${test.pValue.toFixed(4)}).`,
          expectedImpact: '10-15% CPA reduction',
          impactMetric: 'CPA',
          impactValue: -12.5,
          confidenceScore: test.confidenceLevel,
          priority: 'high',
          suggestedChanges: {
            action: 'lower_bids',
            percentage: 10,
          },
        });
      }
    });

    // Check for outliers
    const highSeverityOutliers = analysis.outliers.filter(o => o.severity === 'high');
    if (highSeverityOutliers.length > 3) {
      recommendations.push({
        type: RecommendationType.KEYWORD_OPTIMIZATION,
        campaignId: campaign.id,
        title: 'High performance variability detected',
        description: `${highSeverityOutliers.length} days with highly unusual performance. Review keywords and search terms for wasteful spending.`,
        reasoning: `Multiple high-severity outliers indicate inconsistent performance, often caused by irrelevant search terms or poorly performing keywords.`,
        expectedImpact: '15-20% cost reduction',
        impactMetric: 'cost',
        impactValue: -17.5,
        confidenceScore: 0.7,
        priority: 'high',
        suggestedChanges: {
          action: 'review_keywords',
          outlerCount: highSeverityOutliers.length,
        },
      });
    }

    return recommendations;
  }

  /**
   * Generate bidding strategy recommendations
   */
  private static async generateBiddingRecommendations(
    campaign: Campaign,
    analysis: PerformanceAnalysis
  ): Promise<GeneratedRecommendation[]> {
    const recommendations: GeneratedRecommendation[] = [];

    // Analyze bid strategy effectiveness
    if (campaign.biddingStrategy === 'MANUAL_CPC') {
      const cpaTrend = analysis.trends.find(t => t.metric === 'CPA');

      if (cpaTrend && cpaTrend.trend === 'increasing' && cpaTrend.confidence > 0.6) {
        recommendations.push({
          type: RecommendationType.BIDDING_STRATEGY_CHANGE,
          campaignId: campaign.id,
          title: 'Consider automated bidding strategy',
          description: `Manual CPC is showing increasing CPA trend. Automated bidding (Target CPA) may improve efficiency.`,
          reasoning: `Strong upward CPA trend (${cpaTrend.changePercentage.toFixed(1)}%) with high confidence (${(cpaTrend.confidence * 100).toFixed(0)}%) suggests manual bid management is suboptimal.`,
          expectedImpact: '10-20% CPA improvement',
          impactMetric: 'CPA',
          impactValue: -15,
          confidenceScore: cpaTrend.confidence * 0.8,
          priority: 'medium',
          suggestedChanges: {
            currentStrategy: 'MANUAL_CPC',
            suggestedStrategy: 'TARGET_CPA',
            targetCPA: campaign.targetCpa,
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate pause/removal recommendations
   */
  private static async generatePauseRecommendations(
    campaign: Campaign,
    analysis: PerformanceAnalysis
  ): Promise<GeneratedRecommendation[]> {
    const recommendations: GeneratedRecommendation[] = [];

    // Check if campaign should be paused
    if (analysis.summary.overallHealth === 'poor' && analysis.dataQuality.hasSufficientData) {
      const costBenchmark = analysis.benchmarks.find(b => b.metric === 'cost');
      const conversionsBenchmark = analysis.benchmarks.find(b => b.metric === 'conversions');

      if (
        costBenchmark?.status === 'above' &&
        conversionsBenchmark?.status === 'below'
      ) {
        recommendations.push({
          type: RecommendationType.PAUSE_CAMPAIGN,
          campaignId: campaign.id,
          title: 'Consider pausing underperforming campaign',
          description: `Campaign is spending ${Math.abs(costBenchmark.percentageDifference).toFixed(1)}% above benchmark while conversions are ${Math.abs(conversionsBenchmark.percentageDifference).toFixed(1)}% below benchmark.`,
          reasoning: `Consistently poor performance with high costs and low conversions indicates this campaign may need restructuring or pausing.`,
          expectedImpact: `Save ${costBenchmark.currentValue.toFixed(2)} per day`,
          impactMetric: 'cost',
          impactValue: -100,
          confidenceScore: 0.8,
          priority: 'critical',
          suggestedChanges: {
            action: 'pause',
            reason: 'poor_performance',
          },
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze factors affecting CPA
   */
  private static analyzeCPAFactors(analysis: PerformanceAnalysis): CPAPrediction['factors'] {
    const factors: CPAPrediction['factors'] = [];

    // Cost trend impact
    const costTrend = analysis.trends.find(t => t.metric === 'cost');
    if (costTrend) {
      factors.push({
        factor: 'Cost Trend',
        impact: costTrend.trend === 'increasing' ? 'negative' : 'positive',
        weight: Math.abs(costTrend.changePercentage) / 100,
      });
    }

    // Conversion trend impact
    const conversionsTrend = analysis.trends.find(t => t.metric === 'conversions');
    if (conversionsTrend) {
      factors.push({
        factor: 'Conversions Trend',
        impact: conversionsTrend.trend === 'increasing' ? 'positive' : 'negative',
        weight: Math.abs(conversionsTrend.changePercentage) / 100,
      });
    }

    // Outlier impact
    const outlierCount = analysis.outliers.length;
    if (outlierCount > 0) {
      factors.push({
        factor: 'Performance Stability',
        impact: outlierCount > 3 ? 'negative' : 'neutral',
        weight: Math.min(outlierCount / 10, 1),
      });
    }

    return factors;
  }

  /**
   * Calculate budget change percentage
   */
  private static calculateBudgetChange(analysis: PerformanceAnalysis): number {
    const costTrend = analysis.trends.find(t => t.metric === 'cost');
    const conversionsTrend = analysis.trends.find(t => t.metric === 'conversions');

    if (!costTrend || !conversionsTrend) return 10; // Default 10%

    // Calculate change based on performance degradation
    const degradation = Math.abs(costTrend.changePercentage) + Math.abs(conversionsTrend.changePercentage);
    return Math.min(Math.round(degradation / 2), 30); // Max 30% change
  }

  /**
   * Prioritize recommendations by priority and confidence
   */
  private static prioritizeRecommendations(
    recommendations: GeneratedRecommendation[]
  ): GeneratedRecommendation[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return recommendations.sort((a, b) => {
      // First sort by priority
      if (a.priority !== b.priority) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Then by confidence score
      return b.confidenceScore - a.confidenceScore;
    });
  }

  /**
   * Store recommendations in database
   */
  static async storeRecommendations(
    adAccountId: string,
    recommendations: GeneratedRecommendation[]
  ): Promise<void> {
    await Promise.all(
      recommendations.map(rec =>
        prisma.recommendation.create({
          data: {
            adAccountId,
            campaignId: rec.campaignId,
            type: rec.type,
            title: rec.title,
            description: rec.description,
            reasoning: rec.reasoning,
            expectedImpact: rec.expectedImpact,
            impactMetric: rec.impactMetric,
            impactValue: rec.impactValue,
            confidenceScore: rec.confidenceScore,
            priority: rec.priority,
            suggestedChanges: rec.suggestedChanges,
          },
        })
      )
    );
  }
}
