# DueDateHQ — Design Handoff · Addendum

> **⚠️ SUPERSEDED — see [`DESIGN.md`](../DESIGN.md) at the repo root.**
>
> This document was the v1.3 addendum (2026-04-24) capturing behavioral overrides + new patterns from a parallel session. As of **2026-05-03**, every still-relevant rule has been folded into [`DESIGN.md`](../DESIGN.md), and the "behavior only" execution gate it imposed has been lifted (the visual pass shipped).
>
> **Do not author new design rules here.** Add them to `DESIGN.md`.

---

## Where the original sections went

### §A · Overrides

| Item | Now lives in |
|:-----|:-------------|
| A1 Heatmap → click-popover | Historical — Today is now action-queue first; heatmap deprecated. |
| A2 Bell = unified notification center | Product behavior, not design system. Implementation lives in `<BellDropdown>` component. |
| A3 Nav label "Alerts" (not "State Intelligence") | Memory: `vocabulary.md`; `DESIGN.md` §Brand Vocabulary calls "alert is the surface, not the event" |
| A4 "Service Package" → "Filing bundle" | Still deferred / undecided. Memory tracks: `forever_no.md` keeps "service package" as canonical until interview evidence flips it. |
| A5 Deadline source attribution | Behavior — implemented in deadline detail. Not a design-system rule. |
| A6 Clients page table default (tile as toggle) | Shipped — `src/pages/Clients.tsx` uses `<PageContainer variant="wide">` with table markup. Not a forward-looking rule anymore. |
| A7 Overdue row red fill | `DESIGN.md` Color tokens (`bg-danger-bg`) + §Status colors are pills, never paint (T4) — clarifies the original rule: pale-tint row bg is OK, red left-border is not. |
| A8 Drop redundant overdue-status column | **`DESIGN.md` §Don'ts: "No tautological status columns"** (added 2026-05-03 consolidation) |
| A9 Dashboard ambient one-line status | Historical — Today has evolved past this; replaced by Action Queue + State Alerts hero pattern. |
| A10 Clients list URL-synced filter chips | Behavior; partially shipped via `<FilterChip>` primitive. |
| A11 Priority card hide-when-duplicative | Historical — PriorityCard was removed during the v0u rollout. |
| A12 Stack multiple announcement banners | Behavior gap; AnnouncementBanner refactor is in DESIGN.md §Outstanding gap (queued). |
| A13 Half-filled dot for `in_progress` | **`DESIGN.md` §Do's: "Encode lifecycle status in shape, urgency in color"** (added 2026-05-03 consolidation). Implemented in `src/components/DeadlineRow.tsx`. |
| A14 State chip pattern (filled primary / outlined nexus) | `DESIGN.md` §Shared primitives reference: `<StateBadge>` |
| A15 Calendar route — REMOVED from sidebar | Shipped. |
| A16 Brand token system (Fraunces + Geist + warm paper) | **Permanently parked.** The cool-neutral Mercury palette is the canonical visual register (see `DESIGN.md` §Reference inheritance). A16 is a historical alternate exploration; do not revive without explicit user direction. |

### §B · New patterns

| Item | Now lives in |
|:-----|:-------------|
| B1 Alert escalation ladder (24h / 48h / 72h blocking modal) | `DESIGN.md` §The four alert surfaces (the 72h escalation → blocking modal is the third surface) |
| B2 Confirm modal taxonomy (8 required, the rest banned) | **`DESIGN.md` §Confirm modal discipline** (added 2026-05-03 consolidation — the full taxonomy moved verbatim) |
| B3 Same-client-same-day row grouping | Behavior — already in `Dashboard.tsx`. Not a forward-looking rule. |
| B4 "+ New" dropdown scope (2 items, no "New deadline") | Shipped — `TopBar.tsx` reflects this. |
| B5 Add-deadline entry points (client detail only) | Shipped. |
| B6 Migration preview modal on entity/state/bundle change | **`DESIGN.md` §Destructive change preview** (added 2026-05-03 consolidation — signed-diff format moved verbatim) |
| B7 Notification preference (8am digest vs per-alert) | Settings behavior, not design system. |
| B8 Export modal — three-axis (what × format × recipient) | **`DESIGN.md` §Export modal — three-axis pattern** (added 2026-05-03 consolidation) |
| B9 Extension state machine (`submitted` / `approved` sub-states) | Data-model spec; lives in `files/duedatehq-prd.md` §3.7 + backend schema. Not design. |

### §C · Scope confirmations (rejections worth preserving)

These are forever-no's. Memory: `forever_no.md` is the canonical record. Specifically:

- ❌ Focus mode (added without a user problem)
- ❌ Gmail connection (audit dealbreaker)
- ❌ SMS reminders (don't half-build; defer to Phase 2 explicitly)
- ❌ Entity type on dashboard rows
- ❌ Batch import of deadlines/tasks (deadlines are generated, not imported)
- ❌ 50-color state palette (state = code + filled/outlined chip; see `<StateBadge>`)

### §D / §E

§D was a temporary task-list re-prioritization (2026-04-24). §E was meta-principles ("cite the doc," "kill additive scope on sight," "silence must be active"). Both are historical; the principles are absorbed into how we work and into `DESIGN.md` taste rules + memory.

---

*Tombstoned 2026-05-03. Original v1.3 content preserved in git history (`git log -p files/DESIGN-HANDOFF-ADDENDUM.md`). Don't restore — fold any missing rule into [`DESIGN.md`](../DESIGN.md) instead.*
