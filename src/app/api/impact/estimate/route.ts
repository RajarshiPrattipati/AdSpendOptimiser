import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { ImpactEstimationService } from '@/lib/impact-estimation';
import { StatisticalAnalysisService } from '@/lib/statistical-analysis';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/impact/estimate
 * Estimate detailed impact for a recommendation
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
    const { recommendation, days = 30 } = body;

    if (!recommendation || !recommendation.campaignId) {
      return NextResponse.json(
        { success: false, error: 'Recommendation with campaignId is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this campaign
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: recommendation.campaignId,
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

    // Get statistical analysis
    const analysis = await StatisticalAnalysisService.analyzePerformance(
      recommendation.campaignId,
      days
    );

    // Estimate impact
    const impact = await ImpactEstimationService.estimateImpact(
      recommendation,
      analysis
    );

    return NextResponse.json({
      success: true,
      data: impact,
    });
  } catch (error) {
    console.error('Error estimating impact:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to estimate impact',
      },
      { status: 500 }
    );
  }
}
