# AlertDetail — `disaster_extension` Action Spec

_Companion to [federal-forms-and-alerts-debrief.md](./federal-forms-and-alerts-debrief.md). Scope: the click-through state from Today (`/alerts/:id`) for alertType=`disaster_extension` only. Other alertTypes get their own spec — they have different action shapes._

---

## 1. Why this alert deserves its own spec

`disaster_extension` is the one alertType where:

- The action is **mechanical** (move dates) — Sarah's judgment is "yes, all my FL clients are affected" not "what should I do."
- The action is **safe with undo** (deadline mutations are reversible).
- The action **fans out** (one alert × N clients × M filings each).
- The **stakes are high** (wrong move = wrong deadlines on every affected client = chase loop fires for the wrong dates).

Get this one right and the other 5 alertTypes get easier.

---

## 2. Page anatomy (top → bottom)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│  ← Alerts · Florida DOR · disaster_extension · Detected 2h  │
│  Tax relief for taxpayers affected by Hurricane Idalia      │
│  Filing deadlines extended to May 14 for designated counties│
│  [Source ↗] [Authority: FL Dept. of Revenue]                │
├─────────────────────────────────────────────────────────────┤
│ VERDICT (loud)                                               │
│  Affecting 4 of your 49 clients · 14 deadlines moving       │
│  [Select all] [Clear all]                                    │
│                                                              │
│  ☑ Acme LLC (S-Corp · FL · Pinellas County)        5 ▾     │
│       ☑ Form 1120-S — Mar 15 → May 14                       │
│       ☑ Form 941 (Q1) — Apr 30 → May 14                     │
│       ☑ Form 1040-ES (Q2) — Jun 16 → Jun 16 [outside window]│
│       ☑ Schedule K-1 — Mar 15 → May 14                      │
│       ☑ FL CIT — Apr 1 → May 14                             │
│                                                              │
│  ☑ Bob Williams (Individual · FL · Hillsborough)   2 ▾     │
│       ☑ Form 1040 — Apr 15 → May 14                         │
│       ☑ Form 1040-ES (Q1) — Apr 15 → May 14                 │
│                                                              │
│  ☑ Carol Reyes (LLC · FL · Pinellas)               3 ▸     │
│  ☑ Dan Patel (S-Corp · FL · Pasco)                 4 ▸     │
├─────────────────────────────────────────────────────────────┤
│ NOT AFFECTED (16 FL clients) ▸                               │
│  (collapsed — open to override)                              │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE ▸                                                   │
│  (collapsed — affected counties, AI confidence, related     │
│   alerts, source notice excerpt)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR                                            │
│  [Primary] Move 14 deadlines to May 14                      │
│  [Secondary] Adjust + draft emails                          │
│  [Overflow ⋮] Dismiss · Snooze · Share                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Header

| Element | Source | Notes |
|---------|--------|-------|
| Back link | router | Returns to Today or `/alerts` depending on entry |
| State chip | `announcement.stateCode` | "Florida" or 2-letter "FL" — render full name when space allows |
| AlertType chip | `announcement.alertType` | "Disaster extension" (humanized; never raw enum) |
| Detected timestamp | `announcement.detectedAt` | Relative ("2h ago"), tooltip with absolute |
| Title | `announcement.title` | Pulled from notice as-is |
| Subtitle | parsed `affectedCounties[]` + `newDeadline` | "Filing deadlines extended to **May 14** for **Pinellas, Hillsborough, Pasco**" |
| Source link | `announcement.sourceUrl` | External link icon, opens in new tab |
| Authority chip | `announcement.authority` | "FL Dept. of Revenue" — clickable for Authority detail page (P2) |

---

## 4. Verdict section (the load-bearing part)

### 4.1 Headline

```
Affecting 4 of your 49 clients · 14 deadlines moving
```

Two numbers, both load-bearing:

- **4 clients** — the persona-relevant count ("how many of MY clients?")
- **14 deadlines** — the actual mutation count (matches the action verb)

If 0 clients affected:
```
None of your clients are in Pinellas, Hillsborough, or Pasco.
[Dismiss with reason] [Add a client in this state] [Open source ↗]
```

### 4.2 Per-client expandable rows

Each row collapsed by default to one line:

```
☑ Acme LLC (S-Corp · FL · Pinellas County)        5 ▸
```

Components:

| Slot | Content | Behavior |
|------|---------|----------|
| Checkbox | per-client toggle | Toggles ALL filings within (cascade); unchecks if any child unchecked |
| Name | `client.name` | Click navigates to ClientDetail (open in new tab — modifier-key + click) |
| Metadata | `entityType · primaryState · matchedCounty` | The matchedCounty is the load-bearing detail — proves WHY this client matched |
| Count chip | `affectedDeadlines.length` | Summary of how many filings will move |
| Expand caret | toggles row open | Reveals per-filing list |

Expanded view shows each filing:

```
☑ Form 1120-S — Mar 15 → May 14
☑ Form 941 (Q1) — Apr 30 → May 14
☐ Form 1040-ES (Q2) — Jun 16 → Jun 16 [outside window]
```

Per-filing slots:

| Slot | Content | Behavior |
|------|---------|----------|
| Checkbox | per-filing toggle | Toggles JUST this deadline; updates parent client checkbox state (indeterminate if mixed) |
| Form name | `deadline.form` | Plain text, not a link |
| Date transition | `oldDate → newDate` | Old date strikethrough; new date bold |
| Annotation chip | one of: `[outside window]`, `[already filed]`, `[different jurisdiction]`, `[manually entered]` | Greyed/disabled when truly excluded; warning-styled when borderline |

### 4.3 Selection rules

- **Default state**: all clients checked, all in-window deadlines checked.
- **Pre-excluded** (auto-unchecked, but user can override):
  - Deadlines outside the affected window (already past or after extension end)
  - Deadlines already marked `filed` or `completed`
  - Deadlines for clients NOT in affected counties (only shown in "Not affected" section)
- **Indeterminate state**: parent client checkbox shows ▣ when some children checked
- **Select all / Clear all**: scope is ALL affected clients (not "Not affected" section)

### 4.4 "Not affected" section (collapsed)

Below the affected list, a collapsed disclosure:

```
NOT AFFECTED (16 FL clients) ▸
```

Open it → list of all clients in the alert's state who DIDN'T match. Each row shows WHY:

```
Eve Chen (Individual · FL · Miami-Dade)        — county not in affected list
Frank Wong (LLC · FL · Pinellas)               — already filed all matching deadlines
Grace Lee (Individual · GA · Atlanta)          — wrong state
```

Each row has a "Add to affected" override button. Use case: AI parsed "Pinellas County" but Sarah knows the client's mailing address is in Hillsborough → manual add.

When user adds a non-matched client, write to `announcement_matches.manual_overrides` so we can learn from these (if the same county keeps getting added, our parser has a gap).

---

## 5. Evidence panel (collapsed below the fold)

Open → expandable card with:

| Subsection | Content |
|------------|---------|
| **Source notice** | Title + first 2 paragraphs of body + link to full notice |
| **Affected counties** | List of all parsed counties (chips) — admin can flag a wrong parse |
| **Effective dates** | Window start / end / extension date (all 3, formatted) |
| **AI parse** | Confidence chip (high/medium/low) + which fields LLM parsed vs regex |
| **Related alerts** | Linked alerts in the same cluster (e.g., IRS + FL DOR both announce same Idalia relief — show as siblings) |
| **Match logic** | Per-client matching reason: "Matched on `client.primaryState=FL` AND `client.county IN [Pinellas, Hillsborough, Pasco]`" |

Goal: anyone reviewing the alert can audit *why* it matched what it matched.

---

## 6. Action bar (sticky bottom)

Five actions, ordered by destructiveness (least → most). Visual ranking via size/color, not just position.

### 6.1 Primary — "Move N deadlines to {newDate}"

The headline action.

**Label**: dynamic — `"Move {selectedDeadlineCount} deadlines to {newDeadline}"`. Updates as user toggles selection.

**Disabled state**: when `selectedDeadlineCount === 0`. Hover tooltip: "Select at least one deadline."

**On click**:

1. Optimistic UI: action bar collapses to "Moving 14 deadlines…" with spinner
2. BE call: `trpc.announcements.applyDeadlineExtension({ announcementId, selections: [{ deadlineId, newDate }] })`
3. BE in transaction:
   - `UPDATE deadlines SET due_date=$new, original_due_date=COALESCE(original_due_date, due_date) WHERE id = ANY($selectedIds)`
   - For each: `INSERT INTO activity_events (type='batch_adjust', metadata={announcementId, oldDate, newDate, undoToken})`
   - `UPDATE announcements SET acted_at=now(), acted_by=user WHERE id=$announcementId`
4. Return: `{ updatedCount: 14, undoToken: 'uuid' }`
5. FE flash banner (top of page, not modal): `"14 deadlines moved · Undo"` — auto-dismisses after 5 minutes
6. Page transitions to "ACTED" state: action bar shows "14 deadlines moved · Undo within 5 min"

**Undo**:
- Click "Undo" → `trpc.announcements.undoDeadlineExtension({ undoToken })`
- BE: restores from `original_due_date`; writes `activity_events (type='batch_adjust_undo', ...)` 
- After 5 min, undo token expires → fall back to manual per-deadline edit on each client
- Why 5 min: long enough to catch "wait, that wasn't right" instinct; short enough that we can clean up `activity_events.undo_tokens` cheaply

### 6.2 Secondary — "Adjust + draft emails"

Combines the deadline move with email composition.

**On click**: opens `BatchNotifyModal` pre-populated with:
- Selected clients (carried from the verdict block)
- Email subject template: `"Update on your {filingType} deadline"`
- Email body template: Mode D draft per client, templated with new deadline date and the extension reason
- Toggle: "Move deadlines + send emails" (default on) vs "Just send emails" (in case Sarah already moved them via primary verb)

**Why combine**: most disaster_extension cases benefit from a heads-up email. ("Hurricane Idalia: your filing deadline moved to May 14 — no rush on the W-2.")

**On confirm**:
1. BE call: `trpc.announcements.applyAndNotify({ announcementId, selections, emailDrafts })`
2. BE in transaction: deadline updates + email drafts created + Resend send queued
3. Flash banner: `"14 deadlines moved · 4 emails queued · Undo deadlines"` (note: undo only undoes deadlines, not emails — they're already sent)

### 6.3 Tertiary — Dismiss

Click → `DismissWithReasonDialog` opens (NOT inline — every dismiss requires a reason for audit).

**Pre-canned reasons**:
- "Already handled outside the system"
- "Doesn't actually apply to my clients" (helps the AI learn — write to `announcement_feedback`)
- "Will revisit later" (defaults to 7-day snooze instead of dismiss)
- Custom (free-text required)

**On confirm**:
- `UPDATE announcements SET dismissed_at=now(), dismiss_reason=$reason WHERE id=$id`
- Removes from Today queue and `/alerts` (visible in `/alerts?filter=dismissed`)
- Undismiss available within 24h via `/alerts?filter=dismissed`

### 6.4 Snooze (also available as universal Today action)

Click → small dropdown: 7d / 14d / 30d.

**On click**:
- `UPDATE announcements SET snoozed_until=now() + $duration WHERE id=$id`
- Removes from Today; returns at `snoozed_until`
- Snooze count tracked — after 3 snoozes, suggest dismiss

### 6.5 Share

Click → small popover:
- Copy link (clipboard) — link includes `?ref=share` so we can attribute
- Send to teammate (if firm has multiple users) — internal in-app message
- Slack (if Slack integration set up — P2)

---

## 7. State diagram

```
       ┌─────────────────┐
       │   PENDING       │ ← initial state when alert lands
       │ (in Today queue)│
       └─────────────────┘
              │
   ┌──────────┼──────────┬──────────┐
   ↓          ↓          ↓          ↓
┌─────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐
│  ACTED  │ │SNOOZE│ │DISMISSED │ │ EXPIRED  │
│(applied │ │      │ │(w/ reason│ │(time-based│
│deadline │ │      │ │          │ │ never    │
│cascade) │ │      │ │          │ │ acted)   │
└─────────┘ └──────┘ └──────────┘ └──────────┘
   │          │          │
   │ undo     │ resurface│ undismiss (24h)
   │ (5min)   │ at TS    │
   ↓          ↓          ↓
   PENDING ←─┴──────────┘
```

Each state writes to `activity_events` with the transition. The `expired` state catches alerts that auto-resolve (e.g., extension date passes — alert was never acted on but is no longer actionable). UI shows expired alerts in `/alerts?filter=expired` for retroactive review only.

---

## 8. Data contract — what BE needs to return

### `trpc.announcements.detailWithAffected({ announcementId })`

Returns:

```typescript
{
  announcement: {
    id: string;
    stateCode: StateCode;
    alertType: 'disaster_extension';
    title: string;
    summary: string;       // parsed subtitle ("...extended to May 14...")
    sourceUrl: string;
    authority: string;
    detectedAt: timestamp;
    parsedAt: timestamp;
    parseConfidence: 'high' | 'medium' | 'low';

    // alertType-specific fields
    affectedCounties: string[];
    oldDeadline: ISODate | null;   // when alert applies to a single original date
    newDeadline: ISODate;
    windowStart: ISODate;          // alerts apply to filings due in [windowStart, windowEnd]
    windowEnd: ISODate;

    // metadata
    relatedAnnouncementIds: string[];
    actedAt: timestamp | null;
    dismissedAt: timestamp | null;
    dismissReason: string | null;
    snoozedUntil: timestamp | null;
  };

  affected: Array<{
    client: {
      id: string;
      name: string;
      entityType: string;
      primaryState: StateCode;
      matchedCounty: string;       // which county made it match
    };
    matchReason: string;           // human-readable: "primaryState=FL AND county=Pinellas"
    matchConfidence: 'high' | 'medium' | 'low';
    deadlines: Array<{
      id: string;
      form: string;
      jurisdiction: string;
      currentDueDate: ISODate;
      proposedNewDate: ISODate;    // computed BE-side from windowEnd or alert's newDeadline
      excludeReason: 'outside_window' | 'already_filed' | 'different_jurisdiction' | null;
    }>;
  }>;

  notAffected: Array<{
    client: { id, name, entityType, primaryState };
    reason: 'wrong_state' | 'wrong_county' | 'no_deadlines_in_window' | 'all_already_filed';
  }>;
}
```

### `trpc.announcements.applyDeadlineExtension({ announcementId, selections })`

Input:
```typescript
{
  announcementId: string;
  selections: Array<{ deadlineId: string; newDate: ISODate }>;
}
```

Returns:
```typescript
{
  updatedCount: number;
  undoToken: string;     // expires server-side after 5 min
  expiresAt: timestamp;
}
```

### `trpc.announcements.undoDeadlineExtension({ undoToken })`

Idempotent — calling twice returns the same `restoredCount`.

---

## 9. Edge cases (must handle)

| Case | Behavior |
|------|----------|
| Client has multiple deadlines for the same form (e.g., quarterly 941s) | List each separately with its own checkbox + period chip ("Q1") |
| Client deadline already past `newDeadline` (i.e., extension is BACKWARDS) | Pre-uncheck, annotation `[no extension needed — already after new date]` |
| Client deadline marked `filed` after alert's detection time | Pre-uncheck, annotation `[already filed — no change needed]` |
| Multiple alerts overlap (e.g., IRS + FL DOR both extend) | Show in "Related alerts" section. If both have applied, show "this deadline already moved by [other alert]" annotation; per-checkbox is greyed |
| Client moved out of state since last sync | Treat as wrong state in "Not affected" — surface "Override?" button |
| User unchecks ALL → primary verb disabled | Tooltip: "Select at least one deadline" |
| Network error mid-apply | Atomic transaction — either all selected updates apply or none. Show error: "Move failed. No changes saved. Retry?" |
| Concurrent edit (another user actions same alert) | Optimistic lock on `announcement.acted_at` — if changed, show: "Another user just acted on this alert. Refresh to see." |
| Alert was auto-resolved by `expiresAt` while user was reviewing | Re-fetch on page focus; show banner "This alert is no longer actionable" |

---

## 10. Copy

| Element | Copy |
|---------|------|
| Page title (browser tab) | `"FL DOR · Disaster extension · DueDateHQ"` |
| Verdict header (N>0) | `"Affecting {affectedCount} of your {totalActiveClients} clients · {totalDeadlines} deadlines moving"` |
| Verdict header (N=0) | `"None of your clients are in {affectedCounties.join(', ')}."` |
| Primary verb | `"Move {selectedDeadlineCount} deadlines to {newDeadline}"` |
| Primary verb (selectedCount=0) | `"Move 0 deadlines"` (greyed) — tooltip on hover |
| Secondary verb | `"Adjust + draft emails"` |
| Confirmation flash (success) | `"{movedCount} deadlines moved · Undo"` |
| Confirmation flash (with email) | `"{movedCount} deadlines moved · {emailCount} emails queued · Undo deadlines"` |
| Error flash | `"Move failed — no changes saved. Retry"` |
| Empty state CTA | `"Dismiss with reason"` (since no action makes sense) |
| Annotation: outside window | `[outside affected window]` (grey) |
| Annotation: already filed | `[already filed — no change needed]` (grey) |
| Annotation: different jurisdiction | `[CA filing — alert is FL only]` (grey) |
| Match reason tooltip | `"Matched on primaryState=FL AND county∈{Pinellas, Hillsborough, Pasco}"` |

**Tone**: declarative, concrete, no jargon, no exclamation marks. Sarah is a busy professional, not a beginner. Every word does work.

---

## 11. Telemetry

Events to emit (per `activity_events` + analytics):

| Event | When | Payload |
|-------|------|---------|
| `alert_viewed` | Page mount | `{ announcementId, alertType, source: 'today_inline' \| 'today_open' \| 'alerts_list' \| 'deep_link' }` |
| `alert_selection_changed` | Checkbox toggle | `{ announcementId, selectedClientCount, selectedDeadlineCount }` (debounced) |
| `alert_acted` | Primary verb click | `{ announcementId, deadlineCount, includedEmail: bool, durationFromMount: ms }` |
| `alert_dismissed` | Dismiss confirm | `{ announcementId, reason, durationFromMount: ms }` |
| `alert_snoozed` | Snooze click | `{ announcementId, durationDays }` |
| `alert_undone` | Undo click | `{ announcementId, undoToken, durationFromAct: ms }` |

Goal: measure (a) how often Sarah acts vs dismisses vs ignores, (b) how long she spends on the page (proxy for cognitive load), (c) undo rate (proxy for "was the action right?"). Bake into Mode E feedback loop.

---

## 12. What's NOT in this spec (intentionally)

- **Multi-user collaboration on the same alert** (e.g., two CPAs at the same firm). Optimistic lock + warning is enough; real-time co-editing is over-engineered for this surface.
- **Customizing the new deadline per client** (e.g., "move this client to May 14, but that one to May 21 because they're appealing"). If Sarah needs that level of control, she should use per-client deadline edit on ClientDetail. AlertDetail is for the batch case.
- **Moving deadlines for clients in NON-affected geographies** (manual override of the geography filter). Possible via "Add to affected" in the Not Affected section, but we don't surface this in the primary flow.
- **Changing the alert's parsed metadata** (county, dates). That's an admin reviewer queue concern, not a CPA concern. AlertDetail is read-only on parse output.
- **AI-suggested per-client commentary in email drafts** ("Acme is delinquent — soft escalation"). That's a Mode D enhancement — separate scope.

---

## 13. Build order (proposed)

1. **BE — `detailWithAffected` procedure** (replaces existing `getById` for disaster_extension type)
2. **BE — `applyDeadlineExtension` + `undoDeadlineExtension` procedures** (transactional)
3. **FE — Verdict section refactor** (per-client expandable rows + per-filing checkboxes)
4. **FE — "Not affected" collapsed section + override flow**
5. **FE — Action bar restructure** (primary verb + secondary "Adjust+notify" + overflow)
6. **FE — Flash banner with undo (Sonner-based)**
7. **FE — Evidence panel polish** (already partially in place)
8. **Telemetry events**
9. **End-to-end test** (Playwright): land on alert with 4 clients × 14 deadlines → click primary → assert 14 deadlines moved + flash visible → click undo → assert all restored

Estimate: ~1 week solo, less if BE + FE parallelized.

---

_End of spec._
