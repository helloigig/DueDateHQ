import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bookmark,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Forward,
  Mail,
  Megaphone,
  MoonStar,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  formatLongDate,
  hoursSince,
} from "@/data/dateHelpers";
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

function clientInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

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

// ── Feed card ─────────────────────────────────────────────────────────────

function FeedCard({
  a,
  selected,
  onSelect,
}: {
  a: Announcement;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = TYPE_TONE[a.type];
  const affected = affectedClientsFor(a);
  const visibleChips = affected.slice(0, 5);
  const overflow = Math.max(0, affected.length - visibleChips.length);

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
        "block w-full text-left bg-surface border border-line rounded-md transition-colors cursor-pointer",
        "hover:border-line-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-900",
        selected && "border-indigo ring-2 ring-indigo-soft",
      )}
      aria-pressed={selected}
    >
      <div className="p-region flex items-start gap-3">
        <span
          aria-hidden
          className="shrink-0 w-9 h-9 rounded-md bg-sunken text-ink-900 inline-flex items-center justify-center text-xs font-bold tracking-wide"
        >
          {a.stateCode}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-500 mb-1">
            <StatusPill variant={tone} size="xs">
              {TYPE_LABEL[a.type]}
            </StatusPill>
            <span className="font-medium text-ink-700 truncate">
              {a.authority}
            </span>
            <span className="text-ink-300">·</span>
            <span className="tabular-nums">{timeAgoShort(a.detectedAt)}</span>
          </div>
          <h3 className="text-base font-semibold text-ink-900 leading-snug">
            {a.title}
          </h3>
          <p className="mt-1 text-sm text-ink-700 leading-snug line-clamp-2">
            {a.summary}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-ink-700">
            <span className="font-semibold text-ink-900 tabular-nums">
              {a.affectedClientIds.length}{" "}
              {a.affectedClientIds.length === 1 ? "client" : "clients"}
            </span>
            <span className="text-ink-400">·</span>
            {a.newDeadline ? (
              <span>
                deadline shifts to{" "}
                <span className="font-medium text-ink-900">
                  {formatLongDate(a.newDeadline)}
                </span>
              </span>
            ) : (
              <span>{a.taxTypes[0] ?? "filing rule change"}</span>
            )}
          </div>
          {visibleChips.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {visibleChips.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-pill bg-sunken text-ink-700 text-xs"
                  title={c.name}
                >
                  <span
                    aria-hidden
                    className="w-4 h-4 rounded-pill bg-ink-700 text-surface text-[9px] font-bold inline-flex items-center justify-center"
                  >
                    {clientInitials(c.name)}
                  </span>
                  <span className="truncate max-w-[120px]">{c.name}</span>
                </span>
              ))}
              {overflow > 0 && (
                <span className="text-xs text-ink-500 px-1.5 tabular-nums">
                  +{overflow} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
            aria-label="Bookmark"
          >
            <Bookmark className="w-3.5 h-3.5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 inline-flex items-center justify-center rounded text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
            aria-label="More"
          >
            <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

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
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 inline-flex items-center h-7 px-3 rounded-pill text-xs font-medium bg-surface border border-line text-ink-700 hover:bg-sunken hover:border-line-strong transition-colors"
      >
        {cta}
      </button>
    </article>
  );
}

function CopilotPane({
  announcement,
  onClose,
}: {
  announcement: Announcement | null;
  onClose: () => void;
}) {
  const [draftIndex, setDraftIndex] = useState(0);
  const [composer, setComposer] = useState("");

  useEffect(() => {
    setDraftIndex(0);
    setComposer("");
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
  const affected = affectedClientsFor(a);
  const clientCount = affected.length;
  const currentClient = affected[draftIndex];
  const subject = currentClient ? draftSubject(a, currentClient) : "";
  const body = currentClient ? draftBody(a, currentClient) : "";

  return (
    <aside className="w-pane shrink-0 bg-canvas border-l border-line flex flex-col overflow-hidden">
      {/* Header — context strip */}
      <div className="px-region py-3 bg-surface border-b border-line">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="shrink-0 w-9 h-9 rounded-md bg-sunken text-ink-900 inline-flex items-center justify-center text-xs font-bold"
          >
            {a.stateCode}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink-900 leading-snug">
              {a.title}
            </div>
            <div className="text-xs text-ink-500 mt-0.5">{a.authority}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-ink-500 hover:bg-sunken hover:text-ink-900 transition-colors"
            aria-label="Clear selection"
          >
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <StatusPill variant={TYPE_TONE[a.type]} size="xs">
            {TYPE_LABEL[a.type]}
          </StatusPill>
          <span className="text-xs text-ink-700 font-medium tabular-nums">
            {clientCount} {clientCount === 1 ? "client" : "clients"} affected
          </span>
          {a.newDeadline && (
            <>
              <span className="text-ink-300 text-xs">·</span>
              <span className="text-xs text-ink-700">
                new deadline{" "}
                <span className="font-semibold text-ink-900">
                  {formatLongDate(a.newDeadline)}
                </span>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Body — actions + email preview */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-region py-3 flex items-center gap-2">
          <span className="text-2xs uppercase tracking-wider font-semibold text-indigo-ink inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" aria-hidden />
            AI suggested actions
          </span>
          <span className="text-xs text-ink-500 ml-auto">
            {a.newDeadline ? "4" : "3"} ready
          </span>
        </div>

        <div className="px-region pb-region flex flex-col gap-2">
          {/* Action 1 — primary, expanded with email preview */}
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
                  Draft {clientCount} client{" "}
                  {clientCount === 1 ? "email" : "emails"}
                </div>
                <div className="text-xs text-ink-700 mt-1 leading-snug">
                  Personalized for each affected client · references the{" "}
                  {a.authority} bulletin
                  {a.newDeadline &&
                    ` · explains the ${formatLongDate(a.newDeadline)} deadline`}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  toast.success(
                    `Sent draft to ${clientCount} ${clientCount === 1 ? "client" : "clients"}`,
                  )
                }
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-pill text-xs font-semibold bg-indigo text-white hover:bg-indigo-hover transition-colors"
              >
                <Send className="w-3 h-3" aria-hidden />
                Send all
              </button>
            </div>

            {currentClient && (
              <div className="mx-region mb-region bg-sunken/50 border border-line rounded-md p-3">
                <div className="flex items-center gap-2 mb-2 text-2xs uppercase tracking-wider font-semibold text-ink-500">
                  <span className="bg-indigo-soft text-indigo-ink px-1.5 py-0.5 rounded text-[10px] font-bold">
                    Preview {draftIndex + 1} of {clientCount}
                  </span>
                  <span className="text-ink-500 normal-case tracking-normal text-xs font-normal truncate">
                    To: {currentClient.email ?? currentClient.name}
                  </span>
                </div>
                <div className="text-xs font-semibold text-ink-900 mb-1 leading-snug">
                  {subject}
                </div>
                <div className="text-xs text-ink-700 leading-snug whitespace-pre-line line-clamp-6">
                  {body}
                </div>
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line">
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
                      disabled={draftIndex === 0}
                      className="w-6 h-6 inline-flex items-center justify-center rounded text-ink-700 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent"
                      aria-label="Previous draft"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <span className="text-xs text-ink-500 tabular-nums px-1.5 min-w-[44px] text-center">
                      {draftIndex + 1} / {clientCount}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftIndex((i) => Math.min(clientCount - 1, i + 1))
                      }
                      disabled={draftIndex === clientCount - 1}
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
              description={`Move ${clientCount} affected ${clientCount === 1 ? "filing" : "filings"} · audit-trailed with the announcement source`}
              cta="Preview"
              onClick={() =>
                toast.success(
                  `${clientCount} deadlines moved to ${formatLongDate(a.newDeadline!)}`,
                )
              }
            />
          )}
          <ActionRow
            icon={<Forward className="w-3.5 h-3.5" aria-hidden />}
            title={`Forward ${a.authority} bulletin`}
            description={`Attaches the official URL · short cover note · ${clientCount} recipients`}
            cta="Preview"
            onClick={() =>
              toast.info(`Bulletin forward staged for ${clientCount} clients`)
            }
          />
          <ActionRow
            icon={<MoonStar className="w-3.5 h-3.5" aria-hidden />}
            title="Snooze until tomorrow"
            description="Reminders pause; alert reappears on next page load if unresolved"
            cta="Snooze"
            onClick={() => {
              toast.success("Snoozed until tomorrow");
              onClose();
            }}
          />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-line bg-sunken/30 p-region">
        <div className="bg-surface border border-line-strong rounded-md p-2.5 focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo-soft transition-colors">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              placeholder="Ask about this announcement, or refine an action…"
              className="flex-1 resize-none bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none min-h-[22px] max-h-[100px]"
            />
            <button
              type="button"
              onClick={() => {
                if (!composer.trim()) return;
                toast.success("AI is thinking…");
                setComposer("");
              }}
              disabled={!composer.trim()}
              className={cn(
                "shrink-0 w-7 h-7 inline-flex items-center justify-center rounded text-white transition-colors",
                composer.trim()
                  ? "bg-indigo hover:bg-indigo-hover"
                  : "bg-ink-300 cursor-not-allowed",
              )}
              aria-label="Send refinement"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {(a.type === "disaster_extension"
            ? ["Which counties qualify?", "Make emails warmer", "What if a client opts out?"]
            : ["Make emails warmer", "Suggest follow-up cadence", "Skip non-applicable clients"]
          ).map((hint) => (
            <button
              key={hint}
              type="button"
              onClick={() => setComposer(hint)}
              className="text-xs text-ink-700 bg-surface border border-line hover:border-line-strong hover:bg-sunken px-2.5 py-1 rounded-pill transition-colors"
            >
              {hint}
            </button>
          ))}
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
  const handleClearSelection = () => {
    navigate(`/alerts`, { replace: true });
    dismissMutation.mutate({ id: selectedId! });
  };

  return (
    <div className="flex h-full bg-canvas overflow-hidden text-ink-900">
      {/* ── Center feed ──────────────────────────────────────────────── */}
      <section className="flex-1 min-w-0 flex flex-col bg-canvas overflow-hidden">
        <header className="bg-surface border-b border-line px-6 pt-4 pb-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-ink-900 leading-tight">
              State alerts
            </h1>
            {totals.affecting > 0 && (
              <span className="bg-danger-solid text-white text-2xs font-bold px-2 py-0.5 rounded-pill leading-none">
                {totals.affecting} affecting you
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-500">
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 bg-ok-solid rounded-pill"
            />
            50 / 50 states monitored · last scrape 14m ago
          </div>
          <div className="mt-3 flex items-center gap-1 -mb-px">
            <TabButton
              active={tab === "affecting"}
              onClick={() => setTab("affecting")}
              count={totals.affecting}
            >
              Affecting you
            </TabButton>
            <TabButton
              active={tab === "all"}
              onClick={() => setTab("all")}
              count={totals.all}
            >
              All announcements
            </TabButton>
            <TabButton
              active={tab === "resolved"}
              onClick={() => setTab("resolved")}
              count={totals.resolved}
            >
              Resolved
            </TabButton>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
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
              <FeedCard
                key={a.id}
                a={a}
                selected={a.id === selectedId}
                onSelect={() => handleSelect(a.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* ── Co-pilot pane ────────────────────────────────────────────── */}
      <CopilotPane
        announcement={selected}
        onClose={handleClearSelection}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 -mb-px border-b-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
        active
          ? "border-ink-900 text-ink-900 font-semibold"
          : "border-transparent text-ink-500 hover:text-ink-900",
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "text-2xs font-semibold px-1.5 rounded tabular-nums",
            active ? "bg-ink-900 text-surface" : "bg-sunken text-ink-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
