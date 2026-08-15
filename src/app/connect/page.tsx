"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// Same-origin in production; the proxy's dev port locally. Mirrors TryItPanel.
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

export default function Connect() {
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

  const agentId = agent.trim() || "my-app";
  const snippets: Record<Lang, string> = {
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${endpoint}/v1",   # the only change
    api_key="YOUR_LLM_KEY",
    default_headers={"x-agent-id": "${agentId}"},
)

client.chat.completions.create(
    model="gemini-2.5-flash",
    messages=[{"role": "user", "content": "Hello"}],
)`,
    node: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${endpoint}/v1",   // the only change
  apiKey: process.env.LLM_KEY,
  defaultHeaders: { "x-agent-id": "${agentId}" },
});

await client.chat.completions.create({
  model: "gemini-2.5-flash",
  messages: [{ role: "user", content: "Hello" }],
});`,
    curl: `curl ${endpoint}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-agent-id: ${agentId}" \\
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"Hello"}]}'`,
  };

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
          msg: data?.error?.message || `HTTP ${res.status}`,
        });
        return;
      }
      setTest({
        state: "ok",
        reply: data?.choices?.[0]?.message?.content ?? "connected",
      });
    } catch {
      setTest({ state: "fail", msg: "Could not reach Breakwater." });
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
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
          <Link
            href="/dashboard"
            className="rounded-md border border-border px-3.5 py-2 text-[13px] font-operational text-secondary transition-colors duration-100 hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-14">
        <h1 className="text-headline text-3xl sm:text-4xl">
          Protect an agent in 60 seconds.
        </h1>
        <p className="mt-3 text-[15px] text-secondary leading-relaxed">
          Breakwater sits in front of your agent as a drop-in proxy. Point your
          base URL at it, keep your own model and key, and every call is guarded.
        </p>

        <ol className="mt-10 space-y-6">
          {/* Step 1 — endpoint */}
          <Step n={1} title="Your Breakwater endpoint">
            <CopyRow value={`${endpoint}/v1`} />
          </Step>

          {/* Step 2 — name the agent */}
          <Step n={2} title="Name this agent">
            <div className="flex items-center gap-3">
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
                sent as <span className="text-secondary">x-agent-id</span> — keys
                loop detection to this agent
              </span>
            </div>
          </Step>

          {/* Step 3 — integrate */}
          <Step n={3} title="Add it to your app">
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

          {/* Step 4 — test */}
          <Step n={4} title="Test the connection">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={runTest}
                disabled={test.state === "running"}
                aria-busy={test.state === "running"}
                className="rounded-md bg-accent/20 border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {test.state === "running"
                  ? "Checking…"
                  : "Send a test call through Breakwater"}
              </button>
              {test.state === "ok" && (
                <span className="text-[13px] font-operational text-success">
                  ✓ Connected — {agentId} is protected
                </span>
              )}
              {test.state === "fail" && (
                <span className="text-[13px] font-operational text-failure">
                  {test.msg}
                </span>
              )}
            </div>
            {test.state === "ok" && (
              <p className="mt-3 text-[13px] text-secondary font-operational">
                <span className="text-success">gemini</span> {test.reply}
              </p>
            )}
          </Step>
        </ol>

        {/* Done */}
        <div className="mt-10 rounded-md border border-border bg-surface p-6 text-center">
          <p className="text-[14px] text-secondary">
            That&apos;s it. Every call from{" "}
            <span className="text-foreground font-operational">{agentId}</span> is
            now inspected — obvious loops die in ~1&nbsp;ms, semantic loops are
            caught by Gemini.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-md bg-accent/20 border border-border-strong px-6 py-3 text-[14px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Open your dashboard →
          </Link>
        </div>

        <p className="mt-6 text-[12px] text-muted font-operational text-center">
          Demo instance is shared: name your agent to see just its traffic. A
          production launch adds per-account endpoints and keys.
        </p>
      </main>
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

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[12px] font-operational text-secondary transition-colors duration-100 hover:text-foreground hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function CopyRow({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md bg-background border border-border px-3 py-2 text-[13px] font-operational text-success">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}

function CopyBlock({ code }: { code: string }) {
  return (
    <div className="relative rounded-md bg-background border border-border">
      <div className="absolute right-2.5 top-2.5">
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-4 pr-20 text-[12.5px] font-operational leading-relaxed text-secondary">
        {code}
      </pre>
    </div>
  );
}
