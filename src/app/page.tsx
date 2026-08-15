"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PLANS, type PlanId } from "./lib/workspace";
import HeroFlow from "./components/HeroFlow";

// Fade + rise a section into view once, as the user scrolls to it. Subtle and
// one-shot; reduced-motion users get it instantly with no transform.
function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`transition duration-500 ease-out motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Headline that moves in word by word on load. Reduced-motion users get it
// instantly (reveal-in is disabled under prefers-reduced-motion).
function Words({
  text,
  start = 0,
  step = 70,
}: {
  text: string;
  start?: number;
  step?: number;
}) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span
          key={i}
          className="reveal-in inline-block mr-[0.25em]"
          style={{ animationDelay: `${start + i * step}ms` }}
        >
          {w}
        </span>
      ))}
    </>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
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
          <nav className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              className="rounded-md px-3.5 py-2 text-[13px] font-operational text-secondary transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Sign in
            </Link>
            <Link
              href="/get-started"
              className="rounded-md bg-accent/20 border border-border-strong px-4 py-2 text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Ambient drifting glow - quiet, constant life behind the hero */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="bw-glow-a absolute left-1/2 top-16 h-[440px] w-[560px] -translate-x-1/2 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(124,139,161,0.20), transparent)",
            }}
          />
          <div
            className="bw-glow-b absolute left-[30%] top-40 h-[380px] w-[440px] rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(154,156,203,0.16), transparent)",
            }}
          />
          <div
            className="bw-glow-a absolute right-[22%] top-8 h-[320px] w-[380px] rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(47,185,138,0.10), transparent)",
              animationDelay: "-7s",
            }}
          />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-5 pt-24 pb-16 text-center">
        <h1 className="text-headline text-5xl sm:text-7xl leading-[1.04]">
          <Words text="Stop runaway agents" start={0} />
          <br />
          <Words text="before they burn your budget." start={210} />
        </h1>
        <p
          className="reveal-in mx-auto mt-7 max-w-2xl text-[16px] sm:text-lg text-secondary leading-relaxed"
          style={{ animationDelay: "620ms" }}
        >
          Autonomous AI agents hold your API keys and spend real money. When one
          gets stuck in a loop, it drains your budget silently. Breakwater is the
          circuit breaker that watches every call and cuts off a runaway agent
          the instant it goes wrong.
        </p>
        <div
          className="reveal-in mt-10 flex items-center justify-center gap-3"
          style={{ animationDelay: "720ms" }}
        >
          <Link
            href="/get-started"
            className="rounded-md bg-accent/20 border border-border-strong px-6 py-3 text-[15px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get started for free →
          </Link>
          <a
            href="#how"
            className="rounded-md px-6 py-3 text-[15px] font-operational text-secondary transition-colors duration-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            How it works
          </a>
        </div>
        <p
          className="reveal-in mt-5 text-[12px] font-operational text-muted"
          style={{ animationDelay: "820ms" }}
        >
          No credit card. Connect your first agent in under a minute.
        </p>

        {/* Live vision: traffic flows through Breakwater; a runaway loop is cut. */}
        <div
          className="reveal-in mt-12 mx-auto max-w-3xl rounded-lg border border-border bg-surface/50 p-6 sm:p-10"
          style={{ animationDelay: "940ms" }}
        >
          <HeroFlow />
        </div>
        </div>
      </section>

      {/* The problem */}
      <Reveal>
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-6xl mx-auto px-5 py-16 grid gap-10 lg:grid-cols-3">
          <Stat
            k="Silent"
            t="A stuck agent doesn't crash"
            b="It just retries - the same failing call, over and over - with no error and no alert. Nobody notices until the invoice arrives."
          />
          <Stat
            k="Expensive"
            t="Tokens are money"
            b="An unattended loop can burn tens to hundreds of dollars in minutes. One bad overnight run can erase a month of margin."
          />
          <Stat
            k="Invisible"
            t="Hashing isn't enough"
            b="Smart agents reword every retry, slipping past naive duplicate checks. You need something that understands intent."
          />
        </div>
      </section>
      </Reveal>

      {/* How it works */}
      <Reveal>
      <section id="how" className="max-w-6xl mx-auto px-5 py-20 scroll-mt-16">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] font-operational text-accent">
            How it works
          </p>
          <h2 className="text-headline text-3xl sm:text-4xl mt-4">
            Protection in three moves.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <HowCard
            n="01"
            title="Connect"
            body="Point your agent's base URL at Breakwater and keep your own model and key. No SDK, no rewrite - one line, any framework."
          />
          <HowCard
            n="02"
            title="Inspect"
            body="Every call is checked twice: instant deterministic guards catch obvious loops in about a millisecond, and Gemini 2.5 Flash reads the agent's intent for the subtle ones."
          />
          <HowCard
            n="03"
            title="Protect"
            body="The moment an agent goes rogue, Breakwater trips the breaker - the connection is cut, the spend stops, and you see exactly why on your dashboard."
          />
        </div>
      </section>

      </Reveal>

      {/* Why / benefits */}
      <Reveal>
      <section className="border-y border-border bg-surface/40">
        <div className="max-w-6xl mx-auto px-5 py-16 grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-headline text-3xl">
              Real intelligence, not a dumb filter.
            </h2>
            <p className="mt-4 text-[15px] text-secondary leading-relaxed">
              Breakwater pairs sub-millisecond deterministic guards with Gemini
              2.5 Flash so it catches what simple rules miss - reworded loops,
              cost spirals, and prompt-injection attempts - and explains every
              decision in plain language a human can trust.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Benefit t="Drop-in proxy" b="One URL swap. Works with any agent framework." />
            <Benefit t="Gemini-powered" b="Semantic detection, not just string matching." />
            <Benefit t="Live dashboard" b="Every decision, streamed in real time." />
            <Benefit t="Real savings" b="See the runaway spend you avoided, per agent." />
          </div>
        </div>
      </section>

      </Reveal>

      {/* Pricing */}
      <Reveal>
      <section id="pricing" className="max-w-6xl mx-auto px-5 py-20">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] font-operational text-accent">
            Pricing
          </p>
          <h2 className="text-headline text-3xl sm:text-4xl mt-4">
            Start free. Scale when you do.
          </h2>
          <p className="mt-3 text-[14px] text-secondary">
            Every plan includes the full two-tier engine and the live dashboard.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <PricingCard key={id} id={id} featured={id === "team"} />
          ))}
        </div>
      </section>

      </Reveal>

      {/* Final CTA */}
      <Reveal>
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-20 text-center">
          <h2 className="text-headline text-4xl">
            Give your agents a safety net.
          </h2>
          <p className="mt-3 text-[15px] text-secondary">
            Connect your first agent in under a minute - free.
          </p>
          <Link
            href="/get-started"
            className="mt-8 inline-block rounded-md bg-accent/20 border border-border-strong px-7 py-3.5 text-[15px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get started for free →
          </Link>
        </div>
      </section>
      </Reveal>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-6 flex items-center justify-between text-[12px] font-operational text-muted">
          <span>Breakwater</span>
          <span>Powered by Gemini 2.5 Flash · Google Cloud Run</span>
        </div>
      </footer>
    </div>
  );
}

function Stat({ k, t, b }: { k: string; t: string; b: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] font-operational text-failure">
        {k}
      </p>
      <h3 className="text-headline text-xl mt-3">{t}</h3>
      <p className="mt-2.5 text-[14px] text-secondary leading-relaxed">{b}</p>
    </div>
  );
}

function HowCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-6 transition-colors duration-150 hover:border-border-strong">
      <span className="text-[12px] font-operational text-accent tabular-nums">
        {n}
      </span>
      <h3 className="text-headline text-2xl mt-3">{title}</h3>
      <p className="mt-3 text-[14px] text-secondary leading-relaxed">{body}</p>
    </div>
  );
}

function Benefit({ t, b }: { t: string; b: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <h4 className="text-[13px] font-operational text-foreground">{t}</h4>
      <p className="mt-1.5 text-[13px] text-secondary leading-relaxed">{b}</p>
    </div>
  );
}

const PLAN_BADGE: Record<PlanId, string> = {
  free: "Free forever",
  team: "Most popular",
  business: "Best for scale",
};

function PricingCard({ id, featured }: { id: PlanId; featured?: boolean }) {
  const p = PLANS[id];
  return (
    <div
      className={`rounded-md border bg-surface p-6 flex flex-col transition-colors duration-150 hover:border-border-strong ${
        featured ? "border-border-strong" : "border-border"
      }`}
    >
      {/* Every card carries a capsule so the plan names align on one line */}
      <span
        className={`self-start mb-4 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider font-operational border ${
          featured
            ? "bg-accent/20 border-border-strong text-secondary"
            : "border-border text-muted"
        }`}
      >
        {PLAN_BADGE[id]}
      </span>
      <h3 className="text-headline text-xl">{p.name}</h3>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-headline text-4xl tabular-nums">${p.price}</span>
        <span className="text-[13px] font-operational text-muted">/ mo</span>
      </div>
      <p className="mt-3 text-[13px] text-secondary leading-relaxed flex-1">
        {p.blurb}
      </p>
      <p className="mt-4 text-[13px] font-operational text-foreground">
        {p.agentLimit} agent{p.agentLimit === 1 ? "" : "s"}
      </p>
      <Link
        href="/get-started"
        className="mt-5 rounded-md border border-border-strong px-4 py-2.5 text-center text-[13px] font-operational text-foreground transition-colors duration-100 hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {id === "free" ? "Start free" : "Choose " + p.name}
      </Link>
    </div>
  );
}
