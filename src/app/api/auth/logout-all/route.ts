import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth';
import { SessionManager } from '@/lib/session-manager';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/logout-all
 * Logout from all devices/sessions
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const session = await getUserFromToken(authHeader);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const count = await SessionManager.invalidateAllUserSessions(session.userId);

    return NextResponse.json({
      success: true,
      message: `Logged out from ${count} session(s)`,
      sessionsInvalidated: count,
    });
  } catch (error) {
    console.error('Error logging out from all sessions:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to logout from all sessions',
      },
      { status: 500 }
    );
  }
}
