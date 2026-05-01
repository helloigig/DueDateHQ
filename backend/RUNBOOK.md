# Backend runbook — Phase 0 (expanded)

## What's wired

17 tRPC routers spanning every PRD §10.3 P0 surface. Roughly grouped:

**Fully implemented** (real DB queries, ready for production data):
- `auth.session / health / ping / bootstrap` — Supabase Auth + firm/user provisioning
- `clients.list / get / create / update / archive` — paginated, filterable
- `deadlines.listForTriage / listForClient / updateStatus` — time-grouped buckets
- `servicePackages.list / suggestForClient / assignToClient / unassignFromClient` — 21 system packages, deterministic Mode A suggestion ranking
- `tasks.list / get / createForDeadline / updateStatus` — materializes Mode A baseline checklist from template
- `checklists.listForTask / setState` — §5.3 invariant enforced at DB CHECK + middleware
- `activity.listForTask` — append-only timeline
- `announcements.list / get / acknowledge / snooze / dismiss / markRead / batchAdjustDeadlines / setEscalation` — full per-firm overlay
- `notifications.list / markRead / markAllRead / dismiss / updatePreferences`
- `emails.saveDraft / send / recall / discard / listForTask` — draft/sent/recall lifecycle, 1-min recall window
- `reminderTemplates.list` — system + firm-custom
- `team.list / invite / updateRole / remove / revokeInvite / inviteLookup / acceptInvite` — token-based invite flow
- `exports.request / status / list` — queues `export_runs`, worker is Phase 1
- `integrations.list / disconnect`
- `aiInferences.recordAcceptance / summary` — online eval foundation per PRD §4.7

**Stubbed with `NOT_IMPLEMENTED`** (need external service wiring):
- `announcements.detect` — needs Cloudflare Workers crawler + Gemini parser
- `emails.send` — persists `sent` but does NOT actually transmit (Phase 1: Resend integration)
- `imports.suggestFieldMapping / preview / commit / undo` — Phase 1 LLM + commit pipeline
- `integrations.startConnect` — Phase 1 OAuth flows for QBO / Xero / Gmail / Outlook
- `uploads.requestUrl` — Phase 1 Supabase Storage presigned URLs

## What still needs your hands (external setup)

1. **Resend account** — for `emails.send` to actually transmit. Add `RESEND_API_KEY` to backend env, then enable the email-outbound BullMQ worker in Phase 1.
2. **QBO / Xero developer apps** — register at developer portals, set redirect URLs, store client_id/secret in Fly secrets. Then implement `lib/oauth/{qbo,xero}.ts` per arch §8.1.
3. **Gmail / Outlook OAuth** — same pattern as QBO/Xero. For Method A only (read-write for sending), full read scope is Phase 2 Method B.
4. **Cloudflare Workers** — deploy the scraper code (Phase 1 has the script template at `backend/scripts/scraper-worker.ts`); each state DOR gets one cron worker.
5. **Postmark or AWS SES inbound** — for per-task forwarding addresses (Method A). The MX records on `duedatehq.com` need to point at the inbound parse service.

## What's NOT shipped vs. v0.7 P0 §10.3

- **Real OAuth integrations** (P0.13, P0.14) — UI surface present, BE returns NOT_IMPLEMENTED
- **State announcement scraper pipeline** (P0.12) — schema + matching + per-firm overlay all there; the actual crawler is the missing piece
- **Resend send + Postmark inbound** (P0.3, P0.4) — ditto
- **AI eval offline harness** (P0.18) — `ai_inferences.was_acted_on` plumbed; the eval suite + drift detection is Phase 1
- **Audit-trail packer** (P0.19) — schema (`export_runs`) and queue procedure exist; the actual PDF/JSON assembly worker is Phase 1
- **Full 50-state seed data** (P0.11) — 21 packages × 25 templates covering Federal + 10 states (CA/NY/TX/LA/FL/IL/PA/GA/NJ/MA). Add more by editing `src/db/seed-data.ts` then re-running `npm run backend:seed`.

---

## Local dev — first time

### 1. Install backend deps

```bash
npm run backend:install
```

### 2. Create `backend/.env.local`

Copy `backend/.env.example` and fill in the **pooled** Supabase connection string. Get it from:

- Supabase Dashboard → your project → Settings → Database → **Connection pooling** → URI
- Use **port 6543** (PgBouncer), not 5432. Drizzle works fine through the pooler for queries; migrations also work but use a non-pooled URL if you hit prepared-statement issues.

```
DATABASE_URL=postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=8080
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

You already have these values in `~/Desktop/DueDateHQ_dashboard/.env`. Move them: backend secrets do **not** belong in the frontend `.env` — see "Secret hygiene" below.

### 3. Apply migrations to your Supabase project

You can run them via Supabase Dashboard → SQL editor (paste each migration), or via Drizzle:

```bash
npm run backend:migrate
```

Run order: `0000_initial.sql` first, then `0001_supabase_and_indexes.sql` (adds the FK to `auth.users` and the v0.7 §5.11 indexes).

### 4. Start the backend

```bash
npm run backend:dev
# [ddhq-backend] listening on :8080 (development)
```

Smoke test:

```bash
curl http://localhost:8080/health
# {"ok":true,"serverTime":"..."}

curl http://localhost:8080/trpc/auth.health
# {"result":{"data":{"ok":true,"serverTime":"..."}}}
```

### 5. Cut the frontend over

In a separate terminal:

```bash
# In repo root
echo 'VITE_USE_MOCK_API=false' >> .env.local
echo 'VITE_API_URL=http://localhost:8080' >> .env.local
npm run dev
```

Open http://localhost:5173.

### 6. End-to-end first-user flow

You can now provision a firm entirely through the UI — no curl needed.

**6a. Disable email confirmation in Supabase (dev only).** Dashboard → Authentication → Providers → Email → Confirm email = **off**. Otherwise the FE signup will say "Check your email" and the test loop slows down.

**6b. Sign up.** Click "Create a firm" → enter email + password → submit. The FE calls `supabase().auth.signUp()`; on success it routes to `/onboarding/firm`.

**6c. Provision the firm.** Enter firm name, pick a state from CA/NY/TX/LA/FL (Phase 0 enum), click Continue. The FE calls `auth.bootstrap` which creates the `firms` row + `public.users` row in one transaction. You're now provisioned.

**6d. Refetch session.** SessionProvider's `useEffect([local])` triggers a refetch when local session updates. After bootstrap completes you should see Dashboard render — the BE returns the real firm in `auth.session`.

**Alternate (CLI test path).** If you want to skip the UI:

```bash
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"..."}' | jq -r .access_token)

curl -X POST http://localhost:8080/trpc/auth.bootstrap \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"firmName":"Mitchell CPA","primaryStates":["CA"],"displayName":"Sarah Mitchell"}'
```

---

## Deploying backend to Fly.io

### One-time setup

```bash
fly auth login

# From repo root (where fly.toml lives):
fly apps create duedatehq          # if "duedatehq" is taken, edit fly.toml `app = '...'`

# Set secrets — these never go in the repo:
fly secrets set \
  DATABASE_URL='postgresql://...' \
  SUPABASE_URL='https://xxxxx.supabase.co' \
  SUPABASE_ANON_KEY='eyJ...' \
  SUPABASE_SERVICE_ROLE_KEY='eyJ...' \
  CORS_ORIGIN='https://your-vercel-domain.vercel.app' \
  RESEND_API_KEY='re_...'        # outbound email (omit in dev — emails.send logs + skips)
```

`RESEND_API_KEY` is optional in dev: `emails.send` writes the row, fires the Activity event, and returns `{ providerSkipped: true }` when the key is missing — useful for running the BE locally without burning send quota. Production requires it; without the key, no chase emails actually leave the building.

### Deploy

```bash
fly deploy
```

The Dockerfile at repo root builds `backend/` into a Node 22 image. Health check hits `/health`; if it 200s, Fly marks the deploy healthy.

After first deploy, update the FE env on Vercel:

```
VITE_API_URL=https://duedatehq.fly.dev
VITE_USE_MOCK_API=false
```

---

## Secret hygiene

`backend/.env.local` is gitignored. **Backend secrets must never live in the frontend `.env`** — Vite only exposes `VITE_*` to the browser, but the file is still a single point of leak (laptop theft, accidental `git add -f`, screen-sharing).

You currently have these in `~/Desktop/DueDateHQ_dashboard/.env`:

```
SUPABASE_SERVICE_ROLE_KEY  ← belongs in backend/.env.local + fly secrets
SUPABASE_SECRET_KEY         ← same
REDIS_URL                   ← Phase 1 (BullMQ workers)
UPSTASH_REDIS_REST_TOKEN    ← Phase 1
RESEND_API_KEY              ← Phase 1 (email)
GEMINI_API_KEY              ← Phase 1 (AI)
ANTHROPIC_API_KEY           ← Phase 1 (AI fallback)
CLOUDFLARE_API_TOKEN        ← Phase 1 (scrapers)
FLY_API_TOKEN               ← CI only, never on disk in any .env
SENTRY_AUTH_TOKEN           ← CI only (sourcemap upload)
```

Move the Supabase service-role + secret keys into `backend/.env.local`. The rest can stay in your shell as you provision Phase 1 services. The Fly token belongs in `~/.fly/config.yml` (created by `fly auth login`); don't keep it on disk in plaintext .env files.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `auth.session` returns null after bootstrap | Email-confirmation pending in Supabase | Disable email confirmation in dev (Auth → Providers → Email → Confirm email = off) |
| `relation "auth.users" does not exist` on migration | Running 0001 against a non-Supabase Postgres | Skip 0001's auth FK block (the migration handles this automatically with `WHEN undefined_table`) |
| 401 on every tRPC call | JWT expired (15min default) | FE auto-refresh kicks in via supabase-js; if testing manually, fetch a new token |
| CORS error in browser | `CORS_ORIGIN` doesn't match your FE URL | `fly secrets set CORS_ORIGIN=https://your-frontend.vercel.app` then `fly deploy` |
| `prepared statement "..." already exists` on queries | Connecting to PgBouncer with `prepare: true` | Already handled — `postgres()` is initialized with `prepare: false` in `src/db/client.ts` |
| Backend dev server crashes on save | Stale `.vite` pre-bundle | `rm -rf node_modules/.vite` and restart |

---

## What Phase 1 will need

When you're ready to expand past Phase 0:

1. **Tasks + checklist_items + activity_events tables** (arch §5.4–5.6) and routers
2. **State announcement pipeline** — Cloudflare Workers scrapers, LLM parser, matching engine (arch §9)
3. **AI service** — Mode A (classifier), Mode C (anomaly), Mode D (email draft) (arch §6)
4. **Email service** — Resend integration, Method A inbound forwarding (arch §7)
5. **BullMQ workers** — bound to Upstash Redis (arch §4.3)
6. **Realtime** — Supabase Realtime or self-hosted WS (arch §3.3)

Each is a self-contained story. Phase 1 is roughly 6–8 weeks of build.
