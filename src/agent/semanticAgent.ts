/**
 * semanticAgent.ts — a REAL autonomous agent that defeats string-hashing.
 *
 * This is the Tier-2 demo. Unlike realAgent.ts (which fires the SAME failing
 * tool call over and over, so a 1ms hash catches it), this agent REPHRASES its
 * retry every single iteration: a different tool name, different argument
 * wording, a different rationale. The intent is identical — "get the San
 * Francisco weather, the last attempt failed, try again" — but every payload is
 * byte-different, so the deterministic exact-hash check never matches.
 *
 * That is the whole point: semantic drift / reworded retries are INVISIBLE to a
 * HashMap. Only Tier 2 — Gemini Flash reading the underlying INTENT of the
 * trajectory — can see that the agent is looping and trip the breaker.
 *
 * Run it:  npm run agent:semantic   (requires GEMINI_API_KEY for the live catch)
 */

const PROXY_URL = process.env.PROXY_URL || "http://localhost:3001";
const EXECUTE_ENDPOINT = `${PROXY_URL}/v1/agent/execute`;
const AGENT_ID = process.env.AGENT_ID || "semantic-drift-agent-01";
const GOAL =
  "Get the current weather for San Francisco. Keep trying different approaches until it works.";

const MAX_ITERATIONS = 30;
const RETRY_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// tiny ANSI helpers
// ---------------------------------------------------------------------------
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Message {
  role: string;
  content: string;
}

interface ExecuteResponse {
  approved?: boolean;
  evaluator?: string;
  evaluationLatencyMs?: number;
  tokensProcessed?: number;
  toolResult?: { status: number; body: unknown };
  error?: string;
  reason?: string;
  riskScore?: number;
  projectedDollarsSaved?: number;
}

// Same intent, endlessly reworded. Each of these is a DIFFERENT byte string, so
// the exact-hash loop detector sees them all as "new" — yet a human (and
// Gemini) instantly recognises they are the same failing retry.
const TOOL_SYNONYMS = [
  "fetchExternalData",
  "getWeatherData",
  "retrieveForecast",
  "pollWeatherApi",
  "queryWeatherService",
  "requestConditions",
  "lookupCurrentWeather",
  "callWeatherEndpoint",
];

const QUERY_PHRASINGS = [
  "current weather in San Francisco",
  "what's it like in SF right now",
  "San Francisco conditions today",
  "present temperature, San Fran CA",
  "live weather for the SF Bay",
  "how warm is it in San Francisco",
  "today's forecast, San Francisco California",
  "real-time SF weather readout",
];

const RATIONALES = [
  "the last call failed, let me try a slightly different endpoint",
  "maybe rephrasing the request will get through this time",
  "previous attempt errored out, retrying with new wording",
  "the API keeps failing, trying an alternate tool name",
  "still no data, adjusting my approach and trying again",
  "that did not work either, another variation should help",
  "reformulating the same request one more time",
  "the goal is not met yet, attempting a fresh phrasing",
];

/** Build a reworded-but-equivalent tool call for iteration i. */
function driftingCall(i: number) {
  const tool = TOOL_SYNONYMS[i % TOOL_SYNONYMS.length];
  const query = QUERY_PHRASINGS[i % QUERY_PHRASINGS.length];
  const rationale = RATIONALES[i % RATIONALES.length];
  // Vary the note length so even the STRUCTURAL (length-bucketed) hash is
  // dodged for the early iterations — Gemini still gets the first catch.
  const note = `attempt-${i}: ${rationale}${". again".repeat(i % 5)}`;
  return {
    tool,
    args: {
      query,
      endpoint: `/upstream/weather?v=${i}`,
      city: "San Francisco",
      note,
    },
  };
}

async function main(): Promise<void> {
  console.log();
  console.log(
    c.bold(c.magenta("  🤖 Semantic-Drift Agent — reworded retries (defeats hashing)")),
  );
  console.log(c.dim(`  Goal:  ${GOAL}`));
  console.log(c.dim(`  Proxy: ${EXECUTE_ENDPOINT}`));
  console.log(
    c.dim(
      "  Note:  every retry uses a DIFFERENT tool name + wording → the 1ms hash",
    ),
  );
  console.log(
    c.dim("         never matches. Only Gemini (Tier 2) can catch this."),
  );
  console.log();

  const history: Message[] = [
    { role: "system", content: `You are an autonomous agent. Goal: ${GOAL}` },
    { role: "user", content: "Please get me the current San Francisco weather." },
  ];

  let lastResult = "";

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const call = driftingCall(i);

    history.push({
      role: "assistant",
      content:
        `${call.args.note}. Calling ${call.tool} with query "${call.args.query}".`,
    });

    console.log(
      c.bold(`  [iteration ${String(i).padStart(2, " ")}] `) +
        `${c.magenta(call.tool + "()")} ${c.dim(`"${call.args.query}"`)}`,
    );

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(EXECUTE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-agent-id": AGENT_ID },
        body: JSON.stringify({
          agentId: AGENT_ID,
          goal: GOAL,
          history,
          currentCall: { ...call, lastResult: lastResult || undefined },
        }),
      });
    } catch (err) {
      console.log(
        c.yellow(
          `        ⚠️  could not reach Breakwater proxy: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
      console.log(c.dim("        Is the proxy running?  npm run dev"));
      process.exit(1);
    }

    const latency = Date.now() - start;
    const data = (await res.json().catch(() => ({}))) as ExecuteResponse;

    // ---- BREAKWATER TRIPPED ----------------------------------------------
    if (res.status === 429) {
      const viaGemini = (data.evaluator ?? "").includes("gemini");
      console.log();
      console.log(
        c.red(c.bold("  ⛔ HTTP 429 — BREAKWATER_CIRCUIT_BREAKER_TRIPPED")),
      );
      console.log(
        (viaGemini ? c.magenta : c.red)(
          `     Evaluator: ${data.evaluator ?? "?"}  ` +
            `(risk ${(Number(data.riskScore ?? 0) * 100).toFixed(0)}/100, ` +
            `${data.evaluationLatencyMs ?? latency}ms)`,
        ),
      );
      console.log(c.red(`     Reason:    ${data.reason ?? "runaway loop"}`));
      if (data.projectedDollarsSaved != null) {
        console.log(
          c.green(
            `     Loss avoided: ~$${data.projectedDollarsSaved.toFixed(2)} in ` +
              `projected runaway API spend`,
          ),
        );
      }
      console.log();
      if (viaGemini) {
        console.log(
          c.bold(
            c.magenta(
              "  🧠 Caught by Gemini Flash — semantic intent, not a string match.",
            ),
          ),
        );
      }
      console.log(
        c.bold(c.red("  🪦 Agent killed by Breakwater Proxy. Shutting down gracefully.")),
      );
      console.log();
      process.exit(0);
    }

    // ---- FORWARDED: tool ran, upstream failed ----------------------------
    const toolStatus = data.toolResult?.status ?? 0;
    lastResult = `HTTP ${toolStatus}`;
    history.push({
      role: "tool",
      content: `${call.tool} returned HTTP ${toolStatus} — ${JSON.stringify(
        data.toolResult?.body ?? {},
      )}`,
    });

    console.log(
      `        ${c.green("✔ passed Tier 1")} ${c.dim(
        `[${data.evaluator ?? "?"} ${data.evaluationLatencyMs ?? latency}ms]`,
      )} → ${c.red(`HTTP ${toolStatus}`)} ${c.dim("(same failure, new wording)")}`,
    );

    await sleep(RETRY_DELAY_MS);
  }

  // Reached only if the breaker never tripped — i.e. Gemini was offline and the
  // reworded retries slipped past deterministic hashing entirely. That is the
  // point of the demo: without Tier 2, semantic drift runs unchecked.
  console.log();
  console.log(
    c.yellow(
      `  Ran ${MAX_ITERATIONS} reworded retries WITHOUT being stopped.`,
    ),
  );
  console.log(
    c.yellow(
      "  Deterministic hashing could not see the loop — the wording changed every time.",
    ),
  );
  console.log(
    c.bold(
      c.yellow(
        "  → Export GEMINI_API_KEY and re-run: Tier 2 (Gemini Flash) catches it in ~3 iterations.",
      ),
    ),
  );
  console.log();
  process.exit(1);
}

main().catch((err) => {
  console.error(c.red("Fatal agent error:"), err);
  process.exit(1);
});
