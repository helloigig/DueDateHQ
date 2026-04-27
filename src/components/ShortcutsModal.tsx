import { useModalDialog } from "../hooks/useModalDialog";

export interface ShortcutDoc {
  keys: string[];
  label: string;
}

export function ShortcutsModal({
  open,
  onClose,
  shortcuts,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: ShortcutDoc[];
}) {
  const dialogRef = useModalDialog(open, onClose);

  if (!open) return null;

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
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-md shadow-overlay border border-line w-full max-w-md mx-4 outline-none"
      >
        <header className="px-5 py-4 border-b border-line">
          <h2
            id="shortcuts-title"
            className="text-sm font-semibold text-ink-900"
          >
            Keyboard shortcuts
          </h2>
        </header>
        <ul className="px-5 py-4 text-sm space-y-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="flex-1 text-ink-700">{s.label}</span>
              <span className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="px-1.5 py-0.5 rounded border border-line text-2xs font-mono bg-sunken text-ink-900"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <footer className="px-5 py-3 border-t border-line flex items-center justify-end">
          <button
            onClick={onClose}
            data-autofocus
            className="text-sm px-3 py-1.5 rounded-md border border-line text-ink-700 hover:bg-sunken"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
