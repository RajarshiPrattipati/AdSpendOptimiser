import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Campaign metrics data for analysis
 */
export interface CampaignMetricsData {
  date: Date;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
  ctr: number;
  averageCpc: number;
  costPerConversion: number;
  roas: number;
}

/**
 * Statistical significance test result
 */
export interface SignificanceTestResult {
  isSignificant: boolean;
  pValue: number;
  confidenceLevel: number;
  metric: string;
  interpretation: string;
}

/**
 * Trend analysis result
 */
export interface TrendAnalysis {
  metric: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  slope: number;
  changePercentage: number;
  confidence: number;
  interpretation: string;
}

/**
 * Performance benchmark result
 */
export interface PerformanceBenchmark {
  metric: string;
  currentValue: number;
  benchmarkValue: number;
  percentageDifference: number;
  status: 'above' | 'below' | 'at_benchmark';
  interpretation: string;
}

/**
 * Outlier detection result
 */
export interface OutlierDetection {
  date: Date;
  metric: string;
  value: number;
  zScore: number;
  isOutlier: boolean;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Confidence interval result
 */
export interface ConfidenceInterval {
  metric: string;
  mean: number;
  lowerBound: number;
  upperBound: number;
  confidenceLevel: number;
  standardError: number;
}

/**
 * Complete performance analysis result
 */
export interface PerformanceAnalysis {
  campaignId: string;
  campaignName?: string;
  periodStart: Date;
  periodEnd: Date;
  daysAnalyzed: number;
  dataQuality: {
    hasSufficientData: boolean;
    missingDays: number;
    dataCompleteness: number;
  };
  significanceTests: SignificanceTestResult[];
  trends: TrendAnalysis[];
  benchmarks: PerformanceBenchmark[];
  outliers: OutlierDetection[];
  confidenceIntervals: ConfidenceInterval[];
  summary: {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    keyFindings: string[];
    recommendations: string[];
  };
}

/**
 * Statistical Analysis Service for Campaign Performance
 *
 * Analyzes 30+ days of historical campaign data using:
 * - Statistical significance testing
 * - Trend analysis
 * - Performance benchmarking
 * - Outlier detection
 * - Confidence interval calculations
 */
export class StatisticalAnalysisService {
  private static readonly MIN_DAYS_REQUIRED = 30;
  private static readonly MIN_DATA_COMPLETENESS = 0.7; // 70%
  private static readonly SIGNIFICANCE_LEVEL = 0.05; // 95% confidence

  /**
   * Retrieve campaign metrics for analysis
   */
  static async getCampaignMetrics(
    campaignId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CampaignMetricsData[]> {
    const metrics = await prisma.campaignMetrics.findMany({
      where: {
        campaignId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    return metrics.map(m => ({
      date: m.date,
      impressions: m.impressions,
      clicks: m.clicks,
      cost: m.cost,
      conversions: m.conversions,
      conversionValue: m.conversionValue,
      ctr: m.ctr,
      averageCpc: m.averageCpc,
      costPerConversion: m.costPerConversion,
      roas: m.roas,
    }));
  }

  /**
   * Validate data quality and completeness
   */
  static validateData(
    metrics: CampaignMetricsData[],
    expectedDays: number
  ): {
    hasSufficientData: boolean;
    missingDays: number;
    dataCompleteness: number;
  } {
    const actualDays = metrics.length;
    const missingDays = expectedDays - actualDays;
    const dataCompleteness = actualDays / expectedDays;

    return {
      hasSufficientData:
        actualDays >= this.MIN_DAYS_REQUIRED &&
        dataCompleteness >= this.MIN_DATA_COMPLETENESS,
      missingDays: Math.max(0, missingDays),
      dataCompleteness,
    };
  }

  /**
   * Calculate statistical significance between two periods using t-test
   * Compares recent period vs earlier period for a specific metric
   */
  static calculateStatisticalSignificance(
    recentData: number[],
    historicalData: number[],
    metricName: string
  ): SignificanceTestResult {
    if (recentData.length < 2 || historicalData.length < 2) {
      return {
        isSignificant: false,
        pValue: 1,
        confidenceLevel: 0,
        metric: metricName,
        interpretation: 'Insufficient data for statistical analysis',
      };
    }

    // Calculate means
    const recentMean = this.mean(recentData);
    const historicalMean = this.mean(historicalData);

    // Calculate standard deviations
    const recentStd = this.standardDeviation(recentData);
    const historicalStd = this.standardDeviation(historicalData);

    // Calculate t-statistic (Welch's t-test for unequal variances)
    const n1 = recentData.length;
    const n2 = historicalData.length;

    const pooledStdError = Math.sqrt(
      (recentStd ** 2 / n1) + (historicalStd ** 2 / n2)
    );

    const tStatistic = (recentMean - historicalMean) / pooledStdError;

    // Calculate degrees of freedom (Welch-Satterthwaite equation)
    const df = Math.floor(
      ((recentStd ** 2 / n1) + (historicalStd ** 2 / n2)) ** 2 /
      ((recentStd ** 2 / n1) ** 2 / (n1 - 1) + (historicalStd ** 2 / n2) ** 2 / (n2 - 1))
    );

    // Approximate p-value using t-distribution
    const pValue = this.approximatePValue(Math.abs(tStatistic), df);
    const isSignificant = pValue < this.SIGNIFICANCE_LEVEL;

    const percentChange = ((recentMean - historicalMean) / historicalMean) * 100;
    const direction = recentMean > historicalMean ? 'increased' : 'decreased';

    return {
      isSignificant,
      pValue,
      confidenceLevel: 1 - pValue,
      metric: metricName,
      interpretation: isSignificant
        ? `${metricName} has ${direction} by ${Math.abs(percentChange).toFixed(1)}% with statistical significance (p=${pValue.toFixed(4)})`
        : `${metricName} change of ${percentChange.toFixed(1)}% is not statistically significant`,
    };
  }

  /**
   * Analyze trends using linear regression
   */
  static analyzeTrend(
    data: number[],
    metricName: string
  ): TrendAnalysis {
    if (data.length < 7) {
      return {
        metric: metricName,
        trend: 'stable',
        slope: 0,
        changePercentage: 0,
        confidence: 0,
        interpretation: 'Insufficient data for trend analysis',
      };
    }

    // Linear regression: y = mx + b
    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssTotal = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const ssResidual = y.reduce(
      (sum, yi, i) => sum + (yi - (slope * i + intercept)) ** 2,
      0
    );
    const rSquared = 1 - ssResidual / ssTotal;

    // Calculate percentage change from start to end
    const startValue = data[0];
    const endValue = data[data.length - 1];
    const changePercentage = startValue !== 0
      ? ((endValue - startValue) / startValue) * 100
      : 0;

    // Determine trend direction
    let trend: 'increasing' | 'decreasing' | 'stable';
    const slopeThreshold = yMean * 0.01; // 1% of mean as threshold

    if (Math.abs(slope) < slopeThreshold) {
      trend = 'stable';
    } else {
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }

    return {
      metric: metricName,
      trend,
      slope,
      changePercentage,
      confidence: rSquared,
      interpretation: this.interpretTrend(metricName, trend, changePercentage, rSquared),
    };
  }

  /**
   * Benchmark performance against historical averages
   */
  static benchmarkPerformance(
    currentPeriodData: number[],
    historicalData: number[],
    metricName: string
  ): PerformanceBenchmark {
    const currentMean = this.mean(currentPeriodData);
    const benchmarkMean = this.mean(historicalData);

    const percentageDifference = benchmarkMean !== 0
      ? ((currentMean - benchmarkMean) / benchmarkMean) * 100
      : 0;

    let status: 'above' | 'below' | 'at_benchmark';
    if (Math.abs(percentageDifference) < 5) {
      status = 'at_benchmark';
    } else if (percentageDifference > 0) {
      status = 'above';
    } else {
      status = 'below';
    }

    return {
      metric: metricName,
      currentValue: currentMean,
      benchmarkValue: benchmarkMean,
      percentageDifference,
      status,
      interpretation: this.interpretBenchmark(metricName, percentageDifference, status),
    };
  }

  /**
   * Detect outliers using z-score method
   */
  static detectOutliers(
    metrics: CampaignMetricsData[],
    metricName: keyof CampaignMetricsData
  ): OutlierDetection[] {
    const values = metrics.map(m => Number(m[metricName]));
    const mean = this.mean(values);
    const std = this.standardDeviation(values);

    const outliers: OutlierDetection[] = [];

    metrics.forEach((metric, index) => {
      const value = Number(metric[metricName]);
      const zScore = std !== 0 ? (value - mean) / std : 0;
      const absZScore = Math.abs(zScore);

      let isOutlier = false;
      let severity: 'low' | 'medium' | 'high' = 'low';

      if (absZScore > 3) {
        isOutlier = true;
        severity = 'high';
      } else if (absZScore > 2) {
        isOutlier = true;
        severity = 'medium';
      }

      if (isOutlier) {
        outliers.push({
          date: metric.date,
          metric: metricName,
          value,
          zScore,
          isOutlier,
          severity,
        });
      }
    });

    return outliers;
  }

  /**
   * Calculate confidence intervals for metrics
   */
  static calculateConfidenceInterval(
    data: number[],
    metricName: string,
    confidenceLevel: number = 0.95
  ): ConfidenceInterval {
    const n = data.length;
    const mean = this.mean(data);
    const std = this.standardDeviation(data);
    const standardError = std / Math.sqrt(n);

    // Using z-score for large samples (n > 30) or t-score for smaller samples
    const zScore = n > 30 ? 1.96 : 2.042; // 95% confidence
    const marginOfError = zScore * standardError;

    return {
      metric: metricName,
      mean,
      lowerBound: mean - marginOfError,
      upperBound: mean + marginOfError,
      confidenceLevel,
      standardError,
    };
  }

  /**
   * Perform comprehensive performance analysis
   */
  static async analyzePerformance(
    campaignId: string,
    days: number = 30
  ): Promise<PerformanceAnalysis> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Retrieve campaign data
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Get metrics
    const metrics = await this.getCampaignMetrics(campaignId, startDate, endDate);

    // Validate data quality
    const dataQuality = this.validateData(metrics, days);

    // Split data into two periods for comparison
    const midPoint = Math.floor(metrics.length / 2);
    const historicalMetrics = metrics.slice(0, midPoint);
    const recentMetrics = metrics.slice(midPoint);

    // Extract metric arrays
    const historicalCost = historicalMetrics.map(m => m.cost);
    const recentCost = recentMetrics.map(m => m.cost);
    const historicalConversions = historicalMetrics.map(m => m.conversions);
    const recentConversions = recentMetrics.map(m => m.conversions);
    const historicalCpa = historicalMetrics.map(m => m.costPerConversion).filter(v => v > 0);
    const recentCpa = recentMetrics.map(m => m.costPerConversion).filter(v => v > 0);
    const historicalRoas = historicalMetrics.map(m => m.roas);
    const recentRoas = recentMetrics.map(m => m.roas);

    // Statistical significance tests
    const significanceTests: SignificanceTestResult[] = [
      this.calculateStatisticalSignificance(recentCost, historicalCost, 'cost'),
      this.calculateStatisticalSignificance(recentConversions, historicalConversions, 'conversions'),
    ];

    if (historicalCpa.length > 0 && recentCpa.length > 0) {
      significanceTests.push(
        this.calculateStatisticalSignificance(recentCpa, historicalCpa, 'CPA')
      );
    }

    if (historicalRoas.length > 0 && recentRoas.length > 0) {
      significanceTests.push(
        this.calculateStatisticalSignificance(recentRoas, historicalRoas, 'ROAS')
      );
    }

    // Trend analysis
    const allCost = metrics.map(m => m.cost);
    const allConversions = metrics.map(m => m.conversions);
    const allCpa = metrics.map(m => m.costPerConversion).filter(v => v > 0);
    const allRoas = metrics.map(m => m.roas);

    const trends: TrendAnalysis[] = [
      this.analyzeTrend(allCost, 'cost'),
      this.analyzeTrend(allConversions, 'conversions'),
    ];

    if (allCpa.length > 7) {
      trends.push(this.analyzeTrend(allCpa, 'CPA'));
    }

    if (allRoas.length > 7) {
      trends.push(this.analyzeTrend(allRoas, 'ROAS'));
    }

    // Performance benchmarking
    const benchmarks: PerformanceBenchmark[] = [
      this.benchmarkPerformance(recentCost, historicalCost, 'cost'),
      this.benchmarkPerformance(recentConversions, historicalConversions, 'conversions'),
    ];

    if (historicalCpa.length > 0 && recentCpa.length > 0) {
      benchmarks.push(
        this.benchmarkPerformance(recentCpa, historicalCpa, 'CPA')
      );
    }

    // Outlier detection
    const outliers: OutlierDetection[] = [
      ...this.detectOutliers(metrics, 'cost'),
      ...this.detectOutliers(metrics, 'conversions'),
      ...this.detectOutliers(metrics, 'costPerConversion'),
    ];

    // Confidence intervals
    const confidenceIntervals: ConfidenceInterval[] = [
      this.calculateConfidenceInterval(allCost, 'cost'),
      this.calculateConfidenceInterval(allConversions, 'conversions'),
    ];

    if (allCpa.length > 0) {
      confidenceIntervals.push(
        this.calculateConfidenceInterval(allCpa, 'CPA')
      );
    }

    // Generate summary
    const summary = this.generateSummary(
      significanceTests,
      trends,
      benchmarks,
      outliers,
      dataQuality
    );

    return {
      campaignId,
      campaignName: campaign.campaignName,
      periodStart: startDate,
      periodEnd: endDate,
      daysAnalyzed: metrics.length,
      dataQuality,
      significanceTests,
      trends,
      benchmarks,
      outliers,
      confidenceIntervals,
      summary,
    };
  }

  // ========== Helper Methods ==========

  /**
   * Calculate mean of array
   */
  private static mean(data: number[]): number {
    if (data.length === 0) return 0;
    return data.reduce((sum, val) => sum + val, 0) / data.length;
  }

  /**
   * Calculate standard deviation
   */
  private static standardDeviation(data: number[]): number {
    if (data.length < 2) return 0;
    const avg = this.mean(data);
    const squaredDiffs = data.map(val => (val - avg) ** 2);
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / (data.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Approximate p-value from t-statistic (two-tailed test)
   */
  private static approximatePValue(tStat: number, df: number): number {
    // Simplified approximation for p-value
    // For production, consider using a proper statistics library
    if (df < 1) return 1;

    const x = df / (df + tStat ** 2);
    const a = df / 2;
    const b = 0.5;

    // Incomplete beta function approximation
    let p = Math.pow(x, a) * Math.pow(1 - x, b) / (2 * a);

    // Clamp between 0 and 1
    p = Math.max(0, Math.min(1, p));

    return p;
  }

  /**
   * Interpret trend analysis
   */
  private static interpretTrend(
    metric: string,
    trend: 'increasing' | 'decreasing' | 'stable',
    changePercentage: number,
    confidence: number
  ): string {
    const confidenceDesc = confidence > 0.7 ? 'high confidence' : confidence > 0.4 ? 'moderate confidence' : 'low confidence';

    if (trend === 'stable') {
      return `${metric} has remained relatively stable (${confidenceDesc})`;
    }

    return `${metric} is ${trend} by ${Math.abs(changePercentage).toFixed(1)}% (${confidenceDesc})`;
  }

  /**
   * Interpret benchmark comparison
   */
  private static interpretBenchmark(
    metric: string,
    percentageDifference: number,
    status: 'above' | 'below' | 'at_benchmark'
  ): string {
    if (status === 'at_benchmark') {
      return `${metric} is performing at benchmark levels`;
    }

    const direction = status === 'above' ? 'above' : 'below';
    return `${metric} is ${Math.abs(percentageDifference).toFixed(1)}% ${direction} the historical benchmark`;
  }

  /**
   * Generate analysis summary
   */
  private static generateSummary(
    significanceTests: SignificanceTestResult[],
    trends: TrendAnalysis[],
    benchmarks: PerformanceBenchmark[],
    outliers: OutlierDetection[],
    dataQuality: { hasSufficientData: boolean; missingDays: number; dataCompleteness: number }
  ): {
    overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
    keyFindings: string[];
    recommendations: string[];
  } {
    const keyFindings: string[] = [];
    const recommendations: string[] = [];

    // Data quality findings
    if (!dataQuality.hasSufficientData) {
      keyFindings.push(`Limited data available (${(dataQuality.dataCompleteness * 100).toFixed(0)}% completeness)`);
      recommendations.push('Ensure consistent data collection for more accurate analysis');
    }

    // Significant changes
    const significantChanges = significanceTests.filter(t => t.isSignificant);
    if (significantChanges.length > 0) {
      keyFindings.push(`${significantChanges.length} metrics show statistically significant changes`);
      significantChanges.forEach(test => {
        keyFindings.push(test.interpretation);
      });
    }

    // Trend findings
    const concerningTrends = trends.filter(
      t => (t.metric === 'CPA' && t.trend === 'increasing') ||
           (t.metric === 'conversions' && t.trend === 'decreasing') ||
           (t.metric === 'cost' && t.trend === 'increasing')
    );

    concerningTrends.forEach(trend => {
      keyFindings.push(trend.interpretation);
      recommendations.push(`Monitor ${trend.metric} trend and consider optimization actions`);
    });

    // Outlier findings
    const highSeverityOutliers = outliers.filter(o => o.severity === 'high');
    if (highSeverityOutliers.length > 0) {
      keyFindings.push(`${highSeverityOutliers.length} high-severity outliers detected`);
      recommendations.push('Investigate days with unusual performance patterns');
    }

    // Overall health assessment
    let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'good';

    if (!dataQuality.hasSufficientData || concerningTrends.length > 2 || highSeverityOutliers.length > 3) {
      overallHealth = 'poor';
    } else if (concerningTrends.length > 0 || highSeverityOutliers.length > 1) {
      overallHealth = 'fair';
    } else if (significantChanges.length === 0 && concerningTrends.length === 0) {
      overallHealth = 'excellent';
    }

    if (keyFindings.length === 0) {
      keyFindings.push('Campaign performance is stable with no significant anomalies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring performance and maintain current strategy');
    }

    return {
      overallHealth,
      keyFindings,
      recommendations,
    };
  }
}
