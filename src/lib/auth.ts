import jwt from 'jsonwebtoken';
import { prisma } from './prisma';
import type { AuthSession } from '@/types';

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
export function verifyToken(token: string): AuthSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      userId: decoded.userId,
      email: decoded.email,
      accessToken: '', // Will be fetched from database
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

  // Fetch the latest session with valid access token
  const session = await prisma.session.findFirst({
    where: {
      userId: decoded.userId,
      expiresAt: {
        gt: new Date(),
      },
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

  return {
    userId: session.user.id,
    email: session.user.email,
    accessToken: session.accessToken,
  };
}

/**
 * Store OAuth session in database
 */
export async function storeOAuthSession(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresIn: number // seconds
) {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return prisma.session.create({
    data: {
      userId,
      accessToken,
      refreshToken,
      expiresAt,
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

  // Check if token is expired
  if (session.expiresAt > new Date()) {
    return session.accessToken;
  }

  try {
    // TODO: Implement refresh token logic with Google OAuth
    // For now, return null to indicate token needs re-authentication
    return null;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}
