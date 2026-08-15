// Separate demo driver - NOT part of the app. It opens a real browser, drives
// the REAL Breakwater UI end to end, and records a video you can use directly.
//
//   npm run demo                         # drives the live Cloud Run site
//   DEMO_URL=http://localhost:3000 npm run demo   # drives your local dev site
//
// Output: demo/recording/<timestamp>.webm  (plus the path is printed at the end)

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readdirSync, renameSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE =
  process.env.DEMO_URL ||
  "https://breakwater-1074189130680.us-central1.run.app";
const OUT = join(__dirname, "recording");
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`\n  Recording Breakwater demo against: ${BASE}\n`);
  // Records the video either way. DEMO_HEADED=1 opens a visible window to watch.
  const browser = await chromium.launch({
    headless: process.env.DEMO_HEADED !== "1",
    slowMo: 40,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // --- Landing (fresh) -------------------------------------------------------
  // The browser context is created fresh each run, so localStorage is already
  // empty. Load the page ONCE and let the hero play cleanly - an extra reload
  // here restarts the word-by-word animation and reads as a glitch on film.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await sleep(4800); // let the hero play through

  // gentle tour of the page
  for (const y of [700, 1500, 2400, 3200]) {
    await page.evaluate((yy) => window.scrollTo({ top: yy, behavior: "smooth" }), y);
    await sleep(1700);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(1400);

  // --- Get started (brief visual, then jump to the app) ----------------------
  await page.getByRole("link", { name: "Get started for free" }).first().click();
  await page.waitForURL("**/get-started");
  await sleep(900);

  await page.locator("#ws").pressSequentially("Northwind Labs", { delay: 55 });
  await sleep(350);
  await page.locator("#email").pressSequentially("ops@northwind.ai", { delay: 45 });
  await sleep(800);

  // Seed the workspace and go straight to the dashboard. The live "test call"
  // step in onboarding is a cold-start-flaky round-trip right after a deploy and
  // is not the point of the film; the dashboard is. This keeps the recording
  // deterministic while still showing the sign-up screen.
  await page.evaluate(() => {
    const now = Date.now();
    localStorage.setItem(
      "breakwater.workspace",
      JSON.stringify({
        name: "Northwind Labs",
        email: "ops@northwind.ai",
        plan: "team",
        agents: [
          { id: "invoice-processor", name: "invoice-processor", createdAt: now },
        ],
        createdAt: now,
      }),
    );
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await sleep(2600);

  // --- Dashboard: real agent, real interception ------------------------------
  // No demo buttons. The dashboard is live and connected to the proxy over its
  // WebSocket. We start a REAL runaway agent (a separate process) that loops
  // against the same proxy; Breakwater trips the breaker and the dashboard
  // reacts on its own - exactly what an operator sees in production.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  // The calm "monitoring" copy only renders once the socket is open, so waiting
  // for it confirms the dashboard is connected before we send any traffic.
  await page.getByText(/Monitoring live agent traffic/i).waitFor({ timeout: 20000 });
  await sleep(2600); // hold on the calm monitoring state

  // Point the agent at the same origin we are recording. Behind one Cloud Run
  // URL the proxy is same-origin; locally, override with AGENT_PROXY_URL.
  const agent = spawn("npm", ["run", "agent:invoice"], {
    cwd: join(__dirname, ".."),
    env: {
      ...process.env,
      PROXY_URL: process.env.AGENT_PROXY_URL || BASE,
      AGENT_ID: "invoice-processor",
    },
    stdio: "inherit",
  });

  // The breaker trips within a few iterations. This copy is unique to the
  // live-intercept card, so it only appears when the real event has landed.
  await page.getByText(/CIRCUIT BREAKER TRIPPED/i).waitFor({ timeout: 60000 });
  await sleep(5200); // hold on the live intercept reveal and the updated stats

  try {
    agent.kill("SIGTERM");
  } catch {
    /* already exited on its own */
  }

  // --- Wrap up ---------------------------------------------------------------
  await context.close(); // flushes the video
  await browser.close();

  // Rename newest video to a timestamped name for convenience.
  const vids = readdirSync(OUT).filter((f) => f.endsWith(".webm"));
  if (vids.length) {
    const latest = vids
      .map((f) => ({ f, t: f }))
      .sort((a, b) => (a.t < b.t ? 1 : -1))[0].f;
    const stamped = `breakwater-demo-${Date.now()}.webm`;
    renameSync(join(OUT, latest), join(OUT, stamped));
    console.log(`\n  ✓ Demo recorded: demo/recording/${stamped}\n`);
  } else {
    console.log(`\n  ✓ Done. Video saved under demo/recording/\n`);
  }
}

main().catch((err) => {
  console.error("\n  Demo run failed:", err.message, "\n");
  process.exit(1);
});
