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

    // Try to fetch accessible accounts from Google Ads API
    // This may fail if the developer token is restricted to test accounts only
    let accounts: any[] = [];
    let allAccountsToShow: any[] = [];
    let linkedAccounts: any[] = [];
    let googleAdsCallSucceeded = false;

    try {
      console.log('[API /accounts] Initializing GoogleAdsService...');
      const googleAdsService = new GoogleAdsService(session.accessToken, session.refreshToken);
      console.log('[API /accounts] Fetching accessible accounts...');
      accounts = await googleAdsService.getAccessibleAccounts();
      console.log('[API /accounts] Found', accounts.length, 'accounts');
      googleAdsCallSucceeded = true;

      // Check which accounts are already linked (including client accounts)
      linkedAccounts = await prisma.adAccount.findMany({
        where: {
          userId: session.userId,
        },
        select: {
          id: true,
          customerId: true,
          accountName: true,
          isManagerAccount: true,
          managerAccountId: true,
          currency: true,
          timezone: true,
        },
      });

      const linkedCustomerIds = new Set(linkedAccounts.map((a: any) => a.customerId));

      // For each manager account in the accessible accounts, fetch their client accounts
      allAccountsToShow = [...accounts];

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
    } catch (error: any) {
      console.log('[API /accounts] Failed to fetch Google Ads accounts:', error.message);
      console.log('[API /accounts] This may be because the developer token is restricted to test accounts only');
      console.log('[API /accounts] Continuing with test accounts only...');

      // Check if there are any linked accounts in the database for this user
      linkedAccounts = await prisma.adAccount.findMany({
        where: {
          userId: session.userId,
        },
        select: {
          id: true,
          customerId: true,
          accountName: true,
          isManagerAccount: true,
          managerAccountId: true,
          currency: true,
          timezone: true,
        },
      });
    }

    // Fetch test accounts (available to all users)
    // Test accounts have specific customer IDs: 1234567890 (manager) and 9876543210 (client)
    const testAccounts = await prisma.adAccount.findMany({
      where: {
        customerId: {
          in: ['1234567890', '9876543210'],
        },
      },
      select: {
        id: true,
        customerId: true,
        accountName: true,
        currency: true,
        timezone: true,
        isManagerAccount: true,
        managerAccountId: true,
      },
    });

    console.log('[API /accounts] Found', testAccounts.length, 'test accounts');

    // Add test accounts to the list with isLinked: true and isTestAccount: true
    const testAccountsFormatted = testAccounts.map((account) => ({
      id: account.id,
      customerId: account.customerId,
      accountName: account.accountName,
      currency: account.currency,
      timezone: account.timezone || 'America/New_York',
      isManagerAccount: account.isManagerAccount,
      isLinked: true, // Test accounts are always considered "linked" for all users
      isTestAccount: true, // Flag to identify test accounts
    }));

    // Add database IDs to linked accounts from Google Ads (only if Google Ads call succeeded)
    let accountsWithStatus: any[] = [];
    if (googleAdsCallSucceeded) {
      const linkedCustomerIds = new Set(linkedAccounts.map((a: any) => a.customerId));
      accountsWithStatus = allAccountsToShow.map((account) => {
        const linkedAccount = linkedAccounts.find((la: any) => la.customerId === account.customerId);
        return {
          id: linkedAccount?.id, // Include database ID if linked
          ...account,
          isLinked: linkedCustomerIds.has(account.customerId),
          isTestAccount: false,
        };
      });
    } else {
      // If Google Ads call failed, just return linked accounts from database
      accountsWithStatus = linkedAccounts
        .filter((acc: any) => !['1234567890', '9876543210'].includes(acc.customerId)) // Exclude test accounts
        .map((acc: any) => ({
          id: acc.id,
          customerId: acc.customerId,
          accountName: acc.accountName,
          currency: acc.currency,
          timezone: acc.timezone || 'America/New_York',
          isManagerAccount: acc.isManagerAccount,
          isLinked: true,
          isTestAccount: false,
        }));
    }

    // Combine both lists (test accounts + Google Ads accounts)
    const combinedAccounts = [...testAccountsFormatted, ...accountsWithStatus];

    return NextResponse.json({
      success: true,
      data: combinedAccounts,
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
