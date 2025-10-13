# ADSO - Google Ad Spend Optimizer

A comprehensive web application for optimizing Google Ads campaigns with real-time analytics, performance insights, and intelligent recommendations.

## Features

### MVP Features Implemented

- **Google OAuth Authentication** - Secure login with Google accounts
- **Account Management** - Connect and manage multiple Google Ads accounts
- **Real-time Dashboard** - View key performance metrics at a glance
- **Campaign Analytics** - Detailed performance data for all campaigns
- **Interactive Data Table** - Sortable, searchable campaign performance table
- **Date Range Selection** - Analyze performance across custom time periods
- **Account Switching** - Easily switch between multiple connected ad accounts

### Key Metrics Tracked

- Total Spend
- Total Conversions
- Average Cost Per Acquisition (CPA)
- Return on Ad Spend (ROAS)
- Click-Through Rate (CTR)
- Total Clicks
- Total Impressions

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Google OAuth 2.0 with JWT
- **APIs**: Google Ads API v14, Google OAuth2 API

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18+ and npm
- PostgreSQL database
- Google Cloud Platform account with Google Ads API access

## Setup Instructions

### 1. Clone the Repository

```bash
cd /Users/rajarshiprattipati/Documents/adso
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Google Cloud Platform

#### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Google Ads API
   - Google OAuth2 API
   - Google People API

#### Create OAuth 2.0 Credentials

1. Navigate to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback` (for development)
   - Your production URL (for production)
5. Save the **Client ID** and **Client Secret**

#### Set Up Google Ads API Access

1. Go to [Google Ads API Center](https://ads.google.com/aw/apicenter)
2. Apply for API access (if not already approved)
3. Note your **Developer Token**

### 4. Set Up PostgreSQL Database

Create a PostgreSQL database for the application:

```bash
# Using psql
psql -U postgres
CREATE DATABASE adso;
```

Or use a cloud provider like:
- [Supabase](https://supabase.com/)
- [Railway](https://railway.app/)
- [Neon](https://neon.tech/)

### 5. Configure Environment Variables

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/adso"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/callback"

# JWT
JWT_SECRET="generate-a-random-secret-key-here"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

**Generate a secure JWT secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 6. Initialize the Database

Generate Prisma client and create database tables:

```bash
npm run db:generate
npm run db:push
```

### 7. Run the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
adso/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── accounts/      # Account management
│   │   │   └── campaigns/     # Campaign data
│   │   ├── auth/              # Auth pages
│   │   ├── dashboard/         # Dashboard page
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Login page
│   ├── components/
│   │   └── dashboard/         # Dashboard components
│   ├── lib/
│   │   ├── auth.ts            # Authentication utilities
│   │   ├── google-ads.ts      # Google Ads API service
│   │   └── prisma.ts          # Prisma client
│   └── types/
│       └── index.ts           # TypeScript types
├── PRD.md                      # Product Requirements Document
├── README.md                   # This file
└── package.json                # Dependencies
```

## Usage Guide

### 1. First-Time Login

1. Navigate to `http://localhost:3000`
2. Click "Continue with Google"
3. Authorize ADSO to access your Google Ads account
4. You'll be redirected to select which ad accounts to monitor

### 2. Account Selection

1. Review the list of Google Ads accounts you manage
2. Select one or more accounts to monitor
3. Click "Continue to Dashboard"

### 3. Dashboard

- **View Metrics**: See key performance indicators at the top
- **Analyze Campaigns**: Review detailed campaign performance in the table
- **Sort & Filter**: Click column headers to sort, use search to filter
- **Change Date Range**: Select custom date ranges or use quick presets
- **Switch Accounts**: Use the dropdown to switch between connected accounts
- **Refresh Data**: Click "Refresh" to get the latest data

## API Endpoints

### Authentication

- `GET /api/auth/login` - Get Google OAuth URL
- `GET /api/auth/callback` - OAuth callback handler

### Accounts

- `GET /api/accounts` - Fetch accessible Google Ads accounts
- `POST /api/accounts` - Link accounts to user profile

### Campaigns

- `GET /api/campaigns?accountId={id}&startDate={date}&endDate={date}` - Fetch campaign data

## Database Schema

### Users
- Stores user profiles from Google OAuth

### Sessions
- Stores OAuth tokens and session data

### AdAccounts
- Links users to their Google Ads accounts

### Campaigns
- Stores campaign information

### CampaignMetrics
- Stores daily performance metrics for campaigns

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Run tests
npm test

# Prisma commands
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio GUI
```

## Environment Setup for Production

### 1. Environment Variables

Update your production environment variables:

```env
DATABASE_URL="your-production-database-url"
GOOGLE_CLIENT_ID="your-production-client-id"
GOOGLE_CLIENT_SECRET="your-production-client-secret"
GOOGLE_REDIRECT_URI="https://yourdomain.com/api/auth/callback"
JWT_SECRET="your-secure-production-secret"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
NODE_ENV="production"
```

### 2. Update Google OAuth Settings

In Google Cloud Console:
1. Add your production domain to **Authorized JavaScript origins**
2. Add your production callback URL to **Authorized redirect URIs**

### 3. Deploy

Deploy to your preferred platform:
- [Vercel](https://vercel.com/) (recommended for Next.js)
- [Railway](https://railway.app/)
- [Render](https://render.com/)
- AWS, Google Cloud, or Azure

## Troubleshooting

### Google Ads API Access Issues

- Ensure your Google Cloud project has the Google Ads API enabled
- Verify your developer token is active
- Check that you have access to the Google Ads accounts you're trying to connect

### Authentication Errors

- Verify your OAuth credentials are correct
- Ensure redirect URIs match exactly in Google Cloud Console
- Check that JWT_SECRET is set in environment variables

### Database Connection Issues

- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check that the database exists and is accessible

### No Campaigns Showing

- Verify the connected Google Ads account has active campaigns
- Check the date range selected
- Ensure the account has data for the selected period

## Next Steps

See `PRD.md` for the full product roadmap, including upcoming features:

- **Automated Recommendations Engine** - AI-powered optimization suggestions
- **Budget Optimizer** - Intelligent budget allocation
- **Automated Rules** - Set up custom automation rules
- **Advanced Reporting** - Custom reports and scheduled exports
- **Multi-user Support** - Team collaboration features

## Contributing

This is a private project. For questions or issues, contact the development team.

## License

Proprietary - All rights reserved

## Support

For support or questions:
- Check the troubleshooting section above
- Review the PRD.md for feature documentation
- Contact the development team

---

**Version**: 0.1.0 (MVP)
**Last Updated**: January 2025
