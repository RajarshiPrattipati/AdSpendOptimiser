import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { ImpactEstimationService } from '@/lib/impact-estimation';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/impact/simulate
 * Simulate impact of multiple recommendations
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
    const { campaignId, recommendations, scenario = 'Combined Impact Analysis' } = body;

    if (!campaignId || !recommendations || recommendations.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'campaignId and recommendations array are required',
        },
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

    // Simulate impact
    const simulation = await ImpactEstimationService.simulateImpact(
      campaignId,
      recommendations,
      scenario
    );

    return NextResponse.json({
      success: true,
      data: simulation,
    });
  } catch (error) {
    console.error('Error simulating impact:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to simulate impact',
      },
      { status: 500 }
    );
  }
}
