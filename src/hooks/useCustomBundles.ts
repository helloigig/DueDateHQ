/**
 * useCustomBundles — firm-custom service packages, layered on top of the
 * system BUNDLES catalog. MVP shape: persisted to localStorage so the
 * CPA's tweaks survive page refresh without round-tripping to a backend
 * table that doesn't exist yet.
 *
 * When the backend ships `firm_service_bundles` (Phase 2), swap the
 * implementation for tRPC mutations — the public hook surface stays the
 * same so callers don't change.
 */
import { useCallback, useEffect, useState } from "react";
import type { FilingBundle } from "../data/bundles";

const STORAGE_KEY = "ddhq:custom-bundles:v1";

function readBundles(): FilingBundle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FilingBundle[];
  } catch {
    return [];
  }
}

function writeBundles(bundles: FilingBundle[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bundles));
}

export function useCustomBundles() {
  const [bundles, setBundles] = useState<FilingBundle[]>(() => readBundles());

  // Cross-tab sync — if the CPA edits packages in two tabs, both stay
  // current. Cheap, no listener teardown footguns.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setBundles(readBundles());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const upsert = useCallback((bundle: FilingBundle) => {
    setBundles((prev) => {
      const existing = prev.findIndex((b) => b.id === bundle.id);
      const next =
        existing >= 0
          ? prev.map((b, i) => (i === existing ? bundle : b))
          : [...prev, bundle];
      writeBundles(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setBundles((prev) => {
      const next = prev.filter((b) => b.id !== id);
      writeBundles(next);
      return next;
    });
  }, []);

  return { bundles, upsert, remove };
}
