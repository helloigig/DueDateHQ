# AlertDetail — `pte_change` Action Spec

_Companion to [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md). Scope: `/alerts/:id` for alertType=`pte_change`._

---

## 1. Real-world context

Pass-Through Entity (PTE) tax is a state-level workaround to the federal $10K SALT cap. The entity (S-Corp / Partnership / LLC) elects to pay state income tax at the entity level — that payment is a federal deduction (no SALT cap because it's not paid by the individual), and the owner gets a state credit on their personal return.

**Adoption status (2026)**: 36+ states have a PTE election. Mechanics and deadlines vary state-by-state:

| State | Form / Election | Election deadline | Key wrinkle |
|-------|-----------------|-------------------|-------------|
| CA | Form 3804 / 3804-CR | June 15 prior year (binding) | Highest-volume PTE |
| NY | Form CT-3-PTET / IT-204-IP | March 15 (annual) | Late changes common |
| NJ | Form NJ-1065 / BAIT | March 15 (annual) | BAIT = Business Alternative Income Tax |
| LA | Form CIFT-620 PTE | First day of tax year | Permanent election by default |
| MA | Form 63D-ELT | Due with annual return | New as of 2024 |
| MD | Form 511 | April 15 of year after | Optional retroactive |
| OK | Form 587 | First day of tax year | Binding once made |

States change rules frequently — the alert pipeline catches these as `pte_change` alerts. Common changes:
- **Election deadline shift** ("CA moves PTE election deadline from Jun 15 to May 15")
- **Allocation method update** ("OK now requires guaranteed-payment allocation")
- **Tax rate change** ("NY PTET top rate moves from 6.85% to 9.65%")
- **Eligibility threshold change** ("MA opens PTE to single-member LLCs")
- **Election sunset** ("CA PTE expires after 2025 unless renewed")
- **Mechanics change** (Q-estimate tying, late penalty rules)

This makes `pte_change` a **conversational** alert type. The CPA's job isn't to file something — it's to revisit each affected client's election strategy. Outcome of the conversation is usually one of: (a) maintain election, (b) revoke election, (c) opt in (if eligible and not yet elected), (d) defer decision to next year.

## 2. Real examples

| State | Notice | Type of change |
|-------|--------|---------------|
| CA | "PTE election deadline moved from Jun 15 to May 15 effective 2026 tax year" | deadline shift |
| NY | "PTET tax rate updated — new graduated brackets" | rate change |
| OK | "Form 587 instructions updated — now requires explicit owner consent" | mechanics change |
| MA | "PTE eligibility expanded to single-member LLCs effective 2025" | eligibility expansion |
| WI | "Pass-through entity tax sunset extended through 2027" | sunset extended |

## 3. The CPA's job

Sarah's mental model: "schedule a conversation."

She does NOT need to:
- Move any deadlines (election deadlines are tracked separately)
- File anything immediately
- Recompute estimates (rate changes trigger `rate_change` alerts separately)

She DOES need to:
- Identify which of her clients have an active PTE election (or might benefit from electing)
- Decide which ones need a phone call vs an email vs a "next-year discussion"
- Schedule those calls before the next election deadline

This drives the action shape: **schedule + draft email**, not act-now batch operation.

---

## 4. Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│  ← Alerts · CA FTB · pte_change · Detected 4h               │
│  PTE election deadline moved from Jun 15 to May 15          │
│  Affects 2026 tax year onward                                │
│  [Source: ftb.ca.gov/notice-2026-04 ↗] [Authority: CA FTB]  │
├─────────────────────────────────────────────────────────────┤
│ VERDICT (info-toned)                                         │
│  Affecting 8 of your 49 clients                              │
│  These clients have an active CA PTE election or are PTE-   │
│  eligible. Schedule a conversation before May 15.            │
│  [Select all] [Clear all]                                    │
│                                                              │
│  ☑ Acme LLC (S-Corp · CA · PTE-elected since 2021)    📞 ▾  │
│       Talking points:                                        │
│         · Confirm intent to renew for 2026                  │
│         · New deadline: May 15 (was Jun 15) — month earlier │
│         · Q-estimate timing implications                    │
│       Best contact: phone (last call Mar 14, 2026)          │
│                                                              │
│  ☑ Bob Williams Partners LP (Partnership · CA · ELIGIBLE   │
│    BUT NOT YET ELECTED)                                📧 ▾  │
│       Talking points:                                        │
│         · 2024 SALT cap savings would have been ~$8,400     │
│         · Election not yet made — recommend opt-in by 5/15  │
│         · Owner-level Q-estimate adjustment needed          │
│                                                              │
│  ☑ Carol's Catering LLC (LLC · CA · NOT ELIGIBLE — single- │
│    member)                                              ✉ ▾  │
│       Note: Single-member LLCs are not PTE-eligible in CA. │
│       This client is shown for awareness only.              │
│       [Remove from affected]                                 │
├─────────────────────────────────────────────────────────────┤
│ NOT AFFECTED (3 candidates) ▸                                │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE ▸                                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR                                            │
│  [Primary] Schedule planning calls for 8 clients            │
│  [Secondary] Draft 8 planning emails                        │
│  [Overflow ⋮] Dismiss · Snooze · Share                      │
└─────────────────────────────────────────────────────────────┘
```

## 5. Header

Same shell as disaster_extension. Subtitle template:

`"{change-type plain-English}. Affects {timeframe}."`

Examples:
- "PTE election deadline moved from Jun 15 to May 15. Affects 2026 tax year onward."
- "PTE rate updated to 9.65% top bracket. Affects 2026 tax year."
- "PTE eligibility expanded to single-member LLCs. Effective for 2025 returns."

## 6. Verdict section

### 6.1 Headline

```
Affecting 8 of your 49 clients
These clients have an active CA PTE election or are PTE-eligible.
Schedule a conversation before May 15.
```

The subhead establishes urgency-without-panic — there's a deadline, but it's a planning deadline, not an action deadline.

If 0 clients affected:
```
None of your clients have a PTE election active in CA.
[Dismiss with reason] [Open source ↗]
```

### 6.2 Per-client row with expandable talking points

This is the variant's most distinctive feature: each client row expands to show **conversation talking points**.

```
☑ Acme LLC (S-Corp · CA · PTE-elected since 2021)    📞 ▾
    Talking points:
      · Confirm intent to renew for 2026
      · New deadline: May 15 (was Jun 15) — month earlier
      · Q-estimate timing implications
    Best contact: phone (last call Mar 14, 2026)
```

Slots:

| Slot | Content | Notes |
|------|---------|-------|
| Checkbox | per-client toggle | Pre-checked for matched clients |
| Name | `client.name` | Click → ClientDetail |
| Status chip | One of: `PTE-elected since YYYY`, `ELIGIBLE BUT NOT YET ELECTED`, `NOT ELIGIBLE`, `PRIOR-YEAR ELECTION (LAPSED)` | Most informative chip |
| Contact preference icon | `📞` (phone), `📧` (email), `✉` (mail), `💬` (text) | Pulled from client.preferredContactMethod |
| Expand caret | toggles row open | Reveals talking points |

Expanded view:

| Sub-element | Content |
|-------------|---------|
| Talking points list | 3–5 bullet points generated from alert metadata + client context (Mode E personalization) |
| Best contact info | Last contact mode + date — helps Sarah decide phone vs email |
| Estimated impact | When applicable, $X savings projection from analytics |

### 6.3 Status chip details

Per-client status is computed from the client's history:

- `PTE-elected since YYYY` — `client.pte_election_year` set; talking points focus on renewal/maintenance
- `ELIGIBLE BUT NOT YET ELECTED` — entity type + state allow election but `pte_election_year` is null; talking points focus on opt-in pitch
- `NOT ELIGIBLE` — entity type or other criteria exclude (e.g., single-member LLC in CA); shown for awareness only, [Remove from affected] button available
- `PRIOR-YEAR ELECTION (LAPSED)` — was elected in past, lapsed; talking points include re-election option

The four-state chip is critical — it bypasses the need for Sarah to mental-juggle each client's PTE status.

### 6.4 Talking points generation

Mode E (planning intelligence) composes 3–5 bullet points per client:

**Always include**:
- A bullet describing what changed ("New deadline: May 15 (was Jun 15)")
- A bullet about the client-specific implication ("month earlier" / "rate change saves $X" / "newly eligible")

**Conditionally include**:
- Q-estimate timing if rate or deadline shifted
- Owner-level credit reconciliation if mechanics changed
- Entity restructure consideration if eligibility expanded
- Sunset/renewal warning if election expires

**Never include**:
- Specific dollar projections without high-confidence Mode E analysis
- Recommendations Sarah hasn't validated ("you should elect" → instead "election would have saved ~$X based on prior-year data")

---

## 7. Action bar

### 7.1 Primary — `"Schedule planning calls for N clients"`

The conversational action.

**On click**:

1. Optimistic UI: action bar shows "Scheduling 8 calls…"
2. BE call: `trpc.announcements.schedulePlanningCalls({ announcementId, clientIds, callType: 'pte_strategy' })`
3. BE in transaction:
   - For each client, INSERT INTO `planning_calls (client_id, alert_id, topic, suggested_window_start, suggested_window_end, talking_points_json, status='proposed')`
   - Insert TodoItem on Today queue: "Schedule planning call with {client.name} re: PTE change"
   - Activity event per client
4. FE flash: `"8 calls flagged on Today queue · Open queue"`

**What happens next** (out of this alert's scope, but noted):
- Each TodoItem on Today is a "schedule the call" action — Sarah picks a time, Calendar integration creates an event (P2 — for now, the TodoItem is the surface; she manages calendar manually).
- Once the call happens, Sarah marks the call complete on TodoItem; outcome is logged ("renewed", "revoked", "deferred", "opted-in").

### 7.2 Secondary — `"Draft N planning emails"`

For clients whose contact preference is email or who are too low-stakes for a phone call.

**Mode D email template**:

```
Subject: {state} just changed PTE rules — quick chat?

Hi {client.firstName},

Heads-up — {state} just changed how the Pass-Through Entity election
works. Specifically: {humanized-summary}.

Your situation: {client-specific-takeaway-from-talking-points}.

I'd like to spend 15 minutes confirming our strategy before
{deadline-date}. Best time?

— {firmName}
```

### 7.3 Overflow

- Dismiss with reason
- Snooze 7d / 14d / until-deadline
- Share (copy link)

---

## 8. Edge cases

| Case | Behavior |
|------|---------|
| Client has multiple entities with different election statuses | Show one row per entity; group under client name in nested format |
| State opts ALL eligible entities into PTE automatically (LA-style) | Talking points emphasize "auto-applied — verify acceptance"; no opt-in pitch |
| Election deadline passes before Sarah schedules call | Tag the alert as `EXPIRED-WITHOUT-ACTION`; surface in `/alerts?filter=expired-pte` for retro review |
| Alert detected mid-tax-year (after current-year election locked) | Talking points pivot to "next-year planning"; deadline copy adjusts to "for 2027 tax year" |
| Client has pending PTE election that hasn't yet been confirmed by state | Annotation: `[election filed Mar 5, 2026 — pending confirmation]` |
| Multiple states have PTE in the alert's scope (rare, e.g., federal proposal) | Render once but talking points per-state per-client |
| Entity is in process of restructuring (LLC → S-Corp, etc.) | Annotation: `[entity restructuring — verify post-conversion eligibility]` |
| Client preferences set to "no phone calls" | Primary verb defaults to email-draft for that client; phone bullet excluded from talking points |

---

## 9. State diagram

Alert level: same as disaster_extension (PENDING/ACTED/SNOOZED/DISMISSED/EXPIRED).

Per-client `planning_calls` lifecycle:

```
PROPOSED → SCHEDULED (Sarah picks a time)
         → COMPLETED (outcome: renewed | revoked | opted-in | deferred)
         → MISSED (deadline passed, never scheduled)
         → CANCELED (Sarah cancels this conversation)
```

Each transition writes an `activity_events` entry.

---

## 10. BE data contract

### `trpc.announcements.detailWithAffected({ announcementId })`

```typescript
{
  announcement: {
    // ...shared fields
    alertType: 'pte_change';
    state: StateCode;
    changeKind: 'deadline_shift' | 'rate_change' | 'mechanics' |
                'eligibility_expansion' | 'eligibility_contraction' |
                'sunset' | 'sunset_extension' | 'other';
    summary: string;
    effectiveDate: ISODate;
    affectedTaxYears: number[];      // [2026] or [2026, 2027] etc.
    nextElectionDeadline: ISODate | null;
    oldRule: string | null;          // human-readable old value
    newRule: string;                 // human-readable new value
  };

  affected: Array<{
    client: {
      id, name, entityType, primaryState,
      preferredContactMethod: 'phone' | 'email' | 'mail' | 'text';
      lastContactedAt: ISODate | null;
      pteElectionYear: number | null;     // when they last elected
      pteEligibilityStatus: 'elected' | 'eligible_not_elected' |
                            'not_eligible' | 'lapsed';
    };
    talkingPoints: string[];          // 3-5 bullets, Mode E generated
    estimatedImpact: string | null;   // optional $ savings projection
    bestContactNote: string;          // "phone (last call Mar 14)" etc.
  }>;

  notAffected: Array<{
    client: { id, name, entityType, primaryState };
    reason: 'wrong_state' | 'wrong_entity_type' | 'no_pte_eligibility';
  }>;
}
```

### `trpc.announcements.schedulePlanningCalls({ announcementId, clientIds, callType })`

```typescript
{
  announcementId: string;
  clientIds: string[];
  callType: 'pte_strategy' | 'rate_change' | 'general_planning';
}
```

Returns:
```typescript
{
  callsCreated: number;
  todoItemsAdded: number;
}
```

### Tag schema (planning_calls)

```sql
CREATE TABLE planning_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  alert_id uuid NOT NULL REFERENCES announcements(id),
  topic text NOT NULL,
  call_type text NOT NULL,
  talking_points_json jsonb NOT NULL,
  suggested_window_start date,
  suggested_window_end date,
  scheduled_at timestamptz,
  completed_at timestamptz,
  outcome text,                     -- 'renewed' | 'revoked' | 'opted-in' | 'deferred' | null
  outcome_notes text,
  status text NOT NULL DEFAULT 'proposed',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 11. Copy

| Element | Copy |
|---------|------|
| Browser tab | `"{State} · PTE change · DueDateHQ"` |
| Verdict header | `"Affecting {N} of your {totalActive} clients"` |
| Verdict subhead | `"These clients have an active {state} PTE election or are PTE-eligible. Schedule a conversation before {deadline}."` |
| Verdict header (N=0) | `"None of your clients have a PTE election active in {state}."` |
| Primary verb | `"Schedule planning calls for {N} clients"` |
| Secondary verb | `"Draft {N} planning emails"` |
| Confirmation flash | `"{N} calls flagged on Today queue · Open queue"` |
| Status chip: elected | `PTE-elected since {year}` (info-tone) |
| Status chip: eligible | `ELIGIBLE BUT NOT YET ELECTED` (warn-tone — opportunity flag) |
| Status chip: not eligible | `NOT ELIGIBLE` (neutral) |
| Status chip: lapsed | `PRIOR-YEAR ELECTION (LAPSED)` (warn-tone) |
| Talking points heading | `Talking points:` |
| Best contact line | `Best contact: {method} ({last contact note})` |
| Empty state CTA | `"Dismiss with reason"` |

**Tone**: planning-oriented, advisory. Not urgent. Sarah's job here is conversation prep, not deadline triage.

---

## 12. Telemetry

| Event | When | Payload |
|-------|------|---------|
| `alert_viewed` (pte_change) | Page mount | shared |
| `planning_calls_scheduled` | After batch action | `{ announcementId, callCount }` |
| `planning_call_completed` | When Sarah marks call done | `{ callId, outcome, daysFromCreation }` |
| `planning_call_missed` | Cron job, deadline passed | `{ callId, daysFromCreation }` |

Goal: measure (a) call completion rate, (b) outcome distribution (renew vs revoke vs opt-in), (c) time-to-schedule.

---

## 13. What's NOT in scope

- **Actually filing the PTE election form** — Form 3804 / 587 / etc. live on TaskDetail in their own deadline rows; this alert just flags clients to talk to.
- **Auto-applying the new rule across the catalog** — e.g., "shift all CA PTE deadlines automatically." Too risky. Each client decision is per-conversation.
- **Calendar integration** — P2; for now, TodoItem on Today is the surface. Sarah manages calendar externally.
- **PTE benefit calculator** — useful but separate Mode E concern. This alert doesn't try to recompute every client's potential savings.
- **Multi-year election tracking** — clients with binding multi-year elections are flagged but full lifecycle (annual renewals, mid-stream revocations) is in client.pte_history JSON.

---

## 14. Build order

| Phase | Work | Effort |
|-------|------|--------|
| 1 | Schema: `planning_calls` table + `clients.pte_election_year`, `pte_eligibility_status` columns | S |
| 2 | BE: pte-eligibility computation logic (state-by-state rules in a config table) | M |
| 3 | BE: `schedulePlanningCalls` procedure + Mode E talking points generator | M |
| 4 | FE: VerdictSection variant — status chip, expandable talking points, contact icons | M |
| 5 | FE: TodoItem rendering for "schedule call with X" + outcome capture | S |
| 6 | FE: ClientDetail PTE status indicator (Workspace tab) | S |
| 7 | Telemetry events | XS |
| 8 | E2E test | S |

Estimated total: ~2 sprints solo.

---

_End of pte_change spec._
