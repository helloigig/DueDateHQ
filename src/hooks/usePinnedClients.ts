import { useCallback, useEffect, useState } from "react";

const KEY = "duedatehq.pinned_clients.v1";
const MAX_PINNED = 8;

function readStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStorage(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

const STORAGE_EVENT = "duedatehq:pinned-clients-changed";

export function usePinnedClients() {
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readStorage());

  useEffect(() => {
    const handler = () => setPinnedIds(readStorage());
    window.addEventListener(STORAGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(STORAGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    writeStorage(next);
    setPinnedIds(next);
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }, []);

  const pin = useCallback(
    (clientId: string) => {
      const current = readStorage();
      if (current.includes(clientId)) return;
      const next = [clientId, ...current].slice(0, MAX_PINNED);
      persist(next);
    },
    [persist],
  );

  const unpin = useCallback(
    (clientId: string) => {
      const current = readStorage();
      if (!current.includes(clientId)) return;
      persist(current.filter((id) => id !== clientId));
    },
    [persist],
  );

  const toggle = useCallback(
    (clientId: string) => {
      const current = readStorage();
      if (current.includes(clientId)) {
        persist(current.filter((id) => id !== clientId));
      } else {
        persist([clientId, ...current].slice(0, MAX_PINNED));
      }
    },
    [persist],
  );

  const isPinned = useCallback(
    (clientId: string) => pinnedIds.includes(clientId),
    [pinnedIds],
  );

  return { pinnedIds, pin, unpin, toggle, isPinned, max: MAX_PINNED };
}
