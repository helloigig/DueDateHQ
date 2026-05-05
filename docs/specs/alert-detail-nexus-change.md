# AlertDetail — `nexus_change` Action Spec

_Companion to [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md). Scope: `/alerts/:id` for alertType=`nexus_change`._

---

## 1. Real-world context

State tax nexus rules govern when an out-of-state business owes tax in a state. Post-_South Dakota v. Wayfair_ (2018), states have aggressively expanded **economic nexus** thresholds. The landscape is messy and changes frequently.

**Three flavors of state nexus**:

| Type | What | Trigger threshold |
|------|------|-------------------|
| **Sales tax** | Must collect/remit state sales tax | typically $100K revenue OR 200 transactions in state (post-Wayfair); some states $500K (CA, TX) |
| **Income tax** | Must file state corporate / passthrough return | varies — economic presence, factor presence (FL: $50K sales / $50K property / $50K payroll / 25% factor), PL 86-272 (federal floor) |
| **Payroll** | Must register, withhold, file SUTA | based on # employees in state, days worked in state, or gross wages |

**Common nexus changes**:

- **Threshold changes** (most common): "TX raises franchise tax no-tax-due threshold from $1.23M to $2.47M" → some clients no longer owe
- **Threshold lowering**: "PA reduces sales-tax economic nexus to $100K (was $200K)" → more clients owe
- **Convenience-of-employer rules** (NY, PA, DE, NE, AR): non-residents working remotely for in-state employers owe state income tax
- **Marketplace facilitator laws**: Amazon/Etsy/Shopify must collect on behalf of sellers — small sellers' direct nexus often reduced
- **PL 86-272 erosion**: states (CA, NY) issuing guidance that traditional protections don't cover digital activity (cookies, downloads)
- **Transient worker rules**: NY taxes wages for 14+ days of work in-state by non-residents
- **Telework taxation** (post-COVID): state guidance on remote employees' nexus impact

The pipeline catches state-DOR notices announcing these changes and matches each to clients whose **observed activity** (revenue in state, employees in state, transactions in state) plausibly meets the new threshold.

This is a **discovery** alert — Sarah needs to figure out who actually has nexus (often requires a few questions per client), then add the corresponding state filings.

## 2. Real examples

| State | Notice | Direction | Implication |
|-------|--------|-----------|-------------|
| TX | "Franchise tax no-tax-due threshold raised from $1.23M to $2.47M" | contraction | Some TX clients no longer owe; review for filing removal |
| PA | "Economic nexus threshold lowered to $100K (was $200K)" | expansion | More PA-touching clients now owe sales tax |
| CA | "Public Law 86-272 doesn't shield digital sellers — guidance" | expansion | Web-only sellers with CA cookies / downloads now owe income tax |
| NY | "Convenience-of-employer rule clarified for hybrid workers" | expansion | Some remote workers' wages newly taxable in NY |
| WA | "Marketplace facilitator threshold raised to $250K" | contraction | Smaller marketplace sellers' nexus reduced |
| NJ | "Telework taxation — remote employees create employer nexus" | expansion | Many out-of-state employers now owe NJ payroll obligations |

**Direction matters** for the UX:
- **Expansion**: "you now owe more" — primary action is "Add suggested filings for N clients"
- **Contraction**: "you may no longer owe" — primary action is "Review for removal of N filings" (different verb)

## 3. The CPA's job

Sarah's mental model: "verify nexus, then add (or remove) state filings."

She does NOT need to:
- Move existing deadlines (no automatic deadline shift)
- Recompute amounts (estimates aren't recomputed by nexus alerts — those are `rate_change`)
- Schedule a planning conversation (usually)

She DOES need to:
- For each potentially-affected client, run a quick nexus check (4–5 yes/no questions specific to the state's new rules)
- Decide which clients actually have nexus (yes / no / borderline)
- For "yes" clients: add new state filings (income, sales, payroll, as relevant)
- For "no" clients: dismiss with reason (no nexus established)
- For "borderline" clients: flag for follow-up conversation

This drives the action shape: **per-client nexus check → batch-add filings**.

---

## 4. Page anatomy (expansion case — "you may now owe more")

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│  ← Alerts · PA DOR · nexus_change · Detected 3h             │
│  Economic nexus threshold lowered to $100K (was $200K)      │
│  Effective Jul 1, 2026 · Sales tax                           │
│  [Source: revenue.pa.gov/notice ↗] [Authority: PA DOR]      │
├─────────────────────────────────────────────────────────────┤
│ VERDICT (info-toned, "verify nexus" caveat)                  │
│  Possibly affecting 5 of your 49 clients (verify nexus)     │
│  Run nexus check per client. Then add applicable filings.   │
│  [Select all] [Clear all]                                    │
│                                                              │
│  ☑ Acme LLC (S-Corp · CA · est. PA revenue $145K)     ⚠ ▾  │
│       Activity signals:                                      │
│         · Estimated PA revenue: $145K (above $100K threshold)│
│         · Marketplace sales: $45K (Amazon FBM)              │
│         · No prior PA filings on record                     │
│       Suggested filings to add:                              │
│         ☑ PA REV-72 — Sales tax registration                │
│         ☑ PA-3 — Quarterly sales tax remittance             │
│         ☐ PA Corp Tax (informational — verify income nexus) │
│       [Run nexus check (4 questions) ▸]                      │
│                                                              │
│  ☑ Bob Williams Construction (LLC · TX · est. PA $190K)⚠ ▾ │
│       Activity signals:                                      │
│         · Estimated PA revenue: $190K                       │
│         · 1099 contractors in PA: 3                         │
│         · Prior PA filings: yes (sales tax 2024 filed)      │
│       Suggested filings to add:                              │
│         ☑ PA REV-1 — Annual sales tax return (catch-up)    │
│         ☐ PA-W3 — Withholding for PA contractors            │
│       [Run nexus check (3 questions) ▸]                      │
│                                                              │
│  ☑ Carol Reyes (Individual · CA · borderline) — $98K   ✗ ▾ │
│       Activity signals:                                      │
│         · Estimated PA revenue: $98K (below $100K threshold)│
│         · No marketplace sales                              │
│       Suggested filings: none (below threshold)             │
│       [Run nexus check (5 questions) ▸] [Dismiss this row]  │
├─────────────────────────────────────────────────────────────┤
│ NOT AFFECTED (24 clients) ▸                                  │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE ▸                                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR                                            │
│  [Primary] Add suggested filings for 5 clients              │
│  [Secondary] Notify 5 clients (no filings yet)              │
│  [Overflow ⋮] Dismiss · Snooze · Share                      │
└─────────────────────────────────────────────────────────────┘
```

## 5. Page anatomy (contraction case — "you may no longer owe")

```
┌─────────────────────────────────────────────────────────────┐
│ VERDICT (info-toned)                                         │
│  Possibly removable: 3 filings across 2 clients (verify)    │
│  Review existing filings — these clients may no longer      │
│  meet TX franchise tax thresholds.                           │
│                                                              │
│  ☑ Lone Star Logistics (Partnership · TX · revenue $1.8M) ▾ │
│       Existing filings (in scope):                           │
│         ☐ Form 05-158 — Franchise tax (annual)              │
│       Activity signals:                                      │
│         · 2025 TX revenue: $1.8M (below new $2.47M threshold)│
│         · Currently filing no-tax-due                       │
│       [Confirm no longer required ▸] [Keep as protective]   │
│                                                              │
│  ☑ Patel Holdings (LLC · TX · revenue $2.1M)                │
│       Existing filings (in scope):                           │
│         ☐ Form 05-158 — Franchise tax (annual)              │
│         ☐ Form 05-102 — Public information report           │
│       [Confirm no longer required ▸] [Keep as protective]   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR (contraction)                              │
│  [Primary] Review for removal (3 filings)                    │
│  [Secondary] Mark all as "keep protective"                   │
│  [Overflow ⋮] Dismiss · Snooze · Share                      │
└─────────────────────────────────────────────────────────────┘
```

The contraction case is a **fundamentally different verb**. Removing filings has bigger downside risk than adding (you might remove a filing the client actually still owes). Default to "Keep as protective" unless explicitly confirmed.

## 6. Header

Subtitle template:

`"{rule-summary}. Effective {date} · {tax}."`

Examples:
- "Economic nexus threshold lowered to $100K (was $200K). Effective Jul 1, 2026 · Sales tax."
- "Franchise tax no-tax-due threshold raised from $1.23M to $2.47M. Effective 2026 · Franchise."
- "Convenience-of-employer rule clarified for hybrid workers. Effective Jan 1, 2026 · Income."

## 7. Verdict section (expansion)

### 7.1 Headline

```
Possibly affecting 5 of your 49 clients (verify nexus)
Run nexus check per client. Then add applicable filings.
```

The "(verify nexus)" caveat is **non-negotiable**. Every nexus alert is a guess based on activity signals — it requires Sarah's per-client confirmation. Removing the caveat would mislead.

If 0 clients potentially affected:
```
None of your clients show activity in {state} that would create nexus.
[Dismiss with reason] [Open source ↗]
```

### 7.2 Per-client expandable row

Each row shows:

```
☑ Acme LLC (S-Corp · CA · est. PA revenue $145K)     ⚠ ▾
```

Slots:

| Slot | Content | Notes |
|------|---------|-------|
| Checkbox | per-client toggle | Pre-checked for high-confidence matches |
| Name | `client.name` | Click → ClientDetail |
| Metadata | `entityType · primaryState · activity-signal` | The activity signal is the load-bearing detail (why we matched this client) |
| Confidence chip | `⚠` (verify), `🟢` (high confidence), `?` (borderline) | Different from disaster's match-confidence — here it reflects our certainty about nexus, not the alert match |
| Expand caret | toggles open | Reveals activity signals + suggested filings |

Expanded view sections:

**Activity signals** (read-only, derived from client data):

```
Activity signals:
  · Estimated PA revenue: $145K (above $100K threshold)
  · Marketplace sales: $45K (Amazon FBM)
  · No prior PA filings on record
```

This is the BE's summary of "why we think this client might have nexus." Sources include:
- `client.estimated_state_revenue[state]` — from QBO sync or manual import
- `client.employee_count_by_state[state]` — from payroll data
- Prior filings in the state (presence implies established nexus — should usually keep)
- Marketplace activity flags (Amazon, Etsy, Shopify integrations)

**Suggested filings to add**:

```
Suggested filings to add:
  ☑ PA REV-72 — Sales tax registration
  ☑ PA-3 — Quarterly sales tax remittance
  ☐ PA Corp Tax (informational — verify income nexus)
```

Per-filing slots:

| Slot | Content | Notes |
|------|---------|-------|
| Checkbox | per-filing toggle | Pre-checked when high-confidence; unchecked when "verify income nexus" caveat |
| Form name | `filing.formName` | Includes form code + plain-English description |
| Caveat chip | optional `[informational — verify]` | When the suggested filing is borderline |

**Run nexus check button**:

```
[Run nexus check (4 questions) ▸]
```

Opens a per-state nexus questionnaire (4–6 yes/no questions specific to the alert's rule). Example for PA sales tax expansion:

1. Did the client deliver tangible goods to PA addresses in 2025? (Y/N)
2. Did the client provide services to PA-based customers? (Y/N)
3. Did the client use a marketplace facilitator (Amazon, Etsy) for PA sales? (Y/N)
4. Does the client have a PA sales tax license? (Y/N)

Answers determine: yes-with-confidence / no / borderline. Updates the per-client confidence chip + suggested filings list.

### 7.3 "Not affected" section (collapsed)

For nexus alerts, this is unusually important. It lists clients who *could* have been affected but were filtered out, with the reason:

```
Eve Chen (Individual · GA)             — no PA activity on record
Frank Wong (LLC · CA)                  — already files PA quarterly
Grace Lee (Individual · NY)            — below activity threshold
```

"Add to affected" override surfaces the row for nexus check. Especially useful when AI's signal data is incomplete (no QBO sync = no revenue estimate = no auto-match).

---

## 8. Verdict section (contraction)

Different verb shape entirely. The **filings-to-remove list** replaces the suggested-filings list:

```
Existing filings (in scope):
  ☐ Form 05-158 — Franchise tax (annual)
```

Each filing has a checkbox + two action chips per filing:

- **`Confirm no longer required`** — marks deadline as removable; primary verb collects all confirmations into a batch
- **`Keep as protective`** — flags filing as deliberately kept despite no longer required (audit trail)

The default is "neither chip pressed" — Sarah must explicitly choose. We don't auto-recommend removal because the downside is too high.

---

## 9. Action bar

### 9.1 Primary — `"Add suggested filings for N clients"` (expansion case)

The discovery → addition action.

**Pre-condition**: at least one client must have completed nexus check OR explicitly confirmed nexus (chip = high-confidence). Otherwise primary is disabled with tooltip "Run nexus check to confirm before adding filings."

Actually, this is a default we relax: Sarah can override and add anyway (some CPAs are confident enough not to need the check). UX: primary is clickable, but if no checks have run, surface a confirmation modal: "You haven't run nexus checks. Add filings anyway?"

**On click**:

1. Optimistic UI: action bar shows "Adding 12 filings…"
2. BE call: `trpc.announcements.addNexusFilings({ announcementId, selections })`
3. BE in transaction:
   - For each selected (clientId, formCode) pair: INSERT INTO `deadlines` with form, jurisdiction (the alert's state), due date computed from current period
   - For each: INSERT INTO `client_state_nexus (client_id, state, established_at, alert_id, established_by)` to mark nexus officially recognized
   - Insert activity events
4. FE flash: `"12 filings added across 5 clients · Undo (24h)"`

**Undo window: 24h** (longer than disaster_extension's 5min) because adding filings has compounding downstream effects — Sarah might realize within hours that one client's nexus check should've come back negative.

### 9.2 Primary — `"Review for removal (N filings)"` (contraction case)

Different verb shape. Opens a per-filing confirmation modal where Sarah explicitly confirms each removal with a reason ("client below new threshold").

**On click**:
- Show modal listing filings + each with a confirmation checkbox + reason field
- "Mark all as no longer required" or "Keep all as protective" or per-row choice
- Confirm → batch-update `deadlines.protected_after_filing_year` (so the deadline appears once more, then auto-disables)

**No outright deletion**. Always one more filing year served, then disable. This is a safety net.

### 9.3 Secondary — `"Notify N clients (no filings yet)"`

For when Sarah wants to surface the change to clients before doing the nexus checks. Composes informational email:

```
Subject: {state} just changed nexus rules — heads up

Hi {client.firstName},

{state} just announced a change to nexus rules: {summary}.

Based on activity I'm aware of, this {may | likely will | won't}
affect your filings. I'll review and follow up.

— {firmName}
```

### 9.4 Overflow

- Dismiss with reason (per-alert, not per-client)
- Snooze 7d / 14d / `until-effective-date`
- Share

---

## 10. Edge cases

| Case | Behavior |
|------|---------|
| Client has prior filings in the state already | Confidence chip = high (nexus already established); skip nexus check; add new-filing types only if the alert introduces new ones |
| Client crossed threshold mid-year | Annotation `[mid-year nexus established — back-file may be required]`; suggest catch-up filing in addition to current |
| Marketplace facilitator already collects on client's behalf | Annotation `[marketplace facilitator: Amazon — direct registration may not be required]`; soft suggestion to verify |
| Convenience-of-employer rule case | Annotation `[per-employee analysis required]`; surface employee-by-employee breakdown in expansion |
| PL 86-272 protection question | Annotation `[PL 86-272 — verify activity scope]`; nexus check includes PL 86-272 questions |
| Multi-state nexus (alert touches multiple states) | Render once per state; client appears multiple times if matched in multiple states |
| Nexus check answers contradict signal data | Trust nexus check; downgrade confidence; surface mismatch in evidence panel |
| Client recently restructured (LLC → S-Corp) | Annotation `[entity restructure mid-year — re-verify nexus per entity]` |
| Client has pending filing for the state already | Dedupe — don't suggest the same form twice |
| Effective date in past (retroactive) | Annotation `[retroactive — back-file required]`; suggested filings include catch-up |
| Effective date in future (>30 days) | Snooze to effective date by default |
| Threshold based on transactions count, not revenue | Activity signal shows transaction count; nexus check questions adapt |

---

## 11. State diagram

Alert level: shared.

Per-client `client_state_nexus` lifecycle:

```
NOT_ESTABLISHED → CHECK_PENDING (nexus check started, not finished)
                → ESTABLISHED (filings added)
                → BORDERLINE (check inconclusive — flag for next review cycle)
                → CONFIRMED_NO_NEXUS (check returned no)
```

Per-filing additions write to `deadlines` (existing table). Removals (contraction) flag `protected_after_filing_year` on existing deadlines.

---

## 12. BE data contract

### `trpc.announcements.detailWithAffected({ announcementId })`

```typescript
{
  announcement: {
    // ...shared
    alertType: 'nexus_change';
    state: StateCode;
    nexusKind: 'sales' | 'income' | 'payroll' | 'franchise';
    direction: 'expansion' | 'contraction';
    oldRule: string;
    newRule: string;
    effectiveDate: ISODate;
    isRetroactive: boolean;
  };

  // For expansion case
  affected: Array<{
    client: {
      id, name, entityType, primaryState,
      estimatedStateRevenue: Record<StateCode, number>;
      employeeCountByState: Record<StateCode, number>;
      hasMarketplaceFacilitator: boolean;
      priorStateFilings: StateCode[];
    };
    matchSignals: string[];           // ["Estimated PA revenue: $145K", ...]
    nexusCheckStatus: 'not_run' | 'pending' | 'established' | 'borderline' | 'no_nexus';
    suggestedFilings: Array<{
      formCode: string;
      formName: string;
      jurisdiction: StateCode;
      confidence: 'high' | 'medium' | 'low';
      caveat: string | null;          // "verify income nexus" etc.
    }>;
    nexusQuestions: Array<{           // for the questionnaire
      id: string;
      question: string;
      type: 'yes_no';
    }>;
  }>;

  // For contraction case
  removable: Array<{
    client: { id, name, entityType, primaryState };
    activitySignals: string[];
    existingFilings: Array<{
      deadlineId: string;
      formCode: string;
      formName: string;
      currentDueDate: ISODate;
    }>;
  }>;

  notAffected: Array<{
    client: { id, name, entityType, primaryState };
    reason: string;
  }>;
}
```

### `trpc.announcements.runNexusCheck({ announcementId, clientId, answers })`

```typescript
{
  announcementId: string;
  clientId: string;
  answers: Record<string, boolean>;   // questionId → yes/no
}
```

Returns:
```typescript
{
  status: 'established' | 'borderline' | 'no_nexus';
  confidence: 'high' | 'medium' | 'low';
  recommendedFilings: string[];      // formCodes
  reason: string;
}
```

### `trpc.announcements.addNexusFilings({ announcementId, selections })`

```typescript
{
  announcementId: string;
  selections: Array<{
    clientId: string;
    filings: Array<{ formCode: string; jurisdiction: StateCode; }>;
  }>;
}
```

Returns:
```typescript
{
  filingsAdded: number;
  clientsAffected: number;
  undoToken: string;
  expiresAt: timestamp;             // 24h
}
```

### `trpc.announcements.markFilingsProtective({ announcementId, deadlineIds, reason })`

For contraction case. Marks deadlines as kept-as-protective.

---

## 13. Copy

| Element | Copy |
|---------|------|
| Browser tab | `"{State} · Nexus change · DueDateHQ"` |
| Subtitle | `"{rule-summary}. Effective {date} · {nexusKind}."` |
| Verdict header (expansion) | `"Possibly affecting {N} of your {totalActive} clients (verify nexus)"` |
| Verdict subhead (expansion) | `"Run nexus check per client. Then add applicable filings."` |
| Verdict header (contraction) | `"Possibly removable: {N} filings across {M} clients (verify)"` |
| Verdict subhead (contraction) | `"Review existing filings — these clients may no longer meet thresholds."` |
| Verdict header (N=0) | `"None of your clients show activity in {state} that would create nexus."` |
| Confidence chip: high | `🟢` |
| Confidence chip: verify | `⚠` |
| Confidence chip: borderline | `?` |
| Activity signals heading | `Activity signals:` |
| Suggested filings heading | `Suggested filings to add:` |
| Existing filings heading | `Existing filings (in scope):` |
| Run nexus check button | `Run nexus check ({N} questions) ▸` |
| Primary verb (expansion) | `"Add suggested filings for {N} clients"` |
| Primary verb (contraction) | `"Review for removal ({N} filings)"` |
| Secondary verb (expansion) | `"Notify {N} clients (no filings yet)"` |
| Secondary verb (contraction) | `"Mark all as 'keep protective'"` |
| Confirmation flash (expansion) | `"{N} filings added across {M} clients · Undo (24h)"` |
| Confirmation flash (contraction) | `"{N} filings flagged for one-more-year-then-disable · Undo (24h)"` |
| Filing caveat | `[informational — verify {scope}]` |
| Annotation: prior filings | `[client already files in {state}]` (info-tone) |
| Annotation: marketplace | `[marketplace facilitator: {provider}]` (info-tone) |
| Annotation: borderline | `[just below threshold]` (warn-tone) |
| Annotation: retroactive | `[retroactive — back-file required]` (warn-tone) |
| Empty state CTA | `"Dismiss with reason"` |

**Tone**: cautious, hedged. Every claim is qualified with "verify" / "possibly" / "may." Sarah must NEVER feel like the system is pushing her into adding filings without her judgment.

---

## 14. Telemetry

| Event | When | Payload |
|-------|------|---------|
| `alert_viewed` (nexus_change) | Page mount | `{ direction: 'expansion' | 'contraction', isRetroactive }` |
| `nexus_check_completed` | Per-client questionnaire completion | `{ clientId, status, answersCount }` |
| `filings_added_from_nexus` | Batch add | `{ announcementId, filingCount, clientCount, anyChecksRun: bool }` |
| `filings_removed_from_nexus` | Batch contract | `{ announcementId, filingCount, clientCount }` |
| `filings_kept_protective` | Mark-protective | `{ filingCount, clientCount }` |

Goal: measure (a) nexus check completion rate (proxy for "Sarah used the questionnaire vs guessed"), (b) filings-added vs filings-skipped ratio, (c) for contraction case: protective vs remove ratio (most should be remove if signal is good).

---

## 15. What's NOT in scope

- **Auto-determining nexus from activity signals alone** — too risky; the questionnaire is the gate.
- **Bulk nexus check across all states** ("show me everywhere this client might owe") — useful, but a separate Mode E reporting concern.
- **State-by-state nexus rule database editing** — admin-curated config; not a per-firm concern.
- **Filing the registration form itself** — out of pipeline; Sarah handles registration manually after the alert adds the deadline.
- **Calculating prior-period back tax owed** — not done here. Adding the catch-up filing is enough; the back-tax computation is per-client work.
- **PL 86-272 deep analysis** — questionnaire surfaces it, Sarah judges. We don't try to be a PL 86-272 expert system.

---

## 16. Build order

| Phase | Work | Effort |
|-------|------|--------|
| 1 | Schema: `client_state_nexus` table; `deadlines.protected_after_filing_year` column | S |
| 2 | BE: nexus questionnaire schema + per-state question config (PA, TX, CA, NY, NJ priority) | L (one-time data entry per state's nexus rules) |
| 3 | BE: activity signal computation (revenue by state, employees by state) — needs QBO sync extension | L |
| 4 | BE: `runNexusCheck`, `addNexusFilings`, `markFilingsProtective` procedures | M |
| 5 | FE: VerdictSection variant (expansion + contraction) — confidence chips, activity signals, suggested filings | L |
| 6 | FE: NexusCheckModal — questionnaire UI per client | M |
| 7 | FE: Contraction-mode action bar (different verb shape) | S |
| 8 | Telemetry events | XS |
| 9 | E2E test: alert → run check on 1 client → add filings → confirm new deadlines | M |

Estimated total: ~3–4 sprints solo (state-by-state question config is the big one).

---

_End of nexus_change spec._
