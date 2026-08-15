"use client";

import Image from "next/image";
import Link from "next/link";
import TryItPanel from "./dashboard/components/TryItPanel";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/brewing-logo.png"
              alt="Breakwater"
              width={28}
              height={28}
              className="opacity-90"
            />
            <span className="text-headline text-xl">BREAKWATER</span>
          </div>
          <Link
            href="/dashboard"
            className="rounded-md border border-border px-3.5 py-2 text-[13px] font-operational text-secondary transition-colors duration-100 hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-5 pt-20 pb-16 text-center">
        <p
          className="reveal-in text-[11px] uppercase tracking-[0.2em] font-operational text-accent"
          style={{ animationDelay: "0ms" }}
        >
          Autonomous Agent Risk &amp; Capital Firewall
        </p>
        <h1
          className="reveal-in text-headline text-4xl sm:text-6xl mt-6 leading-[1.02]"
          style={{ animationDelay: "80ms" }}
        >
          Your AI agent has your
          <br />
          API keys and your budget.
        </h1>
        <p
          className="reveal-in mx-auto mt-6 max-w-xl text-[15px] sm:text-lg text-secondary leading-relaxed"
          style={{ animationDelay: "160ms" }}
        >
          When it gets stuck in a loop, it doesn&apos;t crash — it quietly burns
          tokens and money until someone notices the bill. Breakwater is the
          circuit breaker that stops it, live.
        </p>
        <div
          className="reveal-in mt-9 flex items-center justify-center gap-3"
          style={{ animationDelay: "240ms" }}
        >
          <Link
            href="/connect"
            className="rounded-md bg-accent/20 border border-border-strong px-5 py-2.5 text-[14px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Connect your agent →
          </Link>
          <a
            href="#watch"
            className="rounded-md px-5 py-2.5 text-[14px] font-operational text-secondary transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Watch it work
          </a>
        </div>
      </section>

      {/* Act 1 — the problem */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <StepLabel n="01" text="The problem" />
        <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-headline text-2xl sm:text-3xl">
              A stuck agent burns money in silence.
            </h2>
            <p className="mt-4 text-[15px] text-secondary leading-relaxed">
              It calls the same failing tool, over and over, with no one
              watching. There&apos;s no error, no alert — just a climbing bill.
              One unattended runaway loop overnight can erase a month of margin.
            </p>
          </div>
          {/* Burning-cost log */}
          <div
            className="rounded-md border border-failure/40 bg-surface overflow-hidden"
            role="img"
            aria-label="An agent retrying a failing call, with the cost climbing every attempt"
          >
            <div className="px-4 py-2.5 border-b border-border text-[10px] uppercase tracking-wider font-operational text-muted">
              unprotected agent
            </div>
            <div className="p-4 font-operational text-[12.5px] space-y-1.5">
              {[
                ["attempt 1", "500", "$0.04"],
                ["attempt 2", "500", "$0.08"],
                ["attempt 3", "500", "$0.12"],
                ["attempt 4", "500", "$0.16"],
                ["attempt 5", "500", "$0.20"],
              ].map(([a, code, cost]) => (
                <div key={a} className="flex items-center justify-between">
                  <span className="text-secondary">
                    {a} · fetchData() →{" "}
                    <span className="text-failure">{code}</span>
                  </span>
                  <span className="text-failure tabular-nums">{cost}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-1 text-muted">
                <span className="node-pulse">…still looping</span>
                <span className="tabular-nums">$0.24 · $0.28 · …</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Act 2 — the one-line swap */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <StepLabel n="02" text="The fix" />
        <div className="mt-5">
          <h2 className="text-headline text-2xl sm:text-3xl">
            Change one line. Every call is protected.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] text-secondary leading-relaxed">
            Breakwater is a drop-in reverse proxy. Point your agent&apos;s base
            URL at it — keep your own model and your own key. No rewrite, no SDK,
            no lock-in.
          </p>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            <CodeCard
              label="Before"
              tone="muted"
              lines={[
                ["client = OpenAI(", ""],
                ['  base_url="https://api.provider.com/v1",', "muted"],
                [")", ""],
              ]}
            />
            <CodeCard
              label="After"
              tone="success"
              lines={[
                ["client = OpenAI(", ""],
                ['  base_url="https://your-breakwater.run/v1",', "success"],
                ['  default_headers={"x-agent-id": "my-app"},', "success"],
                [")", ""],
              ]}
            />
          </div>
        </div>
      </section>

      {/* Act 3 — watch it work (interactive) */}
      <section id="watch" className="max-w-5xl mx-auto px-5 py-12 scroll-mt-20">
        <StepLabel n="03" text="Watch it work" />
        <div className="mt-5">
          <h2 className="text-headline text-2xl sm:text-3xl">
            Send a real message. Then make the agent go rogue.
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] text-secondary leading-relaxed">
            This is live. Your message flows through Breakwater to Gemini 2.5
            Flash and back. Hit{" "}
            <span className="text-foreground">Simulate runaway</span> and watch
            the breaker trip on the same request, repeated — in the browser, no
            terminal.
          </p>
          <div className="mt-7">
            <TryItPanel />
          </div>
        </div>
      </section>

      {/* Act 4 — why it's smart */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <StepLabel n="04" text="Why it's different" />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FeatureCard
            title="Tier 1 — deterministic, ~1 ms"
            body="Hashing, structure, budget, rate, and a 128k-context guard catch the obvious loops instantly, for free."
            accent="foreground"
          />
          <FeatureCard
            title="Tier 2 — Gemini 2.5 Flash"
            body="Reads the agent's intent to catch reworded, semantic loops that hashing can't see — and explains why, in plain language."
            accent="success"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-5 py-16 text-center">
        <h2 className="text-headline text-3xl">See the whole picture.</h2>
        <p className="mt-3 text-[15px] text-secondary">
          The live control room shows every decision as it happens.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-block rounded-md bg-accent/20 border border-border-strong px-6 py-3 text-[14px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Open the live dashboard →
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between text-[12px] font-operational text-muted">
          <span>Breakwater</span>
          <span>Built with Gemini 2.5 Flash · Google Cloud Run</span>
        </div>
      </footer>
    </div>
  );
}

function StepLabel({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-operational text-accent tabular-nums">
        {n}
      </span>
      <span className="text-[11px] uppercase tracking-[0.2em] font-operational text-muted">
        {text}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function CodeCard({
  label,
  tone,
  lines,
}: {
  label: string;
  tone: "muted" | "success";
  lines: [string, string][];
}) {
  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-operational text-muted">
          {label}
        </span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            tone === "success" ? "bg-success" : "bg-border-strong"
          }`}
        />
      </div>
      <pre className="p-4 font-operational text-[12.5px] leading-relaxed overflow-x-auto">
        {lines.map(([text, hl], i) => (
          <div
            key={i}
            className={
              hl === "success"
                ? "text-success"
                : hl === "muted"
                  ? "text-muted"
                  : "text-secondary"
            }
          >
            {text || " "}
          </div>
        ))}
      </pre>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: "foreground" | "success";
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <h3
        className={`text-[14px] font-operational ${
          accent === "success" ? "text-success" : "text-foreground"
        }`}
      >
        {title}
      </h3>
      <p className="mt-2.5 text-[14px] text-secondary leading-relaxed">{body}</p>
    </div>
  );
}
