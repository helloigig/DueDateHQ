import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Forward,
  Mail,
  Megaphone,
  MoonStar,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { StateBadge } from "@/components/ui/StateBadge";
import { FilterChip } from "@/components/ui/FilterChip";
import { StateAlertCard } from "@/components/StateAlertCard";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { formatLongDate } from "@/data/dateHelpers";
import {
  useAnnouncements,
  useDismissAnnouncement,
} from "@/hooks/useAnnouncements";
import { clients as MOCK_CLIENTS } from "@/data/mockClients";
import type { Announcement } from "@/types";
import { cn } from "@/lib/utils";

/**
 * /alerts — the v0u differentiator surface, rendered exact to spec:
 *
 *   [56px rail] [center announcement feed] [440px AI co-pilot pane]
 *
 * Bypasses AppShell so the v0u layout owns the viewport. The 56px rail
 * carries the same nav targets as the AppShell sidebar (Today, Alerts,
 * Clients, etc.) so users never lose their wayfinding.
 *
 * URL contract:
 *   /alerts          → most-urgent alert pre-selected
 *   /alerts/:id      → that alert pre-selected (shareable deep link from
 *                      Today's StateAlertCard click target)
 */

// TYPE_LABEL / TYPE_TONE / timeAgoShort moved to <StateAlertCard>
// (single source of truth for the alert presentation). The CopilotPane
// header is now title-only (collapsed earlier per #12) so it doesn't
// need the type-pill metadata anymore.

function firstNameFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0];
  if (!local) return null;
  const first = local.split(/[._-]/)[0];
  if (!first || first.length < 2) return null;
  const roleAccounts = new Set([
    "ops", "info", "admin", "billing", "team", "office",
    "hello", "contact", "support", "help", "sales", "noreply",
    "no-reply", "accounts", "accounting", "finance", "ar", "ap",
  ]);
  if (roleAccounts.has(first.toLowerCase())) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

interface AffectedClient {
  id: string;
  name: string;
  email?: string;
}

function affectedClientsFor(a: Announcement): AffectedClient[] {
  const map = new Map(MOCK_CLIENTS.map((c) => [c.id, c]));
  return a.affectedClientIds
    .map((id) => map.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({ id: c.id, name: c.name, email: c.contactEmail }));
}

function draftSubject(a: Announcement, client: AffectedClient): string {
  if (a.type === "disaster_extension" && a.newDeadline) {
    return `${a.stateCode}: ${a.title} applies to your filing`;
  }
  if (a.newDeadline) return `${a.stateCode}: deadline shift for ${client.name}`;
  return `${a.stateCode} update — ${a.title}`;
}

function draftBody(a: Announcement, client: AffectedClient): string {
  const greet = firstNameFromEmail(client.email) ?? `${client.name} team`;
  if (a.newDeadline && a.oldDeadline) {
    return `Hi ${greet},

The ${a.authority} announced an extension this morning that applies to your filing. Your deadline has moved from ${formatLongDate(a.oldDeadline)} to ${formatLongDate(a.newDeadline)}.

You don't need to do anything — I've already updated our system. The official bulletin is here if you'd like to forward it: ${a.sourceUrl}

I'll be in touch closer to the new date.

Sarah`;
  }
  return `Hi ${greet},

A quick note: the ${a.authority} published an update — ${a.title}. ${a.summary}

I'll let you know if it changes anything on your end. Source: ${a.sourceUrl}

Sarah`;
}

// FeedCard extracted to <StateAlertCard variant="feed"> in
// src/components/StateAlertCard.tsx so the Dashboard preview surface
// can share the same presentation. See that file for the canonical
// implementation.

// ── Co-pilot pane ─────────────────────────────────────────────────────────

function ActionRow({
  icon,
  title,
  description,
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <article className="bg-surface border border-line rounded-md p-region flex items-start gap-3 hover:border-line-strong transition-colors">
      <span
        aria-hidden
        className="shrink-0 w-7 h-7 rounded-md bg-sunken text-ink-700 inline-flex items-center justify-center"
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-900 leading-snug">
          {title}
        </div>
        <div className="text-xs text-ink-700 mt-1 leading-snug">
          {description}
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onClick} className="shrink-0">
        {cta}
      </Button>
    </article>
  );
}

function CopilotPane({
  announcement,
  excludedClientIds,
  onToggleExclusion,
  onComplete,
  onClose,
}: {
  announcement: Announcement | null;
  excludedClientIds: Set<string>;
  onToggleExclusion: (clientId: string) => void;
  onComplete: (id: string) => void;
  onClose: () => void;
}) {
  const [draftIndex, setDraftIndex] = useState(0);

  useEffect(() => {
    setDraftIndex(0);
  }, [announcement?.id]);

  if (!announcement) {
    return (
      <aside className="w-pane shrink-0 bg-canvas border-l border-line flex flex-col items-center justify-center text-center px-region">
        <Sparkles className="w-8 h-8 text-ink-300 mb-3" aria-hidden />
        <div className="text-sm font-semibold text-ink-700">
          Pick an alert to see suggested actions
        </div>
        <div className="text-xs text-ink-500 mt-1 max-w-[220px]">
          DueDateHQ pre-drafts the work for each affected client — review and
          send.
        </div>
      </aside>
    );
  }

  const a = announcement;
  const allAffected = affectedClientsFor(a);
  const includedClients = allAffected.filter((c) => !excludedClientIds.has(c.id));
  const includedCount = includedClients.length;
  const excludedCount = allAffected.length - includedCount;
  const safeIdx = Math.min(draftIndex, Math.max(0, includedCount - 1));
  const currentClient = includedClients[safeIdx];
  const subject = currentClient ? draftSubject(a, currentClient) : "";
  const body = currentClient ? draftBody(a, currentClient) : "";

  return (
    <aside className="w-pane shrink-0 bg-canvas border-l border-line flex flex-col overflow-hidden">
      {/* ── Header zone: Context ─────────────────────────────────
          Collapsed to ONE line — the feed card is the summary, the
          pane is the detail. Re-rendering state + title + authority
          + type + count + deadline here was 100% redundant with the
          card the user just clicked. Pane header: state badge +
          title + close X. Everything else (full client list, email
          draft, action card) lives in the pane body. */}
      <div className="bg-surface border-b border-line px-region py-3 flex items-start gap-3">
        <StateBadge code={a.stateCode} />
        <div className="flex-1 min-w-0 text-sm font-semibold text-ink-900 leading-snug pt-0.5">
          {a.title}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
          aria-label="Close detail pane"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      {/* ── Body zone: Suggested actions ─────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-region pt-3 pb-2">
          <span className="text-2xs uppercase tracking-wider font-semibold text-ink-500">
            Suggested actions
          </span>
        </div>

        <div className="px-region pb-region flex flex-col gap-2">
          {/* Action 1 — primary. Three sub-zones in ONE card,
              separated by hairline dividers (no nested cards per
              DESIGN.md §Cards):
                (a) header — icon + title + Send CTA with live count
                (b) recipient list — chip list with X-to-exclude
                (c) email preview — subject + body + nav controls */}
          <article className="bg-surface border border-indigo-soft rounded-md overflow-hidden">
            <div className="flex items-start gap-3 p-region">
              <span
                aria-hidden
                className="shrink-0 w-7 h-7 rounded-md bg-indigo text-white inline-flex items-center justify-center"
              >
                <Mail className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink-900 leading-snug">
                  Draft {includedCount} client{" "}
                  {includedCount === 1 ? "email" : "emails"}
                </div>
                <div className="text-xs text-ink-700 mt-1 leading-snug">
                  Personalized for each affected client · references the{" "}
                  {a.authority} bulletin
                  {a.newDeadline &&
                    ` · explains the ${formatLongDate(a.newDeadline)} deadline`}
                </div>
              </div>
              <Button
                onClick={() => {
                  toast.success(
                    `Sent draft to ${includedCount} ${includedCount === 1 ? "client" : "clients"}`,
                  );
                  onComplete(a.id);
                }}
                disabled={includedCount === 0}
                className="shrink-0 bg-indigo hover:bg-indigo-hover text-surface disabled:opacity-40"
              >
                <Send aria-hidden />
                Send {includedCount}
              </Button>
            </div>

            {/* Recipient list — partial-selection control. Click a
                chip to exclude / include. The Send CTA above shows
                the live count. */}
            <div className="border-t border-line px-region py-2.5 bg-sunken/30">
              <div className="flex items-center justify-between mb-2 text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                <span>
                  Sending to{" "}
                  <span className="tabular-nums text-ink-900">{includedCount}</span>
                </span>
                {excludedCount > 0 && (
                  <span className="text-ink-400 normal-case tracking-normal text-xs font-normal">
                    {excludedCount} excluded
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {allAffected.map((c) => {
                  const isExcluded = excludedClientIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onToggleExclusion(c.id)}
                      className={cn(
                        "group inline-flex items-center gap-1 rounded-pill border text-xs px-2 py-0.5 transition-colors",
                        isExcluded
                          ? "border-line bg-transparent text-ink-400 line-through hover:border-line-strong hover:text-ink-700 hover:no-underline"
                          : "border-line bg-surface text-ink-700 hover:border-danger-border hover:text-danger-ink",
                      )}
                      title={
                        isExcluded
                          ? `Click to include ${c.name}`
                          : `Click to exclude ${c.name} from this send`
                      }
                    >
                      <span className="truncate max-w-[110px]">{c.name}</span>
                      <X
                        className={cn(
                          "w-2.5 h-2.5 transition-opacity",
                          isExcluded
                            ? "rotate-45 text-ink-400"
                            : "text-ink-400 opacity-0 group-hover:opacity-100",
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email preview — divider-separated sub-zone, NOT a
                nested card (DESIGN.md §Cards). Same surface, just a
                hairline border-t + sunken bg shift to read as a zone. */}
            {currentClient && includedCount > 0 && (
              <div className="border-t border-line bg-sunken/40 px-region py-3">
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <span className="text-ink-700 truncate flex-1">
                    To: {currentClient.email ?? currentClient.name}
                  </span>
                  <span className="text-ink-500 tabular-nums shrink-0">
                    Draft {safeIdx + 1} of {includedCount}
                  </span>
                </div>
                <div className="text-xs font-semibold text-ink-900 mb-1 leading-snug">
                  {subject}
                </div>
                <div className="text-xs text-ink-700 leading-snug whitespace-pre-line line-clamp-6">
                  {body}
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line/60">
                  <button
                    type="button"
                    onClick={() =>
                      toast.info(`Open editor for ${currentClient.name}`)
                    }
                    className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-ink-700 hover:bg-surface transition-colors"
                  >
                    <Pencil className="w-3 h-3" aria-hidden />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info("AI is refining the draft…")}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs text-ink-700 hover:bg-surface transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden />
                    Refine
                  </button>
                  <div className="ml-auto inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setDraftIndex((i) => Math.max(0, i - 1))}
                      disabled={safeIdx === 0}
                      className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-700 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Previous draft"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <span className="text-xs text-ink-500 tabular-nums px-1.5 min-w-[44px] text-center">
                      {safeIdx + 1} / {includedCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftIndex((i) => Math.min(includedCount - 1, i + 1))
                      }
                      disabled={safeIdx >= includedCount - 1}
                      className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-700 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Next draft"
                    >
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </article>

          {a.newDeadline && (
            <ActionRow
              icon={<CalendarClock className="w-3.5 h-3.5" aria-hidden />}
              title={`Apply new ${formatLongDate(a.newDeadline)} deadline`}
              description={`Move ${includedCount} affected ${includedCount === 1 ? "filing" : "filings"} · audit-trailed with the announcement source`}
              cta="Preview"
              onClick={() => {
                toast.success(
                  `${includedCount} deadlines moved to ${formatLongDate(a.newDeadline!)}`,
                );
                onComplete(a.id);
              }}
            />
          )}
          <ActionRow
            icon={<Forward className="w-3.5 h-3.5" aria-hidden />}
            title={`Forward ${a.authority} bulletin`}
            description={`Attaches the official URL · short cover note · ${includedCount} recipients`}
            cta="Preview"
            onClick={() => {
              toast.info(`Bulletin forward staged for ${includedCount} clients`);
              onComplete(a.id);
            }}
          />
        </div>
      </div>

      {/* ── Disposition zone — sticky footer ─────────────────────
          Pinned at the bottom of the pane (outside the scroll
          container) so escape hatches stay reachable regardless of
          how long the action list grows. Per DESIGN.md §Do's: "Keep
          escape hatches visible." */}
      <div className="border-t border-line bg-canvas px-region py-2">
        <div className="text-2xs uppercase tracking-wider font-semibold text-ink-400 mb-1.5">
          Disposition
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => {
              toast.success("Snoozed until tomorrow");
              onComplete(a.id);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 hover:bg-sunken transition-colors px-2 py-1 rounded"
          >
            <MoonStar className="w-3.5 h-3.5 text-ink-500" aria-hidden />
            Snooze until tomorrow
          </button>
          <span className="text-ink-300 mx-1" aria-hidden>·</span>
          <button
            type="button"
            onClick={() => {
              toast.info("Marked not applicable to your clients");
              onComplete(a.id);
            }}
            className="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 hover:bg-sunken transition-colors px-2 py-1 rounded"
          >
            Mark not applicable
          </button>
        </div>
      </div>

    </aside>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

type Tab = "affecting" | "all" | "resolved";

export function Alerts() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("affecting");

  const announcementsQuery = useAnnouncements();
  const announcements = announcementsQuery.data ?? [];
  const dismissMutation = useDismissAnnouncement();

  // Session-scoped state.
  // - handledIds: alerts the CPA has acted on this session (Send all,
  //   Apply deadline, Forward bulletin, Snooze, Mark not applicable).
  //   Used to fade the card and auto-advance to the next un-handled.
  // - excludedByAlert: per-alert set of client IDs the CPA has chosen
  //   NOT to include in batch actions (partial selection in pane).
  const [handledIds, setHandledIds] = useState<Set<string>>(new Set());
  const [excludedByAlert, setExcludedByAlert] = useState<
    Map<string, Set<string>>
  >(new Map());

  const filtered = useMemo(() => {
    if (tab === "all") return announcements.filter((a) => !a.dismissed);
    if (tab === "resolved") return announcements.filter((a) => a.dismissed);
    return announcements.filter(
      (a) => !a.dismissed && a.affectedClientIds.length > 0,
    );
  }, [announcements, tab]);

  const totals = useMemo(
    () => ({
      affecting: announcements.filter(
        (a) => !a.dismissed && a.affectedClientIds.length > 0,
      ).length,
      all: announcements.filter((a) => !a.dismissed).length,
      resolved: announcements.filter((a) => a.dismissed).length,
    }),
    [announcements],
  );

  // Selection: URL :id wins; otherwise default to first in the active tab.
  const selectedId = params.id ?? filtered[0]?.id ?? null;
  const selected = useMemo(
    () => announcements.find((a) => a.id === selectedId) ?? null,
    [announcements, selectedId],
  );

  // Auto-redirect /alerts/:id → /alerts when id doesn't match anything
  // (covers stale deep links). Safe — preserves the empty-state pane.
  useEffect(() => {
    if (params.id && !selected && !announcementsQuery.isLoading) {
      navigate("/alerts", { replace: true });
    }
  }, [params.id, selected, announcementsQuery.isLoading, navigate]);

  const handleSelect = (id: string) => {
    navigate(`/alerts/${id}`, { replace: true });
  };

  // Action complete (Send / Apply / Forward / Snooze / Mark NA):
  //   1) mark this alert handled so the feed card fades to opacity-60
  //      with a "Handled this session" chip — gap-loud is preserved
  //      (the CPA can re-open) but visually demoted on next scan.
  //   2) auto-advance to the next un-handled alert in the active tab
  //      so triage feels queue-like (forward, then loop back to before
  //      the current cursor if all "after" are done).
  const handleComplete = useCallback(
    (id: string) => {
      setHandledIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      const idx = filtered.findIndex((a) => a.id === id);
      if (idx < 0) return;
      const after = filtered
        .slice(idx + 1)
        .find((a) => !handledIds.has(a.id) && a.id !== id);
      const before = filtered
        .slice(0, idx)
        .reverse()
        .find((a) => !handledIds.has(a.id) && a.id !== id);
      const nextAlert = after ?? before;
      if (nextAlert) {
        navigate(`/alerts/${nextAlert.id}`, { replace: true });
      } else {
        navigate(`/alerts`, { replace: true });
      }
    },
    [filtered, handledIds, navigate],
  );

  const handleClearSelection = () => {
    navigate(`/alerts`, { replace: true });
  };

  const toggleClientExclusion = useCallback(
    (alertId: string, clientId: string) => {
      setExcludedByAlert((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(alertId) ?? []);
        if (set.has(clientId)) set.delete(clientId);
        else set.add(clientId);
        next.set(alertId, set);
        return next;
      });
    },
    [],
  );

  // Keep dismissMutation referenced — wired to be available when the
  // disposition's Mark-not-applicable graduates from session-only to
  // a real backend dismissal.
  void dismissMutation;

  return (
    <PageContainer variant="workshop">
      {/* ── Center feed ──────────────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col bg-canvas overflow-hidden">
        <div className="px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-region bg-surface border-b border-line sticky top-0 z-10">
          <PageHeader title="Alerts" meta={`${totals.all} active`} className="mb-2" />
          {/* Ambient monitoring line — v0u inheritance. Pulsing dot
              signals "we're watching" without nagging; the timestamp
              earns trust by being specific. Static "14m ago" until
              the scrape backend reports its own clock. */}
          <div className="mb-region flex items-center gap-2 text-xs text-ink-500">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-ok-solid animate-pulse"
              aria-hidden
            />
            <span>50 / 50 states monitored</span>
            <span className="text-ink-300" aria-hidden>·</span>
            <span className="tabular-nums">last scrape 14m ago</span>
          </div>
          <div className="flex items-center gap-1 border-b border-line -mb-region">
            <FilterChip
              variant="tab"
              active={tab === "affecting"}
              onClick={() => setTab("affecting")}
              count={totals.affecting}
            >
              Affecting you
            </FilterChip>
            <FilterChip
              variant="tab"
              active={tab === "all"}
              onClick={() => setTab("all")}
              count={totals.all}
            >
              All announcements
            </FilterChip>
            <FilterChip
              variant="tab"
              active={tab === "resolved"}
              onClick={() => setTab("resolved")}
              count={totals.resolved}
            >
              Resolved
            </FilterChip>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-region flex flex-col gap-card">
          {announcementsQuery.isLoading ? (
            <div className="text-center text-sm text-ink-500 py-12">
              Loading state alerts…
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface border border-line rounded-md px-6 py-12 text-center">
              <Megaphone
                className="w-6 h-6 text-ink-300 mx-auto mb-2"
                aria-hidden
              />
              <p className="text-sm font-semibold text-ink-700">
                {tab === "resolved"
                  ? "Nothing dismissed yet."
                  : "No state announcements affecting your clients."}
              </p>
              <p className="text-xs text-ink-500 mt-1">
                We check 50 state authorities every hour. You'll see anything
                relevant here.
              </p>
            </div>
          ) : (
            filtered.map((a) => (
              <StateAlertCard
                key={a.id}
                a={a}
                variant="feed"
                selected={a.id === selectedId}
                handled={handledIds.has(a.id)}
                onSelect={() => handleSelect(a.id)}
                onComplete={handleComplete}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Co-pilot pane ────────────────────────────────────────────── */}
      <CopilotPane
        announcement={selected}
        excludedClientIds={
          selected ? excludedByAlert.get(selected.id) ?? new Set() : new Set()
        }
        onToggleExclusion={(clientId) =>
          selected && toggleClientExclusion(selected.id, clientId)
        }
        onComplete={handleComplete}
        onClose={handleClearSelection}
      />
    </PageContainer>
  );
}

