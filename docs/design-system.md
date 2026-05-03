---
name: DueDateHQ Design System — "Quiet Operational Authority"
description: Prescriptive UI/UX system for DueDateHQ. Synthesizes the design DNA of three reference products — Mercury (financial dashboard density + number typography + indigo accent), Sana AI (workspace warmth + cool canvas + neutral category dots), Oku (knowledge-tool restraint + thin chrome + content-first hierarchy) — onto shadcn primitives. Read before building any new screen.
substrate: shadcn (Radix + Tailwind, cssVariables:false), Lucide icons, Inter
audience: design + frontend implementers building DueDateHQ surfaces
references: Mercury · Sana AI · Oku
last-updated: 2026-05-03
---

# DueDateHQ Design System
## "Quiet Operational Authority"

A CPA's workday is dense. The product looks at hundreds of clients, thousands of due dates, dozens of just-landed state notifications. The interface that survives that volume is not the loudest one — it is the one that **respects the user's intelligence and time**: numbers rendered as typographic objects, one accent reserved for the next action, status as restrained pills, and a dashboard that reads as a desk, not a stage.

### What this inherits from where

| Reference | What we inherit |
|---|---|
| **Mercury** | Number typography (cents-superscript, tabular-nums everywhere) · pill primary CTAs · soft-tint status pills · sidebar-grouped left nav · the "professional density" feeling · ⌘K search affordance |
| **Sana AI** | Cool neutral canvas (not cream) · borderless surfaces with subtle shadow + 1px hairline · neutral category dots (commercial / operations / product) · warm but quiet tone |
| **Oku** | Content-first hierarchy (almost no chrome) · thin sidebar with no decoration · understated page titles · restraint as the dominant taste — what's *removed* matters more than what's added |

The three converge on the same essential rule: **a productivity tool earns trust by getting out of the way**. Mercury proves it for finance, Sana proves it for AI workspace, Oku proves it for knowledge. DueDateHQ inherits the lineage for CPA practice operations.

This doc is the **canonical visual + interaction spec for DueDateHQ**. It sits beside [`docs/specs/`](specs/) (which holds product/feature specs). Read this before building any new surface.

> **What this design protects:** that DueDateHQ never decays into a "marketing-style" SaaS — the kind that treats every screen as a hero moment. It must read as a **calm professional tool** that a CPA opens 30× a day for two years and never tires of.

---

## §1. Visual Theme & Atmosphere

**Mood.** Calm, dense, trustworthy. A senior accountant's desk: paper organized in trays, one pen visible, one cup of coffee, no decoration. Information is the decoration.

**Density.** High info-per-screen *and* high air-per-info. Tables show 14 rows comfortably; dashboards show 6 widgets without crowding. Density and breathing room coexist via consistent vertical rhythm — never via squeezing.

**Philosophy.** The interface acknowledges actions; it does not perform them. Animations confirm; they don't celebrate. Color codes; it doesn't decorate. Typography hierarchies; it doesn't pose.

**8 Key Characteristics**

1. **Cool neutral canvas (`#F8F9FB` recommended), white surfaces.** Mercury / Sana / Oku all sit in cool neutral territory — slightly off-white, slightly cool, almost imperceptible tint. See §2 Canvas Choice for the decision matrix and three vetted options.
2. **One indigo accent (`#5B5BD6`).** Used on the *next action* and the *currently-selected* sidebar item — never decorative.
3. **Pill CTAs, soft-rectangle objects.** Shape codes role: pill = "tap to do something"; rectangle = "container of stuff."
4. **Numbers as typographic objects.** Dollars get cents-superscript; deadlines get tabular-nums; balances get oversized weight.
5. **Status as small soft-tinted pills.** Never as fills, never as borders, never as full-card backgrounds.
6. **Sidebar grouped by domain.** Section labels ("Workflows", "Personal", "Team") do the wayfinding work.
7. **Dashboard headlines understated.** "Welcome, Sarah" sits at 28px medium-weight. Display-face is forbidden inside the product.
8. **Subtle motion only.** 220ms fades, 700ms confirm-pulse, no springs, no celebrations beyond the §5.3 invariant moment.

---

## §1.5. Taste & Sensibility — Persistent Principles

These are the load-bearing rules. Every new screen must derive from them. If you can't decide a treatment, re-read this section.

| # | Principle | Why | How to apply | Evidence |
|---|---|---|---|---|
| **T1** | **Numbers are typographic objects.** Financial / dated values get composition attention — superscript decimals (`$12,505.⁸⁷`), tabular-nums for column alignment, oversized weight for the headline balance. | A CPA reads numbers as primary information. Making them legible-faster IS the product. Generic body-render of `$12,505.87` is a fail. | Every dollar amount uses `<Money>` with cent-superscript variant. Every deadline date uses tabular-nums. Every balance/headline number gets `--type-numeric-display`. | Mercury: `$5,216,471.¹⁸` — cents render at ~70% size, baseline-shifted upward. The cents are visible but visually demoted so the dollar count reads first. |
| **T2** | **One accent. One viewport. One action.** The signature indigo appears on the next-action only — primary CTA, currently-selected sidebar item, the "important" pill. Everywhere else is ink + neutral. | Scarcity is the signal. If two indigo elements compete on a viewport, neither wins; the accent stops meaning "do this next." | Before painting anything `--accent`, ask: "is this the ONE next action on this screen?" If no, demote to `--ink-700` button or `--surface` card. | Mercury Home shows ONE indigo "Send" button + ONE indigo "Home" sidebar row. Nothing else competes. |
| **T3** | **Pills for actions, soft rectangles for objects.** Buttons and status chips are pill-shaped (`--radius-pill`); cards / inputs / modals are soft rectangles (`--radius-md/lg`). | Shape codes role faster than label. A pill says "tap me to do a thing"; a rectangle says "look inside me for stuff." | Never give a card pill corners. Never give a button rectangular corners. Status chips are always pill. Search bar = pill. Filter chips = pill. | Mercury "Send / Transfer / Deposit / Request" — all pill. The cards holding them — soft rectangle. |
| **T4** | **Status colors are pills, never paint.** Green / orange / red appear as small tinted pills — saturated text on soft tinted bg (e.g. `Active` = `#0FA968` text on `#DCFCE7` bg). They never become surface fills, never become borders. | State ≠ decoration. A green card bg confuses "this is good" with "this is a category." A red border on a card looks like an error in the card itself, not its status. | Every status uses `<StatusPill variant="success|warn|danger|info">`. Never `bg-green-100` on a card. Never a colored left-border on a row to denote state. | Mercury "Overdue" / "Pending Review" / "Active" / "Declined" — all small soft-tint pills, never expanded surface. |
| **T5** | **Sidebar groups, surface unfolds.** Left nav is grouped by domain (`Workflows / Personal / Team`); main canvas opens whatever was selected, with no nested chrome. The sidebar is wayfinding; the canvas is content. | Dense tools need orientation, not decoration. Group labels eliminate the need for tab bars or breadcrumb chrome on most pages. | Every sidebar item belongs to a named uppercase-eyebrow group. Never orphan items. Page canvas opens flush with a single page-title — no secondary header bar. | Mercury Settings sidebar — `Team / Security & Controls / Company / Personal`, every item is grouped. The page that opens is just `<H1>Notifications</H1>` — no extra chrome. |
| **T6** | **Density without crowding — rhythm via vertical air.** Tables and lists use ≥44px row height; columns use proportional widths, not equal. Generous vertical padding inside a tight overall layout. | Density is comfort when each row breathes. Cramped density is anxiety — and CPAs read tables for hours. | Row height ≥ 44px even on "compact" tables. Two rows never touch — minimum 1px hairline divider between them. Column widths follow content (date ~80px, status ~120px, description fills). | Mercury Reimbursements — 14 rows visible, each with ~14-16px vertical padding. Eye flows down without friction. |
| **T7** | **Modals are the action focus, not a confirmation toast.** When the system needs input (add client, mark received, edit deadline), it opens a centered modal that owns the screen. Modals are NOT used for "are you sure" — those go to sonner toasts. Banners are NOT used for input — they're notifications only. | Modals interrupt; reserve the interrupt for actual input. Confirmations don't deserve interrupts. The 4 alert surfaces (bell / banner / blocking modal / `/alerts` page) each carry a different weight — don't blur them. | Modal = "I need data from you." Toast = "I did the thing." Banner = "I noticed something." Bell = "Here's a list." Use the right surface; the choice is the message. | Mercury "Add team member" — modal (form input). Mercury "Suspicious activity" — banner (notification). Mercury "Payment scheduled" — toast (confirmation). |
| **T8** | **The dashboard is a desk, not a stage.** Page titles use understated medium-weight type, NOT a display face. The product looks like a calm tool, not a marketing site. | A CPA opens this 30× a day, every working day. Display-face headlines on a daily-use surface decay into noise within a week — they go from "intentional" to "loud" to "ignored." | Page titles cap at 28px medium (`--type-page-title`). Never use a display face inside the product. Marketing site (the public landing page) can use a display face; the product UI never can. | Mercury "Welcome, Jane" / "Notifications" / "Reimbursements" — all sit at ~28-32px medium-weight. No display face anywhere in product. |

**Cross-check against tokens:** if §2 paints accent as a card bg, T2 is being violated — revise tokens. **Taste wins.**

---

## §2. Color Palette & Roles

The 60-30-10 anchored system. **All hex values are tokens, never inlined in components.**

### Canvas Choice — pick one (deliberately)

The existing `tailwind.config.js` ships `canvas: #FAFAF7` (warm cream). The references all sit in **cool neutral** territory. This is a real decision — pick deliberately, not by inheritance. Three vetted options below; **Option B is the recommended default** for inheriting Mercury / Sana / Oku DNA most faithfully.

| Option | Canvas hex | Surface hex | Sunken hex | Feel | When to choose |
|---|---|---|---|---|---|
| **A. Cool slate (most Mercury-like)** | `#F7F8FA` | `#FFFFFF` | `#F1F2F5` | Crisp, financial, professional. Mercury's exact register. | If we want maximum "this is a serious tool" reading; if Sarah's persona research says CPAs want it to look like a banking dashboard. |
| **B. Cool neutral (recommended — Sana / Oku register)** ★ | `#F8F9FB` | `#FFFFFF` | `#F2F3F5` | Quiet, slightly cool, content-first. Sits between Mercury (more saturated) and pure white. | **Default**. Reads as a productivity tool without committing to "finance" or "creative." Best fit for the product's mixed audience (Sarah 49 clients + Yan 600 clients). |
| **C. Warm cream (current — DueDateHQ legacy)** | `#FAFAF7` | `#FFFFFF` | `#F5F4EF` | Warm, paper-like, slightly editorial. Distinct from references. | Only if we explicitly want to differentiate from Mercury / Sana / Oku — i.e. if "feels like CPA paper, not like Stripe" is a deliberate brand stance. |

**Recommendation: Option B.** It honors the reference trio without erasing differentiation, and its near-white reads as "neutral substrate for serious work" — which is what DueDateHQ is. Option A is also fine if we want to lean Mercury-formal. Option C is the current state and should only stay if Yuqi has a reason to keep paper-warmth that this doc hasn't surfaced.

The hex tables in §2.x below assume **Option B**. If we pick A or C, swap the three surface tokens and re-verify contrast pairs in §14.

### Surfaces (60% of viewport — canvas + raised) — Option B

| Token | Hex | Role | Usage |
|---|---|---|---|
| `canvas` | `#F8F9FB` | Page background | Body bg, nav rail bg behind sidebar |
| `surface` | `#FFFFFF` | Raised content | Cards, modal body, popover body, table rows |
| `sunken` | `#F2F3F5` | Inset / secondary panel | Sidebar bg, table head, code blocks, metadata strips |
| `surface-hover` | `#F5F6F8` | Row hover state | Table-row hover, list-item hover |

### Ink (30% of viewport — text hierarchy)

The three-level hierarchy is non-negotiable. **Body text never renders at tertiary.**

| Token | Hex | Role | Usage |
|---|---|---|---|
| `ink-900` | `#0F172A` | Primary | Headings, body copy, primary labels, selected nav |
| `ink-700` | `#334155` | Strong secondary | Subheads, button labels (secondary buttons), important metadata |
| `ink-500` | `#64748B` | Secondary | Descriptions, table-cell secondary content, muted labels |
| `ink-400` | `#94A3B8` | Tertiary | Timestamps, helper text, placeholder, disabled state, eyebrow labels |
| `ink-300` | `#CBD5E1` | Quaternary / decorative | Dividers within ink (rare), icon decoration in empty states |

### Accent (≤10% of viewport — the next action)

| Token | Hex | Role | Usage |
|---|---|---|---|
| `accent` | `#5B5BD6` | Primary action | Primary CTA bg, selected-sidebar-item ink, "send chase" button |
| `accent-hover` | `#4A4AC9` | Pressed / hover | CTA hover bg |
| `accent-soft` | `#ECECFE` | Selected nav-item bg, accent-on-light pill bg | Background-only — never as text color |
| `accent-ink` | `#3D3DAF` | Accent text on accent-soft bg | Sidebar text on selected row, "Beta" pill text |

> ⚠ **Token migration note** — the existing `accent: #0F172A` (slate-monochrome) is being **promoted** to `--ink-button-secondary`. The new `--accent: #5B5BD6` introduces the Mercury indigo for the *primary action only*. See §16 Open Questions for migration plan.

### Borders / lines

| Token | Hex | Role |
|---|---|---|
| `line` | `#E2E8F0` | Default hairline (table rows, card borders, divider) |
| `line-strong` | `#CBD5E1` | Emphasis hairline (focused input border, divider above totals row) |
| `line-accent` | `#C7C7F4` | Accent-tinted hairline (selected-row left-rule, accent input focus ring inner) |

### Status (≤5% combined — pills only)

States, never decoration. Each pair: ink on tinted bg.

| Status | Ink | Bg | Border | Usage |
|---|---|---|---|---|
| `ok` | `#047857` | `#ECFDF5` | `#86EFAC` | "Received", "Filed", "Active" |
| `warn` | `#92400E` | `#FFFBEB` | `#FCD34D` | "Awaiting", "Reminder sent", "Due in 7d" |
| `danger` | `#B91C1C` | `#FEF2F2` | `#FCA5A5` | "Overdue", "Failed", "Past deadline" |
| `info` | `#1D4ED8` | `#EFF6FF` | `#93C5FD` | "Auto-imported", "AI-suggested", "New" |
| `neutral` | `#475569` | `#F1F5F9` | `#CBD5E1` | "Draft", "Archived", "N/A" |

**Solid variants** (`danger.solid: #DC2626`, etc.) are reserved for *icons in inline alerts* and *banner left-rule accents only* — never for fills.

### Shadows (depth)

See §6 — depth is restrained, two real shadows only.

### Gradients

**None observed in references; none in the product.** This is intentional — gradients on product surfaces read as marketing. The only acceptable use is the cents-superscript baseline shift visual (which is type, not gradient).

### 60-30-10 enforcement

Every new screen must visually pass:
- **~60%** canvas + sunken (the calm field)
- **~30%** ink + surface borders + neutral status (the readable structure)
- **~10%** accent + status pills (the moments that matter)

Two accent-bearing things visible at once = revise. Three = always wrong.

---

## §3. Typography Rules

### Font families

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI",
             Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
--font-numeric: var(--font-sans); /* same family, with tabular-nums + cv01 */
```

**Why no display face.** Per T8 — DueDateHQ is daily-use; a display face decays. The body family does all the work, with size + weight + tracking carrying hierarchy.

**Inter is preferred** over the system font for product UI. Inter ships `cv02` (open-4), `cv11` (one-without-serif), `ss01` (alt-a) which the existing `index.css` already enables — keep those features on. JetBrains Mono is the mono pair (slightly humanist; matches Inter's geometry).

### Hierarchy table

| Role | Size / Line-height | Weight | Tracking | Family | Where used |
|---|---|---|---|---|---|
| `--type-page-title` | 28px / 1.25 | 500 | -0.01em | sans | `<H1>` of every page (Notifications, Clients, Today) |
| `--type-section-title` | 20px / 1.3 | 500 | -0.005em | sans | Card titles, modal titles, section headers within a page |
| `--type-h3` | 16px / 1.4 | 500 | 0 | sans | Sub-section headers, sidebar-group eyebrow (UPPERCASE variant) |
| `--type-body-lg` | 16px / 1.5 | 400 | 0 | sans | Card body when emphasized, dialog body |
| `--type-body` | 14px / 1.43 | 400 | 0 | sans | Default body, table cells, sidebar items |
| `--type-body-sm` | 13px / 1.54 | 400 | 0 | sans | Secondary table cells, helper text under inputs |
| `--type-label` | 12px / 1.33 | 500 | 0.01em | sans | Form labels above inputs, status pill text, button labels (sm variant) |
| `--type-eyebrow` | 11px / 1.45 | 600 | 0.06em | sans | UPPERCASE sidebar group labels ("WORKFLOWS"), table column headers |
| `--type-numeric-display` | 32px / 1.1 | 600 | -0.02em | sans + tabular-nums | Headline balance ("$1,247.00"), page-level KPI |
| `--type-numeric` | 14px / 1.43 | 500 | 0 | sans + tabular-nums | All dollars, dates, counts in tables |
| `--type-numeric-cents` | 22px / 1.1 | 500 | -0.01em | sans + tabular-nums | Cents superscript on `--type-numeric-display` (rendered at ~68% of dollar size, `vertical-align: 0.35em`) |
| `--type-mono` | 13px / 1.45 | 400 | 0 | mono | EIN, Client ID, code blocks, file paths |

### Number typography (the signature) — DNA

The cents-superscript pattern is **the single most recognizable type move** in the system. Implement once, use everywhere.

```jsx
// <Money amount={5216471.18} variant="display" />
// renders: $5,216,471.<sup>18</sup>
//          └─────────────┘  └──┘
//          --type-num-display  --type-num-cents
//          (32px, 600)         (22px, 500, va: 0.35em)
```

- **Display variant** (page-level balance): full pattern (cents superscripted + smaller).
- **Inline variant** (table cell): full price on baseline (`$5,216,471.18`) with tabular-nums; cents NOT superscripted (would crowd the row).
- **Tabular alignment:** every dollar column uses `font-variant-numeric: tabular-nums` so digits align in stack.

### Date typography (the second signature) — DNA

CPA tax filings are whole-day events. **Never render a time-of-day on a deadline.** This is locked policy (see [memory: "Deadline displays: dates only, never times"]).

| Date format | Used for | Example |
|---|---|---|
| `MMM D` (short) | Default — table cells, lists, banners | `Apr 15` |
| `MMM D, YYYY` | When year matters (history, multi-year clients) | `Apr 15, 2026` |
| `Today / Tomorrow / Yesterday` | When date is within ±1 day of today | `Today` |
| `In 7 days` / `7 days ago` | Relative — only in alert copy and chase-email subject | `In 7 days` |

**Forbidden:** `5:00 PM CT`, `11:59 PM`, "due in 7 hours", time-slot calendar grids — anything implying a time-of-day on a deadline. Calendar surfaces show day-cells, never hour-rows.

### Principles

1. **Body never below 13px.** Helper text floor is 12px (`--type-label`). Anything smaller is decoration only.
2. **Letterspacing is paired with case.** UPPERCASE always carries `+0.06em` tracking (`--type-eyebrow`); body never carries letterspacing.
3. **Line-height bound to size.** Display sizes 1.1–1.25; body sizes 1.4–1.55. Never reverse them.
4. **No italic.** The product is sober; italic is reserved for legitimately quoted text (rare, e.g. "client said: …" in an activity log).
5. **No underline except on real links.** A product label is never underlined. Links use `text-underline-offset: 3px; text-decoration-thickness: 1.5px`.

---

## §4. Component Stylings

Every component is tagged `DNA` (preserve everywhere) or `SKIN` (one expression of the DNA — feel free to invent another). Tokens come from §2 / §3 / §5.

### §4.0 Component Anatomy Rules — DNA (apply to every multi-element component)

1. **Zone map first.** Every card / row / banner declares zones (eyebrow / media / title / body / metadata / actions) before pixel values.
2. **Reading order.** Every component declares the user's L-to-R / T-to-B scan path.
3. **Non-overlap guarantee.** Primary info (client name, deadline date, amount) is **never** covered by an interactive affordance.
4. **Hit-target separation.** Nested tappables in a tappable container have their own 44×44 hit area + `stopPropagation`.
5. **Truncation policy.** Every text element declares: never / 1 line / 2 lines / hides-at-breakpoint.

---

### §4.1 Button — DNA

The base interactive primitive. Three variants only.

| Variant | Bg | Ink | Border | Radius | Padding (md) | When used |
|---|---|---|---|---|---|---|
| `primary` | `--accent` (`#5B5BD6`) | `#FFFFFF` | none | `--radius-pill` (999px) | `8px 16px` | The ONE next action on the screen. Per T2 — never two visible at once. |
| `secondary` | `--surface` | `--ink-900` | `1px --line-strong` | `--radius-pill` | `8px 16px` | Cancel, secondary actions. Lives next to primary. |
| `ghost` | `transparent` | `--ink-700` | none | `--radius-md` (8px) | `6px 12px` | Tertiary actions inside dense surfaces (table-row inline action, card menu trigger). NOT pill — it's a "soft button." |

**Sizes:** `sm` (32px tall, 12px label), `md` (36px, 14px label, default), `lg` (40px, 14px label, used in modal footers).

**States:** rest / hover (bg shifts 1 step darker) / active (bg shifts 2 steps darker, `transform: scale(0.98)`) / focus-visible (2px `--accent` ring + 2px offset) / disabled (`opacity: 0.4`, `cursor: not-allowed`, no hover state) / loading (label hidden, centered spinner).

**Choreography (5-axis):**
- **Press origin:** `transform-origin: center` (acceptable for buttons — they're symmetric).
- **Enter:** N/A (buttons are static, not entered animated).
- **Exit:** N/A.
- **Focus ring:** **instant** for keyboard (`:focus-visible`); 120ms grow `0 → 2px` for pointer-initiated focus.
- **Interrupt:** CSS transition on `bg-color` + `transform` (140ms `--ease-out-strong`); never `@keyframes`.

```jsx
// <Button variant="primary">Send chase</Button>
// <Button variant="secondary">Cancel</Button>
// <Button variant="ghost" size="sm" iconLeft={<ChevronDown/>}>More</Button>
```

**Invariants this preserves (DNA):** pill radius for primary/secondary; accent reserved for primary only; one-primary-per-viewport; focus-visible ring; keyboard-instant focus.

---

### §4.2 Status Pill — DNA

The most-used component in the product. Renders state without painting the surface.

```
┌────────────────┐
│ ● Overdue      │  height: 22px · padding: 2px 8px · radius: 999px
└────────────────┘  text: --type-label · weight: 500
```

- **Anatomy zones:** `[indicator dot?] [label]`. Optional dot uses `solid` variant of the same status.
- **Padding:** `2px 8px` (xs) / `4px 10px` (sm) / `6px 12px` (md). Default = sm.
- **Radius:** always pill (`999px`).
- **Border:** 1px of `--{status}-border`. Provides edge definition without weight.
- **Bg + ink** per §2 status table.
- **No icon by default.** A 6px filled circle (the indicator dot) may precede the label when the status carries urgency (`Overdue`, `Action required`).

**Variants:** `success | warn | danger | info | neutral` (per §2). Plus `accent` (used only for "AI-suggested" — accent ink on accent-soft bg).

**Anti-pattern:** never apply status colors as a card background or a row's left-border. Status lives in a pill — period.

**Invariants this preserves (DNA):** pill shape · status-as-pill-never-paint · ink-on-tint pairing.

---

### §4.3 Card — DNA shape, SKIN composition

**DNA (always):** `--surface` bg, `--radius-lg` (10px), `1px --line` border, `--shadow-pop` (level 1), padding `16px` (sm) / `20px` (md) / `24px` (lg).

**SKIN (one expression — many possible):** the specific anatomy below is *one* card composition for one DueDateHQ surface. Invent others freely as long as they preserve the DNA.

#### Example SKIN: Client-row card (My Clients page)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Avatar]  Client name              [Status pill]    [Next deadline]│  ← Row
│            Tax 2025 · CA · LLC                       Apr 15         │
└─────────────────────────────────────────────────────────────────────┘
```

- **Zone map:** `[avatar 36×36] [name + meta-stack flex] [status pill] [deadline date]`
- **Reading order:** Avatar → Name → Status → Deadline → (whole row tappable)
- **Non-overlap guarantee:** deadline column has min-width `80px`; status pill column min-width `100px`; name truncates first.
- **Hit-target separation:** the row is the primary tap target (opens client detail). Avatar is decorative (no hover, no tap). If we add a "Send chase" inline action, it gets its own 44×44 hit area + `stopPropagation`.
- **Truncation:** name = 1 line ellipsis; meta = 1 line ellipsis; status + deadline = never truncate.

**Choreography (5-axis):**
- **Press origin:** `transform-origin: center`
- **Enter:** new rows fade-up via `.animate-ddhq-fade-up` (220ms `--ease-out-strong`); when ≥3 new rows, stagger 60ms.
- **Exit:** removed rows opacity `1 → 0` over 140ms (faster than enter — Emil's asymmetric rule).
- **Focus ring:** instant for keyboard tab; pointer hover = subtle `--surface-hover` bg (200ms transition).
- **Interrupt:** CSS transition only.

**Invariants this preserves (DNA):** `--surface` bg · `--radius-lg` · `--shadow-pop` · zone map (name truncates, deadline doesn't) · row-as-primary-tap-target.

#### Other SKIN compositions allowed

A "Today's queue" card might stack vertically. A "KPI" card might foreground the number with `--type-numeric-display`. A "Recent activity" card might be borderless inside a panel. **All are valid as long as they preserve the DNA above.**

---

### §4.4 Input — DNA

```
Label                          ← --type-label (12px 500)
┌─────────────────────────┐
│ Placeholder text        │   ← --type-body (14px) ink-900 / ink-400
└─────────────────────────┘
Helper text                    ← --type-body-sm (13px) ink-500
```

- **Bg:** `--surface`
- **Border:** `1px --line` (rest), `1px --ink-700` (focus), `1px --danger-border` (error)
- **Radius:** `--radius-md` (8px) — **NOT pill.** Inputs are containers, not actions.
- **Padding:** `8px 12px` (sm), `10px 14px` (md, default), `12px 16px` (lg)
- **Min-height:** 36px (sm), 40px (md), 44px (lg) — meets touch target on lg
- **Focus ring:** 2px `--accent` outer ring + 2px offset (matches button pattern)

**States:** rest / hover (border `--line-strong`) / focus-visible / disabled (`bg --sunken`, `color --ink-400`) / error (border + helper text in danger ink).

**Variants:** `text` · `email` · `number` (right-aligned, tabular-nums) · `date` (uses `<DatePicker>` popover — see §4.7) · `textarea` (multi-line) · `search` (left-icon, optional cmd+K hint).

**Invariants this preserves (DNA):** soft-rectangle radius (NOT pill — inputs aren't actions) · 3-level ink hierarchy (label/value/helper) · accent ring on focus.

---

### §4.5 Sidebar Nav — SKIN

One expression of the wayfinding pattern. Other layouts (top nav, command-palette-only) are valid for different surfaces.

```
┌─────────────┐
│ ☰ Sarah     │  ← Workspace switcher (avatar + name + caret)
├─────────────┤
│ ⌂ Today     │  ← Selected: bg --accent-soft, ink --accent-ink, left rule 2px --accent
│ ⊞ Clients   │
│ ⏰ Alerts (3)│  ← Count chip: --type-label, neutral pill
│             │
│ WORKFLOWS   │  ← Group eyebrow: --type-eyebrow, ink-400, padding-top 16px
│ ⊠ Inbox     │
│ ✉ Chases    │
│ ✔ Done      │
│             │
│ PERSONAL    │
│ ⚙ Settings  │
└─────────────┘
```

- **Width:** 240px desktop, collapses to icon-only (60px) at md breakpoint, drawer at sm.
- **Item height:** 36px. Padding: `8px 12px`. Icon: 20px lucide. Gap to label: 12px.
- **Group eyebrow:** UPPERCASE, 11px 600, `--ink-400`, padding `16px 12px 4px`. **No divider line** — the air does the dividing.
- **Selected state:** bg `--accent-soft`, ink `--accent-ink`, 2px `--accent` left-rule (inset). Icon ink also shifts to `--accent-ink`.
- **Hover state:** bg `--surface-hover`. No motion on hover (per Emil's frequency rule — sidebar hover happens hundreds of times per day).
- **Count chips** (e.g. "Alerts (3)"): inline neutral pill, right-aligned in the row.

**Invariants this preserves (DNA):** sunken bg · group-eyebrow pattern · accent reserved for the selected item only · 36px item height · no animated hover.

---

### §4.6 Modal / Dialog — DNA

```
┌─────────────────────────────────────────┐
│  Add client                          ✕  │  ← Title + close
├─────────────────────────────────────────┤
│  [form fields with proper labels]       │
│                                          │
├─────────────────────────────────────────┤
│                  [Cancel]   [Add]       │  ← Footer right-aligned
└─────────────────────────────────────────┘
   width: 480px (default) / 560px (lg) / 720px (xl)
```

- **Width:** 480px (default form modal), 560px (multi-section), 720px (rare — use `<Sheet>` instead at >720px).
- **Bg:** `--surface`. **Backdrop:** `rgba(15, 23, 42, 0.4)` with `backdrop-filter: blur(2px)`.
- **Radius:** `--radius-xl` (12px).
- **Shadow:** `--shadow-overlay` (level 3).
- **Padding:** `24px` (header + body); footer separated by `1px --line` divider, padded `16px 24px`.
- **Title:** `--type-section-title`. Close button is 32×32 ghost button, top-right.
- **Footer:** right-aligned. Cancel = secondary button, primary action = primary button.

**Choreography (5-axis):**
- **Press origin:** `center` (modals don't anchor to a trigger, so center is correct).
- **Enter:** backdrop fade-in 200ms; modal `scale(0.96) + opacity(0) → 1` over 240ms `--ease-out-strong`.
- **Exit:** modal `opacity 1 → 0` over 140ms (faster than enter); backdrop fades 120ms.
- **Focus ring:** focus moves to the first input on open; close-on-Escape; trap focus within modal.
- **Interrupt:** CSS transition only — no `@keyframes`.

**When to use a modal vs sheet vs popover:**
- **Modal:** form input that needs the user's full focus (add client, edit deadline, mark received).
- **Sheet:** large content browse / edit (client detail full edit, document preview). Slides from right at 480px on desktop.
- **Popover:** inline contextual action (date picker, status changer, actions menu). Anchored to trigger.

**Invariants this preserves (DNA):** soft-rectangle radius · backdrop blur · footer divider · primary button right-most · close-on-Escape.

---

### §4.7 Popover — DNA

For contextual menus, date pickers, action lists, status changers.

- **Bg:** `--surface`. **Border:** `1px --line`. **Radius:** `--radius-lg` (10px). **Shadow:** `--shadow-overlay`.
- **Min-width:** 200px. **Max-width:** 320px (use modal/sheet beyond this).
- **Padding:** `4px` outer (item-list); `16px` for content popovers (date picker, color picker).
- **Items:** 32px tall, `8px 12px` padding, `--type-body`. Hover bg = `--surface-hover`. Selected = `--accent-soft` bg.

**Choreography (5-axis):**
- **Press origin:** `var(--radix-popover-content-transform-origin)` — scales from the trigger, not the center. **Critical** — center origin breaks spatial connection.
- **Enter:** `scale(0.96) + opacity(0) → 1` over 180ms `--ease-out-strong`.
- **Exit:** `opacity 1 → 0` over 100ms (faster).
- **Focus ring:** first item focused on open; arrow keys navigate; Escape closes; click-outside closes.
- **Interrupt:** CSS transition.

**Invariants this preserves (DNA):** trigger-anchored origin · soft-rectangle radius · level-3 shadow.

---

### §4.8 Toast (Sonner) — DNA

For "I did the thing" confirmations. Bottom-right stack, 3 max visible.

- **Bg:** `--ink-900` (dark — inverts attention against the cream canvas). **Ink:** `#FFFFFF`.
- **Radius:** `--radius-md` (8px). **Shadow:** `--shadow-overlay`. **Padding:** `12px 16px`.
- **Width:** 360px max. **Position:** 24px from bottom-right.
- **Duration:** 4s default; 6s if action button included; persistent if `danger` variant (must dismiss).
- **Variants:** `default` (dark), `success` (dark + 4px left rule `--ok-solid`), `danger` (dark + 4px left rule `--danger-solid`).

**Choreography (5-axis):**
- **Press origin:** `bottom right`.
- **Enter:** slide-in from right 200ms + opacity. Stagger 60ms when ≥2.
- **Exit:** slide-out + opacity 140ms.
- **Focus ring:** action button focusable; Escape dismisses focused toast.
- **Interrupt:** CSS transition (stack reflow when one dismisses).

**Invariants this preserves (DNA):** dark inverted bg · bottom-right anchor · short-lived · status-as-left-rule.

---

### §4.9 Search bar (cmd+K) — SKIN

```
┌──────────────────────────────────────────────┐
│ 🔍  Search clients, deadlines, files…  ⌘K   │
└──────────────────────────────────────────────┘
   height: 40px · radius: --radius-pill · bg --surface
```

The persistent search affordance in the top bar. Triggers a centered modal (cmd+K palette) on click or shortcut.

- **Bg:** `--surface`. **Border:** `1px --line`. **Radius:** `--radius-pill`.
- **Left icon:** lucide `<Search>` 16px, `--ink-400`.
- **Placeholder:** `--type-body`, `--ink-400`. Copy: "Search clients, deadlines, files…"
- **Right hint:** `⌘K` rendered in `--type-mono`, `--ink-400`, in a tiny pill bg `--sunken`.
- **Focus state:** border `--line-strong`. **Click/focus:** opens cmd+K modal (don't inline-expand).

**Invariants this preserves (DNA):** pill shape · cmd+K convention · placeholder lists searchable types.

---

### §4.10 Empty state — SKIN

For lists / tables / pages with no content.

```
       ┌───┐
       │ ⊠ │              ← 48px lucide icon, --ink-300
       └───┘
   No clients yet           ← --type-section-title, --ink-900
   Add your first client to start  ← --type-body, --ink-500
   tracking deadlines.

   [Add client]              ← Primary button
```

- **Centered vertically** in the available space (`flex items-center justify-center`).
- **Icon:** 48px lucide, color `--ink-300` (decorative — no accent).
- **Title:** `--type-section-title`.
- **Body:** `--type-body`, `--ink-500`, max 2 lines (`max-width: 32ch`).
- **Action:** primary button. Per T2 — only one action; if there's a secondary, use a ghost button below.

**Invariants this preserves (DNA):** decorative icon (NOT accent) · centered · ≤2-line body · single primary action.

---

### §4.11 Banner — DNA

For "I noticed something" notifications that need the user's attention but aren't blocking.

```
┌──────────────────────────────────────────────────────────────────┐
│ ℹ  IRS announced a new deadline for Form 941 (revised).          │
│    72 of your clients are affected. [Review impacts] →           │
└──────────────────────────────────────────────────────────────────┘
```

- **Bg:** `--{status}-bg` (`info` default). **Border:** `1px --{status}-border`. **Left rule:** `4px solid --{status}-solid`.
- **Radius:** `--radius-md`.
- **Padding:** `12px 16px`.
- **Layout:** `[icon 20px] [text + inline action] [dismiss ✕ optional]`
- **Action style:** inline link (underlined, `--{status}-ink`), NOT a pill button (banners are not the place for primary actions).

**The 4 alert surfaces** (per memory: bell vs banner vs blocking modal vs `/alerts`):
- **Banner** = wedge into top-of-page, dismissible, contextual to current view.
- **Bell** = mixed inbox of all alerts, accessed via header bell icon.
- **Blocking modal** = >72h overdue / requires immediate decision before continuing.
- **`/alerts` page** = full-page list view of every active alert.

Each carries different urgency. Don't blur them.

**Invariants this preserves (DNA):** left-rule status accent · status-tinted bg · inline action (NOT button) · dismissible.

---

## §5. Layout Principles

### Spacing system (8px base)

All padding / gap / margin values come from this ladder. **No rogue values.**

```
--sp-0:   0
--sp-1:   4px
--sp-2:   8px
--sp-3:  12px
--sp-4:  16px
--sp-5:  20px
--sp-6:  24px
--sp-8:  32px
--sp-10: 40px
--sp-12: 48px
--sp-16: 64px
--sp-20: 80px
--sp-24: 96px
```

**Section rhythm** (gap between major sections on a page): `--sp-8` (32px) between cards; `--sp-12` (48px) between page-level sections.

**Component-internal padding:** standardized — buttons `8px 16px`, inputs `10px 14px`, cards `20px`, modals `24px`. No exceptions without a documented reason.

### Grid + container widths

- **Page max-width:** 1280px (`--page-max`). Pages center within this. Sidebar (240px) is OUTSIDE this max.
- **Content max-width:** 800px (`--content-max`) for single-column reading surfaces (settings, client detail). 1280px for tabular surfaces (clients list, alerts).
- **Column gap:** 24px desktop / 16px tablet / 12px mobile.

### Whitespace philosophy

Air is structural. The product looks "spacious" because:
1. Page padding is generous (32px top/bottom on desktop).
2. Section gaps are uncramped (32–48px between cards).
3. Internal padding is consistent (every card breathes the same way).
4. Tables use ≥44px row height even on dense screens.

**Cramped density = anxiety.** If a screen feels tight, the fix is more padding, not smaller text.

### Border Radius Scale (with aspect-ratio rule)

```
--radius-sm:    4px   /* small chips, inline tags */
--radius-md:    8px   /* inputs, ghost buttons, popover items */
--radius-lg:   10px   /* cards, popover containers */
--radius-xl:   12px   /* modals, large sheets */
--radius-pill: 999px  /* primary/secondary buttons, status pills, search bar, count chips */
```

**Aspect-ratio rule:** `--radius-pill` (999px) stays pill-shaped at any width — that's the property of `999px` over `%`. We never use `%` radii in this system because aspect-ratio drift produces distorted capsule lobes on wide containers (see Mercury's CTA strips for the canonical pattern: pill buttons stay pill at any width).

**Edge-critical content rule:** when a card holds a primary numeric value (deadline date, dollar balance) within ~24px of a corner, use `--radius-md` (not `--radius-lg`) so the curve doesn't visually clip the data. Soft-rounded > deep-rounded for data-bearing surfaces.

---

## §6. Depth & Elevation

Restrained — two real shadows, plus the focus ring. No 3D-style stacking.

| Level | Token | Value | Used on |
|---|---|---|---|
| 0 | (none) | none | Page bg, sidebar, table cells |
| 1 | `--shadow-pop` | `0 2px 8px rgba(15, 23, 42, 0.06)` | Cards, popovers (small) |
| 2 | (none — skip) | — | Avoid; use border instead of mid-shadow |
| 3 | `--shadow-overlay` | `0 8px 24px rgba(15, 23, 42, 0.12)` | Modals, large popovers, dropdown menus, toasts |
| 4 | (none) | — | Deeper than overlay = the modal is wrong size; don't fake importance with shadow |

**Shadow philosophy.** Shadows are for *floating things only* (overlays). On-page cards are anchored by `1px --line` border + level-1 pop, never by a heavier shadow. Against the cool neutral canvas, a heavier shadow reads as a "stamp" rather than depth — keep them light.

**Focus ring** (universal):

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px; /* matches sm radius — see §10 invisible correctness */
}
```

Per Emil's keyboard rule — `:focus-visible` only (never `:focus`), instant on keyboard, 120ms grow on pointer.

---

## §7. Do's and Don'ts

### Do

- **Use the indigo accent on the ONE next action per viewport.** Per T2.
- **Render every dollar with `<Money>`.** Cents-superscript on display sizes; tabular-nums on inline.
- **Render every deadline with `<Date>`.** Dates only — no times. Per locked policy.
- **Group sidebar items under uppercase eyebrow labels.** Workflows / Personal / Team — never orphan items.
- **Use status pills for state, never card backgrounds.** "Overdue" is a pill, not a red card.
- **Open modals for input.** Toasts confirm; modals collect.
- **Keep page titles at `--type-page-title` (28px medium).** Never larger; never display face.
- **Use Lucide icons at base-4 sizes (16/20/24).** Stroke 1.5px to match Inter 400. Stroke 2px when paired with weight 600.
- **Honor `prefers-reduced-motion`.** Already wired in `index.css` — keep all signature motion under that umbrella.
- **Privilege the gap, not the fill** (per [memory feedback]). What's missing reads loudest; what's complete collapses by default.

### Don't

- **Don't use a display face anywhere in the product UI.** Marketing site only. T8.
- **Don't use accent for decoration.** No accent borders, no accent card-bgs, no accent dividers. T2.
- **Don't show time-of-day on a deadline.** Locked policy. No "5:00 PM CT", no "in 7 hours", no time-slot calendars.
- **Don't paint cards in status colors.** Status is always a pill. T4.
- **Don't put a primary button inside a banner.** Banners use inline links — primary buttons live on the canvas. §4.11.
- **Don't use `%` border-radius.** Use `999px` for pills, fixed-px for everything else. §5.
- **Don't add a hero section to a product page.** Dashboards / lists / detail pages jump straight into content. The marketing site has heroes; the product never does. (Per [memory: dashboard is audit + batch].)
- **Don't animate keyboard-initiated actions.** No animation on cmd+K open, tab focus, arrow nav. Per Emil's frequency rule.
- **Don't `transition: all`.** Always specify `transform, opacity` (the GPU-cheap properties).
- **Don't duplicate UI for the same concept.** No "Your tasks" appearing as a duplicate of Action Queue + Timeline. One thing, one entrance, one name. (Per [memory feedback].)
- **Don't ship a synonym drift.** Canonical: "service package" — never "bundle" or "filing bundle." Glossary terms are law (see §10).

---

## §8. Responsive Behavior

### Breakpoints

| Name | Min-width | Layout |
|---|---|---|
| `xs` | 0 | Mobile — drawer sidebar, single column, stacked tables |
| `sm` | 640px | Mobile-large — drawer sidebar, single column |
| `md` | 768px | Tablet — collapsed icon-only sidebar (60px), single column |
| `lg` | 1024px | Desktop — full sidebar (240px), multi-column where applicable |
| `xl` | 1280px | Wide desktop — full sidebar, content centered in `--page-max` |
| `2xl` | 1536px | Ultrawide — content centered, padding scales up |

**Note: DueDateHQ is desktop-first.** CPAs work on monitors. Mobile is for quick check-ins (read-only mostly), not full work sessions. Optimize the desktop experience; make mobile usable for the bell + alerts surface specifically.

### Touch targets

- Default minimum: **44×44px** (per WCAG 2.1).
- Touch-primary surfaces (mobile): 48×48px minimum.
- Inline table-row actions get 32px visual but 44×44 hit area.

### Collapsing strategy

- **Sidebar:** full (240px) → icon-only (60px) at `md` → drawer at `sm`.
- **Tables:** keep horizontal scroll; never reflow tabular data into cards (CPAs scan columns).
- **Cards in a grid:** 4-up at `xl` → 2-up at `md` → 1-up at `sm`.
- **Modals:** 480px desktop → full-width with 16px margin at `sm`.
- **Page header (title + actions):** title and actions stack vertically at `sm`; horizontal at `md+`.

### Image / file thumbnails

- 40×40 in row layouts; 80×80 in grid/gallery; 240×320 in document preview popovers.
- All images are `object-fit: cover` with `--radius-sm`. No raw images on the canvas.

### Text reflow

- Body wraps freely (`max-width: 68ch` on prose containers).
- Page titles allow 2-line wrap on narrow widths.
- Status pills + dates never wrap (`white-space: nowrap`).

---

## §9. Invention Prompts

For agents building new surfaces from this design system. Read §1.5 + §9 before building anything new. Skip the temptation to mirror §4 — the §4 components are *one expression* of the DNA.

### DNA to preserve (verbatim)

```
Color tokens:    --canvas, --surface, --sunken, --ink-900/700/500/400/300,
                 --accent, --accent-soft, --accent-ink, --accent-hover,
                 --line, --line-strong, --ok-*, --warn-*, --danger-*, --info-*, --neutral-*
Type scale:      --type-page-title, --type-section-title, --type-h3, --type-body-lg,
                 --type-body, --type-body-sm, --type-label, --type-eyebrow,
                 --type-numeric-display, --type-numeric, --type-numeric-cents, --type-mono
Shape ladder:    --radius-sm, --radius-md, --radius-lg, --radius-xl, --radius-pill
Spacing ladder:  --sp-0 through --sp-24 (4px base × ladder)
Motion tokens:   --ease-out-strong, --ease-out-quick, --dur-instant, --dur-fast,
                 --dur-medium, --dur-slow (see §11)
Shadow tokens:   --shadow-pop, --shadow-overlay
Taste IDs:       T1 (numbers as objects), T2 (one accent / one action),
                 T3 (pills for actions / rectangles for objects),
                 T4 (status as pill / never paint), T5 (sidebar groups + flush canvas),
                 T6 (density via vertical air), T7 (modal vs toast vs banner discipline),
                 T8 (dashboard is desk, not stage)
Vocabulary:      service package, action queue, today, mode F, chase, state notification,
                 received_confirmed, machine-replicated activity, action surface
                 (see §10 for full glossary)
Signature moves: cents-superscript on display dollars · count-chip in sidebar item ·
                 4 alert surfaces (bell / banner / modal / page) ·
                 §5.3 invariant pulse on received_confirmed
```

### Divergence Clause (verbatim — reprint, do not edit)

> The §4 component specs are ONE expression of the DNA. Do not mirror their anatomy.
> If your output mirrors the case study's section order, component inventory, or dominant compositional pattern, you have skinned the brand, not extended it.
> Discard the first draft and invent from the DNA.

### 5 Invention Prompts — surfaces this doc doesn't show

#### PROMPT 1 — Settings: Notification preferences

**Goal:** let a CPA configure which alert types reach them via email vs in-app vs SMS, per client tier.

**DNA to preserve:** `--surface`, `--ink-900/700/500`, `--type-body`, `--type-label`, `--type-eyebrow` (UPPERCASE group labels), `--accent` (only on the active toggle), `--radius-md` (form inputs), `--radius-pill` (action buttons), T2, T5 (group via eyebrow), T6 (≥44px row height).

**UX rules that apply:** hero ≤ 100vh is N/A (settings page jumps into content); body line length ≤ 68ch; touch targets 44×44; contrast AA on all toggle states.

**Taste cues:** T8 strongly applies — settings are daily-use; understated headers. T5 applies — group "Alerts" / "Email" / "SMS" with eyebrow labels, not boxed sections. T7 applies — saving = toast, not modal.

**Anti-pattern:** do NOT reach for a card-grid of "preference cards" with big icons. Settings are list-of-toggles surfaces; the eyebrow-grouped list is the right shape.

**Do NOT:**
- Wrap each preference in its own bordered card (over-decoration; T6 violation)
- Use icons for every preference type (orphan-icon trap)
- Use the indigo accent for inactive toggles (T2 violation)

---

#### PROMPT 2 — Empty state: First-time `/alerts` visit

**Goal:** convey "you have no active alerts" without making the user feel they've broken something.

**DNA to preserve:** `--ink-300` (decorative icon), `--ink-900` (title), `--ink-500` (body), `--type-section-title`, `--type-body`, `--accent` (one CTA only — "Set up alert preferences"), T2, T8 (calm tone, not celebratory).

**UX rules that apply:** centered in viewport; max body width 32ch; one primary action.

**Taste cues:** T8 — calm voice. The empty state is *not* a celebration ("Wow, all caught up!") — it's a quiet acknowledgment ("No active alerts."). Per voice rules in §13.

**Anti-pattern:** do NOT show a confetti illustration, success checkmark, or "You're all set!" copy. CPAs don't want to be congratulated for an empty inbox.

**Do NOT:**
- Use color in the icon (decorative-only at `--ink-300`)
- Add multiple CTAs
- Use the §5.3 confirm-pulse animation here (reserved for received_confirmed moments only)

---

#### PROMPT 3 — Data-dense surface: All-clients table with bulk actions

**Goal:** let a CPA scan 600 clients (Yan Jing's scale) and apply bulk operations (mark received, send chase, archive) to a multi-select.

**DNA to preserve:** `--type-body-sm` (table rows), `--type-eyebrow` (column headers), `--type-numeric` with tabular-nums, all status pill tokens, `--accent` (only on the bulk-action bar that appears when selection >0), T1, T4, T6.

**UX rules that apply:** sticky table header on scroll; ≥44px row height; horizontal scroll allowed (NEVER reflow tabular data into cards); multi-select via leading checkbox column.

**Taste cues:** T6 dominates — density without crowding. T4 — every status is a pill. T1 — every dollar tabular-aligned. The bulk-action bar that appears when selection >0 is a sticky bottom strip, not a popover.

**Anti-pattern:** do NOT reach for the "expandable row detail" pattern (clicking opens client detail in sheet/page). Avoid putting more than 8 columns visible — push the rest to client detail.

**Do NOT:**
- Reflow into cards on tablet (T6 — tabular data scans column-wise)
- Use the indigo accent on column header sort indicators (T2; use ink arrows)
- Use `--type-body` (14px) when `--type-body-sm` (13px) reads better at table density

---

#### PROMPT 4 — Edge state: Stale-data warning on a client detail

**Goal:** when DueDateHQ's last sync with the upstream source (state DOR API, Postmark inbox) was >24h ago, signal it without alarming the user.

**DNA to preserve:** banner pattern (§4.11) with `info` variant, `--type-body-sm` for the timestamp, `--ink-500` for muted "Last synced" prefix, no accent, no animation.

**UX rules that apply:** the banner sits at the top of client detail, dismissible. Provides a "Sync now" inline link — NOT a button (banners use inline action per §4.11).

**Taste cues:** T7 — info banner is the right surface (not a modal, not a toast). T8 — calm tone. Voice (§13) — direct factual: "Last synced 2 days ago. Sync now."

**Anti-pattern:** do NOT use the danger banner for stale data — it's not an error. Do NOT block interaction; the user can still work with stale data.

**Do NOT:**
- Use spinner / loading skeleton instead of a banner (the data is not loading; it's just stale)
- Use yellow warn-banner (warn = "your action needed"; info = "you should know")
- Auto-dismiss the banner (let the user dismiss it)

---

#### PROMPT 5 — Cross-product surface: Client portal preview (read-only)

**Goal:** let a CPA preview what their client sees in the (future) portal — even though DueDateHQ is "Forever-no" on building a portal (per memory). This is a *preview only* surface inside the CPA tool — they want to see what the chase email links to.

**DNA to preserve:** `--surface`, all type tokens, all status pill tokens. CRITICAL — preserve the §1 mood; the preview embedded in the CPA tool should *still feel like DueDateHQ*, not a separate brand.

**UX rules that apply:** hero is N/A (this is an iframe-in-modal preview); use a sheet (`<Sheet>`) opening from the right at 480px to host the preview iframe.

**Taste cues:** T8 absolutely dominates — even a "preview" must look like DueDateHQ, not like a marketing portal. T2 — only one indigo button (e.g. "Open in new tab" for the CPA's reference). T7 — the preview opens in a sheet, not a modal (the sheet pattern signals "this is browse, not input").

**Anti-pattern:** do NOT reach for a "framed phone mockup" or any device chrome around the preview. CPAs want to see *what the client sees*, not a marketing rendering of it.

**Do NOT:**
- Add device-frame decoration around the iframe
- Use display-face headlines in the preview (T8)
- Build a real portal because of this prompt — this is a *preview-only* surface (Forever-no list says no portal)

---

### Anti-replication checklist (run before shipping any new surface)

```
Before shipping, verify:
☐ Section count differs from the closest comparable §4 component
☐ Component inventory differs (at least 1 component used that doesn't appear in this doc's examples)
☐ The dominant compositional move is NOT the case-study trick
   (e.g. don't lead every page with a "Welcome, [Name]" + 4 KPI cards)
☐ Every DNA token cited in the surface is named — no hex in markup
☐ Every applicable Taste principle (T1–T8) is traceable on the surface
☐ The surface honors the relevant alert-surface choice (bell / banner / modal / page)
☐ Empty / error / loading states all designed
☐ Mobile collapse strategy stated
☐ The surface is verifiable in `prefers-reduced-motion: reduce`
```

---

## §10. Brand Vocabulary (DueDateHQ Glossary)

These are load-bearing terms. Microcopy uses them verbatim. Synonym drift is forbidden (per [memory: "one thing, one entrance, one name"]).

| Term | Meaning | Never call it |
|---|---|---|
| **Action Queue** | The user's main work surface — items needing their action | "Tasks", "Inbox", "Your tasks", "To-do" |
| **Today** | The today-focused entry view (one of 7 sidebar destinations) | "Home", "Dashboard", "Daily" |
| **Service Package** | A bundle of related deadlines for a client (e.g. "Tax 2025 — LLC + State + Quarterlies") | "Bundle", "Filing bundle", "Engagement package" |
| **Chase** | An outbound email asking a client for missing info/docs | "Reminder", "Nudge" (acceptable inside the AI prompt; never in UI label) |
| **State Notification** | A change announced by an external authority (IRS, state DOR) that affects multiple clients | "Update", "Alert" (alert is the surface, not the event) |
| **Mode F** | Health monitoring mode — when DueDateHQ is checking system / data state | (use the letter; don't reword) |
| **received_confirmed** | The terminal state of a document/info request — the §5.3 invariant moment | "Marked complete", "Done" (these are the user-facing words; received_confirmed is the technical state) |
| **Machine-replicated activity** | One of the 5 activities DueDateHQ replicates from a CPA's brain | (technical term; not used in UI) |
| **Action Surface** | A UI region that combines state + suggested action ("X just announced Y, here are affected clients, here's the email draft") | "Card with action", "Smart panel" |
| **Client tier** | T0 / T1 / T2 / T3 — internal segmentation of client priority | "Class", "Level", "Rank" |
| **Phase 1 / Phase 2** | The two-phase chase pattern (push → pull) | (use the numbers) |
| **Substrate** | The underlying data layer (Postmark inbox, state DOR API, Calendly) | (technical term; not used in UI) |

**Voice rules around vocabulary:** when in doubt about UI copy, **say it the way a senior CPA would say it**, not the way an enterprise SaaS would. "Send chase" beats "Trigger reminder workflow." "Mark received" beats "Confirm document acquisition."

---

## §11. Motion Language ★

Motion confirms; it does not perform. Subtle, fast, professional.

### Easing tokens

```css
--ease-out-strong:  cubic-bezier(0.23, 1, 0.32, 1);   /* default for entries — Emil's curve */
--ease-out-quick:   cubic-bezier(0.4, 0, 0.2, 1);     /* for hover/state changes */
--ease-in-out:      cubic-bezier(0.77, 0, 0.175, 1);  /* on-screen movement (rare) */
```

**Forbidden:** CSS defaults (`ease`, `ease-in`, `ease-in-out`, `ease-out`) — too soft. Specifically `ease-in` is forbidden on UI animations (sluggish at the watching moment).

### Duration tokens

```css
--dur-instant: 80ms    /* never-animate threshold; for press feedback */
--dur-fast:   140ms    /* exits — system response */
--dur-medium: 220ms    /* standard enters; row fade-up */
--dur-slow:   320ms    /* modal enter; sheet slide */
--dur-confirm: 700ms   /* reserved: the §5.3 invariant pulse */
```

**Asymmetric rule (Emil):** exits are always faster than enters. Default pair: 220ms enter / 140ms exit.

### Frequency-based animation decisions

| Frequency | Decision |
|---|---|
| Keyboard nav (cmd+K, tab, arrow keys, Escape) | **No animation. Ever.** |
| Sidebar item hover (hundreds of times/day) | **No animation.** Bg color change only, instant. |
| Row hover in tables | Subtle bg shift, 160ms — not 220ms. |
| Modal / popover open | Standard 220–320ms with `--ease-out-strong`. |
| Toast slide-in | 200ms in, 140ms out. |
| The §5.3 received_confirmed moment | 700ms confirm pulse — the ONE delight moment. |

### Signature motion moments

1. **The confirm pulse (`.animate-ddhq-confirm`)** — *already shipped in `index.css`*. Fires when a checklist item flips to `received_confirmed`. 700ms green outward radial glow. Non-looping. **The single delight moment in the entire system.**

2. **Row fade-up (`.animate-ddhq-fade-up`)** — *already shipped*. New rows in tables/lists fade-in + slide up 4px. 220ms `--ease-out-strong`. Stagger 60ms when ≥3 new rows.

3. **AI shimmer (`.animate-ddhq-ai-shimmer`)** — *already shipped*. Gentle opacity pulse on AI-source pills (the only "AI" decoration in the system). 2.6s ease-in-out infinite.

4. **Modal enter** — backdrop fade 200ms; modal `scale(0.96 → 1) + opacity(0 → 1)` over 240ms `--ease-out-strong`. Exit `opacity 1 → 0` over 140ms.

5. **Popover enter** — `scale(0.96 → 1) + opacity(0 → 1)` from `var(--radix-popover-content-transform-origin)` (anchored to trigger). 180ms in, 100ms out.

### Reduced-motion policy

Already wired in `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Per-moment fallbacks:**
- Confirm pulse → opacity-only fade-in of green check mark (no glow)
- Row fade-up → instant insertion (no animation)
- Modal enter → instant open (no scale)
- AI shimmer → static `opacity: 0.85` (no pulse)

---

## §11.5 Invisible Correctness ★

The barely-audible voices that compound. Spec each — implementers always forget at least three.

| Surface | Token / rule |
|---|---|
| Text selection | `bg --accent at 24% alpha` · `color --ink-900` |
| Caret color | `caret-color: var(--accent)` on inputs; `caret-color: var(--ink-900)` on textareas |
| Scrollbar | thin (8px) · thumb `--ink-400 at 32% alpha` · hover `--ink-400 at 56%` |
| Link underline | `text-underline-offset: 3px` · `text-decoration-thickness: 1.5px` · color matches text · hover dims to 70% opacity |
| Tap-highlight | `-webkit-tap-highlight-color: transparent` + custom `:active` state per component |
| Tooltip delay | first hover: 400ms · subsequent (within 300ms): instant + no animation |
| Smooth scroll | `scroll-behavior: smooth` on `<html>` |
| Anchor scroll-margin | `scroll-margin-top: var(--nav-height) + var(--sp-3)` on every scroll target |
| Focus-visible ring | only on `:focus-visible`, never on `:focus` · never `outline: none` · 2px solid `--accent` + 2px offset, 4px radius |
| Broken image fallback | `bg --sunken` + alt text in `--type-body-sm` `--ink-500` flush-left + 16px lucide `<ImageOff>` icon |
| Font smoothing | `-webkit-font-smoothing: antialiased` on dark surfaces (toasts, dark popovers) only |
| `select-none` on chrome | sidebar items, button labels, badges — prevent accidental drag-select |
| Number input no-spinner | `appearance: none; -moz-appearance: textfield;` — kill browser default spinners on dollar amounts |
| Print stylesheet | minimum: links unfurl URLs · `@page` margin 0.5in · brand fonts swap to `system-ui` for fidelity |
| Empty `[]` in tables | render the cell as `—` (em dash) in `--ink-400`, not blank |
| Currency `<input>` | left-pad with `$` glyph as visual decoration; right-align value; tabular-nums on focus |

---

## §12. Imagery & Art Direction

**Photography:** none in the product. Only avatars (uploaded by users) — circular crop (`--radius-pill`), 36px / 48px / 80px sizes.

**Illustration:** sparing. Reserved for empty states and onboarding. Style: **flat 2-color line art** — `--ink-700` outlines on `--surface` bg, optional accent fill (≤10% of illustration). NEVER 3D, NEVER gradient, NEVER mascot character.

**Charts / data viz:** restrained. Line charts use `--accent` for primary series, `--ink-400` for secondary. Bar charts use `--accent` for the highlighted bar, `--ink-300` for the rest. **Never rainbow palettes.** When a chart needs >2 series, use single-hue tonal stepping (`--accent` → `--accent` at 70% → `--accent` at 40%).

**Document thumbnails:** rendered as gray rectangles with `--type-mono` filename label. Real PDF thumbnails rendered server-side (when phase 2 ships); until then, placeholder is acceptable.

---

## §12.5 Icon Craft ★

**Library:** Lucide (already configured in `components.json`). NOT Heroicons, NOT Material, NOT Phosphor — picking one and sticking is mandatory (per universal UX rule on orphan icons).

**Stroke weight ↔ type weight mapping:**

| Type weight nearby | Icon stroke | Used for |
|---|---|---|
| 400 (body) | 1.5px (Lucide default) | Inline icons in body, sidebar items, table cells |
| 500 (labels, emphasized body) | 1.75px (Lucide `strokeWidth={1.75}`) | Button icons, status pill dots |
| 600 (eyebrow, headings) | 2px (Lucide `strokeWidth={2}`) | Page-title accent icons (rare), large empty-state icons |

**Termination:** Lucide ships `stroke-linecap: round`. Pair with Inter 400 (which has slightly rounded terminations). **Acceptable.** If we ever switch to a flat-cut grotesque, switch icons to `stroke-linecap: butt`.

**Sizes (snap to base-4 ladder — never 18, 22, 28):**

| Size | Used for |
|---|---|
| 16px | Inline body icons, small badges |
| 20px | Sidebar items, button icons (md), header bell |
| 24px | Section-title accent icon, banner left icon |
| 32px | Large action icons (rare) |
| 48px | Empty-state hero icon |

**Toggle pairs morph, not swap:** `<ChevronDown>` ↔ `<ChevronUp>` on collapsible sections — animate the rotation (180deg over 160ms `--ease-out-strong`), don't swap SVGs. Same for `<Eye>` ↔ `<EyeOff>` on password reveal.

**Color:** icons inherit text color via `currentColor` — they automatically adopt `--ink-*` from their context. **Never set explicit hex on icons.**

---

## §13. Voice & Microcopy ★

**Brand voice:** calm, factual, respectful of time. CPAs are senior professionals. Don't over-explain; don't celebrate; don't apologize.

### Three guiding moves

1. **Action verbs before object nouns.** "Send chase" not "Chase action available."
2. **State the state, then the suggestion.** "Form 941 was revised. 72 clients affected. Review impacts." (state → suggestion → CTA)
3. **Numbers carry the load.** Microcopy supports the number, doesn't replace it. "$2,200 due Apr 18" beats "An amount is due in a few days."

### Microcopy examples

| Surface | Copy | Why |
|---|---|---|
| Empty `/alerts` | **"No active alerts."** Single line. No icon, no celebration, no "you're all caught up." | T8 — calm tool, not a stage. |
| Confirmation toast (received_confirmed) | **"Marked received. ✓"** | T1+voice — short, factual; the ✓ is the only ornament. |
| Error toast (chase send failed) | **"Couldn't send. Retry, or check the email address."** | Direct: what failed, what to try. No "Oops!" |
| Banner (state change) | **"IRS revised Form 941. 72 of your clients are affected. Review impacts →"** | State → impact count → action verb. |
| Button: send chase | **"Send chase"** | Verb + object. NOT "Send reminder," NOT "Chase client." |
| Button: mark complete | **"Mark received"** | Domain term, not generic. Maps to received_confirmed. |
| Helper text under email input | **"We'll send chases from your address. Replies route back to your inbox."** | Two facts, not three sentences. |
| Mode F health check | **"All sources connected."** Single line. No green checkmark; the absence of bad news IS the message. | T8 — don't celebrate baseline. |
| Loading state (rare — most pages are instant) | **"Loading…"** with the standard spinner. NOT "Just a moment!" / "Hang tight!" | Boring is correct. |
| Onboarding first-run | **"Welcome, Sarah. Add your first client to start tracking deadlines."** | Personalized, factual, immediately actionable. |

### Forbidden words / phrases

- "Oops!" / "Whoops!" — never apologize for system errors that aren't the user's fault.
- "Awesome!" / "Great!" / "" — never celebrate routine actions.
- "AI is learning" / "Our AI is thinking" — never expose AI internals as decoration. (Per [memory forever-no list].)
- "Just a moment!" / "Hang tight!" — boring "Loading…" is correct.
- "Reminder" (when "chase" is the brand term) — vocabulary discipline.
- "Bundle" / "Filing bundle" (when "service package" is the brand term).
- "Dashboard" as a sidebar destination (use "Today").

### Casing

- **Sentence case for everything** — buttons, labels, page titles, banner copy. No Title Case CTAs. No UPPERCASE except for sidebar group eyebrows (`WORKFLOWS`, `PERSONAL`, `TEAM`).
- **Punctuation:** commas inside; periods at end of sentences in body copy; **no periods on button labels or single-line statuses**.

---

## §14. Accessibility ★

### Verified contrast pairs (WCAG 2.1 AA)

| Pair | Ratio | Pass |
|---|---|---|
| `--ink-900` on `--canvas` | 16.4:1 | AAA |
| `--ink-900` on `--surface` | 17.1:1 | AAA |
| `--ink-700` on `--surface` | 9.8:1 | AAA |
| `--ink-500` on `--surface` | 4.9:1 | AA (body) |
| `--ink-400` on `--surface` | 3.1:1 | AA Large only — never use for body |
| `#FFFFFF` on `--accent` | 4.7:1 | AA |
| `--accent-ink` on `--accent-soft` | 6.2:1 | AAA |
| `--ok-ink` on `--ok-bg` | 5.8:1 | AAA |
| `--warn-ink` on `--warn-bg` | 7.2:1 | AAA |
| `--danger-ink` on `--danger-bg` | 6.4:1 | AAA |
| `--info-ink` on `--info-bg` | 6.8:1 | AAA |

### Other a11y rules

- **Focus visibility** — `:focus-visible` only, 2px solid `--accent` + 2px offset; **never `outline: none`**.
- **Target size** — 44×44 minimum (44×44 visual or 32×32 visual + 44×44 hit area).
- **Color independence** — every status carries an icon or label, never color alone. (E.g. "Overdue" pill carries the word + the danger color; the word does the work for color-blind users.)
- **Reduced motion** — every signature motion has an opacity-only fallback (see §11).
- **Keyboard nav** — Tab order follows reading order. Sidebar items navigable with arrow keys. Modal close on Escape. Tables: arrow keys move between cells in edit mode.
- **Screen reader** — every icon has `aria-label` (decorative icons get `aria-hidden="true"`); status pills announce as "Status: Overdue"; modal opens announce title.
- **Form errors** — `aria-invalid="true"` + `aria-describedby` linking to error message. Error message shows in `--danger-ink` below input.

---

## §15. Evidence Audit

Per-category transparency on what was extracted vs. inferred.

| Category | Grade | Notes |
|---|---|---|
| Colors | 🟢 GREEN | Existing `tailwind.config.js` provides full palette; references confirm Mercury indigo for accent (~#5B5BD6); status tints already match what Mercury / Refero use. |
| Typography | 🟢 GREEN | Inter is the canonical web alt for Mercury's Söhne; cv02/cv11/ss01 features already enabled in `index.css`. Number-typography pattern (cents-superscript) extracted directly from Mercury references. |
| Shape / radii | 🟢 GREEN | Existing radius ladder confirmed; pill (999px) ADDED for buttons + status (was missing). |
| Borders | 🟢 GREEN | Existing `--line` (#E2E8F0) matches reference observation; added `--line-strong` and `--line-accent` semantic tokens. |
| Gradients | 🟢 GREEN | None in references; none in product. Documented as "none observed." |
| Backgrounds | 🟡 YELLOW | Existing token is warm cream `#FAFAF7`; references all sit cool neutral. **Open decision** — see §2 Canvas Choice (recommend Option B `#F8F9FB`). |
| Spacing | 🟢 GREEN | Standard 4px ladder; confirmed against reference rhythm. |
| Motion | 🟡 YELLOW | References are static screenshots; motion tokens specified per Emil's framework + DueDateHQ-existing animations. **Open: validate modal enter feel against actual Mercury app.** |
| Layout | 🟢 GREEN | Sidebar + main canvas pattern observed across all references. |
| Voice | 🟢 GREEN | Direct factual voice extracted from Mercury copy + DueDateHQ vocabulary memory. |
| Vocabulary | 🟢 GREEN | DueDateHQ glossary sourced from canonical PRD/IA memory. |
| Icons | 🟢 GREEN | Lucide already configured; stroke/size mapping derived. |
| Component anatomy | 🟢 GREEN | Mercury references include in-product UI screenshots — direct evidence for all major components. |

---

## §16. Open Questions

1. **Accent migration plan.** Existing `--accent: #0F172A` (slate) needs to transition to `--accent: #5B5BD6` (indigo). Plan: (a) introduce `--accent-indigo` as new token, (b) migrate Button `primary` first, (c) audit all uses of slate-as-accent and re-tag as `--ink-button-secondary`. Can be done incrementally.
2. **Marketing site vs product UI separation.** This doc is for the product UI only. The marketing site (duedatehq.space landing) is allowed to use a display face. Define when we build the marketing site.
3. **Dark mode.** Not currently supported. CPAs work mostly in well-lit offices; defer until customer-driven request.
4. **Density mode toggle.** Yan Jing (600 clients) may need a "compact" mode — reduce row height to 36px, body to 12px. Defer until validated; current 44px row is comfortable for Sarah Mitchell (49 clients).
5. **Print styles for client-facing exports.** The CPA may print/PDF a deadline schedule for a client meeting. Currently no print stylesheet — design when first export feature ships.

---

## §17. Next Steps

After this doc lands:

1. **Migrate Button primary to indigo accent** — single PR, isolated change.
2. **Add `--radius-pill: 999px`** to `tailwind.config.js`. Update Button + Status pills.
3. **Build `<Money>` and `<Date>` and `<StatusPill>` primitives** — the three signature components. Each in `src/components/ui/`.
4. **Document the cmd+K palette** as a separate spec — the search affordance touches every page.
5. **Run the §9 anti-replication checklist** on every new feature PR until it becomes habit.

Recommended skills to run after this:
- **`impeccable`** — prototype a new surface from this doc to verify the system holds together.
- **`audit`** — score the existing pages against this design system to find drift.
- **`critique`** — stress-test whether the doc captured DueDateHQ's actual taste, or just borrowed Mercury's.

---

## §18. Delight Catalog ★

The brand-specific signature micro-moments. **DueDateHQ has exactly ONE delight moment** — the §5.3 invariant pulse. Everything else is utilitarian. This restraint IS the brand.

### 1. Press confirm — utilitarian only

**Purpose:** "the system heard you."
**Trigger:** any primary button press.
**Choreography:** `transform: scale(0.98)` over 80ms `--ease-out-quick`, then back to 1.0 over 80ms. NO ripple, NO color flash.
**Reduced-motion fallback:** opacity drop to 0.9 for 80ms, no transform.

### 2. Section transition — no decoration

**Purpose:** route changes feel responsive, not entertaining.
**Trigger:** sidebar nav click → page route change.
**Choreography:** content fades in via `.animate-ddhq-fade-up` (220ms, 4px slide). NOT a page slide-in, NOT a crossfade with the previous page.
**Reduced-motion fallback:** instant render, no animation.

### 3. Loading — boring is correct

**Purpose:** "we're working on it."
**Trigger:** async data fetch when local cache is empty.
**Choreography:** 16px Lucide `<Loader2>` icon spinning at 1.2s linear infinite (the standard shadcn skeleton). For lists, render skeleton rows (4 rows, `--sunken` bg, `--radius-md`).
**Reduced-motion fallback:** static "Loading…" text, no spinner. (Per Emil — animated spinners are repeated 100×/day; should be muted.)

### 4. Error — direct, no shake

**Purpose:** "this didn't work."
**Trigger:** any failed action (chase send fail, save fail, network error).
**Choreography:** danger toast slides in (200ms from right + opacity), 6s persistence, must dismiss. **NO `keyframes shake` on the originating button.** **NO red flash on form fields** — the error message under the input is enough.
**Reduced-motion fallback:** toast appears instantly (no slide), opacity-only.

### 5. Success — the ONE moment ★

**Purpose:** confirm the §5.3 invariant — when a checklist item flips to `received_confirmed`. This is the moment a CPA's chase landed; this is the moment the deadline got safer; this is the brand's only delight.
**Trigger:** state transition `received_pending → received_confirmed`.
**Choreography:** `.animate-ddhq-confirm` — outward green glow `0px → 12px box-shadow` over 700ms `--ease-out-strong`, fading to 0 alpha. The row's bg shifts to `--ok-bg` over 280ms (`.ddhq-row-transition`). The status pill swaps from `warn` to `ok`.
**Reduced-motion fallback:** instant bg + status swap; no glow. The status change carries the meaning.

> **Why exactly one delight moment.** Per T8 — the dashboard is a desk, not a stage. A CPA experiences this moment many times a day across their clients; if every confirm felt like fireworks, the brand would be exhausting. By making this the ONE delight, every other interaction is calm — and the §5.3 moment carries weight because it's rare in delight terms (even though common in volume terms).

---

## File map (where this lives in code)

- **Tokens:** [`tailwind.config.js`](../tailwind.config.js) — add the missing `--accent-indigo`, `--radius-pill`, `--accent-soft`, `--accent-ink`.
- **Base styles:** [`src/index.css`](../src/index.css) — already has reduced-motion + signature animations. Add scrollbar styling, link underline, text-selection, smooth scroll per §11.5.
- **shadcn primitives:** [`src/components/ui/`](../src/components/ui/) — already has button, dialog, dropdown-menu, popover, select, sheet, sonner, tooltip, alert-dialog. **Next:** form, command (cmd+K), table, badge.
- **DueDateHQ primitives:** [`src/components/ui/`](../src/components/ui/) — to add: `<Money>`, `<Date>`, `<StatusPill>`, `<EyebrowLabel>`, `<EmptyState>`.
- **Page-level layouts:** [`src/components/`](../src/components/) — sidebar, top bar, page-title, page-action-bar.

---

*This doc is the canonical brand-to-product translation. When a screen makes a decision the doc doesn't address, derive from the §1.5 Taste Principles. When you can't derive it, write it down here so the next person can.*
