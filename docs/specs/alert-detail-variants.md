# AlertDetail — Variants Index

_Navigation index for the 6 alertType action specs. Each variant has its own self-contained doc; this page is the comparative table + cross-links._

---

## 1. Per-variant specs

| AlertType | Action shape | Spec |
|-----------|--------------|------|
| `disaster_extension` | Mechanical — move deadlines | [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md) |
| `penalty_relief` | Annotative — tag for filing-time review | [alert-detail-penalty-relief.md](./alert-detail-penalty-relief.md) |
| `pte_change` | Conversational — schedule planning calls | [alert-detail-pte-change.md](./alert-detail-pte-change.md) |
| `rate_change` | Computational — recompute estimates | [alert-detail-rate-change.md](./alert-detail-rate-change.md) |
| `form_change` | Curatorial — admin reviews catalog | [alert-detail-form-change.md](./alert-detail-form-change.md) |
| `nexus_change` | Discovery — verify nexus, add (or remove) filings | [alert-detail-nexus-change.md](./alert-detail-nexus-change.md) |

---

## 2. The comparative table

| Slot | `disaster_extension` | `penalty_relief` | `pte_change` | `rate_change` | `form_change` | `nexus_change` |
|------|---|---|---|---|---|---|
| **Header tone** | warn (orange) | info (blue) | info (blue) | info (blue) | neutral (grey) | info (blue) |
| **Subtitle template** | "Filing deadlines extended to {newDate} for {counties}" | "{relievedScope} relief for {scope} {timeframe}" | "{change-type}. Affects {timeframe}." | "{change-summary}. Effective {date} · Affects {scope}." | "{change-summary}. Catalog update {pending\|applied}." | "{rule-summary}. Effective {date} · {tax}." |
| **Verdict count** | "Affecting N of your M clients · K deadlines moving" | "Affecting N of your M clients" | "Affecting N of your M clients" | "Affecting N of your M clients · K estimate calcs" | "Used by N of your M clients (informational)" | "Possibly affecting N of your M clients (verify nexus)" |
| **Verdict subhead** | (none) | "Each will be tagged for review at next filing." | "Schedule a conversation before {deadline}." | "Recompute Q-estimates affected by the new {oldRule} → {newRule}." | "📋 Pending admin review" (non-admin) | "Run nexus check per client. Then add applicable filings." |
| **Per-client expansion** | per-filing checkboxes (oldDate→newDate) | none (client-level only) | talking points + best contact | per-estimate checkboxes (Q1/Q2/Q3/Q4) | none (read-only list) | activity signals + suggested filings |
| **Per-client status chip** | matched-county | match-reason annotation | PTE-elected / eligible / not-eligible / lapsed | est. AGI bracket | (none) | confidence: 🟢 / ⚠ / ? |
| **Primary verb** | "Move K deadlines to {newDate}" | "Tag N clients for review at filing" | "Schedule planning calls for N clients" | "Recompute K estimates" | "Acknowledge" (non-admin) / "Apply catalog change" (admin) | "Add suggested filings for N clients" (expansion) / "Review for removal (N filings)" (contraction) |
| **Secondary verb** | "Adjust + draft emails" | "Tag + draft N reassurance emails" | "Draft N planning emails" | "Recompute + draft N emails" | "Modify before applying" (admin only) | "Notify N clients (no filings yet)" |
| **Audience split?** | No (CPA acts) | No | No | No | **Yes** — admin vs non-admin | No |
| **Empty state copy** | "None of your clients are in {counties}" | "None of your clients have penalties pending" | "None of your clients have a PTE election active in {state}" | "None of your clients have active estimates affected" | "None of your clients use this form" | "None of your clients show activity in {state}" |
| **Mode used** | F (state ingest) → cascade to deadlines | F → ChecklistItem flagging + Tag | F → Mode E advisory | F → estimate calculator | F → admin reviewer (catalog) | F → Mode E + nexus check |
| **Touches federal forms catalog?** | No | No | Maybe | No | **Yes — primary effect** | Maybe |
| **Adds new deadlines?** | No (only moves existing) | No | No (election deadlines tracked separately) | No (only mutates amounts) | No | **Yes** — new state filings (expansion) |
| **Auto-applies anything?** | No | No | No | No | No | No |
| **Undo window** | 5 min | 24h (untag) | none (just unschedules call) | 5 min | n/a (acknowledge is reversible by un-acknowledging) | 24h |
| **BE schema additions** | (existing deadlines table) | `client_tags` | `planning_calls` | `deadlines.amount`, `original_amount` | `change_event.applied_at` etc. | `client_state_nexus`, `deadlines.protected_after_filing_year` |
| **Build complexity** | Low (deadlines mutation is well-trodden) | Low (tagging table + surface) | Medium (Mode E talking-points generator) | High (estimate calculator with state rules) | Medium (admin gating + diff UI) | High (per-state nexus rules + questionnaire) |

---

## 3. Why each variant has a different action shape

The 6 alertTypes share a page shell (header, verdict, evidence, action bar) but their **action shape differs sharply**:

| AlertType | Action shape | Why different |
|-----------|--------------|---------------|
| `disaster_extension` | **Mechanical** — move deadlines, batch-safe | One verb; oldDate→newDate is concrete; cascade is wide |
| `penalty_relief` | **Annotative** — tag clients for follow-up at filing time | No deadline change; the value is "remember this when you file" |
| `pte_change` | **Conversational** — schedule planning calls | PTE election is a planning decision, not a filing mechanic |
| `rate_change` | **Computational** — recompute estimates | Math change; affects Q-estimate calc, not deadlines |
| `form_change` | **Curatorial** — admin reviews catalog | The change is to the form metadata itself, not to clients directly |
| `nexus_change` | **Discovery** — figure out who actually has nexus | New state obligations; needs Sarah's per-client judgment |

The common ground: every variant gets the same header / evidence / dismiss / snooze / share. The variant shows up in the **verdict copy** + the **action bar** + (sometimes) the **per-client expansion shape**.

---

## 4. Component decomposition (live in code)

```
<AnnouncementDetail>                             // src/pages/AnnouncementDetail.tsx
├─ <AlertHeader>                                 // shared
├─ <FlashBanner>                                 // shared
├─ <VerdictSection>                              // typed by alertType
│   ├─ <VerdictHeader>                          // copy from cfg.verdictHeadline
│   ├─ <AffectedClientList>                     // per-row UI varies
│   └─ <NotAffectedSection>                     // shared, collapsed
├─ <AlertActionBar announcement={ann} ...>      // src/components/AlertActionBar.tsx
│   ├─ Primary verb                             // cfg.primaryVerb()
│   ├─ Secondary verb                           // cfg.secondaryVerb()
│   └─ <OverflowMenu>                           // shared
├─ <EvidencePanel>                               // shared
└─ <RelatedAlertsPanel>                          // shared
```

Variant-specific copy lives in **one file**: `src/data/alertTypeConfig.ts`. Tone tokens live in `ALERT_TONE_CLASSES` (same file). Adding a new alertType = enum value + one config row.

---

## 5. Implementation rollout

| Phase | Variant | What ships | Effort | Status |
|-------|---------|------------|--------|--------|
| 1 | `disaster_extension` | Existing flow refactored to typed config | (already shipped) | ✅ Ships |
| 2 | `penalty_relief` | `BatchTagModal` + `client_tags` table | ~1 sprint | 🚧 Spec'd |
| 3 | `form_change` | Admin diff panel + `/settings/federal-forms` queue | ~2 sprints | 🚧 Spec'd |
| 4 | `rate_change` | `RecomputeEstimatesModal` + estimate calculator | ~3 sprints | 🚧 Spec'd |
| 5 | `pte_change` | `SchedulePlanningCallModal` + planning_calls table | ~2 sprints | 🚧 Spec'd |
| 6 | `nexus_change` | `NexusCheckModal` + state-rule config | ~3–4 sprints | 🚧 Spec'd |

Phases 1–3 are P0 (current sprint). Phases 4–6 are P1.

**Where the typed action bar already lands**: all 6 variants currently render the correct typed primary/secondary verbs and per-type chip tone (per `src/data/alertTypeConfig.ts`). For variants 2–6, clicking the primary verb routes to `BatchNotifyModal` as a placeholder until the dedicated modals are built.

---

## 6. Cross-cutting concerns

### 6.1 Telemetry — events shared by all variants

| Event | When |
|-------|------|
| `alert_viewed` | Page mount; payload includes alertType, source (today_inline / today_open / alerts_list / deep_link) |
| `alert_dismissed` | Dismiss confirm; payload includes reason |
| `alert_snoozed` | Snooze click; payload includes durationDays |
| `alert_shared` | Share action |

Each variant adds its own action-completed event (`deadlines_moved`, `clients_tagged`, etc.) — see per-variant specs.

### 6.2 Per-variant telemetry events

| AlertType | Action event |
|-----------|--------------|
| `disaster_extension` | `deadlines_moved` |
| `penalty_relief` | `clients_tagged` (alert), `tag_applied` / `tag_expired` (per-tag lifecycle) |
| `pte_change` | `planning_calls_scheduled`, `planning_call_completed` |
| `rate_change` | `estimates_recomputed`, `bank_update_todo_completed` |
| `form_change` | `catalog_change_applied` (admin) / `catalog_change_acknowledged` (non-admin) |
| `nexus_change` | `nexus_check_completed` (per-client), `filings_added_from_nexus` (batch), `filings_removed_from_nexus` |

### 6.3 Open questions across all variants

1. **Should `form_change` alerts even appear in non-admin Sarah's `/alerts` feed**, or only in admin reviewer queue? Default: appear, with read-only "pending admin review" notice for non-admin.

2. **For `pte_change` and `rate_change`, should we auto-create TodoItems on Today queue** or wait for Sarah to action from alert detail? Default: auto-create on Today, but only after Sarah's first interaction.

3. **For `nexus_change` contraction**, default to "keep protective" or "remove"? Default: neither — Sarah must explicitly choose. Removing too eagerly risks missing a filing the client still owes.

4. **For `penalty_relief`, does the tag interact with the chase loop?** Default: no — relief = penalty waived, not deadline removed. Chase loop still nudges. But the chase email gets a softer tone modifier.

5. **For `rate_change` / `nexus_change`, do auto-pay clients block the batch action?** Default: no — they just get a TodoItem queued for bank-instruction update.

---

## 7. Mode + Pattern mapping

| AlertType | Modes touched | Patterns served |
|-----------|---------------|-----------------|
| `disaster_extension` | F (ingest) → A/D (notification email) | Pattern 3 (state alert wedge) |
| `penalty_relief` | F → C (anomaly flag, late filer) → A (Mode A applies tag at filing time) | Pattern 3 + Pattern 1 (tracking) |
| `pte_change` | F → E (advisory awakening) → D (planning email) | Pattern 4 (advisory) |
| `rate_change` | F → E (recompute) → D (notification) | Pattern 1 (deadline tracking, modified) |
| `form_change` | F (catalog mutation) | Pattern 1 (forms underlying deadlines) |
| `nexus_change` | F → E (signal analysis + recommendations) | Pattern 3 + Pattern 4 |

---

_End of variants index._
