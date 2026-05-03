---
version: alpha
name: DueDateHQ
description: CPA client-intelligence layer. Calm, dense, scan-first work surface. The differentiator is "state notification + suggested action" — every layout privileges the gap (what's missing), not the fill.

colors:
  canvas: "#FAFAF7"
  surface: "#FFFFFF"
  sunken: "#F5F4EF"
  ink-900: "#0F172A"
  ink-700: "#334155"
  ink-500: "#64748B"
  ink-400: "#94A3B8"
  ink-300: "#CBD5E1"
  line: "#E2E8F0"
  line-strong: "#CBD5E1"
  primary: "#0F172A"
  primary-hover: "#1E293B"
  on-primary: "#FFFFFF"
  danger-bg: "#FEF2F2"
  danger-border: "#FCA5A5"
  danger-ink: "#B91C1C"
  warn-bg: "#FFFBEB"
  warn-border: "#FCD34D"
  warn-ink: "#92400E"
  ok-bg: "#ECFDF5"
  ok-border: "#86EFAC"
  ok-ink: "#047857"
  info-bg: "#EFF6FF"
  info-border: "#93C5FD"
  info-ink: "#1D4ED8"

typography:
  display:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif
    fontSize: 22px
    fontWeight: "600"
    lineHeight: 28px
    letterSpacing: -0.01em
  title:
    fontFamily: -apple-system, sans-serif
    fontSize: 18px
    fontWeight: "600"
    lineHeight: 26px
  body-strong:
    fontFamily: -apple-system, sans-serif
    fontSize: 14px
    fontWeight: "500"
    lineHeight: 20px
  body:
    fontFamily: -apple-system, sans-serif
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px
  label:
    fontFamily: -apple-system, sans-serif
    fontSize: 13px
    fontWeight: "500"
    lineHeight: 20px
  caption:
    fontFamily: -apple-system, sans-serif
    fontSize: 12px
    fontWeight: "400"
    lineHeight: 16px
  micro:
    fontFamily: -apple-system, sans-serif
    fontSize: 11px
    fontWeight: "600"
    lineHeight: 16px
    letterSpacing: 0.05em

rounded:
  sm: 4px
  DEFAULT: 6px
  md: 8px
  lg: 10px
  full: 9999px

spacing:
  inline: 8px
  region: 16px
  card: 24px
  section: 48px
  page-x: 32px
  page-y: 24px

components:
  page-header:
    typography: "{typography.display}"
    textColor: "{colors.ink-900}"
  pill-success:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px
  pill-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px
  pill-info:
    backgroundColor: "{colors.info-bg}"
    textColor: "{colors.info-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px
  pill-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px
  chip-jurisdiction:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-700}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: 2px
  chip-alert-type:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: 2px
  chip-silent:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn-ink}"
    typography: "{typography.micro}"
    rounded: "{rounded.sm}"
    padding: 2px
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.region}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  link:
    backgroundColor: transparent
    textColor: "{colors.ink-700}"
    typography: "{typography.label}"
  link-hover:
    textColor: "{colors.ink-900}"
  checkbox-row:
    backgroundColor: transparent
    textColor: "{colors.ink-900}"
    typography: "{typography.body}"
    padding: 6px
  checkbox-row-hover:
    backgroundColor: "{colors.sunken}"
---

## Overview

DueDateHQ is a work surface for solo and small-team CPAs juggling 50–600 clients. It is not a daily destination; it is an **audit + batch surface** the CPA visits to triage, then leaves. Every pixel must justify itself by changing what the CPA does next.

The aesthetic is **calm professional density**. Closer in spirit to Linear, Stripe Dashboard, or a well-built financial terminal than to consumer SaaS. No greetings, no decorative gradients, no celebrations. The user is a senior pro doing batch work; the UI respects her time.

### Reference inheritance — Mercury · Sana AI · Oku

DueDateHQ inherits the visual register of three operational SaaS products. Each contributes specific moves; together they define the "look".

| Reference | What we inherit |
|:----------|:----------------|
| **[Mercury](https://mercury.com)** (banking dashboard) | Number typography (tabular-nums everywhere; cents-superscript on display values where applicable) · pill-shaped primary CTAs · soft-tint status pills · sidebar grouped by domain · the "professional density" feeling · ⌘K search affordance · single indigo accent on the next action |
| **[Sana AI](https://sanalabs.com)** (AI workspace) | Cool neutral canvas (not warm cream) · borderless surfaces with hairline (1px) divisions · neutral category dots · warm but quiet tone · clean meta lines |
| **[Oku](https://oku.so)** (knowledge tool) | Content-first hierarchy (almost no chrome) · thin sidebar with no decoration · understated page titles · restraint as the dominant taste — what's *removed* matters more than what's added |

The three converge: **a productivity tool earns trust by getting out of the way**. Mercury proves it for finance, Sana proves it for AI workspace, Oku proves it for knowledge. DueDateHQ inherits the lineage for CPA practice operations.

### Taste principles (T1–T8 — apply to every new screen)

| # | Principle | How to apply |
|:--|:----------|:-------------|
| **T1** | **Numbers are typographic objects.** | Every dollar / count / date uses `tabular-nums`. Page-level KPIs use `<MetricTile>` with display weight. Generic body-render of a number is a fail. |
| **T2** | **One accent, one viewport, one action.** | The indigo accent (`bg-indigo`) appears on the **next action** only — primary CTA, currently-selected sidebar item, important "do this now" surface. Before painting indigo, ask: "is this the ONE next action?" If no, demote to a slate ghost / link. |
| **T3** | **Pills for actions, soft rectangles for objects.** | Buttons + status chips are `rounded-pill` (999px). Cards / inputs / modals are soft rectangles (`rounded-md` 8px). Shape codes role faster than label. |
| **T4** | **Status colors are pills, never paint.** | Green / orange / red appear as small `<StatusPill>` (tinted bg + saturated text). They never become surface fills, never become row left-borders, never become full-card backgrounds. Use `<StatusPill>` — period. |
| **T5** | **Sidebar groups, surface unfolds.** | Left nav is grouped by domain (`Workflows / Personal / Team`). Main canvas opens flush — no nested chrome bars, no breadcrumbs on most pages. The sidebar IS the wayfinding. |
| **T6** | **Density via vertical air, not chrome.** | Tables/lists use ≥44px row height with consistent vertical padding. Cramped density is anxiety; comfortable density is the product's value. The 8/16/24/48 rhythm does the structural work — drop the dividing borders/shadows. |
| **T7** | **Modal vs toast vs banner discipline.** | Modals interrupt for input only. Toasts confirm "did the thing." Banners notify "I noticed." Bell holds the inbox. Pick the right surface — picking IS the message (see §The four alert surfaces). |
| **T8** | **The dashboard is a desk, not a stage.** | Page titles use `<PageHeader>` (display 22px / 600), no display face anywhere. No "Welcome, Sarah." No firm-name in header. No celebratory toasts. The product looks like a calm tool, not a marketing site — because the CPA opens it 30× a day. |

When a screen makes a decision the doc doesn't address, derive from these principles. The principles outlast any single token.

**Implementation foundation.** The product is built on [shadcn/ui](https://ui.shadcn.com) primitives with `cssVariables: false` (see [components.json](components.json)) — meaning shadcn primitives consume Tailwind classes directly from [tailwind.config.js](tailwind.config.js), and the tokens defined here flow to those classes via `npx @google/design.md export --format tailwind DESIGN.md`. New components are composed from shadcn primitives (`<Button>`, `<Dialog>`, `<Dropdown>`, `<Checkbox>`, etc.); we do not write component primitives from scratch. Icons come from [Lucide](https://lucide.dev).

The differentiator pattern, in two unit variants:

- **Inbound axis** — *one event → many clients → one batch action.* (State alerts: Hurricane Ian → 7 affected clients → Reset deadlines.)
- **Outbound axis** — *one client → many items → one batch action.* (Action queue: Coral Reef Designs → 3 missing items → Send reminder.)

Same pattern, two axes. Both must look like siblings.

## Colors

A single accent (deep ink) plus four status families. No tertiary brand color, no gradient, no glassmorphism, no dark glow. Color carries semantics — never decoration.

- **Surfaces** (`canvas` / `surface` / `sunken`): cool neutral as page bg (`#F8F9FB` — Mercury-aligned, refreshed 2026-05-03 from the original warm cream), pure white for cards, slightly darker cool tint for hover and divided regions inside cards.
- **Ink** (`ink-900` → `ink-300`): a five-step grayscale ladder. `900` for primary text, `500` for metadata, `300` for separator dots and disabled states.
- **Primary** (`primary` / `primary-hover`): deep ink, used only on primary commit buttons. Never as a fill on cards, banners, or icons.
- **Status families** (`danger` / `warn` / `ok` / `info`): each has `bg`, `border`, `ink` triples. `bg` is a low-saturation tint for pill backgrounds; `ink` is a high-contrast text color. Never use status `solid` colors for backgrounds — they're for icons and borders only.

## Typography

System sans (Apple system fonts on macOS, Segoe UI on Windows). Seven sizes total — anything outside this scale is a bug.

- **`display`** (22px) — page title only.
- **`title`** (18px) — section titles ("State alerts", "Action queue").
- **`body-strong`** / **`body`** (14px) — primary content. Bold for client/event names, regular for descriptive text.
- **`label`** (13px) — verb-section headers, button labels.
- **`caption`** (12px) — secondary metadata (counts, dates, sub-lines).
- **`micro`** (11px, uppercase, letter-spaced) — chip text and section eyebrows ("Just happened").

Bold for emphasis only — never to fix weak hierarchy that should be solved with space.

## Layout & Spacing

Single column, content-led width. Bounded `max-width: 840px`, centered with `page-x: 32px` horizontal padding. The CPA reads top-to-bottom; we never go full-width-1200px (that's marketing-page sprawl).

The page has **one rhythm rule**: spacing doubles between scopes.

| Token | Value | Use |
|:------|:------|:----|
| `inline` | 8px | within a row (chip → chip, dot-separated metadata) |
| `region` | 16px | inside a card (card padding, between sub-zones) |
| `card` | 24px | card → card within a section |
| `section` | 48px | section → section (Just Happened → State alerts → Action queue) |

`8 → 16 → 24 → 48` is the page's heartbeat. Anyone reaching for a 5th value is wrong about either the rhythm or the grouping. The only place space alone separates content is between sections (48px); inside sections, cards do the grouping.

**Page sections, top to bottom:**
1. Page header (date only, single line)
2. Just Happened (one row of pills, auto-hides at zero)
3. State alerts (section title + health pill, then card list)
4. Action queue (section title, then card list)

That is the entire page. There is no fifth section.

## Elevation & Depth

Flat. No card shadows by default — borders + tonal shifts do the structural work. The two existing shadow tokens (`pop`, `overlay`) are reserved for floating layers only:

- **`pop`** — popovers, dropdowns, hover-elevated chips on click.
- **`overlay`** — modals, confirm dialogs, the rare full-screen drawer.

Cards on the page itself get `border: 1px solid {colors.line}` and `background: {colors.surface}`. Never `border + shadow`. Never nested cards. Use `divide-y` (1px ink-line dividers) for sub-zones inside a card.

z-index ladder:

| Layer | Index |
|:------|:------|
| sticky-header (inside scrollable card) | 10 |
| dropdown / popover | 20 |
| sticky-footer (inside scrollable card) | 30 |
| modal-backdrop | 40 |
| modal | 50 |
| toast | 60 |
| tooltip | 70 |

No arbitrary `999` or `9999`. Anything that needs more layers needs a redesign.

## Shapes

Quiet, rectilinear. CPAs read this for hours; aggressive curvature feels playful and untrustworthy.

- **`rounded.sm` (4px)** — chips and tags. Just enough to feel intentional.
- **`rounded.DEFAULT` (6px)** — inputs, checkboxes.
- **`rounded.md` (8px)** — cards (alert cards, client action cards). The page's dominant radius.
- **`rounded.lg` (10px)** — modals, drawers.
- **`rounded.full`** — pills only (Just Happened, state-health, status indicators). Pills round; cards don't.

Icon stroke weight: 1.5px (Lucide default). Match the line weight of borders for visual consistency.

## Components

The components below are **token contracts**, not implementations. Build them by composing shadcn primitives (`@/components/ui/*`) styled via the Tailwind classes that map to these tokens. Keep `<AlertCard>`, `<ClientActionCard>`, and `<StateHealthPill>` as project-level components in `src/components/`; everything else (Button, Dialog, Checkbox, Dropdown, Tooltip) comes from shadcn.

### Pills (Just Happened, state-health)

Pills are clickable tags that navigate. They use `pill-success` / `pill-warn` / `pill-info` color pairs, `rounded-full`, `12px` text. Always icon + label format. Never a solid bg — always tinted (status `bg` token), so they recede until ticked off.

State-health pill rides on the same baseline as the section title. When healthy, render `text-ink-500` (no bg) — only the colored dot signals state. When degraded, swap to `pill-warn`. When bad, swap to `pill-danger`.

### Chips (read-only tags)

Used for jurisdiction (`[FL]`), alert type (`[DISASTER EXT]`), gap signals (`[silent 14d]`). All use `rounded-sm`, `micro` typography (11px uppercase letter-spaced), 2px vertical padding. Visually quieter than pills — these don't navigate, they label.

### Cards (alert cards, client action cards)

The dominant container. `border: 1px solid line`, `background: surface`, `rounded-md (8px)`, `padding: region (16px)` per zone. Multi-zone cards use `divide-y divide-line` between zones — never nested borders, never inner shadows.

Cards have two states: **collapsed** (header only, ~52–64px tall) and **expanded** (header + body + actions). Toggle by clicking anywhere on the card header. The chevron is a visual hint only, not a separate hit target.

State alert cards and client action cards share this shell. They are visual siblings — the same component family with different content templates.

### Buttons

Two affordances only:

- **`button-primary`** — solid `primary` background, white text, `rounded-md`, h-32px. Used for commit actions: `Reset deadlines (3)`, `Send reminder (3)`, `Confirm receipt`, `File`.
- **`link`** — text only, `ink-700`, no chrome, hover deepens to `ink-900`. Used for tertiary actions: `Snooze until tomorrow`, `Show all 7`, `Open thread`.

No outline buttons. No ghost buttons. No icon-only buttons except chevrons inside card headers.

### Checkbox row

Used inside expanded alert cards (one client per row) and inside expanded client action cards (one item per row). Hover state applies `sunken` bg to the entire row. Default state of every checkbox: **ticked** (opt-out is faster than opt-in for the common case).

## Do's and Don'ts

### Do

- **Privilege the gap.** Sections, labels, and counts all surface what's missing first ("Still missing (3)" not "Resolved (12)"). Confirmed/done items collapse by default.
- **One thing, one entrance, one name.** Never two UI paths to the same concept. Use the canonical verbs: `Send`, `Confirm`, `Discuss`, `Apply`. No synonym drift.
- **Show absolute date AND relative time** for every deadline. "May 12 · in 4 days." CPAs plan by date, triage by days-left.
- **Default destructive-ish actions to all-ticked**, with live count on the commit button. Sarah unticks edge cases faster than she ticks the common case.
- **Auto-hide empty sections** that don't carry meaning when zero (Just Happened). Always-present sections (State alerts, Action queue) keep their headers but render an honest empty state with a horizon ("Caught up. Next action due May 18.").
- **Use space, not chrome, for hierarchy.** The 8/16/24/48 ladder does most of the work.

### Don't

- **Don't show times of day on deadlines.** Tax filings are whole-day. No "5:00 PM CT", no "7 hours remaining", no time-slot calendars. Date only.
- **Don't add greetings, firm names, or AI usage chips to the header.** The sidebar already shows where you are; the date is the only chrome that changes.
- **Don't repeat verbs.** Verb appears either as section header OR as button — never both. (`Still missing (3)` → `Send reminder (3)`.)
- **Don't use `Dismiss` on alerts.** Permanent dismissal violates gap-loudest. Use `Snooze until tomorrow`.
- **Don't use the word `Mode A/B/C/D/E/F` in any user-facing copy.** Internal vocabulary stays internal. Plain English.
- **Don't paginate or carousel the action queue.** The CPA's mental model is "the queue, all of it". Sort by urgency descending; collapse cards to header-only at scale.
- **Don't nest cards inside cards.** Use `divide-y` for sub-zones.
- **Don't show form-type counts ("affecting ~15 form types").** Show actual form codes (1040, 1020-S) and client counts. Specificity always.
- **Don't use a 5th spacing value.** If you need one, you're wrong about the grouping or the rhythm.
- **Don't ship Mode F Health as its own card on Today.** It's an inline pill on the State alerts header. The detail page lives at `/system-status`.
- **Don't put decorative dots before status text** (e.g. `● Overdue`). Tinted pill bg + colored ink already carry the signal; a leading filled circle is visual noise. `<StatusPill>` defaults to no dot — opt in only for screen-reader-supplemental urgency cases.
- **Don't separate metric values with middle dots (`·`) when a clean row works.** `33 active clients · 8 due this week` reads like a comma-spliced sentence. Use horizontal whitespace (`gap-section`) and let weight+color carry hierarchy. Middle dots stay valid as **separators inside a single string of metadata** (`Tax 2025 · Federal · LLC`), but not as the structure of a metric row.
- **Don't write a custom `<h1>` per page.** Use `<PageHeader title=... meta=... />` from `src/components/ui/PageHeader.tsx`. Same for section titles — use `<SectionHeader>`. Custom one-offs cause typography drift across pages.

## Brand Vocabulary

These are load-bearing terms. Microcopy uses them verbatim. Synonym drift is forbidden — every drift creates a translation step the user has to do.

| Term | Means | Never call it |
|:-----|:------|:--------------|
| **Action Queue** | The user's main work surface — items needing their action | Tasks · Inbox · Your tasks · To-do |
| **Today** | The today-focused entry view (one of 7 sidebar destinations) | Home · Dashboard · Daily |
| **Service Package** | A bundle of related deadlines for a client (e.g. "Tax 2025 — LLC + State + Quarterlies") | Bundle · Filing bundle · Engagement package |
| **Chase** | An outbound email asking a client for missing info/docs | Reminder (acceptable inside the AI prompt; never in UI label) · Nudge |
| **State Notification** | A change announced by an external authority (IRS, state DOR) that affects multiple clients | Update · Alert (alert is the surface, not the event) |
| **`received_confirmed`** | The terminal state of a document/info request — fires the §5.3 invariant confirm-pulse | Marked complete · Done (these are the user-facing words; received_confirmed is the technical state) |
| **Action Surface** | A UI region that combines state + suggested action ("X just announced Y, here are affected clients, here's the email draft") | Card with action · Smart panel |
| **Mode F** | Internal: state-monitoring health mode | (technical only — never in UI copy; surfaced as "State alerts health" in user-facing labels) |
| **Phase 1 / Phase 2** | The two-phase chase pattern (push → pull) | (use the numbers) |
| **Substrate** | The underlying data layer (Postmark inbox, state DOR API, Calendly) | (technical only) |

**Voice rule:** when in doubt about UI copy, **say it the way a senior CPA would say it**, not the way an enterprise SaaS would. "Send chase" beats "Trigger reminder workflow." "Mark received" beats "Confirm document acquisition."

## The four alert surfaces

DueDateHQ presents alerts on four distinct surfaces. Each carries a different urgency contract. **Don't blur them — picking the right surface IS the message.**

| Surface | When | Behavior |
|:--------|:-----|:---------|
| **Bell** (top-bar dropdown) | Mixed inbox of all unread alerts. Click bell → list. | Asynchronous. The CPA pulls when ready. Badge count updates in real-time. |
| **Banner** (top of `/today` or `/clients`) | A state notification with multi-client impact, contextual to the current view. **At most ONE visible** per viewport. | Dismissable for the session. Action is always an inline link (`Review impacts →`), NEVER a primary button. Re-appears on next page load if unresolved. |
| **Blocking modal** | A single alert >72h overdue that requires a decision before continuing. | Owns the screen with backdrop. Has only two paths: act on it OR snooze (NOT dismiss). |
| **`/alerts` page** | Full-page list view of every active alert, filterable. | The "I want to triage everything" surface. Read-write; supports bulk actions. |

**Canonical mapping** (when a state notification arrives):

```
ARRIVES → bell badge increments + alerts page row inserted
       ↓
       if affects ≥1 client → banner appears on /today (one banner max)
       ↓
       if alert ages >72h with no action → escalates to blocking modal
       ↓
       on action OR snooze → all four surfaces update in lockstep
```

**Mode F Health** (the state-monitoring infrastructure) is NOT a fifth surface. It's an inline pill on the State alerts section header (`47/50 · 3 stale`), per `Don't` rule.

## Component anatomy rules

Every multi-element component (card, row, banner, dialog) MUST satisfy these before shipping. They prevent the most common layout failures (Shokz-style: "$79 hidden behind CTA").

1. **Zone map first.** Name the areas — `[avatar] [name+meta] [status pill] [primary action]` — before pixel values. Elements never leak across zone boundaries.
2. **Reading order explicit.** State the L→R / T→B scan path: e.g. `name → meta → status → primary action`. The DOM order matches.
3. **Non-overlap guarantee for primary info.** The deadline date / client name / `Overdue Nd` pill is **never** covered by an interactive affordance. Primary info zones get min-widths so CTAs can't squeeze them.
4. **Hit-target separation.** Tappable rows containing nested tappables (Send button, ✕ dismiss, chevron) give each nested element its own 44×44 hit area + `e.stopPropagation()` on the click handler.
5. **Truncation policy per text element.** Declare: never / 1 line ellipsis / 2 lines ellipsis / hides-at-breakpoint. No "flex-1 truncate" without intention.
6. **Responsive collapse stated.** What happens when the component narrows? (side-by-side → stacked? footer wraps to two rows? meta hides?)
7. **All interaction states defined.** rest / hover / active / focus-visible / disabled (+ selected / loading where applicable). Missing states = fail unless explicit `N/A`.

If a component spec doesn't answer all 7, send it back.

## Responsive behavior

DueDateHQ is **desktop-first**. A CPA does focused work on a 13"+ screen; mobile is for triage glances (the bell, the queue, marking received). Optimize desktop fully; make mobile usable.

### Breakpoints (Tailwind defaults)

| Name | Min width | Layout |
|:-----|:----------|:-------|
| `xs` / `sm` | < 768 | Mobile — sidebar hidden, BottomTabBar visible, single column, drawer for sidebar nav |
| `md` | 768–1023 | Tablet — sidebar in icon-only mode (or full if user expanded), single column, no BottomTabBar |
| `lg` | 1024–1279 | Small desktop — full sidebar, single column at `max-w-840px` |
| `xl` / `2xl` | ≥ 1280 | Desktop / wide — full sidebar, single column at `max-w-840px` (page does NOT widen) |

### Top-bar collapse rules

| Element | Visible from |
|:--------|:-------------|
| `+ New` button | always (`whitespace-nowrap shrink-0`) |
| Bell + badge | always |
| Avatar | always |
| User name (next to avatar) | `lg` and up |
| Trial badge ("Pro trial · 30 days left") | `lg` and up |
| Search bar long label ("Search clients, deadlines, alerts") | `sm` and up — collapses to "Search" below |
| ⌘K hint | `sm` and up |

**Why `lg`, not `md`:** at 768–1023 the sidebar takes 224px, leaving ~544px for top-bar content. Adding the trial badge + user name pushes total fixed-width content past available space and triggers wrapping. Hide them at `md` and the bar stays clean.

### Sidebar

- Collapses to `w-14` (56px) icon-only mode on user toggle (persists via `localStorage`).
- At `< sm`: hidden entirely, BottomTabBar takes over for primary nav.
- Items keep ≥44px touch target in icon-only mode.

### Page content

- `max-w-[840px]` is the canonical content width. Honored across breakpoints.
- Page padding: `px-4` mobile · `px-6` tablet · `px-8` desktop. Vertical: `py-6` mobile · `py-8` desktop.
- Tables (when present): horizontal scroll allowed; **never reflow tabular data into stacked cards** (CPAs scan column-wise).
- Action queue rows: status pill + primary action stay in the row at all breakpoints. On `< sm` the meta line truncates harder; status pill drops to its own line under the meta if needed.

### Touch targets

- Default: 44×44 minimum (WCAG 2.1 AA).
- Mobile-primary surfaces (BottomTabBar, primary buttons in row): 48×48.
- Inline icon-only actions: visual 32×32 with hit area expanded via padding to 44×44.

## Voice & Microcopy

The product voice is **calm, factual, respectful of time**. CPAs are senior professionals. Don't over-explain; don't celebrate; don't apologize for system errors that aren't user-caused.

### Three guiding moves

1. **Verb + object on actions.** "Send reminder" not "Send". "Mark received" not "Confirm". The user reads the button without scanning the row's status pill.
2. **State the state, then the suggestion.** "Form 941 was revised. 72 clients affected. Review impacts →" (state → impact → action).
3. **Numbers carry the load.** Microcopy supports the number, doesn't replace it. "$2,200 due Apr 18" beats "An amount is due in a few days."

### Microcopy reference

| Surface | Copy | Why |
|:--------|:-----|:----|
| Page title (Today) | `Today, May 3` (date inline; medium-weight ink) | Factual. Not "Welcome, Sarah" — desk, not stage. |
| Empty `/alerts` | `No active alerts.` | Calm fact. NOT "All caught up!" — no celebration. |
| Empty Action Queue | `Caught up. Next action due May 18.` | Provides horizon (per Do rule "Auto-hide empty…honest empty state with a horizon"). |
| Confirmation toast (received_confirmed) | `Marked received.` | Past tense, terse, no exclamation. |
| Error toast (chase send failed) | `Couldn't send. Retry, or check the email address.` | Direct: what failed, what to try. NOT "Oops!" |
| Banner (state change) | `IRS revised Form 941. 72 of your clients are affected. Review impacts →` | State → impact → verb. |
| Button: send chase | `Send reminder` | Verb + object. Plural-stable: "Send reminder (3)" when batch. |
| Button: review reply | `Open thread` | Domain term. NOT "View" / "See". |
| Button: review AI draft | `Review draft` | Sets expectation that the user will edit/approve. |
| Mode F health (when healthy) | `50/50 · all sources connected` | Inline; the absence of bad news IS the message. |
| Loading state | `Loading…` | Boring is correct. NOT "Just a moment!" / "Hang tight!" |
| Onboarding first-run | `Welcome, Sarah. Add your first client to start tracking deadlines.` | Personalized once (first run only), factual, immediately actionable. |

### Forbidden words / phrases

- "Oops!" / "Whoops!" — never apologize for system errors that aren't the user's fault.
- "Awesome!" / "Great!" / `🎉` — never celebrate routine actions.
- "AI is learning" / "Our AI is thinking" — never expose AI internals as decoration.
- "Just a moment!" / "Hang tight!" — boring "Loading…" is correct.
- "Reminder" (when "chase" is the brand term in spec docs) — vocabulary discipline. *Note: button labels say "Send reminder" because that's the CPA's everyday word; "chase" is internal vocab.*
- "Bundle" / "Filing bundle" (when "service package" is the brand term).
- "Dashboard" as a sidebar destination (use "Today").
- `Mode A/B/C/D/E/F` in any user-facing copy.

### Casing

- **Sentence case for everything** — buttons, labels, page titles, banner copy. No Title Case CTAs. UPPERCASE reserved for sidebar group eyebrows (`WORKSPACE`).
- **Punctuation:** commas inside; periods at end of sentences in body copy; **no periods on button labels or single-line statuses**.

## Accessibility

WCAG 2.1 AA is the floor. The product gets used by working CPAs at 7am with coffee and bifocals — readability isn't optional.

### Verified contrast pairs

| Pair | Ratio | Pass |
|:-----|:------|:-----|
| `ink-900` on `canvas` | 16.4:1 | AAA |
| `ink-900` on `surface` | 17.1:1 | AAA |
| `ink-700` on `surface` | 9.8:1 | AAA |
| `ink-500` on `surface` | 4.9:1 | AA (body) |
| `ink-400` on `surface` | 3.1:1 | AA Large only — never use for body |
| `on-primary` on `primary` | 16.7:1 | AAA |
| `ok-ink` on `ok-bg` | 5.8:1 | AAA |
| `warn-ink` on `warn-bg` | 7.2:1 | AAA |
| `danger-ink` on `danger-bg` | 6.4:1 | AAA |
| `info-ink` on `info-bg` | 6.8:1 | AAA |

### Other a11y rules

- **Focus visibility:** `:focus-visible` only (never `:focus`); 2px outline + 2px offset; **never `outline: none`**.
- **Target size:** 44×44 minimum; 48×48 for mobile-primary surfaces; inline actions get visual 32×32 with padding-expanded hit area.
- **Color independence:** every status carries an icon or label, never color alone. (E.g. "Overdue 3d" pill carries the word + dot + danger-tint; the word does the work for color-blind users.)
- **Reduced motion:** `prefers-reduced-motion: reduce` is wired globally in `src/index.css`. Per-moment fallbacks (see Motion §) degrade to opacity-only.
- **Keyboard nav:** Tab order follows visible reading order. Sidebar items + Action queue rows reachable via Tab. Modal closes on Escape. `j` / `k` move between rows where supported.
- **Screen reader:** every icon has `aria-label` (decorative icons get `aria-hidden="true"`). Status pills announce as "Status: Overdue 3 days." Modal opens announce title.
- **Form errors:** `aria-invalid="true"` + `aria-describedby` linking to error message rendered in `danger-ink` below the input.

## Motion

Motion confirms; it does not perform. Subtle, fast, professional. The product is used 30× a day; animation that doesn't earn its keep becomes friction.

### Easing tokens

```css
--ease-out-strong:  cubic-bezier(0.23, 1, 0.32, 1);   /* default for entries */
--ease-out-quick:   cubic-bezier(0.4, 0, 0.2, 1);     /* for hover/state change */
```

**Forbidden:** CSS defaults (`ease`, `ease-in`, `ease-in-out`) — too soft, lack punch. Specifically `ease-in` is forbidden on UI animations (sluggish at the watching moment).

### Duration ladder (bound to element type)

| Element | Duration |
|:--------|:---------|
| Button press feedback | 80–160 ms |
| Tooltips, small popovers | 125–200 ms |
| Hover state changes | 160 ms |
| Dropdowns, selects | 150–250 ms |
| Toast slide-in / out | 200 ms in / 140 ms out |
| Modal enter / exit | 220 ms in / 140 ms exit |
| Section fade-up (`.animate-ddhq-fade-up`) | 220 ms |
| The §5.3 confirm-pulse (`.animate-ddhq-confirm`) | 700 ms (the ONE delight moment) |

**Asymmetric rule:** exits are always faster than enters. Default pair: 220 ms enter / 140 ms exit. Slow where the user is deciding, fast where the system is responding.

### Frequency-based rule

| Frequency | Decision |
|:----------|:---------|
| Keyboard navigation (Tab, Esc, ⌘K) | **No animation.** Repeated 100+/day; animation feels laggy. |
| Sidebar item hover | **No animation.** Bg color change only, instant. |
| Row hover in queue | Subtle bg shift, 160 ms — not 220 ms. |
| Modal / popover open | Standard 220–320 ms. |
| Toast appearance | 200 ms slide + opacity. |
| `received_confirmed` row flip | 700 ms confirm pulse — the ONE delight moment. |

### Signature motion (already shipped in `src/index.css`)

1. **`.animate-ddhq-confirm`** — 700 ms green outward radial glow on a row when its checklist item flips to `received_confirmed`. Non-looping. The single delight moment.
2. **`.animate-ddhq-fade-up`** — new rows in tables/lists fade-in + slide up 4 px. 220 ms `--ease-out-strong`. Stagger 60 ms when ≥3 new rows enter together.
3. **`.animate-ddhq-ai-shimmer`** — gentle opacity pulse on AI-source pills. 2.6 s `ease-in-out` infinite.

### Reduced-motion fallbacks

- Confirm pulse → opacity-only fade-in of green check (no glow).
- Fade-up → instant insertion (no transform).
- Modal → instant open (no scale).
- AI shimmer → static `opacity: 0.85` (no pulse).

## Invisible correctness

The barely-audible voices that compound. These are easy to forget and easy to spot when missing.

| Surface | Token / rule |
|:--------|:-------------|
| Text selection | `bg ink-900 at 24% alpha` · `color ink-900` |
| Caret color | `caret-color: var(--ink-900)` on inputs |
| Scrollbar | thin (8 px) · thumb `ink-400 at 32% alpha` · hover `ink-400 at 56%` |
| Link underline | `text-underline-offset: 3px` · `text-decoration-thickness: 1.5px` · color matches text · hover dims to 70% opacity |
| Tap-highlight | `-webkit-tap-highlight-color: transparent` + custom `:active` state per component |
| Tooltip delay | first hover: 400 ms · subsequent (within 300 ms): instant + no animation |
| Smooth scroll | `scroll-behavior: smooth` on `<html>` |
| Anchor scroll-margin | `scroll-margin-top: var(--nav-height) + 12px` on every scroll target |
| Focus-visible ring | only on `:focus-visible`, never on `:focus` · never `outline: none` · 2 px solid `primary` + 2 px offset |
| Broken image fallback | `bg sunken` + alt text in `caption` ink-500 + 16 px lucide `<ImageOff>` |
| Font smoothing | `-webkit-font-smoothing: antialiased` on dark-canvas surfaces only (toasts) |
| `select-none` on chrome | sidebar items, button labels, status pills — prevent accidental drag-select |
| Number inputs | `appearance: none` on currency inputs (kill browser spinners) |
| Empty cell rendering | render `—` (em dash) in `ink-400`, never blank |
| Print stylesheet | links unfurl URLs; `@page` margin 0.5in; brand fonts swap to system |

## Shared primitives reference

These live in `src/components/ui/` and are the **only** correct source for these elements. Custom rolls of any of these break the design system.

| Primitive | Path | When to use |
|:----------|:-----|:------------|
| `<PageHeader>` | `src/components/ui/PageHeader.tsx` | Every page's `<h1>`. Composes display typography (22px / 600), optional muted `meta` (e.g. count/date), optional right-aligned `actions`. |
| `<SectionHeader>` | `src/components/ui/SectionHeader.tsx` | Every section's `<h2>` inside a page (`Action Queue`, `Timeline`, etc.). Title typography (18px / 600) + right-aligned `meta` and `action`. |
| `<StatusPill>` | `src/components/ui/StatusPill.tsx` | All status indicators (`Overdue 3d`, `Due today`, `Pending`, `Active`). Variants: `ok` / `warn` / `danger` / `info` / `neutral` / `accent`. **No leading dot by default.** |
| `<Banner>` | `src/components/ui/Banner.tsx` | The "I noticed something" alert surface (one of the four — see §The four alert surfaces). 4px status left rule + tinted bg + inline link action (NEVER a primary button). |
| `<EmptyState>` | `src/components/ui/EmptyState.tsx` | Centered icon (decorative, `ink-300` — never accent) + factual title + max-32ch body + single primary action. Voice rule: "Nothing to do today." not "All caught up!" |
| `<DateLabel>` | `src/components/ui/DateLabel.tsx` | Every deadline/date render. Auto-renders Today/Tomorrow/Yesterday for ±1 day, "MMM D" otherwise. **Tabular-nums by default.** Per locked policy: never times. |
| `<MetricTile>` | `src/components/ui/MetricTile.tsx` | Mercury-style headline KPI tile (eyebrow label / big value / optional delta with up/down icon). Use on dashboards / page-tops where one big number carries the page. |
| `<DotStack>` | `src/components/ui/DotStack.tsx` | Horizontal dot-grid visualizing a count by status color (e.g. day-of-deadline rows). Caps at 17 visible + "+ N" overflow. |
| `<Card>` / `<CardZone>` / `<CardDivider>` | `src/components/ui/Card.tsx` | Card container (`border 1px line` + `surface bg` + `rounded-md` + `p-region`). For multi-zone cards, use `<CardZone>` + `<CardDivider>` instead of nested borders. |

**Migration discipline.** When you find an inline status pill / banner / empty state / `<h1>` in the codebase, replace it with the primitive. Don't roll your own — the only way the system stays coherent at scale is if there is one source per concept.

## Implementation reference (token usage)

DESIGN.md tokens in code, mapped to Tailwind classes:

| Token | Tailwind class | Used for |
|:------|:---------------|:---------|
| Surface bg | `bg-surface` | Card, modal, popover bodies |
| Canvas bg | `bg-canvas` | Page bg (already on body) |
| Sunken bg | `bg-sunken` | Sidebar, table head, hover row |
| Ink primary | `text-ink-900` | Headings, body, primary labels |
| Ink secondary | `text-ink-700` | Strong secondary, button text |
| Ink tertiary | `text-ink-500` | Metadata, descriptions |
| Ink quaternary | `text-ink-400` | Helper, timestamps, disabled |
| Line | `border-line` | Default 1px border |
| Line strong | `border-line-strong` | Emphasized 1px border |
| Indigo (next action) | `bg-indigo` / `text-indigo` / `bg-indigo-soft` / `text-indigo-ink` | Primary CTAs only — per T2 |
| Pill radius | `rounded-pill` | Buttons + status pills + search bar |
| Card radius | `rounded-md` | Cards, modal body, popover |
| Spacing inline | `gap-inline` / `p-inline` | Within a row (8px) |
| Spacing region | `gap-region` / `p-region` | Inside a card (16px) |
| Spacing card | `gap-card` / `mb-card` | Card → card (24px) |
| Spacing section | `gap-section` / `mb-section` / `py-section` | Section → section (48px) |
| Page max-width | `max-w-[840px]` | Single-column content cap |
| Page padding | `px-4 md:px-6 lg:px-8` | Responsive horizontal padding |
| Page vertical | `py-6 md:py-8` | Responsive vertical padding |
| Display type | `text-display` (or `text-2xl font-semibold`) | Page titles only |
| Title type | `text-title` (or `text-xl font-semibold`) | Section titles only |
| Body type | `text-body` (or `text-base`) | Default body, table cells |
| Label type | `text-label` (or `text-sm font-medium`) | Form labels, button labels |
| Caption type | `text-caption` (or `text-xs`) | Metadata, helper text |
| Micro type | `text-micro` (or `text-2xs uppercase tracking-wider font-semibold`) | Sidebar group eyebrows, table column headers |

**Rule:** wherever a Tailwind class would do but a named token reads more clearly, use the named token. `text-display` reads better than `text-2xl font-semibold` on a page header. `mb-section` reads better than `mb-12`.

## Devx note: tailwind config + token additions

Tailwind picks up new tokens from `tailwind.config.js` only on **dev server cold start**. If you add a token (`text-newSize`, `bg-newColor`, `mb-newSpacing`, etc.) and it doesn't render, restart the Vite dev server. HMR re-runs file watchers but does not rebuild the Tailwind config layer.

## Changelog

- **2026-05-03** — Augmentation pass. Added §Brand Vocabulary, §The four alert surfaces, §Component anatomy rules, §Responsive behavior, §Voice & Microcopy, §Accessibility, §Motion, §Invisible correctness, §Shared primitives reference, §Implementation reference, §Devx note. Added Mercury-style indigo accent (`bg-indigo`) + pill radius (`rounded-pill`) as opt-in tokens for the next-action CTA. Added `text-display` / `text-title` / `text-body` / `text-label` / `text-caption` / `text-micro` semantic typography aliases. Created shared primitives: `<PageHeader>`, `<SectionHeader>`, `<Card>`, `<MetricTile>`, refreshed `<StatusPill>` to default `dot=false` (no decorative leading dot). Applied to Today (`/design/today`), Dashboard (`/`), Clients (`/clients`), Alerts (`/alerts`), Mail (`/mail`). Existing surfaces preserved — no functionality stripped, no routes changed.
- **2026-05-03 (later)** — Mercury inheritance restored. Added §Reference inheritance (Mercury / Sana AI / Oku) + §Taste principles (T1–T8) so the doc tells the next builder *what Mercury looks like*, not just what to avoid. Switched canvas warm cream `#FAFAF7` → cool neutral `#F8F9FB` (Mercury / Sana / Oku align). Promoted AnnouncementBanner primary CTA from outline-slate to indigo pill so the Dashboard at `/` visibly carries the Mercury accent.
