"use client";

const formatter = new Intl.NumberFormat("en-US");

export default function TokensProcessed({ count }: { count: number }) {
  return (
    <div className="rounded-md border border-border bg-surface h-full flex flex-col">
      <div className="px-5 py-3.5 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider font-operational text-muted">
          Tokens Processed
        </p>
      </div>
      <div className="p-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-sm bg-elevated border border-border flex items-center justify-center">
          <svg
            className="w-5 h-5 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>
        <div>
          <p className="text-3xl font-operational text-foreground tabular-nums">
            {formatter.format(count)}
          </p>
        </div>
      </div>
    </div>
  );
}
