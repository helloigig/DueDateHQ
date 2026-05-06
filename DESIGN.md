---
version: alpha
name: DueDateHQ
description: CPA client-intelligence layer. Calm, dense, scan-first work surface. The differentiator is "state notification + suggested action" — every layout privileges the gap (what's missing), not the fill.

colors:
  # Hue-shift rebrand (2026-05-06). Mercury lightness ladder preserved at
  # every step; hue rotated from cool slate (220°) to sage (~145°). Token
  # NAME `indigo` kept for component back-compat; value is sage green.
  canvas: "#F8F9FA"
  surface: "#FFFFFF"
  sunken: "#EEF0F2"
  # Stone — brand swatch, available for muted promotional surfaces
  stone: "#C8CCB6"
  # Lime — featured highlight (BrandMark logo dot, "fresh/selected" register)
  lime: "#E8F1A8"
  # Text — Mercury L profile (11/27/47/65/84%), sage hue, low saturation
  ink-900: "#1E2D24"
  ink-700: "#3A5347"
  ink-500: "#687F73"
  ink-400: "#94B0A1"
  ink-300: "#CADDD0"
  # Border
  line: "#DEEBE3"
  line-strong: "#CADDD0"
  # Indigo (sage). Mercury indigo had L=60% S=62% white-text 4.6:1 — at
  # sage hue we drop to L≈38% to preserve perceptual depth (green at L=60
  # looks lighter than blue at L=60). Soft + ink return to Mercury's
  # near-white / dark profile so the soft register feels Mercury-comfortable.
  indigo: "#456E5A"
  indigo-hover: "#324C3C"
  indigo-soft: "#E5F0EA"
  indigo-ink: "#2C4A37"
  # Accent (legacy) — matches new ink-900
  accent: "#1E2D24"
  accent-hover: "#324C3C"
  on-accent: "#FFFFFF"
  # Status — Mercury L preserved per slot; hues tuned to brand family
  danger-bg: "#FDF1ED"
  danger-border: "#F0A89E"
  danger-ink: "#A33A30"
  danger-solid: "#C44A3D"
  warn-bg: "#FBF3E2"
  warn-border: "#E0BE8C"
  warn-ink: "#7E5722"
  warn-solid: "#A87740"
  ok-bg: "#EBF3E4"
  ok-border: "#9CC78F"
  ok-ink: "#3A6B36"
  ok-solid: "#4F8A45"
  info-bg: "#EAF2FB"
  info-border: "#9CC2EA"
  info-ink: "#1A4F8B"
  info-solid: "#2563B8"

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
  body-lg:
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
  numeric-lg:
    # Mercury-style headline numeric — page-level KPIs only.
    fontFamily: -apple-system, sans-serif
    fontSize: 26px
    fontWeight: "600"
    lineHeight: 32px
    letterSpacing: -0.01em

rounded:
  sm: 4px
  DEFAULT: 6px
  md: 8px
  lg: 10px
  xl: 12px
  pill: 9999px   # T3: indicators (status pills, count badges, jurisdiction tags). Buttons stay rounded-md.
  full: 9999px   # alias of pill — Tailwind default

spacing:
  # The 4-step rhythm. Anything outside is a bug. (8/16/24/48 — see "Layout & Spacing".)
  inline: 8px
  region: 16px
  card: 24px
  section: 48px

width:
  pane: 440px    # co-pilot / detail pane (used by /alerts workshop)

shadows:
  pop: "0 2px 8px rgba(15, 23, 42, 0.06)"        # popovers, dropdowns
  overlay: "0 8px 24px rgba(15, 23, 42, 0.12)"   # modals, drawers

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
    # Next-action CTA — indigo per T2 (Mercury inheritance). NOT slate.
    backgroundColor: "{colors.indigo}"
    textColor: "#FFFFFF"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 12px
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.indigo-hover}"
  button-primary-focus:
    # Focus ring on the next-action CTA — indigo, matches §Element states.
    outlineColor: "{colors.indigo}"
    outlineWidth: 2px
    outlineOffset: 2px
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
| **T3** | **Pills for indicators, soft rectangles for actions.** | Status pills (`<StatusPill>`), filter chips (`<FilterChip>`), count badges (`<CountBadge>`), jurisdiction tags (`<StateBadge>`) and other read-only or toggle labels use `rounded-full`. Buttons, inputs, cards, modals, dropdowns — anything you commit through — use `rounded-md` (8px). Shape distinguishes *"this labels something"* from *"this acts on something."* (Deliberate departure from Mercury, which pills its primary buttons; the dense terminal register reads better with squared action surfaces.) |
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
- **Primary** (`primary` / `primary-hover`): deep ink — used as the dark surface of the user-avatar circle and a few rare slate-buttoned places (user-menu trigger). The **next-action CTA color is indigo** (`bg-indigo`, per T2 + Mercury inheritance), **not slate**. Never use either as a fill on cards, banners, or icons.
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

Content width is bounded by `<PageContainer>` (`src/components/ui/PageContainer.tsx`), which has three variants — pick by content type, not page:

- **`default` (max-w-840px)** — calm digest pages (Today). Single-column briefing.
- **`wide` (max-w-1080px)** — data tables (Timeline, Clients). Mercury-aligned table width.
- **`workshop` (full viewport)** — 2-column workspaces (Alerts feed + co-pilot pane). Child owns chrome.

Page padding is uniform across `default` and `wide`: `px-4 md:px-6 lg:px-8` horizontal, `py-6 md:py-8` vertical. Tables and workshops use the same vertical rhythm as digest pages — only the canvas widens to match the data they hold. We never go to marketing-page sprawl (1280+) on body content.

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

Compose from shadcn `<Button>` (`src/components/ui/button.tsx`). Five variants are in active use; pick by intent, not by chrome:

- **`default` (primary commit)** — indigo solid pill (T2 — the next action). Used for: `Reset deadlines (3)`, `Send reminder (3)`, `Confirm receipt`, `File`. **At most one** primary on a viewport.
- **`outline` (secondary commit)** — hairline border + surface bg, text `ink-700`. Used for: `Cancel` in modals, alternative-path actions next to a primary. Mercury references show outline pills paired with a primary; never used alone.
- **`ghost` (tertiary)** — no chrome until hover. Used for: row-action buttons, sheet/modal close affordances, table-cell actions revealed on hover/focus, top-bar `+ New`-style triggers.
- **`link`** — text only, `ink-700`, no chrome, hover deepens. Used for: `Snooze until tomorrow`, `Show all 7`, `Open thread` — anywhere the action is navigational rather than committing.
- **`destructive`** — `bg-danger-solid` pill. Used only inside confirm modals (per §Confirm modal discipline) and the `Delete` affordance on detail panes.

Plus the **`icon` size** for icon-only buttons — composed via `<IconButton>`, which adds the required `aria-label` + optional `<CountBadge>` slot. Mercury uses icon-only buttons for: search reveal, more-menu (`⋯`), eye toggle, mute, dismiss. All legitimate — the rule is "every icon button has a label," not "no icon buttons."

**Shape:** `rounded-md` (8px) — matches the shadcn cva default. **Don't pill the buttons.** Mercury references show pills as their primary affordance; we deliberately keep buttons squared because the dense terminal register reads better with consistent corners across buttons / inputs / cards. Pills are reserved for indicators (`<StatusPill>`, `<FilterChip>`, `<CountBadge>`, `<StateBadge>` — see T3). Audit any `className="rounded-full"` override on a `<Button>` and remove it.

### Checkbox row

Used inside expanded alert cards (one client per row) and inside expanded client action cards (one item per row). Hover state applies `sunken` bg to the entire row. Default state of every checkbox: **ticked** (opt-out is faster than opt-in for the common case).

### Inputs (text, select, textarea)

Composed from shadcn `<Input>` / `<Select>` / `<Textarea>`. Mercury references show inputs sitting slightly *below* page surface (sunken tint) so they read as fillable, not as cards.

| Property | Value |
|:---------|:------|
| Height | `h-9` (36px) — matches button default; selects same |
| Background | `bg-sunken` rest, `bg-surface` on focus |
| Border | `border border-line` rest; `border-line-strong` on hover |
| Focus | `focus-visible:outline-2 focus-visible:outline-indigo focus-visible:outline-offset-2` (never `outline: none`) |
| Radius | `rounded-md` (8px) |
| Padding | `px-3 py-2` (12 / 8) |
| Label above | `text-label` (13/500) `text-ink-900`, 4px above the input |
| Helper below | `text-caption` (12/400) `text-ink-500`, 4px below the input |
| Placeholder | `text-ink-400` |
| Disabled | `opacity-40 cursor-not-allowed bg-line` |
| Invalid | `border-danger-border` + `aria-invalid="true"` + `text-caption text-danger-ink` error message in the helper slot |

### Modals

Composed from shadcn `<Dialog>` (`src/components/ui/dialog.tsx`). The behavioral contract lives in §Confirm modal discipline; the visual contract is below.

| Property | Value |
|:---------|:------|
| Width | `max-w-md` (~448px) for confirms; `max-w-lg` (~512px) for forms |
| Background | `bg-surface` |
| Border | `border border-line` (1px hairline) |
| Radius | `rounded-lg` (10px) — slightly rounder than cards (8px) so a modal reads as a discrete object floating above |
| Shadow | `shadow-overlay` |
| Backdrop | `bg-ink-900/40 backdrop-blur-[2px]`, `z-40` |
| Modal layer | `z-50` |
| Padding | `p-6` (24px) for the body; header same horizontal + `pt-6 pb-4`; footer `pt-4 pb-6` |
| Title | `text-title` (18/600); no separator border between header and body |
| Field group gap | `gap-card` (24px) between groups; `gap-region` (16px) inside a group |
| Footer | Right-aligned, `gap-3` between buttons. **Cancel sits left of the commit.** Destructive commits use `Button variant=destructive`; non-destructive use the default indigo. |
| Esc + outside-click | Close. Focus returns to the element that opened the modal (focus trap while open). |

### Dropdown menus

Composed from shadcn `<DropdownMenu>` (`src/components/ui/dropdown-menu.tsx`). Anchored to a trigger; floats above with subtle elevation.

| Property | Value |
|:---------|:------|
| Background | `bg-surface` |
| Border | `border border-line` |
| Radius | `rounded-md` (8px) |
| Shadow | `shadow-pop` |
| Min-width | match trigger, or `w-48` / `w-56` when content is wider |
| Item padding | `px-3 py-2` (12 / 8) |
| Item gap | `gap-2` between leading icon and label |
| Item rest | `text-ink-700` |
| Item hover | `bg-sunken text-ink-900` |
| Item disabled | `opacity-40 cursor-not-allowed` |
| Separator | `border-t border-line my-1` |
| Section eyebrow | `text-2xs uppercase tracking-wider text-ink-400 px-3 pt-2 pb-1` |
| Helper line (non-interactive) | `text-2xs text-ink-400 px-3 py-1.5` (no hover bg) |

### Sidebar (flush rail + nav items)

The sidebar is a **flush rail with a single hairline right border** — both modes. It sits as a flex sibling of the main column (so wayfinding stays reliable — the menu is always exactly where the eye expects it). Mercury references all flush their sidebars; we align with that.

**Why not floating** (the original spec was a floating card with `my-3 ml-3 rounded-lg shadow-pop`): the floating treatment leaked canvas behind the sidebar AND created a visual seam where the rounded top-right corner met the topbar's straight left edge. The visual lift the rail needs comes from the topbar's `border-b` + the hairline right border, not from sidebar elevation. Resolution rule (per §Archive): when references disagree with the doc, references win.

| Property | Expanded (`w-56`) | Collapsed (`w-14`) |
|:---------|:------------------|:--------------------|
| Background | `bg-surface` | `bg-surface` |
| Radius | none (flush rectangle) | none (flush rectangle) |
| Elevation | none (border separates) | none (border separates) |
| Right edge | `border-r border-line` (hairline) | `border-r border-line` (hairline) |
| Offset from viewport | none (flush) | none (flush) |
| Transition | `transition-[width] duration-150` between modes | (same) |
| Width | `w-56` (224px) | `w-14` (56px); persists in `localStorage` |

**Nav items inside the shell**
| Property | Value |
|:---------|:------|
| Item height | `h-9` (36px) — comfortable density without burning vertical space |
| Item padding | `px-3` (12px) |
| Item gap | `gap-3` between icon and label |
| Icon size | 16px (Lucide default; shadcn `[&_svg]:size-4`) |
| Item radius | `rounded-md` (8px) |
| Rest | `text-ink-700 hover:bg-sunken` |
| Active (you-are-here) | `bg-sunken text-ink-900 font-medium` |
| Group eyebrow | `text-2xs uppercase tracking-wider text-ink-400 px-3 pt-4 pb-1` (e.g. `WORKSPACE`) |
| Count badge slot | `<CountBadge>` placed `ml-auto`. Danger tone for unread alerts; neutral for inbox counts. |
| Collapsed mode | icons centered, labels hidden, tooltips on hover. Touch target stays ≥ 44×44. |

**Order discipline.** The first sidebar item is always `Today` (the action queue — the page CPAs land on by default). The second is always `Alerts` (the state-notification + suggested-action surface — the product's differentiator). After that: Timeline / Clients / Mail / Opportunities. Settings + Account live in the bottom-of-sidebar zone.

**Account entrance** lives at the bottom-left of the sidebar (Linear / Notion convention). The trigger is `<Avatar>` + name + email + chevron; opens a `<DropdownMenu>` (with `side="top"`) holding Settings + Sign out. There is **no duplicate user dropdown in the TopBar** — single account surface.

## Do's and Don'ts

### Do

- **Privilege the gap.** Sections, labels, and counts all surface what's missing first ("Still missing (3)" not "Resolved (12)"). Confirmed/done items collapse by default.
- **One thing, one entrance, one name.** Never two UI paths to the same concept. Use the canonical verbs: `Send`, `Confirm`, `Discuss`, `Apply`. No synonym drift.
- **Show absolute date AND relative time** for every deadline. "May 12 · in 4 days." CPAs plan by date, triage by days-left.
- **Default destructive-ish actions to all-ticked**, with live count on the commit button. Sarah unticks edge cases faster than she ticks the common case.
- **Auto-hide empty sections** that don't carry meaning when zero (Just Happened). Always-present sections (State alerts, Action queue) keep their headers but render an honest empty state with a horizon ("Caught up. Next action due May 18.").
- **Use space, not chrome, for hierarchy.** The 8/16/24/48 ladder does most of the work.
- **Keep escape hatches visible.** Tertiary affordances — `Undo`, `Not applicable`, `Skip`, manual override — sit in the same surface as the primary action, not buried in a settings page. The senior CPA needs to opt out of any AI-assisted decision in the same gesture they'd take to accept it; a hidden opt-out destroys the trust the visible primary action earned. (`Snooze until tomorrow` on alerts, `Undo import` on the post-import screen, `Not applicable — dismiss with reason` on announcement detail.)
- **Encode lifecycle status in shape, urgency in color.** Two independent axes that never collide. The deadline-status dot has three shapes — empty `○` (not started), half `◐` (in progress), filled `●` (due today / overdue) — colored by urgency tone. Shape tells you *where in the workflow*, color tells you *how soon*. See `src/components/DeadlineRow.tsx`.

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
- **Don't use emojis anywhere in product UI.** Not in nav labels, not as table-column glyphs (`🚨 Waiting`), not as opportunity flags (`💎`), not on filter chips. Emojis read as marketing-tone playful and break Mercury/Sana/Oku's calm register. Use a Lucide icon when an icon is needed; use a `<StatusPill>` when status urgency is needed. (The product-voice rule "no `🎉`" was already implicit in T8 + §Forbidden words; this makes it explicit for visual elements too.)
- **Don't introduce horizontal scroll on data tables.** If a table doesn't fit, drop or compact columns at the breakpoint — never set `min-w-[Npx]` + `overflow-x-auto` to push content sideways. CPAs scan column-wise; a horizontally-scrolled table loses its first-column anchor.
- **Don't separate metric values with middle dots (`·`) when a clean row works.** `33 active clients · 8 due this week` reads like a comma-spliced sentence. Use horizontal whitespace (`gap-section`) and let weight+color carry hierarchy. Middle dots stay valid as **separators inside a single string of metadata** (`Tax 2025 · Federal · LLC`), but not as the structure of a metric row.
- **Don't write a custom `<h1>` per page.** Use `<PageHeader title=... meta=... />` from `src/components/ui/PageHeader.tsx`. Same for section titles — use `<SectionHeader>`. Custom one-offs cause typography drift across pages. **Edge case:** when the title cluster needs to wrap badges/chips on the same line (ClientDetail's name + entity-type + state chips, TaskHeader's form code + deadline chip, the Import wizard's title under a progress strip), an inline `<h1>` is permitted **only** if it uses the canonical `text-display font-semibold text-ink-900 leading-7 tracking-[-0.01em]` token stack. Any other typography on the page-title h1 is drift.
- **Don't render tautological status columns.** When a row's section, color, and countdown already communicate a state, don't add a fourth signal. Rows inside the *Overdue* section already carry red bg + red countdown — a fourth "Overdue" status tag is decoration, not information. Same rule on *Completed* sections, *Awaiting* sections, etc.
- **Don't paint status colors across a full row or card.** T4 reaffirmed: status colors are pills, never row backgrounds. The Clients table previously tinted alert-affected rows `bg-warn-bg/30`; that's been replaced with a per-row `<span>State alert</span>` warn-tinted pill in the name cell. Same rule for stuck-row tinting, overdue-row tinting, etc. — the row stays neutral; the pill carries the signal. Status-tinted backgrounds are reserved for **banners** (`<Banner>` surface, `<ChaseBanner>`, `<ExtensionBanner>` — the dedicated "I noticed" surface) and **tier callouts inside expanded cards** (the "Still waiting on client" sub-zone in ChecklistList), where the tint is the surface, not a row signal.
- **Don't use the slate `accent` token for next-action CTAs or focus rings.** The next-action color is **indigo** (T2). `bg-accent` survives only on the user-avatar circle and the user-menu trigger (legacy back-compat). All `focus-visible` rings on form inputs use `ring-2 ring-indigo ring-offset-2`, never `ring-1 ring-accent`. Audit any `bg-accent` / `ring-accent` survival on a button, input focus, or selected-state highlight and replace.

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

**Mode A-F internal vocabulary — no surface exception.** The Mode-letter taxonomy is a backend telemetry id, not a label. **Nowhere in the rendered UI** — Today, Clients, ClientDetail, TaskDetail, Insights, Mail, Alerts, Onboarding, Settings (including Settings → AI), code comments visible to the user as tooltips/titles, or marketing — does the literal phrase "Mode A / Mode B / Mode F / Modes B/C/E" appear. The `Settings → AI` capability eval surface keeps the single-letter id (`A`/`B`/`C`/`D`/`E`/`F`) as a small `font-mono` suffix beside each plain-English capability name (`Classify inbound · A`) so an engineer can cross-reference `ai_inferences.mode` with a row, but the **primary label is always the plain-English name**. When prose needs to refer to a capability, use:

| Backend telemetry id | Primary user-facing label |
|:---------------------|:--------------------------|
| `A` | Classify inbound · "AI classified inbound documents" · "AI confidence" |
| `B` | Predict timing · "Arrival timing" · "AI proposed dates" |
| `C` | Anomaly flags · "Fact consistency" · "AI flagged anomaly" |
| `D` | Draft emails · "AI-drafted reminder" · "AI draft" |
| `E` | Cross-year insights · "Advisory triggers" · "Cross-year" |
| `F` | State announcements · "State monitoring" · "State alerts health" |

Source-code identifiers (the tRPC router name `modeFHealth`, the `MODE_LABEL` record, the `mode` column on `AiInsight` / `AiInference`, the React component `ModeFHealth`) are not user-facing strings and stay as-is — renaming them would break the schema contract. Anything that **renders** to the user (`<span>`, `<button>`, tooltip `title`, dialog text, toast copy, code comments visible via dev-tools or source maps in production) follows the table above. Drift here is forbidden — caught in the audit pass.

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

## Element states (cross-cutting reference)

Every interactive primitive defines these states. If a primitive isn't listed here, derive from the closest sibling.

| Primitive | rest | hover | focus-visible | active (pressed) | disabled | selected / "on" |
|:----------|:-----|:------|:--------------|:------------------|:---------|:----------------|
| Button (default — indigo) | `bg-indigo text-white` | `bg-indigo-hover` | 2px indigo ring + 2px offset | `bg-indigo/90` | `opacity-40 cursor-not-allowed` | — |
| Button (outline) | `border-line text-ink-700 bg-surface` | `bg-sunken` | 2px ring | `bg-line` | `opacity-40` | — |
| Button (ghost) | `text-ink-700 bg-transparent` | `bg-sunken` | 2px ring | `bg-line` | `opacity-40` | — |
| Button (link) | `text-ink-700 underline-offset-4` | `text-ink-900 underline` | 2px ring | `text-ink-900` | `opacity-40` | — |
| Button (destructive) | `bg-danger-solid text-white` | `bg-danger-ink` | 2px ring | `bg-danger-ink/90` | `opacity-40` | — |
| IconButton | (per Button variant) | (per variant) | 2px ring | (per variant) | `opacity-40` | — |
| Input / Select / Textarea | `bg-sunken border-line` | `border-line-strong` | `bg-surface` + 2px indigo ring + 2px offset | — | `opacity-40 bg-line` | — |
| Checkbox | unchecked: `bg-surface border-line-strong`; checked: `bg-indigo text-white` | `border-ink-700` | 2px ring | — | `opacity-40` | — |
| Sidebar item | `text-ink-700` | `bg-sunken` | 2px ring | `bg-sunken` | `opacity-40` (rare) | active (you-are-here): `bg-sunken text-ink-900 font-medium` |
| Dropdown item | `text-ink-700` | `bg-sunken text-ink-900` | (parent menu owns) | — | `opacity-40 cursor-not-allowed` | — |
| FilterChip (chip) | `bg-sunken text-ink-700` | `bg-line text-ink-900` | 2px ring | `bg-line` | `opacity-40` | active filter: `bg-ink-900 text-surface` |
| FilterChip (tab) | `text-ink-500 border-b-2 border-transparent` | `text-ink-700` | 2px ring | `text-ink-900` | `opacity-40` | active tab: `text-ink-900 border-b-2 border-ink-900` |
| MetricTile (filter trigger) | `border-line bg-surface` | `border-ink-300` | 2px ring | — | — | active: `bg-ink-900 text-surface border-ink-900` |
| Card (clickable) | `border-line bg-surface` | `border-ink-300` | 2px ring | — | — | — |
| Tab row item | (see FilterChip tab variant) | | | | | |
| Modal | `bg-surface border-line shadow-overlay` | (n/a) | (focus trapped to first focusable child) | (n/a) | (n/a) | open / closed only |
| Tooltip | hidden | (n/a, parent triggers) | (n/a) | (n/a) | (n/a) | open: `bg-ink-900 text-white text-caption px-2 py-1 rounded` |

**Two distinct "selected/on" archetypes — pick by what the affordance does:**

- **You-are-here** (sidebar nav, active wizard step) — `bg-sunken text-ink-900 font-medium`. Subtle. The user navigated here; the marker just confirms.
- **Filter-is-on** (FilterChip, MetricTile-as-filter) — `bg-ink-900 text-surface`. Loud. The user toggled state and needs to see the world has changed.

Don't blur them. A sidebar item painted in the loud archetype reads like a filter; a filter painted in the subtle archetype reads like a label.

## Information hierarchy (the 3-tier scan rule)

Every screen must let the eye land in this order, in under 5 seconds. If you can't say which element is which tier, the screen has no hierarchy.

| Tier | What | Visual treatment |
|:-----|:-----|:------------------|
| **T1 · Hero** | The one thing the user came here to see / decide / act on. Singular per viewport. | `text-display` + `font-semibold` + ample top whitespace; OR a large `<MetricTile>`; OR a single indigo CTA. |
| **T2 · Support** | The 3–5 items that justify or contextualize the hero (counts, supporting cards, filters that scope the hero). | `text-body-strong` titles, hairline-bordered cards or rows, `gap-card` (24px) rhythm. |
| **T3 · Background** | Everything else — meta, timestamps, source attribution, "show more", peripheral icons. | `text-caption text-ink-500`, no border, collapsed by default where possible. |

**Failure modes** (each one is a hierarchy bug, not a styling bug):

- **Tier inflation** — three things competing for hero. Pick one; demote the others to T2.
- **Tier flattening** — every section uses the same heading weight. Tier 1 must outweigh tier 2 must outweigh tier 3 *visually*, not just semantically.
- **Decoration tax** — an icon, badge, dot, or pill on every row. The eye has nothing to land on. Remove all but the one signal that changes a decision.
- **Metadata creep** — secondary info painted in the same weight as primary (timestamps in `text-ink-700`, "5 min ago" in `font-medium`). Push to `caption` + `ink-500`, or drop.
- **Repeat surfaces** — same content rendered twice (count in tab + same count in filter chip below). Pick one home; remove the other.

When auditing a dense screen: print the Tier of every visible element. If T2 outnumbers T1 by more than 5×, or T3 outnumbers T2 by more than 3×, the screen is over-decorated — cut the smaller tiers first.

## Confirm modal discipline

Modals interrupt for input only (T7). The bar for triggering one is **damage that's hard to reverse**. Activity-logged reversible actions never get a modal — they get a toast.

**Confirm modal REQUIRED on:**

1. **Batch-adjust deadlines from announcement** — preview the date diff before applying.
2. **Archive client** — show active-deadline count; warn if > 0.
3. **CSV import commit** (final wizard step) — preview row counts.
4. **Remove team member** — show how many client assignments revert to Owner.
5. **Dismiss announcement** (the *not reversible gracefully* path) — explicit opt-in text: "I've reviewed this and none of my clients are affected." Prefer `Snooze until tomorrow` instead.
6. **Remove filing bundle from client** — list the pending deadlines that will be deleted.
7. **Send batch notification email** — preview recipient list + editable body before send.
8. **Undo import** (within the 7-day window) — show the N clients / M deadlines that get wiped.

**No modal on** (reversible + activity-logged):

- Mark complete · Mark in progress · Defer · File extension
- Add note · Edit note · Pin/unpin note
- Toggle filters · Toggle view modes · Snooze (own affordance)

Destructive confirms render the primary CTA in `bg-danger-solid text-white`. Non-destructive confirms render in the standard `bg-primary` ink. Cancel always sits left of the commit button. Esc closes. Focus returns to the element that opened the modal.

## Destructive change preview

Any change that **adds, removes, or replaces multiple records on commit** opens a migration preview modal before the change applies. Never silently remove. Never silently duplicate. Triggers: client entity-type change · primary-state change · filing-bundle swap · undo-import.

Required preview shape — three diff lines, signed:

```
Changing entity from LLC → S-Corp

–  Removes  3 pending deadlines (LLC-specific forms)
+  Adds     5 new deadlines (S-Corp forms)
✓  Keeps    2 overlapping deadlines (federal)

[Cancel]   [Apply changes]
```

- The `–` / `+` / `✓` glyphs are SVG (not unicode) for cross-platform fidelity, ink-tinted with the matching status family (`danger-ink` / `ok-ink` / `ink-700`).
- Activity log writes a single entry summarizing all three counts — not three separate entries.
- The commit button label includes the magnitude: `Apply changes (10)` if any number is large enough that the user would otherwise lose track.

## Export modal — three-axis pattern

Exports are decisions across three orthogonal axes. The modal renders one axis per row, radio groups inside each (no multi-select within an axis — one choice per axis).

| Axis | Choices |
|:-----|:--------|
| **What** | Current filtered view · All active deadlines · Specific date range (date picker) · Specific client (when launched from a client page) |
| **Format** | PDF (firm-branded client-facing report) · CSV (raw data, portability guarantee) · iCal `.ics` (subscription URL for calendar apps) |
| **Recipient** | Download (default) · Email to self · Email to teammate (Team tier only) |

**Trigger locations:** any `Export` button across the product points to the same modal — Today's "This Week" footer, Client Detail's `⋯` menu, Announcement Detail's affected-client list, `/timeline` page header. Same modal everywhere keeps the user's mental model intact (one entrance, one name).

**No additional axes.** No "include archived?" checkbox, no "anonymize names?" toggle — those drift the surface into options-creep. If a future case demands a fourth axis, it earns its own dialog with its own load-bearing rationale.

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
| Focus-visible ring | only on `:focus-visible`, never on `:focus` · never `outline: none` · 2 px solid `indigo` + 2 px offset (matches §Element states — slate is legacy and only the user-avatar / user-menu trigger keep it) |
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
| `<MetricTile>` | `src/components/ui/MetricTile.tsx` | Mercury-style headline KPI tile (eyebrow label / big value / optional delta with up/down icon). Use on dashboards / page-tops where one big number carries the page. **`helper` prop** for one-line metric explainer (e.g. "No reply in 14+ days"). **`active` + `onClick` props** make a tile a filter trigger — see §KPI tile = filter trigger. |
| `<DotStack>` | `src/components/ui/DotStack.tsx` | Horizontal dot-grid visualizing a count by status color (e.g. day-of-deadline rows). Caps at 17 visible + "+ N" overflow. |
| `<Card>` / `<CardZone>` / `<CardDivider>` | `src/components/ui/Card.tsx` | Card container (`border 1px line` + `surface bg` + `rounded-md` + `p-region`). For multi-zone cards, use `<CardZone>` + `<CardDivider>` instead of nested borders. |
| `<Avatar>` | `src/components/ui/Avatar.tsx` | Initials block. Sizes `xs`/`sm`/`md`/`lg`. Variants `round` (people, default) / `square` (firms). Tones `neutral`/`primary`. Initials derived from `name` or passed via `initials`. |
| `<StateBadge>` | `src/components/ui/StateBadge.tsx` | The 2-letter jurisdiction badge (LA, CA, NY, FED…). Sizes `sm`/`md`/`lg`. Sunken bg + ink-900 text — NOT per-state colored (single-accent rule). Used wherever an announcement / deadline / filing has a jurisdiction. |
| `<ClientChip>` | `src/components/ui/ClientChip.tsx` | Pill with avatar + truncated client name (max-w-[140px]). Used in announcement cards, batch action lists — anywhere a client is referenced inline as a tag (not a row). |
| `<CountBadge>` | `src/components/ui/CountBadge.tsx` | The "10" / "9+" badge that sits on a sidebar item, tab, icon button, etc. Tones `neutral`/`danger`/`warn`/`info`. Cap-at-9 rule lives here so it's uniform. |
| `<FilterChip>` | `src/components/ui/FilterChip.tsx` | The "show me X" toggle. Two variants: `chip` (rounded-pill, default — used in Timeline filter row) and `tab` (underline-active — used in Alerts page tabs). Optional `count` shows a tabular-nums suffix that inherits active/inactive tone. |
| `<IconButton>` | `src/components/ui/IconButton.tsx` | Composes shadcn `<Button variant="ghost" size="icon">` with a required `label` (drives both `aria-label` and `title`) and an optional `badge` slot using `<CountBadge>`. Sizes `sm`/`md`. The single source for top-bar / page-header / sheet-header icon affordances (Search, Notifications, More, Close). Variants `ghost` (default) / `outline`. |

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
| Pane width | `w-pane` | Co-pilot / detail pane width (440px). Used by `/alerts` workshop and any other surface with a fixed right pane. |
| Page padding | `px-4 md:px-6 lg:px-8` | Responsive horizontal padding |
| Page vertical | `py-6 md:py-8` | Responsive vertical padding |
| Display type | `text-display` (or `text-2xl font-semibold`) | Page titles only |
| Title type | `text-title` (or `text-xl font-semibold`) | Section titles only |
| Body type | `text-body` (or `text-base`) | Default body, table cells |
| Label type | `text-label` (or `text-sm font-medium`) | Form labels, button labels |
| Caption type | `text-caption` (or `text-xs`) | Metadata, helper text |
| Micro type | `text-micro` (or `text-2xs uppercase tracking-wider font-semibold`) | Sidebar group eyebrows, table column headers |

**Rule:** wherever a Tailwind class would do but a named token reads more clearly, use the named token. `text-display` reads better than `text-2xl font-semibold` on a page header. `mb-section` reads better than `mb-12`.

## The /alerts workshop surface

`/alerts` is the v0.7 differentiator's true home — the one-screen workspace
where state announcements get triaged. It's the **`/alerts` page** of the
four-alert-surfaces model, but rendered as a 2-column workshop, not a list.

**Layout** (inside AppShell — same Sidebar + TopBar + MOCK banner as every
other route):

```
┌─────────────────────────────────────┬────────────────┐
│   Center feed (flex-1)              │  Co-pilot pane │
│   ─ Page title + tabs               │   (w-pane)     │
│   ─ Announcement card list          │  ─ Context     │
│   (each card = StateBadge +         │  ─ AI actions  │
│    type pill + source + title +     │  ─ Email cycle │
│    summary + ClientChips +          │  ─ Composer    │
│    source link + actions row)       │                │
│                                     │                │
└─────────────────────────────────────┴────────────────┘
```

- Left feed scrolls; right pane is fixed `w-pane` (440px). On mobile the
  pane drops below the feed — no horizontal scroll.
- Tabs are `<FilterChip variant="tab">` ("Affecting you · N" / "All
  announcements · N" / "Resolved · N"). DON'T put a duplicate "N affecting
  you" pill above the tabs — the tab carries the count.
- The pane shows context for the **selected announcement only** (URL is
  `/alerts/:id`, deep-linkable). Empty pane = "Pick an alert to see
  suggested actions" empty state, not blank.
- The pane's primary action carries the **indigo accent** (T2 — one
  next-action). Secondary actions are slate ghost buttons.

## KPI tile = filter trigger

Some KPI tiles double as filter affordances on their page (Timeline tiles
filter the task list; Clients tiles filter the roster). When a tile is
clickable:

- Pass `onClick` + `active` props to `<MetricTile>`. `active` paints a
  ring + ink-900 border; non-active is the standard line border.
- The tile's **label IS the filter name** — don't duplicate the label as
  a separate filter chip below. ONE entrance, ONE name.
- A second row of `<FilterChip>` chips below KPI tiles is allowed only
  when the chips represent **a different filter dimension** (e.g. tiles
  surface gap-loud signals, chips slice by attribute like entity/state).
  See `/clients` for the canonical implementation: tiles answer "what
  needs attention", dropdowns answer "what slice of the roster".

## Single drilldown destination per concept

When two surfaces present the same concept, the click target on the
secondary surface NAVIGATES to the primary surface — it does NOT open a
duplicate Sheet/modal showing the same content.

- **State alerts**: `/alerts/:id` is the single drilldown.
  - Today's `<StateAlertCard>` click → `navigate('/alerts/:id')` (NOT
    open a Sheet)
  - Bell dropdown unread item click → `navigate('/alerts/:id')`
  - `/changes` public landing page deep-link → `navigate('/alerts/:id')`
    (after auth)

This rule prevents the "Sheet that duplicates the page" failure mode and
keeps deep-links to a single canonical URL per record.

## Internal vs official due — product-wide

CPAs work to a buffer. The **official due date** is the IRS / state's
hard deadline; the **internal target** is the firm-set date the CPA
plans to file by. Both are first-class data on every deadline; both
appear on every deadline display.

### Data model

`Deadline.officialDueDate: string` — required, immutable, source of
truth from the jurisdiction's calendar.

`Deadline.internalDueDate?: string` — firm-set buffer. Optional in
the type because legacy data and mock fixtures may not have it; UI
falls back to a derived buffer when absent.

### Default buffer (when `internalDueDate` is absent)

| Form class | Buffer |
|:---|:---|
| Annual income returns (1040 / 1120 / 1120-S / 1065) | official − 7 days |
| Quarterly estimates (1040-ES / 1120-W) | official − 3 days |
| Monthly filings (sales tax, payroll) | official − 2 days |
| Extension filings (4868 / 7004) | same as official (no buffer — filing the extension is the action) |

The buffer is a firm-level setting; we ship the defaults above and
expose per-firm + per-form overrides in Settings. Until the BE
supports overrides, FE renders defaults from the form class.

### Display contract — `<DueDate>`

Every deadline display uses the `<DueDate>` primitive
(`src/components/ui/DueDate.tsx`). Never render `officialDueDate` or
`internalDueDate` raw — the primitive enforces the convention.

| Property | Value |
|:---------|:------|
| Primary line | The official date — `text-ink-900`, `font-medium`, `text-sm`, `tabular-nums`. Always shown. Format via `<DateLabel>` (Today / Tomorrow / "MMM D"). |
| Secondary line | `target {date}` — `text-ink-500`, `text-xs`, `tabular-nums`. Shown when internal differs from official. Format same. |
| Behind-internal | When today > internal AND status is not ready/filed, the secondary line tone shifts to `text-warn-ink` and reads `behind target — {N}d` instead of `target {date}`. |
| Overdue official | When today > official AND status is not filed, the primary line tone shifts to `text-danger-ink` and the row's status pill reads `Overdue Nd`. The secondary line is suppressed (the overdue signal carries everything). |
| Already filed | Both lines render in `text-ink-500` strike-through. The row sits behind the gap. |

### Status logic

| Today's date vs… | Status reads |
|:---|:---|
| `today < internal` | "On track" — no extra signal |
| `today > internal` and `today < official` | **"Behind internal target"** — warn-ink secondary line, warn pill on row |
| `today > official` and not filed | **"Overdue"** — danger-ink primary line, danger pill on row |
| filed before official | "Filed" — ok pill, both dates strike-through (audit value, hidden by default) |

### Locked policies (memory `feedback_deadlines_dates_only.md`)

- **Dates only — never times.** Tax filings are whole-day. No "5:00 PM CT", no "7 hours remaining," no time-slot calendars.
- Both `officialDueDate` and `internalDueDate` are ISO `YYYY-MM-DD` (no time component).
- `<DueDate>` strips any time component if passed an ISO datetime by mistake.

### Where it shows

| Surface | Display |
|:---|:---|
| Today's Action Queue row | `<DueDate>` in the meta line |
| Timeline row | `<DueDate>` replaces the bare "due {date}" string |
| Clients table — Next deadline column | `<DueDate>` in the cell |
| Alerts CopilotPane — deadline shifts | Show old → new official; internal target rolls forward by the same buffer |
| Deadline detail page | Both dates with the buffer math visible |
| Email drafts | Internal date never sent to clients — they only see official |

## Today vs Timeline — separation of concerns

Recurring product question: should Timeline be merged into Today as a date-range filter? **Recommendation: keep them separate.**

### What each surface answers

| Surface | Question it answers | Mental model |
|:---|:---|:---|
| **Today** (`/`) | "What do I need to *do* right now?" | Action queue — chases, replies, approvals, today's filings. Reactive. |
| **Timeline** (`/timeline`) | "What's coming up across all my clients in the next 30 days?" | Forward plan — capacity, multi-client load, vacation scheduling. Proactive. |
| **Triage mode** (`/today/triage`) | "Walk me through one item at a time, fast." | Focused queue — Superhuman-style sweep. Inherits Today's queue. |

### Why a single page with a date filter falls short

- **Different verbs.** Today's verbs are commit-now: Send chase, Mark received, File. Timeline's verbs are plan-ahead: Move milestone, Reassign, Defer. Same verbs on the same page would mean every row exposes both sets — clutter.
- **Different sort orders.** Today sorts by urgency-now (overdue → due-today → awaiting-review). Timeline sorts by chronology + per-client grouping. A toggleable sort hides the right answer behind a control.
- **Different defaults.** Today defaults to "show me what needs action." Timeline defaults to "show me everything in flight." A filter that defaults to one cuts off the other's value.
- **Today is the daily destination.** CPAs open the app many times a day; the URL `/` should always answer "what now?" — not "depends on the date filter."
- **Timeline is the weekly/monthly destination.** Capacity planning happens in distinct sessions (Friday afternoon, end-of-month review). Lumping it into the daily surface dilutes both.

### Where the surfaces *should* converge

- **The action queue itself.** The deadlines feeding Today's Action Queue and the tasks feeding Timeline draw from the same `Deadline` + `TaskMilestone` records. The split is purely in how each surface filters and presents that pool.
- **The filter primitives.** Both pages should use the same `MultiSelectChip` / `FilterChip` shapes (already done after the #16 work).
- **DueDate display.** Both pages render `<DueDate>` for the official + internal target convention.
- **Triage mode.** `/today/triage` is reachable from Today but operates on the same task pool Timeline shows. One queue, two views.

### The one case for merging — and why it doesn't pay off

If Timeline were truly empty most of the time (e.g., quiet practice with 5 clients), keeping it as a separate sidebar item adds nav weight for little payoff. **But:** for the target persona (Sarah Mitchell, 49 clients; Yan Jing, 600), Timeline is never empty during filing season — it's where load gets distributed across staff. The sidebar weight is earned.

### Conclusion

Keep Today and Timeline separate. Borrow the strongest parts of each across:
- Today inherits Timeline's keyboard-driven queue feel (#21 stage Dialog pattern can move into Today's Action Queue when actions need confirmation).
- Timeline inherits Today's "what's up first" highlighting (focus indicator, auto-advance) for the triage mode that overlays it.

The two pages aren't competing surfaces — they're two readings of the same data, and the cost of maintaining them as separate destinations is dwarfed by the cognitive cost of compressing them into one.

## Triage queue patterns

The `/alerts` page is a triage queue. Three patterns make it feel like a queue (not a viewer) and protect the gap-loud invariant per memory `feedback_gap_over_fill`.

### Handled-this-session fade

After the CPA acts on an alert (Send all / Apply deadline / Forward bulletin / Snooze / Mark not applicable), the feed card fades to `opacity-60` with a `Handled this session` chip in the title zone. The card stays in the list — gap-loud info is preserved (the CPA can re-open) — but visually demotes so the eye skips it on the next scan.

| Property | Value |
|:---------|:------|
| Card opacity (handled) | `opacity-60`, `hover:opacity-95` |
| Chip | `bg-ok-bg border-ok-border text-ok-ink`, `<Check w-3 h-3>` icon, `text-2xs font-medium`, `rounded` (not pill — a chip, not an indicator) |
| Selection ring | suppressed when handled — selected ring + faded card looks like an error |
| Persistence | session-scoped (`useState<Set<string>>` on the page). Reload clears. |

### Auto-advance after action

Every "do" or "defer" action calls a single `onComplete(alertId)` callback. The page marks the alert handled (above) and then navigates to the next un-handled alert *in the active tab*:

```
   1. find current index in `filtered`
   2. look forward — first un-handled alert after current
   3. else look backward — first un-handled alert before current
   4. else navigate to /alerts (no auto-select)
```

Tab-scoped on purpose: if the CPA is in "Affecting you" they want to clear that queue, not jump into "All announcements." When the queue is empty, the empty state speaks.

### Partial selection in batch actions

Batch actions ("Send 5 emails", "Apply deadline to 5 filings") are not all-or-nothing. The CPA can exclude individual clients before committing.

UI: each affected client renders as a chip in a "Sending to N" sub-zone of the action card. Click a chip to toggle exclusion. Excluded chips render `line-through text-ink-400` with a rotated `<X>` glyph; included chips show the `<X>` only on hover.

| Property | Value |
|:---------|:------|
| Included chip | `bg-surface border-line text-ink-700`, hover deepens to `border-danger-border text-danger-ink` (signals the click action: exclude) |
| Excluded chip | `bg-transparent border-line text-ink-400 line-through`, hover restores to ink-700 (signals: include) |
| Hover X glyph | `opacity-0 group-hover:opacity-100`; on excluded chips, the glyph is rotated 45° (visible at rest as the strike-through marker) |
| Live count | the action's CTA reads `Send {N}` where N is the included count. Disabled when N = 0. |
| State location | per-alert `Map<alertId, Set<clientId>>` on the page. Per-alert because the same client can be in multiple alerts and exclusion is per-decision. |

### Sticky disposition footer

Escape hatches (`Snooze until tomorrow`, `Mark not applicable`) sit in their own labeled sub-zone, **pinned above the composer outside the scroll container**, so they stay reachable regardless of how long the action list grows.

| Property | Value |
|:---------|:------|
| Position | flex sibling between the scrollable body (`flex-1 overflow-y-auto`) and the composer footer — never inside the scroll container |
| Background | `bg-canvas` (not `bg-surface`) so it visually separates from the action cards above |
| Eyebrow | `text-2xs uppercase tracking-wider font-semibold text-ink-400` reading `DISPOSITION` |
| Items | inline buttons separated by a middle dot, no helper text (terse — daily-use surface) |

Per DESIGN.md §Do's: "Keep escape hatches visible." Disposition belongs in the same surface as the primary action, not buried in a settings page or hidden after a scroll.

## Alert-type primary verb taxonomy

The `/alerts` co-pilot pane derives its primary verb from `alertType`.
Generic phrasing ("Apply", "Send all") is reserved for fall-through cases
where the alert lacks the type-specific signal (e.g. a `form_change`
without a `newDeadline`).

| `alertType` | Primary verb | CTA label | Secondary verbs |
|:------------|:-------------|:----------|:----------------|
| `disaster_extension` | Move {N} deadlines to {date} | `Move {N}` | Send notice · Tag clients |
| `penalty_relief` | Tag {N} clients for review | `Tag {N}` | Send notice |
| `pte_change` | Schedule planning call | `Schedule` | Send talking points |
| `rate_change` | Recompute estimates | `Recompute` | Notify {N} clients |
| `form_change` | Acknowledge (non-admin) / Apply firm-wide (admin) | `Acknowledge` / `Apply` | Notify clients |
| `nexus_change` | Add filings for {N} clients | `Add filings` | Run nexus check |

**Implementation contract.** The pane's primary `<ActionRow>` reads its
title + CTA from this table. The Send-bulletin row remains alertType-
agnostic (every type can produce a bulletin). The Triage handoff
(`/today/triage?alert=:id`) is alertType-agnostic as well — it appears
whenever `includedCount > 1`.

Each primary verb routes to its confirm modal:
`BatchNotifyModal` (notify-clients) ·
`RecomputeEstimatesModal` (rate_change) ·
`NexusCheckModal` (nexus_change) ·
`SchedulePlanningCallModal` (pte_change) ·
`MigrationPreviewModal` (form_change firm-wide). Generic
"Apply new {date} deadline" survives as the fallback when the alert
carries `newDeadline` but the alertType isn't `disaster_extension`.

## Devx note: tailwind config + token additions

Tailwind picks up new tokens from `tailwind.config.js` only on **dev server cold start**. If you add a token (`text-newSize`, `bg-newColor`, `mb-newSpacing`, etc.) and it doesn't render, restart the Vite dev server. HMR re-runs file watchers but does not rebuild the Tailwind config layer.

## Archive — superseded guidelines

Rules removed from the active doc on **2026-05-03** after a reference audit against `Downloads/design references_final/` (13 reference shots — Mercury banking dashboard ×11, Sana AI ×1, Retero ×1) and against the shadcn `<Button>` component we already ship. Kept here so a reader who finds the rule cited in a code comment, PR, or older doc knows why it's no longer load-bearing.

**Resolution rule** (per user direction, 2026-05-03): when DESIGN.md, shadcn primitives, and the references disagree, **shadcn + references win**. DESIGN.md is updated to match.

| Removed rule | Why it's archived |
|:-------------|:------------------|
| **"Two affordances only: `button-primary` + `link`. No outline buttons. No ghost buttons."** | shadcn `<Button>` ships `outline` / `ghost` / `secondary` / `destructive` as core variants. Mercury references show outline pills (Cancel, alternate-path) and ghost icon-buttons (search, more-menu, dismiss) as first-class affordances. Refusing them forced bespoke buttons across the product. Replaced by the variant-by-intent table in §Components > Buttons. |
| **"No icon-only buttons except chevrons inside card headers."** | We ship `<IconButton>` (composes `Button variant=ghost size=icon` with required `aria-label`). Mercury uses icon-only buttons heavily. Replaced by §Components > Buttons paragraph on `icon` size + `<IconButton>`. |
| **"Primary (deep ink) used only on primary commit buttons"** (§Colors prose) | The next-action CTA is **indigo**, not slate — established by T2, confirmed by Mercury references, applied in code (Today / Alerts CopilotPane / AnnouncementBanner). Slate `primary` token survives for the user-avatar circle and the user-menu trigger only. Updated in §Colors. |
| **"Bounded max-width 840px"** as the universal layout rule (§Layout & Spacing prose) | Stale before this audit — `<PageContainer>` already had `default` / `wide` / `workshop` variants. The 840 cap survives for `default` only. Mercury table pages use ~1080px (matches our `wide`); workshops are full-viewport. Updated in §Layout & Spacing. |

If you find another rule in this doc that contradicts the references or shadcn primitives, raise it — the active doc should always reflect what we actually build.

## Design substrate — 2026-05-05 OKLCH refresh (canonical)

This section **supersedes** the hex-based color tokens in §Colors and the indigo next-action accent in T2 / §Components. Everything else in this doc — layout/spacing, typography ladder, modal/popover discipline, voice, accessibility, motion, Mercury inheritance principles, four-alert-surfaces, anatomy rules, 3-tier scan rule — remains in force.

### What changed

The product now sits on a **shadcn-format OKLCH semantic-token substrate**. Three meaningful shifts:

1. **Next-action accent is green, not indigo.** `--primary: oklch(60% 0.2 120)` — a vibrant green at hue 120. Replaces `#5B5BD6` (indigo) wherever T2's "one accent, one viewport, one action" applies. Mercury's blue-indigo was an inherited reference choice; the product's own accent is now green-on-cool-neutral. Mercury's spacing/typography/density rules stand; the *color* of the next action does not.
2. **Cool neutral hue is 286, not 220.** `oklch(* 0.01 286)` — a faintly purple-warmed cool gray ladder. Replaces the slate-family hex ladder. Reads slightly warmer than slate while staying explicitly non-blue.
3. **Dark mode is first-class.** A complete `.dark` token set is required. Components must read from semantic tokens (`bg-background`, `text-foreground`, `border-border`) so the same DOM works in both modes.

`components.json` flips `cssVariables: false → true`. `src/index.css` hosts the `:root` + `.dark` blocks. `tailwind.config.js` colors block becomes a thin shim that maps Tailwind names (`bg-canvas`, `text-ink-900`, `bg-indigo`) onto the OKLCH `--*` variables, so existing JSX continues to compile while underlying values shift; subsequent codemods rename to the semantic forms (`bg-background`, `text-foreground`, `bg-primary`).

### Canonical token set

```css
:root {
  /* Surfaces */
  --background: oklch(98% 0 0);            /* page canvas — was #F8F9FB */
  --card: oklch(96% 0.005 286);            /* card surface — was #FFFFFF (now slightly tinted) */
  --popover: oklch(98% 0 0);               /* dropdown / popover surface */
  --header: oklch(98% 0 0);                /* TopBar */
  --footer: oklch(98% 0 0);                /* BottomTabBar / sticky footer */

  /* Text */
  --foreground: oklch(10% 0.01 286);       /* primary ink — was ink-900 #0F172A */
  --card-foreground: oklch(10% 0.01 286);
  --popover-foreground: oklch(10% 0.01 286);
  --header-foreground: oklch(10% 0.01 286);
  --footer-foreground: oklch(10% 0.01 286);
  --muted-foreground: oklch(45% 0.01 286); /* secondary ink — was ink-500 #64748B */

  /* Surfaces — secondary / muted / accent */
  --secondary: oklch(92% 0.01 286);        /* sunken — was #F2F3F5 */
  --secondary-foreground: oklch(10% 0.01 286);
  --muted: oklch(92% 0.01 286);
  --accent: oklch(92% 0.01 286);           /* accent surface — chip bg, hover row */
  --accent-foreground: oklch(60% 0.2 120); /* GREEN ink on accent — soft-active chip pattern */

  /* Primary — the next-action accent */
  --primary: oklch(60% 0.2 120);           /* GREEN — was indigo #5B5BD6 */
  --primary-foreground: oklch(98% 0 0);

  /* Status — destructive only in OKLCH for now; warn/ok/info inherit Mercury hex */
  --destructive: oklch(55% 0.2 20);        /* red — was #DC2626 */
  --destructive-foreground: oklch(98% 0 0);

  /* Lines */
  --border: oklch(88% 0.01 286);           /* hairline — was line #E2E8F0 */
  --input: oklch(88% 0.01 286);
  --ring: oklch(60% 0.2 120);              /* focus ring — green */

  /* Charts (5-step gradient from primary) */
  --chart-1: oklch(60% 0.2 120);
  --chart-2: oklch(50% 0.15 120);
  --chart-3: oklch(45% 0.1 120);
  --chart-4: oklch(40% 0.05 120);
  --chart-5: oklch(35% 0.02 120);

  /* Sidebar (own surface family) */
  --sidebar: oklch(96% 0.005 286);
  --sidebar-foreground: oklch(10% 0.01 286);
  --sidebar-primary: oklch(60% 0.2 120);
  --sidebar-primary-foreground: oklch(98% 0 0);
  --sidebar-accent: oklch(92% 0.01 286);
  --sidebar-accent-foreground: oklch(10% 0.01 286);
  --sidebar-border: oklch(88% 0.01 286);
  --sidebar-ring: oklch(60% 0.2 120);

  /* Code surface (activity-log monospace, AI inference IDs, audit hashes) */
  --code: oklch(98% 0 0);
  --code-foreground: oklch(60% 0.2 120);
  --code-highlight: oklch(94% 0.01 286);
  --code-number: oklch(50% 0.15 120);
  --code-selection: oklch(92% 0.01 286);
  --code-border: oklch(88% 0.01 286);

  --radius: 0.625rem;  /* 10px — page-default. cards = radius − 2px (8px). modals = radius + 2px (12px). */
}

.dark {
  --background: oklch(10% 0.01 286);
  --foreground: oklch(98% 0 0);
  --card: oklch(12% 0.01 286);
  --card-foreground: oklch(98% 0 0);
  --popover: oklch(12% 0.01 286);
  --popover-foreground: oklch(98% 0 0);
  --primary: oklch(88% 0.2 120);            /* lighter green in dark mode */
  --primary-foreground: oklch(10% 0.02 286);
  --secondary: oklch(20% 0.02 286);
  --secondary-foreground: oklch(98% 0 0);
  --muted: oklch(20% 0.02 286);
  --muted-foreground: oklch(60% 0.01 286);
  --accent: oklch(25% 0.02 286);
  --accent-foreground: oklch(88% 0.2 120);
  --destructive: oklch(60% 0.2 20);
  --destructive-foreground: oklch(98% 0 0);
  --border: oklch(25% 0.02 286);
  --input: oklch(25% 0.02 286);
  --ring: oklch(88% 0.2 120);
  --chart-1: oklch(88% 0.2 120);
  --chart-2: oklch(70% 0.15 120);
  --chart-3: oklch(60% 0.1 120);
  --chart-4: oklch(50% 0.05 120);
  --chart-5: oklch(40% 0.02 120);
  --sidebar: oklch(10% 0.01 286);
  --sidebar-foreground: oklch(98% 0 0);
  --sidebar-primary: oklch(20% 0.02 286);
  --sidebar-primary-foreground: oklch(98% 0 0);
  --sidebar-accent: oklch(20% 0.02 286);
  --sidebar-accent-foreground: oklch(98% 0 0);
  --sidebar-border: oklch(25% 0.02 286);
  --sidebar-ring: oklch(88% 0.2 120);
  --header: oklch(10% 0.01 286);
  --header-foreground: oklch(98% 0 0);
  --footer: oklch(10% 0.01 286);
  --footer-foreground: oklch(98% 0 0);
  --code: oklch(12% 0.01 286);
  --code-foreground: oklch(88% 0.2 120);
  --code-highlight: oklch(18% 0.02 286);
  --code-number: oklch(70% 0.15 120);
  --code-selection: oklch(20% 0.02 286);
  --code-border: oklch(25% 0.02 286);
  --radius: 0.625rem;
}
```

### Migration map (old hex → new OKLCH semantic)

| Old token (hex) | New semantic | Old JSX class | New JSX class |
|:---|:---|:---|:---|
| `#F8F9FB` canvas | `--background` | `bg-canvas` | `bg-background` |
| `#FFFFFF` surface | `--card` | `bg-surface` | `bg-card` |
| `#F2F3F5` sunken | `--secondary` / `--accent` | `bg-sunken` | `bg-secondary` |
| `#0F172A` ink-900 | `--foreground` | `text-ink-900` | `text-foreground` |
| `#334155` ink-700 | (dark `--muted-foreground` ≈) | `text-ink-700` | `text-foreground/70` *or* keep alias |
| `#64748B` ink-500 | `--muted-foreground` | `text-ink-500` | `text-muted-foreground` |
| `#94A3B8` ink-400 | `text-muted-foreground/60` | `text-ink-400` | `text-muted-foreground/60` |
| `#E2E8F0` line | `--border` | `border-line` | `border-border` |
| `#5B5BD6` indigo | `--primary` (now GREEN) | `bg-indigo` | `bg-primary` |
| `#ECECFE` indigo-soft | `--accent` (with `--accent-foreground` = green) | `bg-indigo-soft` | `bg-accent text-accent-foreground` |
| `#3D3DAF` indigo-ink | `--accent-foreground` | `text-indigo-ink` | `text-accent-foreground` |
| `#DC2626` danger-solid | `--destructive` | `bg-danger-solid` | `bg-destructive` |

The `warn` / `ok` / `info` status families remain on Mercury hex tokens until the substrate widens; only `destructive` is in the OKLCH set. When extending: pick OKLCH triples in the same lightness/chroma family as `destructive` (~55% L × 0.2 C) at hues 60 (warn), 140 (ok — note: collides with primary 120, choose carefully), 240 (info).

### Implementation contract

1. `components.json`: flip `cssVariables: false → true`.
2. `src/index.css`: paste the `:root` + `.dark` blocks as the canonical layer-base.
3. `tailwind.config.js`: replace the hex `colors:` block with a token-pass-through. Tailwind names (`indigo`, `ink-900`, `canvas`, `surface`, `sunken`, `line`) become aliases that resolve to the same `--*` variables (existing JSX compiles unchanged on the day of the flip).
4. `<ThemeProvider>` (new): adds/removes `.dark` on `<html>` based on user preference + `prefers-color-scheme`. Persisted in `localStorage` under `theme`.
5. **Codemod pass** (after the substrate flip): every `bg-indigo*` / `text-indigo*` / `ring-indigo` / `border-indigo` migrates to `bg-primary` / `text-primary` / `ring-ring` / `border-primary`. Every `bg-accent` (legacy slate) migrates to `bg-foreground` (the few legitimate "near-black surface" cases) or `bg-primary` (where T2 applies). The slate-vs-indigo distinction collapses — there is one accent, and it is `--primary` (green).

### Radius scale under `--radius: 0.625rem`

| Element | Class | Computed |
|:---|:---|:---|
| Pills, status indicators, count badges | `rounded-full` | full |
| Cards, buttons, inputs, dropdowns | `rounded-md` | `--radius − 2px` = 8px |
| Modals, drawers, sheets | `rounded-lg` | `--radius` = 10px |
| Floating help, large surfaces | `rounded-xl` | `--radius + 2px` = 12px |

### Mercury-specific deep-audit additions (2026-05-05 reference batch)

These extensions sit on top of the OKLCH substrate. Each is a primitive or pattern surfaced by the new Mercury reference shots (Reimbursements, Add Team Member modal, Users settings, Search palette, Tasks, Capital, Notifications).

#### §Money typography — `<MoneyValue>`

Mercury renders dollar amounts with **cents superscripted at 60% scale**, baseline-raised so the cents read as a footnote, not a co-equal number. `$50.25` becomes:

```
$50.25
└──┘└─┘
 │   └── 60% font-size · vertical-align 0.35em · opacity 0.7 · tabular-nums
 └────── major value · font-weight 600 · tabular-nums · text-foreground (or text-primary on next-action rows)
```

Spec:

| Property | Value |
|:---|:---|
| Major (whole dollars) | `text-display` (22px / 600) on KPI tiles · `text-body-lg` on row cells. `font-feature-settings: 'tnum' 1, 'zero' 1` |
| Cents (`.NN`) | 60% of major · `vertical-align: 0.35em` · `opacity: 0.7` · same tnum/zero |
| Negative sign | `-` precedes `$`, never parens. `text-destructive` when negative. |
| Currency code (multi-currency) | `text-2xs uppercase tracking-wider text-muted-foreground` after cents. Hidden by default for USD. |
| Zero amount | render `$0` (no `.00`). |
| Em-dash for missing | render `—` in `text-muted-foreground/60` (no `$0`, no `N/A`). |

Implementation: `src/components/ui/MoneyValue.tsx`. Used by `<MetricTile>` when `value` is monetary, by every table cell with a dollar figure, by every banner / pill that quotes an amount.

When the row owns the queue's next action (e.g. "$2,200 due Apr 18" on an unpaid row), the major picks up `text-primary`; otherwise `text-foreground`.

CSS reference:

```css
.money-major { font-feature-settings: 'tnum' 1, 'zero' 1; }
.money-cents {
  font-size: 0.6em;
  vertical-align: 0.35em;
  opacity: 0.7;
  font-feature-settings: 'tnum' 1, 'zero' 1;
}
```

#### §Avatar — pastel color variants

Current `<Avatar>` ships `tone: neutral | primary` only (gray / black). Mercury uses **pastel-tinted bubbles hashed from the name** (mint / lavender / peach / sand / sky / rose / cream — 7 hues at uniform L=88% C=0.05) so dense lists feel populated without identical gray bubbles dulling the eye.

Spec:

| Property | Value |
|:---|:---|
| Light-mode palette | mint `oklch(88% 0.05 140)` · lavender `oklch(88% 0.05 280)` · peach `oklch(88% 0.05 40)` · sand `oklch(90% 0.04 80)` · sky `oklch(88% 0.05 220)` · rose `oklch(88% 0.05 340)` · cream `oklch(92% 0.03 90)` |
| Dark-mode palette | same hues at L=30% C=0.05 (perceptual lightness uniformity) |
| Initials ink | `text-foreground/80` — high enough to read, soft enough not to compete |
| Hash function | `hashName(name) % 7` — same name → same bubble across renders. Stable across reloads. |
| Disabled tone | `tone: neutral` returns to gray (placeholder / "not yet matched") |
| Real photo | when uploaded, bubble background hidden; image fills the round/square shape |

Where it shows: every list with people (Mail thread list, Clients table, ClientDetail header, Settings → Team), every chip with a person (`<ClientChip>`), every comment / activity-log entry with a participant.

#### §Status pills — extended family (lavender, pink, peach)

Mercury distinguishes "in-flight" states that aren't quite warning but aren't info. Three new variants:

| Variant | Light bg / ink | Meaning |
|:---|:---|:---|
| `review` (NEW) | lavender `oklch(94% 0.04 280)` / `oklch(45% 0.15 280)` | Waiting on client (chase sent, not received_confirmed). Softer than `warn` (which means behind target). |
| `attention` (NEW) | soft pink `oklch(94% 0.05 0)` / `oklch(50% 0.2 0)` | Action required, escalated, blocking decision pending. Softer than `danger` (which means overdue). |
| `declined` (NEW) | peach `oklch(94% 0.05 40)` / `oklch(50% 0.2 40)` | Declined / rejected / not-applicable. Distinct from `danger` — the user said "no", not the system flagged "broken". |

Existing `ok` / `warn` / `danger` / `info` / `neutral` / `accent` (now green) survive. Total of 9 pill variants — used sparingly per T4 ("status colors are pills, never paint").

#### §FilterChip — soft-active variant

Current `<FilterChip>` "active" state is the loud `bg-foreground text-background` (filter-is-on archetype). Mercury references show a quieter active state inside ambient chip groups: `bg-accent text-accent-foreground` (soft-secondary surface with green ink). Three intensity levels:

| Variant | Active state | When |
|:---|:---|:---|
| `chip` (current loud) | `bg-foreground text-background` | KPI-tile-row filters where "this is on" must shout |
| `chip-soft` (NEW) | `bg-accent text-accent-foreground` | Search palette filter chips, secondary filter rows, ambient chip groups |
| `tab` (existing) | `text-foreground border-b-2 border-primary` | Page tabs (Alerts, Mail, Settings sub-nav). Underline carries the signal. |

#### §NotificationCard — settings cluster pattern

Mercury's Notifications settings page renders three "Important Updates" categories as compact cards in a row. Each card holds: title (`text-title` 16px/600), subtitle (`text-body text-muted-foreground`), `Edit` chevron link, and a row of channel pills (`Email`, `Push`) showing wired channels.

Spec for `<NotificationCard>`:

| Zone | Content |
|:---|:---|
| Title | `text-title` — domain name (Cash flow / Suspicious activity / Tasks and approvals) |
| Subtitle | `text-body text-muted-foreground` — one-line reason |
| Edit affordance | `<Button variant="link">Edit</Button>` + chevron — opens per-category settings drawer |
| Channel pills | Inline `<StatusPill variant="ok" size="xs">Email</StatusPill>` per active channel |
| Surface | `bg-card border border-border rounded-md p-region` — same as `<Card>` |

Used wherever settings categorize notifications by channel (Settings → Notifications, Settings → Reminders).

#### §Floating help affordance — `<HelpFab>`

Mercury references all show a floating `?` IconButton in the **bottom-right corner**. Adopt as a global affordance:

| Property | Value |
|:---|:---|
| Position | `fixed bottom-6 right-6 z-tooltip` (z=70) |
| Size | 36×36, `rounded-full` |
| Background | `bg-card border border-border shadow-pop` |
| Icon | `<HelpCircle>` Lucide, 18px, `text-muted-foreground` |
| Click | opens `<ShortcutsModal>` (existing) — keyboard shortcuts + "Send feedback" link |
| Hide on | `/login`, `/signup`, `/onboarding/*`, `/magic-link` — the affordance is for in-product help only |

Mercury's bottom-right also shows a "map" icon. **We do not adopt the map** — the sidebar IS the wayfinding (T5).

#### §Header / Footer / Code surface tokens

The OKLCH substrate adds three surface tokens not previously named: `--header`, `--footer`, `--code`. Bind them:

- `--header` → TopBar background. Identical to `--background` in light mode; brings its own ink in dark mode.
- `--footer` → BottomTabBar (mobile-only) and any sticky-bottom footer (Alerts disposition footer when promoted to sticky). Same as `--header` in light, distinct in dark.
- `--code` → activity-log monospace strings (request IDs, AI inference IDs, audit-log diffs, the `· A` telemetry suffix in Settings → AI). New surface for any future debug / engineer-facing string.

### What stays from Mercury inheritance

- 8 / 16 / 24 / 48 spacing rhythm.
- 22 / 18 / 14 / 13 / 12 / 11 typography ladder.
- Cents-superscript money treatment (now formalized — see above).
- Pill-vs-soft-rectangle shape rule (T3) — pills for indicators, `rounded-md` for actions.
- 4 alert surfaces.
- 3-tier scan rule.
- Account entrance bottom-left.
- Sidebar order: Today / Alerts / Timeline / Clients / Mail / Opportunities.
- Modal / popover / dropdown discipline.
- Voice & microcopy rules.
- 44×44 minimum touch targets.

### What's superseded by this substrate (logged in §Archive)

- `#5B5BD6` indigo as "the next-action color." Replaced by `oklch(60% 0.2 120)` (primary green) via `--primary`.
- The slate `accent` legacy back-compat note (user-avatar circle, user-menu trigger). The avatar uses `bg-foreground` (near-black ink) under the new substrate; the user-menu trigger uses `bg-secondary text-foreground` rest, `bg-accent` hover.
- T2 example "indigo solid pill" — same principle (one accent, one viewport, one action), color flipped to green.
- §Element states table's `bg-indigo` / `ring-indigo` references — read as `bg-primary` / `ring-ring` going forward.

## Quiet register — 2026-05-05 refinement (canonical)

This section **supersedes** several specific token / state choices in earlier sections. The product's overall taste shifts one notch quieter: no yellow, no thick lines, no dark borders, every element grouped. The principles below are mechanical — applied uniformly, the surface tightens without losing density.

### Q1 · No yellow / amber

The hex `warn` family (`bg #FFFBEB · border #FCD34D · ink #92400E · solid #D97706`) is **retired**. Yellow / golden tones read as caution-tape: loud, dated, and visually noisy on a calm canvas. Mercury's "Pending Review" (lavender) and "Declined" (peach) prove a quieter palette can carry the same urgency vocabulary without amber.

**Replacement:** the `warn` semantic survives but its colors flip to **soft peach/coral** at oklch hue 25–35:

| Token | Old (amber, retired) | New (peach, canonical) |
|:------|:---------------------|:------------------------|
| `--warn-bg` | `#FFFBEB` | `oklch(95% 0.04 35)` — pale peach |
| `--warn-border` | `#FCD34D` | `oklch(85% 0.06 35)` — quiet peach edge |
| `--warn-ink` | `#92400E` | `oklch(45% 0.15 30)` — warm rust-brown for contrast |
| `--warn-solid` | `#D97706` | `oklch(60% 0.18 30)` — coral (only on icons / borders, never as a fill) |

Where `warn` was used:

| Surface | Old | New |
|:--------|:----|:----|
| "Behind target" pill on Timeline | amber tinted | peach tinted (same `<StatusPill variant="warn">`, repainted) |
| "Still waiting on client" sub-zone (ClientDetail / TaskDetail) | amber-tinted bg | peach-tinted bg |
| "Reminders out, awaiting reply" Mail card | amber-tinted bg | peach-tinted bg, OR migrate to `<StatusPill variant="review">` (lavender) since the semantic IS "waiting on client" |
| "Stuck >14d" KPI tile value | amber ink | peach ink |
| "OVERDUE -Nd" pill | already `danger` (red) ✓ | unchanged |
| "What changed" banner status icon | amber circle | peach circle, OR demote to `info` (cool blue) since the banner is informational |

**Don't replace yellow with another high-saturation hue.** The point is restraint, not a hue swap. Peach at oklch L=95 C=0.04 reads as a near-neutral with a warm shift — a "quiet alert." If a future signal genuinely needs higher urgency, it earns `danger` (red); there is no middle tier between calm peach and alarm red.

### Q2 · No thick lines

Borders carry hierarchy by *presence*, not by *weight*. The hairline (`1px`) is the only stroke that earns its keep.

**Forbidden:**

- `border-2`, `border-l-4`, `border-r-4`, `border-b-2`, `border-t-2` — anything thicker than 1px.
- The 4px status left-rule on `<Banner>` (`border-l-4 border-warn-solid` and friends). Status banners now carry their signal via tinted bg + status-icon-prefix only. The left rule was decoration; it goes.

**Permitted exceptions** (and only these — anything else is a finding):

| Element | Stroke | Reason |
|:--------|:-------|:-------|
| Tab active marker | `border-b-1.5 border-primary` (1.5px hairline) | The tab underline is the canonical "you are here" mark for a tab cluster. 1px reads as a default border; 1.5px reads as intentional. Never 2px. |
| Focus ring | `outline-2 outline-primary outline-offset-2` | Outline, not border — paints on top, doesn't shift layout. Required for keyboard a11y. |
| Loud-archetype filter active state | `bg-foreground text-background` (no border at all) | Surface fill carries the signal; no border needed. |

For everything else: 1px hairline, `--border` token, or no border at all.

### Q3 · No dark borders

Borders are `--border` (`oklch(88% 0.01 286)`) only. Two specific exceptions, both addressed by this rule:

- `border-line-strong` (`#CBD5E1` ≈ `oklch(82% 0.01 286)`) on hover / hover-card states → **collapsed to `--border`**. Hover communicates via bg-shift (`bg-accent` or `bg-secondary`), never via a darker border. The visual delta of a 6% lightness shift on a 1px line is too subtle to register as feedback anyway; the surface fill does the work.
- `border-foreground` / `border-ink-900` / `border-black` anywhere in the codebase → **forbidden as a border**. `--foreground` is the *darkest* surface in the palette; using it as a 1px stroke around a card or chip reads as harsh outline-art, not soft chrome. If a divider needs to read as "harder," promote to a `<CardDivider>` (1px `--border`) inside a `divide-y` group, or change the surface tint instead.

The "selected/on" archetypes (§Element states) keep their existing definitions — `bg-foreground text-background` (loud filter) is a **surface fill**, not a border, so it survives Q3 unchanged.

### Q4 · Grouping discipline (no orphans)

Every visible element belongs to a zone. Zones nest into sections; sections compose the page. **An orphan — a stray pill, a lone button, a one-off chip floating between two unrelated cards — is a bug**, not a styling choice.

**The grouping ladder (T1–T3 made structural):**

| Tier | Example | Boundary |
|:-----|:--------|:---------|
| **Element** | A status pill, a button, a date label | None — elements never sit alone. They join a row. |
| **Row** | A line of related elements (icon + label + meta + action) | Hairline `divide-y` if multiple rows; otherwise the row's parent zone provides the boundary. |
| **Zone** | A semantically homogeneous group of rows (e.g. "Documents requested" inside TaskDetail) | The card surface (`<Card>`) or a sub-card (`<CardZone>` between dividers). |
| **Section** | A semantically homogeneous group of zones (e.g. "Action queue" on Today) | A `<SectionHeader>` + the cards beneath. Whitespace at `gap-section` (48px) above and below. |
| **Page** | The whole work surface | `<PageContainer>` + `<PageHeader>`. |

**Failure modes (each is a Q4 violation):**

- **Stray pill outside a zone.** A `Pro` pill in the TopBar that doesn't belong to a row, a card, or a header cluster — orphan. Either move it into the `<TopBar>` user-cluster zone or kill it.
- **Banner outside a section.** A `<Banner>` rendered between two `<SectionHeader>`s with no zone-membership — orphan. Either nest it inside the section it modifies, or promote it to a Page-level slot above the first section.
- **Lone button between cards.** A `+ Add deadline` button rendered standalone between two task cards, not anchored to a card header or footer — orphan. Anchor it to the section header (right-aligned), the empty-state CTA, or the parent card's action row.
- **Sub-zone without a header.** A warn-tinted "Still waiting on client" sub-zone that has no eyebrow or count — readable but unnamed. Add `<SectionHeader>` (or a smaller eyebrow + count chip) so the zone announces itself.
- **Cards in the void.** Two cards stacked in a column with no `<SectionHeader>` above and no `gap-section` below — they read as the same surface. Either group them under a section header or merge them.

**The rule of thumb:** if you can point to an element and ask "what does this belong to?", and the answer isn't immediate, it's an orphan. Promote, anchor, or remove.

### Q5 · Subtle, easy, confident

The four words from the user direction make a compact taste filter. Apply them in this order when in doubt:

1. **Subtle.** If two surfaces could read as one with a slight tonal shift, prefer the shift over a border.
2. **Easy.** If a row asks the eye to scan more than three pieces of info before locking on the action, drop or move pieces until it doesn't.
3. **Confident.** Pick one CTA per viewport and commit. No "or you could also" tertiary actions on a row that already has a primary.
4. **Quiet.** When a tone could be loud (red), medium (peach), or quiet (neutral / lavender), default to the quietest tone the semantic allows.

When these four conflict with a Mercury reference, this rule wins. Mercury's amber is loud; we go peach. Mercury's `bg-ink-900 text-white` filter pill is loud; we offer a `chip-soft` alternative. Mercury's bottom-right help fab is restrained; we keep it.

### What this section supersedes

| Earlier rule | Supersession |
|:-------------|:-------------|
| `warn` family colors (§Colors, status families) | Now peach (oklch h=30) — see Q1 table |
| `<Banner>` "4px status left rule + tinted bg" (§Shared primitives reference) | Drops the left rule; tinted bg + leading status icon carry the signal alone |
| `border-line-strong` on input/card hover (§Components > Inputs, §Element states) | Collapses to `--border`; hover state uses `bg-secondary` / `bg-accent` shift |
| Tab underline `border-b-2` (FilterChip tab variant, §Components) | Tightens to `border-b-1.5 border-primary` |
| §Don'ts: existing emoji / row-tinting / etc. rules | Unchanged — Q1–Q5 add to the Don't list rather than replacing it |

## Changelog

- **2026-05-03** — Augmentation pass. Added §Brand Vocabulary, §The four alert surfaces, §Component anatomy rules, §Responsive behavior, §Voice & Microcopy, §Accessibility, §Motion, §Invisible correctness, §Shared primitives reference, §Implementation reference, §Devx note. Added Mercury-style indigo accent (`bg-indigo`) + pill radius (`rounded-pill`) as opt-in tokens for the next-action CTA. Added `text-display` / `text-title` / `text-body` / `text-label` / `text-caption` / `text-micro` semantic typography aliases. Created shared primitives: `<PageHeader>`, `<SectionHeader>`, `<Card>`, `<MetricTile>`, refreshed `<StatusPill>` to default `dot=false` (no decorative leading dot). Applied to Today (`/design/today`), Dashboard (`/`), Clients (`/clients`), Alerts (`/alerts`), Mail (`/mail`). Existing surfaces preserved — no functionality stripped, no routes changed.
- **2026-05-03 (later)** — Mercury inheritance restored. Added §Reference inheritance (Mercury / Sana AI / Oku) + §Taste principles (T1–T8) so the doc tells the next builder *what Mercury looks like*, not just what to avoid. Switched canvas warm cream `#FAFAF7` → cool neutral `#F8F9FB` (Mercury / Sana / Oku align). Promoted AnnouncementBanner primary CTA from outline-slate to indigo pill so the Dashboard at `/` visibly carries the Mercury accent.
- **2026-05-03 (v0u rollout)** — Reverse-merged from the v0u four-page rollout (Today / Alerts / Timeline / Clients). Added 6 shared primitives to §Shared primitives reference: `<Avatar>`, `<StateBadge>`, `<ClientChip>`, `<CountBadge>`, `<FilterChip>` (with `chip` + `tab` variants), `<IconButton>` (composes shadcn `Button variant=ghost size=icon`). Enhanced `<MetricTile>` with `helper` text + `active`/`onClick` filter-trigger props. New `width.pane = "440px"` token in tailwind.config for the co-pilot pane. Added §The /alerts workshop surface (2-column feed + co-pilot pane inside AppShell — replaces the old AnnouncementList → AnnouncementDetail two-page flow). Added §KPI tile = filter trigger + §Single drilldown destination per concept. Made "no emojis in product UI" + "no horizontal scroll on data tables" explicit Don'ts. Flagged outstanding gap: per-alertType verb taxonomy from `docs/specs/alert-detail-variants.md` not yet wired into the co-pilot pane (currently uses generic verbs across all 6 alertTypes).
- **2026-05-03 (handoff consolidation)** — Folded residual design guidance from `files/DESIGN-HANDOFF.md` (v1) and `files/DESIGN-HANDOFF-ADDENDUM.md` (v1.3) into this doc and tombstoned both handoffs. Net additions: §Confirm modal discipline (the 8-required / no-modal taxonomy), §Destructive change preview (signed-diff migration modal pattern), §Export modal — three-axis pattern (what × format × recipient). Added two Do rules ("Keep escape hatches visible", "Encode lifecycle status in shape, urgency in color"). Added one Don't ("No tautological status columns"). DESIGN.md is now the single source for design styles + interaction patterns; the handoff files redirect here.
- **2026-05-03 (reference audit)** — Audited 13 reference shots in `Downloads/design references_final/` (Mercury banking dashboard ×11, Sana AI ×1, Retero ×1) against DESIGN.md. Established resolution rule: **shadcn + references win** over DESIGN.md when they conflict. Four rules archived (see §Archive — superseded guidelines): "Two affordances only" (Mercury uses outline + ghost), "No icon-only buttons except chevrons" (we ship `<IconButton>`), "Primary (deep ink) used only on primary commit buttons" (the next-action color is indigo per T2 + Mercury, not slate), and "Bounded max-width 840px" as the universal rule (`<PageContainer>` has 3 variants — 840 cap survives only for `default`). Active sections rewritten: §Colors > Primary, §Layout & Spacing intro, §Components > Buttons.
- **2026-05-03 (deep visual + states pass)** — User direction: keep `rounded-md` for buttons (do not pill them — deliberate departure from Mercury for terminal-density feel). T3 reframed: pills for indicators, soft rectangles for actions. New visual specs added under §Components: Inputs, Modals (visual contract; behavior in §Confirm modal discipline), Dropdown menus, Sidebar nav items — each with explicit padding / radius / background / border / hover / focus values. New §Element states cross-cutting reference table covering rest / hover / focus-visible / active / disabled / selected for every interactive primitive, plus the two distinct "selected/on" archetypes (you-are-here vs filter-is-on). New §Information hierarchy (the 3-tier scan rule) — Tier 1 hero / Tier 2 support / Tier 3 background — with named failure modes (tier inflation, tier flattening, decoration tax, metadata creep, repeat surfaces) for use during dense-screen audits.
- **2026-05-03 (sidebar + Alerts UX pass)** — User direction. Sidebar restructured: (a) Alerts moved to position 2 (Today / Alerts / Timeline / Clients / Mail / Opportunities) so the differentiator surface is one keystroke from the inbox of work it generates; (b) Sarah Mitchell's account entrance pinned to bottom-left (Linear / Notion convention) and removed from TopBar — single account surface. Sidebar shell switched to **floating card** treatment (`my-3 ml-3 rounded-lg shadow-pop`, no right border) per user preference — anchored as a flex sibling so wayfinding stays reliable, but visually a card hovering over the canvas. Alerts page re-grouped into clearly-bordered scan zones: FeedCard now has Zone 1 ("what happened" — state, title, type, summary) + Zone 2 ("who/when affected" — divider + sunken sub-zone with chips + deadline shift); CopilotPane header has its own context strip with grouped meta (type · clients · deadline) below a hairline divider; new "Disposition" sub-zone groups escape hatches (Snooze + Mark not applicable) so they're findable but visually distinct from "do" actions. Lesson learned: density problems are usually **grouping** problems, not removal problems — section the page first, then audit each zone for decoration tax.
- **2026-05-03 (Alerts critique pass + TopBar search + bell dedup)** — Acted on a self-critique of the shipped Alerts page. **Visual hierarchy fixes:** title moved to its own row (no type pill competing for the same line); type pill demoted to the meta line at `xs` size with the time pinned right; AFFECTS eyebrow + chips and the deadline shift now occupy separate visual rows in Zone 2 (calendar icon makes the deadline read as a temporal indicator). **CopilotPane:** middle-dot separators dropped from the meta strip in favor of `gap-3` whitespace (per DESIGN.md §Don't); "AI suggested actions" eyebrow lost its indigo + sparkles + redundant "AI" prefix → now just "Suggested actions" in `text-ink-500`; the email preview's nested-card chrome is gone (border-t divider only — DESIGN.md §Cards bans card-in-card); X close icon replaces the misleading right-chevron; the **Disposition section is now a sticky footer** above the composer (outside the scroll container) so escape hatches stay reachable. **Flow fixes:** session-scoped `handledIds` Set fades each acted-on card to `opacity-60` with a `Handled this session` ok-tinted chip; auto-advance navigates to the next un-handled alert in the active tab after every action; partial-selection chips inside the email action card let the CPA exclude individual clients with a click, with the Send CTA's count updating live (`Send 4` → `Send 3` once one chip is dropped). **TopBar search redesign:** flat sunken div replaced with a proper bordered input affordance (`bg-surface border border-line` rest, `border-line-strong` on hover, `focus-visible` indigo ring), `h-9` height matching shadcn input default, and the ⌘K hint is now a proper bordered chip on `bg-sunken`. **BellDropdown narrowed to non-alert notifications:** state-announcement alerts are no longer merged into the bell — that surface belongs to the sidebar Alerts badge + `/alerts` page (DESIGN.md §The four alert surfaces). Bell now scopes to bounces · team invites · extension approvals; one signal per concept. New §Triage queue patterns captures the three reusable shapes (handled-this-session fade, auto-advance after action, partial selection in batch actions, sticky disposition footer). Floating sidebar refined: collapsed mode (`w-14`) drops the float and goes flush with a `border-r border-line` — a 56px floating rail is decoration. Expanded keeps the lovely card.
- **2026-05-05 (deep sweep — Mode A-F eradication, alert-verb wiring, modal pass)** — User direction "fix this for real" on the two carved-out exceptions plus a re-inspection of every surface. Net result: zero `Mode A-F` strings render in the product, and all six alertTypes now route to their canonical primary verb + modal. **Mode A-F sweep:** ran a bulk sed pass plus per-file cleanup across 39 files (154 references → 0 user-facing). Bulk substitutions: `Mode A` → `inbound-classifier`, `Mode B` → `arrival-timing`, `Mode C` → `anomaly-detector`, `Mode D` → `email-drafter`, `Mode E` → `cross-year-insighter`, `Mode F` → `state-monitor`; multi-letter forms (`Modes B/C/E`, `Mode A · D · F`) collapsed to the comma- or slash-form of the same names. Surfaces touched: TaskMiniTimeline tooltips (4), AiInsightsPanel section titles + footer, ChaseLoopStatus comments, JustHappenedStrip tooltips (2), InsightStrip `<title>`, ModeFHealth body + eval link, OAuthWireframeModal body, PriorYearUpload (2), TriageQueue blurbs (2), multistate ConfirmModal, ChecklistRow tooltip, TaskHeader, Insights `<span>` pill (now reads "Timing" / "Consistency" / "Cross-year" via runtime mapping), Signup, OnboardingDemo, ai-stub.ts dispatcher comment + per-function header comments, mock-adapter chase context, Settings AI-eval. **Settings AI eval re-design:** previous "Mode A | Classify inbound" pattern flipped to "**Classify inbound** ·`A`" — plain-English capability label primary, single-letter telemetry id as a `font-mono` opacity-60 suffix for engineer cross-reference. Card title → "AI capability eval"; description language updated to "each AI capability." Selector pills, drift sentences, and "What gets logged" footnotes all rewrote to the new pattern. **Phase2StatusCard** pause/resume button changed from `bg-accent` (slate) to `bg-indigo` so the next-action color is consistent with T2 across the whole product. **Settings inputs** (FirmPanel firm name / states / address / timezone, TeamPanel email + role) upgraded from the legacy `border border-line rounded px-2 py-1.5` to the spec `h-9 bg-sunken border border-line rounded-md px-3 py-2 focus-visible:bg-surface focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 hover:border-line-strong`. **Alert-type primary-verb wiring** (DESIGN.md §Alert-type primary verb taxonomy promoted to the canonical):  CopilotPane now dispatches per `alertType` — `disaster_extension` → "Move {N} deadlines to {date}" (was generic), `penalty_relief` → opens `<BatchTagModal>` ("Tag {N} clients for review at filing"), `pte_change` → opens `<SchedulePlanningCallModal>` ("Schedule planning call(s)"), `rate_change` → opens `<RecomputeEstimatesModal>` ("Recompute {N} estimates"), `nexus_change` → "Add filings for {N} clients" (was the generic "Run nexus check / Open"), `form_change` → admin-queue route (already correct). Each modal is mounted on the page with a single `*ForAnnouncement` state slot; `onConfirm` flips the alert handled and the auto-advance sweep moves to the next un-handled alert in the active tab. Browser-verified: `Tag 6 clients for review at filing`, `Schedule planning calls for 6 clients`, `Recompute 21 estimates + draft 7 emails` all open from the CopilotPane and their content matches the spec. **Modal hygiene pass:** all `bg-ink-900/40 backdrop-blur-sm` (4 px) → `bg-ink-900/40 backdrop-blur-[2px]` across QuickActionModal, ShortcutsModal, AddClientModal, AddDeadlineModal, EditClientModal, EmailBulletinEditModal, ChaseBundleModal, alert-dialog, sheet primitives. `bg-accent` selected-state on TaskAuditPackModal + ExportModal (format / recipient cards) replaced with the loud `bg-ink-900 text-surface` filter-is-on archetype per §Element states; same surfaces gained focus-visible indigo rings. **NexusCheckModal** "Notify only · Skip filings" middle-dot drift fixed → "Notify only, skip filings". **RecomputeEstimatesModal** "Recompute {N}" → "Recompute {N} estimates" (verb + object). **DESIGN.md change:** §Brand Vocabulary's Mode A-F callout rewrote to remove the Settings → AI exception — Settings now follows the same plain-English-primary rule with the letter id reduced to a small font-mono suffix; identifiers in source code (`ModeFHealth` component, `modeFHealth` tRPC router, `mode` column on AiInsight) are explicitly carved out as schema names that can't render to the user. **Verified:** dev server walked /, /clients, /timeline, /mail, /calendar, /opportunities, /settings + 5 sub-routes, /import — 14 routes, 0 console errors, 0 `Mode [A-F]` substrings in any rendered DOM textContent.
- **2026-05-05 (quiet register refinement — Q1–Q5)** — User direction: tighten the visual register one notch quieter. Five mechanical rules added as §Quiet register: **Q1 No yellow / amber** (retire the `#FFFBEB / #FCD34D / #92400E / #D97706` warn family; replace with peach at oklch hue 30 — `bg oklch(95% 0.04 35)` / `border oklch(85% 0.06 35)` / `ink oklch(45% 0.15 30)` / `solid oklch(60% 0.18 30)`. Quiet alert tone, not a hue swap to another loud color); **Q2 No thick lines** (drop `border-l-4` status rule on `<Banner>`; tighten tab underline `border-b-2` → `border-b-1.5 border-primary`; forbid any stroke ≥ 2px except focus outlines and that single tab hairline); **Q3 No dark borders** (collapse `border-line-strong` to `--border` on hover — hover communicates via bg shift; forbid `border-foreground` / `border-ink-900` / `border-black` anywhere); **Q4 Grouping discipline** (every element joins a zone; orphans are bugs — Element → Row → Zone → Section → Page ladder formalized; named failure modes: stray pill, banner outside section, lone button between cards, sub-zone without header, cards in the void); **Q5 Subtle / easy / confident / quiet** (four-word taste filter — when in conflict with a Mercury reference, this rule wins; Mercury's amber goes peach, Mercury's loud filter pill gets a soft alternative). Net supersession across the doc: `warn` family colors flip; `<Banner>` loses left rule; input/card hover stops bumping border to strong; tab underline tightens. The audit pass following this section scores current code against Q1–Q5 in addition to the substrate flip.
- **2026-05-05 (substrate flip — OKLCH + Mercury-deep additions)** — User direction: pasted a complete shadcn-format OKLCH `:root` + `.dark` token set as the new design substrate, and provided 7 fresh Mercury references (Reimbursements list, Add-team-member modal, Users settings, Search palette, Tasks list, Capital/Financing, Notifications settings) as the layout north star. **Substrate change:** the next-action accent flips from indigo `#5B5BD6` to **primary green** `oklch(60% 0.2 120)`. Cool neutral hue moves from 220 (slate) to 286 (faintly purple-warmed). Dark mode is now first-class — a complete `.dark` token set is required and components must read from semantic tokens (`bg-background`, `text-foreground`, `border-border`). `components.json` will flip `cssVariables: false → true`; `tailwind.config.js` colors block becomes a token-pass-through aliasing legacy names (`indigo`, `ink-900`, `canvas`, `surface`, `sunken`, `line`) onto the new `--*` variables so existing JSX compiles unchanged on flip day. **New active sections:** §Design substrate (canonical token table for `:root` + `.dark`, migration map old hex → new semantic, implementation contract, radius scale under `--radius: 0.625rem`). **New primitives spec'd** (implementation pending): `<MoneyValue>` (cents-superscript at 60% scale + 0.35em raise + 0.7 opacity, `tnum` + `zero` font features), Avatar pastel color hashing (7-hue palette at uniform L=88% C=0.05 — mint/lavender/peach/sand/sky/rose/cream), three new StatusPill variants (`review` lavender, `attention` soft pink, `declined` peach), FilterChip `chip-soft` variant (`bg-accent text-accent-foreground`), `<NotificationCard>` settings-cluster pattern (title + subtitle + Edit chevron + channel pills), `<HelpFab>` floating help affordance (bottom-right `?`, opens `<ShortcutsModal>`). **What stays from Mercury inheritance:** spacing rhythm, typography ladder, T3 pill-vs-soft-rectangle rule, T8 desk-not-stage, four-alert-surfaces, 3-tier scan rule, sidebar order, account entrance bottom-left, modal/popover discipline, voice rules, 44×44 touch targets. **Superseded** (logged in §Archive on this date): `#5B5BD6` indigo as next-action color (now green); slate `accent` legacy back-compat (collapses to `bg-foreground` for near-black surfaces or `bg-primary` for next-action). The doc now describes what a future codemod migrates the codebase TO; the audit pass that follows scores current code against this target.
- **2026-05-05 (consistency sweep — every page, every state, every copy line)** — Full-product audit pass. Inventoried all 24 routes (Today, TodayTriage, Timeline, Calendar, Dashboard, Clients, ClientDetail, TaskDetail, Mail, Inbox, Alerts, AnnouncementList, AnnouncementDetail, Insights, Login + 6 auth pages, 7 onboarding steps, Import, Settings, Changes, Placeholder) and the chrome (AppShell, Sidebar, TopBar, BellDropdown, ChaseLoopStatus, ModeFHealth, JustHappenedStrip, AiInsightsPanel, TriageQueue, multistate ConfirmModal, OAuthWireframeModal, PriorYearUpload, ChecklistRow, TaskMiniTimeline, InsightStrip, FirstRunWelcome, CalendarGrid, TagPicker, OnboardingFirm) against the active doc. **Fixes shipped:** (a) **Mode A-F leakage** — replaced 18 user-facing references to "Mode A/B/C/D/E/F" with plain-English labels per the new mapping table in §Brand Vocabulary. The Settings → AI inference eval admin surface keeps the Mode letters as the documented exception (PRD §4.7 telemetry contract). (b) **Forbidden words** — "All caught up." → "No active alerts." in AnnouncementList; "Bundle" → "Service package" in Import table header + serviceBundles add-on descriptions; "Quiet morning" softened to "Nothing waiting on you." in ChaseLoopStatus. (c) **CTA color drift** — TaskActions "Mark complete" went slate (`bg-accent`) → indigo (`bg-indigo`); Clients alert-affected row tinting (`bg-warn-bg/30`) replaced with a per-row `<State alert>` warn-tinted pill in the name cell (T4 reaffirmed); Premium tier pill went slate → indigo soft (`bg-indigo-soft`). (d) **Focus rings** — all `ring-1 ring-accent` on inputs/textareas (TaskNotesPanel, EmailBulletinEditModal, ChaseBundleModal, Mail, Clients, ClientDetail, TagPicker) swapped to `ring-2 ring-indigo ring-offset-2` per §Element states. CalendarGrid today-cell ring went slate → indigo. OnboardingFirm selected-state painting switched from `bg-accent` to `bg-ink-900` (filter-is-on archetype, per §Element states). (e) **Custom `<h1>` drift** — Calendar refactored to `<PageHeader>`; Placeholder refactored to `<PageContainer>` + `<PageHeader>`; SettingsFederalFormsPanel section title swapped to `<SectionHeader>`; ClientDetail / TaskHeader / Import / Changes title h1's normalized to the canonical `text-display font-semibold leading-7 tracking-[-0.01em]` token stack (the explicit edge-case carved out in §Don't — when title needs to wrap badge clusters on the same row). (f) **Middle-dot separators** between discrete metrics — Timeline KPI row, ClientDetail engagement meta, TaskHeader assignees row, Calendar stats row, Alerts disposition footer all switched from `<span>·</span>` to `gap-section` whitespace. The valid use (separators inside a single metadata string like `Tax 2025 · Federal · LLC`) is preserved. (g) **Time-of-day** on AnnouncementDetail's "Detected" timestamp dropped — uses `formatLongDate(detectedAt.slice(0, 10))` per the dates-only invariant. (h) **Dialog backdrop** corrected from `backdrop-blur-sm` (4px) to `backdrop-blur-[2px]` (matches §Modals spec); overlay z-index moved from 50 to 40 to match the §z-index ladder (modal content stays at 50). (i) **Apply / Reject** verbs in SettingsFederalFormsPanel got their objects (`Apply change` / `Reject change`) per the verb + object microcopy rule. (j) **Alert-type primary verb taxonomy** — promoted from §Outstanding gap to §Alert-type primary verb taxonomy with the canonical mapping wired into `<CopilotPane>`: `disaster_extension` now reads "Move {N} deadlines to {date}" with CTA `Move {N}`, while non-disaster alerts with a `newDeadline` keep the generic phrasing. **No new routes, no new components.** Verified by booting the dev server and walking Today / Clients / Timeline / Mail / Alerts / Calendar / Opportunities / Settings / Import / ClientDetail / TaskDetail with zero console errors. New active rules in §Don'ts: "Don't paint status colors across a full row or card" + "Don't use the slate `accent` token for next-action CTAs or focus rings."
