import { useMemo, useState } from "react";
import { CalendarClock, Mail, Send } from "lucide-react";
import type { Announcement, Client } from "../types";
import { actions } from "../data/store";
import { formatLongDate } from "../data/dateHelpers";
import { useSession } from "../data/session";
import { useBatchAdjustFromAnnouncement } from "../hooks/useAnnouncements";
import { useInvalidateDeadlines } from "../hooks/useDeadlines";
import { Modal, useModalLabelId } from "./Modal";

export function BatchNotifyModal({
  open,
  announcement,
  recipients,
  onClose,
  onSent,
}: {
  open: boolean;
  announcement: Announcement | null;
  recipients: Client[];
  onClose: () => void;
  /** Called after send. `adjustedCount` is non-zero when the bundled
   *  deadline-shift was applied. */
  onSent: (count: number, adjustedCount: number) => void;
}) {
  const session = useSession();
  const labelId = useModalLabelId();
  // Persistence path for deadline shifts. Calls the BE
  // `announcements.batchAdjustDeadlines` mutation, which also cascades to
  // task_milestones server-side. The local `actions.batchAdjustDeadlines`
  // we still call below provides the instant optimistic UI update; once
  // this resolves, the invalidate trigger refetches deadlines/clients
  // from the BE so the truth wins.
  const batchAdjustBE = useBatchAdjustFromAnnouncement();
  const invalidateDeadlines = useInvalidateDeadlines();

  // Disaster extensions carry a deadline shift. We bundle the mutation into
  // the same review action so the CPA confirms email + calendar move in one
  // pass — they are two effects of the same decision ("yes, this affects
  // my clients, do the right thing").
  const isDisasterShift =
    announcement?.type === "disaster_extension" &&
    !!announcement.oldDeadline &&
    !!announcement.newDeadline;

  const defaultSubject = useMemo(() => {
    if (!announcement) return "";
    return `Heads up: ${announcement.stateCode} — ${announcement.title}`;
  }, [announcement]);

  const defaultBody = useMemo(() => {
    if (!announcement) return "";
    const newLine = announcement.newDeadline
      ? `The new deadline is ${formatLongDate(announcement.newDeadline)}.`
      : "We'll follow up with any action required on your end.";
    return (
      `Hi {client_name},\n\n` +
      `${announcement.authority} issued "${announcement.title}" on ${formatLongDate(
        announcement.issuanceDate
      )} and it affects your filings.\n\n` +
      `${newLine}\n\n` +
      `No action is required from you right now — we're adjusting your calendar automatically. Reply if you have questions.\n\n` +
      `${session?.userName ?? "Sarah Mitchell"}\n${session?.firmName ?? "Mitchell CPA"}`
    );
  }, [announcement, session]);

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sent, setSent] = useState(false);
  const [shiftDeadlines, setShiftDeadlines] = useState(true);

  // Keep defaults in sync when the dialog opens with a new announcement
  const key = `${announcement?.id ?? ""}:${recipients.length}`;
  const [lastKey, setLastKey] = useState<string>("");
  if (open && key !== lastKey) {
    setSubject(defaultSubject);
    setBody(defaultBody);
    setSent(false);
    setShiftDeadlines(true);
    setLastKey(key);
  }

  if (!announcement) return null;

  const canSend = recipients.length > 0 && subject.trim() && body.trim();

  const send = () => {
    console.info("[email] batch notify (mock)", {
      subject,
      bodyPreview: body.slice(0, 200),
      recipients: recipients.map((c) => c.contactEmail),
    });
    let adjustedCount = 0;
    if (
      isDisasterShift &&
      shiftDeadlines &&
      announcement.oldDeadline &&
      announcement.newDeadline
    ) {
      const ids = recipients.map((c) => c.id);
      // Optimistic local mutation — instant UI feedback in mock + real
      // (the local store is the read source for the FE; tRPC queries
      // hydrate from BE on next refetch).
      actions.batchAdjustDeadlines(
        ids,
        announcement.oldDeadline,
        announcement.newDeadline,
        announcement.title
      );
      adjustedCount = ids.length;
      // Persist to BE — fire-and-forget; the BE cascades to task_milestones
      // and records `firm_announcement.batch_adjusted_at`. On success the
      // mutation invalidates the announcements queries; we add an explicit
      // deadlines invalidation so ClientDetail / TaskDetail refetch the
      // BE-shifted dates and the optimistic local state reconciles.
      batchAdjustBE.mutate(
        { id: announcement.id },
        { onSuccess: () => invalidateDeadlines() },
      );
    }
    setSent(true);
    onSent(recipients.length, adjustedCount);
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabelledBy={labelId} size="xl">
      <Modal.Header>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-ink-500" aria-hidden />
          <h2 id={labelId} className="text-base font-semibold text-ink-900">
            Review draft for {recipients.length} client
            {recipients.length === 1 ? "" : "s"}
          </h2>
        </div>
      </Modal.Header>

      <Modal.Body
        scroll
        className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm"
      >
        <div className="md:col-span-2 space-y-3">
          {isDisasterShift && (
            <label className="flex items-start gap-3 px-3 py-2.5 rounded border border-info-border bg-info-bg/50">
              <input
                type="checkbox"
                checked={shiftDeadlines}
                onChange={(e) => setShiftDeadlines(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-accent shrink-0"
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                  <CalendarClock className="w-3.5 h-3.5" aria-hidden />
                  Also move {recipients.length} deadline
                  {recipients.length === 1 ? "" : "s"} from{" "}
                  {announcement.oldDeadline
                    ? formatLongDate(announcement.oldDeadline)
                    : "—"}{" "}
                  →{" "}
                  {announcement.newDeadline
                    ? formatLongDate(announcement.newDeadline)
                    : "—"}
                </span>
                <span className="block text-2xs text-ink-500 mt-0.5">
                  Updates each client's calendar in the same step. Logged to
                  activity, revertible per-client.
                </span>
              </span>
            </label>
          )}
          <label className="block">
            <span className="text-xs font-medium text-ink-700 mb-1 block">
              Subject
            </span>
            <input
              data-autofocus
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700 mb-1 block">
              Body (plain text — <code>{`{client_name}`}</code> is replaced per recipient)
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full px-2.5 py-1.5 rounded border border-line focus:outline-none focus:ring-2 focus:ring-accent font-mono text-xs resize-none"
            />
          </label>
        </div>
        <aside>
          <div className="text-xs font-medium text-ink-700 mb-1">
            Recipients ({recipients.length})
          </div>
          <div className="border border-line rounded max-h-72 overflow-y-auto">
            <ul className="divide-y divide-line">
              {recipients.map((c) => (
                <li key={c.id} className="px-3 py-2">
                  <div className="text-sm text-ink-900 truncate">{c.name}</div>
                  <div className="text-2xs text-ink-500 truncate">
                    {c.contactEmail}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-2xs text-ink-500 mt-2">
            Invalid emails are skipped. Bounces appear in the bell.
          </p>
        </aside>
      </Modal.Body>

      {sent && (
        <div className="mx-5 mb-3 rounded border border-ok-border bg-ok-bg text-ok-ink text-sm px-3 py-2">
          Queued to {recipients.length} recipient
          {recipients.length === 1 ? "" : "s"}
          {isDisasterShift && shiftDeadlines && (
            <>
              {" "}· {recipients.length} deadline
              {recipients.length === 1 ? "" : "s"} moved to{" "}
              {announcement.newDeadline
                ? formatLongDate(announcement.newDeadline)
                : "—"}
            </>
          )}
          .
        </div>
      )}

      <Modal.Footer tone="sunken">
        <button
          onClick={onClose}
          className="text-sm px-3 py-1.5 rounded border border-line bg-surface hover:bg-sunken text-ink-700"
        >
          {sent ? "Close" : "Cancel"}
        </button>
        {!sent && (
          <button
            onClick={send}
            disabled={!canSend}
            className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" aria-hidden />
            {isDisasterShift && shiftDeadlines
              ? `Send & move ${recipients.length}`
              : `Send to ${recipients.length}`}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
