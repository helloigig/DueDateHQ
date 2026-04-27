import { Search } from "lucide-react";
import { useModalDialog } from "../hooks/useModalDialog";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPaletteStub({ open, onClose }: Props) {
  const dialogRef = useModalDialog(open, onClose);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] flex items-start justify-center p-4 pt-32"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Search"
        className="bg-surface rounded-md shadow-overlay border border-line w-full max-w-lg outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <Search className="w-4 h-4 text-ink-400" aria-hidden />
          <input
            disabled
            placeholder="Search coming soon…"
            className="flex-1 bg-transparent text-sm text-ink-400 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="text-2xs text-ink-400 font-mono border border-line rounded px-1 py-0.5">esc</kbd>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-ink-700 font-medium">Command palette — coming soon</p>
          <p className="text-xs text-ink-500 mt-1">
            Will search clients, deadlines, and announcements.
          </p>
        </div>
      </div>
    </div>
  );
}
