# 🚨 QUICK FIX: "Tenant or user not found" Error

## The Problem
Error: `FATAL: Tenant or user not found`

This means you're using the **wrong username format** for Supabase's connection pooler.

## The Solution (5 Minutes)

### Step 1: Get the CORRECT Connection String from Supabase

1. Go to: **https://supabase.com/dashboard/project/otleprdqubsrygwedqsa/settings/database**

2. Scroll down to find **"Connection pooling"** or **"Transaction"** section

3. Look for "Connection string" under **"Transaction Mode"**

4. Click **"Copy"** or note down the EXACT connection string

It should look like:
```
postgresql://postgres.otleprdqubsrygwedqsa:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**KEY POINT**: The username should be `postgres.otleprdqubsrygwedqsa` (not just `postgres`)

### Step 2: Update Netlify

1. Go to **Netlify Dashboard** > Your Site > **Site settings** > **Environment variables**

2. Find `DATABASE_URL`

3. Replace it with the connection string from Step 1, and add `?pgbouncer=true&connection_limit=1` at the end:
   ```
   postgresql://postgres.otleprdqubsrygwedqsa:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

4. Click **Save**

### Step 3: Redeploy

1. Go to **Deploys** tab
2. Click **"Trigger deploy"** > **"Clear cache and deploy site"**

---

## Important Notes

### What if Supabase doesn't show a pooler connection string?

If your Supabase project doesn't have a "Connection pooling" section, it means:
- You might be on an older free tier plan
- Supabase hasn't enabled pooling for your region yet

**Alternative Solution**: Use Supabase's **Session Mode** (port 5432) with `pgbouncer=true`:

```
postgresql://postgres.otleprdqubsrygwedqsa:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

Or use the **IPv6 host** if available:
```
postgresql://postgres.otleprdqubsrygwedqsa:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### Can't find the pooler URL?

If Supabase doesn't provide a pooler URL at all, you have these options:

#### Option A: Use Prisma Data Proxy (Recommended)
1. Go to https://console.prisma.io/
2. Create a free account
3. Add your Supabase database as a data source
4. Get the Prisma Data Proxy connection string
5. Use that in Netlify's `DATABASE_URL`

#### Option B: Use Supabase's REST API
Instead of Prisma, use Supabase's client library which doesn't require direct database connections.

#### Option C: Upgrade Supabase Plan
The Pro plan ($25/month) has better connection pooling and reliability for serverless.

---

## How to Verify It Works

After redeploying:

```bash
# Check the connection
curl https://adspendoptimiser.netlify.app/api/debug/db

# Should return: {"success": true, ...}
# NOT: "Tenant or user not found"
```

---

## Why This Happened

- Supabase's **pooler** uses a different authentication format: `postgres.PROJECT_REF`
- Your Netlify env was probably using `postgres` (direct connection format)
- The pooler rejected the connection because it didn't recognize the user

The fix is simple: **copy the EXACT connection string from Supabase's dashboard** for the pooler/transaction mode!
