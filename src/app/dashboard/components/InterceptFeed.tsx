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

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type EventType = SSEEvent["type"];

function pillClasses(type: EventType): string {
  switch (type) {
    case "intercept":
    case "alert":
      return "bg-failure/10 border border-failure/30 text-failure";
    case "warn":
      return "bg-pending/10 border border-pending/30 text-pending";
    case "pass":
      return "bg-success/10 border border-success/30 text-success";
    default:
      return "bg-surface border border-border text-muted";
  }
}

function rowAccent(type: EventType): string {
  switch (type) {
    case "intercept":
      return "border-l-2 border-l-failure bg-failure/5";
    case "warn":
      return "border-l-2 border-l-pending bg-pending/5";
    case "pass":
      return "border-l-2 border-l-success bg-success/5";
    default:
      return "border-l-2 border-l-border bg-elevated/50";
  }
}

function riskBarColor(score: number): string {
  if (score > 0.7) return "bg-failure";
  if (score > 0.4) return "bg-pending";
  return "bg-success";
}

export default function InterceptFeed({ events }: { events: SSEEvent[] }) {
  return (
    <div className="h-full overflow-y-auto space-y-1.5">
      {events.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-muted">
          <span className="inline-block w-2 h-2 bg-muted rounded-full node-pulse mr-2" />
          <span className="text-[11px] font-operational">
            Waiting for events...
          </span>
        </div>
      ) : (
        events.map((event) => (
          <div
            key={event.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-sm ${rowAccent(event.type)}`}
          >
            <span className="text-[11px] text-muted font-operational whitespace-nowrap tabular-nums">
              {formatTime(event.timestamp)}
            </span>
            <span
              className={`text-[10px] font-operational uppercase px-2 py-0.5 rounded-sm whitespace-nowrap ${pillClasses(event.type)}`}
            >
              {event.type}
            </span>
            {event.data.agentId && (
              <span className="text-[11px] text-secondary font-operational truncate max-w-[80px]">
                {event.data.agentId}
              </span>
            )}
            <span className="text-[11px] text-muted truncate flex-1">
              {event.data.reason ?? "—"}
            </span>
            {event.data.riskScore != null && (
              <div className="flex items-center gap-1.5 min-w-[80px]">
                <div className="w-16 h-1.5 bg-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${riskBarColor(event.data.riskScore)}`}
                    style={{ width: `${event.data.riskScore * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted font-operational tabular-nums">
                  {(event.data.riskScore * 100).toFixed(0)}
                </span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
