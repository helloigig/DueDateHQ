import { useStore, actions } from "../data/store";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import type { AiInsight } from "../types";

/**
 * AI insights for one client. Real mode reads via `aiInsights.listForClient`
 * (BE returns AiInsight[] from ai_inferences). Mock mode reads from store.
 */
export function useAiInsightsForClient(
  clientId: string | undefined,
): AiInsight[] {
  const { aiInsights } = useStore();
  const remote = trpc.aiInsights.listForClient.useQuery(
    { clientId: clientId ?? "" },
    { enabled: !!clientId && !env.useMockData, staleTime: 60_000 },
  );
  if (!clientId) return [];
  if (!env.useMockData) return remote.data ?? [];
  return aiInsights.filter((i) => i.clientId === clientId);
}

/** All open insights — used by triage queue / global insight strip. Mock-
 *  only for now (BE doesn't expose a firm-wide insights list yet — Phase 1
 *  with the cross-year-insighter sweep). */
export function useAllOpenInsights(): AiInsight[] {
  const { aiInsights } = useStore();
  return aiInsights.filter((i) => i.status === "open");
}

/** Per-client imported facts (arrival-timing / anomaly / cross-year baseline). Mock-only — Phase 1
 *  exposes via `importedFacts.listForClient`. */
export function useImportedFactsForClient(clientId: string | undefined) {
  const { importedFacts } = useStore();
  if (!clientId) return [];
  return importedFacts.filter((f) => f.clientId === clientId);
}

export function useAllImportedFacts() {
  const { importedFacts } = useStore();
  return importedFacts;
}

export function useResolveInsight() {
  // Mock-only — Phase 1 wires `aiInferences.resolve` mutation that
  // updates `was_acted_on` + writes the corresponding activity event.
  return (
    id: string,
    action: "ask_client" | "schedule_advisory" | "mark_known" | "snooze",
  ) => actions.resolveInsight(id, action);
}
