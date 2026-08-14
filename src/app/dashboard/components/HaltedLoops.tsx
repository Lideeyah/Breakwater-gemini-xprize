"use client";

interface SSEEvent {
  id: string;
  type: "intercept" | "pass" | "warn" | "metrics" | "alert";
  timestamp: number;
  data: {
    verdict?: string;
    reason?: string;
    riskScore?: number;
    latencyMs?: number;
    tokensSaved?: number;
    dollarsSaved?: number;
    agentId?: string;
  };
}

export default function HaltedLoops({
  count,
  events,
}: {
  count: number;
  events: SSEEvent[];
}) {
  const interceptEvents = events
    .filter((e) => e.type === "intercept")
    .slice(-20);

  return (
    <div className="rounded-md border border-border bg-surface h-full flex flex-col">
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
          Halted Loops
        </p>
      </div>
      <div className="p-5 flex-1">
        <p
          className={`text-3xl font-operational tabular-nums ${
            count > 0 ? "text-failure" : "text-muted"
          }`}
        >
          {count}
        </p>
        <div className="flex items-end gap-px mt-3 h-8">
          {interceptEvents.length === 0 ? (
            <span className="text-[10px] font-operational text-muted">
              No intercepts yet
            </span>
          ) : (
            interceptEvents.map((event, i) => {
              const score = event.data.riskScore ?? 0.5;
              return (
                <div
                  key={event.id ?? i}
                  className="flex-1 rounded-sm bg-failure/30"
                  style={{ height: `${Math.max(score * 100, 8)}%` }}
                  title={`Risk: ${(score * 100).toFixed(0)}%`}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
