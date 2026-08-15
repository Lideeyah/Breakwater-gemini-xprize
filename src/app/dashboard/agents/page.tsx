"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useWorkspace, PLANS, type Agent } from "../../lib/workspace";
import { useSocket } from "../components/SocketContext";

export default function AgentsPage() {
  const { workspace, addAgent, removeAgent, renameAgent } = useWorkspace();
  const { events } = useSocket();

  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Live per-agent activity from this session's event stream.
  const activity = useMemo(() => {
    const m = new Map<
      string,
      { calls: number; intercepts: number; last: number }
    >();
    for (const e of events) {
      const id = e.data.agentId;
      if (!id) continue;
      const s = m.get(id) ?? { calls: 0, intercepts: 0, last: 0 };
      s.calls++;
      if (e.type === "intercept") s.intercepts++;
      s.last = Math.max(s.last, e.timestamp);
      m.set(id, s);
    }
    return m;
  }, [events]);

  if (!workspace) return null;
  const plan = PLANS[workspace.plan];
  const atLimit = workspace.agents.length >= plan.agentLimit;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = addAgent(newName);
    if (!res.ok) {
      setError(res.reason || "Couldn't add agent.");
      return;
    }
    setNewName("");
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-4xl">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline text-2xl">Agents</h1>
          <p className="text-[13px] text-muted font-operational mt-1">
            {workspace.agents.length} of {plan.agentLimit} on the {plan.name}{" "}
            plan
          </p>
        </div>
      </div>

      {/* Add agent */}
      <form
        onSubmit={handleAdd}
        className="mt-6 rounded-md border border-border bg-surface p-4"
      >
        <label
          htmlFor="new-agent"
          className="block text-[12px] font-operational text-muted mb-2"
        >
          Add an agent
        </label>
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            id="new-agent"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="checkout-bot"
            autoComplete="off"
            disabled={atLimit}
            className="w-64 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-operational text-foreground placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          />
          {atLimit ? (
            <Link
              href="/dashboard/billing"
              className="rounded-md border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Upgrade to add more →
            </Link>
          ) : (
            <button
              type="submit"
              disabled={!newName.trim()}
              className="rounded-md bg-accent/20 border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Add agent
            </button>
          )}
        </div>
        {atLimit && (
          <p className="mt-2.5 text-[12px] font-operational text-secondary">
            You&apos;ve used all {plan.agentLimit} agents on {plan.name}. Upgrade
            your plan to protect more.
          </p>
        )}
        {error && !atLimit && (
          <p className="mt-2.5 text-[12px] font-operational text-failure">
            {error}
          </p>
        )}
      </form>

      {/* List */}
      <div className="mt-5 space-y-2.5">
        {workspace.agents.length === 0 && (
          <div className="rounded-md border border-border bg-surface p-8 text-center">
            <p className="text-[14px] text-secondary">No agents yet.</p>
            <p className="text-[13px] text-muted font-operational mt-1">
              Add one above to start protecting it.
            </p>
          </div>
        )}
        {workspace.agents.map((a) => (
          <AgentRow
            key={a.id}
            agent={a}
            stats={activity.get(a.id)}
            confirming={confirmId === a.id}
            onRename={(name) => renameAgent(a.id, name)}
            onAskRemove={() => setConfirmId(a.id)}
            onCancelRemove={() => setConfirmId(null)}
            onConfirmRemove={() => {
              removeAgent(a.id);
              setConfirmId(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AgentRow({
  agent,
  stats,
  confirming,
  onRename,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  agent: Agent;
  stats?: { calls: number; intercepts: number; last: number };
  confirming: boolean;
  onRename: (name: string) => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const calls = stats?.calls ?? 0;
  const intercepts = stats?.intercepts ?? 0;

  return (
    <div className="rounded-md border border-border bg-surface p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && onRename(name.trim())}
          aria-label="Agent name"
          className="bg-transparent text-[14px] text-foreground outline-none border-b border-transparent focus:border-border-strong w-56 max-w-full"
        />
        <p className="text-[11px] font-operational text-muted mt-0.5">
          x-agent-id: <span className="text-secondary">{agent.id}</span>
        </p>
      </div>

      <div className="flex items-center gap-6">
        <Metric label="Calls" value={calls} />
        <Metric label="Intercepts" value={intercepts} tone={intercepts > 0 ? "failure" : "neutral"} />
        <span
          className={`text-[11px] uppercase tracking-wider font-operational ${
            intercepts > 0 ? "text-failure" : "text-success"
          }`}
        >
          {intercepts > 0 ? "Flagged" : "Healthy"}
        </span>

        {confirming ? (
          <span className="flex items-center gap-2">
            <button
              onClick={onConfirmRemove}
              className="rounded-md border border-failure/50 px-3 py-1.5 text-[12px] font-operational text-failure transition-colors duration-100 hover:bg-failure/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-failure focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Confirm
            </button>
            <button
              onClick={onCancelRemove}
              className="text-[12px] font-operational text-muted hover:text-secondary"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={onAskRemove}
            className="rounded-md border border-border px-3 py-1.5 text-[12px] font-operational text-muted transition-colors duration-100 hover:text-failure hover:border-failure/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "failure";
}) {
  return (
    <div className="text-right">
      <p
        className={`text-[15px] font-operational tabular-nums ${
          tone === "failure" && value > 0 ? "text-failure" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
        {label}
      </p>
    </div>
  );
}
