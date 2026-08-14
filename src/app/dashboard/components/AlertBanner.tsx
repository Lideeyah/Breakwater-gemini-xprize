"use client";

export default function AlertBanner({
  active,
  message = "ACTIVE INTERCEPT — Runaway agent loop detected",
}: {
  active: boolean;
  message?: string;
}) {
  if (!active) return null;

  return (
    <div className="w-full rounded-md border border-failure/30 bg-failure/10 px-5 py-3 flex items-center gap-3">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="node-pulse absolute inline-flex h-full w-full rounded-full bg-failure opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-failure" />
      </span>
      <p className="text-[11px] uppercase tracking-wider font-operational text-failure">
        {message}
      </p>
    </div>
  );
}
