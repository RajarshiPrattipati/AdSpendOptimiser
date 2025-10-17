import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify environment variables
 * IMPORTANT: Remove or protect this endpoint in production!
 */
export async function GET() {
  // Only allow in development or if explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEBUG_ENDPOINT !== 'true') {
    return NextResponse.json(
      { error: 'Debug endpoint disabled in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓ Set' : '✗ Missing',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '✗ Missing',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '✗ Missing',
    JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Missing',
    DATABASE_URL: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
  });
}
