import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

function useInvalidateIntegrationFamily() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["integrations"]] });
    qc.invalidateQueries({ queryKey: [["clients"]] });
    qc.invalidateQueries({ queryKey: [["dashboard"]] });
  };
}

export function useIntegrations() {
  return trpc.integrations.list.useQuery();
}

export function useAvailableIntegrations() {
  return trpc.integrations.available.useQuery();
}

export function useConnectIntegration() {
  const invalidate = useInvalidateIntegrationFamily();
  return trpc.integrations.connect.useMutation({ onSuccess: invalidate });
}

export function useSyncIntegration() {
  const invalidate = useInvalidateIntegrationFamily();
  return trpc.integrations.syncNow.useMutation({ onSuccess: invalidate });
}

export function useDisconnectIntegration() {
  const invalidate = useInvalidateIntegrationFamily();
  return trpc.integrations.disconnect.useMutation({ onSuccess: invalidate });
}
