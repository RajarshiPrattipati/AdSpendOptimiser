import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RecommendationImplementationService } from '@/lib/recommendation-implementation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/implement
 * Implement a recommendation
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
    const { recommendationId, dryRun = false, force = false } = body;

    if (!recommendationId) {
      return NextResponse.json(
        { success: false, error: 'Recommendation ID is required' },
        { status: 400 }
      );
    }

    // Verify recommendation exists and user has access
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: recommendationId,
        adAccount: {
          userId: session.userId,
        },
      },
      include: {
        adAccount: true,
      },
    });

    if (!recommendation) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Initialize implementation service with user's tokens
    const implementationService = new RecommendationImplementationService(
      session.accessToken,
      session.refreshToken || ''
    );

    // Implement the recommendation
    const result = await implementationService.implementRecommendation(
      recommendationId,
      session.userId,
      { dryRun, force }
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          message: result.message,
          details: result.details,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error implementing recommendation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to implement recommendation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
