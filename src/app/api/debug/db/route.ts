import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Debug endpoint to test database connection
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

  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Missing');

    // Test connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Test query
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);

    // Disconnect
    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount,
      databaseUrl: process.env.DATABASE_URL ? 'Set ✓' : 'Missing ✗',
    });
  } catch (error) {
    console.error('Database connection error:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      databaseUrl: process.env.DATABASE_URL ? 'Set ✓' : 'Missing ✗',
    }, { status: 500 });
  }
}
