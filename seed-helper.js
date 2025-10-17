/**
 * Browser Console Seed Helper
 *
 * USAGE:
 * 1. Log into your ADSO application
 * 2. Open browser developer console (F12)
 * 3. Copy and paste this entire script
 * 4. Press Enter
 *
 * This will seed test data for the currently logged-in user.
 */

(async function seedTestData() {
  console.log('🌱 Starting test data seed...');

  try {
    const response = await fetch('/api/seed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Seed failed:', data.error);
      console.error('Status:', response.status);

      if (response.status === 401) {
        console.log('💡 Make sure you are logged in to the application first!');
      }

      return;
    }

    console.log('✅ Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  User:', data.summary.user);
    console.log('  Manager Account:', data.summary.accounts.manager);
    console.log('  Client Account:', data.summary.accounts.client);
    console.log('  Campaigns:', data.summary.campaigns);
    console.log('  Campaign Metrics:', data.summary.metrics, 'records');
    console.log('  Keywords:', data.summary.keywords);
    console.log('  Search Terms:', data.summary.searchTerms);
    console.log('  Recommendations:', data.summary.recommendations);
    console.log('  Audit Logs:', data.summary.auditLogs);

    console.log('\n🎯 Test Data Highlights:');
    console.log('  ✓ High performing campaign for budget increase recommendations');
    console.log('  ✓ Low performing campaign for budget cuts and bid adjustments');
    console.log('  ✓ Duplicate keywords across campaigns for detection');
    console.log('  ✓ Poor search terms for negative keyword recommendations');
    console.log('  ✓ 30 days of metrics for statistical analysis');
    console.log('  ✓ All 7 recommendation types represented');

    console.log('\n🚀 Ready to test! Refresh the page to see your test data.');
    console.log('📖 See SEED_DATA.md for detailed information about the test data.');

  } catch (error) {
    console.error('❌ Error seeding data:', error.message);
    console.error('Full error:', error);
  }
})();
