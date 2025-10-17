import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { MLRecommendationEngine } from '@/lib/ml-recommendation-engine';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recommendations/predict-cpa
 * Predict future CPA for a campaign using regression analysis
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
    const campaignId = searchParams.get('campaignId');
    const days = parseInt(searchParams.get('days') || '30', 10);

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

    // Predict CPA
    const prediction = await MLRecommendationEngine.predictCPA(campaignId, days);

    return NextResponse.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('Error predicting CPA:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to predict CPA',
      },
      { status: 500 }
    );
  }
}
