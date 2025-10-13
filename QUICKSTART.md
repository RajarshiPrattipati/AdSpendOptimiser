# 🚀 ADSO Quick Start Guide

Your Google OAuth credentials have been configured! Follow these steps to get your app running.

## ✅ Already Configured

- ✅ Google OAuth Client ID
- ✅ Google OAuth Client Secret
- ✅ Environment variables created

## 📋 Required: Google Cloud Console Setup

### 1. Add Authorized Redirect URI

Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)

1. Find your OAuth 2.0 Client ID: `422764746967-4av2rosganlqjra5gmu5oek3si6cgl6g`
2. Click to edit it
3. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/api/auth/callback
   ```
4. Click **Save**

### 2. Enable Required APIs

Go to [API Library](https://console.cloud.google.com/apis/library)

Enable the following APIs:
- ✅ **Google Ads API**
- ✅ **Google OAuth2 API** (Identity)
- ✅ **Google People API**

### 3. Get Google Ads Developer Token (Optional for MVP Testing)

For testing with demo data, you can skip this initially. For real Google Ads data:

1. Go to [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. Apply for API access
3. Wait for approval (can take a few days)
4. Once approved, add your developer token to `.env`

## 🗄️ Database Setup

### Option 1: Local PostgreSQL

If you have PostgreSQL installed locally:

```bash
# Create database
createdb adso

# Update .env with your local PostgreSQL credentials
# DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/adso"
```

### Option 2: Use Supabase (Free, Recommended)

1. Go to [supabase.com](https://supabase.com)
2. Create a new project (free tier)
3. Go to **Settings > Database**
4. Copy the **Connection String** (URI format)
5. Update `.env`:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT].supabase.co:5432/postgres"
   ```

### Option 3: Use Railway (Free)

1. Go to [railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL service
4. Copy the `DATABASE_URL` from variables
5. Update `.env`

## 🏃 Installation & Run

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Prisma Client & Create Database Tables

```bash
npm run db:generate
npm run db:push
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Open in Browser

Navigate to: [http://localhost:3000](http://localhost:3000)

## 🎯 Testing the Application

### Without Real Google Ads Data

For initial testing, you can:
1. Log in with Google (authentication will work)
2. The app will show no accounts (which is expected without Ads API access)
3. You can test the UI and authentication flow

### With Google Ads Test Account

1. Create a test Google Ads account at [ads.google.com](https://ads.google.com)
2. Set up test campaigns
3. Log in to ADSO with the same Google account
4. You should see your test campaigns

## 📝 Current Setup Status

```
✅ Project structure created
✅ All code written and ready
✅ Google OAuth credentials configured
✅ Environment variables set
⏳ Database setup needed (choose option above)
⏳ Google Cloud redirect URI needs to be added
⏳ APIs need to be enabled in Google Cloud
```

## 🔧 Troubleshooting

### "redirect_uri_mismatch" Error

**Fix**: Add `http://localhost:3000/api/auth/callback` to authorized redirect URIs in Google Cloud Console

### Database Connection Error

**Fix**:
- Check your `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running (if using local)
- Run `npm run db:push` to create tables

### "Failed to fetch accounts"

This is normal if:
- Google Ads API isn't enabled yet
- You don't have Google Ads accounts
- Developer token isn't set up

## 📞 Next Steps After Setup

Once running, you can:

1. **Test Authentication**: Log in with Google
2. **View Dashboard**: See the UI (will be empty without Ads data)
3. **Add Test Data**: Create test Google Ads campaigns
4. **Explore Features**: Try date ranges, sorting, filtering

## 🎨 Project Features

- 🔐 Google OAuth login
- 📊 Real-time campaign metrics
- 📈 Interactive performance table
- 📅 Flexible date range selection
- 🔄 Account switching
- 📱 Responsive design

## 📚 Documentation

- `README.md` - Full documentation
- `PRD.md` - Product requirements & roadmap
- `SETUP_SUMMARY.md` - Technical overview

## 🐛 Common Issues

### TypeScript Errors

```bash
npm run build
```

If you see TS errors, they're likely just IDE caching. The build will work.

### Missing Environment Variables

Make sure `.env` exists and has all required variables:
```bash
cat .env
```

### Port Already in Use

Change the port:
```bash
PORT=3001 npm run dev
```

## ✅ Verification Checklist

- [ ] Node.js 18+ installed
- [ ] npm install completed successfully
- [ ] Database created and accessible
- [ ] `.env` file exists with all variables
- [ ] Google Cloud redirect URI added
- [ ] Google Ads API enabled
- [ ] `npm run db:push` completed
- [ ] `npm run dev` starts without errors
- [ ] Can access http://localhost:3000

## 🎉 You're Ready!

Once you complete the database setup and Google Cloud configuration, your ADSO app will be fully functional!

---

**Need Help?** Check `README.md` for detailed troubleshooting or review `PRD.md` for feature documentation.
