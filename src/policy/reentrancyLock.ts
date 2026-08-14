export interface LockEntry {
  startedAt: number;
  payloadHash: string;
}

export class ReentrancyLock {
  private locks: Map<string, LockEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(autoCleanupMs?: number) {
    // Optionally start automatic stale-lock cleanup
    if (autoCleanupMs && autoCleanupMs > 0) {
      this.cleanupInterval = setInterval(() => {
        this.expireStale(autoCleanupMs);
      }, autoCleanupMs);
      // Allow the process to exit even if the interval is running
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Attempt to acquire a lock for the given agent.
   * Returns false if the agent already has an active lock (reentrancy detected).
   */
  acquire(agentKey: string, payloadHash: string): boolean {
    if (this.locks.has(agentKey)) {
      return false;
    }

    this.locks.set(agentKey, {
      startedAt: Date.now(),
      payloadHash,
    });

    return true;
  }

  /**
   * Release the lock for the given agent.
   */
  release(agentKey: string): void {
    this.locks.delete(agentKey);
  }

  /**
   * Check if an agent currently holds a lock.
   */
  isLocked(agentKey: string): boolean {
    return this.locks.has(agentKey);
  }

  /**
   * Get lock info for an agent, or null if not locked.
   */
  getLockInfo(agentKey: string): LockEntry | null {
    return this.locks.get(agentKey) ?? null;
  }

  /**
   * Expire locks that have been held longer than the timeout.
   * Returns the number of expired locks removed.
   */
  expireStale(timeoutMs: number = 5000): number {
    const now = Date.now();
    let expired = 0;

    for (const [agentKey, entry] of this.locks) {
      if (now - entry.startedAt > timeoutMs) {
        this.locks.delete(agentKey);
        expired++;
      }
    }

    return expired;
  }

  /**
   * Returns total number of active locks.
   */
  activeLockCount(): number {
    return this.locks.size;
  }

  /**
   * Clear all locks.
   */
  resetAll(): void {
    this.locks.clear();
  }

  /**
   * Stop the automatic cleanup interval if running.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
