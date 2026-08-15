import { createHash } from 'crypto';
import { RateLimiter } from './rateLimiter.js';
import { LoopDetector } from './loopDetector.js';
import { BudgetGuard } from './budgetGuard.js';
import { ReentrancyLock } from './reentrancyLock.js';

export interface PolicyConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  budgetLimitUsd: number;
  loopThreshold: number;
  loopWindowSize: number;
}

export interface PolicyVerdict {
  blocked: boolean;
  violations: string[];
  metadata: {
    rateLimitRemaining: number;
    budgetRemaining: number;
    loopConfidence: number;
    reentrancyDetected: boolean;
  };
}

interface PolicyPayload {
  headers?: Record<string, string | undefined>;
  ip?: string;
  messages?: Array<{ role?: string; content?: string }>;
  estimatedTokens?: number;
  estimatedCostUsd?: number;
  [key: string]: unknown;
}

interface PolicyMetrics {
  totalEvaluations: number;
  totalBlocked: number;
  violationCounts: Record<string, number>;
}

const DEFAULT_CONFIG: PolicyConfig = {
  maxRequestsPerMinute: 60,
  maxTokensPerMinute: 100_000,
  budgetLimitUsd: 50.0,
  loopThreshold: 0.85,
  loopWindowSize: 10,
};

/**
 * Breakwater Policy Engine - deterministic rule-based evaluation layer.
 *
 * Runs rate limiting, loop detection, budget enforcement, and reentrancy
 * checks in sequence BEFORE any AI-based evaluation. If ANY check fails
 * the request is blocked.
 */
export class PolicyEngine {
  private static config: PolicyConfig = { ...DEFAULT_CONFIG };
  private static rateLimiter: RateLimiter = new RateLimiter(PolicyEngine.config);
  private static loopDetector: LoopDetector = new LoopDetector(PolicyEngine.config);
  private static budgetGuard: BudgetGuard = new BudgetGuard(PolicyEngine.config);
  private static reentrancyLock: ReentrancyLock = new ReentrancyLock(5000);

  private static metrics: PolicyMetrics = {
    totalEvaluations: 0,
    totalBlocked: 0,
    violationCounts: {},
  };

  /**
   * Extract the agent key from the payload.
   * Prefers x-agent-id header, falls back to IP, then "anonymous".
   */
  private static resolveAgentKey(payload: PolicyPayload): string {
    const headers = payload.headers ?? {};
    const agentId = headers['x-agent-id'];
    if (agentId && agentId.trim().length > 0) {
      return agentId.trim();
    }
    if (payload.ip && payload.ip.trim().length > 0) {
      return payload.ip.trim();
    }
    return 'anonymous';
  }

  /**
   * Compute a SHA-256 hash of the entire payload for reentrancy comparison.
   */
  private static hashPayload(payload: PolicyPayload): string {
    const serialized = JSON.stringify(payload.messages ?? {});
    return createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Run all policy checks against the incoming payload.
   * Returns a verdict indicating whether the request is blocked and why.
   */
  static evaluate(payload: PolicyPayload): PolicyVerdict {
    PolicyEngine.metrics.totalEvaluations++;

    const agentKey = PolicyEngine.resolveAgentKey(payload);
    const violations: string[] = [];
    let rateLimitRemaining = 0;
    let budgetRemaining = PolicyEngine.config.budgetLimitUsd;
    let loopConfidence = 0;
    let reentrancyDetected = false;

    const estimatedTokens = payload.estimatedTokens ?? 0;
    const estimatedCostUsd = payload.estimatedCostUsd ?? 0;

    // 1. Reentrancy check
    const payloadHash = PolicyEngine.hashPayload(payload);
    const acquired = PolicyEngine.reentrancyLock.acquire(agentKey, payloadHash);
    if (!acquired) {
      reentrancyDetected = true;
      violations.push(
        `Reentrancy detected: agent "${agentKey}" already has an evaluation in progress`,
      );
    }

    // 2. Rate limit check
    const rateResult = PolicyEngine.rateLimiter.check(agentKey, estimatedTokens);
    rateLimitRemaining = rateResult.remaining;
    if (!rateResult.allowed) {
      violations.push(
        `Rate limit exceeded for agent "${agentKey}": limit is ${PolicyEngine.config.maxRequestsPerMinute} req/min and ${PolicyEngine.config.maxTokensPerMinute} tokens/min (resets at ${new Date(rateResult.resetAt).toISOString()})`,
      );
    }

    // 3. Budget check
    const budgetResult = PolicyEngine.budgetGuard.check(agentKey, estimatedCostUsd);
    budgetRemaining = budgetResult.state.remainingUsd;
    if (!budgetResult.allowed) {
      violations.push(
        `Budget limit exceeded for agent "${agentKey}": $${budgetResult.state.totalSpentUsd.toFixed(2)} spent of $${budgetResult.state.limitUsd.toFixed(2)} limit (velocity: $${budgetResult.state.velocity.toFixed(4)}/min)`,
      );
    }

    // 4. Loop detection
    const loopResult = PolicyEngine.loopDetector.detect(agentKey, payload);
    loopConfidence = loopResult.confidence;
    if (loopResult.detected && loopResult.confidence >= PolicyEngine.config.loopThreshold) {
      violations.push(
        `Loop detected for agent "${agentKey}": type="${loopResult.loopType}", confidence=${loopResult.confidence}, matches=${loopResult.matchCount}`,
      );
    }

    const blocked = violations.length > 0;

    if (blocked) {
      PolicyEngine.metrics.totalBlocked++;
      for (const v of violations) {
        // Extract category from violation message
        const category = v.split(' ')[0].toLowerCase();
        PolicyEngine.metrics.violationCounts[category] =
          (PolicyEngine.metrics.violationCounts[category] ?? 0) + 1;
      }
    }

    // Release reentrancy lock if we acquired it (caller should re-release after upstream completes)
    // For blocked requests we release immediately since no upstream call will happen.
    if (acquired && blocked) {
      PolicyEngine.reentrancyLock.release(agentKey);
    }

    return {
      blocked,
      violations,
      metadata: {
        rateLimitRemaining,
        budgetRemaining,
        loopConfidence,
        reentrancyDetected,
      },
    };
  }

  /**
   * Release the reentrancy lock for an agent after upstream processing completes.
   * Call this after the Gemini AI evaluation finishes, regardless of outcome.
   */
  static releaseAgent(payload: PolicyPayload): void {
    const agentKey = PolicyEngine.resolveAgentKey(payload);
    PolicyEngine.reentrancyLock.release(agentKey);
  }

  /**
   * Record actual cost after an upstream call completes.
   */
  static recordCost(payload: PolicyPayload, actualCostUsd: number): void {
    const agentKey = PolicyEngine.resolveAgentKey(payload);
    PolicyEngine.budgetGuard.recordCost(agentKey, actualCostUsd);
  }

  /**
   * Reset the loop detection window for an agent (e.g., after user intervention).
   */
  static resetLoopWindow(payload: PolicyPayload): void {
    const agentKey = PolicyEngine.resolveAgentKey(payload);
    PolicyEngine.loopDetector.reset(agentKey);
  }

  /**
   * Update the policy configuration. Propagates to all sub-modules.
   */
  static updateConfig(newConfig: Partial<PolicyConfig>): void {
    PolicyEngine.config = { ...PolicyEngine.config, ...newConfig };
    PolicyEngine.rateLimiter.updateConfig(PolicyEngine.config);
    PolicyEngine.loopDetector.updateConfig(PolicyEngine.config);
    PolicyEngine.budgetGuard.updateConfig(PolicyEngine.config);
  }

  /**
   * Get the current policy configuration.
   */
  static getConfig(): Readonly<PolicyConfig> {
    return { ...PolicyEngine.config };
  }

  /**
   * Get engine-wide metrics.
   */
  static getMetrics(): PolicyMetrics {
    return {
      totalEvaluations: PolicyEngine.metrics.totalEvaluations,
      totalBlocked: PolicyEngine.metrics.totalBlocked,
      violationCounts: { ...PolicyEngine.metrics.violationCounts },
    };
  }

  /**
   * Reset all engine state. Useful for testing.
   */
  static reset(): void {
    PolicyEngine.config = { ...DEFAULT_CONFIG };
    PolicyEngine.rateLimiter = new RateLimiter(PolicyEngine.config);
    PolicyEngine.loopDetector = new LoopDetector(PolicyEngine.config);
    PolicyEngine.budgetGuard = new BudgetGuard(PolicyEngine.config);
    PolicyEngine.reentrancyLock.destroy();
    PolicyEngine.reentrancyLock = new ReentrancyLock(5000);
    PolicyEngine.metrics = {
      totalEvaluations: 0,
      totalBlocked: 0,
      violationCounts: {},
    };
  }
}
