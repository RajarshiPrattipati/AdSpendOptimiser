import { startSessionCleanup, SessionManager } from './session-manager';

/**
 * Background Jobs Manager
 *
 * Centralized manager for all background jobs:
 * - Session cleanup
 * - Future: Data sync, notifications, etc.
 */
class BackgroundJobsManager {
  private sessionCleanupStop: (() => void) | null = null;
  private isRunning = false;

  /**
   * Start all background jobs
   */
  start() {
    if (this.isRunning) {
      console.log('[BackgroundJobs] Already running');
      return;
    }

    console.log('[BackgroundJobs] Starting all background jobs...');

    try {
      // Start session cleanup
      this.sessionCleanupStop = startSessionCleanup();

      // Log initial session health
      SessionManager.getSessionHealth()
        .then((health) => {
          console.log('[BackgroundJobs] Initial session health:', health);
        })
        .catch(console.error);

      this.isRunning = true;
      console.log('[BackgroundJobs] All background jobs started successfully');
    } catch (error) {
      console.error('[BackgroundJobs] Error starting background jobs:', error);
      throw error;
    }
  }

  /**
   * Stop all background jobs
   */
  stop() {
    if (!this.isRunning) {
      console.log('[BackgroundJobs] Not running');
      return;
    }

    console.log('[BackgroundJobs] Stopping all background jobs...');

    if (this.sessionCleanupStop) {
      this.sessionCleanupStop();
      this.sessionCleanupStop = null;
    }

    this.isRunning = false;
    console.log('[BackgroundJobs] All background jobs stopped');
  }

  /**
   * Restart all background jobs
   */
  restart() {
    this.stop();
    this.start();
  }

  /**
   * Check if background jobs are running
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: {
        sessionCleanup: this.sessionCleanupStop !== null,
      },
    };
  }
}

// Singleton instance
const backgroundJobsManager = new BackgroundJobsManager();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  backgroundJobsManager.start();
}

// Export singleton
export default backgroundJobsManager;

/**
 * Helper functions for manual job management
 */
export const startBackgroundJobs = () => backgroundJobsManager.start();
export const stopBackgroundJobs = () => backgroundJobsManager.stop();
export const restartBackgroundJobs = () => backgroundJobsManager.restart();
export const getBackgroundJobsStatus = () => backgroundJobsManager.getStatus();
