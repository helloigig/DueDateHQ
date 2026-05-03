---
name: Today page
description: The CPA's daily entry surface — a focused work queue (gap-first), a 14-day timeline, and at-most-one state-notification banner. Designed against docs/design-system.md; every token is cited by name.
sidebar destination: 1 of 7 (Today / Clients / Alerts / Inbox / Chases / Done / Settings)
personas: Sarah Mitchell (49 clients, primary) · Yan Jing (600 clients, scale-test)
last-updated: 2026-05-03
---

# Today page

## Goal

A CPA arrives at Today after checking the bell on their phone (or at desk-start). They want to: **see what needs action today → take that action → leave**. The page is a focused work queue, not a destination. Per [memory: dashboard is audit + batch], it is the surface of last resort — the *integrated channels* (Gmail, Calendar, push) reach the CPA first; Today is where they come to **bulk-process** what those channels surfaced.

> **Anti-goal:** Today is NOT a "morning dashboard" with KPIs and charts. KPIs live on a (future) Insights surface. Today is the work, not the read.

## What this surface protects

- **Gap > fill.** What hasn't been done is loudest. Confirmed items collapse by default. (Per [memory feedback on gap-first hierarchy].)
- **One next action.** The page surfaces the queue; each row carries one indigo CTA. Per **T2** — the user's eye is never asked to choose between two equally-loud actions.
- **Calm, not celebratory.** An empty queue says "Nothing to do today." — not "All caught up!". Per **T8**.

## DNA preserved (from `docs/design-system.md`)

```
Color tokens:    --canvas, --surface, --sunken, --ink-900/700/500/400,
                 --accent, --accent-soft, --accent-ink,
                 --line, --warn-bg/border/ink, --danger-bg/border/ink,
                 --info-bg/border/ink, --ok-bg/border/ink
Type tokens:     --type-page-title, --type-section-title, --type-body,
                 --type-body-sm, --type-label, --type-eyebrow,
                 --type-numeric, --type-numeric-cents
Shape tokens:    --radius-md (rows, banner), --radius-pill (status pills, CTA),
                 --radius-lg (collapsed-section card)
Spacing:         --sp-3 / --sp-4 / --sp-6 / --sp-8 / --sp-12
Motion:          --ease-out-strong, --dur-fast, --dur-medium, .animate-ddhq-fade-up
Components:      <Button variant="primary"|"ghost">, <StatusPill>,
                 <Banner variant="info">, <EmptyState>, <Date>
Taste IDs:       T1 (numbers as objects), T2 (one accent / one action),
                 T4 (status as pill / never paint), T5 (sidebar groups + flush canvas),
                 T6 (density via vertical air), T8 (dashboard is desk, not stage)
Vocabulary:      Action Queue, Timeline, chase, service package, received_confirmed,
                 state notification
```

---

## Anatomy

```
┌──────────────────────── canvas (--canvas) ──────────────────────────────┐
│  ┌─ top bar (60px, --surface, 1px --line bottom) ────────────────────┐  │
│  │ [☰ Sarah Mitchell ▾]   [⌘K Search clients, deadlines, files…]    │  │
│  │                                              [🔔 3]  [👤]          │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│  ┌─ sidebar 240 ─┐  ┌─ main canvas (max 800, centered, padding 32) ──┐  │
│  │               │  │                                                  │  │
│  │ ⌂ Today  ●    │  │  Today, May 3                                    │  │ ← --type-page-title
│  │ ⊞ Clients     │  │  ════════════════════════════════════════════    │  │
│  │ ⏰ Alerts (3) │  │                                                  │  │
│  │               │  │  ┌─ Banner (info) ──────────────────────────┐   │  │
│  │ WORKFLOWS     │  │  │ ℹ  IRS revised Form 941. 72 of your      │   │  │
│  │ ⊠ Inbox       │  │  │   clients are affected. Review impacts → │   │  │
│  │ ✉ Chases      │  │  └──────────────────────────────────────────┘   │  │
│  │ ✔ Done        │  │                                                  │  │
│  │               │  │  Action Queue                       17 items     │  │ ← section header
│  │ PERSONAL      │  │  ────────────────────────────────────────────    │  │
│  │ ⚙ Settings    │  │                                                  │  │
│  │               │  │  Liam Basil                          [Send →]    │  │ ← row 1
│  │               │  │  W-2 missing · Tax 2025 · CA · LLC               │  │
│  │               │  │  [● Overdue 2d]                                  │  │
│  │               │  │  ────────────────────────────────────────────    │  │
│  │               │  │  Ellie Marksons                      [Open →]    │  │ ← row 2
│  │               │  │  Sent reply · awaiting your review               │  │
│  │               │  │  [Action required]                               │  │
│  │               │  │  ────────────────────────────────────────────    │  │
│  │               │  │  John Gruvman                        [Send →]    │  │ ← row 3
│  │               │  │  Awaiting K-1 from passthrough · Tax 2025 · NY   │  │
│  │               │  │  [Due in 4d]                                     │  │
│  │               │  │                                                  │  │
│  │               │  │  ... 14 more rows ...                            │  │
│  │               │  │                                                  │  │
│  │               │  │  ─── 48px gap ───                                │  │
│  │               │  │                                                  │  │
│  │               │  │  Timeline                       Next 14 days     │  │ ← section header
│  │               │  │  ────────────────────────────────────────────    │  │
│  │               │  │                                                  │  │
│  │               │  │  TUE  May 5     ●●            2 deadlines       │  │ ← day row
│  │               │  │  WED  May 6     ●             1 deadline        │  │
│  │               │  │  FRI  May 8     ●             1 deadline        │  │
│  │               │  │  ─                                                │  │
│  │               │  │  MON  May 15    ●●●●●●●●●●●●●●●●●  17 deadlines │  │ ← high-density day
│  │               │  │                 Federal tax filing               │  │
│  │               │  │                                                  │  │
│  │               │  │  ─── 48px gap ───                                │  │
│  │               │  │                                                  │  │
│  │               │  │  Confirmed today  (3)                       ▼    │  │ ← collapsed (gap-first)
│  │               │  │                                                  │  │
│  └───────────────┘  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Reading order (eye scan path)

`Page title → Banner (if any) → Action Queue rows top-to-bottom → Timeline → (Confirmed today, only if expanded)`

The Action Queue dominates because **it is the work**. Timeline is glance-context (planning the next two weeks). Confirmed-today is collapsed because **showing what's done competes with showing what isn't** — and per the gap-first principle, the gap wins.

---

## Component specifications

### 1. Top bar — applied as-is from design system §4.9

- 60px tall, `--surface` bg, `1px --line` bottom border
- Workspace switcher (left), search bar (center, max 480px), bell + avatar (right)
- Bell shows count chip (`3`) when there are unread alerts — uses neutral status pill styling per §4.2
- Search bar is the cmd+K affordance per §4.9 — clicking opens the centered command palette modal

### 2. Page title

```jsx
<h1 className="--type-page-title">
  Today, <Date format="MMM-D" value={today} className="text-ink-700" />
</h1>
```

- `--type-page-title` (28px / 500 / -0.01em tracking)
- The date renders inline at slightly muted ink (`--ink-700`) to keep the eye on "Today" first.
- Per **T8**, no display face. Per [memory: dates only], no time-of-day.
- 32px gap below title before the next element.

### 3. State notification banner (conditional)

Renders only when there is an active state notification (IRS announcement, postmark inbox failure, multi-client impact). At most ONE banner is visible at a time — if there are multiple, the highest-severity one shows; the rest live in the bell + `/alerts` page.

Uses `<Banner variant="info|warn|danger">` from design system §4.11.

```
┌───────────────────────────────────────────────────────────────────┐
│ ℹ  IRS revised Form 941. 72 of your clients are affected.         │  ← --info-bg + 4px --info-solid left rule
│    Review impacts →                                          ✕    │  ← inline link, NOT a button (T7 + §4.11)
└───────────────────────────────────────────────────────────────────┘
   --radius-md · padding 12/16 · 1px --info-border · ink --info-ink
```

- **Variant pick:** `info` for "you should know" (most state notifications); `warn` for "your action needed soon"; `danger` for "blocking — act now". Most banners are `info`.
- **Action:** inline underlined link (`Review impacts →`) — opens `/alerts` page filtered to the notification's affected clients. NEVER a primary button (per **T7** + §4.11).
- **Dismiss:** ✕ at right — dismisses for this session only. The notification stays in the bell + `/alerts` page; banner re-appears on next page load if unresolved.
- **Spacing:** 24px gap below banner before Action Queue.

> **Why never multiple banners.** Per **T2** — one accent per viewport. A stack of two banners means the user has to choose which one to read, which means neither lands. The bell and `/alerts` page exist for the queue.

### 4. Action Queue section

The work surface. Today's actionable items, sorted by urgency (overdue first → due-today → due-soon → others).

#### 4a. Section header

```
Action Queue                                              17 items
─────────────────────────────────────────────────────────────────
```

- Title: `<h2>` at `--type-section-title` (20px / 500)
- Right-side count: `<span>` at `--type-body-sm` (`13px`) at `--ink-500`, tabular-nums
- Below: 1px `--line` divider, full-width
- Count uses **T1** — `tabular-nums`; "17 items" reads instantly.

#### 4b. Action Queue row

```
┌──────────────────────────────────────────────────────────────────┐
│  Liam Basil                                          [Send →]    │  ← row 56–72px tall
│  W-2 missing · Tax 2025 · CA · LLC                               │
│  [● Overdue 2d]                                                  │
└──────────────────────────────────────────────────────────────────┘
   padding 16/0 · hover bg --surface-hover · 1px --line bottom
```

**Anatomy zones:**

| Zone | Position | Token | Behavior |
|---|---|---|---|
| Client name | top-left | `--type-body` (14/500) `--ink-900` | 1-line truncate; opens client detail on click |
| Primary action | top-right | `<Button variant="primary" size="sm">` | Pill, indigo. Verb + arrow ("Send →" / "Open →" / "Review →") |
| Meta line | second line, left | `--type-body-sm` (13/400) `--ink-500` | 1-line truncate; service package · jurisdiction · entity type |
| Status pill | third line, left | `<StatusPill>` per §4.2 | Always visible. Variant matches urgency. |
| Row container | full width | padding `16px 0`; bottom `1px --line` | Hover `--surface-hover` bg. Last row no border. |

**Hit-target separation (§4.0 rule 4):** the row itself is tappable (opens client detail). The "Send →" button has its own 44×44 hit area + `stopPropagation` — clicking it sends the chase, not opens the row.

**Status pill variants by row state:**

| Row state | Pill variant | Pill text | Dot |
|---|---|---|---|
| Overdue | `danger` | `● Overdue 2d` (relative days) | Yes (filled `--danger-solid`) |
| Due today | `warn` | `● Due today` | Yes (filled `--warn-solid`) |
| Due soon (1–7d) | `warn` | `Due in Nd` | No |
| Awaiting CPA review | `info` | `Action required` | No |
| Awaiting client | `neutral` | `Awaiting client` | No |
| AI-suggested action | `info` | `AI-suggested` (uses .animate-ddhq-ai-shimmer) | No |

**Action verb mapping (microcopy):**

| What the row needs | Button label |
|---|---|
| Send a chase to the client | `Send →` |
| Review a client's reply | `Open →` |
| Review an AI-drafted email before sending | `Review →` |
| Confirm a document was received (the §5.3 moment) | `Mark received` |
| File a deadline (rare from Today; usually deeper) | `File →` |

**Truncation policy:**
- Client name — 1 line, ellipsis. (Never truncates short of full name in normal cases — names rarely exceed 30 chars.)
- Meta line — 1 line, ellipsis. The order matters: service package first (most informative), then jurisdiction, then entity.
- Status pill + button — never truncate. Have fixed minimum widths.

**Choreography (per §4.3 + §11):**
- Enter (new row): `.animate-ddhq-fade-up` — 220ms `--ease-out-strong`. Stagger 60ms when ≥3 new rows.
- Exit (row removed after action): opacity `1 → 0` over 140ms, then collapse height 200ms.
- Hover: bg → `--surface-hover` instant (no transition — per Emil's frequency rule, row hover happens hundreds of times/day).
- Press CTA: button scales `1 → 0.98` over 80ms, then back. CTA itself triggers either inline send (with toast) or opens a modal (if input needed).

#### 4c. Action Queue states

| State | Composition |
|---|---|
| **Default (≥1 item)** | Section header + N rows as specified above |
| **Empty (0 items)** | `<EmptyState>` from §4.10. Icon: `<CheckCircle>` at 48px `--ink-300`. Title: "Nothing to do today." Body: "We'll surface chases, replies, and approvals here as they need your attention." No CTA. |
| **Loading (initial fetch)** | 4 skeleton rows, each 56px tall, `--sunken` bg, `--radius-md`. No animation beyond the standard shadcn skeleton shimmer. |
| **Error (fetch failed)** | Banner `danger` variant at top of section: "Couldn't load action queue. [Retry]" — inline link, not button. |

### 5. Timeline section

Glance-view of the next 14 days. Compressed — one row per day, dot-stack indicating client count, primary deadline label.

#### 5a. Section header

```
Timeline                                              Next 14 days
─────────────────────────────────────────────────────────────────
```

Same pattern as Action Queue — `--type-section-title` left, muted right-meta, hairline divider below.

#### 5b. Day row

```
┌──────────────────────────────────────────────────────────────────┐
│  TUE  May 5      ● ●                            2 deadlines      │
└──────────────────────────────────────────────────────────────────┘
   padding 12/0 · 1px --line bottom · hover bg --surface-hover
```

**Anatomy zones:**

| Zone | Position | Token | Behavior |
|---|---|---|---|
| Day-of-week | far left | `--type-eyebrow` (11/600 UPPERCASE) `--ink-400` | Width 48px fixed, tabular |
| Date | next | `--type-body-sm` (13/500 tabular-nums) `--ink-700` | Width 80px fixed |
| Dot stack | center | `<DotStack count={N} />` see 5c | Variable width, max 320px |
| Count + label | right | `--type-body-sm` `--ink-500` | "N deadlines" or "N deadlines (label)" |

**Click behavior:** clicking a day row opens `/timeline?date=YYYY-MM-DD` (the timeline detail page) showing all clients with deadlines that day.

#### 5c. DotStack — a new primitive (added in this surface)

A horizontal row of small filled circles, one per affected client, color-coded by status. **Caps at 17 visible dots; beyond that, render `15 ●●●●●●●●●●●●●●● + 23` showing 15 dots and `+ 23` overflow at `--type-body-sm` `--ink-500`.**

- Dot size: 6px circle, 4px gap. Fits ~17 dots in 160px.
- Color logic: dot fills with the most-urgent status across the day's clients (`danger` if any overdue, else `warn` if any due-today, else `neutral`).
- Per **T1** + **T6** — gives instant density signal without becoming a chart.

> **Anti-replication note (§9 from design-system):** DotStack does NOT exist in Mercury, Sana, or Oku — it is invented for DueDateHQ's specific information shape (deadlines bunch on calendar days). Honors **T1** (numbers as objects, here as visual count), **T4** (status carried as color in tiny pill-circles, never as full-row paint), and **T6** (density as scannable rhythm).

#### 5d. Timeline empty / sparse states

| State | Composition |
|---|---|
| **Default (≥1 day with deadlines in next 14d)** | Day rows as above. Days with no deadlines are SKIPPED (not rendered as empty rows). Visual gap of ~1 row height between consecutive listed days handles the "skip" naturally. |
| **Empty (0 deadlines in next 14d)** | Inline message: `<div className="--type-body --ink-500 padding-y-24 text-center">No deadlines in the next 14 days.</div>` — no icon, no decoration. Per **T8**. |
| **Loading** | 3 skeleton day rows, same height as real rows. |

### 6. Confirmed today (collapsed by default — gap-first)

```
Confirmed today  (3)                                          ▼
```

**Closed state** (default):
- Single row, 40px tall.
- Title: `--type-body` (14/500) `--ink-700` (slightly muted — this is the "done" surface, it should not compete).
- Count in parentheses: `--type-body` `--ink-500`, tabular.
- Right: chevron `<ChevronDown>` 16px `--ink-400` — rotates 180° on expand (per §12.5 toggle pairs morph rule).
- Click anywhere on the row toggles expand.
- 1px `--line` divider above.

**Expanded state**:
- Below the toggle row: list of rows, same anatomy as Action Queue rows but with:
  - No primary action button (these are done — no work to do)
  - Status pill is `ok` variant: `[● Confirmed at 9:42a]` (the time of confirmation is OK to show — this is a log entry, not a deadline)
  - Row bg `--ok-bg` very subtly (or just kept `--surface` — pick based on prototype testing)
- Animation: expand uses `accordion-down` keyframe already in `tailwind.config.js` (200ms ease-out).

> **Why collapsed by default.** Per [memory: gap > fill] — what's done collapses; what's not done dominates. The CPA already saw the confirmation toast (.animate-ddhq-confirm) when it happened; surfacing the same info as a closed-by-default log honors the principle.

---

## Page-level states

### Loading state (initial page load — cold cache)

- Top bar renders immediately (uses cached user data).
- Page title renders immediately ("Today, May 3" — date is client-side).
- Banner area: skeleton bar (`--sunken` bg, 48px tall, `--radius-md`).
- Action Queue: 4 skeleton rows.
- Timeline: 3 skeleton day rows.
- Confirmed today: not rendered until data loads.
- All skeletons fade out and real content fades in via `.animate-ddhq-fade-up` once data arrives.
- **Per Emil's frequency rule:** no spinner on the page itself (page-load happens once per session). The skeletons ARE the loading affordance.

### Empty state (new user, no clients yet)

The page jumps straight to the empty-state version of the Action Queue (§4c — Empty), with copy adjusted:

```
       ┌───┐
       │ + │              ← 48px lucide <UserPlus>, --ink-300
       └───┘
   No clients yet.
   Add your first client to start tracking deadlines and chases.

   [Add client]            ← Primary button
```

Timeline section is hidden entirely. Confirmed-today is hidden entirely. Banner is hidden entirely. The page is JUST the empty state, vertically centered in the available space.

### Error state (network failure, API down)

- Top bar + page title still render.
- A single danger banner replaces all section content:
  ```
  ✕  Couldn't load Today. The server isn't responding.
     [Retry] · [Contact support]
  ```
- The two actions are inline links, not buttons (per §4.11).

### Reduced-motion behavior

- All `.animate-ddhq-fade-up` instances fall back to instant render (handled globally in `index.css`).
- `.animate-ddhq-confirm` (if a row flips to received_confirmed while user is on Today) falls back to instant bg + status swap, no glow.
- Toggle on Confirmed-today: rotation animation skipped; chevron swaps state instantly.

---

## Microcopy reference

| Surface | Copy | Why |
|---|---|---|
| Page title | `Today, May 3` | Factual. Date inline. **Not** "Welcome, Sarah" — Mercury did that, but per **T8** Today is desk-not-stage; personalization belongs in less-frequent surfaces. |
| Action Queue title | `Action Queue` | Brand vocabulary (per design-system §10). Not "Tasks" / "To-do" / "Inbox". |
| Action Queue count | `17 items` | Plural always — even at `1 item`. Don't pluralize edge cases. |
| Empty queue | `Nothing to do today.` | Calm fact. Not "All caught up!" — that's a celebration; we don't celebrate baseline. |
| Empty queue body | `We'll surface chases, replies, and approvals here as they need your attention.` | Tells the user what kinds of items will appear. |
| Timeline title | `Timeline` | Plain. Not "Upcoming" / "Coming up" / "What's next". |
| Timeline meta | `Next 14 days` | Specific. Not "Coming up". |
| Timeline empty | `No deadlines in the next 14 days.` | Factual. No exclamation. |
| Confirmed today closed | `Confirmed today (3)` | Past tense, count visible. |
| Banner action link | `Review impacts →` | Verb + object + arrow. Not "Click here". |
| Row send action | `Send →` | Verb + arrow. Object is implied (the chase). |
| Row open action | `Open →` | Verb + arrow. |
| Row review action | `Review →` | Verb + arrow. Used when AI drafted something for the CPA to review. |
| Toast on send success | `Chase sent.` | 9 chars. Past tense. No emoji. |
| Toast on send failure | `Couldn't send. Retry, or check the email address.` | What failed + two suggestions. No "Oops". |

**Forbidden on this page:** "Welcome", "Hello", "Awesome", "Great job", "All caught up", "You're crushing it", any em-dash on a button, any emoji.

---

## Responsive behavior

| Breakpoint | Layout |
|---|---|
| `xs` / `sm` (< 768px) | Sidebar collapses to drawer (hamburger in top bar). Main canvas full-width with 16px padding. Action Queue rows: status pill drops to its own line under meta (3-line row instead of 3-zone-stacked). Timeline DotStack caps at 8 dots before overflow. |
| `md` (768–1023px) | Sidebar shows icon-only (60px). Main canvas full-width with 24px padding. Rows + Timeline as default. |
| `lg` and up (≥1024px) | Full sidebar (240px). Main canvas centered, max-width 800px (per design-system §5 `--content-max`). |
| `2xl` (≥1536px) | Same as lg — page does NOT widen further. The 800px content cap protects line length per design-system §5. |

**Touch targets:** all rows ≥56px on mobile (already ≥56px on desktop — no change). Status pills get +4px tap padding on mobile via larger hit area (visual stays the same).

---

## Anti-replication checklist (per design-system §9)

```
☐ Section count differs from Mercury Home (Mercury: 6+ KPI tiles; Today: 3–4 sections including banner)
☐ Component inventory differs (introduces DotStack — invented for this surface; not in §4 of design-system)
☐ Dominant compositional move is NOT Mercury's "Welcome, [Name] + KPI grid" — it's "queue + timeline with gap-first hierarchy"
☐ Every DNA token cited is named (no hex in the spec)
☐ Taste principles T1, T2, T4, T5, T6, T8 all traceable on this surface (see "DNA preserved" block above)
☐ Banner uses the right alert surface (info banner — NOT modal, NOT toast, NOT bell)
☐ Empty / loading / error states all designed
☐ Mobile collapse explicit (sm: rows reflow to 3-line; sidebar drawer)
☐ Reduced-motion fallbacks specified for every signature animation
```

---

## Implementation map

When this lands as code:

| Component | Path | Notes |
|---|---|---|
| `<TodayPage>` | `src/pages/Today.tsx` | The page route. Composes the four sections. |
| `<ActionQueueRow>` | `src/components/ActionQueueRow.tsx` | New. Row primitive — used here and (later) on Inbox. |
| `<TimelineDayRow>` | `src/components/TimelineDayRow.tsx` | New. Used here and (later) on a future `/timeline` page. |
| `<DotStack>` | `src/components/ui/DotStack.tsx` | **New ui primitive.** First addition to the design system from this surface — should be reflected back into `docs/design-system.md` §4 once shipped. |
| `<StatusPill>` | `src/components/ui/StatusPill.tsx` | New ui primitive (per design-system §4.2). |
| `<EmptyState>` | `src/components/ui/EmptyState.tsx` | New ui primitive (per design-system §4.10). |
| `<Banner>` | `src/components/ui/Banner.tsx` | New ui primitive (per design-system §4.11). |
| `<Date>` | `src/components/ui/Date.tsx` | New ui primitive — see design-system §3 "Date typography." |

> **After this ships:** `<DotStack>` is a new component invented for the Today surface. Per the design-system §9 protocol — if a second surface ends up wanting one, *promote it into the design system*. Do not invent a parallel. (Per [memory: one thing, one entrance, one name].)

---

## Open questions

1. **Yan Jing's scale (600 clients).** Action Queue at 49 clients = ~5–15 items/day (Sarah). At 600 clients = 50–100 items/day. Does the queue paginate? Group by service-package? Filter chips? **Decision deferred until Yan-scale validation; design above is Sarah-first.** Possible Phase 2 add: filter chips above the queue (`All · Tax 2025 · Bookkeeping · Payroll`) — pill chips per §4.9 pattern.
2. **Banner severity threshold.** What triggers a banner appearing here vs only living in the bell? Proposal: banner if (a) impact ≥10 clients OR (b) deadline ≤72h. Otherwise — bell only. Confirm with product before build.
3. **Timeline range.** Currently 14 days. Should there be a "Show more" link to extend, or is the rule "beyond 14 days, use the `/timeline` page"? Recommend the latter — keeps Today focused.
4. **Confirmed-today persistence.** Does the collapsed state persist across reloads (per-user preference) or reset to collapsed every visit? Recommend reset every visit — gap-first wins each time.
5. **Personalization.** Does the page title ever include "Sarah"? Recommend NO (per **T8** + microcopy table). Open if user research surfaces a real preference.

---

## Decisions made (vs. alternatives considered)

| Decision | Rejected alternative | Why |
|---|---|---|
| Page title `Today, May 3` | "Welcome, Sarah" / "Good morning, Sarah" | **T8** — desk, not stage. Personalization belongs in less-frequent surfaces (settings, the workspace switcher). Mercury chose stage-feel; we choose desk-feel. |
| Single column, 800px max | Two-column dashboard with KPI cards | Per [memory: dashboard is audit + batch] — Today is work, not metrics. KPIs (when they ship) live on a dedicated Insights surface. |
| Action Queue dominant; Confirmed collapsed | Confirmed expanded with strikethrough | **Gap-first** — done items collapse, undone items dominate. Confirmation already happened (toast). |
| One banner max (others → bell) | Banner stack | **T2** — one accent per viewport. Stack of banners means none lands. |
| DotStack on Timeline | Mini bar chart per day | Per **T1** — numbers as typographic objects. A 17-dot stack reads as "17" faster than a bar with numeric label, and inherits color from the underlying status, which a bar chart would muddle. |
| Skeleton rows, no spinner | Centered spinner | Per Emil's frequency rule — page-load happens many times/session; spinner = sluggish; skeleton = the loading IS the loading state. |
