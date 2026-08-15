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

  // --- Get started -----------------------------------------------------------
  await page.getByRole("link", { name: "Get started for free" }).first().click();
  await page.waitForURL("**/get-started");
  await sleep(900);

  await page.locator("#ws").pressSequentially("Northwind Labs", { delay: 55 });
  await sleep(350);
  await page.locator("#email").pressSequentially("ops@northwind.ai", { delay: 45 });
  await sleep(500);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await sleep(1100);

  // Connect step
  await page.locator("#agent").fill("");
  await page.locator("#agent").pressSequentially("invoice-processor", { delay: 55 });
  await sleep(500);
  await page.getByRole("button", { name: "Send a test call" }).click();
  await page.getByText(/is protected/i).waitFor({ timeout: 25000 });
  await sleep(1600);
  await page.getByRole("button", { name: /Go to my dashboard/i }).click();
  await page.waitForURL("**/dashboard");
  await sleep(2600);

  // --- Dashboard: real chat, then real runaway -------------------------------
  const ask = page.getByPlaceholder("Ask something…");
  await ask.click();
  await ask.pressSequentially("Summarize our Q3 refund policy in two lines.", {
    delay: 35,
  });
  await sleep(400);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByText(/gemini/i).first().waitFor({ timeout: 25000 });
  await sleep(2600);

  await page.getByRole("button", { name: "Simulate runaway" }).click();
  await page.getByText(/halted/i).waitFor({ timeout: 30000 });
  await sleep(3500);

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
