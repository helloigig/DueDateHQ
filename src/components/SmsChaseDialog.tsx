import { useEffect, useState } from "react";
import { X, Send, MessageSquare } from "lucide-react";
import {
  useComposeChaseSms,
  useSendChaseSms,
  useSmsStatus,
} from "../hooks/useFilesFromClients";
import { useSession } from "../data/session";
import type { Task, Client, ChecklistItem } from "../types";

/**
 * SMS chase dialog. Opens from the AskClientMenu's "Send SMS chase…"
 * option. Requires:
 *   - Pro / Team tier (BE enforces; FE gates the menu option)
 *   - SMS provider configured in env (smsStatus.configured = true)
 *   - Client phone number (auto-fills from contactPhone, editable)
 *
 * The body is auto-composed via the BE composeChaseSms helper so the
 * wording stays consistent with future channels (MessageBird, etc.).
 * Capped at 160 chars to avoid multi-segment surprise billing.
 */
export function SmsChaseDialog({
  open,
  onClose,
  task,
  client,
  item,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
  client: Pick<Client, "name" | "contactPhone">;
  item?: ChecklistItem;
}) {
  const session = useSession();
  const status = useSmsStatus();
  const compose = useComposeChaseSms();
  const send = useSendChaseSms();

  const [phone, setPhone] = useState(client.contactPhone ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Generate the draft when dialog opens or item changes
  useEffect(() => {
    if (!open) return;
    setSent(false);
    setError(null);
    const firstName = client.name.split(/\s+/)[0] ?? client.name;
    void compose({
      clientFirstName: firstName,
      cpaName: session?.userName ?? "your CPA",
      formType: task.formType,
      missingItem: item?.label,
      forwardingEmail: task.forwardingEmail,
    }).then(setBody);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  if (!open) return null;

  const onSend = async () => {
    setError(null);
    if (!phone.trim() || phone.trim().length < 8) {
      setError("Enter a phone number (E.164 — start with +).");
      return;
    }
    if (!body.trim()) {
      setError("Body can't be empty.");
      return;
    }
    try {
      await send.mutateAsync({
        to: phone.trim(),
        body: body.trim().slice(0, 160),
        taskId: task.id,
      });
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
  };

  const remaining = 160 - body.length;
  const tier = session?.tier ?? "solo";
  const tierBlocked = tier === "solo";
  const notConfigured = !status.data?.configured;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-md overflow-hidden">
        <header className="flex items-center px-4 py-3 border-b border-line">
          <MessageSquare
            className="w-4 h-4 text-ink-700 mr-2"
            aria-hidden
          />
          <h2 className="text-sm font-semibold text-ink-900">
            SMS chase — {client.name}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-ink-500 hover:text-ink-900 p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-4 space-y-3">
          {tierBlocked && (
            <div className="text-xs text-warn-ink bg-warn-bg/40 border border-warn-border rounded px-3 py-2">
              SMS is a Pro/Team feature — per-message cost. Upgrade in
              Settings → Billing to send.
            </div>
          )}
          {!tierBlocked && notConfigured && (
            <div className="text-xs text-warn-ink bg-warn-bg/40 border border-warn-border rounded px-3 py-2">
              SMS provider not configured. Set TWILIO_ACCOUNT_SID +
              TWILIO_AUTH_TOKEN + TWILIO_FROM in backend env, then
              reload.
            </div>
          )}

          <label className="block">
            <span className="text-xs font-medium text-ink-700 mb-1 block">
              To (phone)
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+15551234567"
              className="w-full border border-line rounded px-3 py-2 text-sm font-mono"
            />
            {!client.contactPhone && (
              <span className="text-2xs text-ink-400 mt-1 block">
                No phone on file — enter manually.
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-xs font-medium text-ink-700 mb-1 block flex items-baseline justify-between">
              <span>Message</span>
              <span
                className={[
                  "text-2xs tabular-nums",
                  remaining < 20
                    ? remaining < 0
                      ? "text-danger-ink"
                      : "text-warn-ink"
                    : "text-ink-400",
                ].join(" ")}
              >
                {remaining} left
              </span>
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={160}
              rows={3}
              className="w-full border border-line rounded px-3 py-2 text-sm resize-none"
            />
          </label>

          {error && (
            <p className="text-xs text-danger-ink bg-danger-bg border border-danger-border rounded px-3 py-2">
              {error}
            </p>
          )}
          {sent && (
            <p className="text-xs text-ok-ink bg-ok-bg border border-ok-border rounded px-3 py-2">
              Sent. Activity logged on the task.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded text-ink-500 hover:bg-sunken"
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={
                send.isPending ||
                tierBlocked ||
                notConfigured ||
                sent ||
                !body.trim() ||
                !phone.trim()
              }
              className="ml-auto text-sm px-4 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 inline-flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" aria-hidden />
              {send.isPending ? "Sending…" : "Send SMS"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
