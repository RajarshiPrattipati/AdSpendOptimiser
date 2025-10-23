import { GoogleAdsApi, Customer } from 'google-ads-api';

export interface GoogleAdsAccount {
  customerId: string;
  accountName: string;
  currency: string;
  timezone: string;
  isManagerAccount: boolean;
  canManageClients?: boolean;
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

export interface KeywordData {
  keywordId: string;
  keywordText: string;
  matchType: string;
  status: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  qualityScore?: number;
}

export interface SearchTermData {
  searchTerm: string;
  matchedKeyword?: string;
  matchType?: string;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cpa: number;
  conversionRate: number;
  date: string;
}

/**
 * Google Ads API Service
 * Handles all interactions with the Google Ads API using google-ads-api package
 */
export class GoogleAdsService {
  private accessToken: string;
  private refreshToken: string;
  private client: GoogleAdsApi;

  constructor(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    // Initialize Google Ads API client
    this.client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    });
  }

  /**
   * Format customer ID by removing dashes and ensuring it's in the correct format
   * Google Ads API requires customer IDs without dashes (e.g., "1234567890" not "123-456-7890")
   */
  private formatCustomerId(customerId: string): string {
    return customerId.replace(/[^0-9]/g, '');
  }

  /**
   * Get customer instance with current refresh token
   * @param customerId - The customer ID to query
   * @param loginCustomerId - Optional manager account ID for accessing client accounts
   */
  private getCustomer(customerId: string, loginCustomerId?: string): Customer {
    const formattedCustomerId = this.formatCustomerId(customerId);
    const formattedLoginCustomerId = loginCustomerId ? this.formatCustomerId(loginCustomerId) : undefined;

    console.log(`[GoogleAdsService] Creating customer instance: customerId=${formattedCustomerId}, loginCustomerId=${formattedLoginCustomerId}`);

    return this.client.Customer({
      customer_id: formattedCustomerId,
      refresh_token: this.refreshToken,
      login_customer_id: formattedLoginCustomerId,
    });
  }

  /**
   * Fetch all accessible Google Ads accounts for the authenticated user
   */
  async getAccessibleAccounts(): Promise<GoogleAdsAccount[]> {
    try {
      // Use the google-ads-api library's built-in method to list accessible customers
      console.log('[GoogleAdsService] Fetching accessible customers using library method...');

      const response = await this.client.listAccessibleCustomers(this.refreshToken);

      console.log('[GoogleAdsService] Raw response:', JSON.stringify(response, null, 2));
      console.log('[GoogleAdsService] Response type:', typeof response);
      console.log('[GoogleAdsService] Response keys:', response ? Object.keys(response) : 'null');

      // Extract customer IDs from the response
      // The response typically has a structure like { resource_names: [...] }
      let customerIds: string[] = [];

      if (response && typeof response === 'object') {
        // Try different possible property names
        if ('resource_names' in response && Array.isArray(response.resource_names)) {
          customerIds = response.resource_names.map((resourceName: string) => {
            // Resource names are in format "customers/123456789"
            return resourceName.split('/')[1];
          });
        } else if ('resourceNames' in response && Array.isArray(response.resourceNames)) {
          customerIds = response.resourceNames.map((resourceName: string) => {
            return resourceName.split('/')[1];
          });
        } else if (Array.isArray(response)) {
          // If it's already an array of IDs
          customerIds = response;
        }
      }

      console.log('[GoogleAdsService] Extracted customer IDs:', customerIds);

      if (!customerIds || customerIds.length === 0) {
        console.log('[GoogleAdsService] No accessible customers found');
        return [];
      }

      console.log('[GoogleAdsService] Found', customerIds.length, 'accessible customers');

      // Fetch detailed information for each customer
      const accounts: GoogleAdsAccount[] = [];

      for (const customerId of customerIds) {
        console.log('[GoogleAdsService] Fetching details for customer:', customerId);

        try {
          const customerData = await this.getCustomerDetails(customerId);
          if (customerData) {
            accounts.push(customerData);
            console.log('[GoogleAdsService] Successfully fetched details for:', customerId);
          }
        } catch (error) {
          console.error(`[GoogleAdsService] Error fetching customer ${customerId}:`, error);
          // Continue with other accounts
        }
      }

      console.log('[GoogleAdsService] Total accounts fetched:', accounts.length);
      return accounts;
    } catch (error) {
      console.error('[GoogleAdsService] Error fetching accessible accounts:', error);
      throw error;
    }
  }

  /**
   * Get account details (public method)
   */
  async getAccountDetails(customerId: string): Promise<GoogleAdsAccount | null> {
    return this.getCustomerDetails(customerId);
  }

  /**
   * Get client accounts under a manager account
   */
  async getClientAccounts(managerCustomerId: string): Promise<GoogleAdsAccount[]> {
    try {
      console.log('[GoogleAdsService] Fetching client accounts for manager:', managerCustomerId);

      const customer = this.getCustomer(managerCustomerId);

      // First try with minimal filters to see what's available
      const query = `
        SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.time_zone,
          customer_client.manager,
          customer_client.status,
          customer_client.level,
          customer_client.test_account
        FROM customer_client
      `;

      console.log('[GoogleAdsService] Running query to fetch all customer_client entries...');
      const results = await customer.query(query);
      console.log('[GoogleAdsService] Raw results:', JSON.stringify(results, null, 2));
      console.log('[GoogleAdsService] Found', results.length, 'total client entries');

      const clientAccounts: GoogleAdsAccount[] = [];

      for (const row of results) {
        const clientData = row.customer_client;

        if (!clientData) {
          console.log('[GoogleAdsService] Skipping row with no customer_client data');
          continue;
        }

        console.log('[GoogleAdsService] Processing client:', {
          id: clientData.id,
          name: clientData.descriptive_name,
          status: clientData.status,
          level: clientData.level,
          manager: clientData.manager,
          test_account: clientData.test_account,
        });

        // Skip the manager account itself (level 0) and only include actual client accounts
        if (clientData.level === 0 || clientData.manager === true) {
          console.log('[GoogleAdsService] Skipping manager account or level 0:', clientData.id);
          continue;
        }

        // Only include enabled accounts (status 2 = ENABLED, status 5 might be ENABLED in newer versions)
        // Let's include all statuses for now to see what we get
        const clientAccount: GoogleAdsAccount = {
          customerId: clientData.id?.toString() || '',
          accountName: clientData.descriptive_name || 'Unnamed Account',
          currency: clientData.currency_code || 'USD',
          timezone: clientData.time_zone || 'UTC',
          isManagerAccount: Boolean(clientData.manager),
          canManageClients: false,
        };

        clientAccounts.push(clientAccount);
        console.log('[GoogleAdsService] Added client account:', clientAccount.customerId, clientAccount.accountName);
      }

      console.log('[GoogleAdsService] Processed', clientAccounts.length, 'client accounts');
      return clientAccounts;
    } catch (error) {
      console.error('[GoogleAdsService] Error fetching client accounts:', error);
      return [];
    }
  }

  /**
   * Get detailed information for a specific customer
   */
  private async getCustomerDetails(customerId: string): Promise<GoogleAdsAccount | null> {
    try {
      const customer = this.getCustomer(customerId);

      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager,
          customer.test_account
        FROM customer
        WHERE customer.id = ${customerId}
        LIMIT 1
      `;

      const results = await customer.query(query);

      if (!results || results.length === 0) {
        return null;
      }

      const customerData = results[0]?.customer;

      if (!customerData) {
        return null;
      }

      const isManager = Boolean(customerData.manager);

      return {
        customerId: customerData.id?.toString() || customerId,
        accountName: customerData.descriptive_name || 'Unnamed Account',
        currency: customerData.currency_code || 'USD',
        timezone: customerData.time_zone || 'UTC',
        isManagerAccount: isManager,
        canManageClients: isManager,
      };
    } catch (error) {
      console.error(`Error fetching customer details for ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Fetch all campaigns for a specific customer
   * @param customerId - The customer ID to query
   * @param loginCustomerId - Optional manager account ID for accessing client accounts
   */
  async getCampaigns(customerId: string, loginCustomerId?: string): Promise<CampaignData[]> {
    try {
      console.log(`[GoogleAdsService] Fetching campaigns for customer: ${customerId}, loginCustomerId: ${loginCustomerId}`);
      const customer = this.getCustomer(customerId, loginCustomerId);

      // Simplified query without budget to avoid JOIN issues
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.bidding_strategy_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
      `;

      console.log(`[GoogleAdsService] Running query:`, query);
      const results = await customer.query(query);
      console.log(`[GoogleAdsService] Found ${results.length} campaigns`);

      if (results.length > 0) {
        console.log(`[GoogleAdsService] Sample campaign:`, JSON.stringify(results[0], null, 2));
      }

      return results.map((row: any) => ({
        campaignId: row.campaign.id?.toString() || '',
        campaignName: row.campaign.name || '',
        status: row.campaign.status || 'UNKNOWN',
        biddingStrategy: row.campaign.bidding_strategy_type || 'UNKNOWN',
        budget: 0, // We'll fetch budgets separately if needed
      }));
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error fetching campaigns for customer ${customerId}:`, error);
      console.error(`[GoogleAdsService] Error details:`, error.message, error.stack);
      throw new Error(`Failed to fetch campaigns: ${error.message}`);
    }
  }

  /**
   * Fetch campaign metrics for a date range
   * @param customerId - The customer ID to query
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @param loginCustomerId - Optional manager account ID for accessing client accounts
   */
  async getCampaignMetrics(
    customerId: string,
    startDate: string,
    endDate: string,
    loginCustomerId?: string
  ): Promise<CampaignMetricsData[]> {
    try {
      console.log(`[GoogleAdsService] Fetching campaign metrics for customer: ${customerId}, dates: ${startDate} to ${endDate}`);
      const customer = this.getCustomer(customerId, loginCustomerId);

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

      console.log(`[GoogleAdsService] Running metrics query`);
      const results = await customer.query(query);
      console.log(`[GoogleAdsService] Found ${results.length} metric rows`);

      if (results.length > 0) {
        console.log(`[GoogleAdsService] Sample metrics:`, JSON.stringify(results[0], null, 2));
      }

      return results.map((row: any) => ({
        campaignId: row.campaign.id?.toString() || '',
        date: row.segments.date || '',
        impressions: row.metrics.impressions || 0,
        clicks: row.metrics.clicks || 0,
        cost: row.metrics.cost_micros ? row.metrics.cost_micros / 1000000 : 0,
        conversions: row.metrics.conversions || 0,
        conversionValue: row.metrics.conversions_value || 0,
      }));
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error fetching campaign metrics for customer ${customerId}:`, error);
      console.error(`[GoogleAdsService] Error details:`, error.message, error.stack);
      throw new Error(`Failed to fetch campaign metrics: ${error.message}`);
    }
  }

  /**
   * Fetch keywords for a specific campaign
   */
  async getKeywords(customerId: string, campaignId: string): Promise<KeywordData[]> {
    try {
      const customer = this.getCustomer(customerId);

      const query = `
        SELECT
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          ad_group_criterion.quality_info.quality_score,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM keyword_view
        WHERE campaign.id = ${campaignId}
          AND ad_group_criterion.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
      `;

      const results = await customer.query(query);

      return results.map((row: any) => {
        const impressions = row.metrics?.impressions || 0;
        const clicks = row.metrics?.clicks || 0;
        const cost = row.metrics?.cost_micros ? row.metrics.cost_micros / 1000000 : 0;
        const conversions = row.metrics?.conversions || 0;

        return {
          keywordId: row.ad_group_criterion?.criterion_id?.toString() || '',
          keywordText: row.ad_group_criterion?.keyword?.text || '',
          matchType: row.ad_group_criterion?.keyword?.match_type || 'UNKNOWN',
          status: row.ad_group_criterion?.status || 'UNKNOWN',
          impressions,
          clicks,
          cost,
          conversions,
          ctr: row.metrics?.ctr || 0,
          cpc: row.metrics?.average_cpc ? row.metrics.average_cpc / 1000000 : 0,
          cpa: conversions > 0 ? cost / conversions : 0,
          qualityScore: row.ad_group_criterion?.quality_info?.quality_score,
        };
      });
    } catch (error) {
      console.error(`Error fetching keywords for campaign ${campaignId}:`, error);
      throw new Error('Failed to fetch keywords');
    }
  }

  /**
   * Fetch search term report for analysis
   */
  async getSearchTerms(
    customerId: string,
    startDate: string,
    endDate: string,
    campaignId?: string
  ): Promise<SearchTermData[]> {
    try {
      const customer = this.getCustomer(customerId);

      const campaignFilter = campaignId ? `AND campaign.id = ${campaignId}` : '';

      const query = `
        SELECT
          search_term_view.search_term,
          search_term_view.status,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc
        FROM search_term_view
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
          ${campaignFilter}
        ORDER BY metrics.cost_micros DESC
      `;

      const results = await customer.query(query);

      return results.map((row: any) => {
        const impressions = row.metrics?.impressions || 0;
        const clicks = row.metrics?.clicks || 0;
        const cost = row.metrics?.cost_micros ? row.metrics.cost_micros / 1000000 : 0;
        const conversions = row.metrics?.conversions || 0;

        return {
          searchTerm: row.search_term_view?.search_term || '',
          matchedKeyword: row.ad_group_criterion?.keyword?.text,
          matchType: row.ad_group_criterion?.keyword?.match_type,
          impressions,
          clicks,
          cost,
          conversions,
          ctr: row.metrics?.ctr || 0,
          cpc: row.metrics?.average_cpc ? row.metrics.average_cpc / 1000000 : 0,
          cpa: conversions > 0 ? cost / conversions : 0,
          conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
          date: row.segments?.date || '',
        };
      });
    } catch (error) {
      console.error(`Error fetching search terms for customer ${customerId}:`, error);
      throw new Error('Failed to fetch search terms');
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

  // ========== WRITE OPERATIONS FOR RECOMMENDATION IMPLEMENTATION ==========

  /**
   * Update campaign budget
   * @param customerId - The customer ID
   * @param campaignId - The campaign ID to update
   * @param newBudgetMicros - New budget amount in micros (e.g., $100 = 100000000)
   * @returns Updated campaign budget resource name
   */
  async updateCampaignBudget(
    customerId: string,
    campaignId: string,
    newBudgetMicros: number
  ): Promise<string> {
    try {
      console.log(`[GoogleAdsService] Updating budget for campaign ${campaignId} to ${newBudgetMicros} micros`);

      const customer = this.getCustomer(customerId);

      // First, get the campaign budget ID
      const campaignQuery = `
        SELECT campaign.id, campaign.campaign_budget
        FROM campaign
        WHERE campaign.id = ${campaignId}
        LIMIT 1
      `;

      const campaignResults = await customer.query(campaignQuery);
      if (!campaignResults || campaignResults.length === 0) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      if (!campaignResults[0]?.campaign?.campaign_budget) {
        throw new Error('Campaign budget not found');
      }

      const budgetResourceName = campaignResults[0].campaign.campaign_budget;

      // Update the campaign budget
      const operation = {
        resource_name: budgetResourceName,
        amount_micros: newBudgetMicros,
      };

      await customer.campaignBudgets.update([operation]);

      console.log(`[GoogleAdsService] Successfully updated budget for campaign ${campaignId}`);
      return budgetResourceName;
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error updating campaign budget:`, error);
      throw new Error(`Failed to update campaign budget: ${error.message}`);
    }
  }

  /**
   * Update campaign status (ENABLED, PAUSED)
   * @param customerId - The customer ID
   * @param campaignId - The campaign ID to update
   * @param status - New status ('ENABLED' or 'PAUSED')
   */
  async updateCampaignStatus(
    customerId: string,
    campaignId: string,
    status: 'ENABLED' | 'PAUSED'
  ): Promise<void> {
    try {
      console.log(`[GoogleAdsService] Updating campaign ${campaignId} status to ${status}`);

      const customer = this.getCustomer(customerId);
      const formattedCustomerId = this.formatCustomerId(customerId);

      const operation = {
        resource_name: `customers/${formattedCustomerId}/campaigns/${campaignId}`,
        status,
      };

      await customer.campaigns.update([operation]);

      console.log(`[GoogleAdsService] Successfully updated campaign ${campaignId} status to ${status}`);
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error updating campaign status:`, error);
      throw new Error(`Failed to update campaign status: ${error.message}`);
    }
  }

  /**
   * Update keyword status (ENABLED, PAUSED)
   * @param customerId - The customer ID
   * @param adGroupId - The ad group ID
   * @param criterionId - The keyword criterion ID
   * @param status - New status ('ENABLED' or 'PAUSED')
   */
  async updateKeywordStatus(
    customerId: string,
    adGroupId: string,
    criterionId: string,
    status: 'ENABLED' | 'PAUSED'
  ): Promise<void> {
    try {
      console.log(`[GoogleAdsService] Updating keyword ${criterionId} status to ${status}`);

      const customer = this.getCustomer(customerId);
      const formattedCustomerId = this.formatCustomerId(customerId);

      const operation = {
        resource_name: `customers/${formattedCustomerId}/adGroupCriteria/${adGroupId}~${criterionId}`,
        status,
      };

      await customer.adGroupCriteria.update([operation]);

      console.log(`[GoogleAdsService] Successfully updated keyword ${criterionId} status to ${status}`);
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error updating keyword status:`, error);
      throw new Error(`Failed to update keyword status: ${error.message}`);
    }
  }

  /**
   * Update keyword bid
   * @param customerId - The customer ID
   * @param adGroupId - The ad group ID
   * @param criterionId - The keyword criterion ID
   * @param bidMicros - New bid amount in micros
   */
  async updateKeywordBid(
    customerId: string,
    adGroupId: string,
    criterionId: string,
    bidMicros: number
  ): Promise<void> {
    try {
      console.log(`[GoogleAdsService] Updating keyword ${criterionId} bid to ${bidMicros} micros`);

      const customer = this.getCustomer(customerId);
      const formattedCustomerId = this.formatCustomerId(customerId);

      const operation = {
        resource_name: `customers/${formattedCustomerId}/adGroupCriteria/${adGroupId}~${criterionId}`,
        cpc_bid_micros: bidMicros,
      };

      await customer.adGroupCriteria.update([operation]);

      console.log(`[GoogleAdsService] Successfully updated keyword ${criterionId} bid`);
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error updating keyword bid:`, error);
      throw new Error(`Failed to update keyword bid: ${error.message}`);
    }
  }

  /**
   * Add negative keywords to a campaign
   * @param customerId - The customer ID
   * @param campaignId - The campaign ID
   * @param keywords - Array of negative keyword texts
   * @param matchType - Match type for negative keywords (default: EXACT)
   */
  async addNegativeKeywords(
    customerId: string,
    campaignId: string,
    keywords: string[],
    matchType: 'EXACT' | 'PHRASE' | 'BROAD' = 'EXACT'
  ): Promise<string[]> {
    try {
      console.log(`[GoogleAdsService] Adding ${keywords.length} negative keywords to campaign ${campaignId}`);

      const customer = this.getCustomer(customerId);
      const formattedCustomerId = this.formatCustomerId(customerId);

      const operations = keywords.map((keyword) => ({
        campaign: `customers/${formattedCustomerId}/campaigns/${campaignId}`,
        keyword: {
          text: keyword,
          match_type: matchType,
        },
        negative: true,
      }));

      const response = await customer.campaignCriteria.create(operations);

      console.log(`[GoogleAdsService] Successfully added ${keywords.length} negative keywords`);
      return response.results?.map((r: any) => r.resource_name) || [];
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error adding negative keywords:`, error);
      throw new Error(`Failed to add negative keywords: ${error.message}`);
    }
  }

  /**
   * Update campaign bidding strategy
   * @param customerId - The customer ID
   * @param campaignId - The campaign ID
   * @param biddingStrategyType - New bidding strategy type
   * @param targetCpaMicros - Target CPA in micros (for TARGET_CPA strategy)
   * @param targetRoas - Target ROAS (for TARGET_ROAS strategy)
   */
  async updateBiddingStrategy(
    customerId: string,
    campaignId: string,
    biddingStrategyType: string,
    targetCpaMicros?: number,
    targetRoas?: number
  ): Promise<void> {
    try {
      console.log(`[GoogleAdsService] Updating campaign ${campaignId} bidding strategy to ${biddingStrategyType}`);

      const customer = this.getCustomer(customerId);
      const formattedCustomerId = this.formatCustomerId(customerId);

      const updateFields: any = {
        resource_name: `customers/${formattedCustomerId}/campaigns/${campaignId}`,
        bidding_strategy_type: biddingStrategyType,
      };

      const paths = ['bidding_strategy_type'];

      // Add strategy-specific settings
      if (biddingStrategyType === 'TARGET_CPA' && targetCpaMicros) {
        updateFields.target_cpa = { target_cpa_micros: targetCpaMicros };
        paths.push('target_cpa.target_cpa_micros');
      } else if (biddingStrategyType === 'TARGET_ROAS' && targetRoas) {
        updateFields.target_roas = { target_roas: targetRoas };
        paths.push('target_roas.target_roas');
      } else if (biddingStrategyType === 'MAXIMIZE_CONVERSIONS') {
        updateFields.maximize_conversions = {};
        paths.push('maximize_conversions');
      } else if (biddingStrategyType === 'MAXIMIZE_CONVERSION_VALUE') {
        updateFields.maximize_conversion_value = {};
        paths.push('maximize_conversion_value');
      }

      await customer.campaigns.update([updateFields]);

      console.log(`[GoogleAdsService] Successfully updated campaign ${campaignId} bidding strategy`);
    } catch (error: any) {
      console.error(`[GoogleAdsService] Error updating bidding strategy:`, error);
      throw new Error(`Failed to update bidding strategy: ${error.message}`);
    }
  }
}
