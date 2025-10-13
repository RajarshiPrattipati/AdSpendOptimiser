import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * GET /api/auth/login
 * Redirects user to Google OAuth consent screen
 */
export async function GET(request: NextRequest) {
  try {
    // Generate the url that will be used for authorization
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/adwords', // Google Ads API access
      ],
      prompt: 'consent', // Force consent screen to get refresh token
    });

    return NextResponse.json({
      success: true,
      data: {
        url: authorizeUrl,
      },
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate authentication URL',
      },
      { status: 500 }
    );
  }
}
