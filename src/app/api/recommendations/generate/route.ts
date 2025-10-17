import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { MLRecommendationEngine } from '@/lib/ml-recommendation-engine';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/generate
 * Generate ML-based recommendations for a campaign
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
    const { campaignId, days = 30, storeRecommendations = true } = body;

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

    // Generate recommendations
    const recommendations = await MLRecommendationEngine.generateRecommendations(
      campaignId,
      campaign.adAccountId,
      days
    );

    // Store recommendations if requested
    if (storeRecommendations && recommendations.length > 0) {
      await MLRecommendationEngine.storeRecommendations(
        campaign.adAccountId,
        recommendations
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        campaignId,
        campaignName: campaign.campaignName,
        recommendations,
        count: recommendations.length,
      },
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendations',
      },
      { status: 500 }
    );
  }
}
