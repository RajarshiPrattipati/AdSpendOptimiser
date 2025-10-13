# 🎯 START HERE - ADSO Setup Guide

## What You Have

✅ **Complete ADSO Application** - Fully built and ready to run!

Your Google Ad Spend Optimizer includes:
- 🔐 Google OAuth authentication
- 📊 Real-time campaign dashboard
- 📈 Performance metrics and analytics
- 🔄 Multi-account management
- 📱 Responsive UI

## ⚡ Quick Setup (3 Steps)

### Step 1: Install Dependencies (2 minutes)

```bash
npm install
```

### Step 2: Setup Database (5 minutes)

**Option A: Use Supabase (Recommended - Free & Easy)**

1. Go to https://supabase.com and sign up
2. Create a new project
3. Go to Settings > Database
4. Copy the "Connection String" (URI format)
5. Update the `DATABASE_URL` in your `.env` file:
   ```
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres"
   ```

**Option B: Local PostgreSQL**

```bash
# Install PostgreSQL if needed
brew install postgresql  # macOS
# or download from https://www.postgresql.org/download/

# Create database
createdb adso

# Update .env with your credentials
DATABASE_URL="postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/adso"
```

Then initialize the database:
```bash
npm run db:generate
npm run db:push
```

### Step 3: Configure Google Cloud (5 minutes)

1. **Go to**: [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials)

2. **Find your OAuth Client**:
   - Client ID: `422764746967-4av2rosganlqjra5gmu5oek3si6cgl6g`

3. **Click to Edit**, then add this redirect URI:
   ```
   http://localhost:3000/api/auth/callback
   ```

4. **Enable APIs** at [API Library](https://console.cloud.google.com/apis/library):
   - Google Ads API
   - Google OAuth2 API
   - Google People API

5. **Save** everything

## 🚀 Run the App

```bash
npm run dev
```

Open: http://localhost:3000

## ✅ Verify Setup

Run this to check everything is configured:

```bash
node verify-setup.js
```

## 📖 What's Next?

### First Time Using the App:

1. **Login**: Click "Continue with Google"
2. **Authorize**: Grant access to your Google Ads accounts
3. **Select Accounts**: Choose which ad accounts to monitor
4. **Dashboard**: View your campaign performance!

### If You Don't Have Google Ads Data:

That's okay! You can:
- Test the authentication flow
- See the UI and interface
- Create a test Google Ads account at https://ads.google.com
- Set up demo campaigns for testing

## 📁 Project Structure

```
adso/
├── START_HERE.md          ← You are here
├── QUICKSTART.md          ← Detailed setup guide
├── README.md              ← Full documentation
├── PRD.md                 ← Product roadmap
├── src/
│   ├── app/
│   │   ├── page.tsx      ← Login page
│   │   ├── dashboard/    ← Main dashboard
│   │   └── api/          ← Backend APIs
│   ├── components/       ← React components
│   └── lib/              ← Services & utilities
└── prisma/
    └── schema.prisma     ← Database schema
```

## 🎨 Features Included

### Authentication & Accounts
- ✅ Google OAuth login
- ✅ Multi-account connection
- ✅ Account switching
- ✅ Secure token storage

### Dashboard
- ✅ Key metrics cards (Spend, CPA, ROAS, CTR, etc.)
- ✅ Campaign performance table
- ✅ Sortable columns
- ✅ Search/filter campaigns
- ✅ Date range selector
- ✅ Real-time data refresh

### Backend
- ✅ RESTful API endpoints
- ✅ Google Ads API integration
- ✅ PostgreSQL database
- ✅ Prisma ORM

## 🐛 Troubleshooting

### "redirect_uri_mismatch"
→ Add the redirect URI to Google Cloud Console (Step 3 above)

### "Database connection failed"
→ Check your DATABASE_URL in .env is correct

### "Failed to fetch accounts"
→ This is normal if:
  - Google Ads API isn't enabled yet
  - You don't have Google Ads accounts
  - You need a developer token (for production use)

### "Dependencies not installed"
→ Run: `npm install`

## 📚 Documentation

- **QUICKSTART.md** - Detailed setup instructions
- **README.md** - Complete documentation
- **PRD.md** - Full product requirements & roadmap
- **SETUP_SUMMARY.md** - Technical overview

## 🎯 Immediate Next Steps

1. ⬜ Run `npm install`
2. ⬜ Setup database (Supabase recommended)
3. ⬜ Add redirect URI to Google Cloud
4. ⬜ Run `npm run db:push`
5. ⬜ Run `npm run dev`
6. ⬜ Open http://localhost:3000
7. ⬜ Test login with Google

## ⚙️ Configuration Files

All configured and ready:
- ✅ `.env` - Environment variables (update DATABASE_URL)
- ✅ `package.json` - Dependencies
- ✅ `tsconfig.json` - TypeScript config
- ✅ `tailwind.config.ts` - Styling
- ✅ `prisma/schema.prisma` - Database schema
- ✅ Google OAuth credentials

## 💡 Pro Tips

1. **Database**: Use Supabase for fastest setup (no local installation needed)
2. **Testing**: You can test authentication even without Google Ads data
3. **Development**: Use `npm run db:studio` to view database in GUI
4. **Production**: Change JWT_SECRET before deploying

## 🆘 Need Help?

1. Check troubleshooting section above
2. Review QUICKSTART.md for detailed steps
3. Run `node verify-setup.js` to diagnose issues
4. Check README.md for more documentation

## 🎉 Ready to Start!

Your app is **90% ready**! Just need to:
1. Install dependencies
2. Connect a database
3. Add redirect URI to Google Cloud

Then you're good to go! 🚀

---

**Commands Reference:**

```bash
# Install & Setup
npm install                # Install dependencies
npm run db:generate       # Generate Prisma client
npm run db:push          # Create database tables

# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Run production build

# Database
npm run db:studio        # Open database GUI

# Utilities
node verify-setup.js     # Check configuration
```

**Questions?** Check the documentation files or review the inline code comments.

Good luck! 🎊
