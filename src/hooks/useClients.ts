import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

export interface ClientFilters {
  search?: string;
  state?: string[];
  entityType?: string[];
  status?: string[];
  hasDeadlineThisWeek?: boolean;
}

export function useClients(filters: ClientFilters = {}) {
  return trpc.clients.list.useQuery(filters);
}

export function useClient(id: string | undefined) {
  return trpc.clients.get.useQuery({ id: id ?? "" }, { enabled: !!id });
}

export function useInvalidateClients() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["clients"]] });
    qc.invalidateQueries({ queryKey: [["deadlines"]] });
  };
}

export function useCreateClient() {
  const invalidate = useInvalidateClients();
  return trpc.clients.create.useMutation({ onSuccess: invalidate });
}

export function useUpdateClient() {
  const invalidate = useInvalidateClients();
  return trpc.clients.update.useMutation({ onSuccess: invalidate });
}

export function useArchiveClient() {
  const invalidate = useInvalidateClients();
  return trpc.clients.archive.useMutation({ onSuccess: invalidate });
}

export function useAssignBundle() {
  const invalidate = useInvalidateClients();
  return trpc.clients.assignBundle.useMutation({ onSuccess: invalidate });
}

export function useUnassignBundle() {
  const invalidate = useInvalidateClients();
  return trpc.clients.unassignBundle.useMutation({ onSuccess: invalidate });
}

export function useAddNote() {
  const invalidate = useInvalidateClients();
  return trpc.clients.addNote.useMutation({ onSuccess: invalidate });
}

export function useToggleNotePin() {
  const invalidate = useInvalidateClients();
  return trpc.clients.toggleNotePin.useMutation({ onSuccess: invalidate });
}

export function useDeleteNote() {
  const invalidate = useInvalidateClients();
  return trpc.clients.deleteNote.useMutation({ onSuccess: invalidate });
}
