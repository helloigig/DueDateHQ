import { useMemo, useState } from "react";
import { Mail, Send } from "lucide-react";
import type { Announcement, Client } from "../types";
import { formatLongDate } from "../data/dateHelpers";
import { useModalDialog } from "../hooks/useModalDialog";
import { useSession } from "../data/session";

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
  onSent: (count: number) => void;
}) {
  const session = useSession();
  const dialogRef = useModalDialog(open, onClose);

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
        announcement.publishedDate
      )} and it affects your filings.\n\n` +
      `${newLine}\n\n` +
      `No action is required from you right now — we're adjusting your calendar automatically. Reply if you have questions.\n\n` +
      `${session?.userName ?? "Sarah Mitchell"}\n${session?.firmName ?? "Mitchell CPA"}`
    );
  }, [announcement, session]);

  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sent, setSent] = useState(false);

  // Keep defaults in sync when the dialog opens with a new announcement
  const key = `${announcement?.id ?? ""}:${recipients.length}`;
  const [lastKey, setLastKey] = useState<string>("");
  if (open && key !== lastKey) {
    setSubject(defaultSubject);
    setBody(defaultBody);
    setSent(false);
    setLastKey(key);
  }

  if (!open || !announcement) return null;

  const canSend = recipients.length > 0 && subject.trim() && body.trim();

  const send = () => {
    console.info("[email] batch notify (mock)", {
      subject,
      bodyPreview: body.slice(0, 200),
      recipients: recipients.map((c) => c.contactEmail),
    });
    setSent(true);
    onSent(recipients.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-notify-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-2xl mx-4 outline-none"
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-ink-500" aria-hidden />
          <h2
            id="batch-notify-title"
            className="text-base font-semibold text-slate-900"
          >
            Notify {recipients.length} client
            {recipients.length === 1 ? "" : "s"} by email
          </h2>
        </header>

        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm max-h-[60vh] overflow-y-auto">
          <div className="md:col-span-2 space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Subject
              </span>
              <input
                data-autofocus
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Body (plain text — <code>{`{client_name}`}</code> is replaced per recipient)
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full px-2.5 py-1.5 rounded border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-xs resize-none"
              />
            </label>
          </div>
          <aside>
            <div className="text-xs font-medium text-slate-600 mb-1">
              Recipients ({recipients.length})
            </div>
            <div className="border border-slate-200 rounded max-h-72 overflow-y-auto">
              <ul className="divide-y divide-slate-100">
                {recipients.map((c) => (
                  <li key={c.id} className="px-3 py-2">
                    <div className="text-sm text-slate-900 truncate">
                      {c.name}
                    </div>
                    <div className="text-2xs text-slate-500 truncate">
                      {c.contactEmail}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-2xs text-slate-500 mt-2">
              Invalid emails are skipped. Bounces appear in the bell.
            </p>
          </aside>
        </div>

        {sent && (
          <div className="mx-5 mb-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-3 py-2">
            Queued to {recipients.length} recipient
            {recipients.length === 1 ? "" : "s"}. In production this hits the
            sending provider; here we logged it to the console.
          </div>
        )}

        <footer className="px-5 py-3 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="text-sm px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            {sent ? "Close" : "Cancel"}
          </button>
          {!sent && (
            <button
              onClick={send}
              disabled={!canSend}
              className="text-sm px-3 py-1.5 rounded font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              Send to {recipients.length}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
