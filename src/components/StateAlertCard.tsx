import { CalendarClock, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/StatusPill";
import { StateBadge } from "@/components/ui/StateBadge";
import { ClientChip } from "@/components/ui/ClientChip";
import { formatLongDate, hoursSince } from "@/data/dateHelpers";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import type { Announcement } from "@/types";
import { cn } from "@/lib/utils";

/**
 * StateAlertCard — the canonical alert presentation. Single source of
 * truth for /alerts (variant="feed") and Dashboard's preview section
 * (variant="preview"). One pattern, two readings — closes the
 * "Dashboard renders alerts differently from /alerts" duplication.
 *
 * Variants:
 *   - "feed"    — full workshop card. Click selects (left pane). Hover
 *                 reveals a `Send N` chip. Used by /alerts.
 *   - "preview" — Dashboard preview. Click navigates to /alerts/:id.
 *                 No hover action chip — the indigo CTA on every card
 *                 was a T2 violation when 10 of them stacked. Action
 *                 surface lives on /alerts.
 */

type Tone = "danger" | "warn" | "info";

const TYPE_LABEL: Record<Announcement["type"], string> = {
  disaster_extension: "Disaster ext.",
  penalty_relief: "Penalty relief",
  pte_change: "PTE change",
  form_change: "Form change",
  rate_change: "Rate change",
  nexus_change: "Nexus change",
};

const TYPE_TONE: Record<Announcement["type"], Tone> = {
  disaster_extension: "warn",
  penalty_relief: "info",
  pte_change: "info",
  form_change: "info",
  rate_change: "info",
  nexus_change: "warn",
};

function timeAgoShort(iso: string): string {
  const h = hoursSince(iso);
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export interface AffectedClient {
  id: string;
  name: string;
  email?: string;
}

export function affectedClientsFor(a: Announcement): AffectedClient[] {
  const map = new Map(MOCK_CLIENTS.map((c) => [c.id, c]));
  return a.affectedClientIds
    .map((id) => map.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ id: c.id, name: c.name, email: c.contactEmail }));
}

export interface StateAlertCardProps {
  a: Announcement;
  variant?: "feed" | "preview";
  /** Selected ring (feed variant only). */
  selected?: boolean;
  /** Faded "handled this session" treatment (feed variant only). */
  handled?: boolean;
  /** Click handler — feed: select the card; preview: navigate to /alerts/:id. */
  onSelect: () => void;
  /** Action complete callback — feed variant only. Wires the hover Send chip. */
  onComplete?: (id: string) => void;
}

export function StateAlertCard({
  a,
  variant = "feed",
  selected = false,
  handled = false,
  onSelect,
  onComplete,
}: StateAlertCardProps) {
  const tone = TYPE_TONE[a.type];
  const affected = affectedClientsFor(a);
  const visibleChips = affected.slice(0, 5);
  const overflow = Math.max(0, affected.length - visibleChips.length);
  const isFeed = variant === "feed";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group block w-full shrink-0 text-left bg-surface border border-line rounded-md transition-all cursor-pointer overflow-hidden",
        "hover:border-line-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900",
        isFeed && selected && !handled && "border-indigo ring-2 ring-indigo-soft",
        handled && "opacity-60 hover:opacity-95",
      )}
      aria-pressed={isFeed ? selected : undefined}
    >
      {/* ── Zone 1 — what just happened ───────────────────────── */}
      <div className="p-region flex items-start gap-3">
        <StateBadge code={a.stateCode} />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-ink-900 leading-snug">
            {a.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
            <span className="truncate flex-1 min-w-0">{a.authority}</span>
            <StatusPill variant={tone} size="xs" className="shrink-0">
              {TYPE_LABEL[a.type]}
            </StatusPill>
            <span className="tabular-nums shrink-0 text-ink-400">
              {timeAgoShort(a.detectedAt)}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-700 leading-snug line-clamp-2">
            {a.summary}
          </p>
          {handled && (
            <div className="mt-2 inline-flex items-center gap-1 text-2xs font-medium text-ok-ink bg-ok-bg border border-ok-border rounded px-1.5 py-0.5">
              <Check className="w-3 h-3" aria-hidden />
              Handled this session
            </div>
          )}
        </div>
      </div>

      {/* ── Zone 2 — who/when affected ────────────────────────── */}
      {(visibleChips.length > 0 || a.newDeadline) && (
        <div className="border-t border-line bg-sunken/40 px-region py-3">
          {visibleChips.length > 0 && (
            <>
              <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-2">
                Affects{" "}
                <span className="tabular-nums text-ink-900">
                  {a.affectedClientIds.length}
                </span>{" "}
                {a.affectedClientIds.length === 1 ? "client" : "clients"}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {visibleChips.map((c) => (
                  <ClientChip key={c.id} name={c.name} />
                ))}
                {overflow > 0 && (
                  <span className="text-xs text-ink-500 px-1.5 tabular-nums">
                    +{overflow} more
                  </span>
                )}
              </div>
            </>
          )}

          {a.newDeadline && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs text-ink-700",
                visibleChips.length > 0 && "mt-2.5 pt-2.5 border-t border-line/60",
              )}
            >
              <CalendarClock className="w-3.5 h-3.5 text-ink-500 shrink-0" aria-hidden />
              <span>
                Deadline shifts to{" "}
                <span className="font-medium text-ink-900">
                  {formatLongDate(a.newDeadline)}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Zone 3 — single dominant action (feed variant only,
              hover-revealed) ───────────────────────────────────── */}
      {isFeed && !handled && onComplete && (
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity border-t border-line px-region py-2 flex items-center justify-end bg-surface">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toast.success(
                `Sent draft to ${a.affectedClientIds.length} ${a.affectedClientIds.length === 1 ? "client" : "clients"}`,
              );
              onComplete(a.id);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-white bg-indigo hover:bg-indigo-hover transition-colors px-2.5 py-1 rounded"
            title="Send personalized email draft to each affected client"
          >
            <Send className="w-3 h-3" aria-hidden />
            Send {a.affectedClientIds.length}
          </button>
        </div>
      )}
    </div>
  );
}
