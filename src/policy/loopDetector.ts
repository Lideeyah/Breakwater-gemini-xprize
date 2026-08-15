import { createHash } from 'crypto';
import { PolicyConfig } from './engine.js';

export interface PayloadFingerprint {
  contentHash: string;
  structuralHash: string;
  tokenCount: number;
  timestamp: number;
}

export type LoopType = 'exact' | 'structural' | 'oscillation' | 'none';

export interface LoopDetectionResult {
  detected: boolean;
  confidence: number;
  loopType: LoopType;
  matchCount: number;
}

interface AgentPayload {
  messages?: Array<{ role?: string; content?: string }>;
  [key: string]: unknown;
}

export class LoopDetector {
  private windows: Map<string, PayloadFingerprint[]> = new Map();
  private config: PolicyConfig;

  constructor(config: PolicyConfig) {
    this.config = config;
  }

  updateConfig(config: PolicyConfig): void {
    this.config = config;
  }

  /**
   * Compute a SHA-256 hash of normalized message text content.
   */
  private computeContentHash(payload: AgentPayload): string {
    const messages = payload.messages ?? [];
    const normalized = messages
      .map((m) => (m.content ?? '').trim().toLowerCase())
      .join('|');
    return createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Compute a structural hash from message count, role sequence,
   * and bucketed content lengths to reduce false positives.
   * Messages with the same roles but widely different lengths
   * produce different structural hashes.
   */
  private computeStructuralHash(payload: AgentPayload): string {
    const messages = payload.messages ?? [];
    const roles = messages.map((m) => m.role ?? 'unknown').join(',');
    // Bucket content lengths into 200-char bands so minor wording
    // changes don't change the hash, but vastly different messages do.
    // 200 chars ≈ 50 tokens - wide enough to avoid false positives
    // on varied normal requests
    const lengthBuckets = messages
      .map((m) => Math.floor((m.content ?? '').length / 200))
      .join(',');
    const structure = `${messages.length}:${roles}:${lengthBuckets}`;
    return createHash('sha256').update(structure).digest('hex');
  }

  /**
   * Estimate token count from payload content (rough: 1 token ≈ 4 chars).
   */
  private estimateTokenCount(payload: AgentPayload): number {
    const messages = payload.messages ?? [];
    const totalChars = messages.reduce(
      (sum, m) => sum + (m.content ?? '').length,
      0,
    );
    return Math.ceil(totalChars / 4);
  }

  /**
   * Detect ABAB or ABCABC oscillation patterns in a sequence of hashes.
   */
  private detectOscillation(hashes: string[]): boolean {
    if (hashes.length < 4) return false;

    // Check ABAB pattern (period 2)
    for (let start = 0; start <= hashes.length - 4; start++) {
      const a = hashes[start];
      const b = hashes[start + 1];
      if (a !== b && hashes[start + 2] === a && hashes[start + 3] === b) {
        return true;
      }
    }

    // Check ABCABC pattern (period 3)
    if (hashes.length >= 6) {
      for (let start = 0; start <= hashes.length - 6; start++) {
        const a = hashes[start];
        const b = hashes[start + 1];
        const c = hashes[start + 2];
        if (
          a !== b &&
          b !== c &&
          a !== c &&
          hashes[start + 3] === a &&
          hashes[start + 4] === b &&
          hashes[start + 5] === c
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyze the current payload against the agent's sliding window of fingerprints.
   */
  detect(agentKey: string, payload: AgentPayload): LoopDetectionResult {
    const now = Date.now();

    // Build fingerprint for current payload
    const fingerprint: PayloadFingerprint = {
      contentHash: this.computeContentHash(payload),
      structuralHash: this.computeStructuralHash(payload),
      tokenCount: this.estimateTokenCount(payload),
      timestamp: now,
    };

    // Get or initialize window
    let window = this.windows.get(agentKey);
    if (!window) {
      window = [];
      this.windows.set(agentKey, window);
    }

    // Add fingerprint to window
    window.push(fingerprint);

    // Trim to configured window size
    while (window.length > this.config.loopWindowSize) {
      window.shift();
    }

    // Not enough data to detect loops
    if (window.length < 3) {
      return { detected: false, confidence: 0, loopType: 'none', matchCount: 0 };
    }

    // Rule 1: Exact content match - 3+ identical contentHash in window
    const contentHashCounts = new Map<string, number>();
    for (const fp of window) {
      contentHashCounts.set(fp.contentHash, (contentHashCounts.get(fp.contentHash) ?? 0) + 1);
    }
    for (const [, count] of contentHashCounts) {
      if (count >= 3) {
        return { detected: true, confidence: 1.0, loopType: 'exact', matchCount: count };
      }
    }

    // Rule 2: Structural match - 3+ identical structuralHash with different content
    const structuralGroups = new Map<string, Set<string>>();
    for (const fp of window) {
      let contentSet = structuralGroups.get(fp.structuralHash);
      if (!contentSet) {
        contentSet = new Set();
        structuralGroups.set(fp.structuralHash, contentSet);
      }
      contentSet.add(fp.contentHash);
    }
    const structuralHashCounts = new Map<string, number>();
    for (const fp of window) {
      structuralHashCounts.set(
        fp.structuralHash,
        (structuralHashCounts.get(fp.structuralHash) ?? 0) + 1,
      );
    }
    for (const [hash, count] of structuralHashCounts) {
      const distinctContent = structuralGroups.get(hash)!.size;
      // Require 5+ structurally identical requests (with distinct content)
      // before flagging as a structural loop. This avoids false positives
      // on normal varied conversations while still catching real patterns
      // like "summarize doc A", "summarize doc B", "summarize doc C"...
      if (count >= 5 && distinctContent > 1) {
        return {
          detected: true,
          confidence: 0.9,
          loopType: 'structural',
          matchCount: count,
        };
      }
    }

    // Rule 3: Oscillation - ABAB or ABCABC pattern in contentHash sequence
    const hashSequence = window.map((fp) => fp.contentHash);
    if (this.detectOscillation(hashSequence)) {
      return { detected: true, confidence: 0.85, loopType: 'oscillation', matchCount: 0 };
    }

    return { detected: false, confidence: 0, loopType: 'none', matchCount: 0 };
  }

  /**
   * Clear the sliding window for a specific agent.
   */
  reset(agentKey: string): void {
    this.windows.delete(agentKey);
  }

  /**
   * Clear all agent windows.
   */
  resetAll(): void {
    this.windows.clear();
  }

  /**
   * Returns the current window size for an agent.
   */
  getWindowSize(agentKey: string): number {
    return this.windows.get(agentKey)?.length ?? 0;
  }
}
