# Sprint 3 — Backend handoff

> Hand this file to the **backend Claude session** (the Hono + tRPC + Drizzle +
> BullMQ + Supabase + Fly.io session). Sprint 3 closes the loop between the
> v0.7 frontend (already merged on `codex/codexv0.7`) and live integrations.
>
> Frontend is **mock-mode-clean**: every page reads through `trpc.*` hooks; the
> mock adapter at `src/lib/api/mock-adapter.ts` is the only place that knows
> about `src/data/store.ts`. Flipping `VITE_USE_MOCK_API=false` switches the
> link to `httpBatchLink({ url: VITE_API_URL + "/trpc" })`.

---

## What "Sprint 3 done" means

When the backend session finishes the items in §1, the frontend can flip
`VITE_USE_MOCK_API=false` in `.env.local`, point `VITE_API_URL` at the
deployed Fly app, and the entire UI works against real data without further
frontend code changes. Every type, route, and mutation shape is already
aligned to the contract in `src/lib/api/router.ts`.

---

## 1. Backend procedures the frontend needs (P0)

These already exist as **stubs** on the backend (per current `server/trpc/router.ts`).
Each must return real data backed by Drizzle + Supabase. Order is dependency-aware.

### 1.1 Auth + session
- `auth.session` — read Supabase JWT from cookie/header, return `{ user, firm, tier }`
- `auth.login`, `auth.signup`, `auth.logout`, `auth.acceptInvite`, `auth.forgotPassword`, `auth.resetPassword`
- **Frontend expectation**: `auth.session` returning `null` triggers redirect to `/login`. After successful `auth.login`, frontend invalidates `auth.session` and reads the new value.

### 1.2 Client surface
- `clients.list` — filters: `search`, `state[]`, `entityType[]`, `status[]`, `hasDeadlineThisWeek`, `assigneeId`. Returns `{ items: Client[]; nextCursor? }`.
- `clients.get`, `clients.create`, `clients.update`, `clients.archive`
- `clients.assignBundle`, `clients.unassignBundle`
- `clients.addNote`, `clients.toggleNotePin`, `clients.deleteNote`
- **New substrate fields** (Sprint 2): `county`, `industry`, `fiscalYearEndMonth`, `dateOfIncorporation`, `priorYearStatus`. Drizzle schema already has these columns; just plumb them through `clients.create` + `clients.update` payloads.

### 1.3 Task + checklist + email draft surfaces
- `tasks.get(taskId)` returns `TaskDetail = { task, deadline, checklistItems, activityTimelineRecent, aiInsights, client }`
- `tasks.markComplete`
- `tasks.checklist.confirm | reject | markNotApplicable | restore | createCustom`
- `tasks.simulateInbound` — Mode A/C dev-only path; production replaces with the real inbound webhook
- `emailDrafts.create | update | send | schedule | discard`
- **Critical invariant** (PRD §5.3): AI must never promote a checklist item to `received_confirmed`. Enforce in the mutation handler — only `state_changed_by_kind = 'user'` may write that state.

### 1.4 State alerts (Announcements)
- `announcements.list({ activeOnly? })`
- `announcements.get(id)`
- `announcements.markRead | dismiss | snooze | acknowledge`
- `announcements.batchAdjustDeadlines` — Yellow-zone confirmed mutation
- `announcements.detect` — manual trigger (cron will replace)
- **`AffectedClientMatch` table** (arch §5.9) needs to power the per-row `matchBasis` text + excluded-with-reason section the frontend already renders. The mock-adapter computes match basis client-side from `Announcement.counties / entityTypes`; the real backend should produce these per-match metadata rows during scrape and return them inside `Announcement.affectedClientMatches: AffectedClientMatch[]`. Frontend will swap the client-side computation for the server data when this lands.

### 1.5 Bundles / Service Packages
- `servicePackages.list` — system + firm-custom
- `servicePackages.suggestForClient({ entityType, primaryState, priorYearStatus })` returns highest-ranked bundle
- `servicePackages.assignToClient`, `servicePackages.clone`, `servicePackages.updateCustom`

### 1.6 Notifications + reminder templates
- `notifications.list`, `notifications.markRead`, `notifications.markAllRead`, `notifications.dismiss`
- `notifications.updatePreferences` — per-user delivery prefs (digest_8am vs per_alert)
- `reminderTemplates.list`, `reminderTemplates.update`
- **Seeded data**: 18 system reminder templates (already seeded in `server/db/seed.ts`)

### 1.7 Imports
- `imports.detectFormat({ storageKey })` — runs LLM on uploaded CSV header row, returns `{ source, confidence }`
- `imports.suggestFieldMapping({ storageKey, source })` — returns column-to-field map
- `imports.preview({ storageKey, mapping })` — returns `DetectedRow[]`
- `imports.commit({ rows, source, skippedCount })` — actually creates clients + deadlines, returns `{ ids, importId }`
- `imports.listHistory`, `imports.undo({ id })` — 7-day window
- **Tier 1** (CSV roster) is the P0 path. Tiers 2–4 (QBO sync, Method B, Gmail OAuth read) are P1.

### 1.8 Integrations
- `integrations.list` — what this firm has connected, with `status: 'connected' | 'error' | 'revoked'` and `lastSyncAt`
- `integrations.available` — what's offerable for this tier (returns `{ type, label, tier }[]`)
- `integrations.connect({ type })` — kicks off OAuth round-trip; should redirect-or-popup
- `integrations.syncNow({ id })`, `integrations.disconnect({ id })`
- **Tier 0 P0**: QBO, Xero, Gmail-send, Outlook-send. **Tier 0 P1**: Gmail-read (Method B), Outlook-read.

### 1.9 Uploads
- `uploads.requestUrl({ kind, filename, contentType })` returns `{ uploadUrl, storageKey }`. `uploadUrl` is a Supabase Storage pre-signed PUT.
- Frontend wraps this in `src/lib/api/upload.ts` (`uploadFile(kind, file)`); just make the URL a real signed URL.

### 1.10 Team
- `team.list`, `team.invite`, `team.updateRole`, `team.remove`. Pro/Team only.

---

## 2. Cross-cutting infrastructure (P0)

### 2.1 Email Phase 1 send pipeline
PRD §7.2 + §7.7. Outbound flow:
1. `emailDrafts.send` enqueues a BullMQ job
2. Job sends via Postmark/Resend with `from: firm@duedatehq.com`, `reply-to: <task forwarding address>`, `cc: <CPA email>`
3. On success: write activity-log entry `📤 reminder sent (CPA-approved AI draft)`
4. On bounce webhook: insert `Notification` of `kind: 'email_bounce'`, set `Contact.emailBouncesConsecutive++`, mark `emailVerified=false` after 3 consecutive

### 2.2 Method A inbound pipeline
PRD §7.4 + arch §7.2. Per-task forwarding address `firstname-form-token@duedatehq.com`.
1. Inbound mail provider (Postmark inbound) hits `/inbound/email`
2. Parse `to:` to find `(firmId, taskId)` from token
3. Strip attachments, store in Supabase Storage by hash, persist URL only on `ChecklistItem.sourceDocumentUrl`
4. AI classification on subject + body + attachment OCR → if `confidence >= 0.7` → `received_unreviewed`; else `received_issue` with `aiFlagReason: 'low classification confidence'`
5. **Never** promote to `received_confirmed`

### 2.3 State announcement scrape pipeline
Arch §9. BullMQ cron every 4h. LLM parse with `confidence >= 0.75` auto-publish; `0.5–0.75` queue for human review; `< 0.5` reject. After publish, run match engine to populate `affectedClientMatches`.

### 2.4 Realtime notifications
Frontend already polls `announcements.list({ activeOnly: true })` every 30s via `src/hooks/useRealtimeAnnouncements.ts`. When Supabase Realtime is wired (P1), swap the hook's internals for a subscription — signature stays.

### 2.5 RLS
Every table in `server/db/schema.ts` needs `firm_id` RLS via Supabase JWT claim. The frontend already assumes single-firm scoping; never cross-firm leakage.

### 2.6 Sentry
Wire `@sentry/node` on backend + `@sentry/react` on frontend. Frontend already reads `VITE_SENTRY_DSN` from env; just provide it.

---

## 3. Where frontend has client-side computation that real backend should subsume

These are honest mock-mode shortcuts. They produce correct UX but should move to the server when ready.

| Feature | Today (mock) | When backend lands |
|---|---|---|
| Alert match basis + excluded-with-reason | Computed in `AnnouncementDetail.computeMatches()` from `Announcement.counties / entityTypes` | Server returns per-match `AffectedClientMatch` rows with `matchBasis` field |
| Forwarding email address on Task header | Stored on `task.forwardingEmailAddress` in mock data | Server generates real `firstname-form-token@duedatehq.com` per task |
| Bundle assignment generates deadlines | `actions.assignBundle` runs `generateDeadlinesFromBundle` synchronously | Server generates via `service_templates.due_date_rule` + rollover logic; runs in transaction |
| Announcement detector | `actions.detectNewAnnouncements` reads `mockStateFeed.ts` on dashboard mount | BullMQ cron writes real announcements; frontend's poll picks them up |
| Bounce notifications | Mock data | Postmark webhook → `Notification` table |
| Audit-trail JSON export | Settings → Data → Download JSON reads `localStorage` | Server endpoint streams firm scope as JSON; PDF variant ships P1 |

---

## 4. Frontend wiring tasks during cutover (small, mechanical)

When backend is ready, this session does:

1. Update `.env.local`:
   ```
   VITE_USE_MOCK_API=false
   VITE_API_URL=https://duedatehq-api.fly.dev
   ```
2. Verify `src/lib/api/router.ts` `AppRouter` type still imports cleanly from `../../../server/trpc/router`
3. `npm run dev` and walk every route; fix type drift if any (target: < 20 errors)
4. Wire Supabase JS auth client into `SessionProvider` so cookies set by `auth.login` get read by `auth.session`
5. Replace `mock-link.ts` from being shipped at all (it's currently always imported even when unused) — make the import dynamic behind `env.useMockApi`
6. Remove `actions.*` direct calls that bypass tRPC. Grep:
   ```
   grep -rn "actions\\." src/ --include='*.tsx' --include='*.ts'
   ```
   Each remaining call should become a mutation hook
7. Smoke test: signup → onboarding/firm → onboarding/layer-1 → import 5 demo clients → see a triage dashboard with real deadlines → click into a task → send a reminder draft → see it in activity log
8. Deploy frontend to Vercel preview

---

## 5. P1 (after Phase 0 backend ships)

- Email Phase 2 auto-send + 24-hour recall window (PRD §7.3 + §11.2)
- Method B inbound (Gmail OAuth read scope)
- Mode B / C / E real surfaces (currently cold-start placeholders)
- Tier 1 integrations: SharePoint, HubSpot, Mailchimp, Lacerte/Drake/UltraTax/ProSeries
- Service-package dependency chains (1065 → K-1 → 1040)
- Audit-trail multi-year packer
- Public `/changes` page
- 2FA TOTP

---

## 6. Forever-no (do not propose)

PRD §1.7. Documenting here so the backend session doesn't accidentally build them:
- Client portal as a destination
- Long-term document vault (we hash + reference; no S3 long-term storage of bytes)
- Billing / invoicing
- Time tracking
- Tax preparation
- Audit-risk prediction
- Legal interpretation
- CCH Axcess integration
- Bank account access
- AI auto-send without 3 conditions met (Phase 2 has 3-condition gate; never bypass)
- "Team inbox" cross-task email view
- "AI is learning" copy anywhere

---

## 7. Open questions for the user before backend kickoff

1. **Postmark vs Resend** for outbound + inbound mail? Recommend Postmark (their inbound parsing is mature).
2. **Cron host** for announcement scrape — Fly Machines `[deploy.release_command]` schedule, or BullMQ + Redis? Recommend BullMQ since we need backoff + dedupe.
3. **Supabase JWT secret rotation policy** — currently never rotated. OK for MVP; revisit before public beta.
4. **Sentry org/project** — already provisioned (rotated 2026-04-28 per `CREDENTIALS-MAP.md`); confirm DSN is populated in Fly secrets.
5. **Domain** — when does `duedatehq.com` start resolving to the Fly app? Outbound email `from: firm@duedatehq.com` and inbound `*@duedatehq.com` both need DNS first.

---

*v1 · 2026-04-28 · Hand-off from frontend session (codex/codexv0.7) to backend session.*
