"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface LatencyBucket {
  label: string;
  count: number;
}

export interface FeedEvent {
  id: string;
  type: "intercept" | "pass" | "warn" | "alert";
  timestamp: number;
  data: {
    verdict?: string;
    reason?: string;
    riskScore?: number;
    latencyMs?: number;
    evaluator?: string;
    tokensProcessed?: number;
    tokensSaved?: number;
    dollarsSaved?: number;
    agentId?: string;
    tool?: string;
    toolResultStatus?: number;
  };
}

export interface DashboardStats {
  tokensProcessed: number;
  haltedLoops: number;
  dollarsSaved: number;
  latencyBuckets: LatencyBucket[];
  activeAlert: boolean;
  lastLatencyMs: number | null;
  evaluator: string | null;
  geminiLive: boolean;
}

export interface UseSocketReturn {
  events: FeedEvent[];
  stats: DashboardStats;
  connected: boolean;
}

const LATENCY_LABELS = ["<20ms", "20-50ms", "50-100ms", "100-200ms", ">200ms"];

function getLatencyBucketIndex(ms: number): number {
  if (ms < 20) return 0;
  if (ms < 50) return 1;
  if (ms < 100) return 2;
  if (ms < 200) return 3;
  return 4;
}

function makeEmptyBuckets(): LatencyBucket[] {
  return LATENCY_LABELS.map((label) => ({ label, count: 0 }));
}

function defaultStats(): DashboardStats {
  return {
    tokensProcessed: 0,
    haltedLoops: 0,
    dollarsSaved: 0,
    latencyBuckets: makeEmptyBuckets(),
    activeAlert: false,
    lastLatencyMs: null,
    evaluator: null,
    geminiLive: false,
  };
}

function resolveWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_WS_URL;
  if (explicit) return explicit;
  const port = process.env.NEXT_PUBLIC_PROXY_PORT || "3001";
  const proto =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const host =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `${proto}//${host}:${port}/ws`;
}

export function useBreakwaterSocket(): UseSocketReturn {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processEvent = useCallback((event: FeedEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 100));

    setStats((prev) => {
      const next: DashboardStats = { ...prev };

      if (event.data.tokensProcessed) {
        next.tokensProcessed = prev.tokensProcessed + event.data.tokensProcessed;
      }
      if (event.data.dollarsSaved) {
        next.dollarsSaved = parseFloat(
          (prev.dollarsSaved + event.data.dollarsSaved).toFixed(2),
        );
      }
      if (event.type === "intercept") {
        next.haltedLoops = prev.haltedLoops + 1;
        next.activeAlert = true;
      }
      if (event.data.latencyMs !== undefined) {
        const buckets = prev.latencyBuckets.map((b) => ({ ...b }));
        buckets[getLatencyBucketIndex(event.data.latencyMs)].count += 1;
        next.latencyBuckets = buckets;
        next.lastLatencyMs = event.data.latencyMs;
      }
      if (event.data.evaluator) {
        next.evaluator = event.data.evaluator;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;
      ws = new WebSocket(resolveWsUrl());

      ws.onopen = () => setConnected(true);

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed.type === "hello") {
            setStats((prev) => ({
              ...prev,
              geminiLive: Boolean(parsed.data?.geminiLive),
            }));
            return;
          }
          if (
            parsed.type === "intercept" ||
            parsed.type === "pass" ||
            parsed.type === "warn" ||
            parsed.type === "alert"
          ) {
            processEvent(parsed as FeedEvent);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        setConnected(false);
        ws = null;
        if (!disposed) {
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      ws?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [processEvent]);

  return { events, stats, connected };
}
