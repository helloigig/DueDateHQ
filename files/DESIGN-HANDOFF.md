# DueDateHQ — Design Handoff

> **Single document for Claude Code (or a designer-engineer) to execute the visual design pass.** Everything required to do the work is in this file or linked from it. Companion references are in the same `/files` folder.

**Scope of this handoff:** visual design + interaction polish for the existing lo-fi prototype in `src/`. Not a rewrite. Do not add new features beyond what's listed in §7. Do not change the data model.

---

## 0 · TL;DR — what success looks like

A senior CPA opens the app Monday morning and, inside 30 seconds, knows:
1. Whether there's anything urgent (overdue + state announcements)
2. What's due this week
3. That the system is trustworthy (sources cited, AI labeled, auditable)

After this design pass, these are true:
- [ ] One articulated design token system in `tailwind.config.js` + `src/index.css`
- [ ] Dashboard passes the 30-second scan test (only one "hero" block visible; everything else subordinate)
- [ ] Every main page has a proper empty state + loading state
- [ ] State-announcement surface visibly separates AI-parsed impact from official source
- [ ] Import wizard earns trust via per-row confidence signals
- [ ] Keyboard navigation works on the dashboard (j/k/c/enter/slash)
- [ ] Focus rings visible on all interactive elements
- [ ] No emoji in UI chrome (sidebar, buttons, status) — icons only
- [ ] Mobile responsive down to 375px on the dashboard and announcement detail

---

## 1 · Product context (read before designing)

- **Product:** state-deadline intelligence layer for solo + small-firm CPAs
- **Thesis:** CPAs never worry about missing a state deadline; when a state authority announces something, affected clients appear within 24h
- **Primary user:** Sarah Mitchell — solo CPA, 80 clients, multi-state, Excel + Outlook today, exhausted, suspicious of new tools
- **Not the user:** Big 4 staff, corporate in-house, pure bookkeepers
- **Category:** deliberately narrow — a specialist layer, not a practice-management platform. We do NOT build: client portals, document storage, billing, time tracking, tax prep

Full context: [01-product-brief.md](./01-product-brief.md) · [strategy-01-positioning.md](./strategy-01-positioning.md) · [strategy-03-customer-journey.md](./strategy-03-customer-journey.md) · [duedatehq-prd.md](./duedatehq-prd.md)

---

## 2 · Design principles (ranked — resolve conflicts by rank)

1. **Silence is a feature.** Empty states celebrate, they don't apologize.
2. **Time before clients.** Triage is time-grouped. "This week" is the primary unit.
3. **Urgency gradient, not alarm fatigue.** Red = real liability. Amber = attention. At most one red element per row. Never stack reds.
4. **Government-grade trust.** Every auto-generated fact links to an official source. AI content is labeled. No magic.
5. **Escape hatches visible.** Export, undo, "not applicable" — findable, not hidden. Neutralizes TaxDome-style lock-in fear.
6. **Keyboard before mouse.** Filing season CPAs live in keyboard shortcuts.
7. **Information density over whitespace maximalism.** Target user manages 80–300 clients. Notion-level density, not Linear-level airy.

---

## 3 · Tone

| Not this | This |
|---|---|
| Playful mascot, celebratory toasts | Bloomberg-terminal-meets-Linear |
| "You've got this!" copy | "3 deadlines need attention this week." |
| Emoji in system UI | Outline icons (Lucide / Heroicons outline) |
| Shimmer skeletons on everything | Honest status ("Detected 2h ago · Verified source") |
| Dark mode launch feature | Calm light default; dark mode deferred |

**Voice in copy:** second-person, declarative, no exclamation marks, no emoji in system messages. Lowercase sentence case for buttons (*"Batch-adjust deadlines"*, not *"Batch-Adjust Deadlines"*).

---

## 4 · Design tokens — implement in `tailwind.config.js`

Replace the empty `extend: {}` with the block below. These are the only color/type/spacing tokens; do not introduce others.

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "#FAFAF7",        // app background — warm neutral (not pure white)
        surface: "#FFFFFF",       // cards, panels
        sunken: "#F5F4EF",        // subtle depressed zones (search field bg)

        // Text
        ink: {
          900: "#0F172A",         // primary
          700: "#334155",         // emphasized body
          500: "#64748B",         // secondary
          400: "#94A3B8",         // tertiary / placeholder
          300: "#CBD5E1",         // disabled
        },

        // Border
        line: "#E2E8F0",
        "line-strong": "#CBD5E1",

        // Single accent (for primary CTAs only)
        accent: {
          DEFAULT: "#0F172A",     // slate-ink; NOT indigo — keeps the restrained terminal feel
          hover: "#1E293B",
        },

        // Status (strict use only)
        danger: { bg: "#FEF2F2", border: "#FCA5A5", ink: "#B91C1C", solid: "#DC2626" },
        warn:   { bg: "#FFFBEB", border: "#FCD34D", ink: "#92400E", solid: "#D97706" },
        ok:     { bg: "#ECFDF5", border: "#86EFAC", ink: "#047857", solid: "#059669" },
        info:   { bg: "#EFF6FF", border: "#93C5FD", ink: "#1D4ED8", solid: "#2563EB" },
      },

      fontFamily: {
        // System stack only — no web font import in R1 (faster load, more familiar).
        // If you want Inter later, add `@import url('https://rsms.me/inter/inter.css');`
        // to the top of index.css AND insert "Inter" into this list after BlinkMacSystemFont.
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI",
          "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      fontSize: {
        // Stricter scale: only these sizes in-app
        "2xs": ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        xs:   ["12px", { lineHeight: "16px" }],
        sm:   ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "20px" }],
        lg:   ["16px", { lineHeight: "24px" }],
        xl:   ["18px", { lineHeight: "26px" }],
        "2xl":["22px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        // No headings larger than 2xl in-app
      },

      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },

      boxShadow: {
        // Use sparingly; prefer borders + ring for elevation on cards
        pop: "0 2px 8px rgba(15, 23, 42, 0.06)",
        overlay: "0 8px 24px rgba(15, 23, 42, 0.12)",
      },

      spacing: {
        // 4px base; no new units beyond default scale
      },
    },
  },
  plugins: [],
};
```

### Global CSS additions — `src/index.css`

Replace contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root { height: 100%; }
  body {
    font-family: theme('fontFamily.sans');
    color: theme('colors.ink.900');
    background: theme('colors.canvas');
    font-feature-settings: "cv02", "cv11", "ss01";
  }
  /* Tabular figures for all numeric content by default */
  table, .tabular, [class*="tabular-nums"] {
    font-variant-numeric: tabular-nums;
  }
  /* Visible focus ring — never remove */
  :focus-visible {
    outline: 2px solid theme('colors.accent.DEFAULT');
    outline-offset: 2px;
    border-radius: 4px;
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

### Icon library

Install `lucide-react` (~15KB). Replace every UI emoji with its Lucide equivalent. Mapping:

| Used today | Replace with |
|---|---|
| 🏠 Dashboard | `LayoutDashboard` |
| 👥 Clients | `Users` |
| 📡 Alerts / 🔔 | `Bell` |
| 📅 Calendar | `Calendar` |
| ⚙️ Settings | `Settings` |
| 🔍 Search | `Search` |
| 📁 Import | `Upload` |
| 👤 New client | `UserPlus` |
| ⋯ Row menu | `MoreHorizontal` |
| 🚨 Disaster | `AlertTriangle` (in `danger` tone) |
| ⚠️ Warning | `AlertCircle` (in `warn` tone) |
| 📣 Info | `Megaphone` (in `info` tone) |
| ✓ Complete | `Check` |

Emoji remain allowed **inside user content** (notes, client names if user entered) but never in system chrome.

---

## 5 · Current-state audit — what's wrong today

Based on the existing lo-fi in `src/`. Findings are ordered by visual weight.

### 5.1 Dashboard (`src/pages/Dashboard.tsx`)

| # | Issue | Why it fails a principle | Fix |
|---|---|---|---|
| D1 | Five blocks compete above "This Week": banner + heatmap + greeting + status line + priority card + overdue section | Principle 2 (time-first) + Principle 3 (urgency gradient) | Make "This Week" the hero. Banner stays at top but smaller. Heatmap collapsed by default — show only when user has > 30 active deadlines and opts in. Priority card demoted to inline between "This Week" and "This month", not above. |
| D2 | Greeting is large (`text-xl`) but then the meta line uses `text-xs` — too much size jump | Typography scale discipline | Greeting → `text-lg font-semibold`; meta line → `text-sm text-ink-500` |
| D3 | Announcement banner styling: `🚨` emoji, red-50 bg, "Review →" underlined | Principle 4 (trust) + no-emoji rule | Replace with `AlertTriangle` icon in danger tone; "Review" becomes a right-aligned button with caret icon |
| D4 | Priority card badge "AI-RANKED" uses heavy styling; numeric scores ("72", "73") shown in saturated blocks without context | Principle 4 — AI labeling should be quiet, not shouty | (a) Label → subtle `text-2xs uppercase tracking-wide text-ink-500` with `Sparkles` icon. (b) **Keep** the numeric score logic in `score()` — it's load-bearing (overdue escalation, multi-state boost). Only tone down the `ScoreIndicator` visual: reduce size to `w-7 h-7`, use `bg-sunken text-ink-900` for < 90, `bg-danger-bg text-danger-ink` for ≥ 90. No solid red/amber blocks. (c) Replace the gradient container `from-indigo-50 to-white border-indigo-200` with `bg-surface border border-line` |
| D5 | Status text "2 overdue" is red but inline with other slate text — looks decorative | Principle 3 (urgency = real liability) | Use severity chip: red bg + ink + icon, not inline red text |
| D6 | Section headers are all-caps (`THIS WEEK (8)`) mixed with non-caps | Visual consistency | All section headers: `text-xs font-semibold uppercase tracking-wider text-ink-700` |
| D7 | Heatmap Y-axis ("Mon/Wed/Fri/Sun") uses tiny type, colors feel random | Density + legibility | Remove Y-axis labels (redundant), use a 7-dot legend. Reduce height by 30%. Only show when ≥ 30 upcoming in 8 weeks (not current threshold of 10). |
| D8 | "Later this year" is collapsed with just a count | OK, but should feel like an affordance | Add `ChevronRight` icon + description ("Q3 & beyond — 47 deadlines") |

### 5.2 Sidebar (`src/components/Sidebar.tsx`)

| # | Issue | Fix |
|---|---|---|
| S1 | Emoji icons (🏠 👥 📡 📅 ⚙) | Lucide icons per §4 table |
| S2 | "Calendar" route exists but lands on Placeholder — dead menu item | Remove `/calendar` from sidebar until the feature ships (it's Phase 2+). Alternately mark it "Coming soon" — but removal is cleaner per Principle 1. |
| S3 | Active state uses `bg-slate-100` — low contrast | Use `bg-sunken` + left-border accent (2px) in `accent.DEFAULT` |
| S4 | No firm/org switcher at top (Pro/Team tier requirement) | Add firm name under the "DueDateHQ" brand for Pro+; stub for Solo. |
| S5 | No visual grouping between nav items and Settings | Add `Workspace` label above Settings group (`text-2xs uppercase tracking-wider text-ink-400 px-3 pt-4 pb-1`) |

### 5.3 Top bar (`src/components/TopBar.tsx`)

| # | Issue | Fix |
|---|---|---|
| T1 | Search is a button-styled div, not an input | Keep as a button that opens a ⌘K command palette (don't inline an input). But visually it should read like an affordance — add `Search` icon left, `⌘K` kbd right, hover → `bg-sunken` |
| T2 | `+ New` button uses `bg-slate-900` — fine, but dropdown emojis (👤 📁) break no-emoji rule | Replace with Lucide icons |
| T3 | Notification bell: unread badge is a red circle — good. But bell is a rhomboid emoji | Lucide `Bell`; badge retains `danger.solid` |
| T4 | Avatar: solid initials on indigo bg — inconsistent with accent = slate | Avatar uses `bg-ink-900 text-canvas` for initials |
| T5 | No global keyboard shortcut hint visible | Add `⌘K` tooltip to Search. Register `cmd+k` / `ctrl+k` in `src/components/AppShell.tsx` via a `useEffect(() => { const handler = (e: KeyboardEvent) => { if ((e.metaKey \|\| e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(true); } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, []);` — palette itself can be a stub modal rendering "Search coming soon" for this pass. |

### 5.4 Announcement banner (`src/components/AnnouncementBanner.tsx`)

| # | Issue | Fix |
|---|---|---|
| AB1 | `opacity-80` on the sub-line reduces contrast below AA | Use `text-danger-ink` directly. Never use opacity for secondary text — pick a token whose native contrast passes AA. |
| AB2 | "Review →" is underlined text; inconsistent with other CTA patterns | Right-aligned button with `ChevronRight` icon, `text-sm font-medium` |
| AB3 | No dismissed-state treatment | Add ghost X button; on dismiss, fade to `text-ink-400` with "dismissed" tag for 3s, then hide (matches PRD confirm-dismiss behavior) |

### 5.5 Deadline row (`src/components/DeadlineRow.tsx`)

| # | Issue | Fix |
|---|---|---|
| DR1 | Urgency dot uses Unicode `●` / `○` — rendering varies across fonts | Replace with small SVG circles (solid/outline); `w-2 h-2` |
| DR2 | Countdown width `w-14` truncates labels like "Monday" | Use fixed `w-16` and format: "Today" / "Tue" / "Thu" / "3d" / "2w" |
| DR3 | Hover-only action buttons (`opacity-0 group-hover:opacity-100`) hidden from keyboard users | On focus-within, also reveal. Add `aria-label` to each action button. |
| DR4 | `bg-red-50/60` for overdue rows — inconsistent with token system | Use `bg-danger-bg` (Tailwind flattens nested color keys with hyphens: `{danger: {bg: ...}}` → `bg-danger-bg`) |
| DR5 | Jurisdiction chip uses `bg-slate-800 text-white` for primary, breaks the single-accent rule | Primary jurisdiction → filled `bg-ink-900 text-canvas`; nexus → outlined `border-line-strong text-ink-500`; federal → filled `bg-sunken text-ink-700`. All `text-2xs` |

### 5.6 Import wizard (`src/pages/Import.tsx`)

| # | Issue | Fix |
|---|---|---|
| I1 | Step 2 field mapping needs visible confidence per row (current brief calls for it) | Add `confidence` column: `High` = green dot; `Medium` = amber + "review"; `Low` = amber + "needs input" |
| I2 | AI detection banner "File In Time export (confidence: high)" is plain text | Elevate to an info card at top of Step 2 with `Sparkles` icon + "AI-detected" label + "Not this? [Select source manually]" escape hatch |
| I3 | No "import 5 to start" escape hatch per design brief §3 | Add a secondary button on Step 1: "Start with 5 clients manually" → skips to Quick Add |
| I4 | Commit screen uses generic spinner | Show actual progress ("Creating 43 of 87 client records · Assigning Service Packages · Generating 2026 deadlines") — honest status per Principle 4 |
| I5 | Done screen has green circle check inside a green bg circle — too much green | Use single check mark in `ok.ink` on `canvas` bg; restrained |

### 5.7 Announcement detail (`src/pages/AnnouncementDetail.tsx`)

| # | Issue | Fix |
|---|---|---|
| AD1 | No visible separation between "what AI parsed" and "what the official source says" | Wrap parsed impact in a card with `Sparkles` icon + "AI-parsed from [source]" header. Below it, a distinct "Official source" card with `ExternalLink` icon + direct quote from announcement + "View on [gov site]" link |
| AD2 | Batch-adjust action unlabeled for its destructive scope (affects N clients) | CTA copy: "Adjust 6 deadlines to Feb 15" (verb + count + outcome) — not "Batch-adjust deadlines"; confirm modal shows preview diff |
| AD3 | No way to mark the announcement "not applicable to me" | Add tertiary action: "Not applicable — dismiss" with optional reason |
| AD4 | Already-acted state missing | When user has adjusted: replace actions with summary card ("✓ 6 deadlines adjusted on Sep 15 · Undo" — undo available for 24h) |

### 5.8 Client detail (`src/pages/ClientDetail.tsx`)

Per wireframes §2 — tabs (Deadlines · Notes · Contacts · Activity). Current implementation likely collapses these. Audit during execution and align with wireframe.

### 5.8b Modals — `AddClientModal.tsx`, `ConfirmDialog.tsx`

| # | Issue | Fix |
|---|---|---|
| M1 | Backdrop opacity / blur unclear | Backdrop: `bg-ink-900/40 backdrop-blur-[2px]`. Content: `bg-surface rounded-md shadow-overlay border border-line`. Max width `max-w-md` (confirm), `max-w-lg` (forms). |
| M2 | No focus trap | On open: focus the primary action (or first input); on close: restore focus to the element that opened the modal. Use a small inline helper, not a library. |
| M3 | Destructive confirm buttons use slate-900 like non-destructive | Destructive CTA: `bg-danger-solid text-white hover:bg-danger-ink`. Non-destructive: `bg-accent text-white hover:bg-accent-hover`. |
| M4 | Esc key support unknown | Both modals respond to Esc — wire in the same effect that traps focus. |

### 5.9 Empty states (all pages)

No page currently has a first-class empty state. Add per this table:

| Page | Condition | Empty-state copy + CTA |
|---|---|---|
| Dashboard | No clients yet | *"Let's get your clients in."* `[Import CSV]` `[Add 5 manually]` `[Try demo data]` |
| Dashboard | Clients but no deadlines this week | *"All clear this week."* "Next deadline: {date} · {client} · {form}" |
| Dashboard | Filter yields zero | *"No deadlines match these filters."* `[Clear filters]` |
| Clients | No clients | Same as dashboard empty |
| Announcements | No alerts | *"No state announcements affecting your clients."* "We check 50 state authorities every hour. You'll see anything relevant here." |
| Announcements | All dismissed | *"All caught up."* "Dismissed announcements are archived in Settings › Alerts." |
| Import | Post-import with skipped rows | *"3 rows need attention."* Inline fix each. |

---

## 5.10 · Reference component — the style north star

**Rewrite `src/components/DeadlineRow.tsx` to this shape first.** Every other component should match its conventions (spacing, focus handling, token usage, action-reveal pattern). If a pattern in this file disagrees with something downstream, this file is authoritative.

```tsx
// src/components/DeadlineRow.tsx — reference implementation
import { Link } from "react-router-dom";
import { Check, MoreHorizontal } from "lucide-react";
import type { Client, Deadline, DeadlineStatus } from "../types";
import { countdownLabel, daysBetween, parseDate, TODAY } from "../data/dateHelpers";
import { actions } from "../data/store";

type UrgencyTone = "danger" | "warn" | "neutral";

function urgency(d: Deadline): UrgencyTone {
  const days = daysBetween(TODAY, parseDate(d.officialDueDate));
  if (days <= 0) return "danger";
  if (days <= 3 || d.status === "in_progress") return "warn";
  return "neutral";
}

const dotClass: Record<UrgencyTone, string> = {
  danger:  "bg-danger-solid",
  warn:    "bg-warn-solid",
  neutral: "bg-ink-300",
};

function statusLabel(s: DeadlineStatus): string | null {
  const map: Record<DeadlineStatus, string | null> = {
    not_started: null, in_progress: "In progress", completed: "Completed",
    deferred: "Deferred", filed_extension: "Extension filed", overdue: "Overdue",
  };
  return map[s];
}

interface Props {
  deadline: Deadline;
  client: Client;
  suppressClientName?: boolean;
  inOverdueSection?: boolean;
}

export function DeadlineRow({
  deadline, client, suppressClientName = false, inOverdueSection = false,
}: Props) {
  const tone = urgency(deadline);
  const isOverdue = deadline.status === "overdue";
  const showStatus = statusLabel(deadline.status) && !(inOverdueSection && isOverdue);

  const onComplete = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    actions.setDeadlineStatus(deadline.id, "completed");
  };

  return (
    <div
      className={[
        "group flex items-center gap-3 px-4 h-11",
        "border-b border-line last:border-b-0",
        isOverdue ? "bg-danger-bg hover:bg-danger-bg/70" : "hover:bg-sunken",
        "focus-within:bg-sunken",
        suppressClientName && "pl-8",
      ].filter(Boolean).join(" ")}
    >
      {/* Urgency dot — SVG circle, not Unicode, for consistent rendering */}
      <span className="w-2 h-2 shrink-0" aria-hidden>
        <span className={`block w-full h-full rounded-full ${dotClass[tone]}`} />
      </span>

      {/* Countdown — fixed width, tabular */}
      <span
        className={`text-xs font-medium tabular-nums w-16 shrink-0 ${
          tone === "danger" ? "text-danger-ink" : "text-ink-500"
        }`}
      >
        {countdownLabel(deadline.officialDueDate)}
      </span>

      {/* Client name — hidden on grouped repeats */}
      <div className="w-48 shrink-0 min-w-0">
        {suppressClientName ? (
          <span className="text-xs text-ink-300" aria-hidden>↪</span>
        ) : (
          <Link
            to={`/clients/${client.id}`}
            className="text-sm font-medium text-ink-900 hover:underline truncate block"
          >
            {client.name}
          </Link>
        )}
      </div>

      <span className="text-sm text-ink-700 flex-1 truncate min-w-0">
        {deadline.form}
      </span>

      {/* Jurisdiction chip — 3 styles only */}
      <JurisdictionChip
        code={deadline.jurisdiction}
        isPrimary={deadline.jurisdiction === client.primaryState}
      />

      {showStatus && (
        <span className="text-xs text-ink-500 w-24 truncate shrink-0">
          {statusLabel(deadline.status)}
        </span>
      )}

      {/* Actions — revealed on hover OR focus (not hover-only) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onComplete}
          aria-label="Mark complete"
          title="Mark complete (c)"
          className="text-xs px-2 py-1 rounded bg-ok-bg text-ok-ink hover:bg-ok-border/40"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          aria-label="More actions"
          className="text-xs p-1.5 rounded hover:bg-sunken text-ink-500"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function JurisdictionChip({ code, isPrimary }: { code: string; isPrimary: boolean }) {
  const isFederal = code === "federal";
  const base = "text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded font-medium shrink-0";
  if (isFederal) return <span className={`${base} bg-sunken text-ink-700`}>FED</span>;
  if (isPrimary) return <span className={`${base} bg-ink-900 text-canvas`}>{code}</span>;
  return <span className={`${base} border border-line-strong text-ink-500`}>{code}</span>;
}
```

### Patterns to copy from this file

- **Focus-within action reveal** (not hover-only) → apply to every list row across the app
- **Token-only colors** — zero Tailwind default colors (`red-*`, `slate-*`, `indigo-*`). If you reach for one, stop and add the token instead
- **SVG shapes over Unicode glyphs** for anything that must render identically across platforms
- **`aria-label` on every icon-only button**
- **Fixed-width tabular numeric columns** so rows align in a table-like rhythm
- **Height in multiples of 4px** — row height `h-11` = 44px, matches touch target

---

## 6 · Layout rules (non-negotiable)

- **Max content width:** `max-w-5xl` (1024px). Beyond 1024, add whitespace, not columns (dashboard, settings). Lists (Clients, Announcements) may use `max-w-6xl`.
- **Row height:** list rows = 44px. Dense tables = 36px. Never < 32px.
- **Card:** `bg-surface border border-line rounded-md` — no shadow. Overlays (modals, dropdowns) use `shadow-overlay`.
- **Section spacing:** between dashboard sections = `space-y-5` (20px). Between card and next card = `space-y-3` (12px).
- **Never nest cards >1 deep.** If you need more separation, use dividers + padding, not more cards.

---

## 6.1 · Pattern sheet — copy these, don't reinvent

```tsx
// Primary CTA
<button className="text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2">
  Action
</button>

// Secondary CTA
<button className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken">
  Secondary
</button>

// Destructive CTA
<button className="text-sm px-3 py-1.5 rounded-md bg-danger-solid text-canvas hover:bg-danger-ink">
  Destructive
</button>

// Ghost / tertiary
<button className="text-sm px-2 py-1 text-ink-500 hover:text-ink-900 hover:bg-sunken rounded">
  Less emphasis
</button>

// Status chip (danger — use warn-* or ok-* for other tones)
<span className="inline-flex items-center gap-1 text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded font-medium bg-danger-bg text-danger-ink border border-danger-border">
  <AlertTriangle className="w-3 h-3" />
  Overdue
</span>

// Card
<section className="bg-surface border border-line rounded-md overflow-hidden">
  <header className="flex items-center px-4 py-3 border-b border-line">
    <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-700">
      Section title
    </h2>
  </header>
  <div>{/* list or content */}</div>
</section>

// Empty state
<div className="bg-surface border border-line rounded-md px-6 py-10 text-center">
  <p className="text-sm text-ink-700 font-medium">Primary line</p>
  <p className="text-xs text-ink-500 mt-1">Secondary context line</p>
  <div className="mt-4 flex items-center justify-center gap-2">
    {/* CTA buttons */}
  </div>
</div>

// Modal shell (use inside a React portal; backdrop handles close)
<div className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
  <div className="bg-surface rounded-md shadow-overlay border border-line w-full max-w-md">
    <header className="px-5 py-4 border-b border-line">
      <h2 className="text-sm font-semibold text-ink-900">Title</h2>
    </header>
    <div className="px-5 py-4">{/* body */}</div>
    <footer className="px-5 py-3 border-t border-line flex items-center justify-end gap-2">
      {/* Secondary then Primary, always */}
    </footer>
  </div>
</div>
```

**Token-syntax reminder.** Tailwind flattens nested color objects with hyphens:

| Config shape | Class name |
|---|---|
| `danger: { bg: ... }` | `bg-danger-bg` ✅  (`bg-danger.bg` ❌) |
| `danger: { ink: ... }` | `text-danger-ink` ✅ |
| `accent: { DEFAULT, hover }` | `bg-accent` + `hover:bg-accent-hover` ✅ |
| `ink: { 900, 700, 500 }` | `text-ink-900` ✅ |

If your class looks wrong, check this table before debugging Tailwind.

---

## 7 · Prioritized task list

Do in order. Each task lists file paths + acceptance criteria. A task is done when **every** acceptance criterion is verifiable in the preview.

### P0 — ship this week

**T1 · Install Lucide + implement design tokens**
- Files: `package.json`, `tailwind.config.js`, `src/index.css`
- Steps: `npm i lucide-react` · replace `tailwind.config.js` with §4 block · replace `src/index.css` with §4 block
- Accept: `<Check />` renders in a test component · tokens autocomplete in Tailwind class (e.g., `bg-canvas`, `text-ink-900`, `bg-danger-bg`) · no TypeScript errors

**T2 · Rewire chrome to tokens + icons**
- Files: `src/components/Sidebar.tsx`, `src/components/TopBar.tsx`, `src/components/AppShell.tsx`
- Steps: apply S1–S5 + T1–T5 fixes
- Accept: Sidebar has no emoji · Calendar route removed · active nav shows left-border accent · TopBar avatar uses ink-900 · `cmd+k` is wired (can open a stub "Coming soon" modal for now) · focus rings visible on every nav link and button

**T3 · Dashboard hierarchy pass**
- Files: `src/pages/Dashboard.tsx`, `src/components/AnnouncementBanner.tsx`, `src/components/PriorityCard.tsx`, `src/components/HeatmapStrip.tsx`
- Steps: apply D1–D8 + AB1–AB3
- Accept: `This Week` is visibly the most prominent section · overdue section appears only if count > 0 and sits above This Week · heatmap gated to >= 30 upcoming · priority card inline below This Week · section headers consistent · banner uses Lucide icon · greeting typography scales down to lg
- Verify: screenshot at 1280×800 — user's eye should land on `This Week` first

**T4 · Deadline row polish — the style north star**
- Files: `src/components/DeadlineRow.tsx`
- Steps: **rewrite to match §5.10 reference implementation verbatim** (it closes DR1–DR5 plus focus-within action reveal and aria-labels)
- Accept: file matches §5.10 structure · keyboard focus on a row reveals action buttons · urgency dot renders consistently at 1x/2x · overdue row uses `bg-danger-bg` · jurisdiction chips follow the 3-style pattern · no Tailwind default colors remain
- **Ship this task before T5/T6/T7** — downstream components copy its patterns

**T5 · Empty states**
- Files: `src/pages/Dashboard.tsx`, `src/pages/Clients.tsx`, `src/pages/AnnouncementList.tsx`, `src/pages/Import.tsx`
- Steps: apply §5.9 table
- Accept: each page in the table shows the correct empty state when its condition is met · copy matches verbatim

**T4b · Modal shell unification**
- Files: `src/components/AddClientModal.tsx`, `src/components/ConfirmDialog.tsx`
- Steps: apply M1–M4 (§5.8b) using the modal shell from §6.1 pattern sheet
- Accept: Esc closes both · focus returns to opener on close · destructive confirms use `bg-danger-solid` · backdrop uses `bg-ink-900/40`

### P1 — ship next

**T6 · Announcement detail — AI vs official separation**
- Files: `src/pages/AnnouncementDetail.tsx`
- Steps: apply AD1–AD4
- Accept: parsed impact card and official source card are visually distinct (different icons, headers, and one of them has an outline-only treatment) · batch-adjust CTA includes the count and date · already-acted state renders when mock data flagged

**T7 · Import wizard trust pass**
- Files: `src/pages/Import.tsx`, `src/data/mockImportData.ts`
- Steps: apply I1–I5
- Accept: each field-mapping row shows a confidence chip · AI detection has escape hatch to override source · Step 4 shows honest itemized progress not a generic spinner

**T8 · Mobile responsive**
- Files: all main pages
- Accept: at 375×812 — dashboard shows announcement banner + This Week (overdue/This Month/Later collapsed); announcement detail stacks vertically with sticky action bar; sidebar becomes bottom tab bar (4 tabs: Dashboard, Clients, Alerts, Settings)
- Verify: `preview_resize` to mobile preset; every primary action still tappable with 44px min touch target

### P2 — polish

**T9 · Client detail tabs polish**
- Files: `src/pages/ClientDetail.tsx`
- Steps: align to wireframes §2
- Accept: tabs navigable by keyboard (arrows) · active tab has accent underline · Deadlines/Notes/Contacts/Activity all present

**T10 · Keyboard shortcuts**
- Files: `src/pages/Dashboard.tsx` + a new `src/hooks/useKeyboard.ts`
- Shortcuts: `j`/`k` navigate rows · `Enter` opens deadline detail modal · `c` marks complete · `/` focuses filter · `Esc` closes modals
- Accept: hint in footer "`? for shortcuts`" opens a modal listing all shortcuts · all shortcuts work

**T11 · A11y pass**
- All interactive elements have `aria-label` where icon-only · color contrast checked with a tool · `prefers-reduced-motion` respected · screen-reader runs through a full triage

---

## 8 · Verification workflow

After each P0 task, verify in the preview using the `preview_*` tools:

1. `preview_start` with name `vite`
2. `preview_screenshot` at default desktop (1280×800) — share in the final summary
3. `preview_resize` to mobile (375×812) + `preview_screenshot` for responsive tasks
4. `preview_console_logs` with `level: error` — must be empty
5. `preview_snapshot` to verify text matches acceptance copy (not just visual)

**Do not** claim a task complete without a preview screenshot. If a screenshot shows a regression on an unrelated screen, fix it before moving on.

---

## 9 · Explicit non-goals for this pass

Do not do any of these in this design phase. Mention them in your summary if relevant but don't build them.

- ❌ Dark mode
- ❌ Native mobile apps
- ❌ Client portal / document upload
- ❌ Billing UI beyond a stub Settings page
- ❌ Team workload / assignee views (wait for Team tier design)
- ❌ Natural-language query UI
- ❌ Animation library (framer-motion, gsap) — simple CSS transitions are enough
- ❌ Replacing React Router
- ❌ Server/API work — everything stays on the mock `store.ts`
- ❌ New pages beyond the existing route table

---

## 10 · Out-of-scope detected during design? Do this.

If while executing, you notice something that would improve the product but is outside this handoff:

1. **Don't do it inline.** Finish the current task first.
2. **Log it** at the bottom of this file under a new `## 11 · Deferred findings` section with: title, one-line rationale, suggested owner/phase.
3. Continue.

This keeps the design pass bounded.

---

## 11 · Reference docs (in priority order)

1. [strategy-03-customer-journey.md](./strategy-03-customer-journey.md) — where to invest design effort
2. [strategy-04-user-story-map.md](./strategy-04-user-story-map.md) — screen inventory + release scope
3. [duedatehq-dashboard-spec.md](./duedatehq-dashboard-spec.md) — exact dashboard spec
4. [duedatehq-wireframes.md](./duedatehq-wireframes.md) — announcement, client, import wireframes
5. [duedatehq-ia-flows.md](./duedatehq-ia-flows.md) — navigation + flows
6. [duedatehq-prd.md](./duedatehq-prd.md) — scope decisions + data model
7. [01-product-brief.md](./01-product-brief.md) — personas + thesis
8. [strategy-01-positioning.md](./strategy-01-positioning.md) — category + messaging
9. [strategy-02-problem-statement.md](./strategy-02-problem-statement.md) — HMW questions
10. [competitive-matrix.md](./competitive-matrix.md) — what competitors look like

---

*v1 · 2026-04-24 · self-contained handoff. Execute sequentially, verify after each P0 task.*
