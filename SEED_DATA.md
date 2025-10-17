# Test Data Seeding Guide

This document explains how to seed your ADSO application with comprehensive test data for all new features.

## 🌱 What Gets Seeded

The seed script creates a complete test environment for any logged-in user with:

### Accounts
- **1 Manager Account**: "Test Manager Account" (Customer ID: 1234567890)
- **1 Ad Account**: "Test Client Account - E-Commerce Store" (Customer ID: 9876543210)

### Campaigns (3 with Different Performance Profiles)

1. **Brand Keywords - High Performer**
   - Budget: $150/day
   - Bidding: Target CPA ($25)
   - Status: Excellent performance, decreasing CPA
   - Purpose: Test budget increase recommendations

2. **Generic Keywords - Underperforming**
   - Budget: $200/day
   - Bidding: Manual CPC
   - Status: Poor performance, increasing CPA
   - Purpose: Test budget decrease, bid adjustments, negative keywords

3. **Product Keywords - Mixed Performance**
   - Budget: $100/day
   - Bidding: Maximize Conversions
   - Status: Medium performance
   - Purpose: Test optimization recommendations

### Campaign Metrics
- **90 records total**: 30 days of historical data × 3 campaigns
- Realistic performance trends for statistical analysis
- Varied conversion rates and CPAs

### Keywords (6 Total)

**High Performers:**
- "buy running shoes" (Exact) - CPA: $18.02, Quality Score: 9
- "best running shoes" (Phrase) - CPA: $20.00, Quality Score: 8

**Poor Performers (Pause Candidates):**
- "cheap shoes" (Broad) - CPA: $216.67, Quality Score: 3
- "free shipping shoes" (Broad) - $468 spent, 0 conversions, Quality Score: 2

**Duplicates (For Detection):**
- "running shoes" in Campaign 1 (Phrase) - CPA: $19.20
- "running shoes" in Campaign 3 (Exact) - CPA: $35.00

### Search Terms (4 Total)

**Good:**
- "nike running shoes" - 12 conversions, $150 cost

**Bad (Negative Keyword Candidates):**
- "free shoes" - 0 conversions, $208 cost (HIGH priority)
- "how to get free shoes" - 0 conversions, $156 cost (HIGH priority)
- "shoes for kids" - 1 conversion, $104 cost (MEDIUM priority)

### Recommendations (7 - All Types Covered)

1. **Budget Reallocation - Increase**
   - Campaign: High Performer
   - Action: $150 → $180 (+20%)
   - Impact: 14% conversion increase
   - Priority: High

2. **Budget Reallocation - Decrease**
   - Campaign: Underperformer
   - Action: $200 → $140 (-30%)
   - Impact: 24% cost reduction
   - Priority: Critical

3. **Add Negative Keywords**
   - Campaign: Underperformer
   - Keywords: "free shoes", "how to get free shoes", "shoes for kids"
   - Impact: $468 monthly savings
   - Priority: Critical

4. **Pause Keywords**
   - Campaign: Underperformer
   - Keywords: "free shipping shoes", "cheap shoes"
   - Impact: $1,118 savings
   - Priority: High

5. **Keyword Optimization - Scale**
   - Campaign: High Performer
   - Keywords: "buy running shoes", "best running shoes"
   - Action: Increase bids 15%
   - Impact: 15-25% conversion increase
   - Priority: Medium

6. **Bid Adjustment**
   - Campaign: Underperformer
   - Action: Decrease bids 12%
   - Impact: 10-15% CPA improvement
   - Priority: High

7. **Bidding Strategy Change**
   - Campaign: Underperformer
   - Action: Manual CPC → Target CPA ($45)
   - Impact: 20-30% CPA improvement
   - Priority: Medium

### Audit Logs
- Login success event
- Token refresh event

### Sessions
- 1 active session with device fingerprinting

## 🚀 How to Seed Data

### Method 1: Via API (Recommended - When App is Running)

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Make a POST request to the seed endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/seed \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

   Or use the browser/Postman with your authenticated session.

3. You'll receive a response with a summary of created data.

### Method 2: Via CLI (When Database is Accessible)

```bash
npm run db:seed
```

This runs the `prisma/seed.ts` script directly.

## 🎯 Testing Features with Seed Data

### Statistical Analysis
- 30 days of metrics data for trend analysis
- Use `/api/analysis` endpoint with any campaign ID
- Test outlier detection, performance trends, benchmarks

### ML Recommendations
- 7 recommendations of all types ready for testing
- Use `/api/recommendations` endpoint
- Test prediction, impact estimation, confidence scoring

### Duplicate Keyword Detection
- "running shoes" appears in 2 campaigns
- Use `/api/keywords/duplicates` endpoint
- Test cross-campaign detection, consolidation plans

### Negative Keyword Analysis
- 3 search terms flagged as negative candidates
- Use `/api/search-terms` endpoint
- Test savings calculation, priority scoring

### Budget Forecasting
- Use `/api/recommendations/forecast` endpoint
- Test with different budget scenarios
- Verify diminishing returns modeling

### Recommendation Implementation
- Use `/api/recommendations/implement` endpoint
- Test rollback functionality
- Verify validation and safety checks

### Category-Specific Recommendations
- Use `/api/recommendations/categories` endpoint
- Test budget, keywords, bids, ads categories
- Verify action prioritization

## 🔄 Re-seeding

The seed script automatically cleans up existing test data before creating new data. You can run it multiple times safely.

**Note:** Only data for the authenticated user is affected. Other users' data remains untouched.

## 📊 Verification

After seeding, verify the data:

1. **Check Prisma Studio:**
   ```bash
   npm run db:studio
   ```

2. **Test API Endpoints:**
   - GET `/api/accounts` - Should show 2 accounts
   - GET `/api/campaigns` - Should show 3 campaigns
   - GET `/api/recommendations` - Should show 7 recommendations
   - GET `/api/keywords` - Should show 6 keywords
   - GET `/api/analysis` - Should work with campaign IDs

3. **Test Dashboard:**
   - Navigate to `/dashboard`
   - Select "Test Client Account - E-Commerce Store"
   - View campaigns, keywords, recommendations

## 🎨 Customization

To modify the seed data:

1. Edit `prisma/seed.ts` or `src/app/api/seed/route.ts`
2. Adjust campaign budgets, metrics, keywords as needed
3. Add more recommendations or campaigns
4. Re-run the seed script

## 🐛 Troubleshooting

**Database Connection Issues:**
- Ensure your `.env` file has correct `DATABASE_URL`
- Check if Supabase database is accessible
- Use the API method if CLI fails

**Duplicate Key Errors:**
- The script automatically cleans up old data
- If errors persist, manually delete test accounts in Prisma Studio

**Missing User:**
- Seed via API (requires authenticated user)
- Or manually create a user first, then run CLI seed

## 📝 Notes

- All test data is clearly labeled (e.g., "Test Manager Account")
- Customer IDs are fictional: 1234567890, 9876543210
- Access tokens are placeholders: "test-access-token"
- Metrics use realistic values but are randomized
- Recommendations have future `validUntil` dates (30 days from creation)

---

**Ready to test!** 🚀 Run the seed script and explore all the new features with realistic data.
