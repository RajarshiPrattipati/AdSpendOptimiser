import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { GoogleAdsService } from '@/lib/google-ads';
import { SearchTermAnalyzer } from '@/lib/search-term-analyzer';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search-terms
 * Fetch search term report with negative keyword recommendations
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const campaignId = searchParams.get('campaignId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const targetCpa = searchParams.get('targetCpa');

    if (!accountId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: accountId, startDate, endDate' },
        { status: 400 }
      );
    }

    // Fetch account from database
    const account = await prisma.adAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check if this is a test account
    const isTestAccount = ['1234567890', '9876543210'].includes(account.customerId);

    // For real accounts, verify ownership
    if (!isTestAccount && account.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Account not found or unauthorized' },
        { status: 404 }
      );
    }

    let searchTerms: any[];

    // Fetch search terms from database for test accounts, Google Ads for real accounts
    if (isTestAccount) {
      console.log('[API /search-terms] Test account detected, fetching from database...');

      // Build where clause for database query
      const whereClause: any = {
        campaign: {
          adAccountId: accountId,
        },
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      };

      if (campaignId) {
        whereClause.campaign.campaignId = campaignId;
      }

      // Fetch search terms from database
      const dbSearchTerms = await prisma.searchTerm.findMany({
        where: whereClause,
      });

      // Format to match Google Ads API response
      searchTerms = dbSearchTerms.map((st) => ({
        searchTerm: st.searchTerm,
        matchedKeyword: st.matchedKeyword || undefined,
        matchType: st.matchType || undefined,
        impressions: st.impressions,
        clicks: st.clicks,
        cost: st.cost,
        conversions: st.conversions,
        ctr: st.impressions > 0 ? (st.clicks / st.impressions) * 100 : 0,
        cpc: st.clicks > 0 ? st.cost / st.clicks : 0,
        cpa: st.conversions > 0 ? st.cost / st.conversions : 0,
        conversionRate: st.impressions > 0 ? (st.conversions / st.impressions) * 100 : 0,
        date: st.date.toISOString().split('T')[0],
      }));

      console.log('[API /search-terms] Found', searchTerms.length, 'test search terms');
    } else {
      // Fetch search terms from Google Ads
      const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);
      searchTerms = await googleAdsService.getSearchTerms(
        account.customerId,
        startDate,
        endDate,
        campaignId || undefined
      );
    }

    // Analyze search terms and generate recommendations
    const accountGoals = targetCpa ? { targetCpa: parseFloat(targetCpa) } : undefined;
    const recommendations = SearchTermAnalyzer.analyzeSearchTerms(searchTerms, accountGoals);
    const savings = SearchTermAnalyzer.calculateTotalSavings(recommendations);

    // Group by priority for easy display
    const byPriority = {
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low'),
    };

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSearchTerms: searchTerms.length,
          negativeKeywordCandidates: recommendations.length,
          estimatedSavings: savings.total,
          savingsByPriority: savings.byPriority,
        },
        recommendations: {
          all: recommendations,
          byPriority,
        },
        dateRange: {
          startDate,
          endDate,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching search term report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch search term report',
      },
      { status: 500 }
    );
  }
}
