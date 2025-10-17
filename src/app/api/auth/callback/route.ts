import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { findOrCreateUser, storeOAuthSession, generateToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/callback
 * Handles OAuth callback from Google
 */
export async function GET(request: NextRequest) {
  try {
    // Log environment variables for debugging
    console.log('=== OAuth Callback Debug ===');
    console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing');
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Missing');
    console.log('Request URL:', request.url);
    console.log('Request Origin:', request.nextUrl.origin);

    // Initialize OAuth client at runtime to ensure env vars are available
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    if (error) {
      return NextResponse.redirect(`${baseUrl}/auth/error?error=${error}`);
    }

    if (!code) {
      return NextResponse.redirect(`${baseUrl}/auth/error?error=missing_code`);
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (!tokens.access_token) {
      throw new Error("No access token received");
    }

    // Get user info from Google
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    if (!userInfo.data.email || !userInfo.data.id) {
      throw new Error("Invalid user info received from Google");
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
      tokens.expiry_date
        ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
        : 3600
    );

    // Generate JWT token for app authentication
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Redirect to account selection page with token
    const baseUrl2 = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUrl = new URL("/auth/accounts", baseUrl2);
    redirectUrl.searchParams.set("token", jwtToken);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    // Enhanced error logging for debugging
    console.error("OAuth callback error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing',
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || 'Missing',
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Missing',
    });

    const baseUrl2 = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // Include error message in redirect for debugging (remove in production)
    const errorMessage = error instanceof Error ? error.message : 'authentication_failed';
    return NextResponse.redirect(
      `${baseUrl2}/auth/error?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
