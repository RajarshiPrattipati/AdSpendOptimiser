import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RecommendationImplementationService } from '@/lib/recommendation-implementation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/batch
 * Batch implement multiple recommendations
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
    const { recommendationIds, maxConcurrent = 3 } = body;

    if (!recommendationIds || !Array.isArray(recommendationIds) || recommendationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Recommendation IDs array is required' },
        { status: 400 }
      );
    }

    // Verify all recommendations exist and user has access
    const recommendations = await prisma.recommendation.findMany({
      where: {
        id: { in: recommendationIds },
        adAccount: {
          userId: session.userId,
        },
      },
    });

    if (recommendations.length !== recommendationIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Some recommendations not found or access denied',
          details: {
            requested: recommendationIds.length,
            found: recommendations.length,
          },
        },
        { status: 404 }
      );
    }

    // Initialize implementation service
    const implementationService = new RecommendationImplementationService(
      session.accessToken,
      session.refreshToken || ''
    );

    // Queue all recommendations
    const queuedItems = await Promise.all(
      recommendationIds.map((id, index) =>
        implementationService.queueImplementation(id, recommendationIds.length - index)
      )
    );

    // Process queue
    const results = await implementationService.processQueue(session.userId, maxConcurrent);

    // Get queue status
    const queueStatus = implementationService.getQueueStatus();

    // Clear completed items
    const cleared = implementationService.clearCompleted();

    return NextResponse.json({
      success: true,
      data: {
        results,
        queueStatus,
        clearedItems: cleared,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        },
      },
      message: `Batch implementation completed: ${results.filter(r => r.success).length}/${results.length} successful`,
    });
  } catch (error: any) {
    console.error('Error batch implementing recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to batch implement recommendations',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
