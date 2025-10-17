import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { MLRecommendationEngine } from '@/lib/ml-recommendation-engine';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recommendations/segments
 * Segment campaigns by performance patterns
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
    const days = parseInt(searchParams.get('days') || '30', 10);

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

    // Segment campaigns
    const segments = await MLRecommendationEngine.segmentCampaigns(accountId, days);

    return NextResponse.json({
      success: true,
      data: {
        accountId,
        accountName: adAccount.accountName,
        segments,
      },
    });
  } catch (error) {
    console.error('Error segmenting campaigns:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to segment campaigns',
      },
      { status: 500 }
    );
  }
}
