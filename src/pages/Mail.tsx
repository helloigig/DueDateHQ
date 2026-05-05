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
  Siren,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import { PageHeader } from "../components/ui/PageHeader";

// Mail surface — per IA v0.7 amendment §3.8.
//
// Cross-client communication pivot. Top section is "Reminders Out, Awaiting
// Reply" (gap-over-fill principle: what client hasn't replied to is the
// loudest element). Below is 4 tabs (Inbox / Outbox / Drafts / Issues).
//
// Wired to live BE: Inbox tab → trpc.inboundReplies.list (Method A SES forward
// + Method B Gmail/Outlook OAuth pull both write here). Issues tab →
// trpc.deliveryEvents.issues (bounce/complaint/unsubscribe webhooks). Falls
// back to static mocks when BE returns empty (fresh / un-seeded firms).

type Tab = "inbox" | "outbox" | "drafts" | "issues";

const REMINDERS_OUT = [
  {
    daysSent: 11,
    client: "Emily Hartfield",
    task: "K-1 Apex Fund (1040 NY)",
    address: "emily@hartfield.com",
  },
  {
    daysSent: 9,
    client: "Marcus Chen",
    task: "S-Corp books (S-Corp CA)",
    address: "marcus@chen-llc.com",
  },
  {
    daysSent: 8,
    client: "Apex Fund",
    task: "1065 Partner Forms",
    address: "ops@apexfund.com",
  },
];

const INBOX_MOCK: InboxRow[] = [
  {
    intent: "timeline_pushback",
    client: "Sarah Mitchell",
    task: "1040 NY",
    preview: "Hi! K-1 from my fund won't be ready until late July...",
    receivedHoursAgo: 3,
  },
  {
    intent: "question_asked",
    client: "Jordan Lee",
    task: "S-Corp CA",
    preview: "Quick question — what's the IRA contribution limit this year?",
    receivedHoursAgo: 7,
  },
  {
    intent: "document_provided",
    client: "Emily Hartfield",
    task: "1040 NY",
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

  // Reminders Out — sent emailDrafts that haven't been replied to yet.
  // Wired to trpc.emails.awaitingReply (joins through tasks → deadlines
  // → clients so rows render real client + form names). Mock fallback
  // only in mock mode — real mode + 0 sent shows the empty state.
  // FE router types are stale until BE redeploys; cast the proxy access
  // through `as any` so the Vercel build doesn't fail on a missing key.
  type ReminderRow = {
    id: string;
    taskId?: string;
    clientId?: string;
    clientName: string;
    taskLabel: string;
    subject: string;
    toAddress: string;
    sentAt: string | null;
    daysSent: number | null;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remindersOutQuery = (trpc.emails as any).awaitingReply.useQuery({
    limit: 20,
  }) as {
    data?: ReminderRow[];
    isLoading: boolean;
    error?: { message: string } | null;
  };
  const liveReminders: ReminderRow[] = remindersOutQuery.data ?? [];
  const reminders: ReminderRow[] =
    liveReminders.length > 0
      ? liveReminders
      : env.useMockData
        ? REMINDERS_OUT.map((r) => ({
            id: `mock-${r.client}-${r.task}`,
            taskId: undefined,
            clientId: undefined,
            clientName: r.client,
            taskLabel: r.task,
            subject: r.task,
            toAddress: r.address,
            sentAt: null,
            daysSent: r.daysSent,
          }))
        : [];
  const remindersAggregate = useMemo(() => {
    if (reminders.length === 0) return null;
    const days = reminders.map((r) => r.daysSent ?? 0);
    const oldest = days.length ? Math.max(...days) : 0;
    const overSeven = days.filter((d) => d > 7).length;
    const uniqueClients = new Set(reminders.map((r) => r.clientName)).size;
    return { count: reminders.length, oldest, overSeven, uniqueClients };
  }, [reminders]);

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

      {/* Reminders Out — gap-over-fill prominent top section per IA v0.7 §3.8.
          Border 1px (DESIGN.md max), warn-bg (token, not -bg/40 mix). */}
      <section
        aria-labelledby="reminders-out-heading"
        className="rounded-md border border-warn-border bg-warn-bg p-region mb-card"
      >
        <header className="flex items-center justify-between gap-2 mb-3">
          <h2
            id="reminders-out-heading"
            className="text-sm font-semibold text-ink-900 flex items-center gap-2"
          >
            <Siren className="w-4 h-4 text-warn-ink" aria-hidden />
            Reminders out, awaiting reply
          </h2>
          <span className="text-2xs text-ink-500 tabular-nums">
            {remindersOutQuery.isLoading
              ? "loading…"
              : remindersOutQuery.error
                ? `backend error: ${remindersOutQuery.error.message.slice(0, 60)}`
                : remindersAggregate
                  ? `${remindersAggregate.count} across ${remindersAggregate.uniqueClients} client${remindersAggregate.uniqueClients === 1 ? "" : "s"} · oldest ${remindersAggregate.oldest}d · ${remindersAggregate.overSeven} sent > 7d ago`
                  : env.useMockData
                    ? "showing example data (mock mode)"
                    : "no reminders out yet"}
          </span>
        </header>

        {reminders.length === 0 ? (
          <p className="text-xs text-ink-500 px-2 py-3">
            {env.useMockData
              ? "Mock mode would show example reminders here."
              : "When you send a chase email and the client hasn't replied, it shows up here."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-surface text-sm"
              >
                <span className="tabular-nums text-2xs w-10 text-danger-solid font-semibold">
                  {r.daysSent != null ? `${r.daysSent}d` : "—"}
                </span>
                <span className="font-medium text-ink-900 truncate">
                  {r.clientName}
                </span>
                <span className="text-ink-500 text-xs">·</span>
                <span className="text-ink-700 text-xs truncate">
                  {r.taskLabel}
                </span>
                <span className="ml-auto flex items-center gap-2 shrink-0">
                  {r.clientId && r.taskId ? (
                    <Link
                      to={`/clients/${r.clientId}/tasks/${r.taskId}`}
                      className="px-2 py-1 text-xs text-ink-500 hover:text-ink-900"
                    >
                      Open task →
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
            className={`relative flex items-center gap-2 px-3 py-2 text-sm rounded-t -mb-px ${
              tab === id
                ? "border-b-2 border-accent text-ink-900 font-medium"
                : "text-ink-500 hover:text-ink-900"
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
                  ? `backend error: ${inboxQuery.error.message.slice(0, 60)}`
                  : liveInbox.length > 0
                    ? `live inbound feed · ${liveInbox.length} items from BE`
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
                navigate(`/clients/${m.clientId}/tasks/${m.taskId}`);
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
                    ? "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
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
                        to={`/clients/${m.clientId}/tasks/${m.taskId}`}
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
        Per <Link to="/settings/integrations" className="underline">Method A (per-task forwarding)</Link> +{" "}
        <Link to="/settings/integrations" className="underline">Method B (Gmail/Outlook OAuth)</Link> —
        both Day 1 — inbound is classified by AI into 7 classes (client doc /
        client reply / agency / 3rd-party data / payment / vendor / spam) and
        routed to the right client × task. Bytes stay in your email; we hold
        extracted text + facts + thumbnails. Outbox + Drafts views land in
        Phase 1 once <code>emails.listSent</code> + <code>emails.listDrafts</code> are wired.
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
          className="m-3 px-3 py-2 border border-line rounded text-sm bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
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
