import { useStore, actions } from "../data/store";
import type { EmailDraft } from "../types";
import { trpc } from "../lib/api/client";
import { env } from "../config";
import { toaster } from "../lib/toasts";

const RECALL_WINDOW_MS = 60_000;

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
  const recall = trpc.emails.recall.useMutation({
    onSuccess: () => {
      void utils.emails.listForTask.invalidate();
      void utils.activity.listForTask.invalidate();
    },
  });
  const mutation = trpc.emails.send.useMutation({
    onSuccess: (data) => {
      void utils.emails.listForTask.invalidate();
      void utils.activity.listForTask.invalidate();
      // Soft-recall affordance: 60s Undo toast that calls emails.recall.
      // Mirrors the BE's RECALL_WINDOW_MS so the toast disappears at
      // the moment the BE would refuse the recall.
      toaster.show({
        message: "Sent · 60s to undo",
        undoLabel: "Undo",
        undoAction: () => recall.mutate({ id: data.id }),
        durationMs: RECALL_WINDOW_MS,
      });
    },
  });
  return (id: string) => {
    if (env.useMockData) {
      actions.sendEmail(id);
      // Mock-mode parity: same Undo affordance, flips status back to draft.
      toaster.show({
        message: "Sent · 60s to undo",
        undoLabel: "Undo",
        undoAction: () => actions.recallEmail(id),
        durationMs: RECALL_WINDOW_MS,
      });
      return;
    }
    mutation.mutate({ id });
  };
}

/** Direct recall hook — for surfaces (e.g. Mail Outbox) that want a
 * standalone "Unsend" button instead of the post-send toast affordance.
 * Returns a function that recalls a sent draft if it's still inside the
 * recall window. Errors are surfaced via toast.
 */
export function useRecallEmail() {
  const utils = trpc.useUtils();
  const mutation = trpc.emails.recall.useMutation({
    onSuccess: () => {
      void utils.emails.listForTask.invalidate();
      void utils.activity.listForTask.invalidate();
      toaster.show({ message: "Recalled" });
    },
    onError: (err) => {
      const m = err.message;
      const reason =
        m.includes("recall_window_expired")
          ? "Recall window expired (60s after send)"
          : m.includes("not_in_recall_window")
            ? "This draft is no longer recallable"
            : `Couldn't recall — ${m.slice(0, 80)}`;
      toaster.show({ message: reason });
    },
  });
  return (id: string) => {
    if (env.useMockData) {
      actions.recallEmail(id);
      toaster.show({ message: "Recalled" });
      return;
    }
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
