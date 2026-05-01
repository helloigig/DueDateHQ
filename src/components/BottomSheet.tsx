import { type ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";

/**
 * Mobile bottom-sheet — slides up from the bottom of the viewport with
 * a backdrop dim. Bigger touch targets than a dropdown menu, no fiddly
 * positioning, dismiss via tap-outside / X / Esc.
 *
 * Used by row-level menus on mobile viewports (paired with the desktop
 * dropdown via useIsTouchViewport). Keeps interactions appropriate to
 * the input method without forking the action logic.
 *
 * Backed by Radix Dialog (via shadcn Sheet) for focus trap, scroll lock,
 * and keyboard handling.
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
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="p-0">
        {/* Drag handle (visual, not interactive yet) — signals "swipe-able"
            to mobile users even though we don't implement swipe-to-dismiss
            here. iOS / Pinterest convention. */}
        <div className="pt-2 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-line" aria-hidden />
        </div>
        <SheetHeader>
          <SheetTitle>{title ?? "Actions"}</SheetTitle>
        </SheetHeader>
        <div className="py-2">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
