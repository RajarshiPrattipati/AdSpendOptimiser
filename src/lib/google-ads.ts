import { google } from 'googleapis';

const googleAds = google.ads('v14');

export interface GoogleAdsAccount {
  customerId: string;
  accountName: string;
  currency: string;
  timezone: string;
}

export interface CampaignData {
  campaignId: string;
  campaignName: string;
  status: string;
  biddingStrategy: string;
  budget: number;
}

export interface CampaignMetricsData {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  conversionValue: number;
}

/**
 * Google Ads API Service
 * Handles all interactions with the Google Ads API
 */
export class GoogleAdsService {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get OAuth2 client with access token
   */
  private getOAuth2Client() {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: this.accessToken,
    });

    return oauth2Client;
  }

  /**
   * Fetch all accessible Google Ads accounts for the authenticated user
   */
  async getAccessibleAccounts(): Promise<GoogleAdsAccount[]> {
    try {
      const auth = this.getOAuth2Client();

      // Use Google Ads API to list accessible customers
      const response = await googleAds.customers.listAccessibleCustomers({
        auth,
      });

      if (!response.data.resourceNames) {
        return [];
      }

      // Fetch detailed information for each customer
      const accounts: GoogleAdsAccount[] = [];

      for (const resourceName of response.data.resourceNames) {
        const customerId = resourceName.split('/')[1];

        try {
          const customerData = await this.getCustomerDetails(customerId);
          if (customerData) {
            accounts.push(customerData);
          }
        } catch (error) {
          console.error(`Error fetching customer ${customerId}:`, error);
          // Continue with other accounts
        }
      }

      return accounts;
    } catch (error) {
      console.error('Error fetching accessible accounts:', error);
      throw new Error('Failed to fetch Google Ads accounts');
    }
  }

  /**
   * Get detailed information for a specific customer
   */
  private async getCustomerDetails(customerId: string): Promise<GoogleAdsAccount | null> {
    try {
      const auth = this.getOAuth2Client();

      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone
        FROM customer
        WHERE customer.id = ${customerId}
      `;

      const response = await googleAds.customers.googleAds.search({
        auth,
        customerId: customerId.replace(/-/g, ''),
        requestBody: {
          query,
        },
      });

      if (!response.data.results || response.data.results.length === 0) {
        return null;
      }

      const customer = response.data.results[0].customer;

      return {
        customerId: customer.id,
        accountName: customer.descriptiveName || 'Unnamed Account',
        currency: customer.currencyCode || 'USD',
        timezone: customer.timeZone || 'UTC',
      };
    } catch (error) {
      console.error(`Error fetching customer details for ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Fetch all campaigns for a specific customer
   */
  async getCampaigns(customerId: string): Promise<CampaignData[]> {
    try {
      const auth = this.getOAuth2Client();

      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.bidding_strategy_type,
          campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `;

      const response = await googleAds.customers.googleAds.search({
        auth,
        customerId: customerId.replace(/-/g, ''),
        requestBody: {
          query,
        },
      });

      if (!response.data.results) {
        return [];
      }

      return response.data.results.map((result: any) => ({
        campaignId: result.campaign.id,
        campaignName: result.campaign.name,
        status: result.campaign.status,
        biddingStrategy: result.campaign.biddingStrategyType || 'UNKNOWN',
        budget: result.campaignBudget?.amountMicros
          ? result.campaignBudget.amountMicros / 1000000
          : 0,
      }));
    } catch (error) {
      console.error(`Error fetching campaigns for customer ${customerId}:`, error);
      throw new Error('Failed to fetch campaigns');
    }
  }

  /**
   * Fetch campaign metrics for a date range
   */
  async getCampaignMetrics(
    customerId: string,
    startDate: string, // Format: YYYY-MM-DD
    endDate: string    // Format: YYYY-MM-DD
  ): Promise<CampaignMetricsData[]> {
    try {
      const auth = this.getOAuth2Client();

      const query = `
        SELECT
          campaign.id,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          AND campaign.status != 'REMOVED'
        ORDER BY segments.date DESC
      `;

      const response = await googleAds.customers.googleAds.search({
        auth,
        customerId: customerId.replace(/-/g, ''),
        requestBody: {
          query,
        },
      });

      if (!response.data.results) {
        return [];
      }

      return response.data.results.map((result: any) => ({
        campaignId: result.campaign.id,
        date: result.segments.date,
        impressions: result.metrics.impressions || 0,
        clicks: result.metrics.clicks || 0,
        cost: result.metrics.costMicros ? result.metrics.costMicros / 1000000 : 0,
        conversions: result.metrics.conversions || 0,
        conversionValue: result.metrics.conversionsValue || 0,
      }));
    } catch (error) {
      console.error(`Error fetching campaign metrics for customer ${customerId}:`, error);
      throw new Error('Failed to fetch campaign metrics');
    }
  }

  /**
   * Calculate aggregated metrics from raw data
   */
  static calculateMetrics(metricsData: CampaignMetricsData[]) {
    const totals = metricsData.reduce(
      (acc, metric) => ({
        cost: acc.cost + metric.cost,
        conversions: acc.conversions + metric.conversions,
        conversionValue: acc.conversionValue + metric.conversionValue,
        clicks: acc.clicks + metric.clicks,
        impressions: acc.impressions + metric.impressions,
      }),
      { cost: 0, conversions: 0, conversionValue: 0, clicks: 0, impressions: 0 }
    );

    return {
      totalSpend: totals.cost,
      totalConversions: totals.conversions,
      totalClicks: totals.clicks,
      totalImpressions: totals.impressions,
      averageCpa: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
      averageRoas: totals.cost > 0 ? totals.conversionValue / totals.cost : 0,
      averageCtr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      averageCpc: totals.clicks > 0 ? totals.cost / totals.clicks : 0,
    };
  }
}
