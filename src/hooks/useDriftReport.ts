/**
 * AI drift report — per-mode acceptance rate over time, with an alert
 * flag when the latest week drops >5pp below the trailing 4-week mean.
 * Mounted on /settings/ai when the surface ships; ops also reads it
 * directly via the BE.
 */
import { trpc } from "../lib/api/client";

export type AiMode = "A" | "B" | "C" | "D" | "E";

export function useDriftReport(mode?: AiMode) {
  return trpc.aiInferences.driftReport.useQuery(
    mode ? { mode } : undefined,
    {
      refetchInterval: 5 * 60_000,
    },
  );
}
