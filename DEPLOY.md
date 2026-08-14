# Deploying Breakwater to Google Cloud Run

This deploys Breakwater as a **single container behind one public HTTPS URL**.
Fastify is the front door: it serves the agent API (`/v1/agent/execute`), the
live telemetry WebSocket (`/ws`), and the failing upstream, and proxies
everything else to the internal Next.js dashboard. One URL gives you the
dashboard **and** the same-origin live stream — exactly what a judge needs to
click.

> This is the same single-origin mode verified locally (`SERVE_DASHBOARD=1`),
> just running on Cloud Run's injected `$PORT`.

---

## 0. Prerequisites

- **Google Cloud project with billing enabled.** Cloud Run requires it (this is
  also the mandatory "deployed on Google Cloud" XPRIZE criterion). Use the same
  project your Gemini key belongs to if you like — it keeps everything in one
  place.
- **gcloud CLI installed.** macOS:
  ```bash
  brew install --cask google-cloud-sdk
  ```
  Or follow https://cloud.google.com/sdk/docs/install
- **Your Gemini API key** (from https://aistudio.google.com/apikey). Keep it in
  your local `.env`; you'll pass it to Cloud Run at deploy time, never commit it.

---

## 1. One-time setup

```bash
# Sign in
gcloud auth login

# Point gcloud at your project (replace with your real project id)
gcloud config set project YOUR_PROJECT_ID

# Enable the APIs the deploy needs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

> `YOUR_PROJECT_ID` is the id (e.g. `breakwater-xprize-4821`), not the display
> name. See it with `gcloud projects list`.

---

## 2. Deploy

Run from the repository root (where the `Dockerfile` is). `--source .` hands the
repo to Cloud Build, which builds the multi-stage `Dockerfile` automatically.

```bash
gcloud run deploy breakwater \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600 \
  --min-instances 1 \
  --max-instances 1 \
  --set-env-vars GEMINI_API_KEY=YOUR_GEMINI_KEY,GEMINI_MODEL=gemini-2.5-flash
```

When it finishes it prints a **Service URL** like
`https://breakwater-xxxxxxxx-uc.a.run.app`. That is your public URL — save it for
Devpost.

### Why these flags matter (don't skip them)

- **`--min-instances 1 --max-instances 1` (important):** Breakwater keeps live
  state in memory — the connected dashboards, the running totals, and each
  agent's loop-detection window. If Cloud Run autoscaled to several instances,
  your dashboard could connect to one instance while an agent hits another, and
  the dashboard would show nothing. Pinning to **exactly one instance** keeps all
  traffic on the same process so the live feed is correct. (Perfect for a demo.)
- **`--timeout 3600`:** WebSocket connections count against the request timeout;
  3600s (the max) keeps the dashboard stream alive for a long recording session.
- **`--allow-unauthenticated`:** so judges can open the URL without a Google
  login.
- **`--port 8080`:** matches the container's `EXPOSE`; the proxy binds Cloud
  Run's injected `$PORT`.
- **`--memory 1Gi`:** Next.js + the proxy in one container; 512Mi can be tight.

> First deploy may ask to create an Artifact Registry repo — answer **yes**.

---

## 3. Verify

```bash
# Health — geminiLive must be true, and it reports the model
curl https://YOUR-SERVICE-URL/health
# => {"status":"ok","geminiLive":true,"geminiModel":"gemini-2.5-flash",...}
```

Then open the dashboard in a browser:

```
https://YOUR-SERVICE-URL/dashboard
```

You should see **CIRCUIT BREAKER ACTIVE** (green) — that means the same-origin
WebSocket connected.

Now point a real agent at the deployed proxy and watch the dashboard update live:

```bash
# Identical-loop agent — caught by the deterministic tier in ~1ms
PROXY_URL=https://YOUR-SERVICE-URL npm run agent

# Semantic-drift agent — caught by Gemini 2.5 Flash (reworded retries)
PROXY_URL=https://YOUR-SERVICE-URL npm run agent:semantic
```

Both should end with `HTTP 429 — BREAKWATER_CIRCUIT_BREAKER_TRIPPED`, and the
dashboard's live feed should flash the intercept.

---

## 4. Updating the key or model later

You don't need to redeploy the whole image to change an env var:

```bash
gcloud run services update breakwater \
  --region us-central1 \
  --update-env-vars GEMINI_API_KEY=NEW_KEY,GEMINI_MODEL=gemini-2.5-flash
```

---

## 5. Redeploy, logs, rollback

```bash
# Redeploy after code changes
gcloud run deploy breakwater --source . --region us-central1

# Tail logs (watch for the Gemini LIVE banner and any errors)
gcloud run services logs read breakwater --region us-central1 --limit 100

# List revisions, then roll back to a previous one
gcloud run revisions list --service breakwater --region us-central1
gcloud run services update-traffic breakwater \
  --region us-central1 --to-revisions REVISION_NAME=100
```

---

## 6. Cost

- Cloud Run bills only while serving; with `--min-instances 1` you keep one warm
  instance (a small always-on cost — pennies/day — worth it to avoid a cold-start
  pause mid-recording). Set `--min-instances 0` after the event to drop to zero.
- Gemini 2.5 Flash at demo volume is a fraction of a cent.

---

## 7. Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| `PERMISSION_DENIED` / "billing" on deploy | Billing isn't enabled on the project. Enable it: https://console.cloud.google.com/billing |
| Build fails: API not enabled | Re-run the `gcloud services enable ...` line in step 1. |
| `/health` shows `geminiLive: false` | The `GEMINI_API_KEY` env var didn't reach the service. Set it with the step 4 command and check for typos. |
| Dashboard loads but stays **DISCONNECTED** | You likely deployed without `--min-instances 1 --max-instances 1`. Redeploy with both — multiple instances split the WebSocket state. |
| Gemini verdict says "unavailable" in logs | Usually a wrong/retired model name. Confirm `GEMINI_MODEL` is a current model (e.g. `gemini-2.5-flash`); list models: see `README`/AI Studio. |
| First request after idle is slow | Cold start. `--min-instances 1` avoids it during recording. |

---

## 8. XPRIZE submission checklist (after deploy)

- [ ] **Live Cloud Run URL** saved and pasted into the Devpost form.
- [ ] `curl https://YOUR-SERVICE-URL/health` returns `geminiLive: true`.
- [ ] GitHub repo shared with `testing@devpost.com` and `judging@hacker.fund`
      (or made public).
- [ ] Devpost written case study (Project overview, human-vs-AI workflow, P&L).
- [ ] Demo video showing the agent looping and Breakwater tripping live.
