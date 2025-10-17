import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { DuplicateKeywordDetector } from '@/lib/duplicate-keyword-detector';

export const dynamic = 'force-dynamic';

/**
 * GET /api/keywords/duplicates
 * Find duplicate keywords in an account
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
    const type = searchParams.get('type'); // 'all', 'cross-campaign', 'match-type'

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

    // Find duplicates based on type
    let duplicates;
    switch (type) {
      case 'cross-campaign':
        duplicates = await DuplicateKeywordDetector.findCrossCampaignDuplicates(accountId);
        break;
      case 'match-type':
        duplicates = await DuplicateKeywordDetector.findMatchTypeConflicts(accountId);
        break;
      default:
        duplicates = await DuplicateKeywordDetector.findDuplicates(accountId);
    }

    // Calculate potential savings
    const savings = DuplicateKeywordDetector.calculatePotentialSavings(duplicates);

    return NextResponse.json({
      success: true,
      data: {
        duplicates,
        savings,
        count: duplicates.length,
      },
    });
  } catch (error) {
    console.error('Error finding duplicate keywords:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to find duplicate keywords',
      },
      { status: 500 }
    );
  }
}
