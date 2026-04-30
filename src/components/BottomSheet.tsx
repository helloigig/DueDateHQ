import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Mobile bottom-sheet — slides up from the bottom of the viewport with
 * a backdrop dim. Bigger touch targets than a dropdown menu, no fiddly
 * positioning, dismiss via tap-outside / X / Esc.
 *
 * Used by row-level menus on mobile viewports (paired with the desktop
 * dropdown via useIsTouchViewport). Keeps interactions appropriate to
 * the input method without forking the action logic.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Visible title at the top of the sheet — short, action-oriented */
  title?: string;
  children: ReactNode;
}) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock body scroll while the sheet is open so the page doesn't move
  // under the user's finger
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Actions"}
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-ink-900/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-surface w-full sm:max-w-sm sm:rounded-lg rounded-t-xl border-t sm:border border-line shadow-overlay overflow-hidden"
        // Stop propagation so taps inside don't dismiss
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle (visual, not interactive yet) — signals "swipe-able"
            to mobile users even though we don't implement swipe-to-dismiss
            here. Just a Pinterest/iOS convention. */}
        <div className="sm:hidden pt-2 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-line" aria-hidden />
        </div>
        <header className="flex items-center px-4 py-2.5 border-b border-line">
          <h3 className="text-sm font-semibold text-ink-900">
            {title ?? "Actions"}
          </h3>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 -m-1.5 text-ink-500 hover:text-ink-900"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </header>
        <div className="py-2">{children}</div>
      </div>
    </div>
  );
}
