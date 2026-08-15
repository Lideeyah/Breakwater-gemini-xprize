"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// -----------------------------------------------------------------------------
// Demo workspace store (localStorage-backed).
//
// This is the account/billing layer for the demo. Every flow is real and
// clickable; in production these mutations hit an auth provider + database +
// Stripe. The Gemini protection itself is genuinely live regardless.
// -----------------------------------------------------------------------------

export type PlanId = "free" | "team" | "business";

export interface Plan {
  id: PlanId;
  name: string;
  price: number; // NGN-agnostic demo dollars / mo
  agentLimit: number;
  blurb: string;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    agentLimit: 1,
    blurb: "One agent. For trying Breakwater on a single app.",
  },
  team: {
    id: "team",
    name: "Team",
    price: 49,
    agentLimit: 5,
    blurb: "Up to 5 agents. For a small fleet in production.",
  },
  business: {
    id: "business",
    name: "Business",
    price: 199,
    agentLimit: 25,
    blurb: "Up to 25 agents. For teams running agents at scale.",
  },
};

export interface Agent {
  id: string; // the x-agent-id sent on requests
  name: string;
  createdAt: number;
}

export interface Workspace {
  name: string;
  email: string;
  plan: PlanId;
  agents: Agent[];
  createdAt: number;
}

const KEY = "breakwater.workspace";

function load(): Workspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Workspace) : null;
  } catch {
    return null;
  }
}

function persist(ws: Workspace | null) {
  if (typeof window === "undefined") return;
  if (ws) window.localStorage.setItem(KEY, JSON.stringify(ws));
  else window.localStorage.removeItem(KEY);
}

export function slugifyAgent(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agent"
  );
}

interface WorkspaceContextValue {
  workspace: Workspace | null;
  loaded: boolean;
  createWorkspace: (name: string, email: string) => void;
  renameWorkspace: (name: string) => void;
  addAgent: (name: string) => { ok: boolean; reason?: string; agent?: Agent };
  removeAgent: (id: string) => void;
  renameAgent: (id: string, name: string) => void;
  setPlan: (plan: PlanId) => void;
  reset: () => void;
}

const Ctx = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setWorkspace(load());
    setLoaded(true);
  }, []);

  const update = useCallback((ws: Workspace | null) => {
    persist(ws);
    setWorkspace(ws);
  }, []);

  const createWorkspace = useCallback(
    (name: string, email: string) => {
      update({
        name: name.trim() || "My workspace",
        email: email.trim(),
        plan: "free",
        agents: [],
        createdAt: Date.now(),
      });
    },
    [update],
  );

  const renameWorkspace = useCallback(
    (name: string) => {
      if (!workspace) return;
      update({ ...workspace, name: name.trim() || workspace.name });
    },
    [workspace, update],
  );

  const addAgent = useCallback(
    (name: string) => {
      if (!workspace) return { ok: false, reason: "No workspace" };
      const limit = PLANS[workspace.plan].agentLimit;
      if (workspace.agents.length >= limit) {
        return {
          ok: false,
          reason: `Your ${PLANS[workspace.plan].name} plan allows ${limit} agent${
            limit === 1 ? "" : "s"
          }. Upgrade to add more.`,
        };
      }
      const base = slugifyAgent(name);
      let id = base;
      let i = 2;
      while (workspace.agents.some((a) => a.id === id)) id = `${base}-${i++}`;
      const agent: Agent = { id, name: name.trim() || id, createdAt: Date.now() };
      update({ ...workspace, agents: [...workspace.agents, agent] });
      return { ok: true, agent };
    },
    [workspace, update],
  );

  const removeAgent = useCallback(
    (id: string) => {
      if (!workspace) return;
      update({
        ...workspace,
        agents: workspace.agents.filter((a) => a.id !== id),
      });
    },
    [workspace, update],
  );

  const renameAgent = useCallback(
    (id: string, name: string) => {
      if (!workspace) return;
      update({
        ...workspace,
        agents: workspace.agents.map((a) =>
          a.id === id ? { ...a, name } : a,
        ),
      });
    },
    [workspace, update],
  );

  const setPlan = useCallback(
    (plan: PlanId) => {
      if (!workspace) return;
      update({ ...workspace, plan });
    },
    [workspace, update],
  );

  const reset = useCallback(() => update(null), [update]);

  return (
    <Ctx.Provider
      value={{
        workspace,
        loaded,
        createWorkspace,
        renameWorkspace,
        addAgent,
        removeAgent,
        renameAgent,
        setPlan,
        reset,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return v;
}
