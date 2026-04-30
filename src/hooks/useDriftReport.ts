/**
 * AI drift report — per-mode acceptance rate over time, with an alert
 * flag when the latest week drops >5pp below the trailing 4-week mean.
 * Mounted on /settings/ai for ops monitoring.
 */
import { trpc } from "../lib/api/client";

export type AiMode = "A" | "B" | "C" | "D" | "E" | "F";

export function useDriftReport(mode?: AiMode) {
  return trpc.aiInferences.driftReport.useQuery(
    mode ? { mode } : undefined,
    {
      refetchInterval: 5 * 60_000,
    },
  );
}

/**
 * All-modes overview — single fetch returning per-Mode summary stats
 * (acceptance / cost / p50-p95 latency). Drives the Settings → AI eval
 * all-modes table.
 */
export function useAiSummaryAll() {
  return trpc.aiInferences.summaryAll.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
}

/**
 * Whether the BE has an Anthropic API key configured. The FE reads
 * this so panels can render "AI not yet wired" honestly when the key
 * is missing — instead of letting calls throw mid-flow.
 */
export function useAiStatus() {
  return trpc.ai.status.useQuery(undefined, {
    refetchInterval: 5 * 60_000,
  });
}
