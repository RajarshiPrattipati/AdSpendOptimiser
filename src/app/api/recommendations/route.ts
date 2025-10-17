import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recommendations
 * Get all recommendations for an account
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
    const status = searchParams.get('status'); // PENDING, APPROVED, REJECTED, IMPLEMENTED, DISMISSED
    const type = searchParams.get('type'); // Filter by recommendation type
    const priority = searchParams.get('priority'); // critical, high, medium, low
    const campaignId = searchParams.get('campaignId'); // Filter by specific campaign

    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100); // Max 100 per page
    const skip = (page - 1) * limit;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Verify user owns this account OR it's a test account
    const adAccount = await prisma.adAccount.findFirst({
      where: {
        id: accountId,
      },
    });

    if (!adAccount) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Check if this is a test account
    const isTestAccount = ['1234567890', '9876543210'].includes(adAccount.customerId);

    // For real accounts, verify ownership
    if (!isTestAccount && adAccount.userId !== session.userId) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Build query filters
    const where: any = { adAccountId: accountId };
    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (priority) {
      where.priority = priority;
    }
    if (campaignId) {
      where.campaignId = campaignId;
    }

    // Get total count for pagination
    const totalCount = await prisma.recommendation.count({ where });

    // Get paginated recommendations
    const recommendations = await prisma.recommendation.findMany({
      where,
      include: {
        campaign: {
          select: {
            campaignName: true,
            status: true,
          },
        },
      },
      orderBy: [
        { priority: 'asc' }, // critical, high, medium, low
        { confidenceScore: 'desc' },
        { createdAt: 'desc' },
      ],
      skip,
      take: limit,
    });

    // Group by priority for easy frontend consumption
    const grouped = {
      critical: recommendations.filter(r => r.priority === 'critical'),
      high: recommendations.filter(r => r.priority === 'high'),
      medium: recommendations.filter(r => r.priority === 'medium'),
      low: recommendations.filter(r => r.priority === 'low'),
    };

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        grouped,
        summary: {
          total: recommendations.length,
          byPriority: {
            critical: grouped.critical.length,
            high: grouped.high.length,
            medium: grouped.medium.length,
            low: grouped.low.length,
          },
          byStatus: {
            pending: recommendations.filter(r => r.status === 'PENDING').length,
            approved: recommendations.filter(r => r.status === 'APPROVED').length,
            implemented: recommendations.filter(r => r.status === 'IMPLEMENTED').length,
            rejected: recommendations.filter(r => r.status === 'REJECTED').length,
            dismissed: recommendations.filter(r => r.status === 'DISMISSED').length,
          },
        },
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page < Math.ceil(totalCount / limit),
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch recommendations',
      },
      { status: 500 }
    );
  }
}
