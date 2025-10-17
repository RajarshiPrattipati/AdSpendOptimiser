import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, RecommendationType, RecommendationStatus, AuditEventType } from '@prisma/client';
import { getUserFromToken } from '@/lib/auth';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

/**
 * POST /api/seed
 * Seeds test data for the authenticated user
 * This creates a complete test environment with:
 * - Manager and Ad Accounts
 * - Campaigns with varied performance
 * - Keywords, Search Terms, Metrics
 * - Recommendations of all types
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🌱 Starting seed for user:', session.userId);

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Clean up existing test data for this user
    console.log('Cleaning up existing test data...');
    await prisma.recommendation.deleteMany({
      where: { adAccount: { userId: user.id } }
    });
    await prisma.searchTerm.deleteMany({
      where: { campaign: { adAccount: { userId: user.id } } }
    });
    await prisma.keyword.deleteMany({
      where: { campaign: { adAccount: { userId: user.id } } }
    });
    await prisma.campaignMetrics.deleteMany({
      where: { campaign: { adAccount: { userId: user.id } } }
    });
    await prisma.campaign.deleteMany({
      where: { adAccount: { userId: user.id } }
    });
    await prisma.adAccount.deleteMany({
      where: { userId: user.id }
    });

    // Create Test Manager Account
    const managerAccount = await prisma.adAccount.create({
      data: {
        userId: user.id,
        customerId: '1234567890',
        accountName: 'Test Manager Account',
        currency: 'USD',
        timezone: 'America/New_York',
        isManagerAccount: true,
      },
    });

    // Create Test Ad Account
    const adAccount = await prisma.adAccount.create({
      data: {
        userId: user.id,
        customerId: '9876543210',
        accountName: 'Test Client Account - E-Commerce Store',
        currency: 'USD',
        timezone: 'America/New_York',
        isManagerAccount: false,
        managerAccountId: managerAccount.customerId,
      },
    });

    // Create Test Campaigns
    const campaign1 = await prisma.campaign.create({
      data: {
        adAccountId: adAccount.id,
        campaignId: 'camp_001',
        campaignName: 'Brand Keywords - High Performer',
        status: 'ENABLED',
        biddingStrategy: 'TARGET_CPA',
        budget: 150.0,
        targetCpa: 25.0,
      },
    });

    const campaign2 = await prisma.campaign.create({
      data: {
        adAccountId: adAccount.id,
        campaignId: 'camp_002',
        campaignName: 'Generic Keywords - Underperforming',
        status: 'ENABLED',
        biddingStrategy: 'MANUAL_CPC',
        budget: 200.0,
        targetCpa: 50.0,
      },
    });

    const campaign3 = await prisma.campaign.create({
      data: {
        adAccountId: adAccount.id,
        campaignId: 'camp_003',
        campaignName: 'Product Keywords - Mixed Performance',
        status: 'ENABLED',
        biddingStrategy: 'MAXIMIZE_CONVERSIONS',
        budget: 100.0,
        targetCpa: 35.0,
      },
    });

    // Generate 30 days of metrics
    const today = new Date();
    let metricsCount = 0;

    for (let day = 0; day < 30; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() - day);

      // Campaign 1: High performing
      await prisma.campaignMetrics.create({
        data: {
          campaignId: campaign1.id,
          date,
          impressions: 5000 + Math.floor(Math.random() * 1000),
          clicks: 250 + Math.floor(Math.random() * 50),
          cost: 120 + Math.random() * 30,
          conversions: 6 + Math.random() * 2,
          conversionValue: 450 + Math.random() * 100,
        },
      });

      // Campaign 2: Poor performing
      await prisma.campaignMetrics.create({
        data: {
          campaignId: campaign2.id,
          date,
          impressions: 8000 + Math.floor(Math.random() * 2000),
          clicks: 200 + Math.floor(Math.random() * 50),
          cost: 180 + Math.random() * 20,
          conversions: 2 + Math.random() * 1.5,
          conversionValue: 120 + Math.random() * 50,
        },
      });

      // Campaign 3: Medium performance
      await prisma.campaignMetrics.create({
        data: {
          campaignId: campaign3.id,
          date,
          impressions: 4000 + Math.floor(Math.random() * 1000),
          clicks: 180 + Math.floor(Math.random() * 40),
          cost: 90 + Math.random() * 10,
          conversions: 3 + Math.random() * 1,
          conversionValue: 200 + Math.random() * 50,
        },
      });

      metricsCount += 3;
    }

    // Create Keywords
    const keywords = await Promise.all([
      // High performers
      prisma.keyword.create({
        data: {
          campaignId: campaign1.id,
          keywordId: 'kw_001',
          keywordText: 'buy running shoes',
          matchType: 'EXACT',
          status: 'ENABLED',
          impressions: 15000,
          clicks: 750,
          cost: 450.50,
          conversions: 25,
          ctr: 5.0,
          cpc: 0.60,
          cpa: 18.02,
          qualityScore: 9,
        },
      }),
      prisma.keyword.create({
        data: {
          campaignId: campaign1.id,
          keywordId: 'kw_002',
          keywordText: 'best running shoes',
          matchType: 'PHRASE',
          status: 'ENABLED',
          impressions: 12000,
          clicks: 600,
          cost: 360.00,
          conversions: 18,
          ctr: 5.0,
          cpc: 0.60,
          cpa: 20.00,
          qualityScore: 8,
        },
      }),
      // Poor performers
      prisma.keyword.create({
        data: {
          campaignId: campaign2.id,
          keywordId: 'kw_003',
          keywordText: 'cheap shoes',
          matchType: 'BROAD',
          status: 'ENABLED',
          impressions: 25000,
          clicks: 500,
          cost: 650.00,
          conversions: 3,
          ctr: 2.0,
          cpc: 1.30,
          cpa: 216.67,
          qualityScore: 3,
        },
      }),
      prisma.keyword.create({
        data: {
          campaignId: campaign2.id,
          keywordId: 'kw_004',
          keywordText: 'free shipping shoes',
          matchType: 'BROAD',
          status: 'ENABLED',
          impressions: 18000,
          clicks: 360,
          cost: 468.00,
          conversions: 0,
          ctr: 2.0,
          cpc: 1.30,
          cpa: 0,
          qualityScore: 2,
        },
      }),
      // Duplicates
      prisma.keyword.create({
        data: {
          campaignId: campaign3.id,
          keywordId: 'kw_005',
          keywordText: 'running shoes',
          matchType: 'EXACT',
          status: 'ENABLED',
          impressions: 10000,
          clicks: 400,
          cost: 280.00,
          conversions: 8,
          ctr: 4.0,
          cpc: 0.70,
          cpa: 35.00,
          qualityScore: 7,
        },
      }),
      prisma.keyword.create({
        data: {
          campaignId: campaign1.id,
          keywordId: 'kw_006',
          keywordText: 'running shoes',
          matchType: 'PHRASE',
          status: 'ENABLED',
          impressions: 8000,
          clicks: 320,
          cost: 192.00,
          conversions: 10,
          ctr: 4.0,
          cpc: 0.60,
          cpa: 19.20,
          qualityScore: 9,
        },
      }),
    ]);

    // Create Search Terms
    const searchTermDate = new Date();
    const searchTerms = await Promise.all([
      prisma.searchTerm.create({
        data: {
          campaignId: campaign1.id,
          searchTerm: 'nike running shoes',
          matchedKeyword: 'running shoes',
          matchType: 'PHRASE',
          impressions: 5000,
          clicks: 250,
          cost: 150.00,
          conversions: 12,
          date: searchTermDate,
          isNegative: false,
          priority: 'low',
        },
      }),
      prisma.searchTerm.create({
        data: {
          campaignId: campaign2.id,
          searchTerm: 'free shoes',
          matchedKeyword: 'cheap shoes',
          matchType: 'BROAD',
          impressions: 8000,
          clicks: 160,
          cost: 208.00,
          conversions: 0,
          date: searchTermDate,
          isNegative: false,
          priority: 'high',
        },
      }),
      prisma.searchTerm.create({
        data: {
          campaignId: campaign2.id,
          searchTerm: 'how to get free shoes',
          matchedKeyword: 'cheap shoes',
          matchType: 'BROAD',
          impressions: 6000,
          clicks: 120,
          cost: 156.00,
          conversions: 0,
          date: searchTermDate,
          isNegative: false,
          priority: 'high',
        },
      }),
    ]);

    // Create Recommendations
    const recommendations = await Promise.all([
      // Budget increase
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign1.id,
          type: RecommendationType.BUDGET_REALLOCATION,
          title: 'Increase budget for high-performing campaign',
          description: 'Campaign is highly efficient with improving CPA trend. Recommend increasing daily budget from $150 to $180 (20% increase).',
          reasoning: 'Campaign shows excellent health, high ROI (3.75), and decreasing CPA trend.',
          priority: 'high',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.85,
          expectedImpact: '14% increase in conversions',
          impactMetric: 'conversions',
          impactValue: 14,
          suggestedChanges: { budgetChange: { from: 150, to: 180, changeAmount: 30 } },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Budget decrease
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign2.id,
          type: RecommendationType.BUDGET_REALLOCATION,
          title: 'Reduce budget for underperforming campaign',
          description: 'Campaign shows low efficiency. Recommend reducing daily budget from $200 to $140 (30% decrease).',
          reasoning: 'Poor campaign health, low ROI (0.67), and increasing CPA trend.',
          priority: 'critical',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.80,
          expectedImpact: '24% cost reduction',
          impactMetric: 'cost',
          impactValue: -24,
          suggestedChanges: { budgetChange: { from: 200, to: 140, changeAmount: -60 } },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Negative keywords
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign2.id,
          type: RecommendationType.ADD_NEGATIVE_KEYWORD,
          title: 'Add 3 negative keywords',
          description: 'Identified 3 search terms with poor performance. Adding as negative keywords can save $468.00.',
          reasoning: 'Search terms with zero conversions consuming budget.',
          priority: 'critical',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.90,
          expectedImpact: '$468.00 monthly savings',
          impactMetric: 'cost',
          impactValue: -468,
          suggestedChanges: {
            negativeKeywords: ['free shoes', 'how to get free shoes', 'shoes for kids'],
            matchType: 'PHRASE',
          },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Pause keywords
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign2.id,
          type: RecommendationType.PAUSE_KEYWORD,
          title: 'Pause 2 underperforming keywords',
          description: '2 keywords are consistently underperforming. Pausing them can save $1,118.00.',
          reasoning: 'High cost with zero or poor conversions.',
          priority: 'high',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.85,
          expectedImpact: '$1,118.00 savings',
          impactMetric: 'cost',
          impactValue: -1118,
          suggestedChanges: {
            keywordsToPause: [
              { keywordId: 'kw_004', keywordText: 'free shipping shoes', reason: '$468.00 with 0 conversions', cost: 468 },
              { keywordId: 'kw_003', keywordText: 'cheap shoes', reason: 'CPA 333% above target', cost: 650 },
            ],
          },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Scale keywords
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign1.id,
          type: RecommendationType.KEYWORD_OPTIMIZATION,
          title: 'Scale 2 high-performing keywords',
          description: '2 keywords performing exceptionally well. Increase bids to capture more volume.',
          reasoning: 'Excellent CPA below target. Scaling can increase conversions.',
          priority: 'medium',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.80,
          expectedImpact: '15-25% conversion increase',
          impactMetric: 'conversions',
          impactValue: 20,
          suggestedChanges: {
            keywordsToScale: [
              { keywordId: 'kw_001', keywordText: 'buy running shoes', reason: 'CPA 28% below target', suggestedBidIncrease: 15 },
              { keywordId: 'kw_002', keywordText: 'best running shoes', reason: 'CPA 20% below target', suggestedBidIncrease: 15 },
            ],
          },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Bid adjustment
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign2.id,
          type: RecommendationType.BID_ADJUSTMENT,
          title: 'Lower bids to improve CPA',
          description: 'CPA increasing under manual bidding. Recommend 12% bid reduction.',
          reasoning: 'Manual CPC showing 45.3% CPA increase.',
          priority: 'high',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.78,
          expectedImpact: '10-15% CPA improvement',
          impactMetric: 'CPA',
          impactValue: -12.5,
          suggestedChanges: { bidAdjustment: { type: 'decrease', percentage: 12, reason: 'CPA increasing trend' } },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
      // Bidding strategy change
      prisma.recommendation.create({
        data: {
          adAccountId: adAccount.id,
          campaignId: campaign2.id,
          type: RecommendationType.BIDDING_STRATEGY_CHANGE,
          title: 'Switch to Target CPA bidding',
          description: 'Manual CPC underperforming. Switch to Target CPA with $45 target.',
          reasoning: 'Sufficient conversion data for automated bidding.',
          priority: 'medium',
          status: RecommendationStatus.PENDING,
          confidenceScore: 0.75,
          expectedImpact: '20-30% CPA improvement',
          impactMetric: 'CPA',
          impactValue: -25,
          suggestedChanges: { suggestedStrategy: 'TARGET_CPA', currentStrategy: 'MANUAL_CPC', targetCPA: 45 },
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    // Create Audit Logs
    await Promise.all([
      prisma.auditLog.create({
        data: {
          userId: user.id,
          eventType: AuditEventType.LOGIN_SUCCESS,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          severity: 'info',
          message: 'User logged in successfully',
          metadata: { location: 'New York, US' },
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          eventType: AuditEventType.TOKEN_REFRESH_SUCCESS,
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          severity: 'info',
          message: 'Access token refreshed successfully',
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Test data seeded successfully',
      summary: {
        user: user.email,
        accounts: {
          manager: managerAccount.accountName,
          client: adAccount.accountName,
        },
        campaigns: 3,
        metrics: metricsCount,
        keywords: keywords.length,
        searchTerms: searchTerms.length,
        recommendations: recommendations.length,
        auditLogs: 2,
      },
    });
  } catch (error: any) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
