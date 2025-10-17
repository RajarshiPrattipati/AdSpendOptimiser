import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Budget forecast result
 */
export interface BudgetForecast {
  campaignId: string;
  campaignName: string;
  currentBudget: number;
  suggestedBudget: number;
  forecastedMetrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    cost: number;
    roas: number;
  };
  confidence: number;
}

/**
 * Budget Forecasting Engine
 *
 * Predicts campaign performance under different budget scenarios
 */
export class BudgetForecaster {
  /**
   * Forecast campaign performance with a new budget
   */
  static async forecastCampaign(
    campaignId: string,
    newBudget: number,
    forecastDays: number = 30
  ): Promise<BudgetForecast | null> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          metrics: {
            orderBy: { date: 'desc' },
            take: 30, // Last 30 days of data
          },
        },
      });

      if (!campaign || campaign.metrics.length === 0) {
        return null;
      }

      // Calculate average daily performance
      const totalDays = campaign.metrics.length;
      const avgDaily = campaign.metrics.reduce(
        (acc, m) => ({
          impressions: acc.impressions + m.impressions / totalDays,
          clicks: acc.clicks + m.clicks / totalDays,
          conversions: acc.conversions + m.conversions / totalDays,
          cost: acc.cost + m.cost / totalDays,
          conversionValue: acc.conversionValue + m.conversionValue / totalDays,
        }),
        { impressions: 0, clicks: 0, conversions: 0, cost: 0, conversionValue: 0 }
      );

      // Calculate budget multiplier
      const currentDailyBudget = campaign.budget || avgDaily.cost;
      const budgetMultiplier = newBudget / currentDailyBudget;

      // Forecast with diminishing returns
      // Assumes 80% efficiency at 2x budget, 60% at 3x, etc.
      const efficiency = Math.min(1, 1 / Math.pow(budgetMultiplier, 0.3));

      const forecastedDaily = {
        impressions: avgDaily.impressions * budgetMultiplier * efficiency,
        clicks: avgDaily.clicks * budgetMultiplier * efficiency,
        conversions: avgDaily.conversions * budgetMultiplier * efficiency,
        cost: newBudget,
        conversionValue: avgDaily.conversionValue * budgetMultiplier * efficiency,
      };

      // Scale to forecast period
      const forecasted = {
        impressions: Math.round(forecastedDaily.impressions * forecastDays),
        clicks: Math.round(forecastedDaily.clicks * forecastDays),
        conversions: parseFloat((forecastedDaily.conversions * forecastDays).toFixed(2)),
        cost: newBudget * forecastDays,
        roas: forecastedDaily.conversionValue / forecastedDaily.cost,
      };

      // Calculate confidence based on data availability
      const confidence = Math.min(0.95, totalDays / 30);

      return {
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        currentBudget: currentDailyBudget,
        suggestedBudget: newBudget,
        forecastedMetrics: forecasted,
        confidence,
      };
    } catch (error) {
      console.error('[BudgetForecaster] Error forecasting campaign:', error);
      return null;
    }
  }

  /**
   * Forecast all campaigns in an account
   */
  static async forecastAccount(
    adAccountId: string,
    totalBudget: number,
    forecastDays: number = 30
  ): Promise<BudgetForecast[]> {
    try {
      const campaigns = await prisma.campaign.findMany({
        where: {
          adAccountId,
          status: 'ENABLED',
        },
        include: {
          metrics: {
            orderBy: { date: 'desc' },
            take: 30,
          },
        },
      });

      // Calculate ROI for each campaign
      const campaignROI = campaigns.map(c => {
        const totalConversions = c.metrics.reduce((sum, m) => sum + m.conversions, 0);
        const totalCost = c.metrics.reduce((sum, m) => sum + m.cost, 0);
        const totalValue = c.metrics.reduce((sum, m) => sum + m.conversionValue, 0);

        return {
          campaignId: c.id,
          roi: totalCost > 0 ? totalValue / totalCost : 0,
          currentBudget: c.budget || 0,
          conversions: totalConversions,
        };
      });

      // Sort by ROI
      campaignROI.sort((a, b) => b.roi - a.roi);

      // Allocate budget proportionally to ROI
      const totalROI = campaignROI.reduce((sum, c) => sum + c.roi, 0);

      const forecasts: BudgetForecast[] = [];

      for (const campROI of campaignROI) {
        const budgetShare = totalROI > 0 ? (campROI.roi / totalROI) * totalBudget : totalBudget / campaigns.length;

        const forecast = await this.forecastCampaign(campROI.campaignId, budgetShare, forecastDays);

        if (forecast) {
          forecasts.push(forecast);
        }
      }

      return forecasts;
    } catch (error) {
      console.error('[BudgetForecaster] Error forecasting account:', error);
      return [];
    }
  }

  /**
   * Simulate budget scenarios
   */
  static async simulateScenarios(
    campaignId: string,
    scenarios: number[],
    forecastDays: number = 30
  ): Promise<BudgetForecast[]> {
    const forecasts: BudgetForecast[] = [];

    for (const budget of scenarios) {
      const forecast = await this.forecastCampaign(campaignId, budget, forecastDays);
      if (forecast) {
        forecasts.push(forecast);
      }
    }

    return forecasts;
  }
}
