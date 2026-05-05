import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  STATE_NAMES,
  type ClientTier,
  type StateCode,
} from "@/types";

/**
 * ClientChip — the canonical client identity primitive.
 *
 * The product had four different visual shapes for "this is a client":
 * plain text inline (Today rows), badge-with-dot (Mail), state-coloured pill
 * (Alerts CopilotPane), text-link (Timeline), and large name + tier + state
 * cluster (ClientDetail header). At Sarah's 49-client scale the drift is a
 * minor papercut; at Yan Jing's 600-client scale every inconsistent shape
 * is a re-parse cost. One primitive = same shape everywhere.
 *
 * Sizes:
 *   sm — Action Queue rows, Timeline cells, dense lists. Optional 6px tier
 *        dot, no state pill, name truncates with ellipsis.
 *   md — Mail row author cell, Alerts chips, default everywhere else.
 *        Tier dot + optional state pill.
 *   lg — ClientDetail header, used once. Full tier label as text, state
 *        pills below the name.
 *
 * Identity drift hardliners: NO avatars, NO icons next to the name, NO
 * popovers, NO hover backgrounds (chips render in dense lists; hover-fill
 * creates noise). This is a name-rendering primitive, not a hover card.
 */

type Size = "sm" | "md" | "lg";

export interface ClientChipClient {
  id: string;
  name: string;
  /** ClientTier — controls dot colour. Optional because some surfaces
   *  (alerts roster) carry a stripped client shape without tier. */
  tier?: ClientTier | null;
  /** Primary state — when present and `showState`, renders a pill. */
  primaryState?: StateCode | null;
}

export interface ClientChipProps {
  client: ClientChipClient;
  size?: Size;
  /** Render the tier dot (sm/md) or full label (lg). Defaults: false on
   *  sm, true on md+lg. Pass false to suppress. */
  showTier?: boolean;
  /** Render the primary-state pill. Defaults: false on sm, true on md+lg.
   *  Pass false to suppress. */
  showState?: boolean;
  /** Wrap in a `<Link>` to /clients/:id (default) or render as plain `<span>`.
   *  Use "span" when the chip lives inside another interactive element
   *  (button, link) so the markup stays valid. */
  as?: "link" | "span";
  className?: string;
}

// Tier → dot colour. The product's tier vocabulary (premium/standard/custom)
// maps onto the spec's "loudest = indigo/amber, baseline = ink" scale:
//   premium  → indigo  (the tier the firm flags as priority)
//   custom   → amber   (bespoke contract; needs attention)
//   standard → ink-400 (default working tier)
//   undefined→ ink-300 (unknown / unset)
function tierDotClass(tier: ClientTier | null | undefined): string {
  switch (tier) {
    case "premium":
      return "bg-indigo";
    case "custom":
      return "bg-warn-solid"; // amber family — matches the warn token
    case "standard":
      return "bg-ink-400";
    default:
      return "bg-ink-300";
  }
}

function tierLabel(tier: ClientTier | null | undefined): string {
  switch (tier) {
    case "premium":
      return "Premium";
    case "custom":
      return "Custom";
    case "standard":
      return "Standard";
    default:
      return "Tier — unset";
  }
}

function tierTooltip(tier: ClientTier | null | undefined): string {
  if (!tier) return "Tier — unset";
  return `${tierLabel(tier)} tier client`;
}

function StatePill({
  code,
  size,
}: {
  code: StateCode;
  size: Size;
}) {
  // Neutral palette per spec; we don't currently track an "overdue" state
  // at the client level (it's per-deadline), so the warn-border branch
  // stays available for callers that wrap their own.
  const px = size === "lg" ? "px-1.5 py-0.5" : "px-1 py-0.5";
  return (
    <span
      className={cn(
        "inline-flex items-center text-2xs uppercase tracking-wide rounded font-medium",
        "bg-sunken text-ink-700 border border-line shrink-0",
        px,
      )}
      title={`Primary state · ${STATE_NAMES[code]}`}
    >
      {code}
    </span>
  );
}

export function ClientChip({
  client,
  size = "md",
  showTier,
  showState,
  as = "link",
  className,
}: ClientChipProps) {
  const tier = client.tier ?? undefined;
  const primaryState = client.primaryState ?? undefined;

  // Defaults: off on sm, on on md+lg.
  const renderTier = showTier ?? size !== "sm";
  const renderState = showState ?? size !== "sm";

  // Typography per spec — sm: 12px, md: 13px, lg: 20px.
  const nameClass =
    size === "lg"
      ? "text-display font-semibold text-ink-900 leading-7 tracking-[-0.01em]"
      : size === "md"
        ? "text-sm font-medium text-ink-900"
        : "text-xs font-medium text-ink-900";

  // The truncate target. lg never truncates (page header — let it wrap).
  const truncateClass =
    size === "lg" ? "" : "truncate min-w-0";

  // Aria label aggregates tier when shown — assistive tech reads "Acme Co.,
  // Premium tier client" rather than just "Acme Co.".
  const ariaLabel =
    as === "link" && renderTier && tier
      ? `${client.name}, ${tierLabel(tier).toLowerCase()} tier`
      : as === "link"
        ? client.name
        : undefined;

  // ── lg layout: stacked. Name on its own line; tier label inline; state
  // pills below. Used in ClientDetail header.
  if (size === "lg") {
    return (
      <div className={cn("flex flex-col gap-1 min-w-0", className)}>
        <div className="flex items-baseline gap-2 flex-wrap">
          {as === "link" ? (
            <Link
              to={`/clients/${client.id}`}
              aria-label={ariaLabel}
              className={cn(nameClass, "hover:underline")}
            >
              {client.name}
            </Link>
          ) : (
            <span className={nameClass}>{client.name}</span>
          )}
          {renderTier && (
            <span
              className="text-xs text-ink-500"
              title={tierTooltip(tier)}
            >
              {tierLabel(tier)}
            </span>
          )}
        </div>
        {renderState && primaryState && (
          <div className="inline-flex items-center gap-1">
            <StatePill code={primaryState} size={size} />
          </div>
        )}
      </div>
    );
  }

  // ── sm/md inline layout: dot · name · state-pill, all on one line.
  const dotSize = size === "md" ? "w-1.5 h-1.5" : "w-1.5 h-1.5"; // 6px both
  const gap = size === "md" ? "gap-1.5" : "gap-1";

  const inner = (
    <>
      {renderTier && (
        <span
          aria-hidden
          title={tierTooltip(tier)}
          className={cn(
            "inline-block rounded-full shrink-0",
            dotSize,
            tierDotClass(tier),
          )}
        />
      )}
      <span className={cn(nameClass, truncateClass)}>{client.name}</span>
      {renderState && primaryState && (
        <StatePill code={primaryState} size={size} />
      )}
    </>
  );

  const baseClass = cn(
    "inline-flex items-center min-w-0",
    gap,
    className,
  );

  if (as === "link") {
    return (
      <Link
        to={`/clients/${client.id}`}
        aria-label={ariaLabel}
        className={cn(baseClass, "hover:underline")}
      >
        {inner}
      </Link>
    );
  }

  return <span className={baseClass}>{inner}</span>;
}
