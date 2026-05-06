import {
  CalendarClock,
  Check,
  ChevronRight,
  Forward,
  Mail,
  MoonStar,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatusPill } from "@/components/ui/StatusPill";
import { StateBadgeArt } from "@/components/ui/StateBadgeArt";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/button";
import { formatLongDate, hoursSince } from "@/data/dateHelpers";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import { TOPIC_LABEL, TOPIC_TONE } from "@/data/announcementLabels";
import type { Announcement } from "@/types";
import { cn } from "@/lib/utils";

type ClientLike = {
  id: string;
  name: string;
  contactEmail?: string | null;
};

/**
 * StateAlertCard — the canonical alert presentation. Single source of
 * truth across /alerts (variant="feed") and Today's state-alert section
 * (variant="today"). One pattern, two readings.
 *
 * Variants:
 *   - "feed"    — full workshop card. Click selects (left pane). Used by
 *                 /alerts; the right co-pilot pane carries the actions.
 *   - "today"   — Today's state-alert band. Same body as feed, plus an
 *                 inline action footer (Review draft / Apply new
 *                 deadline / Forward / Snooze) because Today has no
 *                 co-pilot pane to host actions.
 *
 * Yuqi audit 2026-05-06: the third "preview" variant (used by an early
 * Dashboard mock that no longer exists) was retired. It was a footerless
 * version of "today" that meant the user couldn't tell at a glance what
 * actions were available without clicking through. Dashboard now uses a
 * separate `StateAlertsPreview` component for its compact surface.
 */

// TOPIC_LABEL + TYPE_TONE moved to `data/announcementLabels.ts` as
// TOPIC_LABEL / TOPIC_TONE so the Today card, /alerts feed card, and
// /alerts detail pane share one source. The prior local copy here
// drifted out of sync — the detail pane used a neutral pill, the card
// used info blue, and the same "Penalty relief" label looked like two
// different concepts to the user.

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
  variant?: "feed" | "today";
  /** Selected ring (feed variant only). */
  selected?: boolean;
  /** Faded "handled this session" treatment (feed variant only). */
  handled?: boolean;
  /** Click handler — feed: select the card; preview/today: navigate to /alerts/:id. */
  onSelect: () => void;
  /** Snooze handler — only rendered when variant="today" (Today owns the
   *  action footer; /alerts variants delegate to the co-pilot pane). */
  onSnooze?: () => void;
  /** Live client roster used to resolve recipient chips. When omitted,
   *  falls back to MOCK_CLIENTS (legacy callers / design previews).
   *  Real-mode callers pass tRPC `clients.list().items` so chips reflect
   *  the firm's actual roster. Ignored when `affectedClients` is set. */
  clientSource?: ReadonlyArray<ClientLike>;
  /** Pre-resolved affected client list — overrides internal resolution.
   *  Today passes this directly so it can join with its already-fetched
   *  client roster without re-resolving. */
  affectedClients?: ReadonlyArray<AffectedClient>;
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
  onSnooze,
  clientSource,
  affectedClients,
  onComplete: _onComplete,
}: StateAlertCardProps) {
  const tone = TOPIC_TONE[a.type];
  const affected = affectedClients ?? affectedClientsFor(a, clientSource);
  const visibleChips = affected.slice(0, 5);
  const overflow = Math.max(0, affected.length - visibleChips.length);
  const isFeed = variant === "feed";
  const isToday = variant === "today";
  const affectedCount = a.affectedClientIds.length;

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
        // Q3: hover communicates via subtle elevation instead of darker
        // border. Soft pop shadow + faint sunken tint feels lifted
        // without raising the chrome's loudness.
        "hover:shadow-pop hover:border-line",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900",
        isFeed && selected && !handled && "border-indigo ring-2 ring-indigo-soft",
        handled && "opacity-60 hover:opacity-95",
      )}
      aria-pressed={isFeed ? selected : undefined}
    >
      {/* ── Zone 1 — what just happened ───────────────────────── */}
      <div className="p-region flex items-start gap-3">
        <StateBadgeArt code={a.stateCode} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-ink-900 leading-snug">
            {a.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
            <span className="truncate flex-1 min-w-0">{a.authority}</span>
            <StatusPill variant={tone} size="xs" className="shrink-0">
              {TOPIC_LABEL[a.type]}
            </StatusPill>
            <span className="tabular-nums shrink-0 text-ink-400">
              {timeAgoShort(a.detectedAt)}
            </span>
          </div>
          {/* Body / summary — falls back to a generated one-liner when
              the announcement has no human-authored summary. Yuqi
              2026-05-06: feed cards truncate to ONE line; the full
              text lives in the right co-pilot pane (AlertContextSection).
              The card is a scan-row, not a reader. */}
          <p className="mt-2 text-sm text-ink-700 leading-snug line-clamp-1">
            {a.summary && a.summary.trim()
              ? a.summary
              : `${a.authority} published a ${TOPIC_LABEL[a.type].toLowerCase()} for ${a.affectedClientIds.length} of your clients. Open the detail pane for the full text.`}
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
                  <AffectedClientChip
                    key={c.id}
                    client={c}
                    fromAlertId={a.id}
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

      {/* ── Zone 3 — actions ──────────────────────────────────────
          feed/preview: action footer hidden — /alerts owns the action
          surface in the right co-pilot pane; preview lets the user
          click through to it. today: rendered inline because Today has
          no co-pilot pane and the action would otherwise be an extra
          click away through /alerts. */}
      {isToday && (
        <div
          className="border-t border-dashed border-line px-region pt-3 pb-3 flex items-center gap-2 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-micro uppercase tracking-wider font-semibold text-indigo-ink inline-flex items-center gap-1">
            <Sparkles aria-hidden />
            AI suggested
          </span>
          <Button
            size="sm"
            onClick={onSelect}
            className="bg-indigo hover:bg-indigo-hover text-surface"
          >
            <Mail aria-hidden />
            Review draft for {affectedCount}{" "}
            {affectedCount === 1 ? "client" : "clients"}
            <ChevronRight aria-hidden />
          </Button>
          {a.newDeadline && (
            <Button size="sm" variant="outline" onClick={onSelect}>
              <CalendarClock aria-hidden />
              Apply new deadline
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onSelect}>
            <Forward aria-hidden />
            Forward bulletin
          </Button>
          {onSnooze && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onSnooze}
              aria-label="Snooze until tomorrow"
              className="ml-auto"
            >
              <MoonStar aria-hidden />
              Snooze
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * AffectedClientChip — framed avatar + name pill specific to the alert
 * "Affects N clients" zone. We deliberately don't reuse `ClientChip` here
 * because that primitive is hardlined "no avatars" — it lives in dense
 * rosters where avatars create visual noise. The alert card's affected-
 * clients zone is a different context: a small set of high-attention
 * names, where the avatar carries a "this is a specific client, click
 * through" affordance. Keeping the primitive split preserves the
 * ClientChip contract while giving this surface its own framed shape.
 */
function AffectedClientChip({
  client,
  fromAlertId,
}: {
  client: AffectedClient;
  fromAlertId?: string;
}) {
  const firstLetter = (client.name.trim()[0] ?? "?").toUpperCase();
  // Carry the alert id along so ClientDetail can render a "Back to
  // alert" reverse link in its header. Avoids the dead-end where the
  // user clicks a chip from /alerts/:id, lands on /clients/:id, and
  // has no way back without browser back.
  const to = fromAlertId
    ? `/clients/${client.id}?fromAlert=${fromAlertId}`
    : `/clients/${client.id}`;
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-pill border border-line bg-surface hover:bg-sunken hover:border-line-strong transition-colors min-w-0 max-w-full"
      onClick={(e) => e.stopPropagation()}
      title={client.name}
    >
      <Avatar size="xs" tone="neutral" initials={firstLetter} name={client.name} />
      <span className="text-xs font-medium text-ink-900 truncate">
        {client.name}
      </span>
    </Link>
  );
}
