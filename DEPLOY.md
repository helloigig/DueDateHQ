# Deploy DueDateHQ — free-tier path

Goes from "works on Yuqi's laptop" to "Yuqi can text Yan Jing a URL" in ~2 hours.

**Architecture:**
- Backend → Fly.io (free tier, scales to 0 when idle, cold-start on request)
- Frontend → Vercel (free tier, edge CDN)
- Database → Supabase (already deployed in Phase 0)
- Outbound email → Resend with `onboarding@resend.dev` (free, no domain needed)
- Inbound email + delivery webhooks → public Fly.io URL (no ngrok required)

**Total runtime cost:** $0/month while traffic is low.

---

## 1. Backend → Fly.io

### One-time setup

```bash
brew install flyctl
fly auth signup       # or `fly auth login` if you already have an account
```

(Fly.io requires a credit card on the free tier — they don't charge unless you exceed limits, but they want CC for fraud prevention.)

### Launch the app

> **Always run `fly` commands from the repo root.** The canonical config
> is `/fly.toml` + `/Dockerfile` at the worktree root (app name
> `duedatehq`). The files inside `backend/` (`backend/fly.toml`,
> `backend/Dockerfile`) are deprecated templates — running `fly deploy`
> from there creates a **second** app and partially overwrites the live
> machine config. That's the bug that took the deploy critical on
> 2026-05-02. See RUNBOOK.md → "Deploying backend to Fly.io" for the
> source of truth.

```bash
fly launch --no-deploy   # from the repo root, not backend/
```

When prompted:
- **App name:** the existing app is `duedatehq`. Keep it unless you're standing up a new environment.
- **Region:** `lhr` is the current primary; pick whatever's closest to your users.
- **Build with existing Dockerfile?** Yes (the root `Dockerfile`).
- **Set up Postgres?** **No** — you already have Supabase
- **Set up Upstash Redis?** No
- **Deploy now?** **No** — we set secrets first

Fly will edit the root `fly.toml` with the actual app name. Commit that change.

### Set secrets

⚠️ Use `fly secrets set` (not `fly.toml`) so secrets aren't committed.
**Do not** include `PORT` or `NODE_ENV` here — those live in `fly.toml`'s
`[env]` block. Fly secrets override `[env]` unconditionally, so a stray
`PORT=8000` secret silently desyncs the runtime port from `internal_port`,
the health check goes critical, and traffic stops routing. (This is the
trap that took prod down on 2026-05-02; run `fly secrets list` after a
deploy to confirm `PORT` / `NODE_ENV` are *not* listed.)

```bash
# Run from the repo root. Copy values from backend/.env.local
# (DATABASE_URL etc. are already there).
# CORS_ORIGIN should be the Vercel URL once you have it (skip for now, set after step 2)
fly secrets set \
  DATABASE_URL="$(grep DATABASE_URL backend/.env.local | cut -d= -f2-)" \
  SUPABASE_URL="$(grep SUPABASE_URL backend/.env.local | cut -d= -f2-)" \
  SUPABASE_ANON_KEY="$(grep SUPABASE_ANON_KEY backend/.env.local | cut -d= -f2-)" \
  SUPABASE_SERVICE_ROLE_KEY="$(grep SUPABASE_SERVICE_ROLE_KEY backend/.env.local | cut -d= -f2-)" \
  ANTHROPIC_API_KEY="$(grep ANTHROPIC_API_KEY backend/.env.local | cut -d= -f2-)" \
  INBOUND_WEBHOOK_SECRET="$(grep ^INBOUND_WEBHOOK_SECRET backend/.env.local | tail -1 | cut -d= -f2-)" \
  DELIVERY_WEBHOOK_SECRET="$(grep ^DELIVERY_WEBHOOK_SECRET backend/.env.local | tail -1 | cut -d= -f2-)" \
  CORS_ORIGIN="*"
```

(After you have the Vercel URL, replace `CORS_ORIGIN="*"` with `CORS_ORIGIN="https://your-app.vercel.app"` for security.)

### Deploy

```bash
fly deploy
```

Fly will:
1. Build the Docker image
2. Run the release_command (`node dist/db/migrate.js`) — applies any pending migrations
3. Start the new machine
4. Health-check `/health` → routes traffic when green

You should see ~2-3 minute build, then "deployed successfully."

### Verify

```bash
fly status                                   # machines healthy?
curl https://<your-app-name>.fly.dev/health  # → {"ok":true,...}
fly logs                                     # tail logs (Ctrl+C to exit)
```

---

## 2. Frontend → Vercel

### One-time setup

```bash
npm install -g vercel
vercel login
```

(Vercel free tier — no credit card.)

### Launch

From the **worktree root** (not `backend/`):

```bash
vercel
```

Pick:
- **Set up and deploy?** Yes
- **Which scope?** Your personal account
- **Link to existing project?** No
- **Project name:** `duedatehq-app` (or whatever — this becomes `<name>.vercel.app`)
- **In which directory is your code?** `./`
- **Override build settings?** No (Vercel auto-detects Vite)

It'll deploy a preview URL. Note the URL — you'll need it for the env vars.

### Set env vars

Vercel Dashboard → your project → Settings → Environment Variables:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://<your-fly-app>.fly.dev` |
| `VITE_USE_MOCK_API` | `false` |
| `VITE_SUPABASE_URL` | (same as backend) |
| `VITE_SUPABASE_ANON_KEY` | (same as backend) |

Apply to: Production, Preview, Development (all three).

### Re-deploy with the env vars

```bash
vercel --prod
```

This pushes to your production URL: `https://<your-vercel-name>.vercel.app`.

### Lock down CORS on the backend

```bash
cd backend
fly secrets set CORS_ORIGIN="https://<your-vercel-name>.vercel.app"
fly deploy   # restart picks up the new secret
```

---

## 3. Wire webhooks to the public URL

Now that you have a public Fly URL, real email providers can reach the webhook routes.

### Resend bounce/complaint webhook

Resend Dashboard → Webhooks → Add Endpoint:
- **URL:** `https://<your-fly-app>.fly.dev/api/delivery/resend/<DELIVERY_WEBHOOK_SECRET>`
  (Replace `<DELIVERY_WEBHOOK_SECRET>` with the actual value from your secrets — `fly secrets list` won't show it; check `.env.local`.)
- **Events:** `email.bounced`, `email.complained`, `email.delivered`, `email.opened`

Send a test email; check `delivery_events` table fills.

### SES inbound (when you set it up)

SES → Configuration → Email receiving → Rule sets → Create rule:
- **Recipient:** `<your-firm-domain> in.duedatehq.com` (only after you have a domain)
- **Action:** Publish to SNS topic that POSTs to:
  `https://<your-fly-app>.fly.dev/api/inbound/email/ses/<INBOUND_WEBHOOK_SECRET>`

For testing without a domain, you can manually POST a test payload via curl — see `backend/src/lib/inbound-email.ts` for the expected shape.

---

## 4. After the first user

When you're ready to scale:
- **Custom domain:** buy `duedatehq.com` at Cloudflare/Porkbun (~$10/year). Vercel + Fly both support custom domains free. Update Resend domain verification + `RESEND_FROM`.
- **Bigger Fly machine:** edit `[[vm]]` size in `fly.toml` → `shared-cpu-2x` + 1GB memory if traffic warrants.
- **Pin Fly machine to never sleep:** `min_machines_running = 1` in `fly.toml` — costs ~$2/month but eliminates 1-3s cold-start.
- **Vercel custom analytics:** included free.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `fly deploy` fails on `release_command` | Migration error — usually a column type or FK | `fly logs --recent` shows the SQL error; fix the migration locally + redeploy |
| Backend boots but FE shows "Procedure not wired" | `VITE_USE_MOCK_API` isn't `false` on Vercel | Check Vercel env vars, redeploy |
| CORS errors in browser console | `CORS_ORIGIN` on Fly doesn't match Vercel URL | `fly secrets set CORS_ORIGIN=https://<exact-url>` |
| Eval logs show "credit balance too low" | Anthropic account empty | https://console.anthropic.com/settings/billing |
| Empty `ANTHROPIC_API_KEY` in shell | Claude Code's terminal sets it empty | `unset ANTHROPIC_API_KEY` before running, OR use the npm scripts (they unset internally) |

---

## What this gets you

A public URL Yan Jing can open in any browser. AI fully functional (Anthropic key on Fly). Mode F state alerts populate from the scraper running in-process. Bounce/complaint events flow back via webhooks. The product is real.
