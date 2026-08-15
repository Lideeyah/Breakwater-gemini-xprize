"use client";

import { useState, useEffect, useRef } from "react";
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
          <div className="hidden sm:flex items-center gap-2 text-[12px] font-operational text-muted">
            <StepDot active={step >= 1} label="Workspace" />
            <span className="text-border-strong">→</span>
            <StepDot active={step >= 2} label="Connect" />
          </div>
        </div>
      </header>

      <main className="px-5">
        {step === 1 && (
          <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-10">
            <div className="w-full max-w-md rounded-lg border border-border bg-surface p-8">
              <h1 className="text-headline text-2xl">Create your workspace.</h1>
              <p className="mt-2 text-[14px] text-secondary leading-relaxed">
                This is where your agents, activity, and billing live. Start free
                - no card required.
              </p>
              <form onSubmit={handleCreate} className="mt-6 space-y-4">
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
                  className="w-full rounded-md bg-accent/20 border border-border-strong px-5 py-2.5 text-[14px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Create workspace →
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-xl mx-auto py-14">
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
                <p className="text-[13px] text-secondary leading-relaxed mb-3">
                  Point your existing OpenAI-compatible client at Breakwater. The
                  highlighted line is the only change - your model and key stay
                  exactly as they are.
                </p>
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
                <CodeBlock code={snippets[lang]} lang={lang} agentId={agentId} />
              </Step>

              <Step n={3} title="Test the connection">
                <p className="text-[13px] text-secondary leading-relaxed mb-3">
                  Send one real request through Breakwater to confirm the proxy is
                  in the path.
                </p>
                <button
                  onClick={runTest}
                  disabled={test.state === "running"}
                  aria-busy={test.state === "running"}
                  className="rounded-md bg-accent/20 border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {test.state === "running" ? "Checking…" : "Send a test call"}
                </button>

                {test.state === "running" && (
                  <p className="mt-3 flex items-center gap-2 text-[13px] font-operational text-secondary">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent node-pulse" />
                    Routing a test call through the proxy…
                  </p>
                )}

                {test.state === "ok" && (
                  <div className="mt-3 rounded-md border border-success/40 bg-success/10 p-4">
                    <p className="text-[13px] font-operational text-success">
                      ✓ Connected
                    </p>
                    <p className="mt-1.5 text-[13px] text-secondary leading-relaxed">
                      <span className="font-operational text-foreground">
                        {agentId}
                      </span>{" "}
                      is protected. Breakwater is now inspecting every request
                      this agent makes and will halt it the moment it starts a
                      runaway loop.
                    </p>
                  </div>
                )}

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

const LANG_LABEL: Record<Lang, string> = {
  python: "Python",
  node: "Node",
  curl: "cURL",
};

// Renders one code line: the agent id (what the user just typed) is drawn in the
// accent colour wherever it appears, so the connection between the field and the
// code is obvious. Non-highlighted lines are dimmed so the changed line leads.
function renderCode(part: string, agentId: string, dim: boolean) {
  const base = dim ? "text-muted" : "text-foreground";
  if (!agentId || !part.includes(agentId)) {
    return <span className={base}>{part || " "}</span>;
  }
  const chunks = part.split(agentId);
  return (
    <>
      {chunks.map((ch, i) => (
        <span key={i}>
          <span className={base}>{ch}</span>
          {i < chunks.length - 1 && <span className="text-accent">{agentId}</span>}
        </span>
      ))}
    </>
  );
}

function CodeBlock({
  code,
  lang,
  agentId,
}: {
  code: string;
  lang: Lang;
  agentId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastLang = useRef<Lang | null>(null);

  // Reveal the snippet only once it scrolls into view, so it reads as "being
  // written" the moment the reader arrives at it - a flow, not a static wall.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting),
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Type out on first view and on each language switch. Editing the agent name
  // (same language) updates in place without re-typing, so the two never fight.
  useEffect(() => {
    if (!visible || lastLang.current === lang) return;
    lastLang.current = lang;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setTyping(false);
      setShown(code.length);
      return;
    }
    setTyping(true);
    setShown(0);
    let n = 0;
    const step = Math.max(2, Math.round(code.length / 70));
    const id = setInterval(() => {
      n += step;
      if (n >= code.length) {
        setShown(code.length);
        setTyping(false);
        clearInterval(id);
      } else {
        setShown(n);
      }
    }, 18);
    return () => clearInterval(id);
  }, [visible, lang, code]);

  const visibleCode = typing ? code.slice(0, shown) : code;
  const lines = visibleCode.split("\n");
  // The one line that matters: the base URL swap (or the URL in the cURL call).
  const isHero = (l: string) =>
    /base_url|baseURL/.test(l) || l.includes("/v1/chat/completions");

  return (
    <div
      ref={ref}
      className="rounded-md bg-background border border-border overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-operational text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-success/70" />
          {LANG_LABEL[lang]}
        </span>
        <button
          onClick={async () => {
            // Optimistic: show feedback immediately, even where the clipboard
            // API is unavailable (headless capture, insecure origins).
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
            try {
              await navigator.clipboard.writeText(code);
            } catch {
              /* clipboard unavailable */
            }
          }}
          className="rounded-md border border-border px-3 py-1 text-[12px] font-operational text-secondary transition-colors duration-100 hover:text-foreground hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto py-3 text-[12.5px] font-operational leading-[1.75]">
        {lines.map((line, i) => {
          const hero = isHero(line);
          // Split off a trailing comment (needs whitespace before # or //, so
          // the // in http:// is never mistaken for a comment).
          const m = line.match(/^(.*?)(\s+(?:#|\/\/)\s.*)$/);
          const codePart = m ? m[1] : line;
          const comment = m ? m[2] : "";
          const caret = typing && i === lines.length - 1;
          return (
            <div
              key={i}
              className={`px-4 border-l-2 ${
                hero ? "border-success bg-success/10" : "border-transparent"
              }`}
            >
              {renderCode(codePart, agentId, !hero)}
              {comment && <span className="text-success/90">{comment}</span>}
              {caret && (
                <span className="ml-0.5 inline-block h-[14px] w-[7px] translate-y-[2px] bg-accent/80 animate-pulse" />
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
