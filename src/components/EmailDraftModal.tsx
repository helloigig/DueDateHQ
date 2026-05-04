import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { X, Send, Calendar, Sparkles, Mail } from "lucide-react";
import type {
  AiSource,
  Client,
  ChecklistItem,
  EmailTone,
  Task,
} from "../types";
import { draftEmail } from "../lib/ai-stub";
import { actions, useStore } from "../data/store";
import { AuthorityChip } from "./AuthorityChip";
import { useSession } from "../data/session";
import { useSendEmail } from "../hooks/useEmailDrafts";

/**
 * The Email draft modal — IA §3.7. Mode D's primary surface. Triggered from
 * many places (Task detail, Alert detail, AI flag resolution). Same modal
 * everywhere. Tone selector regenerates body in 1-2s with loading state.
 */

export interface EmailDraftIntent {
  task: Task;
  client: Client;
  /** When invoked from a checklist item, the item's id. Optional for
   *  alert-detail batched notification. */
  checklistItem?: ChecklistItem;
  /** Free-text context — used when "Ask client" on a flag passes the
   *  flag reason as the email body context. */
  context?: string;
  /** Multi-recipient label for batched notifications (e.g., "12 clients"). */
  toLabel?: string;
}

interface Props {
  open: boolean;
  intent: EmailDraftIntent | null;
  onClose: () => void;
}

const TONE_OPTIONS: EmailTone[] = ["formal", "casual", "urgent", "apologetic"];

export function EmailDraftModal({ open, intent, onClose }: Props) {
  const session = useSession();
  const sendEmail = useSendEmail();
  const [tone, setTone] = useState<EmailTone>("casual");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [aiSources, setAiSources] = useState<AiSource[]>([]);
  const [generating, setGenerating] = useState(false);
  const [scheduledFor, setScheduledFor] = useState<string>("");
  const [showSchedule, setShowSchedule] = useState(false);

  const cpaName = session?.userName ?? "Sarah Mitchell";
  const cpaEmail = session?.userEmail ?? "sarah@mitchellcpa.com";
  const cpaSignature = `${cpaName}\n${session?.firmName ?? "Mitchell CPA"}`;
  const firmName = session?.firmName ?? "Mitchell CPA";

  const itemLabel = intent?.checklistItem?.label;
  const itemType = intent?.checklistItem?.itemType;

  // Smart chase — pull every still-pending item on this task so the
  // draft can be specific ("I still need W-2 + 1099-INT") rather than
  // template-shaped. importedFacts gives us last-year arrival dates
  // for the same item types so the model can anchor expectations
  // ("you usually send the W-2 in early March").
  const { checklistItems, importedFacts } = useStore();
  const missingDocs = useMemo(() => {
    if (!intent) return [];
    const taskItems = checklistItems.filter(
      (c) => c.taskId === intent.task.id,
    );
    // Only items the client owes us — not yet received, not n/a
    const pending = taskItems.filter(
      (c) =>
        c.state === "not_requested" ||
        c.state === "requested_waiting" ||
        c.state === "received_issue",
    );
    return pending.map((c) => {
      // Find the most recent prior-year arrival for this item type
      const priors = importedFacts
        .filter(
          (f) =>
            f.clientId === intent.client.id &&
            f.itemType === c.itemType &&
            f.observedDate,
        )
        .sort((a, b) =>
          (b.observedDate ?? "").localeCompare(a.observedDate ?? ""),
        );
      return {
        itemType: c.itemType,
        label: c.label,
        lastYearArrival: priors[0]?.observedDate,
      };
    });
  }, [intent, checklistItems, importedFacts]);

  // Match the inbound item to a system reminder template — closes the loop
  // between Settings → Reminder Templates and the email modal. Educates the
  // CPA on which template AI used as the seed.
  const { reminderTemplates } = useStore();
  const matchedTemplate = useMemo(() => {
    if (!itemType) return null;
    // Direct itemType match first
    const direct = reminderTemplates.find((t) => t.itemType === itemType);
    if (direct) return direct;
    // Fall back to family match (e.g., "1099_int" → "1099_any")
    const family = itemType.split("_")[0];
    return (
      reminderTemplates.find(
        (t) => t.itemType === `${family}_any`
      ) ?? null
    );
  }, [itemType, reminderTemplates]);

  const cacheKey = useMemo(() => {
    if (!intent) return "";
    return `${intent.task.id}|${itemLabel ?? "batch"}|${tone}|${
      intent.context ?? ""
    }`;
  }, [intent, itemLabel, tone]);

  // Regenerate the draft whenever inputs change (tone selector / item).
  useEffect(() => {
    if (!open || !intent) return;
    setGenerating(true);
    let cancelled = false;
    draftEmail({
      task: intent.task,
      client: intent.client,
      itemLabel,
      itemType,
      tone,
      cpaName,
      cpaSignature,
      firmName,
      forwardingEmail: intent.task.forwardingEmail,
      context: intent.context,
      methodBConnected: false,
      missingDocs,
    }).then((out) => {
      if (cancelled) return;
      setSubject(out.subject);
      setBody(out.body);
      setAiSources(out.aiSources);
      setGenerating(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cacheKey]);

  // Reset on close so next open is fresh.
  useEffect(() => {
    if (!open) {
      setShowSchedule(false);
      setScheduledFor("");
    }
  }, [open]);

  if (!open || !intent) return null;

  const send = () => {
    const id = actions.saveEmailDraft({
      taskId: intent.task.id,
      clientId: intent.client.id,
      checklistItemId: intent.checklistItem?.id,
      to: intent.client.contactEmail || `${intent.client.name} <client@example.com>`,
      cc: cpaEmail,
      subject,
      body,
      tone,
      aiSources,
      sendMethod: "cpa_send",
      scheduledFor: scheduledFor || undefined,
      status: scheduledFor ? "scheduled" : "draft",
    });
    if (!scheduledFor) {
      // Wraps actions.sendEmail with the 60s "Sent · Undo" toast that
      // backs the soft-recall affordance (emails.recall on real, store
      // recallEmail in mock).
      sendEmail(id);
    }
    onClose();
  };

  const discard = () => {
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Email draft"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <header className="flex items-center px-5 py-3 border-b border-line">
          <h2 className="text-sm font-semibold text-ink-900">Compose</h2>
          <AuthorityChip zone="yellow" className="ml-2" />
          <span className="ml-2 text-2xs text-ink-400">
            You review and send — we never send on your behalf
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-ink-500 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {/* To / CC / Reply-To */}
          <div className="grid grid-cols-[80px_1fr] gap-y-1 gap-x-3 text-sm">
            <span className="text-ink-400 text-xs uppercase tracking-wide pt-1.5">
              To
            </span>
            <input
              readOnly
              value={
                intent.toLabel ??
                intent.client.contactEmail ??
                `${intent.client.name}`
              }
              className="border border-line rounded px-2 py-1.5 bg-sunken/40 text-ink-700"
            />
            <span className="text-ink-400 text-xs uppercase tracking-wide pt-1.5">
              CC
            </span>
            <input
              readOnly
              value={cpaEmail}
              className="border border-line rounded px-2 py-1.5 bg-sunken/40 text-ink-700"
            />
            <span className="text-ink-400 text-xs uppercase tracking-wide pt-1.5">
              Reply-To
            </span>
            <input
              readOnly
              value={intent.task.forwardingEmail}
              className="border border-line rounded px-2 py-1.5 bg-sunken/40 text-ink-700 font-mono text-xs"
            />
            <span className="text-ink-400 text-xs uppercase tracking-wide pt-1.5">
              Subject
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border border-line rounded px-2 py-1.5"
            />
          </div>

          <div>
            <label className="text-2xs uppercase tracking-wider text-ink-400">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full mt-1 border border-line rounded px-3 py-2 text-sm font-sans"
            />
            {generating && (
              <p className="text-xs text-ink-500 mt-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-pulse" aria-hidden />
                Regenerating in {tone} tone…
              </p>
            )}
          </div>

          {/* AI sources panel — now shows the source reminder template too,
              so the CPA can trace "where did this draft come from?" */}
          <div className="border border-line rounded p-3 bg-sunken/30">
            <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold mb-1.5">
              AI sources
            </p>
            {matchedTemplate && (
              <div className="text-xs text-ink-700 flex items-start gap-2 pb-1.5 mb-1.5 border-b border-line">
                <span className="text-ink-400 uppercase tracking-wider text-2xs w-20 shrink-0">
                  template
                </span>
                <span className="flex-1 flex items-center gap-1.5 flex-wrap">
                  <Mail className="w-3 h-3 text-ink-500" aria-hidden />
                  <Link
                    to="/settings/reminders"
                    className="font-medium text-ink-900 hover:underline"
                    title={`${matchedTemplate.name} · ${matchedTemplate.cadence} cadence · Phase ${matchedTemplate.phase}`}
                  >
                    {matchedTemplate.name}
                  </Link>
                  <span className="text-ink-500">
                    {matchedTemplate.trigger && (
                      <>· {matchedTemplate.trigger}</>
                    )}
                    {matchedTemplate.cadence && (
                      <> · {matchedTemplate.cadence}</>
                    )}
                    <> · Phase {matchedTemplate.phase ?? 1}</>
                  </span>
                </span>
              </div>
            )}
            <ul className="space-y-1">
              {aiSources.map((s, i) => (
                <li
                  key={i}
                  className="text-xs text-ink-700 flex items-start gap-2"
                >
                  <span className="text-ink-400 uppercase tracking-wider text-2xs w-20 shrink-0">
                    {s.kind.replace(/_/g, " ")}
                  </span>
                  <span className="flex-1">{s.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tone selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs uppercase tracking-wider text-ink-500">
              Tone:
            </span>
            {TONE_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={[
                  "text-xs px-2.5 py-1 rounded border capitalize",
                  tone === t
                    ? "border-accent bg-accent text-canvas"
                    : "border-line text-ink-700 hover:bg-sunken",
                ].join(" ")}
              >
                {t}
              </button>
            ))}
          </div>

          {showSchedule && (
            <div className="border border-line rounded p-3 bg-info-bg/30">
              <label className="text-2xs uppercase tracking-wider text-ink-500 block mb-1">
                Schedule send
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="border border-line rounded px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </div>

        <footer className="flex items-center px-5 py-3 border-t border-line gap-2 bg-sunken/20">
          <button
            onClick={discard}
            className="text-sm px-3 py-1.5 rounded text-ink-500 hover:bg-sunken"
          >
            Discard
          </button>
          <span className="ml-auto" />
          <button
            onClick={() => setShowSchedule((v) => !v)}
            className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken flex items-center gap-1"
          >
            <Calendar className="w-3.5 h-3.5" aria-hidden />
            {showSchedule ? "Cancel schedule" : "Schedule"}
          </button>
          <button
            onClick={send}
            disabled={generating || !subject.trim() || !body.trim()}
            className="text-sm px-4 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" aria-hidden />
            {scheduledFor ? "Schedule send" : "Send"}
          </button>
        </footer>
      </div>
    </div>
  );
}
