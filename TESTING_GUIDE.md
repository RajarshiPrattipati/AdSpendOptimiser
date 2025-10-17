# ADSO Testing Guide

## Features Available for Testing

You now have three main optimization features with comprehensive test data:

### 1. **AI Recommendations Dashboard**
View all AI-generated recommendations in one place with filtering capabilities.

### 2. **Search Term Analysis** (Feature 2)
Analyze search terms to identify negative keyword candidates with priority-based recommendations and estimated savings.

### 3. **Keyword Performance Analysis** (Feature 3)
Analyze keyword performance to identify which keywords to pause (poor performers) or scale (high performers) based on your goals.

---

## Getting Started

### 1. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 2. Login

Use your test account:
- **Email**: `rishiprattipati@gmail.com`
- The database has been seeded with comprehensive test data for this account

### 3. Navigate to Dashboard

After login, you'll see the dashboard at `/dashboard?accountId={your-account-id}`

---

## Testing the Features

### Dashboard Navigation

On the dashboard, you'll see three feature cards at the top:

1. **AI Recommendations** (Blue) - Click to view all recommendations
2. **Search Term Analysis** (Red) - Click to analyze search terms
3. **Keyword Performance** (Green) - Click to analyze keywords

---

## Feature 1: AI Recommendations

**URL**: `/recommendations?accountId={accountId}`

### What to Test:

✅ **View 8 recommendations** across all types:
- Budget reallocation (increase/decrease)
- Negative keyword recommendations (2 recommendations)
- Keyword performance (pause/scale)
- Bid adjustments
- Bidding strategy changes

✅ **Filter recommendations** by:
- Status (Pending, Approved, Implemented)
- Priority (Critical, High, Medium, Low)
- Type (Budget, Keywords, Bids, etc.)

✅ **View detailed information**:
- Expected impact and estimated savings
- Confidence scores
- Detailed reasoning
- Suggested changes in structured format

✅ **Take actions**:
- Approve recommendations
- Implement recommendations (simulated)
- Rollback implemented changes

### Expected Test Data:

- **Total recommendations**: 8
- **Critical priority**: 2 (negative keywords and budget decrease)
- **High priority**: 3
- **Medium priority**: 3
- **Total potential savings**: $747/month from negative keywords
- **Average confidence**: 80-85%

---

## Feature 2: Search Term Analysis

**URL**: `/search-terms?accountId={accountId}`

### What to Test:

✅ **View summary statistics**:
- Total search terms: 10
- Negative keyword candidates: 7
- Total estimated monthly savings: $747
- High priority savings: $611

✅ **Filter by priority tabs**:
- **High Priority** (4 terms) - $611/month waste
  - "free shoes" - $208 savings
  - "how to get free shoes" - $156 savings
  - "used shoes" - $130 savings
  - "shoes donation" - $117 savings

- **Medium Priority** (3 terms) - $136/month savings
  - "shoes for kids" - $52 savings
  - "basketball shoes" - $31.50 savings
  - "dress shoes" - $52.50 savings

- **Low Priority** (3 terms) - Keep monitoring
  - Converting search terms that are performing well

✅ **Select search terms**:
- Click on individual search terms to select them
- Use "Select All" to bulk select
- See selection count update

✅ **View detailed metrics** for each term:
- Cost, Clicks, Conversions, CPA, Conversion Rate
- Reason for recommendation
- Estimated savings

✅ **Bulk actions**:
- Select multiple terms and click "Add as Negative Keywords"
- (Note: This is a simulation - won't actually modify Google Ads)

### Key Test Scenarios:

1. **High-Priority Terms**: Terms with 0 conversions but high cost
2. **Medium-Priority Terms**: Poor CPA or wrong category matches
3. **Good Terms**: Converting well, shouldn't be negated

---

## Feature 3: Keyword Performance Analysis

**URL**: `/keywords?accountId={accountId}&campaignId={campaignId}`

### What to Test:

✅ **View summary statistics**:
- Total keywords: 6
- Pause recommendations: 2 keywords ($1,118 potential savings)
- Scale recommendations: 2 keywords
- Optimize recommendations: Varies

✅ **Filter by action tabs**:

**Pause Tab** (2 keywords to pause):
- "cheap shoes" - CPA $216.67 (333% above target, $650 spent)
- "free shipping shoes" - 0 conversions ($468 wasted)

**Scale Tab** (2 keywords to scale):
- "buy running shoes" - CPA $18.02 (28% below target, high QS: 9)
- "best running shoes" - CPA $20.00 (20% below target, QS: 8)

**Optimize Tab**:
- Keywords that need attention but don't require immediate pause/scale

✅ **Set target CPA**:
- Enter your target CPA (default: $100)
- Recommendations update based on your goals

✅ **View detailed metrics** for each keyword:
- Cost, Clicks, Conversions, CPA, CTR
- Quality Score (when available)
- Reason for recommendation
- Priority level

✅ **Select keywords**:
- Click to select individual keywords
- Use "Select All" for bulk selection
- Action button changes based on active tab:
  - Pause Tab: "Pause Selected Keywords"
  - Scale Tab: "Scale Selected Keywords"
  - Optimize Tab: "Review Selected Keywords"

### Key Test Scenarios:

1. **Poor Performers**: Keywords with 0 conversions or CPA way above target
2. **High Performers**: Keywords with excellent CPA and high quality scores
3. **Match Type Analysis**: See how different match types perform

---

## Test Data Summary

### Accounts
- **Manager Account**: Test Manager Account (ID: 1234567890)
- **Client Account**: Test Client Account - E-Commerce Store (ID: 9876543210)

### Campaigns (3 total)
1. **Brand Keywords - High Performer**
   - Budget: $150/day
   - Target CPA: $25
   - Status: Excellent ROI, decreasing CPA trend

2. **Generic Keywords - Underperforming**
   - Budget: $200/day
   - Target CPA: $50
   - Status: Low ROI, increasing CPA trend

3. **Product Keywords - Mixed Performance**
   - Budget: $100/day
   - Target CPA: $35
   - Status: Medium performance, optimization needed

### Keywords (6 total)
- 2 high-performing (should scale)
- 2 poor-performing (should pause)
- 2 duplicates across campaigns

### Search Terms (10 total)
- 4 high-priority negative candidates (0 conversions, $611 waste)
- 3 medium-priority negative candidates ($136 waste)
- 3 good terms (converting well)

### Recommendations (8 total)
- 2 budget reallocations
- 2 negative keyword sets
- 1 keyword pause recommendation
- 1 keyword scale recommendation
- 1 bid adjustment
- 1 bidding strategy change

### Historical Data
- 30 days of campaign metrics per campaign (90 total records)
- Varied performance trends
- Statistical analysis data

---

## Expected User Flows

### Flow 1: Reduce Wasted Spend
1. Go to Dashboard
2. Click "Search Term Analysis" card
3. View high-priority terms (4 terms, $611/month waste)
4. Select all high-priority terms
5. Click "Add as Negative Keywords"
6. See confirmation

### Flow 2: Optimize Keywords
1. Go to Dashboard
2. Click "Keyword Performance" card
3. View "Pause" tab (2 poor keywords)
4. Select poor performers
5. Click "Pause Selected Keywords"
6. Switch to "Scale" tab
7. Select high performers
8. Click "Scale Selected Keywords"

### Flow 3: Review AI Recommendations
1. Go to Dashboard
2. Click "AI Recommendations" card
3. Filter by "Critical" priority
4. Review negative keyword recommendations
5. Approve recommendations
6. View expected impact

---

## API Endpoints Being Used

All features use authenticated API endpoints:

- `GET /api/recommendations?accountId={id}` - Fetch recommendations
- `GET /api/search-terms?accountId={id}&startDate={date}&endDate={date}` - Search term analysis
- `GET /api/keywords?accountId={id}&campaignId={id}` - Keyword analysis
- `POST /api/recommendations/approve` - Approve recommendations
- `POST /api/recommendations/implement` - Implement changes
- `POST /api/recommendations/rollback` - Rollback changes

---

## Troubleshooting

### Issue: "No recommendations found"
**Solution**: Make sure you've selected an account with the test account ID

### Issue: "Failed to fetch data"
**Solution**:
- Check that the dev server is running
- Verify you're logged in with the test account
- Check browser console for errors
- Make sure the database has been seeded

### Issue: "No account selected"
**Solution**: Navigate from the dashboard using the feature cards, not directly to the URL

### Issue: Keywords page shows "No campaign selected"
**Solution**: Use the navigation from dashboard which includes the campaignId parameter

---

## Re-seeding the Database

If you need to reset the test data:

```bash
npx tsx prisma/seed.ts
```

This will:
1. Clean up existing test data
2. Create fresh test accounts
3. Generate 3 campaigns with metrics
4. Create 6 keywords with varied performance
5. Create 10 search terms with priorities
6. Generate 8 recommendations
7. Add audit logs and sessions

---

## Next Steps

After testing these features, you can:

1. **Connect real Google Ads accounts**: The system automatically detects test vs. real accounts
2. **Customize thresholds**: Adjust target CPA, quality score minimums, etc.
3. **Implement actual actions**: Connect to Google Ads API for real implementations
4. **Add more recommendation types**: Budget forecasting, A/B testing, etc.
5. **Enhanced analytics**: Add charts, trend analysis, and deeper insights

---

## Support

If you encounter issues:
1. Check the browser console for errors
2. Review the terminal logs from the dev server
3. Verify the seed data exists in the database
4. Check that you're using the correct test account

Happy testing! 🚀
