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

**Implementation foundation.** The product is built on [shadcn/ui](https://ui.shadcn.com) primitives with `cssVariables: false` (see [components.json](components.json)) — meaning shadcn primitives consume Tailwind classes directly from [tailwind.config.js](tailwind.config.js), and the tokens defined here flow to those classes via `npx @google/design.md export --format tailwind DESIGN.md`. New components are composed from shadcn primitives (`<Button>`, `<Dialog>`, `<Dropdown>`, `<Checkbox>`, etc.); we do not write component primitives from scratch. Icons come from [Lucide](https://lucide.dev).

The differentiator pattern, in two unit variants:

- **Inbound axis** — *one event → many clients → one batch action.* (State alerts: Hurricane Ian → 7 affected clients → Reset deadlines.)
- **Outbound axis** — *one client → many items → one batch action.* (Action queue: Coral Reef Designs → 3 missing items → Send reminder.)

Same pattern, two axes. Both must look like siblings.

## Colors

A single accent (deep ink) plus four status families. No tertiary brand color, no gradient, no glassmorphism, no dark glow. Color carries semantics — never decoration.

- **Surfaces** (`canvas` / `surface` / `sunken`): warm off-white as page bg, pure white for cards, slightly darker tint for hover and divided regions inside cards.
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
