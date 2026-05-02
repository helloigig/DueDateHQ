# AlertDetail — `penalty_relief` Action Spec

_Companion to [federal-forms-and-alerts-debrief.md](./federal-forms-and-alerts-debrief.md) and [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md). Scope: the click-through state (`/alerts/:id`) for alertType=`penalty_relief`._

---

## 1. Real-world context

Penalty relief is when the IRS or a state DOR formally suspends, reduces, or refunds penalties — typically under one of these patterns:

- **Mass automatic relief** (most common): IRS announces broad relief tied to an event. Examples:
  - IRS Notice 2022-36 — automatic abatement of failure-to-file penalties for 2019/2020 returns ($1.2B refunded; ~1.6M taxpayers covered)
  - IRS Notice 2024-7 — Q1 2024 deposit-penalty relief for affected payroll filers
  - COVID-era CARES Act penalty waivers (multiple notices 2020–2022)
- **State amnesty programs** (periodic): states run 30–90-day windows where penalties are waived in exchange for back filings. Examples: NY 2023 amnesty (~$60M collected), IL Tax Amnesty 2019, MA Tax Amnesty 2024.
- **Targeted disaster-adjacent relief**: distinct from `disaster_extension` — sometimes a state issues penalty relief WITHOUT a deadline extension (e.g., "you still must file by the original date, but we'll waive the late-payment penalty if your check arrives by X").
- **Reasonable-cause / First-Time Penalty Abatement (FTA)**: per-taxpayer, requires Sarah to call IRS — out of scope for alert pipeline.

The pipeline catches the first three. The CPA's job is **at filing time, remember to claim or apply the relief** — otherwise the taxpayer pays a penalty they could have avoided.

This makes `penalty_relief` an **annotative** alert type (not mechanical like disaster_extension). Sarah doesn't act NOW — she tags clients NOW so that 90 days from now, when she's filing for them, the relief applies.

## 2. Real examples our scraper has handled

| State / Authority | Notice | Scope | Window |
|-------------------|--------|-------|--------|
| IRS | Notice 2022-36 | failure-to-file FTF penalty abated for 2019/2020 returns filed late | retroactive |
| FL DOR | "Late-payment penalty waived for sales tax remitters in 14 counties through Mar 31" | sales tax late-payment | window-bounded |
| IL DOR | "Tax Amnesty 2019" — penalties waived for back filings made by Nov 15 | broad — multiple tax types | 60-day window |
| NY DTF | "Pandemic penalty waiver for restaurants reporting tip income discrepancies" | one tax type, one industry | retroactive cleanup |
| CA FTB | "First-time small business late-filing penalty relief" — auto-applied if criteria met | LLC/Partnership returns | ongoing |

The pipeline normalizes all of these into the same alertType with: `relievedTaxes[]`, `relievedScope` (filing/payment/late/info-return/etc.), `windowStart`, `windowEnd`, `eligibilityRule`.

## 3. The CPA's job

Sarah's mental model: "remind me at filing time."

She does NOT need to:
- Move any deadlines
- Compute any new amounts
- Send a client an email immediately

She DOES need to:
- Mark each affected client so that when she files for them in 90 days, the system reminds her ("FYI: client qualifies for penalty relief — file Form 843 / claim abatement / no penalty owed").
- Optionally let the client know they're covered (reassurance, not action — "you're fine, sit tight").

This drives the action shape: **tag now, act later**.

---

## 4. Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│  ← Alerts · IRS · penalty_relief · Detected 2h              │
│  Failure-to-file penalty abated for 2019/2020 returns       │
│  Affecting late filers; auto-applied if criteria met        │
│  [Source: irs.gov/Notice-2022-36 ↗] [Authority: IRS]        │
├─────────────────────────────────────────────────────────────┤
│ VERDICT (info-toned, not loud)                               │
│  Affecting 6 of your 49 clients                              │
│  Each will be tagged for review at next filing.              │
│  [Select all] [Clear all]                                    │
│                                                              │
│  ☑ Acme LLC (S-Corp · FL · Late-filer flag set)            │
│       Tag preview: "FTF penalty relief (IRS Notice 2022-36) │
│       — apply at next 1120-S filing. Expires N/A (retroac-  │
│       tive)."                                                │
│                                                              │
│  ☑ Bob Williams (Individual · FL · 2020 1040 filed Apr '23)│
│       Tag preview: "FTF penalty relief (IRS 2022-36) —      │
│       refund $250 already issued by IRS Oct '22."           │
│                                                              │
│  ☑ Carol Reyes · ☑ Dan Patel · ☑ Eve Chen · ☑ Frank Wong   │
├─────────────────────────────────────────────────────────────┤
│ NOT AFFECTED (12 candidates) ▸                               │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE ▸                                                   │
│  (collapsed — relievedTaxes, eligibilityRule, etc.)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR                                            │
│  [Primary] Tag 6 clients for review at filing               │
│  [Secondary] Tag + draft 6 reassurance emails               │
│  [Overflow ⋮] Dismiss · Snooze · Share                      │
└─────────────────────────────────────────────────────────────┘
```

## 5. Header

Same fields as disaster_extension (back link, state chip, title, authority, dates, source link). One difference:

- **Subtitle template**: `"{relievedScope} relief for {scope-description} {timeframe-description}"`
  Examples:
  - "Failure-to-file penalty waived for 2019/2020 returns (retroactive)"
  - "Late-payment penalty waived for sales tax remitters in Pinellas, Hillsborough through Mar 31"
  - "Tax Amnesty 2019 — penalties waived for back filings made by Nov 15"

## 6. Verdict section

### 6.1 Headline

```
Affecting 6 of your 49 clients
Each will be tagged for review at next filing.
```

The second line is critical — it sets expectations that the action is annotative, not immediate. Without it, Sarah might wonder "do I need to do something for them now?"

If 0 clients affected:
```
None of your clients have penalties pending in {scope}.
[Dismiss with reason] [Open source ↗]
```

### 6.2 Per-client row

Different from disaster_extension — **no per-filing expansion**. Penalty relief is client-level, not filing-level (there's no list of deadlines to move).

```
☑ Acme LLC (S-Corp · FL · Late-filer flag set)
   Tag preview: "FTF penalty relief (IRS Notice 2022-36) —
   apply at next 1120-S filing. Expires: N/A (retroactive)."
```

Slots:

| Slot | Content | Notes |
|------|---------|-------|
| Checkbox | per-client toggle | Pre-checked for all matched clients |
| Name | `client.name` | Click → ClientDetail |
| Metadata | `entityType · primaryState · matchReason` | matchReason captures WHY this client matched (late-filer flag, 2020 1040 filed late, etc.) |
| **Tag preview** | Pre-rendered tag text that will be written | Most important new element — shows Sarah exactly what she's about to commit |

The tag preview is composed from the alert's metadata + per-client context:

```
"{relievedScope} relief ({authority} {noticeRef}) — apply at next
{client's-most-relevant-filing} filing. Expires: {expiryDate or 'N/A (retroactive)'}."
```

### 6.3 Match-reason annotations

Per-client annotations explain why this client was matched:

| Annotation | Meaning |
|------------|---------|
| `[late-filer flag set]` | Client has internal flag from a prior late filing |
| `[2020 1040 filed Apr '23]` | Filing record matches relief criteria explicitly |
| `[refund $250 already issued]` | IRS already refunded — alert is for SARAH's audit trail |
| `[client requested abatement]` | Existing abatement request in the system |
| `[broad criteria — verify]` | Auto-matched on entity type alone; Sarah should confirm |

These help Sarah triage quickly — exact matches act first, broad matches verify first.

### 6.4 "Not affected" section (collapsed)

Lists candidates who could plausibly match but didn't. Each row shows WHY:

```
Eve Chen (Individual · FL)            — 2020 return filed on time
Frank Wong (LLC · FL)                 — entity type doesn't match
Grace Lee (Individual · GA)           — wrong jurisdiction
```

"Add to affected" override available per row, useful when AI's match logic missed an edge case.

---

## 7. Action bar

### 7.1 Primary — `"Tag N clients for review at filing"`

The annotative action. Most important verb.

**On click**:

1. Optimistic UI: action bar shows "Tagging 6 clients…" with spinner
2. BE call: `trpc.announcements.tagClientsForRelief({ announcementId, clientIds, expiresAt })`
3. BE in transaction:
   - For each client, INSERT INTO `client_tags (client_id, alert_id, tag_text, expires_at, created_at, created_by)`
   - INSERT activity_event (type='tag_added', metadata={announcementId, tagText, expiresAt})
   - UPDATE announcement.acted_at = now()
4. FE flash banner: `"6 clients tagged · Untag (24h window)"`

**Where the tag surfaces** (this is the WHOLE POINT of the alert):

- **ClientDetail header**: "🏷 Tags: FTF penalty relief — claim at next 1120-S filing" (pin until tag expires or filing happens)
- **TaskDetail (when filing the relevant return)**: prominent banner above the form: "⚠ FTF penalty relief applies to this filing. [How to claim]"
- **Workspace / Filings tab**: form-level annotation on relevant deadlines: "Penalty relief flagged"
- **Today queue**: when filing of relevant form is approaching, surface tag as a TodoItem ("FTF penalty relief flagged for Acme — confirm claim before filing")
- **Audit log**: every tag is a logged event for compliance

**Tag lifecycle**:

```
ACTIVE → APPLIED (when relief is actually claimed in a filing)
       → EXPIRED (if expiresAt passes without being applied)
       → REMOVED (manual untag)
```

`APPLIED` requires Sarah to mark "applied" on the tag (one-click on TaskDetail, in the relief banner).

### 7.2 Secondary — `"Tag + draft N reassurance emails"`

Tags + composes a per-client email letting them know they're covered.

**Mode D email template**:

```
Subject: Good news — you're covered by {jurisdiction} penalty relief

Hi {client.firstName},

Quick FYI — {jurisdiction} just announced penalty relief covering
your {scope} situation. Specifically: {humanized-explanation}.

I've flagged your file so we apply the relief automatically at your
next filing. No action needed from you. Let me know if you have
questions.

— {firmName}
```

**On confirm**: tags + queues email drafts (Mode D, CPA always CC'd).

### 7.3 Overflow

- Dismiss with reason (same dialog as disaster_extension)
- Snooze 7d / 14d / 30d
- Share (copy link, send to teammate)

---

## 8. Edge cases

| Case | Behavior |
|------|----------|
| Client already has a tag for the same alertId (reapplying) | Show "already tagged" annotation; primary verb counts only NEW tags |
| Tag expiry passes without filing happening | Tag → `EXPIRED` state; surfaces on `/alerts?filter=expired-tags` for review; doesn't auto-resurface as a new alert |
| Client moves jurisdiction after tagging (FL → GA) | Tag persists (was valid when applied); annotation added: "(client now in GA — verify relief still applies)" |
| Penalty already paid before alert detected | Tag still applied; tag preview includes `[refund pending if eligible]`; Sarah can file a refund claim form (843) at next opportunity |
| Multiple penalty_relief alerts overlap (rare — IRS + state both grant for same situation) | Show overlap warning in evidence; tags from both attached; banner on TaskDetail shows both |
| First-Time Penalty Abatement (FTA) cases | Pipeline does NOT generate FTA alerts (those are per-taxpayer, not jurisdictional). Tag manually if applicable |
| Concurrent edit (another firm member tags) | Optimistic lock; if changed, refresh prompt |
| 0 clients pre-matched but Sarah knows someone qualifies | "Add to affected" override in Not Affected section; manual tagging supported |

---

## 9. State diagram

Same as disaster_extension at the alert level:

```
PENDING → ACTED (tags created) | SNOOZED | DISMISSED | EXPIRED
```

But also a **tag-level** state machine, distinct from the alert:

```
TAG_CREATED → TAG_APPLIED (relief claimed in a filing)
            → TAG_EXPIRED (window passed)
            → TAG_REMOVED (manual untag, only if not yet applied)
```

The tag outlives the alert. Even after the alert is `DISMISSED`, the tags it created remain (until `APPLIED` / `EXPIRED` / manually removed).

---

## 10. BE data contract

### `trpc.announcements.detailWithAffected({ announcementId })`

For penalty_relief, the response shape extends the disaster_extension shape with:

```typescript
{
  announcement: {
    // ...shared fields
    alertType: 'penalty_relief';
    relievedTaxes: string[];          // ["1040 FTF", "1120-S FTF"] etc.
    relievedScope: 'filing' | 'payment' | 'late_filing' | 'info_return' | 'amnesty';
    windowStart: ISODate | null;      // null if retroactive
    windowEnd: ISODate | null;
    eligibilityRule: string;          // human-readable: "2019/2020 returns filed late"
    automaticApplication: boolean;    // true if IRS auto-applies (e.g., Notice 2022-36)
  };

  affected: Array<{
    client: { id, name, entityType, primaryState };
    matchReason: string;
    matchConfidence: 'high' | 'medium' | 'low';
    tagPreview: string;               // pre-rendered tag text (for verdict UI)
    relevantUpcomingFilings: Array<{ // optional — what filings the tag will surface on
      taskId: string;
      form: string;
      dueDate: ISODate;
    }>;
  }>;

  notAffected: Array<{
    client: { id, name, entityType, primaryState };
    reason: 'wrong_scope' | 'wrong_jurisdiction' | 'no_matching_filing' | 'already_tagged';
  }>;
}
```

### `trpc.announcements.tagClientsForRelief({ announcementId, clientIds, expiresAt? })`

Input:
```typescript
{
  announcementId: string;
  clientIds: string[];
  expiresAt: ISODate | null;          // null = retroactive (no expiry)
}
```

Returns:
```typescript
{
  taggedCount: number;
  duplicateCount: number;             // clients already tagged for this alert
  failedCount: number;
}
```

### `trpc.tags.markApplied({ tagId, taskId })`

Called from TaskDetail's "claim relief" button. Marks tag as `APPLIED`.

### `trpc.tags.untag({ tagId, reason })`

Manual untag. Records reason in activity log.

---

## 11. Copy

| Element | Copy |
|---------|------|
| Browser tab | `"IRS · Penalty relief · DueDateHQ"` |
| Verdict header (N>0) | `"Affecting {N} of your {totalActiveClients} clients"` |
| Verdict subhead | `"Each will be tagged for review at next filing."` |
| Verdict header (N=0) | `"None of your clients have penalties pending in {scope}."` |
| Primary verb | `"Tag {N} clients for review at filing"` |
| Primary verb (N=0) | `"Tag 0 clients"` (greyed) |
| Secondary verb | `"Tag + draft {N} reassurance emails"` |
| Confirmation flash | `"{N} clients tagged · Untag (24h window)"` |
| Confirmation flash (with email) | `"{N} clients tagged · {N} emails queued · Untag (24h)"` |
| Annotation: late-filer flag | `[late-filer flag set]` (warn-tone) |
| Annotation: filing record match | `[2020 1040 filed Apr '23]` (info-tone) |
| Annotation: refund already issued | `[refund $X already issued by {authority} {date}]` (ok-tone) |
| Annotation: broad criteria | `[broad criteria — verify before tagging]` (warn-tone) |
| Tag preview prefix | `Tag preview: ` (italics) |
| Empty state CTA | `"Dismiss with reason"` |
| TaskDetail relief banner | `"⚠ {scope} penalty relief applies to this filing. [How to claim]"` |
| ClientDetail tag chip | `"🏷 {compact tag text}"` |

**Tone**: declarative, reassuring, never alarming. Sarah's job here is annotation — the copy should reinforce "this is FYI, you don't act now, you act in 90 days."

---

## 12. Telemetry

| Event | When | Payload |
|-------|------|---------|
| `alert_viewed` (penalty_relief) | Page mount | shared with other alertTypes |
| `clients_tagged` | After batch tag | `{ announcementId, taggedCount, expiresAt }` |
| `tag_applied` | TaskDetail claim button | `{ tagId, taskId, daysFromTag: int }` |
| `tag_expired` | Background job | `{ tagId, daysFromTag: int }` — proxies "alert was useful but Sarah didn't act in time" |
| `tag_removed` | Manual untag | `{ tagId, reason, daysFromTag: int }` |

Goal: measure (a) tag application rate (proxy for "alert was useful"), (b) time-from-tag-to-application (proxy for "how far in advance does Sarah know vs the filing date"), (c) tag expiry rate (proxy for "Sarah missed it" — bad).

---

## 13. What's NOT in scope (intentionally)

- **Per-taxpayer reasonable-cause abatement requests** — those need Form 843 + IRS phone call. Out of pipeline scope; alert points Sarah to the form when she's filing.
- **Automatic Form 843 filing** — too risky to auto-file. Sarah always reviews first.
- **Refund tracking from IRS** — separate Mode B inbound concern; tag annotates "refund pending" but doesn't poll IRS.
- **Penalty calculation / forecasting** — "would this client have owed $X without relief?" Useful but separate Mode E concern.
- **Client portal notifications** — per `forever_no` we don't build a client portal; Sarah composes the email manually if she wants to notify.

---

## 14. Build order

| Phase | Work | Effort |
|-------|------|--------|
| 1 | Schema: `client_tags` table (id, client_id, alert_id, tag_text, expires_at, applied_at, removed_at, created_at, created_by) | XS |
| 2 | BE: `tagClientsForRelief` procedure + `tagPreview` rendering | S |
| 3 | FE: VerdictSection variant — render tag previews per client (no per-filing expansion) | S |
| 4 | FE: ClientDetail tag chip surface | S |
| 5 | FE: TaskDetail relief banner + "claim relief" button → markApplied | M |
| 6 | BE: cron job to expire tags whose expiresAt passes | XS |
| 7 | Telemetry events | XS |
| 8 | E2E test: alert → tag 4 clients → open TaskDetail → claim relief → confirm tag becomes APPLIED | M |

Estimated total: ~1 sprint solo.

---

_End of penalty_relief spec._
