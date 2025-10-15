import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { GoogleAdsService } from '@/lib/google-ads';
import { prisma } from '@/lib/prisma';
import { format, subDays } from 'date-fns';

export const dynamic = 'force-dynamic';

/**
 * GET /api/campaigns
 * Fetch campaign data for a specific ad account
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate') || format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const endDate = searchParams.get('endDate') || format(new Date(), 'yyyy-MM-dd');

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this account
    const adAccount = await prisma.adAccount.findFirst({
      where: {
        id: accountId,
        userId: session.userId,
      },
    });

    if (!adAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);

    // If this is a manager account, aggregate data from all client accounts
    if (adAccount.isManagerAccount) {
      console.log(`[API /campaigns] Manager account detected, fetching all client accounts...`);

      // Get all client accounts under this manager
      const clientAccounts = await prisma.adAccount.findMany({
        where: {
          userId: session.userId,
          managerAccountId: adAccount.id,
          isManagerAccount: false,
        },
      });

      console.log(`[API /campaigns] Found ${clientAccounts.length} client accounts`);

      if (clientAccounts.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'No client accounts found under this manager account.',
            isManagerAccount: true
          },
          { status: 400 }
        );
      }

      // Fetch campaigns and metrics from all client accounts
      const allCampaigns: any[] = [];
      const allMetrics: any[] = [];

      for (const clientAccount of clientAccounts) {
        try {
          console.log(`[API /campaigns] Fetching data for client ${clientAccount.customerId}...`);

          const [campaigns, metricsData] = await Promise.all([
            googleAdsService.getCampaigns(clientAccount.customerId, adAccount.customerId),
            googleAdsService.getCampaignMetrics(clientAccount.customerId, startDate, endDate, adAccount.customerId),
          ]);

          allCampaigns.push(...campaigns);
          allMetrics.push(...metricsData);

          console.log(`[API /campaigns] Client ${clientAccount.customerId}: ${campaigns.length} campaigns, ${metricsData.length} metrics`);
        } catch (error) {
          console.error(`[API /campaigns] Error fetching data for client ${clientAccount.customerId}:`, error);
          // Continue with other accounts
        }
      }

      // Use aggregated data
      const campaigns = allCampaigns;
      const metricsData = allMetrics;

      console.log(`[API /campaigns] Total aggregated: ${campaigns.length} campaigns, ${metricsData.length} metrics`);

      // Store/update campaigns in database (using the first client account for now)
      // In a real scenario, you might want to track which client account each campaign belongs to
      await Promise.all(
        campaigns.map((campaign) =>
          prisma.campaign.upsert({
            where: {
              adAccountId_campaignId: {
                adAccountId: accountId,
                campaignId: campaign.campaignId,
              },
            },
            update: {
              campaignName: campaign.campaignName,
              status: campaign.status,
              biddingStrategy: campaign.biddingStrategy,
              budget: campaign.budget,
            },
            create: {
              adAccountId: accountId,
              campaignId: campaign.campaignId,
              campaignName: campaign.campaignName,
              status: campaign.status,
              biddingStrategy: campaign.biddingStrategy,
              budget: campaign.budget,
            },
          })
        )
      );

      // Group metrics by campaign
      const campaignMetricsMap = new Map<string, any[]>();
      metricsData.forEach((metric) => {
        if (!campaignMetricsMap.has(metric.campaignId)) {
          campaignMetricsMap.set(metric.campaignId, []);
        }
        campaignMetricsMap.get(metric.campaignId)!.push(metric);
      });

      // Combine campaigns with their metrics
      const campaignsWithMetrics = campaigns.map((campaign) => {
        const metrics = campaignMetricsMap.get(campaign.campaignId) || [];

        const totals = metrics.reduce(
          (acc, m) => ({
            cost: acc.cost + m.cost,
            conversions: acc.conversions + m.conversions,
            conversionValue: acc.conversionValue + m.conversionValue,
            clicks: acc.clicks + m.clicks,
            impressions: acc.impressions + m.impressions,
          }),
          { cost: 0, conversions: 0, conversionValue: 0, clicks: 0, impressions: 0 }
        );

        return {
          ...campaign,
          totalSpend: totals.cost,
          totalConversions: totals.conversions,
          totalClicks: totals.clicks,
          totalImpressions: totals.impressions,
          averageCpa: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
          averageRoas: totals.cost > 0 ? totals.conversionValue / totals.cost : 0,
          averageCtr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          metrics: metrics.map((m) => ({
            date: m.date,
            impressions: m.impressions,
            clicks: m.clicks,
            cost: m.cost,
            conversions: m.conversions,
            conversionValue: m.conversionValue,
            ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
            averageCpc: m.clicks > 0 ? m.cost / m.clicks : 0,
            costPerConversion: m.conversions > 0 ? m.cost / m.conversions : 0,
            roas: m.cost > 0 ? m.conversionValue / m.cost : 0,
          })),
        };
      });

      // Calculate overall summary
      const summary = GoogleAdsService.calculateMetrics(metricsData);

      // Update last synced timestamp
      await prisma.adAccount.update({
        where: { id: accountId },
        data: { lastSyncedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        data: {
          campaigns: campaignsWithMetrics,
          summary,
          dateRange: {
            startDate,
            endDate,
          },
        },
      });
    }

    // For client accounts - check if it has a manager
    let loginCustomerId: string | undefined;

    if (adAccount.managerAccountId) {
      // Find the manager account to get its customer ID
      const managerAccount = await prisma.adAccount.findUnique({
        where: { id: adAccount.managerAccountId },
        select: { customerId: true },
      });

      if (managerAccount) {
        loginCustomerId = managerAccount.customerId;
        console.log(`[API /campaigns] Using manager account ${loginCustomerId} to access client account ${adAccount.customerId}`);
      }
    }

    const [campaigns, metricsData] = await Promise.all([
      googleAdsService.getCampaigns(adAccount.customerId, loginCustomerId),
      googleAdsService.getCampaignMetrics(adAccount.customerId, startDate, endDate, loginCustomerId),
    ]);

    // Store/update campaigns in database
    await Promise.all(
      campaigns.map((campaign) =>
        prisma.campaign.upsert({
          where: {
            adAccountId_campaignId: {
              adAccountId: accountId,
              campaignId: campaign.campaignId,
            },
          },
          update: {
            campaignName: campaign.campaignName,
            status: campaign.status,
            biddingStrategy: campaign.biddingStrategy,
            budget: campaign.budget,
          },
          create: {
            adAccountId: accountId,
            campaignId: campaign.campaignId,
            campaignName: campaign.campaignName,
            status: campaign.status,
            biddingStrategy: campaign.biddingStrategy,
            budget: campaign.budget,
          },
        })
      )
    );

    // Group metrics by campaign
    const campaignMetricsMap = new Map<string, any[]>();
    metricsData.forEach((metric) => {
      if (!campaignMetricsMap.has(metric.campaignId)) {
        campaignMetricsMap.set(metric.campaignId, []);
      }
      campaignMetricsMap.get(metric.campaignId)!.push(metric);
    });

    // Combine campaigns with their metrics
    const campaignsWithMetrics = campaigns.map((campaign) => {
      const metrics = campaignMetricsMap.get(campaign.campaignId) || [];

      const totals = metrics.reduce(
        (acc, m) => ({
          cost: acc.cost + m.cost,
          conversions: acc.conversions + m.conversions,
          conversionValue: acc.conversionValue + m.conversionValue,
          clicks: acc.clicks + m.clicks,
          impressions: acc.impressions + m.impressions,
        }),
        { cost: 0, conversions: 0, conversionValue: 0, clicks: 0, impressions: 0 }
      );

      return {
        ...campaign,
        totalSpend: totals.cost,
        totalConversions: totals.conversions,
        totalClicks: totals.clicks,
        totalImpressions: totals.impressions,
        averageCpa: totals.conversions > 0 ? totals.cost / totals.conversions : 0,
        averageRoas: totals.cost > 0 ? totals.conversionValue / totals.cost : 0,
        averageCtr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        metrics: metrics.map((m) => ({
          date: m.date,
          impressions: m.impressions,
          clicks: m.clicks,
          cost: m.cost,
          conversions: m.conversions,
          conversionValue: m.conversionValue,
          ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
          averageCpc: m.clicks > 0 ? m.cost / m.clicks : 0,
          costPerConversion: m.conversions > 0 ? m.cost / m.conversions : 0,
          roas: m.cost > 0 ? m.conversionValue / m.cost : 0,
        })),
      };
    });

    // Calculate overall summary
    const summary = GoogleAdsService.calculateMetrics(metricsData);

    // Update last synced timestamp
    await prisma.adAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      data: {
        campaigns: campaignsWithMetrics,
        summary,
        dateRange: {
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch campaigns',
      },
      { status: 500 }
    );
  }
}
