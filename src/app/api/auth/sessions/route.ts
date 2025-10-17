import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { SessionManager } from '@/lib/session-manager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/sessions
 * Get all active sessions for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessions = await SessionManager.getUserSessions(session.userId);

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        count: sessions.length,
      },
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sessions',
      },
      { status: 500 }
    );
  }
}
