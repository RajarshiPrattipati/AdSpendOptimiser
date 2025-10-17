import { PrismaClient, AuditEventType } from '@prisma/client';
import { NextRequest } from 'next/server';

const prisma = new PrismaClient();

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  userId?: string;
  eventType: AuditEventType;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
  metadata?: Record<string, any>;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  message: string;
}

/**
 * Security alert interface
 */
export interface SecurityAlert {
  userId?: string;
  alertType: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Logger Service
 *
 * Comprehensive logging for:
 * - Authentication events
 * - Security violations
 * - Suspicious activity
 * - Rate limit violations
 */
export class AuditLogger {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          eventType: entry.eventType,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          deviceInfo: entry.deviceInfo,
          metadata: entry.metadata || {},
          severity: entry.severity || 'info',
          message: entry.message,
        },
      });

      // Log to console in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[AuditLog] ${entry.eventType}:`, entry.message);
      }

      // Check for security alerts
      if (entry.severity === 'error' || entry.severity === 'critical') {
        await this.checkSecurityAlert(entry);
      }
    } catch (error) {
      console.error('[AuditLogger] Error logging audit event:', error);
    }
  }

  /**
   * Log successful login
   */
  static async logLoginSuccess(
    userId: string,
    request?: NextRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      userId,
      eventType: AuditEventType.LOGIN_SUCCESS,
      ipAddress,
      userAgent,
      metadata,
      severity: 'info',
      message: `User logged in successfully from ${ipAddress || 'unknown IP'}`,
    });
  }

  /**
   * Log failed login attempt
   */
  static async logLoginFailed(
    email: string,
    reason: string,
    request?: NextRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      eventType: AuditEventType.LOGIN_FAILED,
      ipAddress,
      userAgent,
      metadata: { ...metadata, email, reason },
      severity: 'warning',
      message: `Login failed for ${email}: ${reason}`,
    });

    // Check for brute force attempts
    await this.detectBruteForce(email, ipAddress);
  }

  /**
   * Log logout
   */
  static async logLogout(
    userId: string,
    request?: NextRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      userId,
      eventType: AuditEventType.LOGOUT,
      ipAddress,
      userAgent,
      metadata,
      severity: 'info',
      message: 'User logged out',
    });
  }

  /**
   * Log token refresh
   */
  static async logTokenRefresh(
    userId: string,
    success: boolean,
    request?: NextRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      userId,
      eventType: success
        ? AuditEventType.TOKEN_REFRESH_SUCCESS
        : AuditEventType.TOKEN_REFRESH_FAILED,
      ipAddress,
      userAgent,
      metadata,
      severity: success ? 'info' : 'warning',
      message: success ? 'Token refreshed successfully' : 'Token refresh failed',
    });
  }

  /**
   * Log session timeout
   */
  static async logSessionTimeout(
    userId: string,
    sessionId: string,
    reason: string
  ): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.SESSION_TIMEOUT,
      metadata: { sessionId, reason },
      severity: 'info',
      message: `Session timed out: ${reason}`,
    });
  }

  /**
   * Log session expiration
   */
  static async logSessionExpired(userId: string, sessionId: string): Promise<void> {
    await this.log({
      userId,
      eventType: AuditEventType.SESSION_EXPIRED,
      metadata: { sessionId },
      severity: 'info',
      message: 'Session expired',
    });
  }

  /**
   * Log rate limit exceeded
   */
  static async logRateLimitExceeded(
    identifier: string,
    endpoint: string,
    request?: NextRequest
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      eventType: AuditEventType.RATE_LIMIT_EXCEEDED,
      ipAddress,
      userAgent,
      metadata: { identifier, endpoint },
      severity: 'warning',
      message: `Rate limit exceeded for ${identifier} on ${endpoint}`,
    });
  }

  /**
   * Log unauthorized access attempt
   */
  static async logUnauthorizedAccess(
    resource: string,
    request?: NextRequest,
    userId?: string
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      userId,
      eventType: AuditEventType.UNAUTHORIZED_ACCESS,
      ipAddress,
      userAgent,
      metadata: { resource },
      severity: 'error',
      message: `Unauthorized access attempt to ${resource}`,
    });
  }

  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    description: string,
    request?: NextRequest,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const { ipAddress, userAgent } = this.extractRequestInfo(request);

    await this.log({
      userId,
      eventType: AuditEventType.SUSPICIOUS_ACTIVITY,
      ipAddress,
      userAgent,
      metadata,
      severity: 'critical',
      message: `Suspicious activity detected: ${description}`,
    });
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      });

      return logs;
    } catch (error) {
      console.error('[AuditLogger] Error fetching user audit logs:', error);
      return [];
    }
  }

  /**
   * Get recent security events
   */
  static async getSecurityEvents(
    severity: 'warning' | 'error' | 'critical',
    limit: number = 50
  ): Promise<any[]> {
    try {
      const events = await prisma.auditLog.findMany({
        where: {
          severity,
          eventType: {
            in: [
              AuditEventType.LOGIN_FAILED,
              AuditEventType.SUSPICIOUS_ACTIVITY,
              AuditEventType.RATE_LIMIT_EXCEEDED,
              AuditEventType.UNAUTHORIZED_ACCESS,
            ],
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return events;
    } catch (error) {
      console.error('[AuditLogger] Error fetching security events:', error);
      return [];
    }
  }

  /**
   * Detect brute force login attempts
   */
  private static async detectBruteForce(
    email: string,
    ipAddress?: string
  ): Promise<void> {
    if (!ipAddress) return;

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Count failed login attempts from this IP in the last 15 minutes
    const failedAttempts = await prisma.auditLog.count({
      where: {
        eventType: AuditEventType.LOGIN_FAILED,
        ipAddress,
        timestamp: {
          gte: fifteenMinutesAgo,
        },
      },
    });

    // If more than 5 failed attempts, log as suspicious activity
    if (failedAttempts > 5) {
      await this.logSuspiciousActivity(
        `Possible brute force attack detected from IP ${ipAddress}`,
        undefined,
        undefined,
        {
          email,
          ipAddress,
          failedAttempts,
          timeWindow: '15 minutes',
        }
      );
    }
  }

  /**
   * Check for security alerts
   */
  private static async checkSecurityAlert(entry: AuditLogEntry): Promise<void> {
    // In a production system, this would send alerts via:
    // - Email
    // - Slack/Discord webhooks
    // - PagerDuty
    // - etc.

    if (entry.severity === 'critical') {
      console.error('[SECURITY ALERT]', entry.message, entry.metadata);
    }
  }

  /**
   * Extract request information
   */
  private static extractRequestInfo(request?: NextRequest): {
    ipAddress?: string;
    userAgent?: string;
  } {
    if (!request) {
      return {};
    }

    // Get IP address from headers
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Get user agent
    const userAgent = request.headers.get('user-agent') || undefined;

    return { ipAddress, userAgent };
  }

  /**
   * Clean up old audit logs (e.g., older than 90 days)
   */
  static async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
          severity: {
            in: ['info', 'warning'], // Keep errors and critical logs longer
          },
        },
      });

      console.log(`[AuditLogger] Cleaned up ${result.count} old audit logs`);
      return result.count;
    } catch (error) {
      console.error('[AuditLogger] Error cleaning up old logs:', error);
      return 0;
    }
  }
}
