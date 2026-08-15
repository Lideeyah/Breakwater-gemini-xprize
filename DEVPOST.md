# Devpost submission kit - Breakwater

Copy-paste these into the matching Devpost fields.

---

## Project name
Breakwater

## Elevator pitch (short tagline - keep under ~200 characters)
A real-time circuit breaker for autonomous AI agents. Gemini 2.5 Flash catches
runaway loops and cost blowouts hashing can't see, and physically kills the agent
before it drains a budget.

## "Try it out" links
- Live app (Google Cloud Run): https://breakwater-1074189130680.us-central1.run.app
- Live dashboard: https://breakwater-1074189130680.us-central1.run.app/dashboard
- GitHub repo: https://github.com/Lideeyah/Breakwater-gemini-xprize

## Built with (tags)
google-gemini, gemini-2.5-flash, google-ai-studio, google-cloud, cloud-run,
cloud-build, typescript, next.js, fastify, websockets, tremor, docker, node.js

---

## Description (paste into the main "About the project" body)

### Inspiration
Companies are handing autonomous AI agents real budgets and real tools, then
walking away. The failure mode nobody plans for isn't a crash - it's an agent
that gets *stuck*: it retries a failing API forever, re-reasons in circles, or
inflates its context, quietly burning tokens and money until a human notices the
bill. For a small business, one unattended runaway loop overnight can erase a
month of margin. Breakwater is a circuit breaker that stops that live.

### What it does
Breakwater is a transparent reverse proxy that sits in front of an autonomous
agent. Every action is routed through it, and for each one it decides - in real
time - whether to allow it or trip the breaker, physically returning HTTP 429 and
terminating the connection so the agent halts instead of looping. Every decision
streams to a live dashboard over WebSockets.

It runs a **two-tier engine**:
- **Tier 1 - deterministic (~1 ms, free):** hashing catches identical repeats;
  structural, budget, rate, and a 128k-context guard stop the obvious cases for
  zero cost.
- **Tier 2 - Gemini 2.5 Flash:** on everything Tier 1 lets through, Gemini reads
  the agent's *trajectory* and judges intent - catching the case hashing can't:
  an agent that **rephrases every retry** (different tool name, different wording,
  same doomed goal). A hash sees eight unique requests; Gemini sees one runaway
  loop, trips the breaker, and explains why in plain language.

### How we built it
A Fastify reverse proxy (agent API + WebSocket telemetry + the failing upstream)
fronts a Next.js 14 + Tremor dashboard. Gemini 2.5 Flash via the Google AI Studio
SDK provides the semantic tier with structured JSON output. It ships as one
container on Google Cloud Run behind a single HTTPS URL - the proxy serves the
API, the live WebSocket, and the dashboard all on one origin.

### Challenges we ran into
The hardest call was resisting the urge to make Gemini a "smarter hash." A full
LLM call on every identical retry is slow and wasteful. The two-tier design -
deterministic reflexes first, Gemini for genuine semantic judgment - is what
makes it both fast and intelligent, and it's the honest answer to "why not just
use a hash map?"

### Accomplishments we're proud of
A real, deployed system - not a mockup. You can open the live URL, point an agent
at it, and watch Gemini 2.5 Flash catch a reworded runaway loop in production and
kill the connection, with its reasoning shown live on the dashboard.

### What we learned
Deterministic guards and an LLM are complementary, not competing: reflexes for
the obvious, intelligence for the subtle. Putting a fast, cheap model like Gemini
Flash directly in the critical path is genuinely practical.

### What's next
A drop-in OpenAI-compatible passthrough (protect any agent by swapping one base
URL), shared state for horizontal scale, framework adapters (LangChain, CrewAI,
AutoGen), and semantic-cache reuse of Gemini verdicts to drive cost lower.

---

## Business model / P&L (if a separate field is required)
Drop-in SaaS at **$49/month per agent fleet**. A Gemini 2.5 Flash inspection
costs ~**$0.0006** (a fraction of a cent); the deterministic tier that handles
most traffic is **$0**. A single intercepted runaway loop prevents **$15–$250+**
in wasted API spend. Result: **~95%+ gross margin** - it costs a fraction of a
cent to prevent a loss orders of magnitude larger.

## Submission checklist
- [ ] Cloud Run URL pasted above and returns `geminiLive: true` at `/health`.
- [ ] GitHub repo public OR shared with `testing@devpost.com` and `judging@hacker.fund`.
- [ ] Demo video uploaded (script in PITCH.md).
- [ ] This description + P&L pasted into Devpost.
