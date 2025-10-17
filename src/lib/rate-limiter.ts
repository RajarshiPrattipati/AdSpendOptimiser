import { AuditLogger } from './audit-logger';
import { NextRequest } from 'next/server';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limit store
 * In production, use Redis or similar distributed cache
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate Limiter Service
 *
 * Prevents abuse by limiting requests:
 * - Login attempts
 * - Token refresh
 * - API calls
 */
export class RateLimiter {
  /**
   * Default rate limit configurations
   */
  static readonly CONFIGS = {
    LOGIN: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 login attempts per 15 minutes
    },
    TOKEN_REFRESH: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 refreshes per minute
    },
    API_GENERAL: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100, // 100 requests per minute
    },
    API_HEAVY: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 heavy requests per minute (e.g., reports)
    },
  };

  /**
   * Check if rate limit is exceeded
   */
  static async checkLimit(
    identifier: string,
    config: RateLimitConfig,
    endpoint?: string,
    request?: NextRequest
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const key = identifier;

    // Get or create entry
    let entry = rateLimitStore.get(key);

    // Reset if window expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
    }

    // Increment count
    entry.count++;
    rateLimitStore.set(key, entry);

    const allowed = entry.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count);

    // Log if rate limit exceeded
    if (!allowed && endpoint) {
      await AuditLogger.logRateLimitExceeded(identifier, endpoint, request);
    }

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Check login rate limit
   */
  static async checkLoginLimit(
    email: string,
    ipAddress: string,
    request?: NextRequest
  ): Promise<boolean> {
    // Check both email and IP-based limits
    const emailLimit = await this.checkLimit(
      `login:email:${email}`,
      this.CONFIGS.LOGIN,
      'login',
      request
    );

    const ipLimit = await this.checkLimit(
      `login:ip:${ipAddress}`,
      this.CONFIGS.LOGIN,
      'login',
      request
    );

    return emailLimit.allowed && ipLimit.allowed;
  }

  /**
   * Check token refresh rate limit
   */
  static async checkTokenRefreshLimit(
    userId: string,
    request?: NextRequest
  ): Promise<boolean> {
    const result = await this.checkLimit(
      `refresh:${userId}`,
      this.CONFIGS.TOKEN_REFRESH,
      'token-refresh',
      request
    );

    return result.allowed;
  }

  /**
   * Check API rate limit
   */
  static async checkApiLimit(
    userId: string,
    endpoint: string,
    heavy: boolean = false,
    request?: NextRequest
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const config = heavy ? this.CONFIGS.API_HEAVY : this.CONFIGS.API_GENERAL;

    return this.checkLimit(`api:${userId}:${endpoint}`, config, endpoint, request);
  }

  /**
   * Reset rate limit for an identifier
   */
  static resetLimit(identifier: string): void {
    rateLimitStore.delete(identifier);
  }

  /**
   * Clear all rate limits (for testing)
   */
  static clearAll(): void {
    rateLimitStore.clear();
  }

  /**
   * Cleanup expired entries
   */
  static cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of Array.from(rateLimitStore.entries())) {
      if (now >= entry.resetTime) {
        rateLimitStore.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get rate limit status
   */
  static getStatus(identifier: string): RateLimitEntry | null {
    return rateLimitStore.get(identifier) || null;
  }
}

// Cleanup expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = RateLimiter.cleanup();
    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
    }
  }, 5 * 60 * 1000);
}
