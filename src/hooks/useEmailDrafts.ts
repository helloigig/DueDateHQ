import { useStore, actions } from "../data/store";
import type { EmailDraft } from "../types";
import { trpc } from "../lib/api/client";
import { env } from "../config";

/**
 * Email drafts for a task, optionally narrowed to a client. tRPC's
 * `emails.listForTask` is per-task; the broader `clientId`-only query
 * stays mock-driven because the BE doesn't surface a per-client list yet
 * (Phase 1 — the FE consumer for that is the unread-bell, not a critical
 * path).
 */
export function useEmailDrafts(filter?: {
  taskId?: string;
  clientId?: string;
}): EmailDraft[] {
  const { emailDrafts: storeDrafts } = useStore();
  const taskQuery = trpc.emails.listForTask.useQuery(
    { taskId: filter?.taskId ?? "" },
    { enabled: !!filter?.taskId, staleTime: 15_000 },
  );

  if (env.useMockData) {
    if (!filter) return storeDrafts;
    return storeDrafts.filter((d) => {
      if (filter.taskId && d.taskId !== filter.taskId) return false;
      if (filter.clientId && d.clientId !== filter.clientId) return false;
      return true;
    });
  }

  if (filter?.taskId) {
    return taskQuery.data ?? [];
  }
  // Real mode without a taskId — empty list. Phase 1 adds emails.list.
  return [];
}

export function useSaveEmailDraft() {
  const utils = trpc.useUtils();
  const mutation = trpc.emails.saveDraft.useMutation({
    onSuccess: () => {
      void utils.emails.listForTask.invalidate();
    },
  });
  return (
    d: Omit<EmailDraft, "id" | "createdAt" | "status"> & {
      id?: string;
      status?: EmailDraft["status"];
    },
  ) => {
    if (env.useMockData) return actions.saveEmailDraft(d);
    mutation.mutate(d as never);
    return d.id ?? "";
  };
}

export function useSendEmail() {
  const utils = trpc.useUtils();
  const mutation = trpc.emails.send.useMutation({
    onSuccess: () => {
      void utils.emails.listForTask.invalidate();
      void utils.activity.listForTask.invalidate();
    },
  });
  return (id: string) => {
    if (env.useMockData) return actions.sendEmail(id);
    mutation.mutate({ id });
  };
}

export function useDiscardDraft() {
  const utils = trpc.useUtils();
  const mutation = trpc.emails.discard.useMutation({
    onSuccess: () => {
      void utils.emails.listForTask.invalidate();
    },
  });
  return (id: string) => {
    if (env.useMockData) return actions.discardEmailDraft(id);
    mutation.mutate({ id });
  };
}
