import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import type { AuthSession } from '@/types';
import { SessionManager, SESSION_CONFIG } from './session-manager';
import { AuditLogger } from './audit-logger';
import { RateLimiter } from './rate-limiter';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: { userId: string; email: string }): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      email: decoded.email,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get user session from Authorization header
 */
export async function getUserFromToken(authHeader: string | null): Promise<AuthSession | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return null;
  }

  // Fetch the latest session
  const session = await prisma.session.findFirst({
    where: {
      userId: decoded.userId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: true,
    },
  });

  if (!session) {
    return null;
  }

  if (!session.refreshToken) {
    console.error('Session missing refresh token');
    return null;
  }

  // Validate session and check for timeouts
  const isValid = await SessionManager.validateAndUpdateSession(session.id);
  if (!isValid) {
    console.log('Session expired or timed out');
    return null;
  }

  // Check if access token is expired and refresh if needed
  let accessToken = session.accessToken;
  if (session.expiresAt <= new Date() && session.refreshToken) {
    const refreshedToken = await refreshAccessToken(session.id);
    if (refreshedToken) {
      accessToken = refreshedToken;
    } else {
      // Token refresh failed, session is invalid
      return null;
    }
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    accessToken,
    refreshToken: session.refreshToken,
  };
}

/**
 * Store OAuth session in database
 */
export async function storeOAuthSession(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number, // seconds
  ipAddress?: string,
  userAgent?: string,
  deviceFingerprint?: string
) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const now = new Date();

  // Calculate refresh token expiration (typically 60 days)
  const refreshTokenExpiresAt = refreshToken
    ? new Date(now.getTime() + SESSION_CONFIG.REFRESH_TOKEN_EXPIRY_MS)
    : null;

  return prisma.session.create({
    data: {
      userId,
      accessToken,
      refreshToken,
      expiresAt,
      refreshTokenExpiresAt,
      lastActivityAt: now,
      ipAddress,
      userAgent,
      deviceFingerprint,
    },
  });
}

/**
 * Find or create user from Google profile
 */
export async function findOrCreateUser(profile: {
  googleId: string;
  email: string;
  name?: string;
}) {
  let user = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
      },
    });
  }

  return user;
}

/**
 * Refresh access token if expired
 */
export async function refreshAccessToken(sessionId: string): Promise<string | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || !session.refreshToken) {
    return null;
  }

  // Check if token is still valid
  if (session.expiresAt > new Date()) {
    return session.accessToken;
  }

  try {
    // Use Google OAuth2 to refresh the access token
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials');
      return null;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: session.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Token refresh failed:', error);

      // If refresh token is invalid or expired, delete the session
      if (error.error === 'invalid_grant') {
        await prisma.session.delete({
          where: { id: sessionId },
        });
      }
      return null;
    }

    const tokens = await response.json();

    // Check rate limit for token refresh
    if (session.userId) {
      const allowed = await RateLimiter.checkTokenRefreshLimit(session.userId);
      if (!allowed) {
        console.warn('[Auth] Token refresh rate limit exceeded');
        await AuditLogger.logRateLimitExceeded(session.userId, 'token-refresh');
        return null;
      }
    }

    // Update session with new tokens using SessionManager
    const success = await SessionManager.updateSessionTokens(
      sessionId,
      tokens.access_token,
      tokens.expires_in,
      tokens.refresh_token
    );

    // Log token refresh
    if (session.userId) {
      await AuditLogger.logTokenRefresh(session.userId, success);
    }

    return success ? tokens.access_token : null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}
