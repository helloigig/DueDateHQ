import { useStore, actions } from "../data/store";
import type { Task, TaskStatus } from "../types";
import { buildTasksFromDeadlines } from "../data/mockTasks";
import { trpc } from "../lib/api/client";
import { env } from "../config";

/** All tasks (for filters / lists). */
export function useTasks(): Task[] {
  const query = trpc.tasks.list.useQuery(undefined, {
    staleTime: 30_000,
  });
  return query.data ?? [];
}

/** Lookup one task. Falls back to lazily building from the matching
 *  Deadline if the seeded task list is out of sync. Mock-mode behavior
 *  is preserved; real-mode reads via `tasks.get`. */
export function useTask(taskId: string | undefined): Task | undefined {
  const { tasks: storeTasks, deadlines } = useStore();
  const remote = trpc.tasks.get.useQuery(
    { id: taskId ?? "" },
    { enabled: !!taskId && !env.useMockData, staleTime: 30_000 },
  );
  if (!taskId) return undefined;
  if (!env.useMockData) return remote.data ?? undefined;

  // Mock-mode lookup with the lazy-build fallback.
  const task = storeTasks.find((t) => t.id === taskId);
  if (task) return task;
  const deadlineId = taskId.startsWith("t-") ? taskId.slice(2) : taskId;
  const d = deadlines.find((x) => x.id === deadlineId);
  if (!d) return undefined;
  return buildTasksFromDeadlines([d])[0];
}

/** Tasks for a single client. */
export function useTasksForClient(clientId: string | undefined): Task[] {
  const query = trpc.tasks.list.useQuery(
    { clientId: clientId ?? "" },
    { enabled: !!clientId, staleTime: 30_000 },
  );
  return query.data ?? [];
}

/**
 * Common invalidator for any task mutation — refreshes the task row,
 * the per-client list, the cross-client list, and the activity feed.
 * Hooks below all share this so the UI feels coherent post-mutation.
 */
function useInvalidateTask() {
  const utils = trpc.useUtils();
  return () => {
    void utils.tasks.list.invalidate();
    void utils.tasks.get.invalidate();
    void utils.activity.listForTask.invalidate();
  };
}

/**
 * Returns a function that updates a task's status. Used by the simple
 * progress verbs (Not started / In progress) that don't carry payload.
 * Defer / FileExtension / MarkNotApplicable have dedicated hooks below.
 */
export function useUpdateTaskStatus() {
  const invalidate = useInvalidateTask();
  const mutation = trpc.tasks.updateStatus.useMutation({
    onSuccess: invalidate,
  });
  return (taskId: string, status: TaskStatus) => {
    if (env.useMockData) {
      // Optimistic store update so the FE feels instant in mock mode.
      actions.updateTaskStatus(taskId, status);
    }
    mutation.mutate({ id: taskId, status });
  };
}

/** Reassign preparer / reviewer. Pass `undefined` to leave a field
 *  unchanged; `null` to un-assign; uuid to set. */
export function useReassignTask() {
  const invalidate = useInvalidateTask();
  const mutation = trpc.tasks.assign.useMutation({ onSuccess: invalidate });
  return (
    taskId: string,
    patch: {
      preparerUserId?: string | null;
      reviewerUserId?: string | null;
    },
  ) => {
    if (env.useMockData) {
      // Mock store keeps display names; pass through the id strings so
      // the demo works without a real team. The mock adapter resolves
      // these via session for the signed-in user.
      actions.assignTask(taskId, {
        preparer:
          patch.preparerUserId === undefined ? undefined : patch.preparerUserId,
        reviewer:
          patch.reviewerUserId === undefined ? undefined : patch.reviewerUserId,
      });
    }
    mutation.mutate({ id: taskId, ...patch });
  };
}

/** Defer the working date. Cascades to deadline. */
export function useDeferTask() {
  const invalidate = useInvalidateTask();
  const utils = trpc.useUtils();
  const mutation = trpc.tasks.defer.useMutation({
    onSuccess: () => {
      invalidate();
      void utils.deadlines.listForTriage.invalidate();
      void utils.deadlines.listForClient.invalidate();
    },
  });
  return (taskId: string, newDate: string, reason?: string) => {
    if (env.useMockData) {
      actions.deferTask(taskId, newDate, reason);
    }
    mutation.mutate({ id: taskId, newDate, reason });
  };
}

/** Mark extension filed. Cascades to deadline. */
export function useFileExtensionForTask() {
  const invalidate = useInvalidateTask();
  const utils = trpc.useUtils();
  const mutation = trpc.tasks.fileExtension.useMutation({
    onSuccess: () => {
      invalidate();
      void utils.deadlines.listForTriage.invalidate();
      void utils.deadlines.listForClient.invalidate();
    },
  });
  return (taskId: string) => {
    if (env.useMockData) {
      actions.fileTaskExtension(taskId);
    }
    mutation.mutate({ id: taskId });
  };
}

/** Mark the task not applicable. Reason is required (audit). */
export function useMarkTaskNotApplicable() {
  const invalidate = useInvalidateTask();
  const mutation = trpc.tasks.markNotApplicable.useMutation({
    onSuccess: invalidate,
  });
  return (taskId: string, reason: string) => {
    if (env.useMockData) {
      actions.markTaskNotApplicable(taskId, reason);
    }
    mutation.mutate({ id: taskId, reason });
  };
}
