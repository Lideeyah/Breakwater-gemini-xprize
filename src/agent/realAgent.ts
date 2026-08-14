/**
 * realAgent.ts — a REAL autonomous tool-calling agent (no mock).
 *
 * The agent is given a genuine goal: "get the current weather, retry until it
 * succeeds." Its only tool, `fetchExternalData`, hits an external weather API
 * that is permanently down (HTTP 500). Like a real misbehaving agent, it keeps
 * retrying the identical failing call forever — a true unbounded runaway loop.
 *
 * Every action is routed through the Breakwater proxy (/v1/agent/execute).
 * The agent has NO idea Breakwater exists until, mid-loop, the proxy trips the
 * circuit breaker and returns HTTP 429 — at which point the agent is killed.
 *
 * Run it:  npm run agent     (or: npx tsx src/agent/realAgent.ts)
 */

const PROXY_URL = process.env.PROXY_URL || "http://localhost:3001";
const EXECUTE_ENDPOINT = `${PROXY_URL}/v1/agent/execute`;
const AGENT_ID = process.env.AGENT_ID || "weather-agent-01";
const GOAL =
  "Fetch the current weather for San Francisco and retry until the API succeeds.";

// Hard safety cap so the process always terminates even if the proxy is down
// or misconfigured. In a healthy demo Breakwater trips long before this.
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
  // 429 shape
  error?: string;
  reason?: string;
  riskScore?: number;
  projectedDollarsSaved?: number;
}

/**
 * The agent's single tool. Note: the agent does not fetch the weather API
 * directly — it asks Breakwater to execute the call, which is what puts the
 * proxy in the critical path of every action.
 */
function fetchExternalData() {
  return {
    tool: "fetchExternalData",
    args: { endpoint: "/upstream/weather", city: "San Francisco" },
  };
}

async function main(): Promise<void> {
  console.log();
  console.log(c.bold(c.cyan("  🤖 Real Autonomous Agent — weather-agent-01")));
  console.log(c.dim(`  Goal:  ${GOAL}`));
  console.log(c.dim(`  Proxy: ${EXECUTE_ENDPOINT}`));
  console.log(
    c.dim("  Tool:  fetchExternalData() → external weather API (currently failing)"),
  );
  console.log();

  const history: Message[] = [
    { role: "system", content: `You are an autonomous agent. Goal: ${GOAL}` },
    { role: "user", content: "What's the weather in San Francisco right now?" },
  ];

  let lastResult = "";

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const call = fetchExternalData();

    // The agent "reasons": goal not met → I must call my tool again.
    history.push({
      role: "assistant",
      content:
        `Attempt ${i}: goal not yet satisfied, calling ${call.tool} ` +
        `on ${call.args.endpoint} for ${call.args.city}.`,
    });

    console.log(
      c.bold(`  [iteration ${String(i).padStart(2, " ")}] `) +
        `calling ${c.cyan("fetchExternalData()")} → ${call.args.endpoint}`,
    );

    const start = Date.now();
    let res: Response;
    try {
      res = await fetch(EXECUTE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-id": AGENT_ID,
        },
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
      console.log(
        c.dim("        Is the proxy running?  npm run dev  (or npm run dev:proxy)"),
      );
      process.exit(1);
    }

    const latency = Date.now() - start;
    const data = (await res.json().catch(() => ({}))) as ExecuteResponse;

    // ---- BREAKWATER TRIPPED ------------------------------------------------
    if (res.status === 429) {
      console.log();
      console.log(
        c.red(c.bold("  ⛔ HTTP 429 — BREAKWATER_CIRCUIT_BREAKER_TRIPPED")),
      );
      console.log(
        c.red(`     Evaluator: ${data.evaluator ?? "?"}  ` +
          `(risk ${(Number(data.riskScore ?? 0) * 100).toFixed(0)}/100, ` +
          `${data.evaluationLatencyMs ?? latency}ms)`),
      );
      console.log(c.red(`     Reason:    ${data.reason ?? "runaway loop"}`));
      if (data.projectedDollarsSaved != null) {
        console.log(
          c.green(
            `     Saved:     ~$${data.projectedDollarsSaved.toFixed(2)} in ` +
              `projected runaway API spend`,
          ),
        );
      }
      console.log();
      console.log(
        c.bold(c.red("  🪦 Agent killed by Breakwater Proxy. Shutting down gracefully.")),
      );
      console.log();
      process.exit(0);
    }

    // ---- FORWARDED: the tool ran, but the upstream API failed --------------
    const toolStatus = data.toolResult?.status ?? 0;
    lastResult = `HTTP ${toolStatus}`;
    history.push({
      role: "tool",
      content: `fetchExternalData returned HTTP ${toolStatus} — ${JSON.stringify(
        data.toolResult?.body ?? {},
      )}`,
    });

    const evalTag = c.dim(
      `[${data.evaluator ?? "?"} ${data.evaluationLatencyMs ?? latency}ms]`,
    );
    console.log(
      `        ${c.green("✔ approved")} ${evalTag} → tool result: ` +
        `${c.red(`HTTP ${toolStatus}`)} ${c.dim("(external API still failing)")}`,
    );
    console.log(
      c.dim(
        `        goal not met → agent will retry the same call (this is the runaway loop)`,
      ),
    );

    await sleep(RETRY_DELAY_MS);
  }

  // Reached only if Breakwater never tripped (shouldn't happen in the demo).
  console.log();
  console.log(
    c.yellow(
      `  Reached MAX_ITERATIONS (${MAX_ITERATIONS}) without interception — ` +
        `check that the Breakwater proxy is running and evaluating.`,
    ),
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(c.red("Fatal agent error:"), err);
  process.exit(1);
});
