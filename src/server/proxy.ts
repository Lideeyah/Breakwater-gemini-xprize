/**
 * Breakwater Reverse Proxy — the real circuit breaker.
 *
 * A Fastify HTTP + WebSocket server that sits between an autonomous AI agent
 * and the outside world. Every agent action is POSTed to /v1/agent/execute,
 * where Breakwater:
 *
 *   1. runs a zero-latency deterministic policy engine (loop / rate / budget),
 *   2. asks Google Gemini Flash to semantically judge the trajectory,
 *   3. BLOCKS (HTTP 429, connection terminated) or FORWARDS the action,
 *   4. broadcasts the decision live to every dashboard over WebSocket.
 *
 * It also hosts the failing "external weather API" the demo agent calls, so
 * the whole loop → intercept flow runs on one machine with one command.
 */

import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import httpProxy from "@fastify/http-proxy";
import type { WebSocket } from "ws";

import { PolicyEngine } from "../policy/engine.js";
import {
  GeminiEvaluator,
  TrajectoryMessage,
  ToolCall,
} from "../sponsors/gemini.js";
import { estimateMessagesTokens } from "../utils/tokenCounter.js";
import { estimateCost } from "../utils/costEstimator.js";
import { logger } from "../utils/logger.js";

// Load .env for local dev so GEMINI_API_KEY reaches the proxy. On Cloud Run the
// file is absent (env vars are injected via --set-env-vars), so this no-ops.
try {
  process.loadEnvFile();
} catch {
  /* no .env file present — rely on the real environment */
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PROXY_PORT || process.env.PORT || "3001", 10);
// The model the runaway agent would be burning on every loop iteration.
// gpt-4 is the pessimistic (expensive) case — used for honest cost projection.
const AGENT_TARGET_MODEL = process.env.AGENT_TARGET_MODEL || "gpt-4";
// Horizon for the "dollars saved" projection: how long an unattended runaway
// would keep looping before a human noticed. Clearly a projection, not a
// realized charge — surfaced as such in the dashboard + README.
const RUNAWAY_HORIZON_MINUTES = parseFloat(
  process.env.RUNAWAY_HORIZON_MINUTES || "60",
);
// Hard model context wall. Breakwater trips BEFORE the downstream model
// truncates or crashes on an over-length payload (the "context degradation"
// failure mode). Default guard fires as the payload approaches the 128k limit.
const MODEL_CONTEXT_LIMIT = parseInt(
  process.env.MODEL_CONTEXT_LIMIT || "128000",
  10,
);
const CONTEXT_TOKEN_CEILING = parseInt(
  process.env.CONTEXT_TOKEN_CEILING || "120000",
  10,
);
// Decision-latency SLA. The deterministic guards (loop / budget / context)
// decide in well under this; Gemini Flash adds semantic depth on the
// requests the guards let through.
const DECISION_SLA_MS = parseInt(process.env.DECISION_SLA_MS || "80", 10);

// Single-origin mode (for Cloud Run, where only ONE port is exposed). When
// enabled, Fastify also fronts the Next.js dashboard running internally, so the
// dashboard, its same-origin WebSocket (/ws) and the agent API all live behind
// one HTTPS URL. Off by default so local dev keeps proxy(:3001) + web(:3000).
const SERVE_DASHBOARD = process.env.SERVE_DASHBOARD === "1";
const NEXT_INTERNAL_PORT = parseInt(
  process.env.NEXT_INTERNAL_PORT || "3000",
  10,
);

// ---------------------------------------------------------------------------
// Wire event shape broadcast to dashboards
// ---------------------------------------------------------------------------
type WireEventType = "intercept" | "pass" | "warn" | "alert";

interface WireEvent {
  id: string;
  type: WireEventType;
  timestamp: number;
  data: {
    verdict: "block" | "pass";
    reason: string;
    riskScore: number;
    latencyMs: number; // real Gemini (or heuristic) evaluation latency
    evaluator: string; // "gemini-1.5-flash" | "heuristic" | "unavailable"
    tokensProcessed?: number; // tokens actually forwarded (pass)
    tokensSaved?: number; // tokens this blocked call would have burned
    dollarsSaved?: number; // projected runaway cost avoided
    agentId: string;
    tool?: string;
    toolResultStatus?: number;
  };
}

// ---------------------------------------------------------------------------
// Request body
// ---------------------------------------------------------------------------
interface ExecuteBody {
  agentId?: string;
  goal?: string;
  history?: TrajectoryMessage[];
  currentCall?: ToolCall;
}

// ---------------------------------------------------------------------------
// Running totals (real, cumulative for the lifetime of the process)
// ---------------------------------------------------------------------------
const totals = {
  requests: 0,
  intercepts: 0,
  tokensProcessed: 0,
  dollarsSaved: 0,
};

// Per-agent timestamp of the previous request — used to measure the real
// observed call cadence for the runaway projection.
const lastRequestTs = new Map<string, number>();

async function main(): Promise<void> {
  const server = Fastify({ logger: false, requestTimeout: 30_000 });

  // In single-origin mode everything is same-origin, so CORS is unnecessary —
  // and skipping it avoids its wildcard OPTIONS route colliding with the
  // http-proxy catch-all below. In two-origin dev we keep permissive CORS.
  if (!SERVE_DASHBOARD) {
    await server.register(cors, { origin: true });
  }
  await server.register(websocket);

  GeminiEvaluator.initialize();
  // Warm the model + connection so the first live evaluation isn't a cold start.
  void GeminiEvaluator.warmUp();

  // -------------------------------------------------------------------------
  // WebSocket fan-out to dashboards
  // -------------------------------------------------------------------------
  const clients = new Set<WebSocket>();

  function broadcast(event: WireEvent): void {
    const payload = JSON.stringify(event);
    for (const socket of clients) {
      // 1 === WebSocket.OPEN
      if (socket.readyState === 1) {
        try {
          socket.send(payload);
        } catch {
          /* client vanished mid-send */
        }
      }
    }
  }

  server.get("/ws", { websocket: true }, (socket: WebSocket) => {
    clients.add(socket);
    logger.info("ws:client-connected", { total: clients.size });

    // Greet the new client with a snapshot so late joiners aren't blank.
    socket.send(
      JSON.stringify({
        id: "hello",
        type: "hello",
        timestamp: Date.now(),
        data: {
          geminiLive: GeminiEvaluator.isLive,
          totals,
        },
      }),
    );

    socket.on("close", () => {
      clients.delete(socket);
      logger.info("ws:client-disconnected", { total: clients.size });
    });
    socket.on("error", () => {
      clients.delete(socket);
    });
  });

  // -------------------------------------------------------------------------
  // The failing "external weather API" the agent's tool actually calls.
  // Real HTTP 500 over the network — no mock.
  // -------------------------------------------------------------------------
  server.get("/upstream/weather", async (_req, reply) => {
    return reply.code(500).send({
      error: "UPSTREAM_UNAVAILABLE",
      message: "weather provider returned 500 (simulated outage)",
    });
  });

  // -------------------------------------------------------------------------
  // Core intercept endpoint
  // -------------------------------------------------------------------------
  server.post(
    "/v1/agent/execute",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body ?? {}) as ExecuteBody;
      const agentId = body.agentId?.trim() || "anonymous-agent";
      const history = Array.isArray(body.history) ? body.history : [];
      const currentCall: ToolCall = body.currentCall ?? {
        tool: "unknown",
        args: {},
      };

      totals.requests++;

      // Canonical, stable representation of the tool call. Identical repeated
      // calls hash identically → the deterministic loop detector trips.
      const canonicalCall = `${currentCall.tool}(${JSON.stringify(
        currentCall.args,
      )})`;

      // Tokens the agent's LLM would burn THIS turn = the full growing context
      // plus the tool invocation. Grows every iteration → real cost escalation.
      const contextForBilling = [
        ...history,
        { role: "assistant", content: `call ${canonicalCall}` },
      ].map((m) => ({ role: m.role, content: m.content }));
      const tokensThisCall = estimateMessagesTokens(contextForBilling);
      const costThisCall = estimateCost(AGENT_TARGET_MODEL, tokensThisCall);

      // Payload for the deterministic engine. We feed ONLY the canonical tool
      // call as the message so repeated identical calls are detected as an
      // exact loop, matching how a human reads "same tool, same args, again".
      const policyPayload = {
        headers: { "x-agent-id": agentId },
        ip: request.ip,
        messages: [{ role: "tool", content: canonicalCall }],
        estimatedTokens: tokensThisCall,
        estimatedCostUsd: costThisCall,
      };

      // Shared "trip the breaker" path: broadcast + HTTP 429 + connection kill.
      const tripBreaker = (
        reason: string,
        riskScore: number,
        evaluator: string,
        latencyMs: number,
      ) => {
        const now = Date.now();
        totals.intercepts++;

        // Real observed cadence for this agent → projected runaway cost.
        const prev = lastRequestTs.get(agentId);
        const intervalMs = prev ? Math.max(now - prev, 1) : 1000;
        const callsPerMinute = Math.min(60_000 / intervalMs, 600);
        const dollarsSaved = parseFloat(
          (costThisCall * callsPerMinute * RUNAWAY_HORIZON_MINUTES).toFixed(2),
        );
        totals.dollarsSaved = parseFloat(
          (totals.dollarsSaved + dollarsSaved).toFixed(2),
        );
        lastRequestTs.set(agentId, now);

        logger.warn("breakwater:intercept", {
          agentId,
          tool: currentCall.tool,
          evaluator,
          riskScore,
          latencyMs,
          withinSla: latencyMs <= DECISION_SLA_MS,
          reason,
        });

        broadcast({
          id: `${now}-${totals.requests}`,
          type: "intercept",
          timestamp: now,
          data: {
            verdict: "block",
            reason,
            riskScore,
            latencyMs,
            evaluator,
            tokensSaved: tokensThisCall,
            dollarsSaved,
            agentId,
            tool: currentCall.tool,
          },
        });

        reply.header("connection", "close"); // physically terminate the socket
        return reply.code(429).send({
          error: "BREAKWATER_CIRCUIT_BREAKER_TRIPPED",
          reason,
          riskScore,
          evaluator,
          evaluationLatencyMs: latencyMs,
          decisionSlaMs: DECISION_SLA_MS,
          withinSla: latencyMs <= DECISION_SLA_MS,
          projectedDollarsSaved: dollarsSaved,
        });
      };

      try {
        // (0) Context-degradation guard — deterministic, sub-millisecond.
        // Stop the agent BEFORE its payload hits the model's 128k wall.
        const t0 = performance.now();
        if (tokensThisCall >= CONTEXT_TOKEN_CEILING) {
          const guardMs = Math.max(1, Math.round(performance.now() - t0));
          return tripBreaker(
            `Context window near limit: ${tokensThisCall.toLocaleString()}/` +
              `${MODEL_CONTEXT_LIMIT.toLocaleString()} tokens — halted before ` +
              `downstream truncation/crash`,
            1,
            "context-guard",
            guardMs,
          );
        }

        // ---- TIER 1: Deterministic engine — loop / rate / budget, sub-ms ----
        // Catches identical/structural retries for ~$0. If it trips we STOP
        // here and never spend a Gemini call on an obvious loop.
        const heuristic = PolicyEngine.evaluate(policyPayload);
        const heuristicMs = Math.max(1, Math.round(performance.now() - t0));

        if (heuristic.blocked) {
          return tripBreaker(
            heuristic.violations[0],
            heuristic.metadata.loopConfidence || 1,
            "deterministic-tier1",
            heuristicMs,
          );
        }

        // ---- TIER 2: Gemini Flash — semantic inspection ----
        // Only runs on traffic Tier 1 let through. This is where Gemini earns
        // its place: reworded retries and semantic drift that defeat hashing.
        const gemini = await GeminiEvaluator.evaluateAgentTrajectory(
          history,
          currentCall,
        );
        const geminiLive = gemini.evaluator !== "unavailable";

        if (geminiLive && !gemini.approved) {
          return tripBreaker(
            gemini.reason,
            gemini.riskScore,
            gemini.evaluator,
            gemini.evaluationLatencyMs,
          );
        }

        // APPROVED → actually forward the tool call to the real upstream API.
        const latencyMs = geminiLive ? gemini.evaluationLatencyMs : heuristicMs;
        const evaluator = geminiLive ? gemini.evaluator : "deterministic-tier1";
        const reason = geminiLive
          ? `Gemini approved: ${gemini.reason}`
          : "Approved by Tier 1 deterministic guards";
        const riskScore = geminiLive ? gemini.riskScore : 0;
        const now = Date.now();
        lastRequestTs.set(agentId, now);
        let toolResultStatus = 0;
        let toolResultBody: unknown = null;
        try {
          const upstream = await fetch(
            `http://127.0.0.1:${PORT}/upstream/weather`,
          );
          toolResultStatus = upstream.status;
          toolResultBody = await upstream.json().catch(() => null);
        } catch (err) {
          toolResultStatus = 502;
          toolResultBody = {
            error: err instanceof Error ? err.message : "upstream fetch failed",
          };
        }

        totals.tokensProcessed += tokensThisCall;
        PolicyEngine.recordCost(policyPayload, costThisCall);

        logger.info("breakwater:forward", {
          agentId,
          tool: currentCall.tool,
          toolResultStatus,
          tokensThisCall,
          latencyMs,
          evaluator,
        });

        broadcast({
          id: `${now}-${totals.requests}`,
          type: "pass",
          timestamp: now,
          data: {
            verdict: "pass",
            reason,
            riskScore,
            latencyMs,
            evaluator,
            tokensProcessed: tokensThisCall,
            agentId,
            tool: currentCall.tool,
            toolResultStatus,
          },
        });

        return reply.code(200).send({
          approved: true,
          evaluator,
          evaluationLatencyMs: latencyMs,
          tokensProcessed: tokensThisCall,
          toolResult: { status: toolResultStatus, body: toolResultBody },
        });
      } finally {
        // Always release the reentrancy lock the engine acquired.
        PolicyEngine.releaseAgent(policyPayload);
      }
    },
  );

  // -------------------------------------------------------------------------
  // Health + metrics
  // -------------------------------------------------------------------------
  server.get("/health", async () => ({
    status: "ok",
    geminiLive: GeminiEvaluator.isLive,
    geminiModel: GeminiEvaluator.modelName,
    clients: clients.size,
    uptime: process.uptime(),
  }));

  server.get("/metrics", async () => ({
    ...totals,
    ...PolicyEngine.getMetrics(),
    geminiLive: GeminiEvaluator.isLive,
  }));

  // -------------------------------------------------------------------------
  // Single-origin front door (Cloud Run). Registered LAST so every API/WS
  // route above wins; anything else (dashboard HTML, /_next/* assets) is
  // proxied to the internal Next.js server. /ws stays local — do NOT proxy it.
  // -------------------------------------------------------------------------
  if (SERVE_DASHBOARD) {
    await server.register(httpProxy, {
      upstream: `http://127.0.0.1:${NEXT_INTERNAL_PORT}`,
      websocket: false, // our own /ws handler owns the upgrade
    });
    logger.info("breakwater:serving-dashboard", {
      upstream: `http://127.0.0.1:${NEXT_INTERNAL_PORT}`,
    });
  }

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------
  try {
    await server.listen({ port: PORT, host: "0.0.0.0" });
    logger.info("breakwater:proxy-started", {
      port: PORT,
      geminiLive: GeminiEvaluator.isLive,
      targetModel: AGENT_TARGET_MODEL,
    });
    console.log(
      `\n  🌊 Breakwater proxy listening on http://localhost:${PORT}` +
        `\n     Gemini (${GeminiEvaluator.modelName}): ${
          GeminiEvaluator.isLive ? "LIVE ✅" : "offline (heuristic breaker only) ⚠️"
        }` +
        `\n     Dashboard WS:     ws://localhost:${PORT}/ws\n`,
    );
  } catch (err) {
    logger.error("breakwater:startup-failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

main();
