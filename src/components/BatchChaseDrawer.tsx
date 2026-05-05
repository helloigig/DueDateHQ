import { useEffect, useMemo, useState } from "react";
import { Mail, X, AlertTriangle, Eye, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalDialog } from "../hooks/useModalDialog";
import { cn } from "../lib/utils";

/**
 * Multi-client chase composer — one email per recipient, ONE composer
 * shell. Yuqi audit 2026-05-05: "Can you batch send file request to
 * client to improve efficiency? So like I want to send email reminder
 * to all of the clients who have not given me the files for 1040."
 *
 * Distinct from `ChaseBundleModal` (single-client, multi-item bundling
 * inside ONE email). This one fans out: M clients → M emails, each
 * personalised. Per PRD §7.3 the invariant is "one email per chase
 * loop per client" — this surface honours it at scale.
 *
 * Layout: right-anchored drawer, 640px on desktop. Two halves —
 *   ┌─────────────────────────────────┐
 *   │ Header                          │
 *   ├──────────────┬──────────────────┤
 *   │ Recipients   │ Draft (template) │
 *   │ • Acme       │ Subject: …       │
 *   │ • Bluebonnet │ Body:    …       │
 *   │ • Delta      │   {{client_name}}│
 *   │ ...          │                  │
 *   ├──────────────┴──────────────────┤
 *   │ Footer · Send to N (sticky)     │
 *   └─────────────────────────────────┘
 *
 * Template uses `{{client_name}}` and `{{context}}` as merge tokens —
 * each recipient gets a personalised composition at send time. Per-
 * client preview opens an inline panel (click a row → preview replaces
 * the template editor for that recipient).
 *
 * Recipients with no email on file are flagged but not removed — the
 * caller gets the full list back from `onSend` and can decide whether
 * to skip (default: yes, with a toast saying "X clients skipped").
 */

export type BatchChaseIntent =
  | "file_request" // "we still need these documents"
  | "missing_form" // "you don't have a {form} on file yet"
  | "chase" // generic follow-up
  | "advisory_check_in"; // "checking in on advisory items"

export interface BatchRecipient {
  clientId: string;
  clientName: string;
  /** When omitted, the row is flagged "no email — skip" by default. */
  clientEmail?: string;
  /** Per-client merge field; used in `{{context}}` substitution. Examples:
   *    "1040 documents (2 still missing)"
   *    "941 Q2 — books not closed"
   *    "Schedule E (last sent 2024)" */
  context: string;
}

export interface BatchChasePayload {
  /** One entry per recipient that will actually be sent (excludes
   *  skipped clients). Per-recipient subject + body have already been
   *  merged from the template. */
  recipients: Array<{
    clientId: string;
    clientName: string;
    subject: string;
    body: string;
  }>;
}

interface Props {
  open: boolean;
  intent: BatchChaseIntent;
  recipients: BatchRecipient[];
  /** Optional pre-fill — when the caller wants to seed the subject /
   *  body with surface-specific context (e.g. Filings tab knows the
   *  form number). */
  seed?: { subject?: string; body?: string };
  onClose: () => void;
  /** Caller commits the batched send. Implementation lives upstream so
   *  the drawer can be reused for both real-mode (tRPC emails.batchSend)
   *  and mock-mode. */
  onSend: (payload: BatchChasePayload) => void;
}

const INTENT_LABEL: Record<BatchChaseIntent, string> = {
  file_request: "Send file request",
  missing_form: "Notify missing form",
  chase: "Send chase",
  advisory_check_in: "Send advisory check-in",
};

const INTENT_DEFAULT_SUBJECT: Record<BatchChaseIntent, string> = {
  file_request: "{{client_name}} — quick request",
  missing_form: "{{client_name}} — heads up on a filing",
  chase: "{{client_name}} — checking in",
  advisory_check_in: "{{client_name}} — quick advisory check-in",
};

const INTENT_DEFAULT_BODY: Record<BatchChaseIntent, string> = {
  file_request:
    "Hi {{client_name}},\n\nQuick check-in — we still need a few things from you to keep your filings on track:\n\n  • {{context}}\n\nIf anything's already on the way, no need to confirm — just reply once it's sent. Thanks!\n\n— The team at your CPA",
  missing_form:
    "Hi {{client_name}},\n\nWe noticed something on your account: {{context}}.\n\nIf this is intentional (or already filed somewhere we can't see), let us know and we'll update our records. Otherwise we'll loop you in on next steps.\n\n— The team at your CPA",
  chase:
    "Hi {{client_name}},\n\n{{context}}\n\nGive us a shout if you have any questions or need a hand pulling something together.\n\n— The team at your CPA",
  advisory_check_in:
    "Hi {{client_name}},\n\nSomething came up while we were reviewing your account that's worth a quick conversation: {{context}}.\n\nWant to grab 15 minutes? Reply with a couple of windows that work for you.\n\n— The team at your CPA",
};

function merge(template: string, recipient: BatchRecipient): string {
  // Use split/join instead of String.prototype.replaceAll — the project's
  // tsconfig targets ES2020 and replaceAll lives in ES2021. The split/join
  // pattern is the same canonical workaround the rest of the codebase uses.
  return template
    .split("{{client_name}}")
    .join(recipient.clientName)
    .split("{{context}}")
    .join(recipient.context);
}

export function BatchChaseDrawer({
  open,
  intent,
  recipients,
  seed,
  onClose,
  onSend,
}: Props) {
  const dialogRef = useModalDialog(open, onClose);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [bodyTouched, setBodyTouched] = useState(false);
  /** Recipients the user opted to skip (e.g. "send to all but Acme"). */
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  /** Currently-previewing recipient (null = template editor showing). */
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);

  // Reset on open. Don't reset while open (preserves user edits).
  useEffect(() => {
    if (!open) return;
    if (!subjectTouched) {
      setSubject(seed?.subject ?? INTENT_DEFAULT_SUBJECT[intent]);
    }
    if (!bodyTouched) {
      setBody(seed?.body ?? INTENT_DEFAULT_BODY[intent]);
    }
  }, [open, intent, seed, subjectTouched, bodyTouched]);

  // Wipe touched + skipped + preview on close so the next open is fresh.
  useEffect(() => {
    if (!open) {
      setSubjectTouched(false);
      setBodyTouched(false);
      setSkipped(new Set());
      setPreviewClientId(null);
    }
  }, [open]);

  const noEmailRecipients = useMemo(
    () => recipients.filter((r) => !r.clientEmail),
    [recipients],
  );

  const sendableRecipients = useMemo(
    () =>
      recipients.filter(
        (r) => r.clientEmail && !skipped.has(r.clientId),
      ),
    [recipients, skipped],
  );

  const previewRecipient = useMemo(
    () =>
      previewClientId
        ? recipients.find((r) => r.clientId === previewClientId) ?? null
        : null,
    [previewClientId, recipients],
  );

  if (!open) return null;

  const toggleSkip = (clientId: string) => {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const onSubmit = () => {
    onSend({
      recipients: sendableRecipients.map((r) => ({
        clientId: r.clientId,
        clientName: r.clientName,
        subject: merge(subject, r),
        body: merge(body, r),
      })),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-ink-900/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-chase-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border-l border-line w-full max-w-[640px] outline-none flex flex-col h-full shadow-overlay"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-region py-3 border-b border-line">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider font-semibold text-ink-500 mb-1">
              <Mail className="w-3 h-3" aria-hidden />
              Batch chase
            </div>
            <h2
              id="batch-chase-title"
              className="text-sm font-semibold text-ink-900"
            >
              {INTENT_LABEL[intent]} · {sendableRecipients.length}{" "}
              {sendableRecipients.length === 1 ? "client" : "clients"}
              {skipped.size > 0 && (
                <span className="text-ink-500 font-normal">
                  {" "}
                  (skipping {skipped.size})
                </span>
              )}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">
              One personalised email per client · merge tokens replaced at send
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors w-8 h-8 inline-flex items-center justify-center rounded shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>

        {noEmailRecipients.length > 0 && (
          <div className="px-region py-2 border-b border-warn-border bg-warn-bg/40 flex items-start gap-2">
            <AlertTriangle
              className="w-3.5 h-3.5 text-warn-ink shrink-0 mt-0.5"
              aria-hidden
            />
            <p className="text-xs text-warn-ink leading-snug">
              {noEmailRecipients.length}{" "}
              {noEmailRecipients.length === 1 ? "client has" : "clients have"} no
              email on file and will be skipped:{" "}
              <span className="font-medium">
                {noEmailRecipients
                  .slice(0, 3)
                  .map((r) => r.clientName)
                  .join(", ")}
                {noEmailRecipients.length > 3 &&
                  ` +${noEmailRecipients.length - 3} more`}
              </span>
              .
            </p>
          </div>
        )}

        {/* Body — two columns */}
        <div className="flex-1 min-h-0 grid grid-cols-[220px_1fr]">
          {/* Recipients list */}
          <aside className="border-r border-line overflow-y-auto bg-sunken/30">
            <div className="px-3 py-2 border-b border-line/80 sticky top-0 bg-sunken/95 backdrop-blur">
              <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
                Recipients
              </p>
            </div>
            <ul>
              {recipients.map((r) => {
                const isSkipped = skipped.has(r.clientId);
                const noEmail = !r.clientEmail;
                const isPreviewing = previewClientId === r.clientId;
                return (
                  <li key={r.clientId}>
                    <button
                      type="button"
                      onClick={() => setPreviewClientId(r.clientId)}
                      className={cn(
                        "w-full text-left px-3 py-2 flex items-start gap-2 border-b border-line/60 transition-colors",
                        isPreviewing
                          ? "bg-surface text-ink-900"
                          : "hover:bg-surface/60 text-ink-700",
                        (isSkipped || noEmail) && "opacity-50",
                      )}
                      title={
                        noEmail
                          ? "No email on file — skipped"
                          : isSkipped
                            ? "Skipped — click checkbox to include"
                            : "Click to preview this recipient's draft"
                      }
                    >
                      <input
                        type="checkbox"
                        checked={!isSkipped && !noEmail}
                        disabled={noEmail}
                        onChange={() => toggleSkip(r.clientId)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-3.5 h-3.5 rounded border-line shrink-0 accent-indigo mt-0.5 disabled:cursor-not-allowed"
                        aria-label={`Include ${r.clientName}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {r.clientName}
                        </div>
                        <div
                          className={cn(
                            "text-2xs truncate mt-0.5",
                            isSkipped ? "line-through" : "text-ink-500",
                          )}
                        >
                          {r.context}
                        </div>
                      </div>
                      {isPreviewing && (
                        <Eye
                          className="w-3 h-3 text-ink-500 shrink-0 mt-1"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Draft (template editor or per-client preview) */}
          <div className="overflow-y-auto">
            {previewRecipient ? (
              <PreviewPanel
                recipient={previewRecipient}
                subject={subject}
                body={body}
                onBackToTemplate={() => setPreviewClientId(null)}
              />
            ) : (
              <TemplateEditor
                subject={subject}
                body={body}
                onSubjectChange={(v) => {
                  setSubject(v);
                  setSubjectTouched(true);
                }}
                onBodyChange={(v) => {
                  setBody(v);
                  setBodyTouched(true);
                }}
                onResetSubject={() => {
                  setSubject(seed?.subject ?? INTENT_DEFAULT_SUBJECT[intent]);
                  setSubjectTouched(false);
                }}
                onResetBody={() => {
                  setBody(seed?.body ?? INTENT_DEFAULT_BODY[intent]);
                  setBodyTouched(false);
                }}
                subjectTouched={subjectTouched}
                bodyTouched={bodyTouched}
              />
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <footer className="flex items-center justify-between gap-2 px-region py-3 border-t border-line bg-canvas">
          <span className="text-xs text-ink-500">
            {sendableRecipients.length === 0
              ? "No recipients to send to"
              : `${sendableRecipients.length} ${sendableRecipients.length === 1 ? "email" : "emails"}, one per client`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={sendableRecipients.length === 0 || !subject.trim()}
              className="bg-indigo hover:bg-indigo-hover text-white"
            >
              <Mail className="w-3.5 h-3.5" aria-hidden />
              Send {sendableRecipients.length}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TemplateEditor({
  subject,
  body,
  subjectTouched,
  bodyTouched,
  onSubjectChange,
  onBodyChange,
  onResetSubject,
  onResetBody,
}: {
  subject: string;
  body: string;
  subjectTouched: boolean;
  bodyTouched: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onResetSubject: () => void;
  onResetBody: () => void;
}) {
  return (
    <section className="px-region py-3 space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="batch-chase-subject"
            className="block text-2xs uppercase tracking-wider text-ink-500 font-semibold"
          >
            Subject template
          </label>
          {subjectTouched && (
            <button
              type="button"
              onClick={onResetSubject}
              className="text-2xs text-ink-500 hover:text-ink-900 underline"
            >
              Reset to default
            </button>
          )}
        </div>
        <input
          id="batch-chase-subject"
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          maxLength={300}
          className="w-full text-sm border border-line rounded px-2.5 py-1.5 bg-canvas text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 transition-shadow"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="batch-chase-body"
            className="block text-2xs uppercase tracking-wider text-ink-500 font-semibold"
          >
            Message template
          </label>
          {bodyTouched && (
            <button
              type="button"
              onClick={onResetBody}
              className="text-2xs text-ink-500 hover:text-ink-900 underline"
            >
              Reset to default
            </button>
          )}
        </div>
        <textarea
          id="batch-chase-body"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={14}
          maxLength={20000}
          className="w-full text-sm bg-canvas border border-line rounded px-2.5 py-2 text-ink-900 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 transition-shadow font-mono"
        />
        <p className="mt-1 text-2xs text-ink-400 leading-relaxed">
          Merge tokens:{" "}
          <code className="px-1 py-0.5 rounded bg-sunken text-ink-700 font-mono">
            {"{{client_name}}"}
          </code>{" "}
          ·{" "}
          <code className="px-1 py-0.5 rounded bg-sunken text-ink-700 font-mono">
            {"{{context}}"}
          </code>{" "}
          — replaced per recipient at send. Click a name in the left rail
          to preview the merged version.
        </p>
      </div>
    </section>
  );
}

function PreviewPanel({
  recipient,
  subject,
  body,
  onBackToTemplate,
}: {
  recipient: BatchRecipient;
  subject: string;
  body: string;
  onBackToTemplate: () => void;
}) {
  const mergedSubject = merge(subject, recipient);
  const mergedBody = merge(body, recipient);

  return (
    <section className="px-region py-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1 flex items-center gap-1.5">
            <Check className="w-3 h-3 text-ok-solid" aria-hidden />
            Preview · merged
          </div>
          <p className="text-sm font-medium text-ink-900 truncate">
            To: {recipient.clientName}{" "}
            <span className="font-normal text-ink-500">
              &lt;{recipient.clientEmail ?? "(no email)"}&gt;
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToTemplate}
          className="text-2xs text-ink-500 hover:text-ink-900 underline shrink-0"
        >
          ← Back to template
        </button>
      </div>

      <div>
        <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1">
          Subject
        </div>
        <div className="text-sm text-ink-900 bg-sunken/40 border border-line rounded px-2.5 py-1.5">
          {mergedSubject}
        </div>
      </div>

      <div>
        <div className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1">
          Message
        </div>
        <pre className="text-sm text-ink-900 bg-sunken/40 border border-line rounded px-2.5 py-2 leading-relaxed whitespace-pre-wrap font-sans">
          {mergedBody}
        </pre>
      </div>

      <p className="text-2xs text-ink-400">
        Edits to the template apply to ALL recipients. Per-recipient
        overrides aren't supported in this drawer — for one-off
        customisation, send the batch and then edit individually in Mail.
      </p>
    </section>
  );
}
