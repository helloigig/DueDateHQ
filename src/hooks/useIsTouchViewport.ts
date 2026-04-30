import { useEffect, useState } from "react";

/**
 * Returns true when the viewport is mobile-sized (≤ 640px wide, the
 * Tailwind `sm` breakpoint). Subscribes to resize so it stays accurate
 * on rotate / window-resize.
 *
 * Used by row-level menus (QuickMenu, AskClientMenu) to switch between
 * a desktop dropdown and a mobile bottom-sheet — bigger touch targets,
 * full-width drawer, no fiddly hover-to-find positioning.
 */
export function useIsTouchViewport(): boolean {
  const [isTouch, setIsTouch] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 640px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    // matchMedia.addEventListener exists in modern browsers; the legacy
    // addListener fallback covers Safari < 14.
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  return isTouch;
}
