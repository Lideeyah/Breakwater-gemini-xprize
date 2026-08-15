"use client";

import { useWorkspace, PLANS, type PlanId } from "../../lib/workspace";
import { useSocket } from "../components/SocketContext";

export default function BillingPage() {
  const { workspace, setPlan } = useWorkspace();
  const { stats } = useSocket();

  if (!workspace) return null;
  const current = PLANS[workspace.plan];
  const used = workspace.agents.length;
  const saved = stats.dollarsSaved;

  return (
    <div className="px-5 sm:px-8 py-8 max-w-4xl">
      <h1 className="text-headline text-2xl">Billing</h1>
      <p className="text-[13px] text-muted font-operational mt-1">
        Your plan, usage, and what you owe this cycle.
      </p>

      {/* Current cycle */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Current plan" value={current.name} sub={`${used}/${current.agentLimit} agents`} />
        <SummaryCard
          label="Due this cycle"
          value={`$${current.price.toFixed(2)}`}
          sub={current.price === 0 ? "free tier" : "billed monthly"}
        />
        <SummaryCard
          label="Loss avoided"
          value={`$${saved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub="projected, this session"
          tone="money"
        />
      </div>

      {saved > current.price && current.price >= 0 && (
        <p className="mt-4 text-[13px] text-secondary font-operational">
          Breakwater has already avoided{" "}
          <span className="text-success">${saved.toFixed(2)}</span> in projected
          runaway spend
          {current.price > 0 ? ` for your $${current.price}/mo plan.` : "."}
        </p>
      )}

      {/* Plans */}
      <h2 className="mt-10 text-headline text-lg">Change plan</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const isCurrent = id === workspace.plan;
          const wouldOrphan = p.agentLimit < used;
          return (
            <div
              key={id}
              className={`rounded-md border bg-surface p-5 flex flex-col ${
                isCurrent ? "border-border-strong" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-headline text-lg">{p.name}</h3>
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-wider font-operational text-success">
                    Current
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-headline text-3xl tabular-nums">
                  ${p.price}
                </span>
                <span className="text-[12px] font-operational text-muted">
                  / mo
                </span>
              </div>
              <p className="mt-2.5 text-[13px] text-secondary leading-relaxed flex-1">
                {p.agentLimit} agent{p.agentLimit === 1 ? "" : "s"}. {p.blurb}
              </p>
              <button
                onClick={() => setPlan(id)}
                disabled={isCurrent || wouldOrphan}
                className="mt-4 rounded-md border border-border-strong px-4 py-2.5 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {isCurrent
                  ? "Current plan"
                  : id === "free" || PLANS[id].price < current.price
                    ? "Downgrade"
                    : "Upgrade"}
              </button>
              {wouldOrphan && !isCurrent && (
                <p className="mt-2 text-[11px] font-operational text-muted">
                  Remove agents to fit {p.agentLimit}.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-md border border-border bg-surface p-5">
        <p className="text-[13px] font-operational text-foreground">
          Payment method
        </p>
        <p className="mt-1.5 text-[13px] text-secondary leading-relaxed">
          This is a demo workspace, so plan changes apply instantly with no
          charge. A production account connects a card or bank transfer here and
          bills through the selected plan.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "money";
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-operational tabular-nums ${
          tone === "money" ? "text-success" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-[12px] font-operational text-muted">{sub}</p>
      )}
    </div>
  );
}
