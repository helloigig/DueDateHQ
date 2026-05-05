import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpc } from "../lib/api/client";

export interface TriageFilters {
  dayFilter?: string;
}

/**
 * Shared error-toast helper. Yuqi audit 2026-05-05 — deadline mutations
 * were fire-and-forget; a BE failure looked exactly like success.
 */
function toastMutationError(verb: string) {
  return (err: unknown) => {
    const message = err instanceof Error ? err.message : `couldn't ${verb}`;
    toast.error(`${verb} failed — ${message.slice(0, 120)}`);
  };
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
  return trpc.deadlines.updateStatus.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("update deadline"),
  });
}

export function useDeferDeadline() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.defer.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("defer deadline"),
  });
}

export function useFileExtension() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.fileExtension.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("file extension"),
  });
}

export function useMarkExtensionApproved() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.markExtensionApproved.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("mark extension approved"),
  });
}

export function useBatchAdjustDeadlines() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.batchAdjust.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("adjust deadlines"),
  });
}

export function useQuickAddDeadline() {
  const invalidate = useInvalidateDeadlines();
  return trpc.deadlines.quickAdd.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("add deadline"),
  });
}
