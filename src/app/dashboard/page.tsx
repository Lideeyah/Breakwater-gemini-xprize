"use client";

import { useSocket } from "./components/SocketContext";
import { useWorkspace } from "../lib/workspace";
import AlertBanner from "./components/AlertBanner";
import LatencyChart from "./components/LatencyChart";
import InterceptFeed from "./components/InterceptFeed";
import LiveDemo from "./components/LiveDemo";

function evaluatorLabel(evaluator: string | null, geminiLive: boolean): string {
  if (evaluator?.includes("gemini")) return "Gemini Flash";
  if (evaluator?.includes("context")) return "Context guard";
  if (evaluator) return "Deterministic";
  return geminiLive ? "Gemini Flash" : "Heuristic engine";
}

export default function Overview() {
  const { events, stats, connected } = useSocket();
  const { workspace } = useWorkspace();
  const latencyLabel =
    stats.lastLatencyMs != null ? `${stats.lastLatencyMs}ms` : "-";

  return (
    <div className="px-5 sm:px-8 py-8 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline text-2xl">Overview</h1>
          <p className="text-[13px] text-muted font-operational mt-1">
            {workspace ? `${workspace.name} · live activity` : "Live activity"}
          </p>
        </div>
        <span className="text-[11px] uppercase tracking-wider font-operational text-muted">
          {connected ? "Circuit breaker active" : "Reconnecting…"}
        </span>
      </div>

      {/* Pitch badges */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge
          label="Status"
          value={connected ? "Active" : "Offline"}
          tone={connected ? "success" : "failure"}
          pulse={connected}
        />
        <Badge
          label="Evaluation latency"
          value={latencyLabel}
          sub={evaluatorLabel(stats.evaluator, stats.geminiLive)}
        />
        <Badge
          label="Projected loss avoided"
          value={`$${stats.dollarsSaved.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          sub="projected"
          tone="money"
        />
      </div>

      <div className="mt-5">
        <AlertBanner active={stats.activeAlert} />
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Projected loss avoided"
          value={`$${stats.dollarsSaved.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          sub="runaway spend intercepted"
          tone="money"
          pulse={stats.dollarsSaved > 0}
        />
        <StatCard
          label="Tokens processed"
          value={stats.tokensProcessed.toLocaleString()}
          sub="forwarded to the model"
        />
        <StatCard
          label="Loops halted"
          value={String(stats.haltedLoops)}
          sub="runaway agents stopped"
          tone={stats.haltedLoops > 0 ? "failure" : "neutral"}
        />
      </div>

      {/* Live protection showcase */}
      <div className="mt-5">
        <LiveDemo />
      </div>

      {/* Chart + feed */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-md border border-border bg-surface">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
              Evaluation latency
            </h3>
          </div>
          <div className="p-5">
            <LatencyChart buckets={stats.latencyBuckets} />
          </div>
        </div>
        <div className="rounded-md border border-border bg-surface max-h-[420px] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
              Live intercept feed
            </h3>
          </div>
          <div className="p-5 flex-1 overflow-hidden">
            <InterceptFeed events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone = "neutral",
  pulse,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  const valueColor =
    tone === "money"
      ? "text-success"
      : tone === "failure"
        ? "text-failure"
        : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface p-5 min-h-[128px] transition-colors duration-150 hover:border-border-strong">
      <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
        {label}
      </p>
      <p
        className={`mt-3 text-3xl font-operational tabular-nums ${valueColor} ${
          pulse ? "node-pulse" : ""
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-2 text-[12px] font-operational text-muted">{sub}</p>
      )}
    </div>
  );
}

type Tone = "success" | "failure" | "neutral" | "money";

function Badge({
  label,
  value,
  sub,
  tone = "neutral",
  pulse,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  const dot =
    tone === "success" || tone === "money"
      ? "bg-success"
      : tone === "failure"
        ? "bg-failure"
        : "bg-secondary";
  const valueColor =
    tone === "money"
      ? "text-success"
      : tone === "failure"
        ? "text-failure"
        : "text-foreground";
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface px-3.5 py-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${dot} ${pulse ? "node-pulse" : ""}`}
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
