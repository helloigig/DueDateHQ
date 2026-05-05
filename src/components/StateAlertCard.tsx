import { CalendarClock, Check } from "lucide-react";
import { StatusPill } from "@/components/ui/StatusPill";
import { StateBadge } from "@/components/ui/StateBadge";
import { ClientChip } from "@/components/ui/ClientChip";
import { formatLongDate, hoursSince } from "@/data/dateHelpers";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import type { Announcement } from "@/types";
import { cn } from "@/lib/utils";

type ClientLike = {
  id: string;
  name: string;
  contactEmail?: string | null;
};

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

/**
 * Resolve `affectedClientIds` to display chips. Caller passes the live
 * client roster (real-mode tRPC `clients.list`, mock-mode store) so chips
 * reflect the firm's actual roster — not a frozen MOCK_CLIENTS lookup.
 * Falls back to MOCK_CLIENTS only when the caller didn't pass a source
 * (legacy callers / design previews).
 */
export function affectedClientsFor(
  a: Announcement,
  source?: ReadonlyArray<ClientLike>,
): AffectedClient[] {
  const list = source ?? MOCK_CLIENTS;
  const map = new Map(list.map((c) => [c.id, c]));
  return a.affectedClientIds
    .map((id) => map.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      name: c.name,
      email: c.contactEmail ?? undefined,
    }));
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
  /** Live client roster used to resolve recipient chips. When omitted,
   *  falls back to MOCK_CLIENTS (legacy callers / design previews).
   *  Real-mode callers pass tRPC `clients.list().items` so chips reflect
   *  the firm's actual roster. */
  clientSource?: ReadonlyArray<ClientLike>;
  /** Optional — kept for callers that still pass it; the feed-card hover
   *  Send chip was retired in favor of the co-pilot pane's wired Send. */
  onComplete?: (id: string) => void;
}

export function StateAlertCard({
  a,
  variant = "feed",
  selected = false,
  handled = false,
  onSelect,
  clientSource,
  onComplete: _onComplete,
}: StateAlertCardProps) {
  const tone = TYPE_TONE[a.type];
  const affected = affectedClientsFor(a, clientSource);
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
          {/* Body / summary — falls back to a generated one-liner when
              the announcement has no human-authored summary (Yuqi
              2026-05-05: cards that arrived from the scraper without
              a body looked half-loaded — `${authority} published a
              ${type}` is a thin description but at least the row never
              renders empty). */}
          <p className="mt-2 text-sm text-ink-700 leading-snug line-clamp-2">
            {a.summary && a.summary.trim()
              ? a.summary
              : `${a.authority} published a ${TYPE_LABEL[a.type].toLowerCase()} for ${a.affectedClientIds.length} of your clients. Open the detail pane for the full text.`}
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
                  <ClientChip
                    key={c.id}
                    name={c.name}
                    href={`/clients/${c.id}`}
                  />
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

      {/* Zone 3 — primary action moved into the co-pilot pane on the
          right where the per-client draft preview, recipient toggles,
          and Edit/Refine controls live. The card itself is the entry
          point: click to select, then act in the pane. Removing the
          inline Send avoids two parallel send paths that were drifting
          out of sync (the inline one was toast-only). */}
    </div>
  );
}
