"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../lib/workspace";

function apiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_HTTP_URL;
  if (explicit) return explicit;
  if (typeof window === "undefined") return "";
  const devPort = process.env.NEXT_PUBLIC_PROXY_PORT;
  if (devPort) {
    return `${window.location.protocol}//${window.location.hostname}:${devPort}`;
  }
  return "";
}

type Lang = "python" | "node" | "curl";

export default function GetStarted() {
  const router = useRouter();
  const { workspace, loaded, createWorkspace, addAgent } = useWorkspace();

  const [step, setStep] = useState<1 | 2>(1);
  const [wsName, setWsName] = useState("");
  const [email, setEmail] = useState("");

  const [endpoint, setEndpoint] = useState("https://your-breakwater.run");
  const [agent, setAgent] = useState("my-app");
  const [lang, setLang] = useState<Lang>("python");
  const [test, setTest] = useState<
    | { state: "idle" }
    | { state: "running" }
    | { state: "ok"; reply: string }
    | { state: "fail"; msg: string }
  >({ state: "idle" });

  useEffect(() => {
    if (typeof window !== "undefined") setEndpoint(window.location.origin);
  }, []);

  // Returning user with a workspace already set up → jump to their dashboard.
  useEffect(() => {
    if (loaded && workspace) setStep(2);
  }, [loaded, workspace]);

  const agentId = agent.trim() || "my-app";

  const snippets: Record<Lang, string> = {
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${endpoint}/v1",   # the only change
    api_key="YOUR_LLM_KEY",
    default_headers={"x-agent-id": "${agentId}"},
)`,
    node: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${endpoint}/v1",   // the only change
  apiKey: process.env.LLM_KEY,
  defaultHeaders: { "x-agent-id": "${agentId}" },
});`,
    curl: `curl ${endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-agent-id: ${agentId}" \\
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}]}'`,
  };

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createWorkspace(wsName, email);
    setStep(2);
  }

  async function runTest() {
    setTest({ state: "running" });
    try {
      const res = await fetch(`${apiBase()}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-id": agentId },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "user", content: "Reply with: connection confirmed" },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTest({
          state: "fail",
          msg: data?.error?.message || `Connection failed (HTTP ${res.status})`,
        });
        return;
      }
      setTest({
        state: "ok",
        reply: data?.choices?.[0]?.message?.content ?? "connected",
      });
    } catch {
      setTest({
        state: "fail",
        msg: "Couldn't reach Breakwater. Check the endpoint and that the proxy is running.",
      });
    }
  }

  function finish() {
    const res = addAgent(agentId);
    // If the agent already exists (returning user re-adding), that's fine.
    void res;
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brewing-logo.png"
              alt="Breakwater"
              width={28}
              height={28}
              className="opacity-90"
            />
            <span className="text-headline text-xl">BREAKWATER</span>
          </Link>
          <div className="flex items-center gap-2 text-[12px] font-operational text-muted">
            <StepDot active={step >= 1} label="Workspace" />
            <span className="text-border-strong">→</span>
            <StepDot active={step >= 2} label="Connect" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-14">
        {step === 1 && (
          <div>
            <h1 className="text-headline text-3xl sm:text-4xl">
              Create your workspace.
            </h1>
            <p className="mt-3 text-[15px] text-secondary leading-relaxed">
              This is where your agents, activity, and billing live. Start free -
              no card required.
            </p>
            <form onSubmit={handleCreate} className="mt-9 space-y-5 max-w-md">
              <Field label="Workspace name" htmlFor="ws">
                <input
                  id="ws"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  placeholder="Acme AI"
                  autoComplete="organization"
                  required
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </Field>
              <Field label="Work email" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@acme.ai"
                  autoComplete="email"
                  required
                  className="w-full bg-background border border-border rounded-md px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </Field>
              <button
                type="submit"
                className="rounded-md bg-accent/20 border border-border-strong px-5 py-2.5 text-[14px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Create workspace →
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-headline text-3xl sm:text-4xl">
              Connect your first agent.
            </h1>
            <p className="mt-3 text-[15px] text-secondary leading-relaxed">
              Point your agent at Breakwater. Keep your own model and key - this
              is the entire integration.
            </p>

            <ol className="mt-9 space-y-6">
              <Step n={1} title="Name this agent">
                <div className="flex items-center gap-3 flex-wrap">
                  <label htmlFor="agent" className="sr-only">
                    Agent id
                  </label>
                  <input
                    id="agent"
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                    placeholder="my-app"
                    autoComplete="off"
                    className="w-56 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-operational text-foreground placeholder:text-muted outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                  <span className="text-[12px] text-muted font-operational">
                    sent as <span className="text-secondary">x-agent-id</span>
                  </span>
                </div>
              </Step>

              <Step n={2} title="Add one line to your app">
                <div className="flex items-center gap-1.5 mb-2.5">
                  {(["python", "node", "curl"] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-operational transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        lang === l
                          ? "bg-accent/25 text-foreground border border-border-strong"
                          : "text-muted border border-transparent hover:text-secondary"
                      }`}
                    >
                      {l === "node" ? "Node" : l === "curl" ? "cURL" : "Python"}
                    </button>
                  ))}
                </div>
                <CopyBlock code={snippets[lang]} />
              </Step>

              <Step n={3} title="Test the connection">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={runTest}
                    disabled={test.state === "running"}
                    aria-busy={test.state === "running"}
                    className="rounded-md bg-accent/20 border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {test.state === "running"
                      ? "Checking…"
                      : "Send a test call"}
                  </button>
                  {test.state === "ok" && (
                    <span className="text-[13px] font-operational text-success">
                      ✓ Connected - {agentId} is protected
                    </span>
                  )}
                </div>
                {test.state === "fail" && (
                  <div className="mt-3 rounded-md border border-failure/40 bg-failure/5 p-3.5">
                    <p className="text-[13px] font-operational text-failure">
                      Connection failed
                    </p>
                    <p className="mt-1 text-[13px] text-secondary leading-relaxed">
                      {test.msg}
                    </p>
                  </div>
                )}
              </Step>
            </ol>

            <div className="mt-9 flex items-center gap-3">
              <button
                onClick={finish}
                disabled={test.state !== "ok"}
                className="rounded-md bg-accent/20 border border-border-strong px-6 py-3 text-[14px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Go to my dashboard →
              </button>
              {test.state !== "ok" && (
                <span className="text-[12px] font-operational text-muted">
                  Run a successful test to continue
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 ${active ? "text-foreground" : "text-muted"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-success" : "bg-border-strong"}`}
      />
      {label}
    </span>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[12px] font-operational text-muted mb-1.5"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-md border border-border bg-surface p-5">
      <div className="flex items-center gap-3 mb-3.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong text-[12px] font-operational text-secondary tabular-nums">
          {n}
        </span>
        <h2 className="text-[14px] font-operational text-foreground">{title}</h2>
      </div>
      {children}
    </li>
  );
}

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-md bg-background border border-border">
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard unavailable */
          }
        }}
        className="absolute right-2.5 top-2.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-operational text-secondary transition-colors duration-100 hover:text-foreground hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
      <pre className="overflow-x-auto p-4 pr-20 text-[12.5px] font-operational leading-relaxed text-secondary">
        {code}
      </pre>
    </div>
  );
}
