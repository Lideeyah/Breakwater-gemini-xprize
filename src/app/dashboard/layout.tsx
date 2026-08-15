"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useWorkspace, PLANS } from "../lib/workspace";
import { SocketProvider, useSocket } from "./components/SocketContext";

const NAV = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { workspace, loaded } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loaded && !workspace) router.replace("/get-started");
  }, [loaded, workspace, router]);

  if (!loaded || !workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="text-[13px] font-operational text-muted animate-pulse">
          Loading…
        </span>
      </div>
    );
  }

  const plan = PLANS[workspace.plan];

  return (
    <SocketProvider>
      <div className="min-h-screen bg-background md:flex">
        {/* Sidebar */}
        <aside className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-border bg-surface/40 flex md:flex-col">
          <div className="flex md:flex-col md:h-full w-full">
            <Link
              href="/"
              className="flex items-center gap-2.5 px-5 h-16 md:border-b border-border shrink-0"
            >
              <Image
                src="/brewing-logo.png"
                alt="Breakwater"
                width={24}
                height={24}
                className="opacity-90"
              />
              <span className="text-headline text-lg">BREAKWATER</span>
            </Link>

            {/* Workspace */}
            <div className="hidden md:block px-5 py-4 border-b border-border">
              <p className="text-[13px] font-operational text-foreground truncate">
                {workspace.name}
              </p>
              <p className="text-[11px] font-operational text-muted mt-0.5">
                {plan.name} plan · {workspace.agents.length}/{plan.agentLimit}{" "}
                agents
              </p>
            </div>

            {/* Nav */}
            <nav className="flex md:flex-col gap-1 px-3 md:px-3 py-2 md:py-4 flex-1 overflow-x-auto">
              {NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-[13px] font-operational whitespace-nowrap transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                      active
                        ? "bg-accent/20 text-foreground"
                        : "text-muted hover:text-secondary hover:bg-surface"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden md:block px-5 py-4 border-t border-border">
              <ConnectionDot />
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </SocketProvider>
  );
}

function ConnectionDot() {
  const { connected, stats } = useSocket();
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${
          connected ? "bg-success node-pulse" : "bg-failure"
        }`}
      />
      <span className="text-[11px] font-operational text-muted">
        {connected
          ? stats.geminiLive
            ? "Live · Gemini"
            : "Live · heuristic"
          : "Reconnecting…"}
      </span>
    </div>
  );
}
