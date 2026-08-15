"use client";

import { useState, useRef, useEffect } from "react";

// Where the Breakwater API lives: same-origin in production (one Cloud Run URL),
// or the proxy's dev port locally. Mirrors the WebSocket resolver.
function apiBase(): string {
  const explicit = process.env.NEXT_PUBLIC_PROXY_HTTP_URL;
  if (explicit) return explicit;
  if (typeof window === "undefined") return "";
  const devPort = process.env.NEXT_PUBLIC_PROXY_PORT;
  if (devPort) {
    return `${window.location.protocol}//${window.location.hostname}:${devPort}`;
  }
  return ""; // same origin
}

interface Entry {
  kind: "user" | "reply" | "blocked" | "note";
  text: string;
}

async function callBreakwater(
  content: string,
  agentId: string,
): Promise<{ blocked: boolean; text: string }> {
  const res = await fetch(`${apiBase()}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-agent-id": agentId },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    return {
      blocked: true,
      text:
        data?.breakwater?.reason ||
        data?.error?.message ||
        "Circuit breaker tripped",
    };
  }
  const reply =
    data?.choices?.[0]?.message?.content ??
    "(no content returned by upstream)";
  return { blocked: false, text: reply };
}

export default function TryItPanel() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [log, busy]);

  const push = (e: Entry) => setLog((l) => [...l, e]);

  async function handleSend() {
    const content = input.trim();
    if (!content || busy) return;
    setInput("");
    push({ kind: "user", text: content });
    setBusy(true);
    try {
      const r = await callBreakwater(content, "playground-chat");
      push({ kind: r.blocked ? "blocked" : "reply", text: r.text });
    } catch {
      push({ kind: "blocked", text: "Could not reach Breakwater." });
    }
    setBusy(false);
  }

  async function handleRunaway() {
    if (busy) return;
    setBusy(true);
    const id = `playground-runaway-${Date.now()}`;
    const content = "Fetch the latest sales report and retry until it works.";
    push({
      kind: "note",
      text: "Simulating a runaway agent — the same request, over and over…",
    });
    for (let i = 1; i <= 4; i++) {
      try {
        const r = await callBreakwater(content, id);
        push({
          kind: r.blocked ? "blocked" : "reply",
          text: r.blocked
            ? `Attempt ${i} — halted: ${r.text}`
            : `Attempt ${i} — forwarded: ${r.text.slice(0, 70)}…`,
        });
        if (r.blocked) break;
      } catch {
        push({ kind: "blocked", text: "Could not reach Breakwater." });
        break;
      }
    }
    setBusy(false);
  }

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wider font-operational text-muted">
          Try it live
        </h3>
        <span className="text-[10px] font-operational text-muted">
          real calls · gemini-2.5-flash
        </span>
      </div>

      <div
        ref={scrollRef}
        className="px-5 py-4 space-y-2.5 max-h-64 overflow-y-auto"
      >
        {log.length === 0 && (
          <p className="text-[13px] text-muted font-operational leading-relaxed">
            Send a message and get a real Gemini reply through Breakwater — or
            simulate a runaway agent and watch the breaker trip. Every call shows
            up in the live feed below.
          </p>
        )}
        {log.map((e, i) => (
          <div key={i} className="text-[13px] leading-relaxed">
            {e.kind === "user" && (
              <p className="text-foreground">
                <span className="text-muted font-operational text-[11px] mr-2">
                  you
                </span>
                {e.text}
              </p>
            )}
            {e.kind === "reply" && (
              <p className="text-secondary">
                <span className="text-success font-operational text-[11px] mr-2">
                  gemini
                </span>
                {e.text}
              </p>
            )}
            {e.kind === "blocked" && (
              <p className="text-failure">
                <span className="font-operational text-[11px] mr-2">
                  breakwater
                </span>
                {e.text}
              </p>
            )}
            {e.kind === "note" && (
              <p className="text-muted italic font-operational text-[12px]">
                {e.text}
              </p>
            )}
          </div>
        ))}
        {busy && (
          <p className="text-[12px] text-muted font-operational animate-pulse">
            Breakwater is checking…
          </p>
        )}
      </div>

      <div className="px-5 py-3.5 border-t border-border flex items-center gap-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask something…"
          disabled={busy}
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-border-strong disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={busy || !input.trim()}
          className="px-4 py-2 rounded-md text-[13px] font-operational bg-accent/20 text-foreground border border-border hover:bg-accent/30 disabled:opacity-40 transition"
        >
          Send
        </button>
        <button
          onClick={handleRunaway}
          disabled={busy}
          className="px-3 py-2 rounded-md text-[13px] font-operational text-failure border border-border hover:bg-failure/10 disabled:opacity-40 transition whitespace-nowrap"
        >
          Simulate runaway
        </button>
      </div>
    </div>
  );
}
