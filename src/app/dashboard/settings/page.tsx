"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace, PLANS } from "../../lib/workspace";

export default function SettingsPage() {
  const { workspace, renameWorkspace, reset } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("https://your-breakwater.run");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (workspace) setName(workspace.name);
  }, [workspace]);
  useEffect(() => {
    if (typeof window !== "undefined") setEndpoint(window.location.origin);
  }, []);

  if (!workspace) return null;
  const plan = PLANS[workspace.plan];

  return (
    <div className="px-5 sm:px-8 py-8 max-w-2xl">
      <h1 className="text-headline text-2xl">Settings</h1>
      <p className="text-[13px] text-muted font-operational mt-1">
        Manage your workspace.
      </p>

      {/* Workspace */}
      <section className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 className="text-[14px] font-operational text-foreground">
          Workspace
        </h2>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="ws-name"
              className="block text-[12px] font-operational text-muted mb-1.5"
            >
              Name
            </label>
            <div className="flex items-center gap-2.5">
              <input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-64 bg-background border border-border rounded-md px-3 py-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <button
                onClick={() => renameWorkspace(name)}
                disabled={!name.trim() || name.trim() === workspace.name}
                className="rounded-md border border-border-strong px-3.5 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/20 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Save
              </button>
            </div>
          </div>
          <Row label="Email" value={workspace.email || "—"} />
          <Row label="Plan" value={`${plan.name} · $${plan.price}/mo`} />
        </div>
      </section>

      {/* Endpoint */}
      <section className="mt-5 rounded-md border border-border bg-surface p-5">
        <h2 className="text-[14px] font-operational text-foreground">
          Your endpoint
        </h2>
        <p className="mt-2 text-[13px] text-secondary leading-relaxed">
          Route your agents through this base URL. Send{" "}
          <span className="text-foreground font-operational">x-agent-id</span> to
          attribute traffic to a specific agent.
        </p>
        <code className="mt-3 block rounded-md bg-background border border-border px-3 py-2 text-[13px] font-operational text-success">
          {endpoint}/v1
        </code>
      </section>

      {/* Danger zone */}
      <section className="mt-5 rounded-md border border-failure/40 bg-failure/5 p-5">
        <h2 className="text-[14px] font-operational text-failure">Danger zone</h2>
        <p className="mt-2 text-[13px] text-secondary leading-relaxed">
          Deleting your workspace removes all agents and returns you to the home
          page. This can&apos;t be undone.
        </p>
        {confirmDelete ? (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => {
                reset();
                router.push("/");
              }}
              className="rounded-md border border-failure/60 px-4 py-2 text-[13px] font-operational text-failure transition-colors duration-100 hover:bg-failure/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-failure focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Yes, delete workspace
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-[13px] font-operational text-muted hover:text-secondary"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="mt-4 rounded-md border border-failure/50 px-4 py-2 text-[13px] font-operational text-failure transition-colors duration-100 hover:bg-failure/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-failure focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Delete workspace
          </button>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2.5 last:border-0 last:pb-0">
      <span className="text-[12px] font-operational text-muted">{label}</span>
      <span className="text-[13px] font-operational text-foreground">
        {value}
      </span>
    </div>
  );
}
