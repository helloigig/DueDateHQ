/**
 * ─────────────────────────────────────────────────────────────────────
 *  Per-alertType config for AlertDetail (`/alerts/:id`).
 * ─────────────────────────────────────────────────────────────────────
 *
 *  Single source of truth for what differs across the 6 alertTypes.
 *  Touch THIS file when changing any per-variant copy, tone, or verb —
 *  not the AnnouncementDetail page or AlertActionBar component.
 *
 *  Companion: docs/specs/alert-detail-variants.md
 *
 *  Adding a new alertType:
 *   1. Add the enum value to types.ts AnnouncementType
 *   2. Add a new entry to ALERT_TYPE_CONFIG below
 *   3. (optional) Add a new modal component if its action shape differs
 *
 *  Re-styling (e.g., changing chip color, primary verb tone):
 *   - Tone is one of: 'warn' | 'info' | 'neutral' | 'danger'
 *     → maps to design tokens (warn-bg / warn-border / warn-ink, etc.)
 *   - Verb templates are pure functions of (announcement, selectedCount)
 *     → no JSX, no inline styling. Style lives in AlertActionBar.tsx.
 * ─────────────────────────────────────────────────────────────────────
 */
import type { Announcement, AnnouncementType } from "../types";

export type AlertTone = "warn" | "info" | "neutral" | "danger";

/** Action a primary/secondary verb dispatches when clicked. */
export type AlertActionKind =
  | "open_batch_notify" // disaster_extension; bundles deadline shift + email
  | "open_batch_notify_no_shift" // generic notify-only fallback
  | "open_batch_tag_modal" // penalty_relief; tags clients for filing-time review
  | "open_planning_call_modal" // pte_change; creates planning_calls + Today TodoItems
  | "open_recompute_modal" // rate_change; recomputes estimate amounts
  | "open_nexus_check_modal" // nexus_change; per-client questionnaire + add filings
  | "route_admin_queue" // form_change (admin); navigate to reviewer queue
  | "route_calendar_schedule"; // P2 — calendar integration placeholder

export interface AlertTypeConfig {
  /** Humanized label for the type chip in the header. */
  label: string;
  /** Tone drives chip + accent color (resolved via design tokens). */
  tone: AlertTone;
  /** Headline used in the verdict block above the affected list. */
  verdictHeadline: (count: number, totalClients: number) => string;
  /** Empty state copy when 0 clients match. */
  emptyStateCopy: (ann: Announcement) => string;
  /** Primary verb label — varies with selected count + (optionally) newDate. */
  primaryVerb: (selectedCount: number, ann: Announcement) => string;
  /** Primary verb action — what to dispatch on click. */
  primaryAction: AlertActionKind;
  /** Secondary verb label (optional). */
  secondaryVerb?: (selectedCount: number, ann: Announcement) => string;
  /** Secondary verb action (optional). */
  secondaryAction?: AlertActionKind;
  /** Per-row chip the verdict list shows. Falls back to entity if unset. */
  perClientRowChip?: (
    client: { entityType: string; primaryState: string; county?: string },
    ann: Announcement,
  ) => string;
  /** Whether the variant supports the BatchNotifyModal's deadline-shift toggle. */
  supportsDeadlineShift: boolean;
  /** When true, show the "what changed" admin panel instead of action bar. */
  isAdminGated: boolean;
}

/**
 * Centralized tone → token map. Touch this to restyle ALL alert tone
 * variants at once. Each tone is rendered via Tailwind classes built from
 * design tokens (warn-bg / warn-ink / warn-border, etc).
 */
export const ALERT_TONE_CLASSES: Record<
  AlertTone,
  { chip: string; accent: string; border: string }
> = {
  warn: {
    chip: "bg-warn-bg text-warn-ink border-warn-border",
    accent: "bg-warn-bg/40",
    border: "border-warn-border",
  },
  info: {
    chip: "bg-info-bg text-info-ink border-info-border",
    accent: "bg-info-bg/40",
    border: "border-info-border",
  },
  neutral: {
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    accent: "bg-slate-50",
    border: "border-slate-200",
  },
  danger: {
    chip: "bg-danger-bg text-danger-ink border-danger-border",
    accent: "bg-danger-bg/40",
    border: "border-danger-border",
  },
};

const fmtCount = (n: number, noun: string) =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * The big map. Order = display order (header chip ranking, etc.).
 *
 * Per-variant rationale: see docs/specs/alert-detail-variants.md §3.
 */
export const ALERT_TYPE_CONFIG: Record<AnnouncementType, AlertTypeConfig> = {
  disaster_extension: {
    label: "Disaster extension",
    tone: "warn",
    verdictHeadline: (n, total) =>
      `Affecting ${n} of your ${total} clients · deadlines moving`,
    emptyStateCopy: (ann) =>
      `None of your clients are in ${ann.stateCode}${
        ann.counties && ann.counties.length > 0
          ? ` (${ann.counties.slice(0, 3).join(", ")}${ann.counties.length > 3 ? ", …" : ""})`
          : ""
      }.`,
    primaryVerb: (n, ann) =>
      ann.newDeadline
        ? `Move ${fmtCount(n, "deadline")} to ${formatShortDate(ann.newDeadline)}`
        : `Review ${fmtCount(n, "client")}`,
    primaryAction: "open_batch_notify",
    secondaryVerb: (n) => `Adjust + draft ${fmtCount(n, "email")}`,
    secondaryAction: "open_batch_notify",
    perClientRowChip: (c) =>
      c.county ? `${c.county}, ${c.primaryState}` : c.primaryState,
    supportsDeadlineShift: true,
    isAdminGated: false,
  },

  penalty_relief: {
    label: "Penalty relief",
    tone: "info",
    verdictHeadline: (n, total) =>
      `Affecting ${n} of your ${total} clients`,
    emptyStateCopy: (ann) =>
      `None of your clients have penalties pending in ${ann.stateCode}.`,
    primaryVerb: (n) => `Tag ${fmtCount(n, "client")} for review at filing`,
    primaryAction: "open_batch_tag_modal",
    secondaryVerb: (n) => `Tag + draft ${fmtCount(n, "email")}`,
    secondaryAction: "open_batch_tag_modal",
    perClientRowChip: (c) => `${c.entityType} · ${c.primaryState}`,
    supportsDeadlineShift: false,
    isAdminGated: false,
  },

  pte_change: {
    label: "PTE change",
    tone: "info",
    verdictHeadline: (n, total) =>
      `Affecting ${n} of your ${total} clients`,
    emptyStateCopy: (ann) =>
      `None of your clients have a PTE election active in ${ann.stateCode}.`,
    primaryVerb: (n) => `Schedule planning ${fmtCount(n, "call")}`,
    primaryAction: "open_planning_call_modal",
    secondaryVerb: (n) => `Draft ${fmtCount(n, "planning email")}`,
    secondaryAction: "open_batch_notify_no_shift",
    perClientRowChip: (c) => `${c.entityType} · ${c.primaryState}`,
    supportsDeadlineShift: false,
    isAdminGated: false,
  },

  rate_change: {
    label: "Rate change",
    tone: "info",
    verdictHeadline: (n, total) =>
      `Affecting ${n} of your ${total} clients`,
    emptyStateCopy: (ann) =>
      `None of your clients have active estimates affected by this rate change.`,
    primaryVerb: (n) => `Recompute ${fmtCount(n, "estimate")}`,
    primaryAction: "open_recompute_modal",
    secondaryVerb: (n) => `Recompute + draft ${fmtCount(n, "email")}`,
    secondaryAction: "open_recompute_modal",
    perClientRowChip: (c) => `${c.entityType} · ${c.primaryState}`,
    supportsDeadlineShift: false,
    isAdminGated: false,
  },

  form_change: {
    label: "Form change",
    tone: "neutral",
    verdictHeadline: (n, total) =>
      `Used by ${n} of your ${total} clients`,
    emptyStateCopy: () =>
      `None of your clients use this form. No catalog action needed for your firm.`,
    primaryVerb: () => `Open admin reviewer queue →`,
    primaryAction: "route_admin_queue",
    // No secondary — form_change is admin-only action surface
    perClientRowChip: (c) => `${c.entityType} · ${c.primaryState}`,
    supportsDeadlineShift: false,
    isAdminGated: true,
  },

  nexus_change: {
    label: "Nexus change",
    tone: "info",
    verdictHeadline: (n, total) =>
      `Possibly affecting ${n} of your ${total} clients (verify nexus)`,
    emptyStateCopy: (ann) =>
      `None of your clients show activity in ${ann.stateCode} that would create nexus.`,
    primaryVerb: (n) => `Add suggested filings for ${fmtCount(n, "client")}`,
    primaryAction: "open_nexus_check_modal",
    secondaryVerb: (n) => `Notify ${fmtCount(n, "client")} (no filings yet)`,
    secondaryAction: "open_batch_notify_no_shift",
    perClientRowChip: (c) => `${c.entityType} · ${c.primaryState}`,
    supportsDeadlineShift: false,
    isAdminGated: false,
  },
};

/**
 * Helper: short date label for verb templates ("May 14"). Used to keep
 * the primary verb compact even when the underlying date is verbose.
 */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
