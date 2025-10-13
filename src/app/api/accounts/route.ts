import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { GoogleAdsService } from '@/lib/google-ads';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/accounts
 * Fetch all accessible Google Ads accounts for the authenticated user
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

    // Fetch accessible accounts from Google Ads API
    const googleAdsService = new GoogleAdsService(session.accessToken);
    const accounts = await googleAdsService.getAccessibleAccounts();

    // Check which accounts are already linked
    const linkedAccounts = await prisma.adAccount.findMany({
      where: {
        userId: session.userId,
      },
      select: {
        customerId: true,
      },
    });

    const linkedCustomerIds = new Set(linkedAccounts.map((a) => a.customerId));

    const accountsWithStatus = accounts.map((account) => ({
      ...account,
      isLinked: linkedCustomerIds.has(account.customerId),
    }));

    return NextResponse.json({
      success: true,
      data: accountsWithStatus,
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch accounts',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * Link selected Google Ads accounts to user profile
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
    const { accountIds } = body as { accountIds: string[] };

    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid account IDs' },
        { status: 400 }
      );
    }

    // Fetch account details from Google Ads API
    const googleAdsService = new GoogleAdsService(session.accessToken);
    const allAccounts = await googleAdsService.getAccessibleAccounts();

    // Filter to only the selected accounts
    const selectedAccounts = allAccounts.filter((account) =>
      accountIds.includes(account.customerId)
    );

    if (selectedAccounts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid accounts found' },
        { status: 400 }
      );
    }

    // Store accounts in database
    const linkedAccounts = await Promise.all(
      selectedAccounts.map((account) =>
        prisma.adAccount.upsert({
          where: {
            userId_customerId: {
              userId: session.userId,
              customerId: account.customerId,
            },
          },
          update: {
            accountName: account.accountName,
            currency: account.currency,
            timezone: account.timezone,
            isActive: true,
            lastSyncedAt: new Date(),
          },
          create: {
            userId: session.userId,
            customerId: account.customerId,
            accountName: account.accountName,
            currency: account.currency,
            timezone: account.timezone,
            isActive: true,
            lastSyncedAt: new Date(),
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: linkedAccounts,
      message: `Successfully linked ${linkedAccounts.length} account(s)`,
    });
  } catch (error) {
    console.error('Error linking accounts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to link accounts',
      },
      { status: 500 }
    );
  }
}
