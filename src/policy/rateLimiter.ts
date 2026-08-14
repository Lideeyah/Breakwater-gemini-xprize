import { PolicyConfig } from './engine.js';

interface RateLimitEntry {
  timestamp: number;
  tokens: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class RateLimiter {
  private requestLog: Map<string, RateLimitEntry[]> = new Map();
  private config: PolicyConfig;

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  updateConfig(config: PolicyConfig): void {
    this.config = config;
  }

  check(agentKey: string, estimatedTokens: number): RateLimitResult {
    const now = Date.now();
    const windowMs = 60_000;
    const windowStart = now - windowMs;

    // Get or initialize log for this agent
    let entries = this.requestLog.get(agentKey);
    if (!entries) {
      entries = [];
      this.requestLog.set(agentKey, entries);
    }

    // Prune expired entries outside the sliding window
    const activeEntries = entries.filter((e) => e.timestamp > windowStart);
    this.requestLog.set(agentKey, activeEntries);

    // Count requests and tokens in the current window
    const requestCount = activeEntries.length;
    const tokenCount = activeEntries.reduce((sum, e) => sum + e.tokens, 0);

    // Determine the earliest reset time (when the oldest entry expires)
    const resetAt =
      activeEntries.length > 0
        ? activeEntries[0].timestamp + windowMs
        : now + windowMs;

    // Check request rate limit
    if (requestCount >= this.config.maxRequestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Check token rate limit
    if (tokenCount + estimatedTokens > this.config.maxTokensPerMinute) {
      return {
        allowed: false,
        remaining: Math.max(0, this.config.maxTokensPerMinute - tokenCount),
        resetAt,
      };
    }

    // Record this request
    activeEntries.push({ timestamp: now, tokens: estimatedTokens });

    const remainingRequests = this.config.maxRequestsPerMinute - requestCount - 1;
    const remainingTokens =
      this.config.maxTokensPerMinute - tokenCount - estimatedTokens;

    return {
      allowed: true,
      remaining: Math.min(remainingRequests, remainingTokens),
      resetAt,
    };
  }

  /**
   * Returns metrics snapshot for the given agent.
   */
  getMetrics(agentKey: string): { requestsInWindow: number; tokensInWindow: number } {
    const now = Date.now();
    const windowStart = now - 60_000;
    const entries = this.requestLog.get(agentKey) ?? [];
    const active = entries.filter((e) => e.timestamp > windowStart);
    return {
      requestsInWindow: active.length,
      tokensInWindow: active.reduce((sum, e) => sum + e.tokens, 0),
    };
  }

  /**
   * Clears all tracking data. Useful for testing.
   */
  reset(): void {
    this.requestLog.clear();
  }
}
