# Netlify Deployment Guide

## Critical Fix: Update Database URLs on Netlify

Your local environment is working because we added connection parameters to the database URLs. You need to update these same URLs on Netlify.

### 1. Update Netlify Environment Variables

Go to your Netlify site dashboard:
1. Navigate to: **Site settings** > **Build & deploy** > **Environment** > **Environment variables**
2. Update the following variables:

#### DATABASE_URL
**Current value (WRONG):**
```
postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres
```

**New value (CORRECT):**
```
postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres?connection_limit=1&connect_timeout=30&pool_timeout=30
```

#### DIRECT_DATABASE_URL
**Current value (WRONG):**
```
postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres
```

**New value (CORRECT):**
```
postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres?connection_limit=1&connect_timeout=30&pool_timeout=30
```

### 2. What Changed?

We added these connection parameters:
- `connection_limit=1` - Limits connections for Supabase free tier
- `connect_timeout=30` - Increases timeout to 30 seconds
- `pool_timeout=30` - Increases pool timeout to 30 seconds

These parameters are **required** for reliable connections to Supabase's free tier, especially in serverless environments like Netlify Functions.

### 3. Deploy the Changes

After updating the environment variables:

#### Option A: Deploy via Netlify Dashboard
1. Go to **Deploys** tab
2. Click **Trigger deploy** > **Deploy site**

#### Option B: Deploy via Git Push
```bash
git add .
git commit -m "docs: Add Netlify deployment guide and production env template"
git push origin main
```

### 4. Verify the Fix

Once deployed, test the database connection:

1. Visit your debug endpoint:
   ```
   https://your-site.netlify.app/api/debug/env
   ```

   Verify that:
   - `DATABASE_URL` shows length > 100 (should be ~150+ with parameters)
   - All required env vars show as "✓ Set"

2. Test the OAuth flow:
   ```
   https://your-site.netlify.app
   ```

   Click "Sign in with Google" and complete the OAuth flow. It should now successfully connect to the database.

### 5. Troubleshooting

If you still see database errors after updating the environment variables:

1. **Check Netlify Build Logs:**
   - Go to **Deploys** > Click on the latest deploy
   - Check for Prisma generation errors

2. **Verify Environment Variables:**
   - Check that there are no typos in the connection string
   - Ensure no extra spaces before/after the URL

3. **Check Supabase Database Status:**
   - Go to your Supabase dashboard
   - Verify the database is not paused (free tier databases pause after inactivity)
   - If paused, open the SQL Editor to wake it up

4. **Review Function Logs:**
   - Go to **Functions** tab in Netlify
   - Check the logs for the `auth-callback` function
   - Look for specific error messages

### 6. Security Note

After confirming everything works, you should:

1. **Remove or protect debug endpoints** (when ready for production):
   - `/api/debug/env`
   - `/api/debug/db`

2. **Generate a new JWT_SECRET** for production:
   ```bash
   openssl rand -base64 32
   ```

3. **Verify Google OAuth redirect URIs** match your production domain in Google Cloud Console.

---

## Quick Reference: All Environment Variables

See `.env.production.example` for a complete template of all required environment variables.
