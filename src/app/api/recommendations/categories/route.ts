import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { RecommendationCategories } from '@/lib/recommendation-categories';
import { StatisticalAnalysisService } from '@/lib/statistical-analysis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/categories
 * Generate category-specific recommendations (budget, keywords, bids, ads)
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

    const body = await request.json();
    const {
      campaignId,
      categories = ['budget', 'keywords', 'bids', 'ads'], // Which categories to analyze
      days = 30,
    } = body;

    if (!campaignId) {
      return NextResponse.json(
        { success: false, error: 'Campaign ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this campaign
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
      },
      include: {
        adAccount: true,
      },
    });

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (campaign.adAccount.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access to this campaign' },
        { status: 403 }
      );
    }

    // Get statistical analysis (needed for most categories)
    const analysis = await StatisticalAnalysisService.analyzePerformance(
      campaignId,
      days
    );

    // Generate category-specific recommendations
    const result: any = {
      campaignId,
      campaignName: campaign.campaignName,
      analysisDate: new Date().toISOString(),
      categories: {},
    };

    if (categories.includes('budget')) {
      const budgetRecs = await RecommendationCategories.generateBudgetRecommendations(
        campaignId,
        campaign.adAccountId,
        analysis
      );
      result.categories.budget = {
        count: budgetRecs.length,
        recommendations: budgetRecs,
      };
    }

    if (categories.includes('keywords')) {
      const keywordRecs = await RecommendationCategories.generateKeywordRecommendations(
        campaignId,
        campaign.adAccountId,
        days
      );
      result.categories.keywords = {
        count: keywordRecs.length,
        recommendations: keywordRecs,
      };
    }

    if (categories.includes('bids')) {
      const bidRecs = await RecommendationCategories.generateBidManagementRecommendations(
        campaignId,
        campaign.adAccountId,
        analysis
      );
      result.categories.bids = {
        count: bidRecs.length,
        recommendations: bidRecs,
      };
    }

    if (categories.includes('ads')) {
      const adRecs = await RecommendationCategories.generateAdCreativeRecommendations(
        campaignId,
        campaign.adAccountId
      );
      result.categories.ads = {
        count: adRecs.length,
        recommendations: adRecs,
        note: 'Ad creative analysis requires Ad model integration (coming soon)',
      };
    }

    // Calculate totals
    const totalRecommendations = Object.values(result.categories).reduce(
      (sum: number, cat: any) => sum + (cat.count || 0),
      0
    );

    // Extract top priorities across all categories
    const allRecommendations: any[] = [];
    Object.values(result.categories).forEach((cat: any) => {
      if (cat.recommendations) {
        allRecommendations.push(...cat.recommendations);
      }
    });

    const topPriority = allRecommendations
      .filter(r => r.priority === 'critical' || r.priority === 'high')
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] || 999) - (priorityOrder[b.priority] || 999);
      })
      .slice(0, 5);

    result.summary = {
      totalRecommendations,
      byCategory: Object.fromEntries(
        Object.entries(result.categories).map(([key, val]: [string, any]) => [
          key,
          val.count || 0,
        ])
      ),
      topPriority,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error generating category recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate category recommendations',
      },
      { status: 500 }
    );
  }
}
