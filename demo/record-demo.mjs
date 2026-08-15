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

// A fresh agent id per run. Breakwater latches a runaway agent's breaker per
// id, so reusing one id across recordings would make even the benign connect
// test call trip. A new id each run keeps the demo a clean first-time setup.
const AGENT = `invoice-processor-${String(Date.now()).slice(-3)}`;

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

  // --- Get started: create the workspace, then CONNECT the agent -------------
  // This is the whole point of Breakwater and it comes FIRST: you point your
  // agent at the proxy with a one-line change. The film has to SHOW that
  // integration before any functionality is demonstrated.
  await page.getByRole("link", { name: "Get started for free" }).first().click();
  await page.waitForURL("**/get-started");
  await sleep(900);

  await page.locator("#ws").pressSequentially("Northwind Labs", { delay: 55 });
  await sleep(350);
  await page.locator("#email").pressSequentially("ops@northwind.ai", { delay: 45 });
  await sleep(700);
  await page.getByRole("button", { name: /Create workspace/i }).click();

  // Step 2 - Connect. Give each beat its own moment: name the agent FIRST and
  // let it settle, THEN move down to the code block, so the field and the code
  // never update in the same breath.
  const agentField = page.locator("#agent");
  await agentField.waitFor({ timeout: 15000 });
  await agentField.scrollIntoViewIfNeeded();
  await sleep(700);
  await agentField.fill("");
  await agentField.pressSequentially(AGENT, { delay: 60 });
  await sleep(2400); // the agent name's own moment

  // Now the code block gets its moment: the one-line integration (base_url ->
  // the Breakwater proxy), shown across languages.
  await page.getByText("Add one line to your app").scrollIntoViewIfNeeded();
  await sleep(2100);
  for (const lang of ["Node", "cURL", "Python"]) {
    await page.getByRole("button", { name: lang, exact: true }).click();
    await sleep(2000); // each language its own beat
  }
  // Copy the one line - the natural action on a snippet you take into your app.
  await page.getByRole("button", { name: "Copy" }).click();
  await sleep(1700); // "Copied ✓" feedback

  // Step 3 - the REAL test call through the proxy. Hold on the confirmation so
  // the outcome is readable before moving on. "Go to my dashboard" only unlocks
  // once the test succeeds.
  const testBtn = page.getByRole("button", { name: "Send a test call" });
  await testBtn.scrollIntoViewIfNeeded();
  await sleep(900);
  await testBtn.click();
  await page.getByText(/is protected/i).waitFor({ timeout: 45000 });
  await page.getByText(/is protected/i).scrollIntoViewIfNeeded();
  await sleep(3400); // read the "Connected - protected" confirmation
  await page.getByRole("button", { name: /Go to my dashboard/i }).click();
  await page.waitForURL("**/dashboard");
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
      AGENT_ID: AGENT,
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
