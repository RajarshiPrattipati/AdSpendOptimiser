import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { GoogleAdsService } from '@/lib/google-ads';
import { SearchTermAnalyzer } from '@/lib/search-term-analyzer';
import { prisma } from '@/lib/prisma';

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

    if (!account || account.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Account not found or unauthorized' },
        { status: 404 }
      );
    }

    // Fetch search terms from Google Ads
    const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);
    const searchTerms = await googleAdsService.getSearchTerms(
      account.customerId,
      startDate,
      endDate,
      campaignId || undefined
    );

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
