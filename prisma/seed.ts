import { PrismaClient, RecommendationType, RecommendationStatus, AuditEventType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Comprehensive Seed Script for ADSO
 * Creates test data for all features including:
 * - Manager and Ad Accounts
 * - Campaigns with varied performance
 * - Keywords (high/low performing, duplicates)
 * - Search Terms (for negative keyword analysis)
 * - Campaign Metrics (30 days historical)
 * - Recommendations (all types)
 * - Audit Logs
 * - Sessions
 */

async function main() {
  console.log('🌱 Starting seed...');

  // Get the current user (first user in database, or create a test user)
  let user = await prisma.user.findFirst();

  if (!user) {
    console.log('Creating test user...');
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        googleId: 'test-google-id-123',
      },
    });
    console.log('✓ Test user created');
  }

  console.log(`Using user: ${user.email} (${user.id})`);

  // Clean up existing test data for this user
  console.log('Cleaning up existing test data...');
  await prisma.recommendation.deleteMany({
    where: { adAccount: { userId: user.id } }
  });
  await prisma.searchTerm.deleteMany({
    where: { campaign: { adAccount: { userId: user.id } } }
  });
  await prisma.keyword.deleteMany({
    where: { campaign: { adAccount: { userId: user.id } } }
  });
  await prisma.campaignMetrics.deleteMany({
    where: { campaign: { adAccount: { userId: user.id } } }
  });
  await prisma.campaign.deleteMany({
    where: { adAccount: { userId: user.id } }
  });
  await prisma.adAccount.deleteMany({
    where: { userId: user.id }
  });
  await prisma.session.deleteMany({
    where: { userId: user.id }
  });
  await prisma.auditLog.deleteMany({
    where: { userId: user.id }
  });
  console.log('✓ Cleanup complete');

  // Create Test Manager Account
  console.log('Creating test manager account...');
  const managerAccount = await prisma.adAccount.create({
    data: {
      userId: user.id,
      customerId: '1234567890',
      accountName: 'Test Manager Account',
      currency: 'USD',
      timezone: 'America/New_York',
      isManagerAccount: true,
    },
  });
  console.log(`✓ Manager account created: ${managerAccount.accountName}`);

  // Create Test Ad Account
  console.log('Creating test ad account...');
  const adAccount = await prisma.adAccount.create({
    data: {
      userId: user.id,
      customerId: '9876543210',
      accountName: 'Test Client Account - E-Commerce Store',
      currency: 'USD',
      timezone: 'America/New_York',
      isManagerAccount: false,
      managerAccountId: managerAccount.customerId,
    },
  });
  console.log(`✓ Ad account created: ${adAccount.accountName}`);

  // Create Test Campaigns with Different Performance Profiles
  console.log('Creating test campaigns...');

  // Campaign 1: High Performing - Excellent ROI
  const campaign1 = await prisma.campaign.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: 'camp_001',
      campaignName: 'Brand Keywords - High Performer',
      status: 'ENABLED',
      biddingStrategy: 'TARGET_CPA',
      budget: 150.0,
      targetCpa: 25.0,
      targetRoas: null,
    },
  });

  // Campaign 2: Low Performing - Needs Budget Cut
  const campaign2 = await prisma.campaign.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: 'camp_002',
      campaignName: 'Generic Keywords - Underperforming',
      status: 'ENABLED',
      biddingStrategy: 'MANUAL_CPC',
      budget: 200.0,
      targetCpa: 50.0,
      targetRoas: null,
    },
  });

  // Campaign 3: Medium Performing - Optimization Needed
  const campaign3 = await prisma.campaign.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: 'camp_003',
      campaignName: 'Product Keywords - Mixed Performance',
      status: 'ENABLED',
      biddingStrategy: 'MAXIMIZE_CONVERSIONS',
      budget: 100.0,
      targetCpa: 35.0,
      targetRoas: null,
    },
  });

  console.log(`✓ Created 3 campaigns`);

  // Generate 30 days of metrics for each campaign
  console.log('Generating campaign metrics (30 days)...');

  const today = new Date();

  for (let day = 0; day < 30; day++) {
    const date = new Date(today);
    date.setDate(date.getDate() - day);

    // Campaign 1 metrics: High performing, decreasing CPA trend
    await prisma.campaignMetrics.create({
      data: {
        campaignId: campaign1.id,
        date,
        impressions: 5000 + Math.floor(Math.random() * 1000),
        clicks: 250 + Math.floor(Math.random() * 50),
        cost: 120 + Math.random() * 30,
        conversions: 6 + Math.random() * 2,
        conversionValue: 450 + Math.random() * 100,
      },
    });

    // Campaign 2 metrics: Poor performing, increasing CPA
    await prisma.campaignMetrics.create({
      data: {
        campaignId: campaign2.id,
        date,
        impressions: 8000 + Math.floor(Math.random() * 2000),
        clicks: 200 + Math.floor(Math.random() * 50),
        cost: 180 + Math.random() * 20,
        conversions: 2 + Math.random() * 1.5,
        conversionValue: 120 + Math.random() * 50,
      },
    });

    // Campaign 3 metrics: Medium performance
    await prisma.campaignMetrics.create({
      data: {
        campaignId: campaign3.id,
        date,
        impressions: 4000 + Math.floor(Math.random() * 1000),
        clicks: 180 + Math.floor(Math.random() * 40),
        cost: 90 + Math.random() * 10,
        conversions: 3 + Math.random() * 1,
        conversionValue: 200 + Math.random() * 50,
      },
    });
  }

  console.log('✓ Campaign metrics generated');

  // Create Keywords with Varied Performance
  console.log('Creating test keywords...');

  // Campaign 1: High performing keywords
  const keyword1_1 = await prisma.keyword.create({
    data: {
      campaignId: campaign1.id,
      keywordId: 'kw_001',
      keywordText: 'buy running shoes',
      matchType: 'EXACT',
      status: 'ENABLED',
      impressions: 15000,
      clicks: 750,
      cost: 450.50,
      conversions: 25,
      ctr: 5.0,
      cpc: 0.60,
      cpa: 18.02,
      qualityScore: 9,
    },
  });

  const keyword1_2 = await prisma.keyword.create({
    data: {
      campaignId: campaign1.id,
      keywordId: 'kw_002',
      keywordText: 'best running shoes',
      matchType: 'PHRASE',
      status: 'ENABLED',
      impressions: 12000,
      clicks: 600,
      cost: 360.00,
      conversions: 18,
      ctr: 5.0,
      cpc: 0.60,
      cpa: 20.00,
      qualityScore: 8,
    },
  });

  // Campaign 2: Poor performing keywords (candidates for pause)
  const keyword2_1 = await prisma.keyword.create({
    data: {
      campaignId: campaign2.id,
      keywordId: 'kw_003',
      keywordText: 'cheap shoes',
      matchType: 'BROAD',
      status: 'ENABLED',
      impressions: 25000,
      clicks: 500,
      cost: 650.00,
      conversions: 3,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 216.67,
      qualityScore: 3,
    },
  });

  const keyword2_2 = await prisma.keyword.create({
    data: {
      campaignId: campaign2.id,
      keywordId: 'kw_004',
      keywordText: 'free shipping shoes',
      matchType: 'BROAD',
      status: 'ENABLED',
      impressions: 18000,
      clicks: 360,
      cost: 468.00,
      conversions: 0,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 0,
      qualityScore: 2,
    },
  });

  // Duplicate keywords across campaigns
  const keyword3_1 = await prisma.keyword.create({
    data: {
      campaignId: campaign3.id,
      keywordId: 'kw_005',
      keywordText: 'running shoes',
      matchType: 'EXACT',
      status: 'ENABLED',
      impressions: 10000,
      clicks: 400,
      cost: 280.00,
      conversions: 8,
      ctr: 4.0,
      cpc: 0.70,
      cpa: 35.00,
      qualityScore: 7,
    },
  });

  // Duplicate in campaign 1 (for duplicate detection)
  const keyword1_3 = await prisma.keyword.create({
    data: {
      campaignId: campaign1.id,
      keywordId: 'kw_006',
      keywordText: 'running shoes',
      matchType: 'PHRASE',
      status: 'ENABLED',
      impressions: 8000,
      clicks: 320,
      cost: 192.00,
      conversions: 10,
      ctr: 4.0,
      cpc: 0.60,
      cpa: 19.20,
      qualityScore: 9,
    },
  });

  console.log('✓ Created 6 keywords with varied performance');

  // Create Search Terms for Negative Keyword Analysis
  console.log('Creating search terms...');

  const searchTermDate = new Date();

  // Good search terms - Low priority (converting well)
  await prisma.searchTerm.create({
    data: {
      campaignId: campaign1.id,
      searchTerm: 'nike running shoes',
      matchedKeyword: 'running shoes',
      matchType: 'PHRASE',
      impressions: 5000,
      clicks: 250,
      cost: 150.00,
      conversions: 12,
      ctr: 5.0,
      cpc: 0.60,
      cpa: 12.50,
      conversionRate: 0.24,
      date: searchTermDate,
      isNegative: false,
      priority: 'low',
      estimatedSavings: 0,
    },
  });

  await prisma.searchTerm.create({
    data: {
      campaignId: campaign1.id,
      searchTerm: 'best running shoes for marathon',
      matchedKeyword: 'best running shoes',
      matchType: 'PHRASE',
      impressions: 3200,
      clicks: 160,
      cost: 96.00,
      conversions: 8,
      ctr: 5.0,
      cpc: 0.60,
      cpa: 12.00,
      conversionRate: 0.25,
      date: searchTermDate,
      isNegative: false,
      priority: 'low',
      estimatedSavings: 0,
    },
  });

  // HIGH PRIORITY: Bad search terms (candidates for negative keywords)
  // These are wasting significant budget with no conversions
  await prisma.searchTerm.create({
    data: {
      campaignId: campaign2.id,
      searchTerm: 'free shoes',
      matchedKeyword: 'cheap shoes',
      matchType: 'BROAD',
      impressions: 8000,
      clicks: 160,
      cost: 208.00,
      conversions: 0,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 0,
      conversionRate: 0,
      date: searchTermDate,
      isNegative: true,
      priority: 'high',
      estimatedSavings: 208.00, // Full cost is waste
    },
  });

  await prisma.searchTerm.create({
    data: {
      campaignId: campaign2.id,
      searchTerm: 'how to get free shoes',
      matchedKeyword: 'cheap shoes',
      matchType: 'BROAD',
      impressions: 6000,
      clicks: 120,
      cost: 156.00,
      conversions: 0,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 0,
      conversionRate: 0,
      date: searchTermDate,
      isNegative: true,
      priority: 'high',
      estimatedSavings: 156.00, // Full cost is waste
    },
  });

  await prisma.searchTerm.create({
    data: {
      campaignId: campaign2.id,
      searchTerm: 'used shoes',
      matchedKeyword: 'cheap shoes',
      matchType: 'BROAD',
      impressions: 5000,
      clicks: 100,
      cost: 130.00,
      conversions: 0,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 0,
      conversionRate: 0,
      date: searchTermDate,
      isNegative: true,
      priority: 'high',
      estimatedSavings: 130.00,
    },
  });

  await prisma.searchTerm.create({
    data: {
      campaignId: campaign2.id,
      searchTerm: 'shoes donation',
      matchedKeyword: 'cheap shoes',
      matchType: 'BROAD',
      impressions: 4500,
      clicks: 90,
      cost: 117.00,
      conversions: 0,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 0,
      conversionRate: 0,
      date: searchTermDate,
      isNegative: true,
      priority: 'high',
      estimatedSavings: 117.00,
    },
  });

  // MEDIUM PRIORITY: Poor converting but not zero
  await prisma.searchTerm.create({
    data: {
      campaignId: campaign2.id,
      searchTerm: 'shoes for kids',
      matchedKeyword: 'cheap shoes',
      matchType: 'BROAD',
      impressions: 4000,
      clicks: 80,
      cost: 104.00,
      conversions: 1,
      ctr: 2.0,
      cpc: 1.30,
      cpa: 104.00,
      conversionRate: 0.025,
      date: searchTermDate,
      isNegative: true,
      priority: 'medium',
      estimatedSavings: 52.00, // Half of cost (conservative estimate)
    },
  });

  await prisma.searchTerm.create({
    data: {
      campaignId: campaign3.id,
      searchTerm: 'basketball shoes',
      matchedKeyword: 'running shoes',
      matchType: 'PHRASE',
      impressions: 3000,
      clicks: 90,
      cost: 63.00,
      conversions: 1,
      ctr: 3.0,
      cpc: 0.70,
      cpa: 63.00,
      conversionRate: 0.033,
      date: searchTermDate,
      isNegative: true,
      priority: 'medium',
      estimatedSavings: 31.50,
    },
  });

  await prisma.searchTerm.create({
    data: {
      campaignId: campaign3.id,
      searchTerm: 'dress shoes',
      matchedKeyword: 'running shoes',
      matchType: 'PHRASE',
      impressions: 2500,
      clicks: 75,
      cost: 52.50,
      conversions: 0,
      ctr: 3.0,
      cpc: 0.70,
      cpa: 0,
      conversionRate: 0,
      date: searchTermDate,
      isNegative: true,
      priority: 'medium',
      estimatedSavings: 52.50,
    },
  });

  // LOW PRIORITY: Borderline cases - might improve with more data
  await prisma.searchTerm.create({
    data: {
      campaignId: campaign3.id,
      searchTerm: 'comfortable running shoes',
      matchedKeyword: 'running shoes',
      matchType: 'PHRASE',
      impressions: 2000,
      clicks: 60,
      cost: 42.00,
      conversions: 2,
      ctr: 3.0,
      cpc: 0.70,
      cpa: 21.00,
      conversionRate: 0.10,
      date: searchTermDate,
      isNegative: false,
      priority: 'low',
      estimatedSavings: 0,
    },
  });

  console.log('✓ Created 10 search terms with varied priorities and estimated savings');

  // Create Recommendations for All Types
  console.log('Creating recommendations...');

  // 1. Budget Reallocation - Increase for high performer
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign1.id,
      type: RecommendationType.BUDGET_REALLOCATION,
      title: 'Increase budget for high-performing campaign',
      description: 'Campaign is highly efficient with improving CPA trend. Recommend increasing daily budget from $150 to $180 (20% increase).',
      reasoning: 'Campaign shows excellent health, high ROI (3.75), and decreasing CPA trend. Budget increase can capture more profitable traffic.',
      priority: 'high',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.85,
      expectedImpact: '14% increase in conversions',
      impactMetric: 'conversions',
      impactValue: 14,
      suggestedChanges: {
        budgetChange: {
          from: 150,
          to: 180,
          changeAmount: 30,
        },
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 2. Budget Reallocation - Decrease for poor performer
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign2.id,
      type: RecommendationType.BUDGET_REALLOCATION,
      title: 'Reduce budget for underperforming campaign',
      description: 'Campaign shows low efficiency with increasing CPA. Recommend reducing daily budget from $200 to $140 (30% decrease) to minimize waste.',
      reasoning: 'Poor campaign health, low ROI (0.67), and increasing CPA trend indicate inefficient spend.',
      priority: 'critical',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.80,
      expectedImpact: '24% cost reduction',
      impactMetric: 'cost',
      impactValue: -24,
      suggestedChanges: {
        budgetChange: {
          from: 200,
          to: 140,
          changeAmount: -60,
        },
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 3. Add Negative Keywords - HIGH PRIORITY
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign2.id,
      type: RecommendationType.ADD_NEGATIVE_KEYWORD,
      title: 'Add 4 high-priority negative keywords',
      description: 'Identified 4 high-priority search terms with zero conversions wasting $611.00. Adding as negative keywords provides immediate cost savings.',
      reasoning: 'Search term analysis shows 4 queries with significant spend but zero conversions. These terms indicate searchers looking for free/donated items, not actual purchases.',
      priority: 'critical',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.95,
      expectedImpact: '$611.00 immediate monthly savings',
      impactMetric: 'cost',
      impactValue: -611,
      suggestedChanges: {
        negativeKeywords: [
          { term: 'free shoes', priority: 'high', estimatedSavings: 208.00, reason: '160 clicks, 0 conversions' },
          { term: 'how to get free shoes', priority: 'high', estimatedSavings: 156.00, reason: '120 clicks, 0 conversions' },
          { term: 'used shoes', priority: 'high', estimatedSavings: 130.00, reason: '100 clicks, 0 conversions' },
          { term: 'shoes donation', priority: 'high', estimatedSavings: 117.00, reason: '90 clicks, 0 conversions' },
        ],
        matchType: 'PHRASE',
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 3b. Add Negative Keywords - MEDIUM PRIORITY
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign3.id,
      type: RecommendationType.ADD_NEGATIVE_KEYWORD,
      title: 'Add 3 medium-priority negative keywords',
      description: 'Identified 3 search terms with poor conversion rates. Adding as negative keywords can save $136.00 monthly.',
      reasoning: 'These terms show poor relevance - searchers looking for different shoe types (basketball, dress) or targeting wrong audience (kids shoes).',
      priority: 'high',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.85,
      expectedImpact: '$136.00 monthly savings',
      impactMetric: 'cost',
      impactValue: -136,
      suggestedChanges: {
        negativeKeywords: [
          { term: 'shoes for kids', priority: 'medium', estimatedSavings: 52.00, reason: 'CPA of $104 (2x target)' },
          { term: 'basketball shoes', priority: 'medium', estimatedSavings: 31.50, reason: 'Wrong product category' },
          { term: 'dress shoes', priority: 'medium', estimatedSavings: 52.50, reason: 'Wrong product category' },
        ],
        matchType: 'PHRASE',
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 4. Pause Keyword
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign2.id,
      type: RecommendationType.PAUSE_KEYWORD,
      title: 'Pause 2 underperforming keywords',
      description: '2 keywords are consistently underperforming. Pausing them can save $1,118.00.',
      reasoning: 'Keyword analysis shows these keywords have high cost with zero or very poor conversions.',
      priority: 'high',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.85,
      expectedImpact: '$1,118.00 savings',
      impactMetric: 'cost',
      impactValue: -1118,
      suggestedChanges: {
        keywordsToPause: [
          {
            keywordId: 'kw_004',
            keywordText: 'free shipping shoes',
            reason: 'Spent $468.00 with 0 conversions - pure waste',
            cost: 468.00,
          },
          {
            keywordId: 'kw_003',
            keywordText: 'cheap shoes',
            reason: 'CPA of $216.67 is 333% above target',
            cost: 650.00,
          },
        ],
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 5. Keyword Optimization - Scale high performers
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign1.id,
      type: RecommendationType.KEYWORD_OPTIMIZATION,
      title: 'Scale 2 high-performing keywords',
      description: '2 keywords are performing exceptionally well. Consider increasing bids to capture more volume.',
      reasoning: 'These keywords have excellent CPA and conversion rates, significantly below target. Scaling can increase profitable conversions.',
      priority: 'medium',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.80,
      expectedImpact: '15-25% conversion increase',
      impactMetric: 'conversions',
      impactValue: 20,
      suggestedChanges: {
        keywordsToScale: [
          {
            keywordId: 'kw_001',
            keywordText: 'buy running shoes',
            reason: 'Excellent CPA of $18.02 (28% below target)',
            suggestedBidIncrease: 15,
          },
          {
            keywordId: 'kw_002',
            keywordText: 'best running shoes',
            reason: 'Strong CPA of $20.00 (20% below target)',
            suggestedBidIncrease: 15,
          },
        ],
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 6. Bid Adjustment - Lower bids
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign2.id,
      type: RecommendationType.BID_ADJUSTMENT,
      title: 'Lower bids to improve CPA',
      description: 'CPA is increasing under manual bidding. Recommend 10-15% bid reduction to improve efficiency.',
      reasoning: 'Manual CPC showing 45.3% CPA increase. Bid reduction can help control costs while maintaining conversion volume.',
      priority: 'high',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.78,
      expectedImpact: '10-15% CPA improvement',
      impactMetric: 'CPA',
      impactValue: -12.5,
      suggestedChanges: {
        bidAdjustment: {
          type: 'decrease',
          percentage: 12,
          reason: 'CPA increasing trend',
        },
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 7. Bidding Strategy Change
  await prisma.recommendation.create({
    data: {
      adAccountId: adAccount.id,
      campaignId: campaign2.id,
      type: RecommendationType.BIDDING_STRATEGY_CHANGE,
      title: 'Switch to Target CPA bidding',
      description: 'Manual CPC is underperforming. Switch to Target CPA with $45 target to improve efficiency.',
      reasoning: 'Campaign has sufficient conversion data for automated bidding. Target CPA can optimize better than manual bidding.',
      priority: 'medium',
      status: RecommendationStatus.PENDING,
      confidenceScore: 0.75,
      expectedImpact: '20-30% CPA improvement',
      impactMetric: 'CPA',
      impactValue: -25,
      suggestedChanges: {
        suggestedStrategy: 'TARGET_CPA',
        currentStrategy: 'MANUAL_CPC',
        targetCPA: 45.00,
      },
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('✓ Created 8 recommendations (including 2 negative keyword recommendations)');

  // Create Audit Logs
  console.log('Creating audit logs...');

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      eventType: AuditEventType.LOGIN_SUCCESS,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      severity: 'info',
      message: 'User logged in successfully',
      metadata: { location: 'New York, US' },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      eventType: AuditEventType.TOKEN_REFRESH_SUCCESS,
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      severity: 'info',
      message: 'Access token refreshed successfully',
    },
  });

  console.log('✓ Created audit logs');

  // Create Active Session
  console.log('Creating active session...');

  await prisma.session.create({
    data: {
      userId: user.id,
      accessToken: 'test-session-access-token',
      refreshToken: 'test-session-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600000),
      lastActivityAt: new Date(),
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      deviceFingerprint: 'test-device-fingerprint-123',
    },
  });

  console.log('✓ Created session');

  // Summary
  console.log('\n✅ Seed completed successfully!\n');
  console.log('📊 Summary:');
  console.log('  - User:', user.email);
  console.log('  - Manager Account:', managerAccount.accountName);
  console.log('  - Ad Account:', adAccount.accountName);
  console.log('  - Campaigns: 3 (varied performance profiles)');
  console.log('  - Campaign Metrics: 90 records (30 days × 3 campaigns)');
  console.log('  - Keywords: 6 (including duplicates)');
  console.log('  - Search Terms: 10 (with priority-based negative keyword candidates)');
  console.log('  - Recommendations: 8 (all types covered)');
  console.log('  - Audit Logs: 2 events');
  console.log('  - Active Sessions: 1');
  console.log('\n🎯 Test Data Highlights:');
  console.log('  ✓ High performing campaign for budget increase recommendations');
  console.log('  ✓ Low performing campaign for budget cuts and bid adjustments');
  console.log('  ✓ Duplicate keywords across campaigns for detection');
  console.log('  ✓ 10 search terms with 3 priority levels (high/medium/low)');
  console.log('  ✓ High priority: 4 terms with $611/month waste (0 conversions)');
  console.log('  ✓ Medium priority: 3 terms with $136/month potential savings');
  console.log('  ✓ Low priority: 3 converting terms (keep monitoring)');
  console.log('  ✓ Keyword performance recommendations (pause poor performers, scale winners)');
  console.log('  ✓ Statistical analysis data (30 days of metrics)');
  console.log('  ✓ ML prediction scenarios');
  console.log('  ✓ All recommendation types represented');
  console.log('\n🚀 You can now test all features with realistic data!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
