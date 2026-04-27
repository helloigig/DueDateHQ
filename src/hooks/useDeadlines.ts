import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

export interface TriageFilters {
  dayFilter?: string;
}

export function useTriageDeadlines(filters: TriageFilters = {}) {
  return trpc.deadlines.listForTriage.useQuery({ filters });
}

export function useDeadlinesForClient(clientId: string | undefined) {
  return trpc.deadlines.listForClient.useQuery(
    { clientId: clientId ?? "" },
    { enabled: !!clientId }
  );
}

export function useInvalidateDeadlines() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["deadlines"]] });
    qc.invalidateQueries({ queryKey: [["clients"]] });
  };
}

export function useSetDeadlineStatus() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.updateStatus.useMutation({ onSuccess: invalidate });
}

export function useDeferDeadline() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.defer.useMutation({ onSuccess: invalidate });
}

export function useFileExtension() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.fileExtension.useMutation({ onSuccess: invalidate });
}

export function useMarkExtensionApproved() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.markExtensionApproved.useMutation({
    onSuccess: invalidate,
  });
}

export function useBatchAdjustDeadlines() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.batchAdjust.useMutation({ onSuccess: invalidate });
}

export function useQuickAddDeadline() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.quickAdd.useMutation({ onSuccess: invalidate });
}
