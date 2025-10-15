/**
 * Script to update existing accounts and mark manager accounts
 * Run with: npx tsx scripts/update-manager-accounts.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleAdsService } from '../src/lib/google-ads';

const prisma = new PrismaClient();

async function updateManagerAccounts() {
  try {
    console.log('Fetching all accounts from database...');

    // Get all accounts
    const accounts = await prisma.adAccount.findMany({
      include: {
        user: {
          include: {
            sessions: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
          },
        },
      },
    });

    console.log(`Found ${accounts.length} accounts to check`);

    for (const account of accounts) {
      const session = account.user.sessions[0];

      if (!session || !session.refreshToken) {
        console.log(`⚠️  Skipping account ${account.customerId} - no valid session`);
        continue;
      }

      try {
        console.log(`Checking account ${account.customerId} (${account.accountName})...`);

        const googleAdsService = new GoogleAdsService(
          session.accessToken,
          session.refreshToken
        );

        const accountDetails = await googleAdsService.getAccountDetails(account.customerId);

        if (accountDetails) {
          const isManager = accountDetails.isManagerAccount;

          if (isManager !== account.isManagerAccount) {
            console.log(`  📝 Updating ${account.customerId}: isManagerAccount = ${isManager}`);

            await prisma.adAccount.update({
              where: { id: account.id },
              data: { isManagerAccount: isManager },
            });

            console.log(`  ✅ Updated successfully`);
          } else {
            console.log(`  ✓ Already correct (isManagerAccount = ${isManager})`);
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error checking account ${account.customerId}:`, error.message);
      }
    }

    console.log('\n✅ Migration complete!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateManagerAccounts();
