/**
 * Authority gradient — visual indicator of how AI shows up in this
 * particular surface. Three zones, in increasing-stakes order:
 *
 *   green:   AI acts autonomously, you can override. Sorting,
 *            classification confidence ≥ high, suggesting the right
 *            time to chase.
 *   yellow:  AI proposes, you approve. Email drafts, anomaly flags,
 *            applying state alerts to client lists.
 *   red:     AI never opines. Tax owed, audit risk, legal
 *            interpretation, financial advice.
 *
 * The chip is always small + ambient — never dominates the row. The
 * point is recognition: a CPA glances and knows whether the next
 * action requires their judgment. Keeps faith with the §5.3-style
 * invariant across every surface.
 *
 * Usage:
 *   <AuthorityChip zone="yellow" />
 *   <AuthorityChip zone="green" label="auto-sorted" />
 */
import type { ReactNode } from "react";

export type AuthorityZone = "green" | "yellow" | "red";

const ZONE_META: Record<
  AuthorityZone,
  { dot: string; bg: string; text: string; ring: string; label: string; help: string }
> = {
  green: {
    dot: "bg-ok-solid",
    bg: "bg-ok-bg/60",
    text: "text-ok-ink",
    ring: "border-ok-border",
    label: "AI acts",
    help: "AI acts autonomously here. You can override anytime.",
  },
  yellow: {
    dot: "bg-warn-solid",
    bg: "bg-warn-bg/60",
    text: "text-warn-ink",
    ring: "border-warn-border",
    label: "AI proposes",
    help: "AI proposes; you approve. Nothing happens without your click.",
  },
  red: {
    dot: "bg-danger-solid",
    bg: "bg-danger-bg/40",
    text: "text-danger-ink",
    ring: "border-danger-border",
    label: "Your call",
    help: "AI never opines on this. Your professional judgment, not ours.",
  },
};

interface Props {
  zone: AuthorityZone;
  /** Override the default zone label */
  label?: string;
  /** Render as a tiny dot (no text) — for in-row use */
  dotOnly?: boolean;
  /** Optional content placed before the dot — keep brief */
  prefix?: ReactNode;
  className?: string;
}

export function AuthorityChip({
  zone,
  label,
  dotOnly = false,
  prefix,
  className,
}: Props) {
  const meta = ZONE_META[zone];
  if (dotOnly) {
    return (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot} ${className ?? ""}`}
        title={meta.help}
        aria-label={meta.help}
      />
    );
  }
  return (
    <span
      title={meta.help}
      className={`inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.ring} ${className ?? ""}`}
    >
      {prefix}
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {label ?? meta.label}
    </span>
  );
}
