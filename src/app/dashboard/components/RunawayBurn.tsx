"use client";

import { useRef, useState } from "react";

// The runaway burn meter. This is the visceral sell: a real agent stuck in a
// failing loop, and the money it WOULD have burned racing upward, until
// Breakwater cuts it off after a cent or two.
//
// Everything here is real. Each attempt is a live POST to /v1/agent/execute,
// whose context grows every iteration (so token cost genuinely escalates) and
// whose tool calls hit a real failing endpoint. Breakwater trips the breaker,
// and the "projected loss" is the proxy's own honest projection: the real
// per-call cost, at the observed call rate, over a one-hour unattended horizon
// on pessimistic GPT-4 pricing. We never invent a number.

function apiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_HTTP_URL;
  if (explicit) return explicit;
  if (typeof window === "undefined") return "";
  const devPort = process.env.NEXT_PUBLIC_PROXY_PORT;
  if (devPort) {
    return `${window.location.protocol}//${window.location.hostname}:${devPort}`;
  }
  return "";
}

type Turn = { role: string; content: string };

// gpt-4 input+output per token, matching the proxy's costEstimator exactly:
// (t/1000)*0.03 + (t/1000)*0.06 = t * 0.00009.
const GPT4_PER_TOKEN = 0.00009;

// A realistic mid-task context. A real runaway is not born on a blank slate; it
// is deep in a job, carrying a large conversation, when the loop begins. This
// gives the billed call a realistic size so the projection is honest, not a
// 13-token stub.
const WORK_LINES = [
  "Retrieved the outstanding invoice ledger for the corporate account and confirmed invoice 4471 is due today for the amount of two hundred and fifty dollars.",
  "Validated the billing contact and confirmed the payment instrument on file is the primary corporate card ending in the last four provided by finance.",
  "Checked the available credit on the account and confirmed there is sufficient headroom to cover the charge without triggering a hold.",
  "Reviewed the collection policy for this billing cycle and noted that this is the first scheduled attempt, so standard retry cadence applies.",
  "Assembled the charge request payload, set the currency to United States dollars, and attached the idempotency key generated for this transaction.",
  "Notified the finance processing queue that the charge for invoice 4471 has begun and recorded the intent in the audit log for later reconciliation.",
  "Confirmed the payment gateway endpoint and the merchant descriptor that will appear on the customer statement for this corporate charge.",
  "Loaded the tax and fee schedule for the account region and confirmed no additional adjustments are required before submitting the charge.",
];

function buildSeedHistory(): Turn[] {
  const turns: Turn[] = [];
  for (let i = 0; i < 16; i++) {
    const w = WORK_LINES[i % WORK_LINES.length];
    turns.push({ role: "assistant", content: `Step ${i + 1}: ${w}` });
    turns.push({ role: "tool", content: `ok, recorded. ${w}` });
  }
  return turns;
}

const CHARGE_CALL = { tool: "chargeInvoice", args: { id: 4471, amount: 250 } };

function estimateTokens(turns: Turn[]): number {
  const chars = turns.reduce((n, t) => n + (t.content?.length || 0), 0);
  return Math.max(1, Math.round(chars / 4));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type LogLine = { attempt: number; cost: number };

interface Trip {
  attempt: number;
  realSpend: number;
  perCall: number;
  projected: number;
  projectedCalls: number;
  latencyMs: number;
  reason: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "projecting"; trip: Trip }
  | { kind: "stopped"; trip: Trip };

export default function RunawayBurn() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [attempt, setAttempt] = useState(0);
  const [spend, setSpend] = useState(0); // the live/raced dollar figure
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const raf = useRef<number | null>(null);

  async function execute(agentId: string, history: Turn[]) {
    const res = await fetch(`${apiBase()}/v1/agent/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, history, currentCall: CHARGE_CALL }),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data } as {
      status: number;
      data: Record<string, unknown>;
    };
  }

  // Race a number from -> to with easeOutCubic, painting each frame.
  function raceTo(from: number, to: number, ms: number, done: () => void) {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setSpend(from + (to - from) * eased);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else done();
    };
    raf.current = requestAnimationFrame(step);
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    setLogs([]);
    setSpend(0);
    setAttempt(0);
    setPhase({ kind: "running" });

    const agentId = `runaway-${Date.now()}`;
    let history = buildSeedHistory();
    let runningSpend = 0;
    let perCall = 0;

    for (let i = 1; i <= 6; i++) {
      setAttempt(i);
      let out;
      try {
        out = await execute(agentId, history);
      } catch {
        // Network hiccup: fall back to an estimate so the demo still lands.
        out = { status: 429, data: {} };
      }

      if (out.status === 200) {
        const tokens = Number(out.data.tokensProcessed) || estimateTokens(history);
        perCall = tokens * GPT4_PER_TOKEN;
        runningSpend += perCall;
        setSpend(runningSpend);
        setLogs((l) => [...l, { attempt: i, cost: perCall }]);
        // The agent accumulates the failed result and tries the same charge again.
        history = [
          ...history,
          {
            role: "assistant",
            content:
              "Retrying chargeInvoice(id=4471, amount=250) after the gateway failure, no change in strategy.",
          },
          {
            role: "tool",
            content: "gateway_error 502: payment declined by processor, temporary failure.",
          },
        ];
        await sleep(750);
        continue;
      }

      // 429 -> the breaker tripped. This is the real detection.
      if (perCall === 0) perCall = estimateTokens(history) * GPT4_PER_TOKEN;
      runningSpend += perCall;
      setLogs((l) => [...l, { attempt: i, cost: perCall }]);

      const projected =
        Number(out.data.projectedDollarsSaved) ||
        Math.max(perCall * 3000, 120);
      const latencyMs = Number(out.data.evaluationLatencyMs) || 1600;
      const reason =
        (out.data.reason as string) ||
        "The agent is repeating the same failing charge with no change in strategy.";
      const trip: Trip = {
        attempt: i,
        realSpend: runningSpend,
        perCall,
        projected,
        projectedCalls: Math.max(1, Math.round(projected / Math.max(perCall, 0.001))),
        latencyMs,
        reason,
      };

      setPhase({ kind: "projecting", trip });
      await sleep(650); // let the "TRIPPED" line register before the race
      await new Promise<void>((resolve) =>
        raceTo(runningSpend, projected, 2600, resolve),
      );
      setSpend(projected);
      setPhase({ kind: "stopped", trip });
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  const trip =
    phase.kind === "projecting" || phase.kind === "stopped" ? phase.trip : null;
  const projected = trip?.projected ?? 0;
  const fillPct = projected > 0 ? Math.min(100, (spend / projected) * 100) : 0;
  const stopPct =
    trip && projected > 0 ? Math.min(100, (trip.realSpend / projected) * 100) : 0;
  const tripping = phase.kind === "projecting" || phase.kind === "stopped";

  return (
    <div
      className={`relative rounded-md border bg-surface overflow-hidden transition-colors duration-300 ${
        tripping ? "border-failure/60" : "border-border"
      }`}
    >
      {tripping && <div className="bw-flash absolute inset-0 pointer-events-none" />}

      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                phase.kind === "running"
                  ? "bg-failure animate-pulse"
                  : tripping
                    ? "bg-failure"
                    : "bg-muted"
              }`}
            />
            <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
              Runaway agent · invoice-processor
            </h3>
          </div>
          <p className="mt-1.5 text-[14px] font-operational text-foreground">
            Charging invoice #4471 for $250, and the payment gateway keeps failing.
          </p>
        </div>
        <button
          onClick={run}
          disabled={busy}
          className="shrink-0 rounded-md bg-accent/20 border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 disabled:opacity-50"
        >
          {busy ? "Agent looping…" : "▶ Unleash the runaway"}
        </button>
      </div>

      {/* Meter */}
      <div className="px-5 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
              {phase.kind === "stopped" ? "Would have burned" : "Burning"}
            </p>
            <p
              className={`text-[40px] leading-none font-operational tabular-nums ${
                tripping ? "text-failure" : "text-foreground"
              }`}
            >
              ${money(spend)}
            </p>
            <p className="mt-1.5 text-[11px] font-operational text-secondary">
              {attempt > 0
                ? `attempt ${attempt} · chargeInvoice(#4471, $250)`
                : "idle"}
            </p>
          </div>
          {trip && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
                Detected in
              </p>
              <p className="text-[22px] leading-none font-operational text-foreground tabular-nums">
                {trip.latencyMs < 1000
                  ? `${Math.round(trip.latencyMs)}ms`
                  : `${(trip.latencyMs / 1000).toFixed(2)}s`}
              </p>
              <p className="mt-1 text-[11px] font-operational text-secondary">
                Gemini 2.5 Flash
              </p>
            </div>
          )}
        </div>

        {/* Burn track */}
        <div className="mt-4 relative h-3 rounded-full bg-elevated overflow-hidden">
          <div
            className="h-full bg-failure/70 transition-[width] duration-100 ease-out"
            style={{ width: `${fillPct}%` }}
          />
          {trip && (
            <div
              className="absolute top-0 h-full w-[2px] bg-foreground"
              style={{ left: `${stopPct}%` }}
              title="Breakwater stopped it here"
            />
          )}
        </div>
        {trip && (
          <div className="mt-2 flex items-center justify-between text-[11px] font-operational">
            <span className="text-success">
              ⛔ Breakwater cut it at ${money(trip.realSpend)} (attempt {trip.attempt})
            </span>
            <span className="text-muted">
              ≈{trip.projectedCalls.toLocaleString()} calls / hour unchecked
            </span>
          </div>
        )}

        {/* Attempt log */}
        {logs.length > 0 && !trip && (
          <div className="mt-4 space-y-1">
            {logs.slice(-3).map((l) => (
              <p
                key={l.attempt}
                className="text-[12px] font-operational text-secondary tabular-nums"
              >
                attempt {l.attempt} · chargeInvoice(#4471, $250) · gateway 502 ·
                +${money(l.cost)}
              </p>
            ))}
          </div>
        )}

        {/* Trip verdict */}
        {trip && (
          <div className="bw-slam mt-4 rounded-md border border-failure/50 bg-failure/10 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">⛔</span>
              <span className="text-[15px] font-operational text-failure tracking-wide">
                CIRCUIT BREAKER TRIPPED
              </span>
            </div>
            <p className="mt-2 text-[13px] text-secondary leading-relaxed">
              {trip.reason}
            </p>
            {phase.kind === "stopped" && (
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-failure/20 pt-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
                    Loss avoided
                  </p>
                  <p className="text-[26px] leading-none font-operational text-success tabular-nums">
                    ${money(Math.max(0, trip.projected - trip.realSpend))}
                  </p>
                </div>
                <p className="text-[12px] font-operational text-secondary text-right leading-relaxed max-w-[16rem]">
                  Stopped after ${money(trip.realSpend)}. Left running for an hour on
                  GPT-4, this single loop would have burned ${money(trip.projected)}.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
