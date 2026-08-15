// Separate demo driver - NOT part of the app. It opens a real browser, drives
// the REAL Breakwater UI end to end, and records a video you can use directly.
//
//   npm run demo                         # drives the live Cloud Run site
//   DEMO_URL=http://localhost:3000 npm run demo   # drives your local dev site
//
// Output: demo/recording/<timestamp>.webm  (plus the path is printed at the end)

import { chromium } from "playwright";
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
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await sleep(4500); // let the hero play

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

  // --- Dashboard: the runaway burn meter (the headline sell) -----------------
  // A real looping agent's projected spend races upward, then Breakwater cuts it
  // off after a cent or two and reveals the loss it prevented.
  const burnBtn = page
    .getByRole("button", { name: /Unleash the runaway/i })
    .first();
  await burnBtn.scrollIntoViewIfNeeded();
  await sleep(1600);
  await burnBtn.click();
  // Wait for the full sequence to land: climb -> trip -> projection race. This
  // sentence is unique to the burn meter's final stopped state, so it avoids
  // colliding with the "Projected loss avoided" stat cards elsewhere on the page.
  await page
    .getByText(/Left running for an hour/i)
    .first()
    .waitFor({ timeout: 60000 });
  await sleep(4200); // hold on the projected loss

  // --- Dashboard: run the live protection showcase ---------------------------
  // Four real scenarios play in order: a normal request passes, an exact-repeat
  // loop is killed by the deterministic tier, a reworded retry loop and a prompt
  // injection are both caught by Gemini 2.5 Flash. Each verdict holds ~3.8s.
  const runBtn = page
    .getByRole("button", { name: /Run the live demo/i })
    .first();
  await runBtn.scrollIntoViewIfNeeded();
  await sleep(1400);
  await runBtn.click();

  // Wait for the run to finish rather than guessing a duration: the showcase's
  // own button reads "Running…" for the whole run, then flips back to "Run live
  // demo". Scope to the button role so the match cannot collide with body text
  // like the burn meter's "Left running for an hour" sentence.
  const showcaseRunning = page.getByRole("button", { name: /Running/i });
  await showcaseRunning
    .waitFor({ state: "visible", timeout: 12000 })
    .catch(() => {});
  await showcaseRunning.waitFor({ state: "hidden", timeout: 120000 });
  await sleep(2600); // hold on the final stats

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
