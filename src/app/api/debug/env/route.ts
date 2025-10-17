import { NextResponse } from 'next/server';

/**
 * Debug endpoint to verify environment variables
 * IMPORTANT: Remove or protect this endpoint in production!
 */
export async function GET() {
  // Temporarily allow in production for debugging
  const isProduction = process.env.NODE_ENV === 'production';

  return NextResponse.json({
    environment: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),

    // Show partial values for debugging (safe for production)
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID
      ? `✓ Set (${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...)`
      : '✗ Missing',
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
      ? `✓ Set (${process.env.GOOGLE_CLIENT_SECRET.substring(0, 10)}...)`
      : '✗ Missing',
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '✗ Missing',
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? '✓ Set' : '✗ Missing',

    DATABASE_URL: process.env.DATABASE_URL
      ? `✓ Set (length: ${process.env.DATABASE_URL.length}, starts: ${process.env.DATABASE_URL.substring(0, 35)}...)`
      : '✗ Missing',
    DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL ? '✓ Set' : '✗ Missing',

    JWT_SECRET: process.env.JWT_SECRET ? '✓ Set' : '✗ Missing',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || '✗ Missing',

    // Show all env var names that might be relevant
    availableEnvVars: Object.keys(process.env)
      .filter(k => k.includes('GOOGLE') || k.includes('DATABASE') || k.includes('JWT') || k.includes('APP') || k.includes('SUPABASE'))
      .sort(),
  });
}
