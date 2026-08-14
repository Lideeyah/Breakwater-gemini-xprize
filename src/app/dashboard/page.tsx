"use client";

import { useBreakwaterSocket } from "./hooks/useBreakwaterSocket";
import AlertBanner from "./components/AlertBanner";
import DollarsSaved from "./components/DollarsSaved";
import TokensProcessed from "./components/TokensProcessed";
import HaltedLoops from "./components/HaltedLoops";
import LatencyChart from "./components/LatencyChart";
import InterceptFeed from "./components/InterceptFeed";
import Image from "next/image";

type BadgeTone = "success" | "failure" | "neutral" | "money";

function PitchBadge({
  label,
  value,
  sub,
  tone,
  pulse,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: BadgeTone;
  pulse?: boolean;
}) {
  const dot =
    tone === "success"
      ? "bg-success"
      : tone === "failure"
        ? "bg-failure"
        : tone === "money"
          ? "bg-success"
          : "bg-secondary";
  const valueColor =
    tone === "money"
      ? "text-success"
      : tone === "failure"
        ? "text-failure"
        : "text-foreground";
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface/80 px-3.5 py-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${dot} ${
          pulse ? "node-pulse" : ""
        }`}
      />
      <span className="text-[10px] uppercase tracking-wider font-operational text-muted">
        {label}
      </span>
      <span className={`text-sm font-operational tabular-nums ${valueColor}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[10px] font-operational text-muted">· {sub}</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { events, stats, connected } = useBreakwaterSocket();

  const latencyLabel =
    stats.lastLatencyMs != null ? `${stats.lastLatencyMs}ms` : "—";
  const evaluatorLabel = stats.geminiLive
    ? "Gemini 1.5 Flash"
    : "Heuristic engine";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <Image
              src="/brewing-logo.png"
              alt="Brewing"
              width={32}
              height={32}
              className="opacity-80"
            />
            <div>
              <h1 className="text-headline text-2xl text-foreground">
                BREAKWATER
              </h1>
              <p className="text-[11px] uppercase tracking-wider font-operational text-muted mt-0.5">
                AI Agent Circuit Breaker
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live evaluator + latency badge */}
            <div className="hidden sm:flex items-center gap-2 rounded-md border border-border bg-elevated/50 px-3 py-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  stats.geminiLive ? "bg-success" : "bg-pending"
                }`}
              />
              <span className="text-[10px] uppercase tracking-wider font-operational text-secondary">
                {evaluatorLabel}
              </span>
              <span className="text-[10px] font-operational text-muted tabular-nums">
                · {latencyLabel}
              </span>
            </div>

            {/* Connection status */}
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connected ? "bg-success" : "bg-failure"
                }`}
              />
              <span className="text-[11px] uppercase tracking-wider font-operational text-muted">
                {connected ? "Circuit Breaker Active" : "Disconnected"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Live pitch badges — the three callouts the demo points at on camera */}
      <div className="max-w-7xl mx-auto px-5 pt-5">
        <div className="flex flex-wrap items-center gap-3">
          <PitchBadge
            label="Status"
            value={connected ? "Circuit Breaker Active" : "Offline"}
            tone={connected ? "success" : "failure"}
            pulse={connected}
          />
          <PitchBadge
            label="Evaluation Latency"
            value={latencyLabel}
            sub={stats.geminiLive ? "Gemini 1.5 Flash" : "heuristic"}
            tone="neutral"
          />
          <PitchBadge
            label="Projected Runaway Loss Avoided"
            value={`$${stats.dollarsSaved.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            sub="projected"
            tone="money"
          />
        </div>
      </div>

      {/* Alert Banner — full width */}
      <div className="max-w-7xl mx-auto px-5 pt-4">
        <AlertBanner active={stats.activeAlert} />
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-5 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-1">
            <DollarsSaved amount={stats.dollarsSaved} />
          </div>
          <div>
            <TokensProcessed count={stats.tokensProcessed} />
          </div>
          <div>
            <HaltedLoops count={stats.haltedLoops} events={events} />
          </div>
        </div>

        {/* Two-column: chart + feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-md border border-border bg-surface">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
                Evaluation Latency
              </h3>
              <span className="text-[10px] font-operational text-muted tabular-nums">
                {evaluatorLabel} · {latencyLabel}
              </span>
            </div>
            <div className="p-5">
              <LatencyChart buckets={stats.latencyBuckets} />
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface max-h-[480px] overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-border">
              <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
                Live Intercept Feed
              </h3>
            </div>
            <div className="p-5 flex-1 overflow-hidden">
              <InterceptFeed events={events} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
