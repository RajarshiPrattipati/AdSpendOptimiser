import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Session configuration constants
 */
export const SESSION_CONFIG = {
  // Maximum idle time before session expires (30 minutes)
  IDLE_TIMEOUT_MS: 30 * 60 * 1000,

  // Maximum session lifetime regardless of activity (7 days)
  MAX_SESSION_AGE_MS: 7 * 24 * 60 * 60 * 1000,

  // Refresh token validity period (60 days, matching Google's typical setting)
  REFRESH_TOKEN_EXPIRY_MS: 60 * 24 * 60 * 60 * 1000,

  // How often to run cleanup job (every hour)
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000,
};

/**
 * Session cleanup result
 */
export interface CleanupResult {
  expiredSessions: number;
  idleSessions: number;
  oldSessions: number;
  expiredRefreshTokens: number;
  totalCleaned: number;
}

/**
 * Session health stats
 */
export interface SessionHealthStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  idleSessions: number;
  averageSessionAge: number;
  sessionsNearExpiry: number;
}

/**
 * Session Management Service
 *
 * Handles:
 * - Session cleanup and expiration
 * - Timeout management
 * - Activity tracking
 * - Health monitoring
 */
export class SessionManager {
  /**
   * Clean up expired and idle sessions
   */
  static async cleanupExpiredSessions(): Promise<CleanupResult> {
    const now = new Date();
    const result: CleanupResult = {
      expiredSessions: 0,
      idleSessions: 0,
      oldSessions: 0,
      expiredRefreshTokens: 0,
      totalCleaned: 0,
    };

    try {
      // 1. Delete sessions with expired access tokens that can't be refreshed
      const expiredAccessTokenCutoff = new Date(now.getTime() - 1000 * 60); // 1 minute grace period
      const expiredAccessResult = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lte: expiredAccessTokenCutoff,
          },
          refreshToken: null, // Can't refresh, so delete
        },
      });
      result.expiredSessions = expiredAccessResult.count;

      // 2. Delete sessions with expired refresh tokens
      const expiredRefreshResult = await prisma.session.deleteMany({
        where: {
          refreshTokenExpiresAt: {
            not: null,
            lte: now,
          },
        },
      });
      result.expiredRefreshTokens = expiredRefreshResult.count;

      // 3. Delete idle sessions (no activity for longer than IDLE_TIMEOUT)
      const idleThreshold = new Date(now.getTime() - SESSION_CONFIG.IDLE_TIMEOUT_MS);
      const idleResult = await prisma.session.deleteMany({
        where: {
          lastActivityAt: {
            lte: idleThreshold,
          },
        },
      });
      result.idleSessions = idleResult.count;

      // 4. Delete old sessions (created more than MAX_SESSION_AGE ago)
      const oldSessionThreshold = new Date(now.getTime() - SESSION_CONFIG.MAX_SESSION_AGE_MS);
      const oldResult = await prisma.session.deleteMany({
        where: {
          createdAt: {
            lte: oldSessionThreshold,
          },
        },
      });
      result.oldSessions = oldResult.count;

      result.totalCleaned =
        result.expiredSessions +
        result.expiredRefreshTokens +
        result.idleSessions +
        result.oldSessions;

      console.log(`[SessionManager] Cleaned up ${result.totalCleaned} sessions:`, result);

      return result;
    } catch (error) {
      console.error('[SessionManager] Error cleaning up sessions:', error);
      throw error;
    }
  }

  /**
   * Validate and update session activity
   * Returns null if session is invalid or expired
   */
  static async validateAndUpdateSession(sessionId: string): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return false;
      }

      const now = new Date();

      // Check if session is too old
      const sessionAge = now.getTime() - session.createdAt.getTime();
      if (sessionAge > SESSION_CONFIG.MAX_SESSION_AGE_MS) {
        await prisma.session.delete({ where: { id: sessionId } });
        return false;
      }

      // Check if session is idle
      const idleTime = now.getTime() - session.lastActivityAt.getTime();
      if (idleTime > SESSION_CONFIG.IDLE_TIMEOUT_MS) {
        await prisma.session.delete({ where: { id: sessionId } });
        return false;
      }

      // Check if refresh token is expired
      if (session.refreshTokenExpiresAt && session.refreshTokenExpiresAt <= now) {
        await prisma.session.delete({ where: { id: sessionId } });
        return false;
      }

      // Session is valid - update last activity
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          lastActivityAt: now,
        },
      });

      return true;
    } catch (error) {
      console.error('[SessionManager] Error validating session:', error);
      return false;
    }
  }

  /**
   * Invalidate a specific session (logout)
   */
  static async invalidateSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id: sessionId },
      });
      return true;
    } catch (error) {
      console.error('[SessionManager] Error invalidating session:', error);
      return false;
    }
  }

  /**
   * Invalidate all sessions for a user (logout everywhere)
   */
  static async invalidateAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: { userId },
      });
      return result.count;
    } catch (error) {
      console.error('[SessionManager] Error invalidating user sessions:', error);
      return 0;
    }
  }

  /**
   * Get session health statistics
   */
  static async getSessionHealth(): Promise<SessionHealthStats> {
    try {
      const now = new Date();
      const idleThreshold = new Date(now.getTime() - SESSION_CONFIG.IDLE_TIMEOUT_MS);
      const expiryWarningThreshold = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

      const [total, expired, idle, nearExpiry, sessions] = await Promise.all([
        prisma.session.count(),
        prisma.session.count({
          where: {
            OR: [
              { expiresAt: { lte: now } },
              { refreshTokenExpiresAt: { lte: now } },
            ],
          },
        }),
        prisma.session.count({
          where: {
            lastActivityAt: { lte: idleThreshold },
          },
        }),
        prisma.session.count({
          where: {
            expiresAt: {
              lte: expiryWarningThreshold,
              gte: now,
            },
          },
        }),
        prisma.session.findMany({
          select: { createdAt: true },
        }),
      ]);

      // Calculate average session age
      const avgAge =
        sessions.length > 0
          ? sessions.reduce((sum, s) => sum + (now.getTime() - s.createdAt.getTime()), 0) /
            sessions.length
          : 0;

      return {
        totalSessions: total,
        activeSessions: total - expired - idle,
        expiredSessions: expired,
        idleSessions: idle,
        averageSessionAge: avgAge,
        sessionsNearExpiry: nearExpiry,
      };
    } catch (error) {
      console.error('[SessionManager] Error getting session health:', error);
      throw error;
    }
  }

  /**
   * Renew session by updating last activity
   */
  static async renewSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          lastActivityAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      console.error('[SessionManager] Error renewing session:', error);
      return false;
    }
  }

  /**
   * Update session tokens after refresh
   */
  static async updateSessionTokens(
    sessionId: string,
    accessToken: string,
    expiresIn: number,
    refreshToken?: string
  ): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const updateData: any = {
        accessToken,
        expiresAt,
        lastActivityAt: new Date(),
      };

      // Update refresh token if provided
      if (refreshToken) {
        updateData.refreshToken = refreshToken;
        // Set refresh token expiration (typically 60 days)
        updateData.refreshTokenExpiresAt = new Date(
          Date.now() + SESSION_CONFIG.REFRESH_TOKEN_EXPIRY_MS
        );
      }

      await prisma.session.update({
        where: { id: sessionId },
        data: updateData,
      });

      return true;
    } catch (error) {
      console.error('[SessionManager] Error updating session tokens:', error);
      return false;
    }
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<
    Array<{
      id: string;
      createdAt: Date;
      lastActivityAt: Date;
      expiresAt: Date;
    }>
  > {
    try {
      const now = new Date();
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          expiresAt: { gte: now },
          lastActivityAt: {
            gte: new Date(now.getTime() - SESSION_CONFIG.IDLE_TIMEOUT_MS),
          },
        },
        select: {
          id: true,
          createdAt: true,
          lastActivityAt: true,
          expiresAt: true,
        },
        orderBy: {
          lastActivityAt: 'desc',
        },
      });

      return sessions;
    } catch (error) {
      console.error('[SessionManager] Error getting user sessions:', error);
      return [];
    }
  }
}

/**
 * Background session cleanup job
 * Should be called periodically (e.g., every hour)
 */
export async function runSessionCleanupJob(): Promise<CleanupResult> {
  console.log('[SessionCleanupJob] Starting session cleanup...');

  try {
    const result = await SessionManager.cleanupExpiredSessions();

    // Log health stats after cleanup
    const health = await SessionManager.getSessionHealth();
    console.log('[SessionCleanupJob] Session health after cleanup:', health);

    return result;
  } catch (error) {
    console.error('[SessionCleanupJob] Error running cleanup job:', error);
    throw error;
  }
}

/**
 * Start automatic session cleanup
 * Returns a function to stop the cleanup job
 */
export function startSessionCleanup(): () => void {
  console.log(
    `[SessionCleanup] Starting automatic session cleanup (every ${SESSION_CONFIG.CLEANUP_INTERVAL_MS / 1000 / 60} minutes)`
  );

  // Run immediately on start
  runSessionCleanupJob().catch(console.error);

  // Then run periodically
  const intervalId = setInterval(() => {
    runSessionCleanupJob().catch(console.error);
  }, SESSION_CONFIG.CLEANUP_INTERVAL_MS);

  // Return cleanup function
  return () => {
    console.log('[SessionCleanup] Stopping automatic session cleanup');
    clearInterval(intervalId);
  };
}
