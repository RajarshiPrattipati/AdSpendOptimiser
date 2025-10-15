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
    console.log('[API /accounts] GET request received');
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      console.error('[API /accounts] Unauthorized - no valid session');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[API /accounts] Session found for user:', session.userId);

    // Fetch accessible accounts from Google Ads API
    console.log('[API /accounts] Initializing GoogleAdsService...');
    const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);
    console.log('[API /accounts] Fetching accessible accounts...');
    const accounts = await googleAdsService.getAccessibleAccounts();
    console.log('[API /accounts] Found', accounts.length, 'accounts');

    // Check which accounts are already linked (including client accounts)
    const linkedAccounts = await prisma.adAccount.findMany({
      where: {
        userId: session.userId,
      },
      select: {
        customerId: true,
        isManagerAccount: true,
        managerAccountId: true,
      },
    });

    const linkedCustomerIds = new Set(linkedAccounts.map((a) => a.customerId));

    // For each manager account in the accessible accounts, fetch their client accounts
    const allAccountsToShow = [...accounts];

    for (const account of accounts) {
      if (account.isManagerAccount) {
        try {
          const clientAccounts = await googleAdsService.getClientAccounts(account.customerId);
          allAccountsToShow.push(...clientAccounts);
        } catch (error) {
          console.error(`[API /accounts] Error fetching client accounts for ${account.customerId}:`, error);
        }
      }
    }

    const accountsWithStatus = allAccountsToShow.map((account) => ({
      ...account,
      isLinked: linkedCustomerIds.has(account.customerId),
    }));

    return NextResponse.json({
      success: true,
      data: accountsWithStatus,
    });
  } catch (error: any) {
    console.error('[API /accounts] Error fetching accounts:', error);
    console.error('[API /accounts] Error stack:', error?.stack);
    console.error('[API /accounts] Error message:', error?.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to fetch accounts',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
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
    const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);
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
            isManagerAccount: account.isManagerAccount,
            lastSyncedAt: new Date(),
          },
          create: {
            userId: session.userId,
            customerId: account.customerId,
            accountName: account.accountName,
            currency: account.currency,
            timezone: account.timezone,
            isActive: true,
            isManagerAccount: account.isManagerAccount,
            lastSyncedAt: new Date(),
          },
        })
      )
    );

    // Collect all saved accounts (including client accounts)
    const allSavedAccounts = [...linkedAccounts];

    // For each manager account, also fetch and save their client accounts
    for (const account of selectedAccounts) {
      if (account.isManagerAccount) {
        console.log(`[API /accounts] Fetching client accounts for manager ${account.customerId}...`);
        try {
          const clientAccounts = await googleAdsService.getClientAccounts(account.customerId);
          console.log(`[API /accounts] Found ${clientAccounts.length} client accounts`);

          // Find the database ID of the manager account
          const managerDbAccount = linkedAccounts.find(a => a.customerId === account.customerId);

          // Save each client account
          for (const clientAccount of clientAccounts) {
            const savedClientAccount = await prisma.adAccount.upsert({
              where: {
                userId_customerId: {
                  userId: session.userId,
                  customerId: clientAccount.customerId,
                },
              },
              update: {
                accountName: clientAccount.accountName,
                currency: clientAccount.currency,
                timezone: clientAccount.timezone,
                isActive: true,
                isManagerAccount: clientAccount.isManagerAccount,
                managerAccountId: managerDbAccount?.id,
                lastSyncedAt: new Date(),
              },
              create: {
                userId: session.userId,
                customerId: clientAccount.customerId,
                accountName: clientAccount.accountName,
                currency: clientAccount.currency,
                timezone: clientAccount.timezone,
                isActive: true,
                isManagerAccount: clientAccount.isManagerAccount,
                managerAccountId: managerDbAccount?.id,
                lastSyncedAt: new Date(),
              },
            });

            allSavedAccounts.push(savedClientAccount);
          }

          console.log(`[API /accounts] Saved ${clientAccounts.length} client accounts for manager ${account.customerId}`);
        } catch (error) {
          console.error(`[API /accounts] Error fetching client accounts for manager ${account.customerId}:`, error);
        }
      }
    }

    // Also check if any of the selected account IDs are client accounts
    // and link those directly
    const googleAdsAccounts = await googleAdsService.getAccessibleAccounts();
    for (const accountId of accountIds) {
      // Check if this is a client account we haven't saved yet
      if (!allSavedAccounts.find(a => a.customerId === accountId)) {
        // Try to find it in manager's client accounts
        for (const managerAccount of googleAdsAccounts.filter(a => a.isManagerAccount)) {
          try {
            const clientAccounts = await googleAdsService.getClientAccounts(managerAccount.customerId);
            const matchingClient = clientAccounts.find(c => c.customerId === accountId);

            if (matchingClient) {
              console.log(`[API /accounts] Linking client account ${accountId} from manager ${managerAccount.customerId}`);

              // Find manager's DB account
              const managerDbAccount = await prisma.adAccount.findFirst({
                where: {
                  userId: session.userId,
                  customerId: managerAccount.customerId,
                },
              });

              const savedClient = await prisma.adAccount.upsert({
                where: {
                  userId_customerId: {
                    userId: session.userId,
                    customerId: matchingClient.customerId,
                  },
                },
                update: {
                  accountName: matchingClient.accountName,
                  currency: matchingClient.currency,
                  timezone: matchingClient.timezone,
                  isActive: true,
                  isManagerAccount: matchingClient.isManagerAccount,
                  managerAccountId: managerDbAccount?.id,
                  lastSyncedAt: new Date(),
                },
                create: {
                  userId: session.userId,
                  customerId: matchingClient.customerId,
                  accountName: matchingClient.accountName,
                  currency: matchingClient.currency,
                  timezone: matchingClient.timezone,
                  isActive: true,
                  isManagerAccount: matchingClient.isManagerAccount,
                  managerAccountId: managerDbAccount?.id,
                  lastSyncedAt: new Date(),
                },
              });

              allSavedAccounts.push(savedClient);
              break;
            }
          } catch (error) {
            console.error(`[API /accounts] Error checking client accounts for ${managerAccount.customerId}:`, error);
          }
        }
      }
    }

    console.log(`[API /accounts] Total accounts saved: ${allSavedAccounts.length}`);

    return NextResponse.json({
      success: true,
      data: allSavedAccounts,
      message: `Successfully linked ${allSavedAccounts.length} account(s)`,
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
