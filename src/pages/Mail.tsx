import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Inbox as InboxIcon,
  Send,
  FileEdit,
  AlertTriangle,
  Mail as MailIcon,
  Check,
  Link2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import { PageHeader } from "../components/ui/PageHeader";

// Mail surface — thread context for inbound + outbound communication.
// Tabs: Inbox / Outbox / Drafts / Issues.
//
// The "Reminders Out / Awaiting client reply" header section was removed
// 2026-05-06: it duplicated Today's Action Queue + ChaseBanner (the
// daily-action chase surface). Mail's job is thread context, not a
// second daily-action page. Per-thread "Open task" deep-links carry
// the bridge to the task surface.
//
// Wired to live BE: Inbox tab → trpc.inboundReplies.list (Method A SES
// forward + Method B Gmail/Outlook OAuth pull both write here). Issues
// tab → trpc.deliveryEvents.issues (bounce/complaint/unsubscribe).
// Falls back to static mocks when BE returns empty (fresh firms).

type Tab = "inbox" | "outbox" | "drafts" | "issues";

const INBOX_MOCK: InboxRow[] = [
  {
    intent: "timeline_pushback",
    client: "Mark Sullivan",
    task: "1040 (extension)",
    preview: "Hi Sarah — my K-1 from the partnership won't be ready until late July...",
    receivedHoursAgo: 3,
  },
  {
    intent: "question_asked",
    client: "Mark Sullivan",
    task: "1040 (extension)",
    preview: "Quick question — what's the IRA contribution limit this year?",
    receivedHoursAgo: 7,
  },
  {
    intent: "document_provided",
    client: "Olivia Bennett",
    task: "Q2 estimate (federal)",
    preview: "Attached: W-2 for 2025 (ADP via Acme Corp)",
    receivedHoursAgo: 14,
  },
];

type InboxRow = {
  /** inbound_replies row id — present for live BE rows; undefined for the
   *  static demo mock fallback (then per-row actions stay disabled). */
  id?: string;
  intent: string;
  client: string;
  task: string;
  preview: string;
  receivedHoursAgo: number;
  taskId?: string;
  clientId?: string;
};

function hoursAgo(iso: string | Date): number {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return Math.max(0, Math.floor((Date.now() - t) / (60 * 60 * 1000)));
}

export function Mail() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("inbox");
  const inboxQuery = trpc.inboundReplies.list.useQuery({ limit: 50 });
  const issuesQuery = trpc.deliveryEvents.issues.useQuery({ limit: 50 });
  const utils = trpc.useUtils();
  const markActionedMutation = trpc.inboundReplies.markActioned.useMutation({
    onSuccess: () => {
      void utils.inboundReplies.list.invalidate();
    },
  });
  const linkToTaskMutation = trpc.inboundReplies.linkToTask.useMutation({
    onSuccess: () => {
      void utils.inboundReplies.list.invalidate();
    },
  });
  // Reply currently selected for "Link to task" picker (null = closed).
  const [linking, setLinking] = useState<InboxRow | null>(null);

  // Map raw inbound_replies rows to the display shape. Without a join to
  // tasks/clients (held off to keep the router stateless), best-effort
  // identifiers: from-address as client, subject (or short body) as task.
  // Polish: add joined fields in a router follow-up to surface real names.
  const liveInbox: InboxRow[] = (inboxQuery.data ?? []).map((r) => {
    // Older FE router types may not yet declare `clientId` on the row;
    // it's added by the BE join in the inboundReplies router. Read
    // through index access so the build doesn't fail before the type
    // sync.
    const rWithClient = r as typeof r & { clientId?: string | null };
    return {
      id: r.id,
      intent: r.replyIntent ?? r.topLevelClass ?? "unknown",
      client: r.fromAddress.split("@")[0] ?? r.fromAddress,
      task:
        r.subject?.slice(0, 40) ?? (r.taskId ? "(linked task)" : "(unmatched)"),
      preview: (r.bodyText ?? r.subject ?? "(no body)").slice(0, 100),
      receivedHoursAgo: hoursAgo(r.receivedAt),
      taskId: r.taskId ?? undefined,
      clientId: rWithClient.clientId ?? undefined,
    };
  });
  // Same rule as Timeline / ActionQueue: in real mode, an empty BE renders
  // an empty state — never substitute INBOX_MOCK, which produces fake
  // client names the user can't act on.
  const inbox =
    liveInbox.length > 0
      ? liveInbox
      : env.useMockData
        ? INBOX_MOCK
        : [];
  const inboxCount = inbox.length;

  // Reminders Out / Awaiting client reply — section removed 2026-05-06.
  // Today's Action Queue + ChaseBanner own the chase surface; surfacing
  // the same data here as a "loud peach gradient" header just made Mail
  // feel like a second daily-action page. Mail's job is thread context
  // for inbound/outbound. The Inbox tab + per-thread "Open task" link
  // carries everything the CPA needs from this surface.

  // Mail Issues — bounces/complaints/unsubscribes joined with email_drafts.
  const issuesCount = (issuesQuery.data ?? []).length;

  return (
    <div className="max-w-[840px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      {/* PageHeader's `mb-card` already gives the subtitle enough air;
          using a negative `-mt-section` on top of that pulled the
          description up over the title text. Use the page header's
          natural flow + a `mb-card` on the description for stable
          spacing. */}
      <PageHeader
        title={
          <>
            <MailIcon className="inline w-5 h-5 mr-2 -mt-0.5" aria-hidden />
            Mail
          </>
        }
        className="mb-2"
      />
      <p className="text-sm text-ink-500 mb-card">
        Cross-client communication — AI classifies inbound; bytes stay in your
        email account.
      </p>

      {/* Tabs — Inbox / Outbox / Drafts / Issues.
          Counts: Inbox + Issues are LIVE (BE returns the row set we
          render); Outbox + Drafts are intentionally count-less until
          the firm-wide `emails.listSent` / `emails.listDrafts` BE
          procedures land. We previously hardcoded 47/12 which was
          mock-only — even on a fresh real-mode firm with zero sent
          mail, those badges lit up. Quiet `—` is honest. */}
      <div className="border-b border-line mb-3 flex items-center gap-1" role="tablist">
        {(
          [
            { id: "inbox" as Tab, label: "Inbox", Icon: InboxIcon, count: inboxCount, countLive: true },
            { id: "outbox" as Tab, label: "Outbox", Icon: Send, count: 0, countLive: false },
            { id: "drafts" as Tab, label: "Drafts", Icon: FileEdit, count: 0, countLive: false },
            { id: "issues" as Tab, label: "Issues", Icon: AlertTriangle, count: issuesCount, countLive: true },
          ] as const
        ).map(({ id, label, Icon, count, countLive }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-2 px-3 py-2 text-sm rounded-t -mb-px border-b-[1.5px] ${
              tab === id
                ? "border-ink-900 text-ink-900 font-medium"
                : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden />
            <span>{label}</span>
            {countLive && count > 0 && (
              <span className="text-2xs tabular-nums text-ink-400">({count})</span>
            )}
          </button>
        ))}
      </div>

      {tab === "inbox" && (
        <div className="space-y-2">
          <p className="text-2xs text-ink-400 mb-2 flex items-center gap-2">
            Sorted: pushback + questions first (need your reply) → documents (need
            your confirm) → off-topic last.
            <span className="ml-auto italic">
              {inboxQuery.isLoading
                ? "loading inbound classifier feed"
                : inboxQuery.error
                  ? "couldn't load inbox — try refresh"
                  : liveInbox.length > 0
                    ? `${liveInbox.length} new inbound item${liveInbox.length === 1 ? "" : "s"}`
                    : env.useMockData
                      ? "showing example data (mock mode)"
                      : "no inbound mail yet"}
            </span>
          </p>
          {/* Thread cluster counts — when one client sends multiple
              messages, surface "+N more from this client" on the FIRST
              message in the cluster so the user knows the conversation
              is multi-message. Yuqi audit 2026-05-05: previously each
              message read as standalone, hiding the back-and-forth. */}
          {(() => null)()}
          {inbox.map((m, i) => {
            // Count messages from the same client (by clientId when
            // available, by display name as a fallback for unmatched).
            const clusterKey = m.clientId ?? m.client;
            const clusterCount = inbox.filter(
              (x) => (x.clientId ?? x.client) === clusterKey,
            ).length;
            // Mark only the FIRST occurrence of each cluster — later
            // messages get a smaller "↳ same thread" line so the
            // hierarchy reads at a glance.
            const isFirstInCluster =
              inbox.findIndex(
                (x) => (x.clientId ?? x.client) === clusterKey,
              ) === i;
            const canOpenTask = Boolean(m.taskId);
            const hasActions = Boolean(m.id);
            const onClick = () => {
              if (m.taskId && m.clientId) {
                navigate(`/clients/${m.clientId}?task=${m.taskId}`);
              } else if (m.clientId) {
                navigate(`/clients/${m.clientId}`);
              } else {
                // Unmatched inbound — no task / client linkage yet (Method
                // A AI hasn't routed it). Best we can offer is the
                // mailbox-wide context.
              }
            };
            const onMarkActioned = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (!m.id) return;
              markActionedMutation.mutate(
                { id: m.id },
                {
                  onSuccess: () => {
                    toast.success("Marked actioned");
                  },
                  onError: (err) => {
                    toast.error(`Couldn't mark — ${err.message.slice(0, 80)}`);
                  },
                },
              );
            };
            const onOpenLinkPicker = (e: React.MouseEvent) => {
              e.stopPropagation();
              setLinking(m);
            };
            return (
              <article
                key={m.id ?? i}
                role="button"
                tabIndex={canOpenTask || m.clientId ? 0 : -1}
                onClick={onClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                  }
                }}
                className={`rounded-md border border-line bg-surface p-3 hover:bg-sunken/40 ${
                  canOpenTask || m.clientId
                    ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                    : "cursor-default opacity-90"
                }`}
                aria-label={
                  canOpenTask
                    ? `Open task for ${m.client}`
                    : `Inbound from ${m.client} (unmatched)`
                }
              >
                <header className="flex items-center gap-2 mb-1.5">
                  <IntentBadge intent={m.intent} />
                  <span className="font-medium text-ink-900 text-sm">{m.client}</span>
                  <span className="text-ink-300 text-xs">·</span>
                  <span className="text-ink-600 text-xs">{m.task}</span>
                  {clusterCount > 1 && isFirstInCluster && (
                    <span
                      className="text-2xs px-1.5 py-0.5 rounded bg-info-bg/60 text-info-ink border border-info-border"
                      title={`${clusterCount - 1} other ${clusterCount === 2 ? "message" : "messages"} from this client below`}
                    >
                      thread · {clusterCount}
                    </span>
                  )}
                  {clusterCount > 1 && !isFirstInCluster && (
                    <span
                      className="text-2xs text-ink-400"
                      title="Same thread as the message above"
                    >
                      ↳ same thread
                    </span>
                  )}
                  <span className="ml-auto text-2xs text-ink-400 tabular-nums">
                    {m.receivedHoursAgo}h ago
                  </span>
                </header>
                <p className="text-sm text-ink-700 line-clamp-1">{m.preview}</p>
                {hasActions && (
                  <footer className="mt-2 flex items-center gap-2 pt-2 border-t border-line/60">
                    <button
                      type="button"
                      onClick={onOpenLinkPicker}
                      className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken"
                      aria-label="Link this reply to a task"
                    >
                      <Link2 className="w-3 h-3" aria-hidden />
                      {m.taskId ? "Re-link" : "Link to task"}
                    </button>
                    <button
                      type="button"
                      onClick={onMarkActioned}
                      disabled={markActionedMutation.isPending}
                      className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-50"
                      aria-label="Mark this reply as actioned"
                    >
                      <Check className="w-3 h-3" aria-hidden />
                      Mark actioned
                    </button>
                    {/* Explicit Open-task affordance — row click already
                        navigates, but the implicit click was an
                        invisible affordance per Yuqi audit 2026-05-05.
                        Surfaced as a real button so the path is
                        discoverable and keyboard-reachable. */}
                    {m.taskId && m.clientId && (
                      <Link
                        to={`/clients/${m.clientId}?task=${m.taskId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded border border-line text-info-ink hover:bg-info-bg/60"
                        aria-label="Open the task this reply belongs to"
                      >
                        Open task →
                      </Link>
                    )}
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === "outbox" && <PlaceholderTab label="Outbox — sent reminders, last 30 days" />}
      {tab === "drafts" && <PlaceholderTab label="Drafts — AI-prepared emails awaiting review" />}
      {tab === "issues" && (
        <div className="space-y-2">
          <p className="text-2xs text-ink-400 mb-2 flex items-center gap-2">
            Bounced / complained / unsubscribed — fix the address or suppress.
            <span className="ml-auto italic">
              {issuesQuery.isLoading
                ? "loading delivery events feed"
                : (issuesQuery.data?.length ?? 0) > 0
                  ? `live delivery feed · ${issuesQuery.data?.length} issues from BE`
                  : "fallback placeholder (no delivery events yet)"}
            </span>
          </p>
          {(issuesQuery.data ?? []).length === 0 ? (
            <PlaceholderTab label="Issues — no bounces or complaints yet" />
          ) : (
            (issuesQuery.data ?? []).map((row, i) => (
              <article
                key={i}
                className="rounded-md border border-danger-border bg-danger-bg/20 p-3"
              >
                <header className="flex items-center gap-2 mb-1.5">
                  <IntentBadge intent={row.ev.eventType} />
                  <span className="font-medium text-ink-900 text-sm">
                    {row.draft.subject ?? "(no subject)"}
                  </span>
                  <span className="ml-auto text-2xs text-ink-400 tabular-nums">
                    {hoursAgo(row.ev.eventAt)}h ago
                  </span>
                </header>
                {row.ev.bounceReason && (
                  <p className="text-2xs text-ink-500">
                    Reason: <span className="text-danger-ink">{row.ev.bounceReason}</span>
                    {row.ev.diagnosticText && (
                      <span className="text-ink-400"> · {row.ev.diagnosticText.slice(0, 80)}</span>
                    )}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      )}

      <p className="mt-6 text-2xs text-ink-400 leading-relaxed">
        Inbound flows through <Link to="/settings/integrations" className="underline">per-task forwarding</Link> and{" "}
        <Link to="/settings/integrations" className="underline">Gmail / Outlook OAuth</Link>.
        AI classifies into 7 classes (client doc / client reply / agency /
        3rd-party data / payment / vendor / spam) and routes to the right
        client × task. Bytes stay in your email; we hold extracted text + facts
        + thumbnails. Outbox + Drafts views light up once{" "}
        <code>emails.listSent</code> + <code>emails.listDrafts</code> are wired.
      </p>

      {linking && (
        <TaskPicker
          row={linking}
          isLinking={linkToTaskMutation.isPending}
          onClose={() => setLinking(null)}
          onPick={(taskId) => {
            if (!linking.id) return;
            linkToTaskMutation.mutate(
              { id: linking.id, taskId },
              {
                onSuccess: () => {
                  toast.success("Linked to task");
                  setLinking(null);
                },
                onError: (err) => {
                  toast.error(`Couldn't link — ${err.message.slice(0, 80)}`);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}

/**
 * Task picker modal — searchable list of (client, task) pairs the CPA
 * can link an inbound reply to. Used when Method A's classifier didn't
 * route an inbound, or when the reply belongs on a different task than
 * the one auto-linked.
 *
 * Wired to live BE: pulls clients via clients.list and tasks via
 * tasks.list. Filters by free-text against client name + form type.
 */
function TaskPicker({
  row,
  isLinking,
  onClose,
  onPick,
}: {
  row: InboxRow;
  isLinking: boolean;
  onClose: () => void;
  onPick: (taskId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const clientsQuery = trpc.clients.list.useQuery({});
  const tasksQuery = trpc.tasks.list.useQuery();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  type ClientLite = { id: string; name: string };
  type TaskLite = { id: string; clientId: string; formType: string; jurisdiction: string };

  const clients = useMemo<ClientLite[]>(() => {
    const data = clientsQuery.data;
    if (!data) return [];
    if (Array.isArray(data)) return data as ClientLite[];
    if (typeof data === "object" && "items" in data)
      return (data as { items: ClientLite[] }).items;
    return [];
  }, [clientsQuery.data]);
  const tasks = useMemo<TaskLite[]>(
    () => (tasksQuery.data ?? []) as TaskLite[],
    [tasksQuery.data],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const clientById = new Map(clients.map((c) => [c.id, c]));
    return tasks
      .map((t) => {
        const client = clientById.get(t.clientId);
        if (!client) return null;
        return {
          taskId: t.id,
          clientName: client.name,
          formType: t.formType,
          jurisdiction: t.jurisdiction,
          combined: `${client.name} ${t.formType} ${t.jurisdiction}`.toLowerCase(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => (q ? x.combined.includes(q) : true))
      .slice(0, 50);
  }, [clients, tasks, query]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a task to link this reply to"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink-900/30 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
        <header className="flex items-center px-4 py-3 border-b border-line gap-2">
          <Link2 className="w-3.5 h-3.5 text-ink-500" aria-hidden />
          <h2 className="text-sm font-semibold text-ink-900">
            Link reply to a task
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-ink-500 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>
        <div className="px-4 py-2 border-b border-line text-2xs text-ink-500">
          Reply: <span className="text-ink-700">{row.client}</span> · {row.preview.slice(0, 60)}
        </div>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by client or form…"
          className="m-3 px-3 py-2 border border-line rounded text-sm bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
        />
        <ul className="flex-1 overflow-y-auto divide-y divide-line">
          {clientsQuery.isLoading || tasksQuery.isLoading ? (
            <li className="px-4 py-6 text-sm text-ink-500">Loading…</li>
          ) : matches.length === 0 ? (
            <li className="px-4 py-6 text-sm text-ink-500">
              {query ? "No matches" : "No tasks yet"}
            </li>
          ) : (
            matches.map((m) => (
              <li key={m.taskId}>
                <button
                  type="button"
                  onClick={() => onPick(m.taskId)}
                  disabled={isLinking}
                  className="w-full text-left px-4 py-2 hover:bg-sunken/40 disabled:opacity-50 flex items-baseline gap-2"
                >
                  <span className="text-sm font-medium text-ink-900 truncate">
                    {m.clientName}
                  </span>
                  <span className="text-2xs text-ink-500 tabular-nums">
                    {m.formType.toUpperCase()} · {m.jurisdiction.toUpperCase()}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const map: Record<
    string,
    { label: string; tone: string }
  > = {
    timeline_pushback: { label: "pushback", tone: "bg-warn-bg text-warn-ink" },
    question_asked: { label: "question", tone: "bg-info-bg text-info-ink" },
    document_provided: { label: "document", tone: "bg-ok-bg text-ok-ink" },
    off_topic: { label: "off-topic", tone: "bg-sunken text-ink-500" },
    mismatched_attachment: { label: "mismatched", tone: "bg-danger-bg text-danger-ink" },
    acknowledgment: { label: "ack", tone: "bg-sunken text-ink-500" },
  };
  const m = map[intent] ?? { label: intent, tone: "bg-sunken text-ink-500" };
  return (
    <span
      className={`text-2xs px-1.5 py-0.5 rounded ${m.tone} font-medium tabular-nums`}
    >
      {m.label}
    </span>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-line p-8 text-center text-sm text-ink-500">
      {label} — wiring lands in Phase 1 once the firm-wide listSent /
      listDrafts BE procedures ship.
    </div>
  );
}
