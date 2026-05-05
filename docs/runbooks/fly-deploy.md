# Fly deploy runbook

Operational knowledge for the `duedatehq` backend on Fly.io. Read [backend/RUNBOOK.md](../../backend/RUNBOOK.md) for first-time setup; this doc is for "something is wrong with prod" or "I need to remember why we set X up this way."

---

## Architecture in one diagram

```
        Vercel                       Fly.io                    Supabase
  ┌────────────────────┐    ┌──────────────────────┐    ┌──────────────────┐
  │ duedatehq.space    │───▶│ duedatehq.fly.dev    │───▶│ Postgres         │
  │ (frontend, Vite)   │    │ (Hono + tRPC + Drizzle)│   │ (rls + auth)     │
  └────────────────────┘    └──────────────────────┘    └──────────────────┘
       VITE_API_URL              fly.toml at repo root        DATABASE_URL
       points to backend         is the source of truth       in fly secrets
```

**One Fly app, one Vercel project, one Supabase database.** If you ever see a
second `duedatehq-*` Fly app, that's the trap from 2026-05-02 — see the
incident note below.

---

## When prod is unreachable: triage flow

Run these in order. Stop at the first thing that's wrong.

### 1. Is the public URL actually down, or is your client just CORS-blocked?

```bash
curl -sf --max-time 10 https://duedatehq.fly.dev/health
# → {"ok":true,"serverTime":"…"}
```

- **200 OK** → Backend is up. The problem is downstream (CORS, frontend config, browser cache, auth). Skip to step 6.
- **Times out / 502 / connection refused** → Fly proxy can't reach the app. Continue.

### 2. Are the Fly machines healthy?

```bash
fly status --app duedatehq
```

Look at the `CHECKS` column:
- `1 passing` → machines are fine, problem isn't here
- `1 critical` → health check failing — the most common deploy regression
- `1 warning` → in grace period, give it 30s and recheck
- `state: stopped` → autostop kicked in (normal idle state); machine wakes on traffic

### 3. If health check is critical, is the port aligned?

This is the #1 historical bug. The health check is on `internal_port` (set in `fly.toml`); the app must bind to the same port.

```bash
# What's the saved machine config say?
fly machine list --app duedatehq --json | jq '.[].config | {env, services: [.services[] | {internal_port}]}'
# → env.PORT and services[0].internal_port should match.

# What's the running app reporting?
fly logs --app duedatehq --no-tail | grep "backend.listening" | tail -1
# → "port":8080  (must match internal_port)
```

If `port` in the log doesn't match `internal_port` in the machine config, the
health check probes the wrong port forever and traffic never routes. Fix by
aligning fly.toml's `[env] PORT` and `[http_service] internal_port`, then
redeploying.

### 4. Are migrations actually running?

```bash
fly logs --app duedatehq --no-tail | grep -E "migrations applied|relation .* does not exist"
```

Expected: `[ddhq-backend] migrations applied` after each deploy. If you see
`relation "X" does not exist`, the migration that creates `X` didn't run.

Two ways this fails:

- **`[deploy] release_command` missing from `fly.toml`.** Run `fly config show
  --app duedatehq | grep release_command` to confirm one is configured.
- **Drizzle's runtime migrator skipped the migration.** Drizzle compares
  `journal.when` (the timestamp in `meta/_journal.json`) against the latest
  `__drizzle_migrations.created_at` in the DB. If a journal entry was added
  with a `when` ≤ the latest applied timestamp, it gets silently skipped.
  Check `meta/_journal.json` timestamps are strictly monotonically increasing,
  and bump the `when` on any new entry to a value strictly greater than the
  current `__drizzle_migrations.MAX(created_at)` in prod.

Recovery: SQL migrations 0005+ are idempotent (`IF NOT EXISTS`, `DO BEGIN
EXCEPTION WHEN duplicate_object` for ENUMs), so you can paste the failing
migration directly into the Supabase SQL editor as a manual fix.

### 5. Is `fly.toml`'s `[env]` actually being honored?

The trap from 2026-05-02. Fly `secrets` override `[env]` unconditionally and
silently. Run:

```bash
fly secrets list --app duedatehq | grep -E "^(NODE_ENV|PORT)"
```

If `NODE_ENV` or `PORT` are listed, **they shadow your fly.toml**. Unset them:

```bash
fly secrets unset NODE_ENV PORT --app duedatehq
```

This triggers a redeploy. After the redeploy, fly.toml's `[env]` finally
takes effect.

### 6. Is the frontend pointing at the right backend?

If `/health` returned 200 but the user still sees errors, the browser may be
hitting a different URL than `duedatehq.fly.dev`. Verify:

```bash
# What URL is baked into the production frontend bundle?
curl -s https://duedatehq.space/ | grep -oE 'src="/assets/index-[^"]+\.js"'
# → src="/assets/index-XXXXXXX.js"

curl -s https://duedatehq.space/assets/<the file above> | grep -oE 'apiUrl[^,}]+'
# → apiUrl: `https://duedatehq.fly.dev`
```

The frontend uses Vite, which inlines `import.meta.env.VITE_API_URL` at build
time. If the value here is wrong, fix `VITE_API_URL` in Vercel project
settings and trigger a rebuild.

### 7. CORS rejecting?

Browser shows `Access to fetch at … blocked by CORS policy`. Check:

```bash
curl -i -X OPTIONS \
  -H "Origin: https://duedatehq.space" \
  -H "Access-Control-Request-Method: GET" \
  https://duedatehq.fly.dev/trpc/auth.session
# Expect: access-control-allow-origin: https://duedatehq.space (or *)
```

If absent, update the secret:

```bash
fly secrets set CORS_ORIGIN="https://duedatehq.space" --app duedatehq
# Comma-separated for multi-origin: "https://duedatehq.space,https://*.vercel.app"
```

The backend supports `*` (echo origin), single origin, or comma-separated list
— see `backend/src/index.ts` CORS block.

---

## Known gotchas (reference)

| Gotcha | What goes wrong | Why | Defense |
|---|---|---|---|
| Bulk `fly secrets set` from `.env.local` | Runtime ignores fly.toml `[env]` | Fly secrets override `[env]` unconditionally | After first deploy, `fly secrets list` and unset anything that duplicates an `[env]` key (`PORT`, `NODE_ENV` are the usual suspects) |
| `[deploy] release_command` missing | Migrations silently no-op | Releases just skip the migrate step entirely; no error | Always have `release_command = "node dist/db/migrate.js"` in fly.toml |
| `meta/_journal.json` not updated when adding `.sql` | New migration silently skipped | Drizzle's runtime migrator only applies entries listed in the journal | Always commit `_journal.json` change in the same PR as the `.sql` |
| Journal timestamp ≤ latest applied | Migration listed in journal but still skipped | Drizzle uses `created_at < journal.when` comparison | Make sure new entries have `when > MAX(__drizzle_migrations.created_at)` on prod |
| `CREATE TYPE` in migration without DO block | Re-running the migration fails | PG doesn't support `CREATE TYPE IF NOT EXISTS` | Wrap in `DO $$ BEGIN CREATE TYPE …; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` |
| Two Fly apps for one service | Frontend points at the broken one | Drift accumulates between them; only one ever gets fully wired up | One repo → one Fly app. Destroy any leftovers. |
| External service URLs cached at the dead app | Webhooks deliver into the void | Resend / SES / OAuth callbacks were registered before consolidation | Walk the [integration callback registry](#integration-callback-registry) below after any URL change |

---

## Integration callback registry

External services hold URLs that point at the Fly app. Whenever you change the
Fly URL (custom domain, app rename, app destroy/recreate), every entry below
needs updating. Document the current state here as you set things up.

| Service | What's registered | Where to update |
|---|---|---|
| Resend (outbound email) | Webhook: `<fly-url>/api/delivery/resend/<DELIVERY_WEBHOOK_SECRET>` | Resend dashboard → Webhooks |
| AWS SES (inbound email) | SNS topic POSTs to `<fly-url>/api/inbound/email/ses/<INBOUND_WEBHOOK_SECRET>` | SES → Email receiving → Rule sets |
| Postmark (alt inbound) | Server-level inbound webhook URL | Postmark dashboard → Servers → Inbound |
| Google OAuth (Gmail) | Authorized redirect URI: `<fly-url>/oauth/callback` | Google Cloud Console → OAuth consent → Credentials |
| Intuit OAuth (QBO) | Redirect URI: `<fly-url>/oauth/callback` | Intuit developer portal → Keys & OAuth |
| Microsoft OAuth (Outlook) | Redirect URI: `<fly-url>/oauth/callback` | Azure AD → App registrations → Authentication |

`<fly-url>` is currently `https://duedatehq.fly.dev`.

---

## Incident reference: 2026-05-02 — Fly deploy outage

### TL;DR

Prod was returning 502s for several hours. Five layered bugs, single root
cause: a `fly deploy` from repo root with a `fly.toml` that had drifted from
the saved server-side config. Fixed by [PR #60](https://github.com/helloigig/DueDateHQ/pull/60) +
operational changes that aren't reproducible from the repo:
`fly secrets unset NODE_ENV PORT` and `fly secrets set CORS_ORIGIN`.

### What was broken

| # | Bug | Symptom | Cause |
|---|---|---|---|
| 1 | Port mismatch | Fly proxy → 502; `curl /health` times out | Live machine had `internal_port=8080` + `PORT=8080` env, but app listened on **8000** because root fly.toml had `PORT="8000"` AND a `PORT=8000` shadow secret. Health check `servicecheck-00-http-8080` permanently `critical`. |
| 2 | `relation "federal_forms" does not exist` per cycle | log spam + `/api/scraper/status` 500s | Root fly.toml had **no** `[deploy] release_command`. Recent deploys reused a Docker layer with the pre-PR-#58 `_journal.json`, so migrations 0005/0006 silently no-op'd while logging "migrations applied". |
| 3 | `env=development` in prod | env-gated paths took the dev branch | Live machine env had `NODE_ENV=production` but a `NODE_ENV=development` shadow secret overrode it. Caught only by `fly secrets list`. |
| 4 | Two competing Fly apps | Frontend hit the broken one | `duedatehq` (canonical, 21 secrets) vs `duedatehq-backend` (8 secrets, stale `DATABASE_URL`, postgres circuit-breaker tripped). Vercel's `VITE_API_URL` pointed at the latter. |
| 5 | federalRegister poller crashed loudly when its tables were missing | Stack trace per 6h tick + Sentry capture | `runFederalRegisterCycle` didn't recognize 42P01 (undefined_table) as recoverable. |

### What fixed it

In code (PR #60):
- Added `[deploy] release_command = "node dist/db/migrate.js"` to root `fly.toml`.
- Aligned `[env] PORT=8080` and `internal_port=8080`.
- Wrapped migration 0006's `CREATE TYPE` in `DO $$ … EXCEPTION WHEN duplicate_object $$` blocks so it's safe to re-run.
- Made `runFederalRegisterCycle` and `listFederalRegisterStatus` recognize 42P01 and skip with a single `warn` log.
- Labeled `backend/fly.toml` and `backend/Dockerfile` as deprecated templates so nobody runs `cd backend && fly deploy` again.
- Updated `DEPLOY.md` to match `RUNBOOK.md` ("deploy from repo root").

Operationally (not in repo, must be re-applied per environment):
- `fly secrets unset NODE_ENV PORT --app duedatehq` to remove shadow secrets.
- `fly secrets set CORS_ORIGIN="https://duedatehq.space" --app duedatehq` to allow the production frontend domain.
- Vercel `VITE_API_URL` repointed from `https://duedatehq-backend.fly.dev` to `https://duedatehq.fly.dev`, then frontend rebuild.

### What we still need to do

- [ ] Destroy `duedatehq-backend` Fly app once external services (Resend webhook, OAuth redirect URIs) are confirmed to reference `duedatehq.fly.dev`. **Walk the [integration callback registry](#integration-callback-registry) before destroying.**
- [ ] Walk the registry to confirm every external service is registered against the canonical app, not the doomed one.
- [ ] Replace the dead state-tax RSS sources (FTB CA, NY tax, TX comptroller, MA, WA — see [issue tracking the 403/404 fetches](https://github.com/helloigig/DueDateHQ/issues)) — datacenter-IP blocks won't go away on Fly; needs Cloudflare Workers proxy or curated IRS-only mode for now.

### Lessons that became canon

1. **Fly secrets override `[env]` unconditionally.** Never bulk-paste `.env.local` into `fly secrets set`. Run `fly secrets list` after every deploy to a new app.
2. **Always have `[deploy] release_command` explicitly in fly.toml.** Don't rely on Fly's saved server-side config carrying it from a previous deploy.
3. **Drizzle's runtime migrator is timestamp-based, not hash-based.** Adding journal entries with artificial small `when` timestamps risks being skipped if any prior deploy advanced `__drizzle_migrations.created_at` past them. Always set `when > MAX(__drizzle_migrations.created_at)` on the target DB.
4. **`CREATE TYPE` is not idempotent in PG.** Wrap every ENUM creation in a `DO $$ … EXCEPTION WHEN duplicate_object $$` block so partial-apply states are recoverable.
5. **One repo, one Fly app per service.** Drift between parallel deploys is inevitable and the lookalike URLs make the bug invisible until something breaks.
6. **CORS_ORIGIN must enumerate every origin the frontend can run from**, including the production custom domain. Default to `*` only in dev.
