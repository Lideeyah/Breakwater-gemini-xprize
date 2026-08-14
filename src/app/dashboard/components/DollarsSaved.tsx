"use client";

export default function DollarsSaved({ amount }: { amount: number }) {
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="rounded-md border border-border bg-surface h-full flex flex-col">
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
          Projected Runaway Loss Avoided
        </p>
      </div>
      <div className="p-5 flex-1 flex flex-col items-center justify-center text-center">
        <p
          className={`text-5xl font-operational text-success tabular-nums ${
            amount > 0 ? "node-pulse" : ""
          }`}
        >
          ${formatted}
        </p>
        <p className="text-[11px] font-operational text-muted mt-3">
          by intercepting runaway agent loops
        </p>
      </div>
    </div>
  );
}
