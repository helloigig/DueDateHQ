# State Announcement Notifications — Implementation Plan

> How to build the Story 3 spine (PRD §4 P1 items 15–22 + addendum B1/B7).
> Engineering-focused. Paired with [DESIGN-HANDOFF.md](./DESIGN-HANDOFF.md) and [DESIGN-HANDOFF-ADDENDUM.md](./DESIGN-HANDOFF-ADDENDUM.md) (UI side).

---

## 1 · Pipeline at a glance

```
State authority site (50 DORs + DC + SoS)
        │
        ▼
   ┌─────────────┐         every 15 min per source
   │  Scraper    │  ────►  stores raw HTML + content-hash (dedupe)
   └──────┬──────┘
          │  new/changed content only
          ▼
   ┌─────────────┐
   │ LLM parser  │  ────►  structured JSON + confidence score
   └──────┬──────┘
          │
    ┌─────┴─────┐
    │           │
 conf ≥ 0.85   conf < 0.85
    │           │
    │           ▼
    │     ┌───────────────┐
    │     │ Human review  │  ────►  reviewer publishes/rejects
    │     │    queue      │
    │     └───────┬───────┘
    │             │
    └──────┬──────┘
           ▼
   ┌─────────────┐
   │  Matcher    │  ────►  queries every firm's client portfolio
   └──────┬──────┘
          │ affected clients per firm
          ▼
   ┌─────────────┐  ──► Email (Resend)
   │  Notifier   │  ──► In-app banner (dashboard)
   └──────┬──────┘  ──► Bell/notification center
          │         ──► Public /changes page entry
          ▼
   ┌─────────────┐
   │ Escalation  │  0h → 24h → 48h → 72h (B1 ladder)
   │   engine    │
   └─────────────┘
```

End-to-end SLA target: **< 6h detection-to-notification** (beats the 24h commercial SLA).

---

## 2 · Data model additions

Extends the PRD §5 model.

```
Announcement
  ├── id (uuid)
  ├── state_code (enum: CA, TX, NY, ...)
  ├── authority (string: "Louisiana DOR")
  ├── announcement_date (date, from source)
  ├── detected_at (timestamp)
  ├── type (enum: disaster_extension | penalty_relief | pte_change |
  │         form_change | rate_change | nexus_change)
  ├── status (enum: pending_review | published | rejected)
  ├── confidence (float 0..1)
  ├── counties (string[])
  ├── entity_types (string[])
  ├── tax_types (string[])
  ├── old_deadline (date, nullable)
  ├── new_deadline (date, nullable)
  ├── source_url (string)
  ├── source_hash (string — content hash for dedupe)
  ├── raw_text (text — archival)
  ├── parsed_impact (jsonb — full LLM output for audit)
  └── reviewer_id (fk users, nullable)

AffectedClient  (materialized; recompute on announcement publish + nightly)
  ├── announcement_id (fk)
  ├── firm_id (fk)
  ├── client_id (fk)
  ├── matched_at (timestamp)
  ├── match_reason (string — for debugging: "state+county+entity+tax")
  └── UNIQUE(announcement_id, client_id)

FirmAnnouncement  (per-firm state tracking; drives escalation)
  ├── announcement_id (fk)
  ├── firm_id (fk)
  ├── first_notified_at (timestamp)
  ├── last_email_at (timestamp)
  ├── acknowledged_at (timestamp, nullable)
  ├── acknowledged_by_user_id (fk, nullable)
  ├── snoozed_until (timestamp, nullable)
  ├── snooze_reason (string, nullable)
  ├── dismissed_at (timestamp, nullable)
  ├── dismissed_reason (string, nullable)
  ├── escalation_level (enum: normal | dark | blocking)
  ├── batch_adjusted_at (timestamp, nullable)
  └── UNIQUE(announcement_id, firm_id)

NotificationPreferences  (per-user)
  ├── user_id (fk)
  ├── email_delivery_mode (enum: digest | per_alert)  — default digest
  ├── digest_hour (int 0..23)                         — default 8
  ├── digest_timezone (string IANA)                   — fallback firm TZ
  ├── in_app_banner (bool)                            — default true
  └── bell_badge (bool)                               — default true

SourceMonitor  (operational — alerts ops if a state goes silent)
  ├── state_code (unique)
  ├── last_check_at (timestamp)
  ├── last_success_at (timestamp)
  ├── last_announcement_at (timestamp, nullable)
  ├── consecutive_failures (int)
  └── health (enum: green | yellow | red)
```

---

## 3 · Scraper layer

### 3.1 · Source inventory (52 endpoints for MVP)

| Type | Count | Approach |
|---|---:|---|
| State DOR with RSS | ~15 | RSS polling (cheap, reliable) |
| State DOR without RSS | ~35 | Playwright HTML scrape |
| DC DOR | 1 | HTML |
| Secretary of State (for PTE / entity-level changes) | varies | HTML |

### 3.2 · Per-source adapter shape

```ts
interface Adapter {
  id: string;                    // "ca-dor", "la-dor", "tx-cpa"
  stateCode: StateCode;
  authorityName: string;         // "California Franchise Tax Board"
  sourceUrl: string;
  fetch(): Promise<RawScrape[]>;
  // Returns deduped new-or-changed items since last run
}

interface RawScrape {
  url: string;
  title: string;
  publishedAt: Date | null;
  rawHtml: string;
  contentHash: string;            // sha256 of normalized text
}
```

### 3.3 · Runtime

- **Cron cadence:** every 15 min for state DORs, hourly for SoS
- **Runtime options:**
  - **Cheapest:** Cloudflare Workers + Durable Objects (per-state adapter instance) + KV for hash state
  - **Simpler to start:** Fly.io or Railway container running a Bullmq queue worker
  - **If already on Supabase:** Supabase Edge Functions + pg_cron
- **Deduplication:** skip if `contentHash` already exists in announcements or pending-queue. Only parse on new/changed content.

### 3.4 · Health & observability

- `SourceMonitor.last_success_at` updated every successful run
- Red flag if `last_announcement_at` > 30 days for a high-volume state (CA, TX, NY, FL, IL all publish monthly)
- Alert ops via PagerDuty/Slack webhook when a source goes yellow (7 days) or red (14 days)
- Never auto-mark a firm "accuracy SLA honored" if any source in that state is red

---

## 4 · LLM parser

### 4.1 · Model choice (benchmark on day 1)

| Model | Pros | Cons |
|---|---|---|
| **Gemini 1.5 Flash** | Cheapest (~$0.003/parse at 2k input tokens) · fast (< 2s) · long context | Less robust at edge cases |
| **Claude Haiku 4.5** | Reliable structured output · strong instruction-following · $0.005/parse | Slightly pricier |
| **Grok 4** | Free-ish tier with certain APIs · fast | Less mature tool-use |

Run 20 real announcements through all three. Pick based on: FP rate (target < 5%), FN rate (target < 1%), structured-output compliance, cost.

### 4.2 · Prompt shape

```
You extract structured tax-deadline intelligence from US state tax-authority announcements.

SOURCE: {authority_name} ({state_code})
URL: {source_url}
PUBLISHED: {published_date}

TEXT:
"""
{raw_text}
"""

Extract a JSON object matching this schema:
{
  "is_tax_deadline_related": boolean,
  "type": "disaster_extension" | "penalty_relief" | "pte_change" | 
          "form_change" | "rate_change" | "nexus_change" | "other",
  "announcement_date": "YYYY-MM-DD" (from published date),
  "counties": ["..."] (specific counties mentioned; [] if statewide),
  "entity_types": ["LLC" | "S-Corp" | "C-Corp" | "Partnership" | 
                   "Individual" | "Trust" | "Non-profit"],
  "tax_types": ["state_income" | "pte" | "q_estimates" | "franchise" | 
                "sales" | "payroll" | ...],
  "old_deadline": "YYYY-MM-DD" | null,
  "new_deadline": "YYYY-MM-DD" | null,
  "confidence": float 0..1 (your self-assessment),
  "evidence": {
    "counties": "verbatim quote from text",
    "entity_types": "verbatim quote",
    "deadline_change": "verbatim quote"
  }
}

Rules:
- If is_tax_deadline_related=false, set confidence=1.0 and skip all other fields.
- Confidence should reflect: clarity of the announcement + completeness of extracted fields.
- Always cite verbatim evidence. If you can't cite, set the field to null.
- Never invent counties, dates, or entity types not in the source text.
```

### 4.3 · Output handling

```
if (parsed.is_tax_deadline_related === false) {
  archive with type='other', skip matching + notification
  return
}

if (parsed.confidence >= 0.85) {
  status = 'published'
  run matcher + notifier
} else if (parsed.confidence >= 0.60) {
  status = 'pending_review'
  enqueue in review UI; notify human reviewer
} else {
  status = 'pending_review' (strict review)
  enqueue; no user-facing action until published
}
```

### 4.4 · Cost control

- Cache by `source_hash` — never reparse identical content
- Batch where possible (Gemini supports batched requests)
- At 200 announcements/month × $0.005 = **~$1/month** parsing cost. Non-issue.
- Hard budget guardrail: monthly parse spend > $X → alert + fall back to rule-based extraction for high-frequency templates (disaster-extension notices often follow template structure)

---

## 5 · Matcher

Triggered on: `Announcement.status → 'published'`.

### 5.1 · Query

```sql
-- Per announcement: find all affected (firm_id, client_id) pairs
INSERT INTO affected_client (announcement_id, firm_id, client_id, matched_at, match_reason)
SELECT
  :announcement_id,
  c.firm_id,
  c.id,
  NOW(),
  'state=' || :state_code || 
    (CASE WHEN :counties IS NOT NULL THEN ' county=' || array_to_string(:counties, ',') ELSE '' END)
FROM clients c
WHERE c.status = 'active'
  AND (
    c.primary_state = :state_code 
    OR :state_code = ANY(c.nexus_states)
  )
  AND (
    :counties IS NULL OR array_length(:counties, 1) IS NULL
    OR c.county = ANY(:counties)
  )
  AND c.entity_type = ANY(:entity_types)
  AND EXISTS (
    SELECT 1 FROM deadlines d
    WHERE d.client_id = c.id
      AND d.status NOT IN ('completed', 'filed_extension')
      AND (
        -- Tax-type match — requires mapping service_template.form_name → tax_type
        EXISTS (
          SELECT 1 FROM service_templates st
          WHERE st.id = d.service_template_id
            AND st.tax_type = ANY(:tax_types)
        )
      )
  );
```

### 5.2 · FirmAnnouncement insertion

After matching, create one FirmAnnouncement per firm with affected clients:

```sql
INSERT INTO firm_announcement (announcement_id, firm_id, first_notified_at, escalation_level)
SELECT DISTINCT :announcement_id, firm_id, NOW(), 'normal'
FROM affected_client WHERE announcement_id = :announcement_id
ON CONFLICT DO NOTHING;
```

### 5.3 · Rematching

Nightly job re-runs matching for:
- Announcements published in last 30 days
- Firms that added/edited clients in last 24h

Ensures a new client gets retroactively linked to a recent announcement.

---

## 6 · Notifier

### 6.1 · Delivery channels

| Channel | Trigger | Per |
|---|---|---|
| Email (per-alert) | FirmAnnouncement created AND user pref = per_alert | User |
| Email (digest) | Cron 8am user TZ, bundles last 24h | User |
| In-app banner | FirmAnnouncement.acknowledged_at IS NULL | Firm |
| Bell notification | Same | User |
| Public /changes | Announcement.status = 'published' | Global |

### 6.2 · Email implementation (Resend)

```ts
// Per-alert
async function sendPerAlertEmail(firmAnnouncement, user, affectedClients) {
  await resend.emails.send({
    from: `${firm.name} via DueDateHQ <alerts@duedatehq.com>`,
    reply_to: user.email,  // replies go to the CPA, not us
    to: user.email,
    subject: `${affectedClients.length} clients affected · ${announcement.title}`,
    react: <AlertEmail ... />,  // React Email template
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,  // CAN-SPAM
    },
  })
}
```

Template includes:
- Headline: "N clients affected by [state authority] [announcement type]"
- Parsed impact summary (counties · entity types · new deadline)
- Affected-client list (up to 10 inline; link for more)
- CTA button → Announcement detail deep link
- "View official source" link
- CAN-SPAM footer (firm postal address, unsubscribe)

### 6.3 · Digest email (8am user TZ)

Cron runs hourly, checks for users whose `digest_hour` = current hour in their TZ. Bundles all FirmAnnouncements created in last 24h that haven't already been emailed.

Skip the email entirely if the bundle is empty (silence is signal).

### 6.4 · In-app banner

Stored on `FirmAnnouncement`. Dashboard renders all `firmAnnouncement` rows where:
- `acknowledged_at IS NULL`
- `dismissed_at IS NULL`
- `snoozed_until IS NULL OR snoozed_until < NOW()`

Most-recent on top. Multi-stack per addendum A12.

### 6.5 · Bell notification (A2 — unified center)

Different type of notification union:

```ts
type Notification = 
  | { kind: 'state_announcement'; firmAnnouncementId: string; ... }
  | { kind: 'email_bounce'; clientId: string; ... }
  | { kind: 'team_invite'; inviteId: string; ... }
  | { kind: 'extension_approved'; deadlineId: string; ... }
  | { kind: 'reminder_digest'; count: number; ... }
```

Single notifications table, discriminated union. Bell dropdown filters by kind.

---

## 7 · Escalation engine (B1)

### 7.1 · Logic

Runs hourly cron:

```sql
-- 24h: send reminder email if not acknowledged
UPDATE firm_announcement
SET last_email_at = NOW()
WHERE acknowledged_at IS NULL
  AND dismissed_at IS NULL
  AND (snoozed_until IS NULL OR snoozed_until < NOW())
  AND first_notified_at < NOW() - interval '24 hours'
  AND last_email_at < NOW() - interval '24 hours'
RETURNING id;
-- Queue reminder emails for returned ids

-- 48h: mark escalation_level = 'dark'
UPDATE firm_announcement
SET escalation_level = 'dark'
WHERE acknowledged_at IS NULL
  AND dismissed_at IS NULL
  AND (snoozed_until IS NULL OR snoozed_until < NOW())
  AND first_notified_at < NOW() - interval '48 hours'
  AND escalation_level = 'normal';

-- 72h: mark escalation_level = 'blocking'
UPDATE firm_announcement
SET escalation_level = 'blocking'
WHERE acknowledged_at IS NULL
  AND dismissed_at IS NULL
  AND (snoozed_until IS NULL OR snoozed_until < NOW())
  AND first_notified_at < NOW() - interval '72 hours'
  AND escalation_level = 'dark';
```

### 7.2 · User actions that stop escalation

- **Acknowledge** → `acknowledged_at = NOW()`. Banner dismisses, no more emails.
- **Snooze** → `snoozed_until = NOW() + 24h`, `snooze_reason = ?`. Logged for ops data quality. Banner hides until reset.
- **Dismiss (not applicable)** → `dismissed_at = NOW()`, `dismissed_reason = ?`. Permanent. Confirm modal per B2 #5.
- **Batch-adjust** → implicit acknowledge + `batch_adjusted_at = NOW()`.

Never auto-apply changes. Silence must be active.

### 7.3 · Blocking dialog UI

When `escalation_level = 'blocking'` on any FirmAnnouncement, Dashboard mount shows:

```
╔════════════════════════════════════════════════════╗
║  72h — 6 clients still need review                 ║
║                                                    ║
║  Louisiana DOR · Hurricane Delta Extension         ║
║  Acknowledge you've seen this, or snooze 24h.      ║
║                                                    ║
║  [ Review now ]  [ Snooze 24h ]                    ║
╚════════════════════════════════════════════════════╝
```

Respects `prefers-reduced-motion`. Traps focus until one of the two actions is taken.

---

## 8 · Public `/changes` page (P1 #22)

### 8.1 · Purpose

- SEO top-of-funnel (journey Stage 1 in customer journey)
- Trust proof (concrete evidence of the 24h SLA)
- Data moat (compounds over time; competitors can't retroactively build)

### 8.2 · Architecture

- **Lives on marketing domain** (`duedatehq.com/changes`) OR main app domain rewrite — not inside the authenticated app
- **SSR or static generation** — Next.js incremental static regen every hour
- **Queries published Announcements** via read-only API
- **No per-firm data** — just the global announcement stream with source links

### 8.3 · Content

- Headline + date + authority + state code
- Parsed impact summary
- **Last verified** timestamp (e.g., "Verified 3h ago · Confidence: High")
- Link to official source
- Filter by state + type + date range
- RSS feed for aggregators

### 8.4 · Launch content

Historical backfill target: **2 years of announcements** before launching the page publicly. Earn SEO authority by having real data density on day one.

---

## 9 · Implementation order (time-boxed)

### Phase A — Skeleton (Weeks 1–2)
1. **One state's scraper** — California Franchise Tax Board (highest volume; has RSS)
2. **LLM parser** — Gemini 1.5 Flash; JSON schema validation
3. **Manual publish** — no auto-publish; team reviews + clicks publish
4. **Matcher** — against current mock data + real firms if any
5. **Dashboard banner + announcement detail** — lo-fi already exists; wire to real data
6. **Per-alert email** — Resend integration, one template
7. **End-to-end test** — trigger one real announcement; confirm firm receives email + sees banner

**Exit criteria:** one real announcement detected → parsed → published → matched → emailed → actioned in < 2 hours.

### Phase B — Coverage (Weeks 3–5)
1. **Top 10 state scrapers** (CA, TX, NY, FL, IL, PA, OH, GA, NC, NJ — covers ~65% of US small business)
2. **Confidence scoring + human review queue** — internal ops UI, not user-facing
3. **SourceMonitor + ops alerts** — don't ship auto-publish without monitoring
4. **All 6 announcement types** — disaster, penalty, PTE, form, rate, nexus
5. **6-month historical backfill** for active states

**Exit criteria:** 10 states at <5% FP, <1% FN on verified announcements. Human-review queue < 30 items at any time.

### Phase C — Polish (Weeks 6–7)
1. **Remaining 40 states + DC + SoS** — adapters can be templated once pattern is established
2. **Escalation ladder (B1)** — 24h/48h/72h ladder + blocking dialog
3. **Confirm modal on batch-adjust (B2 #1)** — preview diff before applying
4. **Digest email mode (B7)** — 8am daily digest option
5. **Unified notification center (A2)** — bell dropdown with all types
6. **Public /changes page** — historical backfill to 2 years, SEO setup
7. **Notification preferences UI** in Settings

**Exit criteria:** 50-state coverage, accuracy SLA publishable, `/changes` page indexed.

---

## 10 · Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| State DOR changes HTML structure → scraper breaks silently | **High** (it will happen) | High (missed announcements = SLA breach) | `SourceMonitor` with zero-announcement alerts per state; weekly ops review; fallback to RSS where available |
| LLM hallucinates county/entity/date not in source | Medium | **Critical** (affected-client matching is wrong) | Prompt requires verbatim evidence quotes; human-review queue for conf < 0.85; accuracy SLA commitment with refund |
| False negative (real announcement missed entirely) | Medium | **Critical** | Multi-source for high-volume states (RSS + HTML + Twitter where applicable); manual spot-check weekly for first 90 days |
| LLM costs balloon with scraped volume | Low | Medium | `source_hash` dedupe; budget guardrail + fallback to rule-based extraction for disaster-extension template |
| User treats auto-publish as binding legal advice | Medium | **Critical** | Every announcement links to `source_url`; prominent "⚠ Always verify against source" text; Terms of Service clarifies reference nature; accuracy SLA explicit |
| Email deliverability (flagged as spam) | Medium | High | Resend with proper DKIM/SPF; custom domain for Team tier; monitor bounce rate; list-unsubscribe header |
| Escalation blocking dialog too aggressive → user frustration | Medium | Low | Snooze always available; reason logged; if snooze rate > 30% → dial back thresholds |
| Public `/changes` page accuracy scrutiny | Low | **High if it happens** | Only publish conf ≥ 0.85; show "Verified [time]" timestamps; allow user-submitted corrections via contact form |

---

## 11 · Tech stack recommendation

Given existing Vite + React frontend:

| Layer | Choice | Why |
|---|---|---|
| **Backend API** | Hono on Cloudflare Workers, OR Fastify on Fly.io | Lean, fast cold starts, easy scaling |
| **Database** | Supabase (Postgres) | Multi-tenant with RLS, good for firm isolation |
| **Scraper workers** | Cloudflare Workers + Durable Objects OR BullMQ on Fly.io | Cron scheduling + per-state isolation |
| **LLM** | Gemini 1.5 Flash (primary) · Claude Haiku (fallback) | Cheap, fast, reliable structured output |
| **Email** | Resend + React Email | Developer-friendly, CAN-SPAM primitives built in |
| **Public /changes** | Next.js on Vercel, reading from same Supabase | SSR + ISR, SEO-ready, separate bundle from app |
| **Observability** | Axiom or Baselime | Ship-and-forget, structured logs, ops alerts |
| **Review UI (ops)** | Retool or an internal route in the main app | Fast to build; low maintenance |

---

## 12 · Success metrics (ops dashboard)

From PRD §8 (Story 3 impact) + addendum:

| Metric | Target | Alert threshold |
|---|---|---|
| Announcement detected within 24h of publication | 95% | < 85% over 14 days |
| Announcement → user notification latency | < 6h median | > 12h median |
| User click-through → action | 40% | < 20% over 30 days |
| False-positive rate (user dismisses "not applicable") | < 5% | > 10% |
| False-negative rate (user reports missed announcement) | < 1% | any FN report is P0 |
| Scraper health (sources green) | 50/52 | < 48/52 |
| Human review queue depth | < 30 items | > 100 |
| LLM cost per announcement | < $0.01 | > $0.05 |

---

## 13 · What this doc does NOT cover

- **PWA web push** for state announcements on mobile — Phase 2 addition; requires service worker + push subscription API
- **Federal (IRS) announcements** — mentioned in A2 as "first-class," but adds scraper complexity (federal register RSS + IRS newsroom); defer to Phase 2
- **SMS notifications** — not in MVP per PRD §3.15; don't half-build
- **Team-scoped notification routing** (e.g., only partner assigned to Louisiana clients gets that state's alerts) — Phase 2
- **Retraining LLM prompts based on human-review corrections** — ML flywheel, Phase 2
- **Multi-language scraping** (Canadian French, Spanish for PR DOR) — Phase 3+

---

*v1 · 2026-04-24 · pairs with [DESIGN-HANDOFF-ADDENDUM.md](./DESIGN-HANDOFF-ADDENDUM.md) §B1/B7 and PRD §4 P1 #15–22.*
