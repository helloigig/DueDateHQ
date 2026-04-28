import { useEffect, useMemo, useState } from "react";
import { Send, XCircle } from "lucide-react";
import { useModalDialog } from "../hooks/useModalDialog";
import {
  useCreateEmailDraft,
  useDiscardEmailDraft,
  useScheduleEmailDraft,
  useSendEmailDraft,
  useUpdateEmailDraft,
} from "../hooks/useEmailDrafts";
import type { EmailDraftRecord, TaskDetail } from "../types";

type Tone = "formal" | "casual" | "urgent" | "apologetic";

const TONES: Tone[] = ["formal", "casual", "urgent", "apologetic"];

export function EmailDraftModal({
  open,
  task,
  checklistItemId,
  onClose,
}: {
  open: boolean;
  task: TaskDetail | null;
  checklistItemId?: string | null;
  onClose: () => void;
}) {
  const dialogRef = useModalDialog(open, onClose);
  const createDraft = useCreateEmailDraft();
  const updateDraft = useUpdateEmailDraft();
  const sendDraft = useSendEmailDraft();
  const scheduleDraft = useScheduleEmailDraft();
  const discardDraft = useDiscardEmailDraft();

  const [draft, setDraft] = useState<EmailDraftRecord | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tone, setTone] = useState<Tone>("formal");
  const [scheduleAt, setScheduleAt] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 16)
  );

  useEffect(() => {
    if (!open || !task) return;
    setDraft(null);
    createDraft.mutate(
      {
        taskId: task.task.id,
        checklistItemId: checklistItemId ?? undefined,
        tone: "formal",
      },
      {
        onSuccess: (created) => {
          setDraft(created);
          setSubject(created.subject);
          setBody(created.body);
          setTone((created.tone as Tone) ?? "formal");
        },
      }
    );
  }, [checklistItemId, createDraft, open, task]);

  const sources = useMemo(() => {
    if (!draft) return [];
    return Object.entries(draft.aiSources).map(([key, value]) => ({
      key,
      value: Array.isArray(value) ? value.join(", ") : String(value),
    }));
  }, [draft]);

  if (!open || !task) return null;

  const regenerateTone = (nextTone: Tone) => {
    if (!draft) return;
    setTone(nextTone);
    updateDraft.mutate(
      { id: draft.id, tone: nextTone },
      {
        onSuccess: (updated) => {
          setDraft(updated);
          setSubject(updated.subject);
          setBody(updated.body);
        },
      }
    );
  };

  const saveEdits = () => {
    if (!draft) return;
    updateDraft.mutate(
      { id: draft.id, subject, body },
      {
        onSuccess: (updated) => setDraft(updated),
      }
    );
  };

  const handleSend = () => {
    if (!draft) return;
    saveEdits();
    sendDraft.mutate(
      { id: draft.id },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  const handleSchedule = () => {
    if (!draft) return;
    saveEdits();
    scheduleDraft.mutate(
      { id: draft.id, sendAt: new Date(scheduleAt).toISOString() },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  const handleDiscard = () => {
    if (!draft) {
      onClose();
      return;
    }
    discardDraft.mutate(
      { id: draft.id },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  const recipient = draft?.to[0] ?? task.client.contactEmail;

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
        onClick={(event) => event.stopPropagation()}
        className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-4xl mx-4 outline-none"
      >
        <header className="px-5 py-4 border-b border-slate-100 flex items-start gap-4">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              Reminder draft
            </div>
            <h2 className="text-lg font-semibold text-slate-900">
              {task.client.name} · {task.task.title}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              To: {recipient} · CC: sarah@mitchellcpa.com
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <XCircle className="w-5 h-5" aria-hidden />
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
          <div className="p-5 space-y-4 border-r border-slate-100">
            <div className="flex flex-wrap gap-2">
              {TONES.map((option) => (
                <button
                  key={option}
                  onClick={() => regenerateTone(option)}
                  className={`text-xs px-2.5 py-1 rounded border ${
                    tone === option
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Subject
              </span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="w-full px-3 py-2 rounded border border-slate-200 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-600 mb-1 block">
                Body
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={14}
                className="w-full px-3 py-2 rounded border border-slate-200 text-sm font-mono resize-none"
              />
            </label>

            <div className="flex items-end gap-3">
              <label className="block">
                <span className="text-xs font-medium text-slate-600 mb-1 block">
                  Schedule send
                </span>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  className="px-3 py-2 rounded border border-slate-200 text-sm"
                />
              </label>
              <button
                onClick={saveEdits}
                className="text-sm px-3 py-2 rounded border border-slate-200 hover:bg-slate-50"
              >
                Save draft
              </button>
            </div>
          </div>

          <aside className="p-5 bg-slate-50 space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                AI sources
              </h3>
              <ul className="mt-2 space-y-2">
                {sources.map((source) => (
                  <li
                    key={source.key}
                    className="rounded border border-slate-200 bg-white px-3 py-2"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">
                      {source.key}
                    </div>
                    <div className="text-sm text-slate-700 mt-1">
                      {source.value}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
              This draft keeps the CPA on CC and logs reminder timing back to the
              checklist item when sent.
            </div>
          </aside>
        </div>

        <footer className="px-5 py-4 bg-slate-50 rounded-b-lg flex items-center justify-end gap-2">
          <button
            onClick={handleDiscard}
            className="text-sm px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Discard
          </button>
          <button
            onClick={handleSchedule}
            className="text-sm px-3 py-2 rounded border border-slate-200 bg-white hover:bg-slate-50"
          >
            Schedule
          </button>
          <button
            onClick={handleSend}
            className="text-sm px-3 py-2 rounded bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" aria-hidden />
            Send now
          </button>
        </footer>
      </div>
    </div>
  );
}
