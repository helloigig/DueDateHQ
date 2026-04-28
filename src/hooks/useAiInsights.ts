import { useStore, actions } from "../data/store";

export function useAiInsightsForClient(clientId: string | undefined) {
  const { aiInsights } = useStore();
  if (!clientId) return [];
  return aiInsights.filter((i) => i.clientId === clientId);
}

export function useAllOpenInsights() {
  const { aiInsights } = useStore();
  return aiInsights.filter((i) => i.status === "open");
}

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
  return (
    id: string,
    action: "ask_client" | "schedule_advisory" | "mark_known" | "snooze"
  ) => actions.resolveInsight(id, action);
}
