# Federal Forms Catalog + State Alerts — Product Debrief

_Last updated 2026-05-02 · Author: Yuqi + Claude · Repo: helloigig/DueDateHQ · Branch: claude/fix-canonical-form-types_

A single-source-of-truth doc covering every product decision, architectural choice, UX flow, known gap, and "what's left" item across two adjacent feature areas: the **federal forms catalog** (BE + FE) and the **state alert action surface** (`/alerts/:id`).

This doc covers everything we built and decided in the federal forms + state alerts feature areas: history, architecture, decisions, UX flows, persona journeys, bugs, gaps, and roadmap.

Read this if you are: about to ship a PR in either area, onboarding to the codebase, briefing Yan Jing / a future hire, or running a retro.

---

## 1. Executive Summary

We have shipped two product surfaces this quarter that move DueDateHQ closer to its core thesis ("client intelligence layer for CPAs — replicate the partner's attention, surface the gap, never replace the artifact").

**What's live:**

- **First-class federal forms catalog** in Postgres (`federal_forms` table, 34 curated rows in production as of 2026-05-02) — the BE source of truth for "what tax forms exist, what entity types they apply to, what the due date is, where to read the IRS PDF."
- **LLM extractor** for long-tail forms (Form 5471, niche specialty forms) — get-or-create on demand, confidence-scored, admin-reviewable.
- **Federal Register polling worker** that ingests IRS/Treasury rule changes hourly, fans them out to a `federal_form_change_events` audit log, and surfaces a reviewer queue. Never auto-mutates a form row — admin always applies.
- **FilingsTab** on Client Detail with three zones (Suggested / Covered / Reference) that rank federal forms by entity-type applicability and surface the gap (forms that apply but have no deadline yet).
- **AddDeadlineModal** that picks from the BE catalog, falls back to a hardcoded COMMON_FORMS list, and triggers LLM extraction on unrecognized form numbers.
- **State alert detail page** (`/alerts/:id`) with verdict-first IA — affected clients on top, evidence collapsed below — and one-verb action surface (Adjust / Notify / Dismiss / Share) tied to alert type.
- **BatchNotifyModal** that combines deadline adjustment + email notification flows, with undo support for adjustments.
- **State announcements pipeline** (parallel to federal-register pipeline): scrapers → `announcements` table → matchers → per-firm Today banner / `/alerts` page.

**What's not yet shipped (the gap):**

1. Per-form **required materials checklist** (W-2, 1099-INT, K-1, etc.) is in the FE catalog but never displayed in `FilingsTab` — biggest visible gap.
2. Entity-type matching is **case-sensitive** in the BE router — silent zero-result if a client's `entityType` casing doesn't match the seed's casing. **Symptom: Anne Dupont (NY individual) shows empty Filings tab despite 34 rows in DB.**
3. `required_items` column doesn't exist on the BE `federal_forms` table — only the FE-side `src/data/federalForms.ts` has the rich per-form checklists.
4. LLM-extracted forms don't pre-populate `required_items` (no schema slot for it).
5. FilingsTab has no "Open IRS PDF" affordance per checklist item — that data exists on the FE side too.
6. App-machine **health check timeouts** on Fly during deploys (rolling deploy gets stuck on second machine; deploys still effectively succeed but the UX is alarming).
7. No FE/BE catalog reconciliation — FE has 51 forms, BE has 34. Drift can compound.
8. No catalog admin reviewer UI — `recentChanges` data exists, no surface yet.

---

## 2. Decisions Log

A traceability table of every product / architectural decision made in this feature area. Newest at the bottom. The `Why` column is the load-bearing field — read it first.

| # | Decision | Date | Why | Where |
|---|----------|------|-----|-------|
| D1 | Build BE `federal_forms` table as source of truth (vs FE-only) | Apr 2026 | FE catalog was hardcoded — every catalog edit was a code deploy. BE table lets curators (and LLM) extend without releases. Also enables Federal Register polling to flag changes. | `backend/migrations/0006_federal_forms.sql`, `backend/src/db/schema.ts` |
| D2 | Federal Register API as change-detection source (vs scraping IRS HTML) | Apr 2026 | Federal Register has a stable JSON API, structured publication metadata, is the legal authority for IRS/Treasury rule changes. Scraping IRS HTML is brittle. | `backend/src/lib/federal-register-poller.ts` |
| D3 | Curated seed for top 34 forms + LLM extractor for long-tail | Apr 2026 | Curating ~30 forms covers ~95% of CPA practice volume. LLM handles the 800+ tail without our team burning weeks on data entry. Confidence-scored so low-confidence rows don't reach end users without review. | `backend/src/db/federal-forms-data.ts`, `backend/src/lib/federal-form-extractor.ts` |
| D4 | LLM extractions <0.7 confidence → `status='pending_review'` | Apr 2026 | Don't show speculative AI-extracted rows in CPA-facing pickers. Admin reviewer queue catches them; they only graduate to `status='active'` after human ✓. | `federalForms` router, `extractFromLlm` procedure |
| D5 | Federal Register poller never auto-mutates `due_date_rule` | Apr 2026 | A wrong rule change cascades into wrong deadlines on every affected client. Reviewer-queue gating beats the cost of one extra admin step per detected change. Each notice writes a `federal_form_change_event`; admin marks `applied_at` to roll into the catalog. | `federal-register-poller.ts`, `markChangeReviewed` |
| D6 | Service bundles reference forms by `formCode`, not embedded copies | Apr 2026 | Same form (Schedule E) appears in 4+ bundles. Embedding means updating 4 times. Reference-by-code keeps catalog as single source of truth. | `src/data/serviceBundles.ts:includedFormCodes[]` |
| D7 | FilingsTab uses 3-zone layout: Suggested (loud) / Covered (quiet) / Reference (collapsed) | Apr 2026 | Per `feedback_gap_over_fill`: the "what client hasn't sent yet" must be loudest, "what's already on the calendar" quiet, encyclopedia (Reference) collapsed. Visual hierarchy IS product positioning. | `src/components/FilingsTab.tsx` |
| D8 | AddDeadlineModal mixes BE catalog + hardcoded COMMON_FORMS + custom + LLM | Apr 2026 | BE catalog is comprehensive but cold. COMMON_FORMS pinned to top covers 80% of one-click cases. Custom is escape hatch for non-federal niche forms ("PTE election", "NYC UBT"). LLM bridges to long-tail. | `src/components/AddDeadlineModal.tsx` |
| D9 | State alerts use one-verb action surface per alert type | Apr 2026 | Per `/critique` debrief: previous design had 4 buttons + a dead "Review one-by-one" button + greyed primary verb when `!newDeadline`. Collapsed to one typed verb per alertType (`disaster_extension → "Move N deadlines"`, `penalty_relief → "Tag for review"`, etc.). | `src/pages/AnnouncementDetail.tsx` |
| D10 | Verdict-first IA on alert detail (affected clients on top, evidence collapsed) | Apr 2026 | Sarah's morning-routine job is "which of MY clients does this affect?" — verdict, not evidence. Evidence (parsed impact, source link, related alerts) is below the fold, available but not gating. | AnnouncementDetail reading order |
| D11 | BatchNotifyModal handles both `adjust + notify` and `notify only` | Apr 2026 | Some alerts (disaster_extension) want both. Others (penalty_relief) only want email. One modal, one toggleable behavior, beats two modals or two CTAs. | `src/components/BatchNotifyModal.tsx` |
| D12 | Undo banner after batch operations — for deadline shifts only, not emails | Apr 2026 | Deadline mutations are reversible (write old/new pairs to action log). Sent emails are not. Show the undo only when it means something. | BatchNotifyModal post-action banner |
| D13 | Dismiss requires a reason (4 pre-canned + free-text) | Apr 2026 | Audit trail. "Why did Sarah dismiss this?" needs to be answerable in 30 days when she asks "why didn't I act on the FL DOR alert?" | `DismissWithReasonDialog` |
| D14 | Bell / Today banner / blocking modal / `/alerts` page are 4 distinct surfaces | Mar 2026 | Per `four_alert_surfaces` memory: bell = mixed inbox; banner = high-impact wedge for one alert; blocking modal = >72h critical; `/alerts` page = full triage. Different jobs, different scope filters. | `AnnouncementBanner.tsx`, `AlertsPage.tsx`, `BellDropdown.tsx`, `BlockingAlertsDialog.tsx` |
| D15 | Per-form `requiredItems` lives on FE catalog only (for now) | Apr 2026 | Shipped FE catalog with rich `requiredItems` (W-2, 1099-INT, K-1, etc.) sourced from IRS PDFs. Not yet ported to BE table — gap to close. | `src/data/federalForms.ts:requiredItems[]` |
| D16 | fly.toml `app` name = `duedatehq` (not `duedatehq-backend`) | 2026-05-02 | fly.toml shipped with `duedatehq-backend` but production secrets + machines lived on `duedatehq`. Every deploy was hitting the wrong app's stale secrets. Lost ~2 hours debugging. | `backend/fly.toml`, PR #59 |
| D17 | Drizzle migrations must be added to `_journal.json` | 2026-05-02 | PRs #45 (`0005`) and #56 (`0006`) shipped `.sql` files without journal entries → silent no-op on every deploy → `federal_forms` table never created until PR #58 added entries. Convention: any new migration → both file + journal entry. | `backend/migrations/meta/_journal.json`, PR #58 |
| D18 | Supabase `prepare: false` + `max: 1` for migrate.js (Transaction pooler compatible) | Apr 2026 | Drizzle migrations only need single-connection, no prepared statements. Transaction-pooler-compatible config (port 6543) means migrations work with Supabase's preferred pooler. | `backend/src/db/migrate.ts` |
| D19 | Multi-tenancy via application-layer firm_id scoping (not Postgres RLS) | Mar 2026 | tRPC `firmProcedure` attaches `firmId` to context; every query filters `eq(table.firmId, ctx.firmId)`. Simpler than RLS, easier to debug, and scales to "service-level" cross-firm reads (admin, analytics) without pg role gymnastics. | `backend/src/trpc/init.ts` |
| D20 | Inbound email pipeline = Method A (per-task webhook) + Method B (OAuth poll) | Mar 2026 | Method A (Postmark webhook to `emily-1040-X7fK@inbound.duedatehq.com`) is the default path — no OAuth, no per-mailbox config. Method B (Gmail/Outlook OAuth, 5-min poll) is the additive path for firms that want their full inbox processed. Same classifier, two ingress points. | `backend/src/lib/inbound-email.ts`, `backend/src/lib/method-b-poller.ts` |
| D21 | Outbound email via Resend (not SES) | Mar 2026 | Resend has best DX for TypeScript SDK + simplest webhook secret model. SES is cheaper at scale; we'll switch when sending >100k/mo. Path E posture (no email body persistence) is provider-agnostic. | `backend/src/lib/email-sender.ts`, `backend/src/trpc/routers/emails.ts` |
| D22 | Domain = `duedatehq.space` for production (not `.com`) | Mar 2026 | `.com` was taken; `.space` is cheap, brandable, and the chase-email links don't need to look "corporate." | `project_domain` memory |
| D23 | Federal Register pipeline mirrors state announcement pipeline (parallel design) | Apr 2026 | Both poll external APIs hourly, write to a notices table with idempotent dedupe, classify with regex+LLM, fan into a per-firm matcher. Reusing the pattern means `/api/scraper/status` can render both with one component. | `federal-register-poller.ts` ↔ `scraper.ts` symmetry |
| D24 | Eval harness gates inbound classifier in CI (precision/recall thresholds) | Mar 2026 | Per PRD §4.7: 7-class top-level ≥92% precision, 5-class sub-intent ≥90%, timeline_pushback FPR ≤3%. CI fails the build if regression. Prevents prompt drift. | `backend/eval/run.ts` |

---

## 3. Architecture

### 3.1 Data flow — Federal Forms

```
┌─────────────────────────────────────────────────────────────┐
│   Federal Register API (federalregister.gov/api/v1)         │
│   ↓ poll every 1h                                            │
│   federal-register-poller.ts                                 │
│   ↓                                                          │
│   federal_register_notices  (raw audit, idempotent)         │
│   ↓ regex + LLM form-number extraction                      │
│   federal_form_change_events  (linked to federal_forms)     │
│   ↓ admin reviews, marks applied_at                         │
│   federal_forms.due_date_rule UPDATED (manual gate)         │
└─────────────────────────────────────────────────────────────┘
          ↓ tRPC firmProcedure
┌─────────────────────────────────────────────────────────────┐
│   FE consumers:                                              │
│   - FilingsTab (applicabilityForClient)                     │
│   - AddDeadlineModal (list + extractFromLlm)                │
│   - AlertDetail (when alertType = form_change)              │
│   - Admin Catalog page (recentChanges, markChangeReviewed)  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 LLM extractor flow (on-demand)

```
User types "5471" in AddDeadlineModal
  ↓ no match in BE catalog
  ↓ trpc.federalForms.extractFromLlm({ formNumber: "5471" })
  ↓
LLM (Claude Haiku) extracts: name, category, entityTypes, dueDateRule, notes
  ↓
confidence ≥ 0.7 → INSERT row with status='active' (visible to all)
confidence < 0.7 → INSERT row with status='pending_review' (hidden until admin ✓)
  ↓
Same form requested again → idempotent SELECT (UNIQUE on form_number)
```

### 3.3 State alert action flow

```
Alert lands (banner, /alerts list, bell, deep-link with ?action=)
  ↓
AnnouncementDetail page loads
  ├─ VERDICT first: affected clients (pre-checked, ranked)
  ├─ Sticky action bar: typed verb based on alertType
  └─ Evidence collapsed below: parse metadata, source link, related alerts
  ↓
User clicks primary verb
  ↓ opens BatchNotifyModal (or DismissWithReasonDialog)
  ↓ batchAdjustDeadlines + queue notifications
  ↓ flash banner + undo button (deadline shifts only)
```

### 3.4 Inbound email → checklist item state flow

```
Client emails W-2 PDF to emily-1040-X7fK@inbound.duedatehq.com
  ↓ Postmark webhook
  ↓ inbound-email.ts → parses, attaches PDF to Storage
  ↓ Mode A classifier (heuristic + LLM fallback)
  ↓ matches to ChecklistItem (label = "All W-2s") in client emily's task
  ↓
ChecklistItem.state: requested_waiting → received_unreviewed
  ↓ visible in FilingsTab (when wired) + per-task checklist
  ↓ Sarah confirms or flags
  ↓ ChecklistItem.state: received_unreviewed → received_confirmed (or received_issue)
```

---

## 4. Modes A–F + Patterns 1–4 — Vocabulary & Where We Sit

DueDateHQ has a load-bearing internal vocabulary that maps capabilities to user-facing surfaces. This feature touches several. Memorize the table.

### 4.1 Modes (AI capability + authority zone)

| Mode | What | Authority zone | Where in this feature | Where else |
|------|------|----------------|------------------------|------------|
| **Mode A** | Inbound email classification | Green (auto-act on high-confidence classify) | When a client emails a doc, Mode A routes it to the right ChecklistItem | `inbound-email.ts`, `AiInsightsPanel.tsx` |
| **Mode B** | Per-client arrival timing heuristics ("Acme always sends K-1 on Aug 6 ± 2 days") | Yellow (suggest, not act) | Drives "expected by" annotations on Suggested zone in FilingsTab (future) | `AiInsightsPanel.tsx` |
| **Mode C** | Cross-fact anomaly detection ("wages dropped 33% YoY") | Yellow (flag for review) | `received_issue` state on ChecklistItem; flagReason populated by Mode C | `mockChecklistItems.ts:FLAG_REASONS` |
| **Mode D** | Email draft generation | Yellow (CPA always CC'd, never auto-sent) | "Draft email" CTA on Today banner / AlertDetail / per-client chase loop | `EmailDraftModal.tsx` |
| **Mode E** | Cross-year pattern recognition / advisory awakening | Yellow (suggest planning conversation) | Drives `/opportunities` page; AlertDetail `pte_change` → "Schedule planning calls" CTA | `AdvisoryPeek.tsx`, `Insights.tsx` |
| **Mode F** | Federal Register form catalog polling + LLM extraction; state announcement scraping + matching | Yellow (admin reviews, never auto-applies due_date_rule) | **THE entire surface this doc covers** | `federal-register-poller.ts`, `scraper.ts`, `federal-form-extractor.ts` |

**The federal forms catalog feature IS Mode F.** State announcement pipeline IS Mode F. They are siblings.

### 4.2 Patterns (IA narratives that bind the modes to user jobs)

| Pattern | Job-to-be-done | This feature's role |
|---------|----------------|---------------------|
| **Pattern 1** | Day-1 deadline tracking — "what's due, when, for whom" | FilingsTab covers the deadline-applicability half; deadlines themselves render on Workspace + Timeline |
| **Pattern 2** | Chase loop — "which clients haven't sent the docs I need?" | FilingsTab's Suggested zone surfaces gap; ChecklistItem `requested_waiting` state ties into ChaseBanner |
| **Pattern 3** | State alerts affecting clients — "the wedge that gets the meeting" | AnnouncementDetail page — verdict-first IA, one-verb action surface, BatchNotifyModal |
| **Pattern 4** | Advisory awakening — Mode E insight surfaces a non-deadline opportunity | AlertDetail `pte_change` / `rate_change` CTAs → schedule planning call; Insights page |

### 4.3 Methods (Method A vs Method B — email ingress)

Different concept from Modes — overloaded letters. **Method = email channel**, not AI capability.

- **Method A**: per-task forwarding address (Postmark webhook). Default path. No OAuth required.
- **Method B**: full Gmail/Outlook OAuth poll (5-min cycle). Additive — gives the firm cross-task visibility.

The federal forms catalog itself doesn't ingest email, but the surrounding TaskDetail / FilingsTab consume documents that arrive via Method A or B.

### 4.4 Tiers (client tiers — pricing/capacity heuristics)

Tiers 0–3 are referenced in `client.tier` and drive capacity rationing — orthogonal to this feature, but the FilingsTab will eventually rank applicable forms higher for tier-0 (premium) clients. Not yet implemented.

---

## 5. Current State by Surface

### 5.1 Federal Forms Catalog (BE)

**Live:** ✅
- `federal_forms` table (34 curated rows in production)
- `federal_register_notices` table (audit trail of polled documents)
- `federal_form_change_events` (append-only change log)
- `federal_register_sources` (per-source poll freshness)
- Federal Register polling worker (1h cycle, IRS + Treasury sources)
- LLM extractor for long-tail (`extractFromLlm` procedure)
- Admin reviewer queue data layer (`recentChanges`, `markChangeReviewed`)
- 7 tRPC procedures: `list`, `getByFormNumber`, `applicabilityForClient`, `extractFromLlm`, `recentChanges`, `markChangeReviewed`, `pollNow`

**Broken / known issues:** 🚧
- **Entity-type matching is case-sensitive** (line 230 in `federalForms.ts` router). Seed uses `"Individual"`; if a client's stored `entityType` is `"individual"`, zero forms match. **Symptom**: empty Filings tab on Anne Dupont (NY individual) despite 34 rows in DB.

**Missing:** ⏳
- No `required_items` column. Per-form material checklists exist on FE only.
- LLM extractor doesn't fill `requiredItems` (no schema slot).
- No FE/BE catalog reconciliation job (drift compounds over time).

### 5.2 Federal Forms Catalog (FE)

**Live:** ✅
- 51 forms in `src/data/federalForms.ts`, each with: `code`, `name`, `description`, `kind`, `dueDate`, `dueDateBasis`, `extensionForm`, `applicableEntities`, `requiredItems`, `sources`, `confidence`
- 18 service bundles in `src/data/serviceBundles.ts` referencing forms by code (12 primary + 6 add-ons)
- `canonicalForm.ts` resolver bridges legacy decorated strings ("1040 (federal)") to bare codes ("1040") for catalog lookup
- `mockChecklistItems.ts` template generator pulls from FE catalog when form code matches; falls back to legacy templates
- 13 validation tests in `federalForms.test.ts` (no duplicate codes, every extensionForm references real form, etc.)

**Broken / known issues:** 🚧
- FE catalog and BE catalog can drift — no automated sync. (Not currently a problem because BE is consumed read-only by FilingsTab; AddDeadlineModal mixes both.)

**Missing:** ⏳
- Port FE `requiredItems` to BE seed once schema gains the column.
- Verify all 51 FE forms exist in BE seed (currently BE has 34).

### 5.3 FilingsTab (Client Detail · 📋 Filings)

**Live:** ✅
- Renders three zones (Suggested / Covered / Reference)
- Suggested zone has loud yellow border (gap surface per `feedback_gap_over_fill`)
- Each `FormRow` shows: form number, name, AI confidence chip (if LLM-extracted), "needs review" badge (if pending), "broad entity match" annotation (if confidence=medium)
- IRS link per row (when `form.irsUrl` set)
- "Add deadline" button per Suggested row → opens `AddDeadlineModal` pre-filled
- "Catalog admin →" link to Settings / Catalog admin page
- Loading state + error state with retry

**Broken / known issues:** 🚧
- Currently empty for `entityType="individual"` clients (case-sensitivity bug, see 5.1)

**Missing (the big gap):** ⏳
- **No per-form materials checklist displayed.** The FE catalog has rich `requiredItems` (W-2, 1099-INT, K-1, charitable receipts, etc.) but `FormRow` never reads them. Sarah sees "Form 1040 — U.S. Individual Income Tax Return" with no way to know "what 9 documents do I need to chase from this client?"
- No expand-to-see-checklist affordance.
- No per-checklist-item IRS PDF link.
- No state-of-each-item indicators (got W-2 yet? Yes/no/flagged) — that lives in `mockChecklistItems` but isn't wired into FilingsTab.

### 5.4 AddDeadlineModal

**Live:** ✅
- 3-tier picker: COMMON_FORMS (pinned) → All federal forms (BE catalog) → Other / custom (free-text + LLM)
- Loading state when BE catalog is fetching
- AI-extracted chip + "needs admin review" annotation when picking an LLM row
- Custom free-text mode triggers LLM extraction on save
- Prefill support via `?action=` URL params
- Two synthetic options: `__custom__` (free-text), `__llm__` (LLM extraction trigger)

**Broken / known issues:** 🚧
- COMMON_FORMS still hardcoded — could/should be derived from BE catalog with a "popular" flag.
- Two synthetic dropdown groups overlap (legacy `STATIC_FALLBACK_FORMS` + new BE rendering) — minor UI clutter.

**Missing:** ⏳
- After save, no preview of the per-form checklist that will be auto-generated.
- No way to pre-attach a service bundle ("Add 1040 + Schedule A + Schedule B" via a single "individual-standard" pick).

### 5.5 State Alert Detail (`/alerts/:id`)

**Live:** ✅
- Verdict-first IA (affected clients on top)
- Sticky action bar with typed primary verb per alertType
- BatchNotifyModal (adjust + notify combined for disaster_extension; notify-only for others)
- DismissWithReasonDialog (4 pre-canned reasons + free-text)
- Undo banner for deadline shifts (5min window)
- Deep-linking via `?action=adjust|notify|review`
- Per-row "+ Deadline" link (additive, distinct from batch adjust)
- Source link with authority label (state DOR, IRS, etc.)
- Related alerts section (clusters same-event rows from PR #45)
- Cluster confidence chip when alert is an aggregation of multiple notices

**Broken / known issues:** 🚧
- Per-row match-reason chip ("matched on state + entity") still TODO in some rendering paths.

**Missing:** ⏳
- For `form_change` alertType: no link from alert detail → `federal_forms` admin reviewer queue (where the actual catalog update happens).
- For `nexus_change`: no auto-suggestion to add new state filings to affected clients.
- For `pte_change` / `rate_change`: planning-call CTA exists but doesn't yet wire into a calendar.

### 5.6 Service Bundles

**Live:** ✅
- 18 bundles (12 primary + 6 add-ons)
- Each bundle references forms by `code` (Schedule E in 4 bundles, etc.)
- Bundle composition popover on Client Detail Workspace tab — shows the forms inside a bundle with IRS source links (PR #53)
- Engagement tab can assign a bundle to a client → auto-creates the deadline rows

**Missing:** ⏳
- No "create custom bundle" UI for a CPA who wants their own composition.
- No usage analytics ("which bundles are most assigned?") to tune the curated set.

### 5.7 Adjacent Surfaces — Where Federal Forms Touches the Rest of the App

| Surface | Route | Touches Federal Forms how? |
|---------|-------|----------------------------|
| **Today** | `/` | Aggregates state alerts (federal-register and state-DOR) into Today banner + reactive action queue |
| **Timeline** | `/timeline` | Renders deadlines created via FilingsTab / AddDeadlineModal as bands across clients |
| **Clients** | `/clients` | List page; Workspace tab on detail surfaces federal forms via FilingsTab |
| **Mail** | `/mail` | Method B inbound docs flow into ChecklistItems (the gap closes here when client sends W-2) |
| **Alerts** | `/alerts` + `/alerts/:id` | Federal Register-sourced alerts (when `alertType=form_change`) land here |
| **Opportunities** | `/opportunities` | Mode E surface — `pte_change` / `rate_change` alerts hand off planning conversations here |
| **Settings → Federal Forms** | `/settings/federal-forms` | Catalog admin page (placeholder — UI TODO; data layer ready via `recentChanges`) |
| **TaskDetail** | `/tasks/:id` | Per-task ChecklistItems consume the same `requiredItems` shape from FE catalog |
| **Engagement tab** | Client Detail | Bundle assignment auto-creates deadline rows referencing federal forms by code |

---

## 6. UX Flows

### 6.1 FilingsTab — current vs intended

**Current** (what ships today):
1. CPA opens client → clicks 📋 Filings tab
2. Sees header: "Federal filings · Catalog-driven applicability for [Client]. Entity: individual"
3. **If entity-type matches catalog seed casing**: sees Suggested zone (loud yellow), Covered zone (quiet), Reference zone (collapsed)
4. **If casing mismatches** (current bug for `individual`): sees three empty sections + the catalog-source footer line

**Intended** (after closing the gap):
1. CPA opens client → 📋 Filings tab
2. Sees Suggested zone with N applicable forms not yet on the calendar
3. **Per form, can expand to see required materials** (e.g., 1040 → 9 items: W-2, 1099-INT, 1099-DIV, etc.) with state per item (got it / chasing / flagged / N/A)
4. "Add deadline + checklist" button per row → creates deadline AND pre-populates checklist from FE catalog `requiredItems`
5. IRS PDF link per item (one click to the W-2 PDF on irs.gov)

### 6.2 AddDeadlineModal — picking a form

1. Click "+ Deadline" on Client Detail header
2. Modal opens with COMMON_FORMS pinned at top (1040, Q estimates, etc.)
3. CPA can:
   - Pick a common form → save → done in 2 clicks
   - Browse "All federal forms" optgroup → 30+ catalog rows with form name and category
   - Pick "Other / custom…" → type the form number → AI extracts on save
4. AI-extracted chip + confidence % shown when picking an LLM row
5. Date picker, jurisdiction picker, save
6. After save, deadline appears on Workspace tab + Filings tab "Covered" zone

### 6.3 State Alert — Sarah's morning routine (one alert)

The intended flow per persona research (Sarah Mitchell, sole-prop CPA, 49 clients):

1. **Sarah opens AirPods at 7:42am, hears: "3 new alerts — one disaster extension affecting 4 clients in FL"**
2. **Opens phone**, taps Today banner → lands on `/alerts/:id` for the FL alert
3. **VERDICT visible above the fold**: "4 affected clients" with 4 names + checkboxes (pre-checked)
4. **One typed verb** in sticky bar: "Move 4 deadlines to May 14"
5. **Tap → BatchNotifyModal** opens with toggles: "Send notification email?" (on by default)
6. **Tap "Adjust + notify"** → flash banner: "4 deadlines moved · 4 emails queued · Undo"
7. **Sarah closes phone, drinks coffee** — 90 seconds, one alert handled
8. Repeat for next 2 alerts (penalty_relief and pte_change), each with its own typed verb

Total morning time on alerts: ~5 minutes for 3 alerts (vs. previous 15+ min when she had to inspect each alert's "parsed impact" section + scroll to find affected clients + work out which button to use).

### 6.4 Federal Register change → catalog update (admin loop)

1. **2am UTC**: Federal Register poller cycle runs (1h interval)
2. New IRS notice published — title contains "Form 941 quarterly deadline updated for disaster areas"
3. Poller writes row to `federal_register_notices`
4. Regex extracts `["941"]`, optional LLM lift if low confidence
5. For each form in `referenced_form_numbers` matching `federal_forms.form_number`: write row to `federal_form_change_events`
6. **Admin opens `/settings/federal-forms` reviewer queue** (UI: TODO P2)
7. Sees pending change_event: "Form 941 — Apr 30 due date moved to May 14 in disaster areas"
8. Reviews the linked notice (federalregister.gov URL)
9. **If valid**: clicks "Apply" → marks `applied_at` → background job (or manual SQL) updates `federal_forms.due_date_rule`
10. Next poll cycle, all clients with 941 deadline see the new date in FilingsTab

### 6.5 LLM extractor — long-tail form

1. CPA types "5471" in AddDeadlineModal (foreign corporation reporting)
2. Modal not in BE catalog → shows "Other / custom" mode
3. CPA types "5471" in custom field → save
4. FE calls `trpc.federalForms.extractFromLlm({ formNumber: "5471" })`
5. BE: SELECT WHERE form_number='5471' → not found
6. BE calls Claude Haiku with structured output prompt
7. LLM returns: name = "Information Return of U.S. Persons With Respect to Certain Foreign Corporations", category = "international", entityTypes = ["Individual", "C-Corp", "Partnership"], confidence = 0.85
8. BE inserts row with status='active' (≥0.7 threshold)
9. BE returns DTO with `created: true, llmCalled: true, confidence: 0.85, needsReview: false`
10. Modal shows "AI · 85%" chip + saves the deadline

---

## 7. Sarah Mitchell — Two-Week User Journey

A composite journey of how the federal-forms + alerts surfaces support Sarah's actual job over a 2-week window.

| Day | Trigger | Surface used | Outcome |
|-----|---------|--------------|---------|
| Mon AM | 3 new alerts pile up overnight | Today banner → `/alerts/:id` (×3) | 5 min to triage all 3 (one verb each); 4 deadlines moved, 12 emails queued |
| Mon PM | New 1099 client signs engagement | AddClient → Workspace → Engagement tab | Picks `individual-standard` bundle → 4 deadlines auto-created |
| Tue AM | Reviews "Suggested" gap on a client | 📋 Filings tab on Client Detail | Notices Schedule E missing for a rental-property client; clicks "Add deadline" → done |
| Wed AM | IRS publishes Form 941 due-date change | Federal Register poller (background) → Admin reviewer queue | Sarah (admin) reviews queued change_event, marks `applied_at` → all clients with 941 deadline auto-update |
| Thu | CPA types "5471" into AddDeadlineModal for a foreign-corp client | AddDeadlineModal → LLM extractor | New form row created confidence 0.85, status='active', deadline saved |
| Fri | FL DOR posts disaster extension | Scraper → Today banner → AlertDetail | 6 affected clients, "Move 6 deadlines" → done in 2 clicks |
| Mon (wk 2) | Sarah weekly review | `/alerts` page (full triage) | Reviews dismissed alerts last week; reviews catalog admin queue |
| Wed (wk 2) | Client emails W-2 to firm inbox | Method B poller → Mailbox → auto-classified to `wage_w2` checklist item | Item flips `requested_waiting` → `received_unreviewed` on FilingsTab; Sarah confirms |
| Fri (wk 2) | Quarterly retro | `/admin/federal-forms` reviewer queue + `/alerts` page | Sarah notes alert types generating most action vs dismissals → product feedback loop |

**Gating constraint**: Sarah's mental capacity is ~12-15 active client conversations at any one time. The product's job is to compress her attention so she can stay productive at 49 clients. Every UX decision should ask: "does this give Sarah back 10 seconds, or cost her 10 seconds?"

---

## 8. Bugs Found in 2026-05-02 Debug Session

A frank record of what broke and why. Useful for next-time deploy hygiene.

| # | Bug | Severity | Status | Resolution |
|---|-----|----------|--------|------------|
| B1 | Drizzle `_journal.json` missed migrations 0005 + 0006 | 🔴 Critical | ✅ Fixed | PR #58 added journal entries; migrate.js applies them on next deploy |
| B2 | `fly.toml` had `app = "duedatehq-backend"` (stale leftover app); production lives on `duedatehq` | 🔴 Critical | ✅ Fixed | PR #59 corrected to `app = "duedatehq"`; bumped region to lhr (close to Supabase eu-west-1) |
| B3 | Supabase password rotation invalidated Fly secret without explicit re-set | 🟡 Process gap | ⏳ Document | Add to RUNBOOK: Supabase password reset MUST be followed by `fly secrets set DATABASE_URL='...'` with single-quoted URL |
| B4 | Entity-type matching case-sensitive (`"individual"` ≠ `"Individual"`) | 🔴 Critical | 🚧 Open | Empty FilingsTab for any client with lowercase entity_type. Fix: case-insensitive comparison in router |
| B5 | BE `federal_forms` table has no `required_items` column | 🟡 Feature gap | 🚧 Open | Per-form material checklist lives on FE only; FilingsTab can't display materials. Fix: migration 0007 + port FE data |
| B6 | App-machine health-check timeouts on Fly during rolling deploy | 🟢 Cosmetic | 🚧 Open | Deploys "fail" at the rolling-update step but release_command (migration) succeeds. Likely the health endpoint takes >5s on cold start. Fix: bump grace_period or pre-warm |
| B7 | Two Fly apps exist (`duedatehq` + `duedatehq-backend`) — confusing leftover | 🟢 Cleanup | ⏳ Open | After confirming no traffic on `duedatehq-backend`, run `fly apps destroy duedatehq-backend` |
| B8 | `fly secrets set DATABASE_URL=...` without single quotes mangles passwords with shell-special chars | 🟡 Footgun | ⏳ Document | Add to RUNBOOK: ALWAYS single-quote the value; reset to alphanumeric password if Supabase auto-generated one with `&`, `$`, `#`, etc. |

---

## 9. Auth & Multi-Tenancy

The federal forms catalog is **system-wide** (no `firm_id` column) — every firm sees the same `federal_forms` rows. But the *consumers* of the catalog (FilingsTab, AddDeadlineModal) operate within a firm context.

**Auth pattern** (`backend/src/trpc/init.ts`):
- `publicProcedure` — no auth. Used for `/health`, OAuth callbacks, webhook receivers.
- `firmProcedure` — requires Supabase JWT, looks up `users` row, attaches `{ userId, firmId }` to ctx. Throws `PRECONDITION_FAILED` if user has no firm row (pre-onboarding).

All `federalForms` router procedures (except `pollNow` admin trigger) use `firmProcedure`. We don't need firm scoping on the catalog itself, but we want a logged-in session for rate-limiting + audit.

**Tenant isolation**: Application-layer, not RLS. Every query that returns firm-owned data filters `eq(table.firmId, ctx.firmId)`. We chose this over Postgres RLS because:
- Easier to debug (no "why is this row missing?" mysteries)
- Cross-firm reads (admin, analytics) don't require role gymnastics
- Drizzle ORM's type system already enforces it at compile time once the pattern is in place

**Trade-off accepted**: a router bug that forgets to filter by firmId leaks data across tenants. Mitigated by code review + integration tests that assert firm isolation on every router.

**Not yet implemented**: row-level admin role for catalog editing. Currently anyone signed in can call `markChangeReviewed`. Should gate on a `users.role IN ('owner','admin')` check before shipping the reviewer UI.

---

## 10. Email Pipeline (Inbound + Outbound)

The federal forms catalog doesn't directly ingest email, but **closing the gap on FilingsTab requires understanding how documents flow in** — that's how `requested_waiting` checklist items become `received_unreviewed`.

### 10.1 Inbound — Method A (per-task webhook)

- **Provider**: Postmark webhook → POST `/inbound/postmark/:secret`
- **Address pattern**: `<task-slug>-<token>@inbound.duedatehq.space`
  Example: `emily-1040-X7fK@inbound.duedatehq.space` routes to client emily's 1040 task
- **Parses**: From, To, Subject, TextBody, HtmlBody, Attachments (each with name, contentType, base64 content)
- **Storage**: Attachments → Supabase Storage (links retained in `checklist_items.received_filename`)
- **Classification**: Mode A heuristic + LLM fallback (CLAUDE_API_KEY required for LLM)
- **Writes**: `inbound_replies`, `activity_events` (`document_received`, `email_received`), updates `checklist_items.state`
- **Idempotency**: Postmark message ID dedupe

### 10.2 Inbound — Method B (OAuth poll)

- **Mailboxes**: Gmail, Outlook (full Mail.Read scope)
- **Cadence**: 5-minute interval per connected integration (in-process worker; will be cron in Phase 2)
- **Flow**: `messages.list` since `historyId` → for each new message, match sender → walk open tasks → run Mode A classify on attachments → log `client_replied` activity events
- **Idempotency**: `provider_message_id` in metadata
- **Why both methods**: Method A is the default zero-config path. Method B is the additive value-add for firms that want to capture replies sent to their main inbox (not the per-task forwarding address). Same classifier, two ingress points (per D20).

### 10.3 Outbound — Resend

- **Provider**: Resend (via `resend` npm SDK)
- **Flow**: `actions.composeEmail()` writes draft → `emails.send()` calls Resend → returns provider message_id → `delivery_events` row + Resend webhook tag (`email_draft_id`) → bounce/complaint routed to `/api/delivery/resend/:secret`
- **Path E posture**: We never persist email body bytes. `delivery_events` only stores metadata (status, timestamp, provider_message_id). Auditable, GDPR-friendly, infinitely cheap.
- **Fallback**: When `RESEND_API_KEY` missing in dev, `emails.send()` logs + skips (no-op, marks draft as `sent` so UI advances)

### 10.4 Delivery webhooks

- **Providers**: Resend (current), Postmark (state alert source), SES via SNS (legacy)
- **Events**: delivered, opened, bounced, complained, unsubscribed
- **Surface**: bounce → TodoItem on Today queue ("Re-reach Acme — bounce on emily@acme.com")

---

## 11. State Announcements Pipeline (Parallel to Federal Forms)

The state-DOR pipeline is the older sibling of federal-register. The two share architecture by design (D23) so we can reuse status reporting, classifier, and matcher patterns.

### 11.1 Scraper

- **Cadence**: 1-hour interval (Phase 1: in-process setInterval; Phase 2: external cron / Cloudflare Worker)
- **Sources**: state DOR RSS / newsroom URLs (registry in `state_announcement_sources` table)
- **Parsing**: Phase 1 regex (`disaster_extension`, `penalty_relief`, `deadline_change`); Phase 2 LLM (Gemini Flash default, Claude Haiku fallback)
- **Writes**: `announcements` (canonical row per state+title), `announcement_matches` (per firm's clients), `parse_confidence` (high/medium/low for human review)

### 11.2 Sources registry

- `state_announcement_sources` table tracks per-state authority URLs + last_fetched_at
- Initially seeded by `index.ts` startup script; updated with freshness timestamps each cycle
- Same `*_source_status` enum (healthy / stale_short / stale_long / broken) as `federal_register_sources`

### 11.3 Symmetry with Federal Register

| Aspect | State Announcements | Federal Register |
|--------|---------------------|-------------------|
| Polling cadence | 1h | 1h |
| Source registry table | `state_announcement_sources` | `federal_register_sources` |
| Notice / announcement table | `announcements` | `federal_register_notices` |
| Per-firm matcher table | `announcement_matches` | `federal_form_change_events` (linked to forms) |
| Classifier | regex + LLM | regex + LLM |
| Confidence buckets | high/medium/low | high/medium/low |
| Reviewer surface | `/alerts` page (CPAs) | `/settings/federal-forms` (admins, TODO) |
| Auto-mutate? | No (CPA reviews each alert) | No (admin reviews each change_event) |

**Why not unify into one table?** The matchers differ semantically: state alerts match per-client (does this alert affect THIS client?), federal-register matches per-form (does this notice change THIS form?). Forcing one schema would lose the asymmetry.

---

## 12. Testing & Evals

### 12.1 Unit/integration tests

| Area | File | Coverage |
|------|------|----------|
| FE catalog validation | `src/data/federalForms.test.ts` | 13 tests: no duplicate codes, every extensionForm references real form, every requiredItem has label + itemType, sources URLs are well-formed |
| BE | (none) | **No backend unit tests in repo as of 2026-05-02** — gap |
| FE components | (none) | **No FE component tests** — gap |

### 12.2 Eval harness — Mode A inbound classifier

- **Files**: `backend/eval/inbound-classifier-v1.jsonl` (golden dataset), `backend/eval/run.ts` (runner)
- **Targets per PRD §4.7**:
  - 7-class top-level classifier ≥ 92% precision
  - 5-class sub-intent classifier ≥ 90% precision
  - timeline_pushback false-positive rate ≤ 3%
- **CI gating**: exit code 0 if targets met (PR can merge), 1 if missed (PR blocked)
- **Fallback**: If `ANTHROPIC_API_KEY` missing, runs heuristic-only classifier (lower targets, still asserted)

### 12.3 Test gaps to close

1. **BE router tests**: `applicabilityForClient` (case sensitivity), `extractFromLlm` (idempotency under race), `recentChanges` (firm isolation)
2. **Migration tests**: assert every `.sql` file has a journal entry (would have caught B1)
3. **Fly app config validation**: assert `app` in fly.toml matches expected production app name (would have caught B2)
4. **FilingsTab Storybook + visual regression**: at minimum, snapshot the 3 zones rendered with different entity types
5. **Eval harness for Mode F LLM extractor**: golden dataset of 30 forms + assertion that LLM extracts them with ≥0.85 confidence
6. **End-to-end (Playwright?)**: AddDeadlineModal → save → deadline appears on Workspace + Filings tab

---

## 13. External Services & Dependencies

### 13.1 Production services

| Service | Use | Env var | Failure mode |
|---------|-----|---------|--------------|
| Supabase Postgres (eu-west-1) | Primary DB | `DATABASE_URL` | Auth fail → release_command aborts (proven in this debug session) |
| Resend | Outbound email | `RESEND_API_KEY` | No-op locally if missing; production failure surfaces as draft stuck in `pending` |
| Anthropic Claude (Haiku) | LLM extractor + Mode A LLM fallback + state announcement parsing | `ANTHROPIC_API_KEY` | Falls back to regex/heuristic; no hard fail |
| Postmark | Inbound email webhook | `INBOUND_WEBHOOK_SECRET` | Inbound emails silently drop |
| SES (legacy) | Inbound (parallel adapter) | (configurable) | Same as Postmark |
| Federal Register API | Catalog change detection | (no key — public) | Poller logs error, source marked `broken` |
| Gmail OAuth | Method B inbound | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | Per-firm; affects only firms that opted in |
| Fly.io | Hosting (lhr) | n/a | Deploy failures (Bug B6) |
| Vercel | FE hosting | n/a | Build failures (e.g., PR #57 type errors) |
| Upstash Redis | (TBD — UPSTASH_REDIS_REST_TOKEN secret exists) | `REDIS_URL`, `UPSTASH_REDIS_REST_TOKEN` | Likely Method B job queue / rate limiting |
| Sentry | Error reporting | `SENTRY_DSN` | Errors swallowed if down |
| Axiom | Logs | `AXIOM_DATASET`, `AXIOM_TOKEN` | Logs lost if down |

### 13.2 Domain configuration

- **Production TLD**: `duedatehq.space` (per `project_domain` memory)
- Backend: `duedatehq.fly.dev` (Fly default URL)
- Frontend: Vercel-hosted, public URL TBD (custom domain on `duedatehq.space`)
- Inbound email: `<task-slug>-<token>@inbound.duedatehq.space` (MX → Postmark)

---

## 14. Recent PR Provenance

What landed and when. Useful for understanding the evolution.

| PR | Title | What it did |
|----|-------|-------------|
| #59 | fix(backend): point fly.toml at the real "duedatehq" app | Today — corrects fly.toml app name + region |
| #58 | fix(backend): add migrations 0005 + 0006 to drizzle journal | Today — registers the missing migration entries |
| #57 | fix(catalog): canonicalForm.ts type errors blocking Vercel build | Hotfix — `?? null` on federalFormByCode call sites |
| #56 | feat(forms): federal_forms catalog + Federal Register change-detection | THE BE worker landing — schema, poller, LLM extractor, router (parallel session's work) |
| #55 | feat(forms): wire FE consumers + spec phase-3 BE worker | FE consumer migration (FilingsTab, AddDeadlineModal); spec for BE worker |
| #54 | feat(catalog): top 50 federal forms with sourced checklists + normalized bundles | FE catalog — 51 forms, 18 bundles, validation tests |
| #53 | feat(client): bundle composition popover on the package chip | Bundle popover with IRS source links |
| #52 | fix(today): state-alert banner shows alerts; queue carries derived actions | Today page state-alert wiring fix |
| #49 | feat(alerts): one-verb action surface, deadline cascade, undo | The verdict-first IA refactor (this is THE big alert UX PR) |
| #48 | feat(alerts): inline action on Today banner — adjust / draft email | Today banner gets the inline verb |
| #47 | fix: byAnn rename + min_machines_running=1 | Cleanup |
| #46 | fix(announcements): rename stale byAnn ref left over from PR#45 merge | Cleanup |
| #45 | fix(alerts): cluster same-event rows, persist dismiss, audit BE sources | Alert clustering + dismiss persistence (added migration 0005) |
| #44 | feat(today): one row per client, state-alert pinned, "Just happened" strip | Today page redesign |
| #43 | fix(alerts): clicking a state alert no longer crashes the detail page | Bug fix |
| #42 | feat(ui): adopt shadcn primitives, keep existing tokens (cssVariables:false) | Design system foundation |
| #41 | feat(clients): real CSV export — bulk + per-client, BE-backed | Export feature |
| #40 | feat(sidebar): add "Invite teammate" card above Settings | Sidebar nav |
| #39 | feat(email): From shows firm brand, not "DueDateHQ" | Email From-line UX |
| #38 | feat(email): wire Resend outbound + Mail "Reminders out" to BE | Outbound email pipeline landed |

---

## 15. Gaps & What's Left (Prioritized)

### P0 — ship next (unblock visible product)

1. **Case-insensitive entity-type matching** in `backend/src/trpc/routers/federalForms.ts`. Single-line fix in 2 places (`list` and `applicabilityForClient`). Add a helper `entityIncludesCaseInsensitive(arr, target)` and use everywhere. **Without this, FilingsTab is empty for most existing clients.**

2. **Add `required_items` jsonb column** to `federal_forms` table (migration 0007). Update Drizzle schema. Update `seed-federal-forms.ts` to write it. Update `federalForms` router DTO to surface it.

3. **Display required materials per form in FilingsTab.** Expandable row → list of items (W-2, 1099-INT, K-1, etc.) → each item has IRS PDF link + "request" / "got it" state. Wire to `mockChecklistItems` so the state UI works in seed data.

### P1 — ship within 2 weeks

4. **Port all 51 FE forms to BE seed.** Currently BE has 34, FE has 51. Reconcile.

5. **LLM extractor enhancements**: prompt model to extract `requiredItems[]` array too (with confidence per item).

6. **Health-check timeout**: investigate why `/health` takes >5s on cold start — likely DB connection warmup. Move health check to a non-DB endpoint OR pre-warm DB on boot.

7. **Add "Open IRS PDF" link per checklist item** — data already in FE catalog (`source: IRS_PDF("f1099int")`).

8. **Clean up `duedatehq-backend` Fly app**. Verify no traffic, then destroy.

9. **Reviewer admin UI** at `/settings/federal-forms` — render `recentChanges` data layer, allow admin to mark events reviewed/applied.

10. **Backend test suite**: add at minimum `applicabilityForClient` unit test + migration journal coverage test.

### P2 — backlog

11. **Bundle composition in AddDeadlineModal**: pick "individual-standard" bundle → creates 4 deadlines + 4 checklists in one save.

12. **Per-form usage telemetry**: track which BE catalog rows are picked / which bundles are assigned. Feed back into curation priorities.

13. **State alert → catalog reviewer queue link**: when alertType=`form_change`, link from AlertDetail to the corresponding `federal_form_change_event`.

14. **Nexus alert → AddDeadlineModal pre-population**: when alertType=`nexus_change`, suggest adding state filings for the new state to all affected clients.

15. **Custom service bundles** (CPA-defined). Schema + UI.

16. **Federal Register poller — extend sources**: add Treasury Inspector General, OFAC, etc. (currently IRS + Treasury rules only).

17. **Mode B scaling**: move 5-min poll out of process to dedicated worker; add per-firm rate limiting via Upstash Redis.

18. **Eval harness for Mode F LLM extractor**: golden dataset + ≥0.85 confidence assertion for top 50 forms.

---

## 16. Production Hygiene & Deploy Pitfalls

A short list of "things I learned the hard way 2026-05-02" so future-Yuqi (and future Claude) don't repeat them. Add to `backend/RUNBOOK.md`.

1. **Always check `fly apps list` first** when deploys behave inexplicably. fly.toml's `app = "X"` and the `-a Y` flag are the only places the target app is decided. Check both.

2. **Drizzle migrations are NOT auto-applied from `.sql` files alone.** They must be in `migrations/meta/_journal.json`. If you add a `.sql` file by hand, also append a journal entry. Convention: run `drizzle-kit generate` when possible (it does both); when adding by hand, both file + journal entry get committed in the same PR.

3. **Supabase password resets invalidate the password instantly.** Any deploy in flight against the old password fails. After every reset: (a) update Fly secret with single-quoted URL, (b) confirm with `fly secrets list` digest changed, (c) re-deploy. Keep passwords alphanumeric — special chars (`@`, `&`, `$`, `#`) need URL-encoding and are a footgun.

4. **`fly secrets set` requires single quotes around the URL** when the value contains shell metacharacters. Use `fly secrets set DATABASE_URL='postgresql://...'` not `=postgresql://...`.

5. **Use port 6543 (Transaction pooler), not 5432**, for Supabase connections in migrate.js. Code is configured with `prepare: false` + `max: 1` for compatibility.

6. **release_command runs on the NEW image** (the one being deployed), not the existing app machines. If the new image's release_command fails, the existing machines stay on the OLD image. Check `fly status` after to confirm what version is actually serving.

7. **`fly machine start <id>` uses the LATEST secrets**, even if the machine was last running with older secrets. Quick way to test "does the current secret work?" without a full deploy.

8. **`backend/src/db/probe.ts`** is the diagnostic tool of choice — prints URL parts (no password), password char classes, and the actual connection result. Run via `node /app/dist/db/probe.js` inside SSH or as `release_command` to debug auth issues without leaking the password.

9. **Auto-stop machines = "stop" + min_machines_running = 0** means the app cold-starts on first request. If the cold start takes >5s and `/health` hits the DB, health checks fail. Either bump `grace_period` in the http_service.checks block or refactor `/health` to skip DB.

10. **Two Fly apps with similar names is a smell.** `fly apps list` should show one app per environment per service. Anything else is a deploy-target bug waiting to happen. Audit and destroy unused apps.

---

## 17. What This Is NOT (Forever-No List)

Per the `forever_no` memory — what we explicitly never build, scoped to this feature area:

| Not building | Why not |
|--------------|---------|
| **Client portal** for federal forms (clients don't see the catalog) | The product is the CPA's intelligence layer. Clients use email; that's the integration. |
| **Document vault** (we don't store the PDFs long-term) | Path E posture — track state, not bytes. PDFs live in Gmail/Postmark; we keep links + metadata. |
| **Tax preparation engine** (we don't fill out the 1040) | We're the chase loop and intelligence layer, not the form-filler. Drake / CCH / Lacerte / TaxDome do this; we don't compete. |
| **CCH Axcess integration** | Legacy enterprise stack, not where the modern sole-prop / 5-CPA firms live. We integrate with QBO, Gmail, Outlook — modern small-shop tooling. |
| **Federal forms catalog editing UI for end users** (CPAs can't edit catalog rows) | The catalog is curated + LLM-extended. CPAs requesting changes go through admin reviewer queue. Otherwise we get 1000 conflicting edits and no source of truth. |
| **Auto-application of Federal Register changes** | One wrong rule = wrong deadlines on every client using that form. Admin gating beats auto-apply (D5). |
| **"AI is learning from your firm" copy** | Cringe + breaks trust. Every AI surface tells you exactly what it did and why. |
| **Per-firm forks of the federal_forms catalog** | Catalog is system-wide. Firms with idiosyncratic needs use custom service bundles or free-text deadline forms — not catalog forks. |

---

## 18. Open Questions for Yuqi

Things needing a product call before the next PR ships:

1. **For the `required_items` port to BE**: should we merge the FE catalog (51 forms) AS-IS to the BE seed, or should we re-curate first (e.g., add `requiredItems` to forms that don't have them yet)? **Default recommendation: port FE → BE as-is, fix gaps in follow-up.**

2. **Case-insensitive entity match**: lowercase normalization at write-time (migration to lowercase all `clients.entity_type` and seed values) OR at compare-time (helper function in router)? **Default recommendation: compare-time helper, leaves stored values intact for display.**

3. **For the state alert "form_change" type**: should the AlertDetail page link directly to the affected `federal_form` admin row, or to the reviewer queue (`recentChanges`)? **Default recommendation: reviewer queue (one place to act, vs. fragmented per-form pages).**

4. **`duedatehq-backend` cleanup**: confirm we never deployed anything important there before destroying. Your call — I can grep history if helpful.

5. **Health-check timeout**: bump grace_period to 30s as a quick fix, or invest in a DB-free `/health` endpoint that returns 200 immediately (with `/health/deep` for the DB-touching variant)? **Default recommendation: bump grace_period now, refactor /health later.**

6. **Catalog admin role gating**: should `markChangeReviewed` require `users.role IN ('owner','admin')`? Currently any firm member can mark. **Default recommendation: gate it now, before shipping the reviewer UI.**

7. **Reviewer UI placement**: `/settings/federal-forms` (firm-level) or `/admin/...` (cross-firm super-admin)? **Default recommendation: firm-level for now; cross-firm only if we hire a dedicated catalog curator.**

---

## 19. ClientDetail Workspace Tabs — Reference

The 9 tabs on Client Detail (in display order):

| ID | Label | Primary use | Connection to federal forms |
|----|-------|-------------|------------------------------|
| `engagement` | 🤝 Engagement | Service package + bundle assignment | Bundle assignment auto-creates deadlines that reference federal_forms by code |
| `filings` | 📋 Filings | **Catalog-driven applicability for THIS client** | THE primary surface — uses `applicabilityForClient` + `list` (Reference zone) |
| `habits` | 🧠 Habits | Mode B per-client arrival timing | Future: feed expected-by annotations into FilingsTab Suggested zone |
| `predictions` | 🔮 Predictions | Mode E + Pattern 4 advisory awakening | Surfaces planning opportunities tied to PTE / rate changes |
| `todo` | ✅ To Do | TodoItem queue scoped to this client | Receives "chase X for missing W-2" actions derived from FilingsTab gaps |
| `mailbox` | ✉️ Mailbox | Inbound emails from this client | Method A + B emails land here, get classified to ChecklistItems |
| `documents` | (overflow) | Doc list (legacy) | Will be subsumed by Filings tab once requiredItems wires in |
| `contacts` | (overflow) | Multiple contacts per client | Independent of forms |
| `audit` | (overflow) | Activity log — every mutation | Includes `deadline_added` / `bundle_assigned` / `checklist_state_change` events |

`engagement` is default. `filings | habits | predictions | todo | mailbox` are the v0.7 primary set. `documents | contacts | audit` are demoted to overflow menu.

---

## Appendix A — File Map

| Concept | File |
|---------|------|
| BE federal_forms schema | `backend/migrations/0006_federal_forms.sql`, `backend/src/db/schema.ts` |
| BE curated seed | `backend/src/db/federal-forms-data.ts`, `backend/src/db/seed-federal-forms.ts` |
| BE LLM extractor | `backend/src/lib/federal-form-extractor.ts` |
| BE Federal Register poller | `backend/src/lib/federal-register-poller.ts` |
| BE State scraper | `backend/src/lib/scraper.ts` |
| BE tRPC router | `backend/src/trpc/routers/federalForms.ts` |
| BE auth | `backend/src/trpc/init.ts` |
| BE inbound email | `backend/src/lib/inbound-email.ts` |
| BE Method B poller | `backend/src/lib/method-b-poller.ts` |
| BE outbound email | `backend/src/lib/email-sender.ts`, `backend/src/trpc/routers/emails.ts` |
| BE delivery webhooks | `backend/src/lib/delivery-webhooks.ts` |
| BE eval harness | `backend/eval/run.ts`, `backend/eval/inbound-classifier-v1.jsonl` |
| BE migration runner | `backend/src/db/migrate.ts` |
| BE diagnostic probe | `backend/src/db/probe.ts` |
| FE catalog | `src/data/federalForms.ts` |
| FE service bundles | `src/data/serviceBundles.ts` |
| FE canonical resolver | `src/data/canonicalForm.ts` |
| FE catalog tests | `src/data/federalForms.test.ts` |
| FE FilingsTab | `src/components/FilingsTab.tsx` |
| FE AddDeadlineModal | `src/components/AddDeadlineModal.tsx` |
| FE AlertDetail page | `src/pages/AnnouncementDetail.tsx` |
| FE BatchNotifyModal | `src/components/BatchNotifyModal.tsx` |
| FE DismissDialog | `src/components/DismissWithReasonDialog.tsx` |
| FE ClientDetail page | `src/pages/ClientDetail.tsx` |
| Mock checklist items | `src/data/mockChecklistItems.ts` |
| Phase-3 BE worker spec | `docs/specs/phase-3-be-federal-forms-worker.md` |
| Phase-3 verification checklist | `docs/specs/phase-3-verification-checklist.md` |
| Fly config | `backend/fly.toml` |
| Drizzle config | `backend/drizzle.config.ts` |
| Migration journal | `backend/migrations/meta/_journal.json` |
| Backend Dockerfile | `backend/Dockerfile` |

## Appendix B — Schema reference (federal_forms)

```sql
CREATE TABLE federal_forms (
  id uuid PRIMARY KEY,
  form_number text UNIQUE NOT NULL,    -- "1040", "1120-S", "941"
  form_name text NOT NULL,
  category text NOT NULL,              -- income | payroll | info_return | ...
  entity_types text[] NOT NULL,        -- {"Individual"}, {"S-Corp", "Partnership"}
  frequency text NOT NULL,             -- annual | quarterly | monthly | per_event
  due_date_rule jsonb,                 -- nullable; encodes per-filer dates
  notes text,                          -- 2 sentences max, FilingsTab tooltip
  irs_url text,
  extraction_method enum NOT NULL,     -- curated | llm | federal_register
  confidence_score numeric(3,2),       -- 0..1; 1.0 for curated
  status enum NOT NULL,                -- active | pending_review | deprecated
  last_verified_at timestamptz,
  last_change_check_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
-- TODO P0: ADD COLUMN required_items jsonb NOT NULL DEFAULT '[]'

-- Indices
CREATE INDEX federal_forms_entity_types_gin ON federal_forms USING gin (entity_types);
CREATE INDEX federal_forms_category_idx ON federal_forms (category);
CREATE INDEX federal_forms_status_idx ON federal_forms (status);
```

Sibling tables (created in same migration 0006):
- `federal_register_notices` — raw Federal Register documents (audit trail)
- `federal_form_change_events` — append-only log linking notices → forms
- `federal_register_sources` — per-source poll freshness

## Appendix C — TypeScript DTO reference

```typescript
// backend/src/trpc/routers/federalForms.ts
interface FederalFormDTO {
  id: string;
  formNumber: string;
  formName: string;
  category: string;
  entityTypes: string[];
  frequency: string;
  dueDateRule: unknown;
  notes: string | null;
  irsUrl: string | null;
  extractionMethod: "curated" | "llm" | "federal_register";
  confidenceScore: number;
  status: "active" | "pending_review" | "deprecated";
  lastVerifiedAt: string | null;
  lastChangeCheckAt: string | null;
}

// applicabilityForClient response shape
interface ApplicabilityResponse {
  clientId: string;
  entityType: string;
  primaryState: StateCode;
  forms: Array<{
    form: FederalFormDTO;
    confidence: "high" | "medium";
    reason: string;
  }>;
}

// FE catalog shape (src/data/federalForms.ts)
interface FederalForm {
  code: string;
  name: string;
  description: string;
  kind: FormKind;
  dueDate: string | null;
  dueDateBasis: DueDateBasis;
  extensionForm: string | null;
  applicableEntities: FormEntityScope[];
  requiredItems: FormChecklistItem[];  // ← The piece BE doesn't have yet
  sources: string[];
  confidence: "verified" | "common-practice" | "ai-suggested";
}

interface FormChecklistItem {
  label: string;
  itemType: string;
  source?: string;  // IRS PDF URL
}
```

## Appendix D — Sidebar destinations (7 + Settings)

| # | Route | Label | Icon |
|---|-------|-------|------|
| 1 | `/` | Today | Home |
| 2 | `/timeline` | Timeline | GanttChartSquare |
| 3 | `/clients` | Clients | Users |
| 4 | `/mail` | Mail | Mail |
| 5 | `/alerts` | Alerts | Bell |
| 6 | `/opportunities` | Opportunities | Lightbulb |
| 7 | (Invite teammate card) | Invite | UserPlus |
| ⚙ | `/settings` | Settings | Settings |

---

_End of debrief._
