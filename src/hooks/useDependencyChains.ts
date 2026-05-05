/**
 * useDependencyChains — firm-defined "wait for X before Y" rules.
 *
 * MVP coverage: PRD §3.13 ships the standard pre-built chains
 *   • 1065 → K-1 → 1040 (partnership filing must complete before partners
 *     can finalize 1040)
 *   • 1120-S → K-1 → 1040 (S-Corp counterpart)
 *
 * Custom chains let firms encode their own waiting relationships, e.g.
 * "Trust 1041 must complete before beneficiary 1040 K-1 reconciliation"
 * or "Bookkeeping close must finish before Q estimate calc."
 *
 * MVP store: localStorage. When the BE adds a `firm_dependency_chains`
 * table (Phase 2), swap implementation while keeping this hook surface.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ddhq:dep-chains:v1";

export type DependencyKind = "form" | "milestone" | "external";

export interface DependencyChain {
  id: string;
  name: string;
  /** Plain-English description shown in tooltips and audit trails. */
  description?: string;
  /** What must complete first. Examples: form="1065", milestone="books_close",
   *  external="bookkeeping team handoff". */
  waitFor: { kind: DependencyKind; ref: string };
  /** What can't progress until the wait-for is satisfied. */
  blocks: { kind: DependencyKind; ref: string };
  /** Hard chain blocks the dependent from moving past status="not_started";
   *  soft chain just shows a warning chip. */
  enforcement: "hard" | "soft";
  /** Days of buffer to add after the wait-for completes before the blocked
   *  task can start. 0 = immediately. */
  bufferDays: number;
  createdAt: string;
}

const SYSTEM_CHAINS: DependencyChain[] = [
  {
    id: "system-1065-k1-1040",
    name: "1065 → K-1 → 1040",
    description:
      "Partner can't finalize 1040 until partnership 1065 has filed and K-1s issue.",
    waitFor: { kind: "form", ref: "1065" },
    blocks: { kind: "form", ref: "1040" },
    enforcement: "hard",
    bufferDays: 0,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "system-1120-s-k1-1040",
    name: "1120-S → K-1 → 1040",
    description:
      "Shareholder can't finalize 1040 until S-Corp 1120-S has filed and K-1s issue.",
    waitFor: { kind: "form", ref: "1120-S" },
    blocks: { kind: "form", ref: "1040" },
    enforcement: "hard",
    bufferDays: 0,
    createdAt: "2026-01-01T00:00:00Z",
  },
];

function readCustom(): DependencyChain[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DependencyChain[]) : [];
  } catch {
    return [];
  }
}

function writeCustom(chains: DependencyChain[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chains));
}

export function useDependencyChains() {
  const [custom, setCustom] = useState<DependencyChain[]>(() => readCustom());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCustom(readCustom());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const upsert = useCallback((chain: DependencyChain) => {
    setCustom((prev) => {
      const idx = prev.findIndex((c) => c.id === chain.id);
      const next =
        idx >= 0
          ? prev.map((c, i) => (i === idx ? chain : c))
          : [...prev, chain];
      writeCustom(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setCustom((prev) => {
      const next = prev.filter((c) => c.id !== id);
      writeCustom(next);
      return next;
    });
  }, []);

  return {
    systemChains: SYSTEM_CHAINS,
    customChains: custom,
    allChains: [...SYSTEM_CHAINS, ...custom],
    upsert,
    remove,
  };
}
