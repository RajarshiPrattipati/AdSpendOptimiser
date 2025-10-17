import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RecommendationStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recommendations/approve
 * Approve or reject recommendations
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
    const { recommendationId, status, reason } = body;

    // Validate status
    if (!['APPROVED', 'REJECTED', 'DISMISSED'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

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
    });

    if (!recommendation) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    // Update recommendation status
    const updated = await prisma.recommendation.update({
      where: { id: recommendationId },
      data: {
        status: status as RecommendationStatus,
        // Could add additional fields like rejectionReason if needed
      },
      include: {
        campaign: {
          select: {
            campaignName: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Recommendation ${status.toLowerCase()} successfully`,
    });
  } catch (error: any) {
    console.error('Error updating recommendation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update recommendation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
