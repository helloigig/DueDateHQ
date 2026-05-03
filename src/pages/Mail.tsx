import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox as InboxIcon, Send, FileEdit, AlertTriangle, Mail as MailIcon } from "lucide-react";
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

const INBOX_MOCK = [
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
  intent: string;
  client: string;
  task: string;
  preview: string;
  receivedHoursAgo: number;
};

function hoursAgo(iso: string | Date): number {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  return Math.max(0, Math.floor((Date.now() - t) / (60 * 60 * 1000)));
}

export function Mail() {
  const [tab, setTab] = useState<Tab>("inbox");
  const inboxQuery = trpc.inboundReplies.list.useQuery({ limit: 50 });
  const issuesQuery = trpc.deliveryEvents.issues.useQuery({ limit: 50 });

  // Map raw inbound_replies rows to the display shape. Without a join to
  // tasks/clients (held off to keep the router stateless), best-effort
  // identifiers: from-address as client, subject (or short body) as task.
  // Polish: add joined fields in a router follow-up to surface real names.
  const liveInbox: InboxRow[] = (inboxQuery.data ?? []).map((r) => ({
    intent: r.replyIntent ?? r.topLevelClass ?? "unknown",
    client: r.fromAddress.split("@")[0] ?? r.fromAddress,
    task: r.subject?.slice(0, 40) ?? (r.taskId ? "(linked task)" : "(unmatched)"),
    preview: (r.bodyText ?? r.subject ?? "(no body)").slice(0, 100),
    receivedHoursAgo: hoursAgo(r.receivedAt),
  }));
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
      <PageHeader
        title={
          <>
            <MailIcon className="inline w-5 h-5 mr-2 -mt-0.5" aria-hidden />
            Mail
          </>
        }
      />
      <p className="text-sm text-ink-500 -mt-section mb-card">
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
            <span aria-hidden>🚨</span>
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
                <span className="font-mono tabular-nums text-2xs w-10 text-danger-solid font-semibold">
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

      {/* Tabs — Inbox / Outbox / Drafts / Issues */}
      <div className="border-b border-line mb-3 flex items-center gap-1" role="tablist">
        {(
          [
            { id: "inbox" as Tab, label: "Inbox", Icon: InboxIcon, count: inboxCount },
            { id: "outbox" as Tab, label: "Outbox", Icon: Send, count: 47 },
            { id: "drafts" as Tab, label: "Drafts", Icon: FileEdit, count: 12 },
            { id: "issues" as Tab, label: "Issues", Icon: AlertTriangle, count: issuesCount },
          ] as const
        ).map(({ id, label, Icon, count }) => (
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
            {count > 0 && (
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
          {inbox.map((m, i) => (
            <article
              key={i}
              className="rounded-md border border-line bg-surface p-3 hover:bg-sunken/40 cursor-pointer"
            >
              <header className="flex items-center gap-2 mb-1.5">
                <IntentBadge intent={m.intent} />
                <span className="font-medium text-ink-900 text-sm">{m.client}</span>
                <span className="text-ink-300 text-xs">·</span>
                <span className="text-ink-600 text-xs">{m.task}</span>
                <span className="ml-auto text-2xs text-ink-400 tabular-nums">
                  {m.receivedHoursAgo}h ago
                </span>
              </header>
              <p className="text-sm text-ink-700 line-clamp-1">{m.preview}</p>
            </article>
          ))}
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
        Per <Link to="/settings/integrations" className="underline">Method B (Gmail/Outlook OAuth)</Link>,
        all inbound is classified by AI into 7 classes (client doc / client reply /
        agency / 3rd-party data / payment / vendor / spam) and routed to the right
        client × task. Bytes stay in your email — we hold extracted text + facts +
        thumbnails. Full mail integration ships in Phase 3.
      </p>
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
      {label} (mock data — full implementation Phase 3)
    </div>
  );
}
