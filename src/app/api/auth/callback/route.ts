import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { findOrCreateUser, storeOAuthSession, generateToken } from '@/lib/auth';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * GET /api/auth/callback
 * Handles OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/error?error=${error}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/auth/error?error=missing_code`
      );
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    if (!userInfo.data.email || !userInfo.data.id) {
      throw new Error('Invalid user info received from Google');
    }

    // Find or create user in database
    const user = await findOrCreateUser({
      googleId: userInfo.data.id,
      email: userInfo.data.email,
      name: userInfo.data.name || undefined,
    });

    // Store OAuth session
    await storeOAuthSession(
      user.id,
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600
    );

    // Generate JWT token for app authentication
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Redirect to account selection page with token
    const redirectUrl = new URL('/auth/accounts', process.env.NEXT_PUBLIC_APP_URL);
    redirectUrl.searchParams.set('token', jwtToken);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/auth/error?error=authentication_failed`
    );
  }
}
