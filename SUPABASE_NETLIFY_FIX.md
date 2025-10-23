# Supabase + Netlify Serverless Fix

## Problem
Netlify Functions (serverless) cannot reliably connect to Supabase using direct PostgreSQL connections on port 5432. You need to use Supabase's **Pooler connection** designed for serverless environments.

## Solution

### Option 1: Use Supabase Pooler (Recommended for Serverless)

Supabase provides a connection pooler on port **6543** (Transaction Mode) specifically for serverless environments.

#### CRITICAL: Username Format

When using the pooler, the username format is different:
- **Direct connection**: `postgres`
- **Pooler (Transaction mode)**: `postgres.PROJECT_REF` (e.g., `postgres.otleprdqubsrygwedqsa`)

#### Steps:

1. **Get your Pooler URL from Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/otleprdqubsrygwedqsa/settings/database
   - Look for **"Connection pooling"** or **"Transaction"** section
   - The connection string should look like:
     ```
     postgresql://postgres.otleprdqubsrygwedqsa:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
     ```
   - Note: Username is `postgres.otleprdqubsrygwedqsa` (not just `postgres`)

2. **Update Netlify Environment Variables:**

   Set `DATABASE_URL` to the **pooler URL** (copy directly from Supabase dashboard):
   ```
   postgresql://postgres.otleprdqubsrygwedqsa:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

   Keep `DIRECT_DATABASE_URL` as the direct connection for migrations:
   ```
   postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres?connection_limit=1&connect_timeout=30
   ```

   **IMPORTANT**: Make sure you copy the connection string EXACTLY from Supabase's "Connection pooling" section!

3. **Update Prisma Schema:**

   Make sure your `prisma/schema.prisma` uses the pooler-compatible settings:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_DATABASE_URL")
   }
   ```

### Option 2: Use Supabase REST API (Alternative)

If the pooler still doesn't work, you can use Supabase's REST API client which doesn't require direct database connections.

### Option 3: Upgrade Supabase Plan

If you need persistent direct connections, consider upgrading from the free tier to Pro plan which offers better connection handling.

## Why This Happens

1. **Serverless Cold Starts**: Each Netlify Function invocation might create new database connections
2. **Connection Limits**: Supabase free tier has limited concurrent connections
3. **Network Issues**: Some serverless platforms have connectivity restrictions to direct PostgreSQL ports
4. **Database Pausing**: Free tier databases pause after inactivity and can be slow to wake up

## Implementation Steps

### Step 1: Find Your Pooler Connection String

```bash
# Go to Supabase Dashboard
# https://supabase.com/dashboard/project/otleprdqubsrygwedqsa/settings/database

# Look for "Connection pooling" or "Pooler"
# Copy the connection string that uses port 6543
```

### Step 2: Update Your Local .env for Reference

Update `.env` with a comment about the pooler:

```bash
# For Netlify (serverless), use the pooler URL on port 6543
# DATABASE_URL="postgresql://postgres.otleprdqubsrygwedqsa:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# For local development, direct connection works fine
DATABASE_URL="postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres?connection_limit=1&connect_timeout=30&pool_timeout=30"

# Direct URL for Prisma migrations (always use direct connection)
DIRECT_DATABASE_URL="postgresql://postgres:rv0X0GIkkptkqr8u@db.otleprdqubsrygwedqsa.supabase.co:5432/postgres?connection_limit=1&connect_timeout=30"
```

### Step 3: Update Netlify

1. Go to Netlify Dashboard
2. Site Settings > Environment Variables
3. Update `DATABASE_URL` to use the **pooler URL**
4. Ensure `DIRECT_DATABASE_URL` uses the direct connection
5. Click "Save"

### Step 4: Clear Build Cache and Redeploy

```bash
# In Netlify Dashboard
# Deploys > Trigger deploy > Clear cache and deploy site
```

## Verification

After deployment:

```bash
# Check if environment is set correctly
curl https://adspendoptimiser.netlify.app/api/debug/env | jq '.DATABASE_URL'

# Should show length > 150 and contain "pooler.supabase.com" or correct host

# Test database connection
curl https://adspendoptimiser.netlify.app/api/debug/db | jq '.'

# Should return: {"success": true, ...}
```

## Additional Optimization: Prisma Data Proxy (Optional)

For better serverless performance, consider using Prisma Data Proxy:

1. Sign up at https://www.prisma.io/data-platform
2. Connect your Supabase database
3. Get a Prisma Data Proxy connection string
4. Update your Netlify `DATABASE_URL` to use the proxy URL

## Troubleshooting

### If pooler still doesn't work:

1. **Check Supabase status**: https://status.supabase.com/
2. **Verify password**: The password in the pooler URL must match your database password
3. **Check connection string format**: Ensure no typos or extra spaces
4. **Try Session Mode**: Use port 5432 with `?pgbouncer=true` instead of port 6543
5. **Contact Supabase support**: They can check if there are regional connectivity issues

### If database is paused:

1. Go to Supabase Dashboard
2. Click on "SQL Editor"
3. Run any query to wake up the database
4. Try the OAuth flow again within 1-2 minutes

---

**Next Step**: Find your Supabase pooler connection string and update Netlify's `DATABASE_URL`.
