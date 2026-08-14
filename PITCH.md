# Breakwater — 2.5-minute demo script

Accurate narration for the Build with Gemini XPRIZE video. Numbers here match
what the app actually shows, so nothing contradicts the screen.

**Truth check (say these, not the old draft):**
- The model is **Gemini 2.5 Flash** (1.5 Flash was retired). Say "2.5 Flash" or
  just "Gemini Flash."
- The **deterministic tier decides in ~1 ms**. **Gemini's deep read takes a few
  seconds** (2–5s). Do NOT claim Gemini runs in 44 ms — that number is the
  deterministic tier, not Gemini.
- The savings figure is a **projection** — say **"projected runaway loss
  avoided,"** never "we saved $X."

---

## Setup before you hit record
- Left half of screen: dashboard at your Cloud Run URL (or `localhost:3000/dashboard`).
- Right half: a terminal in the project root.
- Proxy running with the key set (`Gemini (gemini-2.5-flash): LIVE ✅`).

---

## 0:00 – 0:20 — The problem
> "Autonomous AI agents are being handed real budgets and real tools. When one
> gets stuck — retrying a failing API forever — it doesn't crash. It quietly
> burns tokens and money until someone notices. Breakwater is a circuit breaker
> that sits in front of the agent and stops that live."

/ Show the dashboard, calm, "Circuit Breaker Active."

## 0:20 – 1:00 — Obvious loop, killed instantly
> "Here's a real agent trying to fetch weather from an API that keeps failing.
> It just retries the identical call."

/ Run: `npm run agent`

> "Breakwater's first tier is deterministic — a hash of the tool call. Three
> identical calls, and it trips in about a millisecond, for free. Watch the
> terminal: HTTP 429, the agent is killed. On the dashboard, the intercept
> appears live over WebSocket."

/ Point to the terminal `429` and the red intercept in the feed.

## 1:00 – 1:50 — The hard case: reworded retries (this is the Gemini moment)
> "But a smarter agent doesn't repeat itself word-for-word. It rephrases every
> retry — a different tool name, different wording — same intent. A hash never
> matches. This is where most guards fail."

/ Run: `npm run agent:semantic`

> "Every call is byte-different, so tier one lets them through. Now Gemini 2.5
> Flash reads the *trajectory* — the intent behind the sequence."

/ (There's a short pause here — that's Gemini doing the deep read. Let it breathe.)

> "Around the third attempt, Gemini sees it: same failing goal, no new strategy,
> cost climbing. It trips the breaker and explains why, in plain language."

/ Point to the terminal: `Evaluator: gemini-2.5-flash` and the reason string, and
the intercept flashing on the dashboard with Gemini's own words.

## 1:50 – 2:15 — Why two tiers
> "That's the architecture: a sub-millisecond deterministic tier for the obvious
> loops, and Gemini 2.5 Flash for the semantic drift that hashing can't see. Fast
> and cheap where it can be, deeply intelligent where it has to be."

## 2:15 – 2:30 — Business + close
> "Inspection costs a fraction of a cent per check. A single intercepted runaway
> loop saves tens to hundreds of dollars in wasted API spend. It's a drop-in
> reverse proxy — change one base URL and any agent framework is protected.
> That's Breakwater."

/ End on the dashboard: projected loss avoided, live.

---

## Do / Don't
- **Do** say "projected" for the savings number.
- **Do** let the multi-second Gemini pause happen — it's proof it's a real model
  call, not a lookup.
- **Don't** say "1.5 Flash" or "44 milliseconds for Gemini."
- **Don't** state the dollar figure as money you actually saved.
- If Gemini is slow on the very first call, run one agent before recording to
  warm it (the proxy also self-warms on startup).
