import { useEffect } from "react";

const TEXT_INPUTS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTypingContext(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return TEXT_INPUTS.has(target.tagName);
}

export interface Shortcut {
  key: string;
  shift?: boolean;
  meta?: boolean;
  description: string;
  handler: (e: KeyboardEvent) => void;
  allowInInput?: boolean;
}

export function useShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        if (e.key !== s.key) continue;
        if (!!s.shift !== e.shiftKey) continue;
        if (s.meta && !(e.metaKey || e.ctrlKey)) continue;
        if (!s.meta && (e.metaKey || e.ctrlKey)) continue;
        if (!s.allowInInput && isTypingContext(e.target)) continue;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
