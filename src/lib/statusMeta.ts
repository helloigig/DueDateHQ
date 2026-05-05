import type { DeadlineStatus } from "../types";

type PillVariant = "ok" | "warn" | "danger" | "info" | "neutral" | "accent";

// icon: lucide-react component name — rendered as a 12px icon inside the pill
// to visually distinguish filing-level status from milestone/step-level status.
export const DEADLINE_STATUS_META: Record<
  DeadlineStatus,
  { label: string; variant: PillVariant; title: string; icon: string }
> = {
  not_started:     { label: "Not started",     variant: "neutral", icon: "Circle",        title: "Work has not started." },
  in_progress:     { label: "In progress",     variant: "neutral", icon: "Pencil",         title: "Work in progress." },
  completed:       { label: "Filed",           variant: "ok",      icon: "FileCheck",      title: "Filing completed." },
  filed_extension: { label: "Extension filed", variant: "info",    icon: "CalendarClock",  title: "Extension filed — final return still owed." },
  deferred:        { label: "Deferred",        variant: "neutral", icon: "PauseCircle",    title: "Intentionally deferred." },
  overdue:         { label: "Overdue",         variant: "danger",  icon: "AlertCircle",    title: "Past the official due date." },
};

export type MilestoneStatusKey = "not_started" | "in_progress" | "blocked" | "done" | "overdue";

// Same pill + icon system as DEADLINE_STATUS_META so statuses look identical
// wherever they appear. Shared states (not_started, in_progress, overdue) use
// the same icon + color as on deadline rows — "In progress" always means the
// same thing, regardless of context.
export const MILESTONE_STATUS_META: Record<
  MilestoneStatusKey,
  { label: string; variant: PillVariant; icon: string }
> = {
  not_started: { label: "Not started", variant: "neutral", icon: "Circle"       },
  in_progress: { label: "In progress", variant: "neutral", icon: "Pencil"       },
  blocked:     { label: "Blocked",     variant: "danger",  icon: "Ban"          },
  done:        { label: "Done",        variant: "ok",      icon: "CheckCircle2" },
  overdue:     { label: "Overdue",     variant: "danger",  icon: "AlertCircle"  },
};
