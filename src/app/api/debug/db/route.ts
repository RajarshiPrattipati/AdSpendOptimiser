import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Debug endpoint to test database connection
 * IMPORTANT: Remove or protect this endpoint in production!
 */
export async function GET() {
  try {
    console.log('=== Database Connection Test ===');
    console.log('DATABASE_URL:', process.env.DATABASE_URL
      ? `Set (length: ${process.env.DATABASE_URL.length}, starts: ${process.env.DATABASE_URL.substring(0, 35)}...)`
      : 'MISSING');
    console.log('DIRECT_DATABASE_URL:', process.env.DIRECT_DATABASE_URL ? 'Set' : 'Not set');

    // Test connection
    console.log('Attempting to connect...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Test query
    const userCount = await prisma.user.count();
    console.log('✅ User count:', userCount);

    // Disconnect
    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount,
      databaseInfo: {
        url: process.env.DATABASE_URL
          ? `Set (${process.env.DATABASE_URL.substring(0, 35)}...)`
          : 'Missing',
        directUrl: process.env.DIRECT_DATABASE_URL ? 'Set' : 'Not set',
      },
    });
  } catch (error) {
    console.error('❌ Database connection error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: (error as any).code,
      meta: (error as any).meta,
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      errorCode: (error as any).code,
      databaseInfo: {
        url: process.env.DATABASE_URL
          ? `Set (${process.env.DATABASE_URL.substring(0, 35)}...)`
          : 'Missing',
        directUrl: process.env.DIRECT_DATABASE_URL ? 'Set' : 'Not set',
      },
    }, { status: 500 });
  }
}
