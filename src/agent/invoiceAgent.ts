/**
 * invoiceAgent.ts - a REAL autonomous billing agent (no mock).
 *
 * The agent's goal: charge invoice #4471 for $250. Its tool, `chargeInvoice`,
 * routes through the payment gateway, which is currently failing (HTTP 500).
 * Like a real misbehaving agent it retries the identical failing charge, with
 * no change in strategy - a true unbounded runaway loop that burns real money
 * on every iteration.
 *
 * Every action is routed through the Breakwater proxy (/v1/agent/execute). The
 * agent has no idea Breakwater exists until, mid-loop, the proxy trips the
 * circuit breaker and returns HTTP 429. Because the agent carries a realistic
 * mid-task context, the proxy's projected-loss figure is meaningful, not a stub.
 *
 * Run it:  npm run agent:invoice   (or: npx tsx src/agent/invoiceAgent.ts)
 * Against the live proxy:  PROXY_URL=https://<service-url> npm run agent:invoice
 */

const PROXY_URL = process.env.PROXY_URL || "http://localhost:3001";
const EXECUTE_ENDPOINT = `${PROXY_URL}/v1/agent/execute`;
const AGENT_ID = process.env.AGENT_ID || "invoice-processor";
const GOAL =
  "Charge invoice #4471 for $250 against the corporate account and retry until the gateway succeeds.";

const MAX_ITERATIONS = 30;
const RETRY_DELAY_MS = 700;

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
  error?: string;
  reason?: string;
  riskScore?: number;
  projectedDollarsSaved?: number;
}

// A realistic mid-task context. A real runaway is deep in a job, carrying a
// large conversation, when the loop begins - which is why the billed cost (and
// therefore the projected runaway loss) is meaningful.
const PRIOR_WORK = [
  "Retrieved the outstanding invoice ledger for the corporate account and confirmed invoice 4471 is due today for $250.",
  "Validated the billing contact and confirmed the payment instrument on file is the primary corporate card.",
  "Checked available credit on the account and confirmed sufficient headroom to cover the charge without a hold.",
  "Reviewed the collection policy for this cycle and noted this is the first scheduled attempt, so standard retry cadence applies.",
  "Assembled the charge request payload, set the currency to USD, and attached the idempotency key for this transaction.",
  "Notified the finance processing queue that the charge for invoice 4471 has begun and recorded the intent in the audit log.",
  "Confirmed the gateway endpoint and the merchant descriptor that will appear on the customer statement.",
  "Loaded the tax and fee schedule for the account region and confirmed no additional adjustments are required.",
];

function seedHistory(): Message[] {
  const h: Message[] = [
    { role: "system", content: `You are an autonomous billing agent. Goal: ${GOAL}` },
    { role: "user", content: "Please charge invoice #4471 for $250 now." },
  ];
  for (let i = 0; i < 26; i++) {
    const w = PRIOR_WORK[i % PRIOR_WORK.length];
    h.push({ role: "assistant", content: `Step ${i + 1}: ${w}` });
    h.push({ role: "tool", content: `ok, recorded. ${w}` });
  }
  return h;
}

function chargeInvoice() {
  return {
    tool: "chargeInvoice",
    args: { id: 4471, amount: 250, currency: "USD" },
  };
}

async function main(): Promise<void> {
  console.log();
  console.log(c.bold(c.cyan("  🤖 Real Autonomous Agent - invoice-processor")));
  console.log(c.dim(`  Goal:  ${GOAL}`));
  console.log(c.dim(`  Proxy: ${EXECUTE_ENDPOINT}`));
  console.log(c.dim("  Tool:  chargeInvoice() → payment gateway (currently failing)"));
  console.log();

  const history = seedHistory();
  let lastResult = "";

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const call = chargeInvoice();

    history.push({
      role: "assistant",
      content:
        `Attempt ${i}: charge not yet settled, retrying ${call.tool}` +
        `(#${call.args.id}, $${call.args.amount}) with no change in strategy.`,
    });

    console.log(
      c.bold(`  [iteration ${String(i).padStart(2, " ")}] `) +
        `calling ${c.cyan("chargeInvoice(#4471, $250)")} → gateway`,
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
      process.exit(1);
    }

    const latency = Date.now() - start;
    const data = (await res.json().catch(() => ({}))) as ExecuteResponse;

    if (res.status === 429) {
      console.log();
      console.log(c.red(c.bold("  ⛔ HTTP 429 - BREAKWATER_CIRCUIT_BREAKER_TRIPPED")));
      console.log(
        c.red(
          `     Evaluator: ${data.evaluator ?? "?"}  (${
            data.evaluationLatencyMs ?? latency
          }ms)`,
        ),
      );
      console.log(c.red(`     Reason:    ${data.reason ?? "runaway loop"}`));
      if (data.projectedDollarsSaved != null) {
        console.log(
          c.green(
            `     Saved:     ~$${data.projectedDollarsSaved.toFixed(2)} in projected runaway spend`,
          ),
        );
      }
      console.log();
      console.log(c.bold(c.red("  🪦 Agent halted by Breakwater. Shutting down gracefully.")));
      console.log();
      process.exit(0);
    }

    const toolStatus = data.toolResult?.status ?? 0;
    lastResult = `HTTP ${toolStatus}`;
    history.push({
      role: "tool",
      content: `chargeInvoice returned HTTP ${toolStatus} - gateway declined (temporary failure).`,
    });

    console.log(
      `        ${c.green("✔ approved")} ${c.dim(
        `[${data.evaluator ?? "?"} ${data.evaluationLatencyMs ?? latency}ms]`,
      )} → gateway: ${c.red(`HTTP ${toolStatus}`)} ${c.dim("(charge still failing)")}`,
    );

    await sleep(RETRY_DELAY_MS);
  }

  console.log(
    c.yellow(
      `  Reached MAX_ITERATIONS (${MAX_ITERATIONS}) without interception - is the proxy evaluating?`,
    ),
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(c.red("Fatal agent error:"), err);
  process.exit(1);
});
