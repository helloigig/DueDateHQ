# Credentials map

> Where each credential lives. **Never** put values in this file — values go in
> `.env.local` (frontend, gitignored) or in `fly secrets set` / backend env
> (backend, never on disk in plaintext).

## Frontend (`.env.local` in this repo, browser-readable)

| Var | Source | Notes |
|---|---|---|
| `VITE_API_URL` | Fly.io app URL once deployed | Path `/trpc` appended in `client.ts` |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API | Public, safe |
| `VITE_SUPABASE_ANON_KEY` | Same panel | Public anon JWT, designed for browser |
| `VITE_PUBLIC_ASSETS_URL` | CDN URL when set up (Cloudflare R2 / Supabase Storage) | Public |
| `VITE_SENTRY_DSN` | Sentry → Project Settings → Client Keys (DSN) | Public DSN; auth token stays backend |
| `VITE_USE_MOCK_API` | `true` until backend ships | — |

## Backend only (Fly secrets — `fly secrets set`)

These NEVER reach the browser. The backend session owns them.

| Var | Source | Used for |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → API → service_role | Server-side queries that bypass RLS |
| `SUPABASE_SECRET_KEY` | Supabase Dashboard → API → secret | Admin SDK |
| `DATABASE_URL` | Supabase Dashboard → Database → Connection string (use the pooled connection) | Drizzle migrations + queries |
| `FLY_API_TOKEN` | `fly tokens create deploy` (scoped) | CI deploys (don't reuse the org-wide token) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → API Tokens (scope: edit DNS for one zone) | DNS automation if needed |
| `GOOGLE_AI_API_KEY` | aistudio.google.com → API keys | Gemini calls (state-announcement parsing, import-format detection) |
| `SENTRY_AUTH_TOKEN` | Sentry → User → Auth Tokens (scope: project:releases) | Source-map upload during build only |
| `EMAIL_PROVIDER_KEY` | TBD (Resend/Postmark) | Outbound email |

## Rotation schedule

- **Service role / secret keys**: rotate quarterly, or immediately if shared in any channel that retains messages (Slack, chat, email).
- **Fly token**: generate a deploy-scoped one for CI; don't ship the org-wide one.
- **Sentry token**: scope to the minimum (`project:releases`) and rotate yearly.
- **Gemini key**: rotate if it appears in any client log; restrict by HTTP referrer in Google Studio.

## Incident: 2026-04-28

User pasted the full credential set in chat. The following were rotated the
same day:

- Supabase service_role JWT — rotated
- Supabase secret key — rotated
- Fly.io org API token — rotated
- Cloudflare API token — rotated
- Google Studio API key — rotated
- Sentry auth token — rotated

The Supabase anon + publishable keys + project URL are public by design and
were not rotated. The anon key in `.env.local` was verified against the live
Supabase auth endpoint after rotation and still authenticates correctly,
which confirms the underlying JWT secret was not reset.

For future credential drops: never paste in chat. See "Pattern 1" in
[FRONTEND-INTEGRATION-PREP.md](./FRONTEND-INTEGRATION-PREP.md) §11 — let the
backend session prompt for `fly secrets set` and paste values into your own
terminal.
