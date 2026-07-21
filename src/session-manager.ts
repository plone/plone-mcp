import { PloneService } from "./plone-service.js";

/**
 * Internal interface for session tracking
 */
interface SessionRecord {
  service: PloneService;
  lastAccessed: number;
}

class SessionManager {
  private sessions: Map<string, SessionRecord> = new Map<string, SessionRecord>();

  // Default session TTL: 1 hour (3,600,000 ms)
  private readonly SESSION_TTL = process.env.PLONE_SESSION_TTL
    ? parseInt(process.env.PLONE_SESSION_TTL, 10)
    : 3600000;

  // Cleanup interval: 5 minutes (300,000 ms)
  private readonly CLEANUP_INTERVAL = 300000;

  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    // Cleanup is now explicit. Call startCleanup() to enable it.
  }

  /**
   * Starts a background interval to purge sessions that have been inactive
   * for more than the configured TTL. Recommended for HTTP servers.
   */
  public startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now - session.lastAccessed > this.SESSION_TTL) {
          this.clearSession(sessionId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(
          `[SessionManager] Cleaned up ${cleanedCount} expired sessions.`,
        );
      }
    }, this.CLEANUP_INTERVAL);

    // Ensure the process can exit if this is the only thing running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Stops the background cleanup interval.
   */
  public stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  public getSession(sessionId: string): PloneService {
    const existing = this.sessions.get(sessionId);

    if (existing) {
      existing.lastAccessed = Date.now();
      return existing.service;
    }

    // Initialize with a dummy client; it will be configured later by plone_configure
    const service = new PloneService(null);
    this.sessions.set(sessionId, {
      service,
      lastAccessed: Date.now(),
    });

    return service;
  }

  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export const sessionManager = new SessionManager();
