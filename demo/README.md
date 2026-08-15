# Demo recorder

A **separate** driver (not part of the app) that opens a real browser, walks the
**real Breakwater UI** end to end - landing, onboarding, the real Gemini
connection test, the dashboard, a real chat, and a real runaway interception -
and saves a video you can drop into your demo.

Nothing here is faked and nothing is baked into the shipped app: it just clicks
and types on the live product for you.

## Run it

```bash
# One-time setup
npm install
npx playwright install chromium

# Record against the live Cloud Run site (default)
npm run demo

# ...or against your local dev site
DEMO_URL=http://localhost:3000 npm run demo

# Watch it drive in a visible window (otherwise it runs headless)
DEMO_HEADED=1 npm run demo
```

The video is written to `demo/recording/breakwater-demo-<timestamp>.webm`
(printed at the end). `demo/recording/` is gitignored.

## Convert to MP4 (optional)

Most editors accept `.webm`, but if you need MP4:

```bash
ffmpeg -i demo/recording/breakwater-demo-XXXX.webm -c:v libx264 -pix_fmt yuv420p demo.mp4
```

## Notes

- It resets the workspace at the start so the full onboarding always plays.
- It waits on real signals ("is protected", "gemini", "halted"), so it stays in
  sync even when Gemini is a little slow.
- Default target is the deployed site; deploy first if you changed the app.
