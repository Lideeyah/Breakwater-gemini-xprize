import { PolicyConfig } from './engine.js';

export interface BudgetState {
  totalSpentUsd: number;
  limitUsd: number;
  remainingUsd: number;
  velocity: number; // $/min from last 10 entries
}

export interface BudgetCheckResult {
  allowed: boolean;
  state: BudgetState;
}

interface SpendEntry {
  costUsd: number;
  timestamp: number;
}

export class BudgetGuard {
  private spendLog: Map<string, SpendEntry[]> = new Map();
  private totalSpend: Map<string, number> = new Map();
  private config: PolicyConfig;

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  updateConfig(config: PolicyConfig): void {
    this.config = config;
  }

  /**
   * Check whether the agent can afford the estimated cost.
   */
  check(agentKey: string, estimatedCostUsd: number): BudgetCheckResult {
    const currentSpend = this.totalSpend.get(agentKey) ?? 0;
    const remaining = this.config.budgetLimitUsd - currentSpend;
    const velocity = this.getVelocity(agentKey);

    const state: BudgetState = {
      totalSpentUsd: currentSpend,
      limitUsd: this.config.budgetLimitUsd,
      remainingUsd: Math.max(0, remaining),
      velocity,
    };

    if (currentSpend + estimatedCostUsd > this.config.budgetLimitUsd) {
      return { allowed: false, state };
    }

    return { allowed: true, state };
  }

  /**
   * Record actual cost after an upstream call completes.
   */
  recordCost(agentKey: string, actualCostUsd: number): void {
    const now = Date.now();

    // Update total spend
    const current = this.totalSpend.get(agentKey) ?? 0;
    this.totalSpend.set(agentKey, current + actualCostUsd);

    // Append to spend log
    let log = this.spendLog.get(agentKey);
    if (!log) {
      log = [];
      this.spendLog.set(agentKey, log);
    }
    log.push({ costUsd: actualCostUsd, timestamp: now });

    // Keep only the last 100 entries to bound memory
    if (log.length > 100) {
      log.splice(0, log.length - 100);
    }
  }

  /**
   * Calculate spend velocity ($/min) from the last 10 entries.
   */
  getVelocity(agentKey: string): number {
    const log = this.spendLog.get(agentKey);
    if (!log || log.length < 2) return 0;

    // Take the last 10 entries
    const recent = log.slice(-10);
    if (recent.length < 2) return 0;

    const totalCost = recent.reduce((sum, e) => sum + e.costUsd, 0);
    const timeSpanMs = recent[recent.length - 1].timestamp - recent[0].timestamp;

    if (timeSpanMs <= 0) return 0;

    const timeSpanMin = timeSpanMs / 60_000;
    return totalCost / timeSpanMin;
  }

  /**
   * Get current budget state for an agent without performing a check.
   */
  getState(agentKey: string): BudgetState {
    const currentSpend = this.totalSpend.get(agentKey) ?? 0;
    return {
      totalSpentUsd: currentSpend,
      limitUsd: this.config.budgetLimitUsd,
      remainingUsd: Math.max(0, this.config.budgetLimitUsd - currentSpend),
      velocity: this.getVelocity(agentKey),
    };
  }

  /**
   * Reset spend tracking for a specific agent.
   */
  reset(agentKey: string): void {
    this.spendLog.delete(agentKey);
    this.totalSpend.delete(agentKey);
  }

  /**
   * Reset all spend tracking.
   */
  resetAll(): void {
    this.spendLog.clear();
    this.totalSpend.clear();
  }
}
