# Action Queue — Implementation Reference

> Engineering contract for the Today action-queue surface. Pairs with `duedatehq-dashboard-spec.md` §1A (UX) and `STATE-NOTIFICATION-IMPLEMENTATION.md` (state-alert pipeline). PRD: §4.8 v0.8 amendment. IA: v0.7 §3.1.
>
> **Source of truth (code):**
> - `src/components/ActionQueue.tsx` — surface
> - `src/lib/queueGrouping.ts` — pure grouping logic
> - `src/lib/queueGrouping.test.ts` — invariants encoded as tests
> - `backend/src/trpc/routers/todoItems.ts` — server-side TodoItem assembly
> - `src/lib/api/mock-adapter.ts` — mock-mode adapter (kept in sync)

---

## 1 · The contract in one paragraph

The backend emits a flat list of `TodoItem`s — one per actionable thing across 9 sources (Modes A/B/C/D/E/F + InboundReply intent + DeliveryEvent bounces + manual notes). The frontend groups that flat list into 3 row variants and renders them in an AI-prioritized feed. The grouping is pure (no fetching), runs on every render of the queue, and is fully covered by the test file. Any change to the contract should land with a corresponding test.

---

## 2 · Data shape

```ts
// What the backend returns (per router definition + live emit sites):
type TodoItem = {
  id: string;
  source: TodoSource;            // 9 source modes — see §3
  verb: "Send" | "Confirm" | "Apply" | "Discuss";
  client: string;                // display name OR "N clients" for batch rows
  clientId: string;              // UUID for per-client rows; "" for Mode F batch
  task?: string;                 // form name e.g. "1040", "CA 540"
  taskId?: string;
  dueDate?: string;              // ISO "YYYY-MM-DD"
  action: string;                // natural-language verb-phrase
  context: string;
  stageLabel?: string;           // "Collect" / "Review" / "Prepare" / "File"
  daysBehind?: number;           // populated when reminder >7d unsent
  urgency: "high" | "medium" | "normal";  // bucket of urgencyScore
  urgencyScore: number;          // see PRD §4.8 formula
  surface:                       // suggested next surface on click
    | "email_draft_modal"
    | "task_detail"
    | "alert_detail"
    | "opportunity_detail"
    | "bounce_modal";
};
```

### 2.1 `urgencyScore` formula (PRD §4.8 v0.8)

```
score = base_source_score
      × waiting_multiplier      // ramps with days-since-reminder
      × deadline_proximity      // 3× past due, 2× <7d, 1.5× <30d, else 1×
      × tier_weight             // premium 1.5, standard/custom 1.0
      + stuck_duration_bonus    // days_since_reminder × 5
```

Bucket: `≥200 → high (red)`, `≥100 → medium (yellow)`, `<100 → normal (green)`.

### 2.2 Live-BE invariants (audited 2026-05-03)

| Source | clientId | client | Notes |
|---|---|---|---|
| Mode A inbound | UUID | name | per-checklist-item |
| Mode B reminder due | UUID | name | bundled per-task (one row per task with all waiting docs folded in) |
| Mode C anomaly | UUID | name | per-flag |
| Mode D draft ready | UUID | name | per-draft (single client) |
| Mode E opportunity | UUID | name | per-inference |
| Mode F state alert | `""` | `"N clients"` | fan-out, no single client |
| reply_pushback | UUID | name | per-reply |
| reply_question | UUID | name | per-reply |
| delivery_bounce | UUID | name | per-event |

Mock-adapter `Mode D` historically emitted `client: "N clients"` for legacy "approve all" batches; live BE no longer does.

---

## 3 · Source → verb collapse (CPA-visible)

| Source (internal) | Verb (CPA-visible) | What it means |
|---|---|---|
| `mode_a_inbound` | Confirm | AI classified an inbound document; rubber-stamp |
| `mode_b_reminder_due` | Send | Reminder is due (or stale-not-requested) |
| `mode_c_anomaly` | Confirm | AI flagged an anomaly; needs your eye |
| `mode_d_draft_ready` | Send | Draft is queued; review and send |
| `mode_e_opportunity` | Discuss | Cross-year insight worth a conversation |
| `mode_f_alert` | Apply | State event affects N clients; notify-all |
| `reply_pushback` | Discuss | Client wrote back disagreeing |
| `reply_question` | Discuss | Client wrote back with a question |
| `delivery_bounce` | Send | Reminder bounced; fix address + resend |
| `manual` | Discuss / Send | CPA self-added note |

The 4 verbs are the user-facing vocabulary; the 9 sources are internal scoring/routing keys.

---

## 4 · Row variants

`buildQueueRows(items)` carves the flat list into one of three row kinds:

### 4.1 `state_alert` (pinned to top)

**Trigger:** `source === "mode_f_alert" || verb === "Apply"`. The verb check is defensive — Mode F is the canonical source today, but a future broadcast source could reuse `Apply` and would correctly pin.

**Shape:** `{ kind: "state_alert", item: QueueTodoItem }`. Rendered with bell icon + "Notify all" CTA + info-tinted background. Always above all client groups regardless of `urgencyScore` — alerts are highest-leverage by construction (one event, fan-out to N clients).

**Dual-surface design (important).** The queue's state-alert row is **derived** from a Mode F-generated TodoItem on the BE. It is NOT the canonical alert surface — `AnnouncementBanner` is. The banner receives every undismissed alert; the queue row only exists when the matcher has run and Mode F has emitted a corresponding TodoItem.

> **Lesson from PR #52:** A previous design (PR #44) filtered the banner down to news-only and made the queue the sole "act" entry. When Mode F hadn't yet emitted a TodoItem for a fresh alert, the alert vanished from both surfaces and the user only saw "5 active alerts" in `StateMonitoringHealth` with no way to act on them. The fix: banner is canonical (belt), queue is derived (suspenders). Both are intentional. Don't try to deduplicate by removing one.

### 4.2 `bulk_batch` (mock-only today)

**Trigger:** `client` matches `/^\d+\s+clients?$/i` AND not already a state alert.

**Shape:** `{ kind: "bulk_batch", item: QueueTodoItem }`. Multi-client batch row (e.g. "8 routine W-2 follow-ups · approve all"). Rendered with `Users` icon. Currently produced only by mock-adapter; live BE has no batch source. Kept defensive in case Mode D evolves.

### 4.3 `client_group` (everything else)

**Trigger:** anything not carved as alert/bulk.

**Key:** `clientId` if non-empty, else `name:${client}`. The empty-string fallback prevents a malformed row from collapsing N unrelated clients into one mystery group.

**Shape:**
```ts
{
  kind: "client_group";
  clientName: string;
  clientId?: string;
  items: QueueTodoItem[];        // sorted desc by urgencyScore
  maxUrgency: "high" | "medium" | "normal";
  maxUrgencyScore: number;
  earliestDueDate?: string;
  verbCounts: Partial<Record<Verb, number>>;
}
```

**Row body:** verb-summary string from `summarizeClientGroup` — e.g. `"Send 3 reminders · Confirm 1 inbound · across 1120-S (federal) + NY CT-3-S"`. Form list truncates at 3 with `+N` overflow.

**Row dot:** `maxUrgency` (red if any item is overdue / stale-not-requested).

**Row primary action:** `pickPrimaryItem(row.items)` — verb preference order `Send > Confirm > Discuss > Apply`, urgency desc within each verb. The badge label and the destination must agree, so a row labeled "Send" never lands on a Confirm screen.

**Expand:** chevron toggles inline sub-item list. Each sub-item routes to its own surface independently.

---

## 5 · Sort order

```
1. All state_alert rows (pinned, ordered by urgencyScore desc among themselves)
2. Mixed stream of client_group + bulk_batch rows (ordered by max urgencyScore desc)
```

There's no secondary sort by `earliestDueDate` — urgency already encodes deadline proximity via the `deadline_proximity` factor.

---

## 6 · Edge cases (covered in tests)

| Case | Expected behavior |
|---|---|
| Empty input | `[]` |
| One client, multiple items | Single grouped row, verb counts summed |
| Same client name, different `clientId` | Two separate rows (defensive against name collisions) |
| Empty `clientId` on a non-Mode-F item | Falls back to name keying |
| Mode F + a chase row with score > Mode F's | Mode F still pinned at top |
| `verb: "Apply"` from a non-Mode-F source | Treated as state alert |
| `client: "12 clients"` without Mode F source | Treated as bulk batch |
| Mixed-verb group (Send + Confirm + Discuss) | `verbCounts` populated; `pickPrimaryItem` picks Send |

Run: `npm test`.

---

## 7 · Where this surface lives in the IA

```
┌─ Today (/) ─────────────────────────────────────────────┐
│  Just happened (overnight diff)                         │
│  AnnouncementBanner (canonical alert surface — every    │
│      undismissed alert; news-only folds to chip)        │
│  ┌─ Action queue ─────────────────────────────────────┐ │
│  │  state_alert rows  (derived — Mode F TodoItem)     │ │  ← THIS DOC
│  │  client_group rows (one per client × email)        │ │
│  │  bulk_batch rows   (multi-client send)             │ │
│  └────────────────────────────────────────────────────┘ │
│  Quiet clients (14d+ unanswered)                        │
│  Mode F Health                                          │
│  Capacity                                               │
└─────────────────────────────────────────────────────────┘
```

The queue is the action surface for the morning chase ritual. The `AnnouncementBanner` directly above carries alerts themselves (banner is canonical, queue is derived — see §4.1). Other entry points (email-draft modal, task detail, alert detail) are reachable via row clicks but are not surfaces unto themselves on Today.

---

## 8 · Things that are NOT in scope here

These were considered and explicitly deferred:

- **Single-email-per-client composer.** Today, clicking a grouped row's primary action lands on the per-task detail (which already consolidates per-task work). A true client-level composer that bundles work across multiple tasks into one outbound email is a follow-up — the BE bundles per-task, not per-client.
- **Inline dismiss / snooze on state-alert rows.** The full alert lifecycle (escalation badge, dismissal, link to `/alerts`) lives on `AnnouncementBanner` (the canonical alert surface, see §4.1) and the `/alerts` page. The queue row is a derived "go act on it" entry, not the alert detail.
- **Filters / search on the queue.** AI prioritization is the filter. Override via `/clients` for explicit per-client work.
- **Empty-state copy on the queue.** When the firm truly has nothing to chase, the queue header still renders with `0 rows · 0 items`. A reassurance string (e.g. _"All clear — N clients on track"_) is a follow-up.
