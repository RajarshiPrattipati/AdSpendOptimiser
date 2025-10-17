import { PrismaClient, RecommendationType } from '@prisma/client';
import { StatisticalAnalysisService, PerformanceAnalysis } from './statistical-analysis';
import { GeneratedRecommendation } from './ml-recommendation-engine';

const prisma = new PrismaClient();

/**
 * Impact estimate with confidence intervals and risk assessment
 */
export interface ImpactEstimate {
  metric: 'CPA' | 'conversions' | 'cost' | 'ROAS' | 'CTR' | 'revenue';

  // Current state
  currentValue: number;

  // Expected impact
  expectedChange: number;
  expectedChangePercentage: number;
  expectedNewValue: number;

  // Confidence intervals (95%)
  confidenceInterval: {
    lower: number;
    upper: number;
    confidenceLevel: number;
  };

  // Risk assessment
  riskAssessment: {
    bestCase: number;
    worstCase: number;
    expectedCase: number;
    riskLevel: 'low' | 'medium' | 'high';
    downside: number;
    upside: number;
  };

  // Statistical backing
  confidenceScore: number;
  sampleSize: number;
  standardError: number;

  // Time-based projection
  projectedMonthlyImpact: number;
  timeToImpact: string; // "immediate", "1-2 weeks", "2-4 weeks"
}

/**
 * Complete impact analysis for a recommendation
 */
export interface RecommendationImpact {
  recommendationType: RecommendationType;
  recommendationId?: string;
  campaignId: string;

  // Primary impact
  primaryImpact: ImpactEstimate;

  // Secondary impacts
  secondaryImpacts: ImpactEstimate[];

  // Overall assessment
  overallScore: number; // 0-100
  implementationComplexity: 'low' | 'medium' | 'high';
  expectedROI: number;

  // Validation
  historicalValidation?: {
    similarRecommendationsCount: number;
    successRate: number;
    averageActualImpact: number;
    confidence: 'low' | 'medium' | 'high';
  };
}

/**
 * Impact simulation for what-if scenarios
 */
export interface ImpactSimulation {
  scenario: string;
  assumptions: Record<string, any>;
  projectedMetrics: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercentage: number;
  }[];
  confidence: number;
  timeframe: string;
}

/**
 * Impact Estimation Service
 *
 * Centralizes all impact calculations with:
 * - Confidence intervals
 * - Risk assessment
 * - Historical validation
 * - Impact simulation
 * - Statistical backing
 */
export class ImpactEstimationService {
  private static readonly CONFIDENCE_LEVEL = 0.95; // 95% confidence
  private static readonly Z_SCORE_95 = 1.96;

  /**
   * Calculate comprehensive impact estimate for a recommendation
   */
  static async estimateImpact(
    recommendation: GeneratedRecommendation,
    analysis: PerformanceAnalysis
  ): Promise<RecommendationImpact> {
    const { type, campaignId } = recommendation;

    // Get primary metric for this recommendation type
    const primaryMetric = this.getPrimaryMetric(type);

    // Calculate primary impact
    const primaryImpact = await this.calculateImpactEstimate(
      campaignId,
      primaryMetric,
      recommendation.impactValue,
      analysis
    );

    // Calculate secondary impacts
    const secondaryImpacts = await this.calculateSecondaryImpacts(
      campaignId,
      type,
      recommendation.impactValue,
      analysis
    );

    // Calculate overall score
    const overallScore = this.calculateOverallScore(
      primaryImpact,
      secondaryImpacts,
      recommendation.confidenceScore
    );

    // Determine implementation complexity
    const implementationComplexity = this.assessImplementationComplexity(type);

    // Calculate expected ROI
    const expectedROI = this.calculateExpectedROI(
      primaryImpact,
      secondaryImpacts,
      implementationComplexity
    );

    // Historical validation (if available)
    const historicalValidation = await this.validateAgainstHistory(
      type,
      recommendation.impactValue
    );

    return {
      recommendationType: type,
      campaignId,
      primaryImpact,
      secondaryImpacts,
      overallScore,
      implementationComplexity,
      expectedROI,
      historicalValidation,
    };
  }

  /**
   * Calculate detailed impact estimate for a specific metric
   */
  static async calculateImpactEstimate(
    campaignId: string,
    metric: ImpactEstimate['metric'],
    expectedChangePercentage: number,
    analysis: PerformanceAnalysis
  ): Promise<ImpactEstimate> {
    // Get current value from analysis
    const currentValue = this.getCurrentMetricValue(metric, analysis);

    // Calculate expected change
    const expectedChange = currentValue * (expectedChangePercentage / 100);
    const expectedNewValue = currentValue + expectedChange;

    // Get confidence interval from analysis
    const ci = analysis.confidenceIntervals.find(c => c.metric === metric);
    const standardError = ci?.standardError || currentValue * 0.1; // Default to 10% SE

    // Calculate confidence interval for the impact
    const impactStandardError = standardError * Math.abs(expectedChangePercentage / 100);
    const marginOfError = this.Z_SCORE_95 * impactStandardError;

    const confidenceInterval = {
      lower: expectedNewValue - marginOfError,
      upper: expectedNewValue + marginOfError,
      confidenceLevel: this.CONFIDENCE_LEVEL,
    };

    // Risk assessment
    const riskAssessment = this.assessRisk(
      currentValue,
      expectedNewValue,
      confidenceInterval,
      expectedChangePercentage
    );

    // Calculate confidence score based on data quality
    const confidenceScore = this.calculateConfidenceScore(
      analysis,
      metric,
      expectedChangePercentage
    );

    // Time to impact based on recommendation type
    const timeToImpact = this.estimateTimeToImpact(expectedChangePercentage);

    // Monthly projection
    const projectedMonthlyImpact = Math.abs(expectedChange) * 30;

    return {
      metric,
      currentValue,
      expectedChange,
      expectedChangePercentage,
      expectedNewValue,
      confidenceInterval,
      riskAssessment,
      confidenceScore,
      sampleSize: analysis.daysAnalyzed,
      standardError: impactStandardError,
      projectedMonthlyImpact,
      timeToImpact,
    };
  }

  /**
   * Calculate secondary impacts (spillover effects)
   */
  static async calculateSecondaryImpacts(
    campaignId: string,
    type: RecommendationType,
    primaryImpactPercentage: number,
    analysis: PerformanceAnalysis
  ): Promise<ImpactEstimate[]> {
    const secondaryImpacts: ImpactEstimate[] = [];

    // Different recommendation types have different secondary effects
    switch (type) {
      case RecommendationType.BUDGET_REALLOCATION:
        // Budget changes affect conversions and CPA
        if (primaryImpactPercentage > 0) {
          // Budget increase
          secondaryImpacts.push(
            await this.calculateImpactEstimate(
              campaignId,
              'conversions',
              primaryImpactPercentage * 0.7, // 70% conversion follow-through
              analysis
            )
          );
        } else {
          // Budget decrease
          secondaryImpacts.push(
            await this.calculateImpactEstimate(
              campaignId,
              'CPA',
              Math.abs(primaryImpactPercentage) * 0.5, // 50% CPA improvement
              analysis
            )
          );
        }
        break;

      case RecommendationType.KEYWORD_OPTIMIZATION:
      case RecommendationType.ADD_NEGATIVE_KEYWORD:
        // Keyword changes affect cost and quality score
        secondaryImpacts.push(
          await this.calculateImpactEstimate(
            campaignId,
            'CPA',
            Math.abs(primaryImpactPercentage) * 0.8, // 80% CPA improvement
            analysis
          )
        );
        break;

      case RecommendationType.BID_ADJUSTMENT:
        // Bid changes affect conversions and CPA
        secondaryImpacts.push(
          await this.calculateImpactEstimate(
            campaignId,
            'conversions',
            primaryImpactPercentage * 0.6, // 60% conversion impact
            analysis
          ),
          await this.calculateImpactEstimate(
            campaignId,
            'CPA',
            -primaryImpactPercentage * 0.4, // 40% inverse CPA impact
            analysis
          )
        );
        break;

      case RecommendationType.BIDDING_STRATEGY_CHANGE:
        // Strategy changes have broad impacts
        secondaryImpacts.push(
          await this.calculateImpactEstimate(
            campaignId,
            'CPA',
            primaryImpactPercentage,
            analysis
          ),
          await this.calculateImpactEstimate(
            campaignId,
            'conversions',
            primaryImpactPercentage * 0.5,
            analysis
          )
        );
        break;
    }

    return secondaryImpacts;
  }

  /**
   * Simulate impact of multiple recommendations
   */
  static async simulateImpact(
    campaignId: string,
    recommendations: GeneratedRecommendation[],
    scenario: string
  ): Promise<ImpactSimulation> {
    // Get current campaign metrics
    const analysis = await StatisticalAnalysisService.analyzePerformance(campaignId, 30);

    // Calculate cumulative impact
    const projectedMetrics: ImpactSimulation['projectedMetrics'] = [];

    // Track metrics
    const metricsToTrack: ImpactEstimate['metric'][] = ['cost', 'conversions', 'CPA', 'ROAS'];

    for (const metric of metricsToTrack) {
      const currentValue = this.getCurrentMetricValue(metric, analysis);
      let totalChange = 0;

      // Sum up impacts from all recommendations
      for (const rec of recommendations) {
        if (rec.impactMetric === metric) {
          totalChange += rec.impactValue;
        }
      }

      const projectedValue = currentValue * (1 + totalChange / 100);

      projectedMetrics.push({
        metric,
        currentValue,
        projectedValue,
        changePercentage: totalChange,
      });
    }

    // Calculate overall confidence
    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidenceScore, 0) / recommendations.length;

    // Adjust confidence for interaction effects
    const interactionPenalty = Math.min(recommendations.length * 0.05, 0.2); // Max 20% penalty
    const confidence = avgConfidence * (1 - interactionPenalty);

    return {
      scenario,
      assumptions: {
        recommendationCount: recommendations.length,
        analysisWindow: '30 days',
        interactionEffects: 'moderate',
      },
      projectedMetrics,
      confidence,
      timeframe: '2-4 weeks',
    };
  }

  /**
   * Validate impact estimate against historical data
   */
  static async validateAgainstHistory(
    type: RecommendationType,
    expectedImpact: number
  ): Promise<RecommendationImpact['historicalValidation']> {
    // Get similar historical recommendations
    const historicalRecs = await prisma.recommendation.findMany({
      where: {
        type,
        status: 'IMPLEMENTED',
        implementedAt: {
          not: null,
        },
      },
      take: 50, // Last 50 similar recommendations
    });

    if (historicalRecs.length < 5) {
      return undefined; // Not enough data for validation
    }

    // Calculate success rate (recommendations that met expected impact)
    let successCount = 0;
    let totalActualImpact = 0;

    for (const rec of historicalRecs) {
      const actualImpact = (rec.impactValue || 0);
      totalActualImpact += actualImpact;

      // Consider successful if within 20% of expected
      if (Math.abs(actualImpact - expectedImpact) / Math.abs(expectedImpact) <= 0.2) {
        successCount++;
      }
    }

    const successRate = successCount / historicalRecs.length;
    const averageActualImpact = totalActualImpact / historicalRecs.length;

    // Determine confidence level
    let confidence: 'low' | 'medium' | 'high';
    if (successRate > 0.7 && historicalRecs.length > 20) {
      confidence = 'high';
    } else if (successRate > 0.5 && historicalRecs.length > 10) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      similarRecommendationsCount: historicalRecs.length,
      successRate,
      averageActualImpact,
      confidence,
    };
  }

  // ========== Helper Methods ==========

  /**
   * Get primary metric for recommendation type
   */
  private static getPrimaryMetric(type: RecommendationType): ImpactEstimate['metric'] {
    const metricMap: Record<RecommendationType, ImpactEstimate['metric']> = {
      [RecommendationType.BUDGET_REALLOCATION]: 'cost',
      [RecommendationType.KEYWORD_OPTIMIZATION]: 'cost',
      [RecommendationType.BID_ADJUSTMENT]: 'CPA',
      [RecommendationType.AD_CREATIVE]: 'conversions',
      [RecommendationType.PAUSE_CAMPAIGN]: 'cost',
      [RecommendationType.PAUSE_KEYWORD]: 'cost',
      [RecommendationType.ADD_NEGATIVE_KEYWORD]: 'cost',
      [RecommendationType.BIDDING_STRATEGY_CHANGE]: 'CPA',
    };

    return metricMap[type];
  }

  /**
   * Get current value for a metric from analysis
   */
  private static getCurrentMetricValue(
    metric: ImpactEstimate['metric'],
    analysis: PerformanceAnalysis
  ): number {
    const ci = analysis.confidenceIntervals.find(c => c.metric === metric);
    return ci?.mean || 0;
  }

  /**
   * Assess risk for an impact estimate
   */
  private static assessRisk(
    currentValue: number,
    expectedValue: number,
    confidenceInterval: ImpactEstimate['confidenceInterval'],
    changePercentage: number
  ): ImpactEstimate['riskAssessment'] {
    // Best case: upper bound of confidence interval
    const bestCase = confidenceInterval.upper;

    // Worst case: lower bound of confidence interval
    const worstCase = confidenceInterval.lower;

    // Expected case: the point estimate
    const expectedCase = expectedValue;

    // Calculate upside and downside
    const upside = Math.abs(bestCase - expectedCase);
    const downside = Math.abs(expectedCase - worstCase);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    const uncertaintyRange = Math.abs(bestCase - worstCase);
    const relativeUncertainty = uncertaintyRange / Math.abs(currentValue);

    if (relativeUncertainty < 0.2) {
      riskLevel = 'low';
    } else if (relativeUncertainty < 0.5) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      bestCase,
      worstCase,
      expectedCase,
      riskLevel,
      upside,
      downside,
    };
  }

  /**
   * Calculate confidence score based on data quality
   */
  private static calculateConfidenceScore(
    analysis: PerformanceAnalysis,
    metric: string,
    impactPercentage: number
  ): number {
    let score = 0.5; // Base score

    // Data quality contributes 30%
    if (analysis.dataQuality.hasSufficientData) {
      score += 0.15;
    }
    score += analysis.dataQuality.dataCompleteness * 0.15;

    // Statistical significance contributes 30%
    const sigTest = analysis.significanceTests.find(t => t.metric === metric);
    if (sigTest) {
      score += sigTest.confidenceLevel * 0.3;
    }

    // Trend confidence contributes 20%
    const trend = analysis.trends.find(t => t.metric === metric);
    if (trend) {
      score += trend.confidence * 0.2;
    }

    // Outlier penalty (up to 20%)
    const highSeverityOutliers = analysis.outliers.filter(o => o.severity === 'high').length;
    score -= Math.min(highSeverityOutliers * 0.05, 0.2);

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Estimate time to see impact
   */
  private static estimateTimeToImpact(changePercentage: number): string {
    if (Math.abs(changePercentage) > 20) {
      return 'immediate';
    } else if (Math.abs(changePercentage) > 10) {
      return '1-2 weeks';
    } else {
      return '2-4 weeks';
    }
  }

  /**
   * Calculate overall impact score (0-100)
   */
  private static calculateOverallScore(
    primaryImpact: ImpactEstimate,
    secondaryImpacts: ImpactEstimate[],
    baseConfidence: number
  ): number {
    // Start with base confidence
    let score = baseConfidence * 100;

    // Adjust based on primary impact magnitude
    const impactMagnitude = Math.abs(primaryImpact.expectedChangePercentage);
    if (impactMagnitude > 20) {
      score += 10;
    } else if (impactMagnitude > 10) {
      score += 5;
    }

    // Adjust based on risk level
    if (primaryImpact.riskAssessment.riskLevel === 'low') {
      score += 10;
    } else if (primaryImpact.riskAssessment.riskLevel === 'high') {
      score -= 10;
    }

    // Bonus for positive secondary impacts
    const positiveSecondaryCount = secondaryImpacts.filter(
      si => si.expectedChangePercentage > 0
    ).length;
    score += positiveSecondaryCount * 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Assess implementation complexity
   */
  private static assessImplementationComplexity(
    type: RecommendationType
  ): 'low' | 'medium' | 'high' {
    const complexityMap: Record<RecommendationType, 'low' | 'medium' | 'high'> = {
      [RecommendationType.ADD_NEGATIVE_KEYWORD]: 'low',
      [RecommendationType.PAUSE_KEYWORD]: 'low',
      [RecommendationType.BID_ADJUSTMENT]: 'low',
      [RecommendationType.BUDGET_REALLOCATION]: 'medium',
      [RecommendationType.KEYWORD_OPTIMIZATION]: 'medium',
      [RecommendationType.BIDDING_STRATEGY_CHANGE]: 'high',
      [RecommendationType.AD_CREATIVE]: 'high',
      [RecommendationType.PAUSE_CAMPAIGN]: 'medium',
    };

    return complexityMap[type];
  }

  /**
   * Calculate expected ROI
   */
  private static calculateExpectedROI(
    primaryImpact: ImpactEstimate,
    secondaryImpacts: ImpactEstimate[],
    complexity: 'low' | 'medium' | 'high'
  ): number {
    // Calculate total expected benefit
    let totalBenefit = Math.abs(primaryImpact.projectedMonthlyImpact);

    secondaryImpacts.forEach(si => {
      totalBenefit += Math.abs(si.projectedMonthlyImpact) * 0.5; // Weight secondary at 50%
    });

    // Estimate implementation cost (time/effort)
    const implementationCost = complexity === 'low' ? 100 : complexity === 'medium' ? 300 : 500;

    // ROI = (Benefit - Cost) / Cost
    return ((totalBenefit - implementationCost) / implementationCost) * 100;
  }
}
