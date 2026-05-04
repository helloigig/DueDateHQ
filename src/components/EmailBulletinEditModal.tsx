import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalDialog } from "../hooks/useModalDialog";

interface Props {
  open: boolean;
  subject: string;
  body: string;
  recipientName: string;
  recipientEmail?: string;
  onSave: (subject: string, body: string) => void;
  onClose: () => void;
}

/**
 * Inline editor for one bulletin email. Used by the Alerts co-pilot pane
 * when the CPA wants to tweak a per-client draft before Send. Edits are
 * stored in the parent's `draftOverrides` map keyed by alert × client so
 * the Send call carries the user's exact text.
 */
export function EmailBulletinEditModal({
  open,
  subject: initialSubject,
  body: initialBody,
  recipientName,
  recipientEmail,
  onSave,
  onClose,
}: Props) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  // Reset when the modal opens for a new draft.
  useEffect(() => {
    if (open) {
      setSubject(initialSubject);
      setBody(initialBody);
    }
  }, [open, initialSubject, initialBody]);

  const dialogRef = useModalDialog(open, onClose);

  if (!open) return null;

  const onSubmit = () => {
    if (!subject.trim() || !body.trim()) return;
    onSave(subject.trim(), body);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-bulletin-edit-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-lg shadow-xl border border-line w-full max-w-xl mx-4 outline-none flex flex-col max-h-[90vh]"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line">
          <div className="min-w-0">
            <h2
              id="email-bulletin-edit-title"
              className="text-sm font-semibold text-ink-900"
            >
              Edit draft for {recipientName}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5 truncate">
              To: {recipientEmail ?? "(no email on file)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-ink-500 hover:text-ink-900 shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div>
            <label
              htmlFor="email-bulletin-subject"
              className="block text-xs font-medium text-ink-700 mb-1"
            >
              Subject
            </label>
            <input
              id="email-bulletin-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={300}
              className="w-full text-sm border border-line rounded px-3 py-2 bg-canvas text-ink-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="email-bulletin-body"
              className="block text-xs font-medium text-ink-700 mb-1"
            >
              Body
            </label>
            <textarea
              id="email-bulletin-body"
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20_000}
              className="w-full text-sm border border-line rounded px-3 py-2 bg-canvas text-ink-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent leading-relaxed"
            />
            <p className="text-2xs text-ink-400 mt-1 tabular-nums">
              {body.length} / 20,000
            </p>
          </div>
        </div>
        <footer className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-sunken/30">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={!subject.trim() || !body.trim()}
          >
            Save edits
          </Button>
        </footer>
      </div>
    </div>
  );
}
