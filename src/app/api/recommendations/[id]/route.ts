import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recommendations/[id]
 * Get a single recommendation with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recommendation ID is required' },
        { status: 400 }
      );
    }

    // Get recommendation with full details
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
        adAccount: {
          userId: session.userId,
        },
      },
      include: {
        adAccount: {
          select: {
            id: true,
            accountName: true,
            customerId: true,
          },
        },
        campaign: {
          select: {
            id: true,
            campaignId: true,
            campaignName: true,
            status: true,
            biddingStrategy: true,
            budget: true,
            targetCpa: true,
            targetRoas: true,
          },
        },
      },
    });

    if (!recommendation) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('Error fetching recommendation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recommendation',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/recommendations/[id]
 * Update a recommendation (e.g., mark as dismissed, update priority)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { status, priority } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recommendation ID is required' },
        { status: 400 }
      );
    }

    // Verify recommendation exists and user has access
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
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

    // Build update data
    const updateData: any = {};
    if (status) {
      // Validate status
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'DISMISSED'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status' },
          { status: 400 }
        );
      }
      updateData.status = status;
    }
    if (priority) {
      // Validate priority
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      if (!validPriorities.includes(priority)) {
        return NextResponse.json(
          { success: false, error: 'Invalid priority' },
          { status: 400 }
        );
      }
      updateData.priority = priority;
    }

    // Update recommendation
    const updated = await prisma.recommendation.update({
      where: { id },
      data: updateData,
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
      message: 'Recommendation updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating recommendation:', error);
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

/**
 * DELETE /api/recommendations/[id]
 * Delete a recommendation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Recommendation ID is required' },
        { status: 400 }
      );
    }

    // Verify recommendation exists and user has access
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id,
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

    // Prevent deletion of implemented recommendations (should rollback first)
    if (recommendation.status === 'IMPLEMENTED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot delete implemented recommendations. Rollback first.',
        },
        { status: 400 }
      );
    }

    // Delete recommendation
    await prisma.recommendation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Recommendation deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting recommendation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete recommendation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
