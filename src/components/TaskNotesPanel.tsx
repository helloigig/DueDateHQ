/**
 * TaskNotesPanel — per-task note feed.
 *
 * Distinct from ClientNotes (cross-engagement context). A task note
 * captures judgment scoped to a specific filing — "client says K-1
 * will arrive late", "extension OK if WSP doesn't respond by Friday".
 * Pinning + author attribution + hard-delete with FE-side <24h safety
 * net (mirrors the client-notes UX intentionally).
 *
 * Renders inline on TaskDetail. Compact: pinned-first, ascending
 * recency once pinned (oldest pinned at top — historical reading order).
 */
import { useMemo, useState } from "react";
import { Pin, PinOff, Trash2, StickyNote } from "lucide-react";
import {
  useAddTaskNote,
  useDeleteTaskNote,
  useTaskNotes,
  useToggleTaskNotePin,
} from "../hooks/useTaskNotes";
import type { TaskNote } from "../types";

interface Props {
  taskId: string;
}

export function TaskNotesPanel({ taskId }: Props) {
  const notes = useTaskNotes(taskId);
  const addNote = useAddTaskNote(taskId);
  const togglePin = useToggleTaskNotePin(taskId);
  const deleteNote = useDeleteTaskNote(taskId);

  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      // Newest first when reading; pinned still floats above.
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [notes]);

  // Default fold: show pinned + newest 3. Reduces ambient noise.
  const visible = useMemo(() => {
    if (showAll) return sorted;
    const pinned = sorted.filter((n) => n.pinned);
    const recent = sorted.filter((n) => !n.pinned).slice(0, 3);
    return [...pinned, ...recent];
  }, [sorted, showAll]);

  const onSubmit = (pinned: boolean) => {
    const body = draft.trim();
    if (!body) return;
    addNote(body, pinned);
    setDraft("");
  };

  return (
    <section
      aria-labelledby="task-notes-heading"
      className="bg-surface border border-line rounded-md overflow-hidden"
    >
      <header className="flex items-center px-4 py-2.5 border-b border-line gap-2">
        <StickyNote className="w-3.5 h-3.5 text-ink-500" aria-hidden />
        <h2
          id="task-notes-heading"
          className="text-xs font-semibold uppercase tracking-wider text-ink-700"
        >
          Notes
        </h2>
        <span className="text-2xs text-ink-500 tabular-nums">
          {notes.length}
        </span>
        <span className="ml-auto text-2xs text-ink-400">
          Firm-internal · scoped to this task
        </span>
      </header>

      <div className="px-4 py-3 border-b border-line">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Add a note for this task — context, judgment, decisions…"
          className="w-full text-sm border border-line rounded px-2 py-1.5 bg-surface resize-y focus:outline-none focus:ring-2 focus:ring-accent/30"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit(false);
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-2xs text-ink-400">
            ⌘↩ to add. Notes never leave the firm.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSubmit(true)}
              disabled={!draft.trim()}
              className="text-xs px-2.5 py-1 rounded border border-line text-ink-700 hover:bg-sunken disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <Pin className="w-3 h-3" aria-hidden /> Pin
            </button>
            <button
              onClick={() => onSubmit(false)}
              disabled={!draft.trim()}
              className="text-xs px-3 py-1 rounded bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add note
            </button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-ink-500">
          No notes yet for this task.
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              onTogglePin={() => togglePin(n.id)}
              onDelete={() => {
                if (
                  window.confirm(
                    "Delete this note? This can't be undone after a few seconds."
                  )
                ) {
                  deleteNote(n.id);
                }
              }}
            />
          ))}
        </ul>
      )}

      {!showAll && sorted.length > visible.length && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-4 py-2 text-xs text-ink-500 hover:text-ink-900 hover:bg-sunken/50 border-t border-line"
        >
          Show all {sorted.length} notes
        </button>
      )}
    </section>
  );
}

function NoteRow({
  note,
  onTogglePin,
  onDelete,
}: {
  note: TaskNote;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const ts = new Date(note.createdAt);
  const time = ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li
      className={
        "px-4 py-2.5 group " +
        (note.pinned ? "bg-warn-bg/30" : "bg-surface")
      }
    >
      <div className="flex items-center gap-2 text-2xs text-ink-500 mb-1">
        {note.pinned && (
          <span className="text-warn-ink font-medium inline-flex items-center gap-0.5">
            <Pin className="w-3 h-3" aria-hidden /> Pinned
          </span>
        )}
        <span>{time}</span>
        <span className="text-ink-300">·</span>
        <span>{note.authorName}</span>
        <span className="ml-auto inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onTogglePin}
            className="text-ink-400 hover:text-warn-ink p-1"
            title={note.pinned ? "Unpin" : "Pin"}
          >
            {note.pinned ? (
              <PinOff className="w-3 h-3" aria-hidden />
            ) : (
              <Pin className="w-3 h-3" aria-hidden />
            )}
          </button>
          <button
            onClick={onDelete}
            className="text-ink-400 hover:text-danger-ink p-1"
            title="Delete note"
          >
            <Trash2 className="w-3 h-3" aria-hidden />
          </button>
        </span>
      </div>
      <p className="text-sm text-ink-700 whitespace-pre-wrap">{note.body}</p>
    </li>
  );
}
