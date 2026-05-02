# AlertDetail — Variants Across All 6 Alert Types

_Companion to [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md). Compact comparative spec for the other 5 alertTypes + a summary table covering all 6._

---

## 1. Why variants

The 6 alertTypes share a page shell (header, verdict, evidence, action bar) but their **action shape differs sharply**:

| AlertType | Action shape | Why different |
|-----------|--------------|---------------|
| `disaster_extension` | **Mechanical** — move deadlines, batch-safe | One verb; oldDate→newDate is concrete; cascade is wide |
| `penalty_relief` | **Annotative** — tag clients for follow-up at filing time | No deadline change; the value is "remember this when you file" |
| `pte_change` | **Conversational** — schedule planning calls | PTE election is a planning decision, not a filing mechanic |
| `rate_change` | **Computational** — recompute estimates | Math change; affects Q-estimate calc, not deadlines |
| `form_change` | **Curatorial** — admin reviews catalog | The change is to the form metadata itself, not to clients directly |
| `nexus_change` | **Discovery** — figure out who actually has nexus | New state obligations; needs Sarah's per-client judgment |

The common ground: every variant gets the same header / evidence / dismiss / snooze / share. The variant shows up in the **verdict copy** and the **action bar**.

---

## 2. The single comparative table

| Slot | `disaster_extension` | `penalty_relief` | `pte_change` | `rate_change` | `form_change` | `nexus_change` |
|------|---|---|---|---|---|---|
| **Header chip** | "Disaster extension" (warn-orange) | "Penalty relief" (info-blue) | "PTE change" (info-blue) | "Rate change" (info-blue) | "Form change" (neutral) | "Nexus change" (info-blue) |
| **Subtitle template** | "Filing deadlines extended to {newDate} for {counties}" | "Penalty relief for {scope} until {endDate}" | "{Form/Election} updated — {summary}" | "{Tax} rate changed from {old}% to {new}% effective {effectiveDate}" | "Form {N} revised — {summary}" | "Nexus threshold {expanded\|contracted} for {state} effective {effectiveDate}" |
| **Verdict count copy** | "Affecting N of your M clients · K deadlines moving" | "Affecting N of your M clients" | "Affecting N of your M clients · {filings}" | "Affecting N of your M clients · K estimate calcs" | "Used by N of your M clients" | "Possibly affecting N of your M clients (verify)" |
| **Per-client row chips** | matched-county · entity · K deadlines moving | matched-tax · entity | matched-state · entity · "PTE-elected" badge | matched-tax-bracket · entity · "active estimate" badge | "uses Form N" badge | matched-activity (revenue, payroll) · "verify nexus" |
| **Per-client expansion** | per-filing checkboxes (oldDate→newDate) | none (just client-level) | per-form checkbox (which planning topics to discuss) | per-estimate checkbox (Q1/Q2/Q3/Q4) | none | per-suggested-filing checkbox (income / sales / payroll) |
| **Primary verb** | "Move K deadlines to {newDate}" | "Tag N clients for review at filing" | "Schedule planning call for N clients" | "Recompute K estimates for N clients" | "Open admin reviewer queue →" | "Add suggested filings for N clients" |
| **Secondary verb** | "Adjust + draft emails" | "Tag + draft email" | "Draft email + add planning notes" | "Recompute + draft email" | "Snooze until reviewer acts" | "Just send notification (no filings yet)" |
| **Empty state copy** | "None of your clients are in {counties}" | "None of your clients have penalties pending" | "None of your clients have a PTE election active" | "None of your clients have active estimates for this tax" | "None of your clients use Form {N}" | "None of your clients show activity in {state}" |
| **Mode used** | F (state ingest) → cascade to deadlines | F → ChecklistItem flagging | F → Mode E advisory | F → Mode E recompute | F → admin (Mode F internal) | F → Mode E + suggested filings |
| **Touches federal forms catalog?** | No (deadlines only) | No | Maybe (if PTE form added/removed) | No | **Yes** — primary effect | Maybe (state filings may map to federal forms catalog) |
| **Auto-applies anything?** | No (Sarah confirms batch) | No | No | No | No (admin gates) | No |
| **Undo window** | 5 min (deadlines reversible) | 24h (untag) | none (just unschedules) | 5 min (estimate revert) | n/a | 24h (delete added filings) |

---

## 3. Per-variant details

### 3.1 `disaster_extension` — see [full spec](./alert-detail-disaster-extension.md)

The mechanical case. Most-built. Move-deadlines-to-newDate × N clients × M filings. Already specced in the companion doc.

### 3.2 `penalty_relief`

**The job**: Sarah needs to remember, *at filing time*, that a particular client qualified for a penalty waiver — so she doesn't accidentally pay or pass through a penalty that's been forgiven.

**Page anatomy difference**:
- Verdict block lists clients matched on (a) the tax type relieved, (b) entity type
- No per-client expansion — penalty relief is client-level, not filing-level
- Each client row shows a "tag" preview: "Will tag with: 'FL penalty relief through May 14 (FL DOR Notice 2026-12)'"

**Primary verb**: `"Tag N clients for review at filing"`
- Writes to a new `client_tags` table (or `clients.review_tags[]`) with tag text + reason + source alert ID + valid-through date
- Tag surfaces on Workspace tab next to client name + on TaskDetail when filing the affected return
- Tag auto-expires at `valid_through` date (state's relief-end date)

**Secondary verb**: `"Tag + draft email"`
- Same tagging + composes an email to the client letting them know "you're covered, no action needed"

**No deadline mutations.** This is annotative.

### 3.3 `pte_change`

**The job**: state changed how Pass-Through Entity election works. Sarah needs to decide which clients to revisit the election for — usually a planning conversation.

**Page anatomy difference**:
- Verdict block lists clients with active PTE elections (or PTE-eligible based on entity type)
- Per-client expansion: list of planning topics relevant to this change ("revisit election timing", "confirm allocation method", "estimate vs payment difference")
- "Already has PTE call scheduled" badge if a calendar entry exists

**Primary verb**: `"Schedule planning call for N clients"`
- Opens scheduling modal (Mode D email draft + calendar event creation)
- One call per client (or batch — Sarah picks)
- Writes calendar invite via Google Calendar / Outlook integration (P2 — for now creates a TodoItem "schedule call with X")

**Secondary verb**: `"Draft email + add planning notes"`
- Email: "[State] just changed PTE rules — let's chat about your election before [next election deadline]"
- Adds a note to ClientDetail with the alert reference + suggested talking points

**No deadline mutations.** Pure planning surface.

### 3.4 `rate_change`

**The job**: tax rate moved (sales tax bracket, withholding rate, federal/state income bracket). Sarah needs to recompute Q-estimates for affected clients.

**Page anatomy difference**:
- Verdict lists clients with active estimates for the affected tax
- Per-client expansion: list of estimates by quarter (Q1 paid, Q2 due, Q3 future, Q4 future)
- Each estimate row shows: "Currently set at $X (using {old}% rate). Recompute → $Y (using {new}% rate)."
- Estimates that are already paid get a `[paid — no change]` annotation

**Primary verb**: `"Recompute K estimates for N clients"`
- Computes new estimate amounts using BE service (estimate calculator)
- Updates `deadlines.amount` (or per-period estimate metadata)
- Writes activity event per estimate change
- Undo window: 5 min (revertible, since the math is deterministic)

**Secondary verb**: `"Recompute + draft email"`
- Same recompute + composes per-client email: "Heads-up — your {tax} rate moved from {old}% to {new}%. Your Q3 estimate is now $Y instead of $X. Pay by {date}."

**Edge case**: clients on auto-pay arrangements need an extra confirmation step ("This client is on auto-pay; recomputing will require updating the bank instruction").

### 3.5 `form_change`

**The job**: IRS / state revised a form. Catalog needs updating. CPA-level action is minimal; admin-level action is to review and apply the catalog change.

**Page anatomy difference**:
- Verdict block shows "**Used by N of your M clients**" — this is read-only context; no checkboxes, no per-client action
- Below that, an **admin-gate panel** (only visible if `users.role IN ('owner','admin')`):
  - "What changed in this notice" (parsed diff)
  - Link to Federal Register source
  - Two buttons: "Apply to catalog" / "Reject"
- Non-admin users see read-only "Pending admin review" badge

**Primary verb (admin)**: `"Open admin reviewer queue →"` 
- Routes to `/settings/federal-forms?event={changeEventId}` (admin reviewer UI — currently P1 build target)

**Primary verb (non-admin CPA)**: `"Acknowledge"` 
- Adds to ActivityLog; alert moves to "acknowledged" state, removed from Today queue

**Secondary verb**: `"Snooze until reviewer acts"`
- Pushes alert to next-week banner + auto-resolves when admin marks `applied_at` on the change_event

**No client-level action.** This is the one alertType where the affected clients are *informational only* — the action is on the catalog row.

### 3.6 `nexus_change`

**The job**: a state's nexus rules changed — either expanded (lower thresholds → more clients owe) or contracted (higher thresholds → some clients don't owe anymore). Sarah needs to figure out who actually has nexus and add new filings.

**Page anatomy difference**:
- Verdict heading: "**Possibly affecting** N of your M clients (verify)" — *possibly* is load-bearing
- Per-client expansion: shows the matching activity signal ("estimated $250K revenue in TX last year", "5 W-2 employees in WA"), plus suggested filings (income tax, sales tax, payroll)
- Each suggested filing has a checkbox + "verify nexus first" warning chip
- A separate "Nexus check" button per row that opens a mini-questionnaire (4-5 yes/no questions specific to the state's new rules)

**Primary verb**: `"Add suggested filings for N clients"`
- After Sarah completes nexus check per client (or marks "yes, has nexus" without questionnaire), batch creates new deadline rows in the affected state
- Each new filing assigned to client, with note linking back to this alert
- Writes to `deadlines` table + `clients.nexus_states[]` array

**Secondary verb**: `"Just send notification (no filings yet)"`
- Composes email "Your business activity in {state} may now create a tax obligation. Schedule a call to discuss."
- No filings created

**Edge case**: contraction case ("nexus threshold raised — some clients no longer owe") shows a different UI: list of clients whose existing state filings might be removable, with `[review before removing]` warnings. This is the inverse of the expansion case and gets its own sub-verb: `"Review for removal"`.

---

## 4. Component decomposition

To keep the UI maintainable as the variants grow, propose this component split:

```
<AnnouncementDetail>
├─ <AlertHeader>           // shared — state chip, title, subtitle, source, dates
├─ <FlashBanner>            // shared — undo, success, error
├─ <VerdictSection>         // typed by alertType
│   ├─ <VerdictHeader>      // "Affecting N..." copy varies
│   ├─ <AffectedClientList> // per-row UI varies (chips, expansion, annotations)
│   └─ <NotAffectedSection> // shared (collapsed by default)
├─ <AlertActionBar>         // typed by alertType — THE main variant surface
│   ├─ Primary verb         // "Move N..." / "Tag N..." / etc.
│   ├─ Secondary verb       // "Adjust + draft..." / "Tag + draft..." / etc.
│   └─ <OverflowMenu>       // shared — dismiss, snooze, share
├─ <EvidencePanel>          // shared — collapsed audit info
└─ <RelatedAlertsPanel>     // shared — cluster siblings
```

The variants live in two files:
- `src/data/alertTypeConfig.ts` — pure config table (label, color, primary/secondary verb templates, modal component, mode references)
- `src/components/AlertActionBar.tsx` — renders based on config

`<VerdictSection>` reads the config to know which per-row chips/expansions to render. Each variant's modal flow is its own component (`BatchAdjustModal`, `BatchTagModal`, `SchedulePlanningCallModal`, `RecomputeEstimatesModal`, `AdminFormReviewModal`, `NexusCheckModal`).

---

## 5. Implementation rollout (proposed)

| Phase | Variant | Effort | Why this order |
|-------|---------|--------|----------------|
| 1 | `disaster_extension` | Refactor existing surface to typed-config (already most-built) | Highest volume; already works; serves as template |
| 2 | `penalty_relief` | New `BatchTagModal` + `client_tags` table | Simplest — annotative only, no calc, no calendar |
| 3 | `form_change` | New admin-only panel + route to reviewer queue | Unblocks Mode F admin reviewer UI work |
| 4 | `rate_change` | New `RecomputeEstimatesModal` + estimate calculator | Mechanical math, similar pattern to disaster |
| 5 | `pte_change` | New `SchedulePlanningCallModal` + calendar integration (P2) or TodoItem fallback | Calendar is P2 — for now, just create TodoItem |
| 6 | `nexus_change` | New `NexusCheckModal` (questionnaire) + state-filings template | Most complex — needs state-by-state nexus rules data |

Phases 1–3 are P0 (current sprint). Phases 4–6 are P1.

---

## 6. Telemetry differences

Per-variant events to emit (in addition to shared `alert_viewed`, `alert_dismissed`, etc.):

| AlertType | Event | When |
|-----------|-------|------|
| `disaster_extension` | `deadlines_moved` | After batch apply |
| `penalty_relief` | `clients_tagged` | After batch tag |
| `pte_change` | `planning_calls_scheduled` | After batch schedule |
| `rate_change` | `estimates_recomputed` | After batch recompute |
| `form_change` | `catalog_change_applied` (admin), `catalog_change_acknowledged` (non-admin) | Per role |
| `nexus_change` | `nexus_check_completed` (per client), `filings_added_from_nexus` (batch) | Two-stage |

These feed the Mode E feedback loop ("which alert types generated action vs dismissals") and product analytics.

---

## 7. Open questions

1. **Should `form_change` alerts even appear in Sarah's `/alerts` feed**, or only in admin reviewer queue? Current default: appear, but with read-only "pending admin review" UI for non-admin. Alternative: hide entirely until admin marks `applied_at`. Argument for hiding: don't surface things Sarah can't act on. Argument for showing: she might want to know a form changed before her admin gets to it.

2. **For `pte_change` and `rate_change`, should we auto-create TodoItems on Today queue** or wait for Sarah to action from the alert detail? Trade-off: auto-create = cleaner Today UX (one place to see what to do); manual = less queue noise. Default recommendation: auto-create on Today, but only after Sarah's first interaction with the alert (don't pre-create before she's seen it).

3. **For `nexus_change` contraction (rules tightened — some clients no longer owe)**, should we proactively suggest removing existing state deadlines? Risk: removing too eagerly = client misses a filing they actually still owe. Default: show the candidates, require explicit per-client confirmation, never batch-remove.

4. **For `penalty_relief`, how does the tag interact with the chase loop?** If a client is tagged "penalty relief through May 14" but they still haven't filed, does the chase loop stop pestering them? Default: no — relief = penalty waived, not deadline removed. Chase loop still nudges. But the chase email gets a softer tone modifier ("FYI: penalty relief is in effect, but file when you can").

---

_End of variants spec._
