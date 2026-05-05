import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { trpc } from "../lib/api/client";

/**
 * Shared error-toast helper. Yuqi audit 2026-05-05 — client mutations
 * were fire-and-forget; a BE failure looked exactly like success
 * (silent silent silent). Every mutation hook in this file now uses
 * this onError handler so every consumer fails loud.
 */
function toastMutationError(verb: string) {
  return (err: unknown) => {
    const message =
      err instanceof Error ? err.message : `couldn't ${verb}`;
    toast.error(`${verb} failed — ${message.slice(0, 120)}`);
  };
}

export interface ClientFilters {
  search?: string;
  state?: string[];
  entityType?: string[];
  status?: string[];
  tier?: string[];
  servicePackage?: string[];
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
  return trpc.clients.create.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("create client"),
  });
}

export function useUpdateClient() {
  const invalidate = useInvalidateClients();
  return trpc.clients.update.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("update client"),
  });
}

export function useArchiveClient() {
  const invalidate = useInvalidateClients();
  return trpc.clients.archive.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Client archived");
    },
    onError: toastMutationError("archive client"),
  });
}

export function useAssignBundle() {
  const invalidate = useInvalidateClients();
  return trpc.clients.assignBundle.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("assign service package"),
  });
}

export function useUnassignBundle() {
  const invalidate = useInvalidateClients();
  return trpc.clients.unassignBundle.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("remove service package"),
  });
}

export function useAddNote() {
  const invalidate = useInvalidateClients();
  return trpc.clients.addNote.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("add note"),
  });
}

export function useToggleNotePin() {
  const invalidate = useInvalidateClients();
  return trpc.clients.toggleNotePin.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("pin note"),
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidateClients();
  return trpc.clients.deleteNote.useMutation({
    onSuccess: () => {
      invalidate();
      toast.success("Note deleted");
    },
    onError: toastMutationError("delete note"),
  });
}
