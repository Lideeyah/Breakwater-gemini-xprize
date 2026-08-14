# Breakwater — Devpost Case Study

*An autonomous risk and capital firewall for AI agents, powered by Gemini 2.5 Flash.*

## Inspiration

Companies are handing autonomous AI agents real budgets and real tools, then
walking away. The failure mode nobody plans for isn't a crash — it's an agent
that gets *stuck*. It retries a failing API, re-reasons in circles, or slowly
inflates its context, and it does this silently, burning tokens and money until
a human happens to notice the bill. For a small business, one unattended runaway
loop overnight can erase a month of margin. We wanted a safety layer that stops
that in real time, the way a circuit breaker trips before a fire starts.

## What it does

Breakwater is a transparent reverse proxy that sits between an autonomous agent
and the outside world. Every action the agent takes is routed through it. For
each one, Breakwater decides — in real time — whether to **allow** it or **trip
the breaker**, physically returning HTTP 429 and terminating the connection so
the agent halts instead of looping. Every decision streams live to a dashboard
over WebSockets, so an operator can watch traffic, intercepts, and projected
loss avoided with zero page refreshes.

It runs a **two-tier decision engine**:

- **Tier 1 — deterministic (~1 ms, free):** hashing catches identical repeated
  calls; structural checks catch same-shaped retries; budget, rate, and a
  128k-context guard stop cost and context-window blowouts before they reach the
  model. This handles the obvious 90% for essentially zero cost.
- **Tier 2 — Gemini 2.5 Flash (semantic):** on everything Tier 1 lets through,
  Gemini reads the agent's *trajectory* and judges intent. This is what catches
  the cases hashing cannot: an agent that **rephrases every retry** — different
  tool name, different wording, same doomed goal. A hash sees eight unique
  requests; Gemini sees one runaway loop, trips the breaker, and explains why in
  plain language ("repeatedly calling a weather API that returns 500 — a runaway
  loop and cost escalation").

## How Gemini powers it

Gemini 2.5 Flash is the intelligence at the core of the product, not a feature
bolted on. It is the only component that can reason about *semantic drift*,
*cost escalation with no progress*, and *prompt-injection intent* — the failure
modes that deterministic rules are blind to. We use the Google AI Studio SDK
(`@google/generative-ai`) with structured JSON output, so every verdict comes
back as a typed `{ approved, riskScore, reason }` the proxy can act on
instantly. Because Gemini Flash is fast and inexpensive, we can afford to inspect
live, in the critical path, on production agent traffic.

## Daily operations: human vs. AI

The system is designed to run unattended. In normal operation:

- **The AI (Gemini) does the judgment work** a human reviewer would otherwise
  have to do — reading each agent trajectory and deciding whether it has gone
  off the rails. This happens autonomously, thousands of times, with no human in
  the loop per decision.
- **The deterministic engine does the reflexes** — instant, free blocks on
  obvious loops and budget breaches.
- **The human is the operator, not the reviewer.** A person sets policy (budget
  ceilings, thresholds), watches the live dashboard, and steps in only when an
  intercept is flagged for a judgment call. Their day is supervision and tuning,
  not babysitting every agent call.

## Business model & unit economics

Breakwater sells as a drop-in SaaS: change one base URL and any agent framework
(LangChain, CrewAI, AutoGen, a raw OpenAI client) is protected — no code rewrite.

- **COGS per inspection:** a Gemini 2.5 Flash trajectory check is roughly **1–2k
  input tokens and ~80 output tokens ≈ $0.0006** — well under a tenth of a cent.
  The deterministic tier that handles most traffic is **$0**.
- **Value per event:** a single intercepted runaway loop typically prevents
  **$15–$250+** in wasted API spend (an unattended GPT-4 loop burns that in
  minutes to hours).
- **Pricing:** **$49/month per agent fleet.** Even at heavy inspection volume,
  COGS is a few dollars per fleet per month, for a **~95%+ gross margin.**

The economics are the pitch: it costs a fraction of a cent to prevent a loss
that is orders of magnitude larger.

## How we built it

A Fastify reverse proxy (agent API + WebSocket telemetry + the failing upstream)
fronts a Next.js 14 dashboard with Tremor charts. Gemini 2.5 Flash provides the
semantic tier. The whole thing ships as one container on Google Cloud Run behind
a single HTTPS URL.

## Challenges

The hardest design decision was resisting the urge to make Gemini a "smarter
hash." A full LLM call on every identical retry is slow and wasteful. The
two-tier architecture — deterministic reflexes first, Gemini for genuine
semantic judgment — is what makes it both fast and intelligent, and it is the
honest answer to "why not just use a hash map?"

## What's next

Shared state (Redis) for horizontal scale, more policy types, first-class
framework adapters, and semantic-cache reuse of Gemini verdicts to drive COGS
even lower.
