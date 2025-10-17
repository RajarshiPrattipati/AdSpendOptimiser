import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { GoogleAdsService } from '@/lib/google-ads';
import { KeywordAnalyzer } from '@/lib/keyword-analyzer';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/keywords
 * Fetch keyword performance analysis with pause/scale recommendations
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
    const targetCpa = searchParams.get('targetCpa');
    const minConversionRate = searchParams.get('minConversionRate');
    const minQualityScore = searchParams.get('minQualityScore');

    if (!accountId || !campaignId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: accountId, campaignId' },
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

    let keywords: any[];

    // Fetch keywords from database for test accounts, Google Ads for real accounts
    if (isTestAccount) {
      console.log('[API /keywords] Test account detected, fetching from database...');

      // Fetch keywords from database
      const dbKeywords = await prisma.keyword.findMany({
        where: {
          campaign: {
            adAccountId: accountId,
            campaignId: campaignId,
          },
        },
      });

      // Format to match Google Ads API response
      keywords = dbKeywords.map((kw) => ({
        keywordId: kw.keywordId,
        keywordText: kw.keywordText,
        matchType: kw.matchType,
        status: kw.status,
        impressions: kw.impressions,
        clicks: kw.clicks,
        cost: kw.cost,
        conversions: kw.conversions,
        ctr: kw.ctr,
        cpc: kw.cpc,
        cpa: kw.cpa,
        qualityScore: kw.qualityScore || undefined,
      }));

      console.log('[API /keywords] Found', keywords.length, 'test keywords');
    } else {
      // Fetch keywords from Google Ads
      const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);
      keywords = await googleAdsService.getKeywords(
        account.customerId,
        campaignId
      );
    }

    // Prepare account goals for analysis
    const accountGoals = {
      targetCpa: targetCpa ? parseFloat(targetCpa) : undefined,
      minConversionRate: minConversionRate ? parseFloat(minConversionRate) : undefined,
      minQualityScore: minQualityScore ? parseInt(minQualityScore) : undefined,
    };

    // Analyze keywords and generate recommendations
    const recommendations = KeywordAnalyzer.analyzeKeywords(keywords, accountGoals);
    const impact = KeywordAnalyzer.calculateImpact(recommendations);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalKeywords: keywords.length,
          ...impact,
        },
        recommendations,
        keywords: keywords.slice(0, 100), // Return top 100 keywords
      },
    });
  } catch (error) {
    console.error('Error fetching keyword analysis:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch keyword analysis',
      },
      { status: 500 }
    );
  }
}
