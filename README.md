# Breakwater — Autonomous Agent Risk & Capital Firewall

Breakwater is a **real reverse proxy circuit breaker** that sits between an
autonomous AI agent and the outside world. It evaluates every agent action with
**Google Gemini 1.5 Flash** (plus a zero-latency deterministic engine), and when
it detects a runaway loop it **physically trips the breaker — HTTP 429 and the
connection is terminated** — before more tokens and money are burned. A live
Next.js + WebSocket dashboard shows every decision as it happens.

No mocks: a genuine tool-calling agent enters a real infinite retry loop against
a failing API, and Breakwater kills it live.

## Architecture

```
  Real AI Agent (src/agent/realAgent.ts)
    goal: "get weather, retry until success"
    tool: fetchExternalData()  ── always gets HTTP 500 ──▶ runaway loop
        │  every action POSTed to
        ▼
  ┌──────────────────────────────────────────────┐
  │  Breakwater Reverse Proxy  (src/server/proxy.ts, :3001)
  │    1. Deterministic engine  (loop / rate / budget)  ← src/policy/*
  │    2. Gemini 1.5 Flash semantic eval               ← src/sponsors/gemini.ts
  │    3. BLOCK → HTTP 429 + connection: close
  │       PASS  → forward the tool call to the upstream API
  │    4. broadcast decision over WebSocket
  └──────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
  Upstream weather API           Next.js Dashboard (:3000)
  (/upstream/weather → 500)      ws://localhost:3001/ws  ← src/app/dashboard
```

## Quick Start

```bash
npm install
cp .env.example .env
# Add your free Google AI Studio key:  https://aistudio.google.com/app/apikey
export GEMINI_API_KEY="your-key"      # optional — see note below

# Terminal 1 — start the proxy (:3001) AND the dashboard (:3000)
npm run dev

# Terminal 2 — unleash the real runaway agent
npm run agent
```

Open **http://localhost:3000/dashboard**. Run the agent and watch: the first two
calls pass (the upstream API really returns 500), then on iteration #3 Breakwater
trips — the terminal shows `HTTP 429 BREAKWATER_CIRCUIT_BREAKER_TRIPPED`, the
agent dies, and the dashboard flashes the intercept in real time.

### Gemini vs. the heuristic engine

Gemini 1.5 Flash is the **primary** evaluator: with `GEMINI_API_KEY` set, its
semantic verdict and reasoning drive the feed, and the header shows
`GEMINI 1.5 FLASH · <live ms>`. Without a key, Breakwater **still trips loops**
via the deterministic engine (`src/policy/loopDetector.ts`) and the header shows
`HEURISTIC ENGINE` — so the demo runs even offline. The proxy logs which
evaluator made each call.

## The "dollars saved" number

`dollarsSaved` is an honest **projection**, not a realized charge. On each
intercept the proxy computes:

```
costPerCall      = estimateCost(AGENT_TARGET_MODEL, tokensThisCall)   // real, from context size
callsPerMinute   = 60000 / observed_interval_ms                       // real, measured cadence
dollarsSaved     = costPerCall × callsPerMinute × RUNAWAY_HORIZON_MINUTES
```

i.e. *"at this model, token size, and observed call rate, an unattended runaway
would burn ~$X over the next hour."* Tune `AGENT_TARGET_MODEL` and
`RUNAWAY_HORIZON_MINUTES` in `.env`.

## Edge cases handled

- **Context degradation** — the proxy trips the breaker (`evaluator: context-guard`)
  when a payload approaches the model's 128k context wall (`CONTEXT_TOKEN_CEILING`),
  halting the agent *before* the downstream model truncates or crashes.
- **Decision-latency SLA** — the deterministic guards (loop / budget / context)
  decide in **~1ms**, well inside the `DECISION_SLA_MS` (80ms) budget; each 429
  reports `withinSla`. Gemini 1.5 Flash adds semantic judgment on the requests the
  guards let through. Note: a real Gemini Flash round-trip is typically
  ~150–500ms — the dashboard shows the **real measured** latency, never a faked
  number, and the sub-80ms guarantee is served by the deterministic layer.
- **Gemini unavailable / timeout** — fails open to the deterministic engine so the
  breaker still trips (4s timeout in `src/sponsors/gemini.ts`).

## Scripts

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `npm run dev`      | proxy (:3001) + dashboard (:3000) together            |
| `npm run dev:proxy`| just the Fastify reverse proxy                        |
| `npm run dev:web`  | just the Next.js dashboard                            |
| `npm run agent`    | run the real runaway tool-calling agent               |
| `npm run build`    | production build of the dashboard                     |
| `npm run build:server` | compile the proxy + agent to `dist/`              |

## Deploy to Cloud Run

```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/breakwater
gcloud run deploy breakwater \
  --image gcr.io/YOUR_PROJECT/breakwater \
  --port 3000 \
  --set-env-vars "GEMINI_API_KEY=your_key" \
  --allow-unauthenticated
```

The multi-stage `Dockerfile` compiles the proxy and builds the dashboard, then
runs both (proxy on 3001, dashboard on 3000).

## License

MIT
