import { NextRequest, NextResponse } from 'next/server';
import { SessionManager, runSessionCleanupJob } from '@/lib/session-manager';
import { getBackgroundJobsStatus } from '@/lib/background-jobs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/session-health
 * Get session health statistics and background job status
 *
 * NOTE: In production, this should be protected with admin authentication
 */
export async function GET(request: NextRequest) {
  try {
    const [health, jobsStatus] = await Promise.all([
      SessionManager.getSessionHealth(),
      getBackgroundJobsStatus(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        sessionHealth: health,
        backgroundJobs: jobsStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching session health:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch session health',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/session-health
 * Manually trigger session cleanup job
 *
 * NOTE: In production, this should be protected with admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const result = await runSessionCleanupJob();

    return NextResponse.json({
      success: true,
      message: 'Session cleanup completed',
      data: result,
    });
  } catch (error) {
    console.error('Error running session cleanup:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to run session cleanup',
      },
      { status: 500 }
    );
  }
}
