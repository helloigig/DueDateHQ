# AlertDetail — `rate_change` Action Spec

_Companion to [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md). Scope: `/alerts/:id` for alertType=`rate_change`._

---

## 1. Real-world context

Tax rates change all the time:

- **Federal income brackets** — TCJA inflation adjustments annual; TCJA expiration looming for 2026 (top rate may revert from 37% to 39.6%); ARPA-style adjustments
- **State income tax** — bracket reforms (AZ moved to flat 2.5% in 2023; MA added 4% surtax on income >$1M in 2023)
- **State sales tax rates** — city, county, district-level changes; effective on quarter boundaries usually
- **Withholding rates** — quarterly W-4 calc updates, employer-specific rates
- **Payroll** — FUTA wage base, SUTA per-state rates (annual)
- **Excise** — fuel, alcohol, cannabis, lodging — each with its own rate schedule
- **Property** — assessment rolls + millage rates (county-level, annual)
- **Capital gains** — rare but federal threshold changes affect Q-estimates

Most rate changes have a **deterministic mathematical effect**: every dollar of taxable income now produces a different tax. For Sarah's clients with active estimates, that means **the next Q-estimate amount is wrong** until recomputed.

This makes `rate_change` a **computational** alert type. The math is mechanical, the action is to recompute. Sarah's judgment enters when:
- Client is on auto-pay (recompute requires updating bank instruction)
- Estimate already paid for the affected period (apply credit forward vs file refund)
- Client has unusual situation (loss carryforwards, timing differences)

## 2. Real examples

| Source | Notice | Computational impact |
|--------|--------|----------------------|
| IRS | "2026 inflation adjustments — top bracket threshold $626,350 (was $609,351)" | All Q-estimates for high-income clients must recompute |
| AZ DOR | "Flat 2.5% income tax effective 2026" | Every AZ Q-estimate recomputes (was graduated brackets up to 4.5%) |
| MA DOR | "Surtax on income >$1M effective 2023 returns" | Q-estimates for high-income MA clients gain a 4% surtax on excess |
| NY DTF | "Sales tax rate change in Kings County effective Q2 2026" | Sales tax estimates for Kings County clients recompute |
| Various | "Withholding rate update following federal change" | All payroll-tied clients recompute SUTA/W-4 |
| WA DOR | "B&O tax rate change for service businesses" | B&O estimates for WA service businesses recompute |

## 3. The CPA's job

Sarah's mental model: "math changed; recompute and tell affected clients."

She does NOT need to:
- Move any deadlines (estimate dates don't change with rate changes — only amounts)
- File anything immediately
- Schedule a planning conversation (rate changes usually don't need one — it's mechanical)

She DOES need to:
- Identify clients with active estimates for the affected tax
- Recompute the next estimate amount
- Notify clients whose estimates change materially (vs trivially)
- Handle edge cases (auto-pay, estimates already paid)

This drives the action shape: **batch recompute + notify**.

---

## 4. Page anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│  ← Alerts · IRS · rate_change · Detected 1h                 │
│  2026 inflation adjustments — top bracket threshold         │
│  $626,350 (was $609,351)                                     │
│  Effective Jan 1, 2026 · Affects 2026 Q-estimates           │
│  [Source: irs.gov/2026-inflation ↗] [Authority: IRS]         │
├─────────────────────────────────────────────────────────────┤
│ VERDICT (info-toned)                                         │
│  Affecting 12 of your 49 clients · 38 estimate calcs        │
│  Recompute Q-estimates affected by the new bracket.         │
│  [Select all] [Clear all]                                    │
│                                                              │
│  ☑ Acme LLC (S-Corp · CA · est. AGI $850K)            4 ▾  │
│       Estimate impact preview:                               │
│         · Q1 (Apr 15)  paid $42,500 → $42,500 [paid]       │
│         · Q2 (Jun 16)  est $42,500 → $43,800 (+$1,300)     │
│         · Q3 (Sep 15)  est $42,500 → $43,800 (+$1,300)     │
│         · Q4 (Jan 15)  est $42,500 → $43,800 (+$1,300)     │
│       Auto-pay: enabled — bank instruction must update     │
│                                                              │
│  ☑ Bob Williams (Individual · NY · est. AGI $1.4M)    3 ▾  │
│       Estimate impact preview:                               │
│         · Q1 (paid)                                          │
│         · Q2 → +$2,100 (state surtax cascade)               │
│         · Q3 → +$2,100                                       │
│         · Q4 → +$2,100                                       │
│       Note: NY surtax also triggered — cascading impact     │
│                                                              │
│  ☑ Carol Reyes (Individual · NY · est. AGI $400K)     2 ▾  │
│       Estimate impact preview:                               │
│         · Q3 → +$80 (trivial, < $200 threshold)             │
│         · Q4 → +$80                                          │
│       [Skip — change below threshold]                        │
├─────────────────────────────────────────────────────────────┤
│ NOT AFFECTED (10 candidates) ▸                               │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE ▸                                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR                                            │
│  [Primary] Recompute 38 estimates                           │
│  [Secondary] Recompute + draft 12 emails                    │
│  [Overflow ⋮] Dismiss · Snooze · Share                      │
└─────────────────────────────────────────────────────────────┘
```

## 5. Header

Subtitle template: `"{change-summary}. Effective {date} · Affects {scope}."`

Examples:
- "2026 inflation adjustments — top bracket threshold $626,350 (was $609,351). Effective Jan 1, 2026 · Affects 2026 Q-estimates."
- "AZ flat 2.5% income tax. Effective Jan 1, 2026 · Affects AZ resident estimates."
- "Kings County sales tax rate change. Effective Apr 1, 2026 · Affects Q2 onward."

## 6. Verdict section

### 6.1 Headline

```
Affecting 12 of your 49 clients · 38 estimate calcs
Recompute Q-estimates affected by the new bracket.
```

The two numbers (clients vs estimates) clarify scope — analogous to disaster_extension's "12 clients · 38 deadlines moving."

If 0 clients affected:
```
None of your clients have active estimates affected by this rate change.
[Dismiss with reason] [Open source ↗]
```

### 6.2 Per-client expandable rows

Each row collapsed to summary, expandable to per-estimate breakdown:

```
☑ Acme LLC (S-Corp · CA · est. AGI $850K)            4 ▾
```

Slots:

| Slot | Content | Notes |
|------|---------|-------|
| Checkbox | per-client toggle | Pre-checked |
| Name | `client.name` | Click → ClientDetail |
| Metadata | `entityType · primaryState · estimated AGI bracket` | AGI is the most relevant signal for income-tax rate changes |
| Count chip | Number of estimates that will recompute | "4" = 4 quarterly estimates within the affected period |
| Expand caret | toggles open | Reveals per-estimate impact |

Expanded view shows each estimate:

```
Estimate impact preview:
  · Q1 (Apr 15)  paid $42,500 → $42,500 [paid]
  · Q2 (Jun 16)  est $42,500 → $43,800 (+$1,300)
  · Q3 (Sep 15)  est $42,500 → $43,800 (+$1,300)
  · Q4 (Jan 15)  est $42,500 → $43,800 (+$1,300)
```

Per-estimate slots:

| Slot | Content | Notes |
|------|---------|-------|
| Checkbox | per-estimate toggle | Auto-unchecked for `[paid]` and `[< threshold]` cases |
| Period | "Q1 (Apr 15)" | Period name + due date |
| Old amount → new amount | `$X → $Y (±$Z)` | Old strikethrough; delta in parens |
| Annotation chip | `[paid]`, `[< threshold]`, `[auto-pay]`, `[loss carryforward]` | Greyed when excluded |

### 6.3 Material change threshold

Trivial deltas should be excluded by default to avoid notification fatigue:

- Default threshold: **$200 cumulative annual delta**
- Below threshold: pre-uncheck, annotation `[change below threshold]`, hint `"Skip — annual change of $X"`
- Above threshold: pre-check
- Sarah can override per-estimate

The threshold is configurable per-firm (`firm.material_estimate_threshold` — defaults to 200).

### 6.4 Auto-pay annotation

When client has auto-pay enabled (`client.estimate_autopay = true`), the row gets a banner:

```
Auto-pay: enabled — bank instruction must update
```

Recompute alone won't change what the bank pulls. Sarah needs to:
1. Recompute the new amount in the system
2. Manually update the EFTPS or state direct-pay instruction at the bank

The action bar reflects this: a dual-step "Recompute + flag bank update" verb appears for auto-pay clients (covered in §7).

### 6.5 Cascading impact

Some rate changes ripple. Example: federal bracket change → NY state surtax also triggers (NY's surtax kicks in based on federal-AGI thresholds).

When detected, show:
```
Note: NY surtax also triggered — cascading impact
```

This is informational; the cascade IS computed into the new estimate amount.

---

## 7. Action bar

### 7.1 Primary — `"Recompute N estimates"`

The computational action.

**On click**:

1. Optimistic UI: action bar shows "Recomputing 38 estimates…"
2. BE call: `trpc.announcements.recomputeEstimates({ announcementId, selections })`
3. BE in transaction:
   - For each selected estimate: compute new amount via `estimateCalculator.recompute(deadlineId, newRule)`
   - UPDATE `deadlines SET amount=$new, original_amount=COALESCE(original_amount, amount) WHERE id IN (...)`
   - Insert activity_event per estimate (type='estimate_recomputed', metadata={old, new, ruleApplied, undoToken})
   - For auto-pay clients, INSERT INTO `todo_items (type='update_bank_instruction', client_id, ...)`
4. FE flash: `"38 estimates recomputed · 4 bank-instruction TodoItems queued · Undo (5min)"`

**Undo**: same 5-min window as disaster_extension. Restores from `original_amount`.

### 7.2 Secondary — `"Recompute + draft N emails"`

Recompute + composes per-client email.

**Mode D email template**:

```
Subject: Quick update on your {tax} estimates

Hi {client.firstName},

Heads-up — {jurisdiction} updated the {tax} rate. Your remaining
{year} estimates are now:

  · Q{N} ({date}): ${oldAmount} → ${newAmount}
  ...

Total annual change: ${cumulative-delta}.

{auto-pay-note OR no-action-needed-note}

— {firmName}
```

Auto-pay note: "I'll send EFTPS instructions next week to align your bank."
Manual-pay note: "No action needed — pay the new amount on the next due date."

### 7.3 Overflow

- Dismiss with reason
- Snooze 7d / 14d
- Share

---

## 8. Edge cases

| Case | Behavior |
|------|---------|
| Estimate already paid for the affected period | Pre-uncheck, annotation `[paid]`, action skipped |
| Estimate is below material threshold | Pre-uncheck, annotation `[change below threshold]`, Sarah can override |
| Client has loss carryforward that absorbs delta | Annotation `[loss carryforward — verify computation]`; recompute uses the calculator's loss-aware path |
| Client has fiscal year (not calendar) | Annotation `[fiscal year ending {date}]`; estimate amounts use fiscal-year proration |
| Rate change effective mid-period (e.g., quarter) | Annotation `[mid-period — pro-rated]`; calculator handles via partial-period multiplier |
| Federal change cascades into state surtax | Annotation on affected estimate `[+ state surtax cascade]`; both deltas baked in |
| Client recently restructured (LLC → S-Corp) | Annotation `[entity restructure mid-year]`; flag for manual review (Sarah may opt out of batch) |
| Auto-pay client | TodoItem auto-created post-recompute; secondary verb gains "+ bank instruction" suffix |
| Concurrent edit by another firm member | Optimistic lock; refresh prompt |
| Rate change is retroactive (rare) | Annotation `[retroactive]`; recompute applies to past estimates too; refund-claim TodoItem may be queued |
| Estimate is on a payment plan | Pre-uncheck, annotation `[on payment plan — manual review]` |
| Negative delta (rate dropped) | Same flow; secondary email phrasing adjusts to "your estimate dropped by $X" |

---

## 9. State diagram

Same as disaster_extension at the alert level.

Per-estimate change has its own audit trail in `activity_events`:

```
estimate_recomputed → estimate_recompute_undone (within 5-min window)
                    → estimate_recompute_finalized (after window)
```

`activity_events` records old/new amount + the rule applied + Sarah's user_id.

---

## 10. BE data contract

### `trpc.announcements.detailWithAffected({ announcementId })`

```typescript
{
  announcement: {
    // ...shared
    alertType: 'rate_change';
    taxKind: 'federal_income' | 'state_income' | 'sales' | 'property' |
             'excise' | 'payroll' | 'capital_gains' | 'other';
    jurisdiction: string;
    oldRule: string;             // human-readable
    newRule: string;
    effectiveDate: ISODate;
    affectedPeriods: string[];   // ["Q2 2026", "Q3 2026", "Q4 2026", "Annual 2026"]
    cascadingImpacts: Array<{    // when this rate change ripples to others
      taxKind: string;
      jurisdiction: string;
      summary: string;
    }>;
  };

  affected: Array<{
    client: {
      id, name, entityType, primaryState,
      estimatedAgiBracket: string;        // "high (>$500K)" / "medium" / "low"
      hasAutopay: boolean;
      hasLossCarryforward: boolean;
    };
    matchReason: string;
    estimates: Array<{
      deadlineId: string;
      period: string;                     // "Q1 2026"
      dueDate: ISODate;
      currentAmount: number;
      proposedAmount: number;
      delta: number;                      // signed
      annualizedDelta: number;            // sum across all this client's estimates for the year
      excludeReason: 'paid' | 'below_threshold' | 'on_payment_plan' |
                     'restructure' | null;
      annotations: string[];              // ["mid-period — pro-rated", "+ state surtax cascade"]
    }>;
  }>;

  notAffected: Array<{
    client: { id, name, entityType, primaryState };
    reason: 'wrong_jurisdiction' | 'wrong_tax_kind' |
            'no_active_estimates' | 'all_paid';
  }>;
}
```

### `trpc.announcements.recomputeEstimates({ announcementId, selections })`

```typescript
{
  announcementId: string;
  selections: Array<{ deadlineId: string; newAmount: number }>;
}
```

Returns:
```typescript
{
  recomputedCount: number;
  bankUpdateTodos: number;            // count of auto-pay clients flagged
  undoToken: string;
  expiresAt: timestamp;
}
```

### Estimate calculator

Lives in `backend/src/lib/estimate-calculator.ts`. Inputs:

- Client's prior-year tax filing (for safe-harbor calculation)
- Current-year YTD income estimate
- Affected jurisdiction's rate schedule (current & new)
- Special rules (loss carryforward, fiscal year, payment plans)

Outputs: `{ amount, methodology, confidence, warnings[] }`. Methodology = `"safe_harbor_110%"` / `"current_year_estimate"` / `"prior_year_actual"` etc.

**Confidence**: high (default), medium (loss carryforward / restructure / fiscal year), low (insufficient data — Sarah must review manually). Low-confidence estimates are NOT auto-recomputed in batch.

---

## 11. Copy

| Element | Copy |
|---------|------|
| Browser tab | `"{Authority} · Rate change · DueDateHQ"` |
| Verdict header | `"Affecting {N} of your {totalActive} clients · {totalEstimates} estimate calcs"` |
| Verdict subhead | `"Recompute Q-estimates affected by the new {oldRule} → {newRule}."` |
| Verdict header (N=0) | `"None of your clients have active estimates affected by this rate change."` |
| Primary verb | `"Recompute {N} estimates"` |
| Secondary verb | `"Recompute + draft {N} emails"` |
| Confirmation flash | `"{N} estimates recomputed · {bankCount} bank-instruction TodoItems queued · Undo (5min)"` |
| Confirmation flash (no bank updates) | `"{N} estimates recomputed · Undo (5min)"` |
| Annotation: paid | `[paid — no change]` (grey) |
| Annotation: below threshold | `[change below threshold]` (grey) |
| Annotation: auto-pay | `[auto-pay — bank instruction must update]` (warn) |
| Annotation: loss carryforward | `[loss carryforward — verify]` (warn) |
| Annotation: cascading | `+ {state} surtax cascade` (info) |
| Annotation: low-confidence | `[low confidence — manual review]` (warn-tone, action excluded) |
| Estimate impact heading | `Estimate impact preview:` |
| Auto-pay row banner | `Auto-pay: enabled — bank instruction must update` |
| Empty state CTA | `"Dismiss with reason"` |

**Tone**: precise, numerical. The audience expects $-amounts to be exact; copy should not waffle.

---

## 12. Telemetry

| Event | When | Payload |
|-------|------|---------|
| `alert_viewed` (rate_change) | Page mount | shared |
| `estimates_recomputed` | After batch | `{ announcementId, estimateCount, totalDeltaUsd, autopayCount }` |
| `estimate_recompute_undone` | Within 5min | `{ undoToken, restoredCount }` |
| `bank_update_todo_completed` | Sarah marks bank update done | `{ todoId, daysFromCreation }` |

Goal: measure (a) recompute volume, (b) average delta size (proxy for material rate changes vs trivial inflation tweaks), (c) bank-update follow-through rate.

---

## 13. What's NOT in scope

- **Auto-applying recomputes for all clients without Sarah's review** — too risky. Always batch-confirm.
- **Filing a new estimate vouch with the IRS automatically** — out of scope; client pays from their own bank or Sarah generates the voucher manually.
- **EFTPS / state direct-pay integration** — P3; for now, TodoItem instructs Sarah to do it manually.
- **Year-over-year forecasting impact** ("this rate change saves your firm $X aggregate") — Mode E concern, separate dashboard.
- **Mid-quarter projections** — affecting Q-estimates is captured, but micro-projections (weekly cash flow) are out of scope.

---

## 14. Build order

| Phase | Work | Effort |
|-------|------|--------|
| 1 | Schema: `deadlines.amount`, `deadlines.original_amount`, `deadlines.estimate_method` | XS |
| 2 | BE: `estimate-calculator.ts` library — input rules, output amount + methodology + confidence | L (most complex, has to encode federal + 50 state schedules) |
| 3 | BE: `recomputeEstimates` procedure (transactional + auto-pay TodoItem creation) | M |
| 4 | FE: VerdictSection variant — per-estimate breakdown with annotations | M |
| 5 | FE: Threshold config in firm settings | S |
| 6 | Telemetry events | XS |
| 7 | E2E test: alert → recompute 4 estimates → confirm amount changes + auto-pay TodoItem | S |

Estimated total: ~3 sprints solo (estimate calculator is the heavy lift).

---

_End of rate_change spec._
