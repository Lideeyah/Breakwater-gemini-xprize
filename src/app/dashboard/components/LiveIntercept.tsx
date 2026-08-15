"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "./SocketContext";

// Reacts to REAL intercept events arriving over the WebSocket. When Breakwater
// trips the breaker on a live agent's runaway loop, this plays a one-shot
// dramatic reveal built entirely from the real event: the reason, the projected
// loss avoided, the decision latency and which tier caught it. There is no
// button and nothing simulated - it is the product responding to real traffic.

function fmtLatency(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function tierLabel(evaluator?: string): string {
  if (!evaluator) return "Deterministic tier";
  if (evaluator.includes("gemini")) return "Gemini 2.5 Flash";
  if (evaluator.includes("context")) return "Context guard";
  return "Deterministic tier";
}

export default function LiveIntercept() {
  const { events, connected } = useSocket();
  const latest = events.find((e) => e.type === "intercept");
  const [flashKey, setFlashKey] = useState(0);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (latest && latest.id !== lastId.current) {
      lastId.current = latest.id;
      setFlashKey((k) => k + 1);
    }
  }, [latest]);

  // Idle: monitoring live traffic, nothing to halt yet.
  if (!latest) {
    return (
      <div className="rounded-md border border-border bg-surface px-5 py-6">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "bg-success node-pulse" : "bg-muted"
            }`}
          />
          <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
            {connected ? "Monitoring live agent traffic" : "Connecting to the proxy"}
          </h3>
        </div>
        <p className="mt-2.5 text-[14px] font-operational text-secondary leading-relaxed">
          Breakwater is inspecting every request in front of your agents. When one
          starts a runaway loop, it is halted here in real time.
        </p>
      </div>
    );
  }

  const d = latest.data;
  const dollars = Number(d.dollarsSaved) || 0;

  return (
    <div
      key={flashKey}
      className="relative rounded-md border border-failure/60 bg-surface overflow-hidden"
    >
      <div className="bw-flash absolute inset-0 pointer-events-none" />

      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-failure" />
        <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
          Live intercept · {d.agentId || "agent"}
        </h3>
      </div>

      <div className="bw-slam px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">⛔</span>
          <span className="text-[15px] font-operational text-failure tracking-wide">
            CIRCUIT BREAKER TRIPPED
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
              Loss avoided
            </p>
            <p className="text-[34px] leading-none font-operational text-success tabular-nums">
              ${dollars.toFixed(2)}
            </p>
            <p className="mt-1.5 text-[11px] font-operational text-secondary">
              projected runaway spend
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
              Detected in
            </p>
            <p className="text-[22px] leading-none font-operational text-foreground tabular-nums">
              {fmtLatency(Number(d.latencyMs) || 0)}
            </p>
            <p className="mt-1 text-[11px] font-operational text-secondary">
              {tierLabel(d.evaluator)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[13px] text-secondary leading-relaxed border-t border-border pt-3">
          {d.reason || "Runaway loop halted."}
        </p>
        {d.tool && (
          <p className="mt-2 text-[11px] font-operational text-muted tabular-nums">
            {d.agentId} · {d.tool}
          </p>
        )}
      </div>
    </div>
  );
}
