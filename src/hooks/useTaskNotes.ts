/**
 * Per-task note feed hooks. Mirrors the client-notes API shape so the
 * panel UX (pinned-first, hard-delete with FE-side <24h safety net)
 * can be reused. Real-mode hits `taskNotes.*`; mock-mode bounces through
 * the local store for offline demos.
 */
import { useStore, actions } from "../data/store";
import type { TaskNote } from "../types";
import { trpc } from "../lib/api/client";
import { env } from "../config";

export function useTaskNotes(taskId: string | undefined): TaskNote[] {
  const remote = trpc.taskNotes.listForTask.useQuery(
    { taskId: taskId ?? "" },
    { enabled: !!taskId && !env.useMockData, staleTime: 15_000 },
  );
  const { taskNotes } = useStore();

  if (!taskId) return [];
  if (!env.useMockData) return remote.data ?? [];
  return taskNotes
    .filter((n) => n.taskId === taskId)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

function useInvalidateNotes(taskId?: string) {
  const utils = trpc.useUtils();
  return () => {
    if (taskId) {
      void utils.taskNotes.listForTask.invalidate({ taskId });
    } else {
      void utils.taskNotes.listForTask.invalidate();
    }
  };
}

export function useAddTaskNote(taskId: string) {
  const invalidate = useInvalidateNotes(taskId);
  const mutation = trpc.taskNotes.add.useMutation({ onSuccess: invalidate });
  return (body: string, pinned = false) => {
    if (!body.trim()) return;
    if (env.useMockData) {
      actions.addTaskNote(taskId, body, pinned);
    }
    mutation.mutate({ taskId, body: body.trim(), pinned });
  };
}

export function useToggleTaskNotePin(taskId: string) {
  const invalidate = useInvalidateNotes(taskId);
  const mutation = trpc.taskNotes.togglePin.useMutation({
    onSuccess: invalidate,
  });
  return (noteId: string) => {
    if (env.useMockData) {
      actions.toggleTaskNotePin(noteId);
    }
    mutation.mutate({ id: noteId });
  };
}

export function useDeleteTaskNote(taskId: string) {
  const invalidate = useInvalidateNotes(taskId);
  const mutation = trpc.taskNotes.delete.useMutation({ onSuccess: invalidate });
  return (noteId: string) => {
    if (env.useMockData) {
      actions.deleteTaskNote(noteId);
    }
    mutation.mutate({ id: noteId });
  };
}
