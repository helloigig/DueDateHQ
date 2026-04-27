# DueDateHQ — Dashboard Screen Spec

> **v0.1** · Supplements `duedatehq-ia-flows.md` §3.1
> The single most important screen. What users see when they open the app.

---

## 1 · Design principles for this screen

1. **30-second rule** — user must know what to do within 30 sec of first paint
2. **Time-first grouping** — never group by client on this screen (defended in PRD §3.19)
3. **Urgency gradient** — most urgent items have the most visual weight
4. **No chrome tax** — filters, toggles, and controls stay collapsed by default
5. **Silence is signal** — if there's nothing to do, say so clearly; don't fill space

---

## 2 · Layout (desktop, > 1024px)

```
┌────────────┬──────────────────────────────────────────────────────────┐
│            │  🔍 Search (⌘K)     [+ New]    🔔 3    👤  Sarah K.      │
│ 🏠 Dashbd  │──────────────────────────────────────────────────────────│
│ 👥 Clients │                                                          │
│ 📡 State   │  ╔══════════════════════════════════════════════════════╗│  ← Conditional
│ 📅 Calend  │  ║ 🚨 6 clients affected · LA Hurricane extension      ║│    announcement
│            │  ║    New deadline: Feb 15, 2027      [ View → ]       ║│    banner
│            │  ╚══════════════════════════════════════════════════════╝│
│            │                                                          │
│            │  Monday, April 27 · Good morning, Sarah                  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │  ← Conditional
│            │  │ ⛔ OVERDUE (2)                                      │  │    (only if > 0)
│            │  │ ─────────────────────────────────────────────────  │  │
│            │  │ 3d late  · Riverside LLC    · 1065 state (CA)  ⋯  │  │
│            │  │ 1d late  · Mark Sullivan    · Q1 estimates     ⋯  │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │  ← Hero
│            │  │ THIS WEEK (8)            [ Filter ] [ Export ]     │  │
│            │  │ ─────────────────────────────────────────────────  │  │
│            │  │ ● Today    · Acme LLC         · 1065         ⋯    │  │
│            │  │ ● Today    · Johnson Indiv    · 1040 ext     ⋯    │  │
│            │  │ ○ Wed      · Bayou Corp       · 1120-S       ⋯    │  │
│            │  │ ○ Thu      · Patel LLC        · Q1 estimate  ⋯    │  │
│            │  │ ○ Fri      · Davis Family     · 1040         ⋯    │  │
│            │  │ ... 3 more                                         │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │  ← Secondary
│            │  │ THIS MONTH (23)                                    │  │
│            │  │ ─────────────────────────────────────────────────  │  │
│            │  │ Week of May 4    (5 deadlines)                ▸    │  │
│            │  │ Week of May 11   (8 deadlines)                ▸    │  │
│            │  │ Week of May 18   (6 deadlines)                ▸    │  │
│            │  │ Week of May 25   (4 deadlines)                ▸    │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │  ← Tertiary
│            │  │ LONG TERM (Q3+)                              ▸ 47  │  │    collapsed
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│ ⚙ Settings │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

---

## 3 · Section-by-section

### 3.1 Announcement banner (conditional)

**Visible when:** ≥ 1 unread announcement affecting this firm's clients
**Color:** red for disaster extensions; amber for PTE/penalty changes; blue for rate/form changes
**Content:** `[count] clients affected · [announcement title] · [View]`
**Behavior:** click → Announcement detail (Flow C). Dismissible with explicit confirm.
**If multiple:** show most recent; chevron to expand to stacked list.

### 3.2 Greeting line

`[Day, Date] · [Greeting], [First name]`
Reinforces time context (this is a Monday ritual). Removed for empty state.

### 3.3 Overdue section (conditional)

**Visible when:** ≥ 1 deadline is past official due date without Completed / Filed extension
**Color:** red left border, red count badge
**Why a separate section (not inside "This week"):** overdue is a penalty-risk moment; it must not blend with future items
**Order within section:** most days overdue first

### 3.4 "This week" — the hero

**Always visible.** The core of the screen.

**Rows sorted by date ascending.** Today's items pinned at top with filled dot (`●`); future-this-week with hollow dot (`○`).

**Per-row fields (left to right):**
| Element | Content | Notes |
|---|---|---|
| Urgency indicator | filled/hollow dot + color | Red for today/overdue, amber < 3 days, neutral otherwise |
| Countdown | `Today` / `Tue` / `3d` | Day name this week; days-count beyond |
| Client | `Acme LLC` | Click → client detail |
| Service | `1065` | Click → deadline detail modal |
| Actions | `⋯` | Hover/tap → quick actions (Complete · Defer · Note · Extension) |
| (Team tier) Assignee avatar | initials | Filter by "Mine" via toolbar toggle |

**Empty state:** `"All clear this week. Next deadline: [date] · [client] · [form]"`

**Row limit:** show 5 by default + "N more" expander. Users with heavy caseloads don't need 40-item scrolls on a triage screen.

### 3.5 "This month"

**Grouped by week-of.** Each group collapses to count; expand inline on click.

Same row format as §3.4.

### 3.6 "Long term" (Q3+)

**Collapsed by default.** Click to expand, revealing quarter-grouped sub-sections.

Lowest visual weight — most users won't expand daily.

---

## 4 · Controls & interactions

### 4.1 Filter bar (inline in "This week" header)

Click `[Filter]` → inline chip bar expands:
- Client (multi-select)
- State (multi-select)
- Form type (multi-select)
- Status (multi-select; default excludes Completed)
- Assignee (Team tier; "Mine" quick toggle)

Filters apply to all three sections. URL is updated so filter state survives refresh.

### 4.2 Export

Click `[Export]` → modal:
- What: current filtered view / all deadlines / specific date range
- Format: PDF / CSV / iCal
- Recipient: download / email to self / (Team tier) email to coworker

### 4.3 Row interactions

- **Click row** (anywhere except client name) → quick-action modal (see IA doc §3.1 step 5)
- **Click client name** → client detail page
- **Hover** (desktop) → shows `⋯` quick actions inline without modal
- **Long-press** (mobile) → quick-action bottom sheet

### 4.4 Keyboard

- `j` / `k` → navigate rows in This Week
- `Enter` → open quick-action modal for focused row
- `c` → mark Complete
- `d` → Defer (opens date picker)
- `/` → focus filter
- `⌘K` → global search

---

## 5 · Responsive (< 768px mobile)

```
┌──────────────────────────────────────┐
│ 🔔 3    Sarah K.                    │  ← compact top bar
├──────────────────────────────────────┤
│ [announcement banner if any]         │
│                                      │
│ Mon, Apr 27                          │
│                                      │
│ ⛔ OVERDUE (2)       ▸               │  ← collapsed
│                                      │
│ THIS WEEK (8)                        │  ← expanded, hero
│ ──────────────────────────────       │
│ ● Today  Acme LLC   1065       ⋯    │
│ ● Today  Johnson I  1040 ext   ⋯    │
│ ○ Wed    Bayou Cp   1120-S     ⋯    │
│ ...                                  │
│                                      │
│ THIS MONTH (23)      ▸               │  ← collapsed
│ LONG TERM (47)       ▸               │  ← collapsed
│                                      │
├──────────────────────────────────────┤
│ 🏠   👥   📡   📅          [+]       │  ← bottom tab
└──────────────────────────────────────┘
```

Rules:
- Overdue, This Month, Long Term all collapse by default (saves vertical space)
- This Week stays expanded
- Row density reduced: client + form only on first line; countdown badge on right
- Quick actions become bottom sheet
- Filter becomes full-screen overlay

---

## 6 · Empty states

| Condition | What they see |
|---|---|
| First visit, no clients | Hero: "Let's get your clients in. [Import CSV] [Add 5 manually] [Try demo data]" |
| Clients imported, no deadlines this week | "All clear this week. Next deadline: [date] · [client] · [form]" |
| Filters yield zero results | "No matching deadlines. [Clear filters]" |
| All clients archived | "No active clients. [Add a client] or [View archived]" |

---

## 7 · Performance targets

- First paint ≤ 1.5s on 4G
- Row interaction response ≤ 100ms
- Filter re-render ≤ 1s
- Status update (click → server confirm) ≤ 500ms
- Data updates on each visit; no polling required during session (user-triggered refresh only)

---

## 8 · Telemetry (what we measure on this screen)

- Time-to-first-interaction (how long before user clicks anything)
- Triage session duration (open → close without inactivity > 2 min)
- Rows actioned per session
- Filter usage rate
- Banner click-through rate
- Overdue section view rate (is it visible, clicked)
- Bounce rate (open → close without any action)

---

*End of dashboard spec v0.1.*
