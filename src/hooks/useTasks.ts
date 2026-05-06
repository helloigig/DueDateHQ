import { toast } from "sonner";
import { useStore, actions } from "../data/store";
import type { Task, TaskStatus } from "../types";
import { buildTasksFromDeadlines } from "../data/mockTasks";
import { trpc } from "../lib/api/client";
import { env } from "../config";

/**
 * Shared error-toast helper. Yuqi audit 2026-05-05 — task mutations
 * were fire-and-forget; a BE failure looked exactly like success.
 * Every mutation hook in this file now uses this onError handler so
 * every consumer (TaskActions, DeadlineChip, popovers, etc.) fails
 * loud instead of silent. Single point of repair.
 */
function toastMutationError(verb: string) {
  return (err: unknown) => {
    const message =
      err instanceof Error ? err.message : `couldn't ${verb}`;
    toast.error(`${verb} failed — ${message.slice(0, 120)}`);
  };
}

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
 * the per-client list, the cross-client list, the activity feed, and
 * the task milestones (so the cascade-down from `updateTaskStatus →
 * "completed"` is reflected in the Mini Timeline without a manual
 * refetch).
 *
 * Yuqi audit 2026-05-06: also invalidates `todoItems.list` so the
 * Action Queue on Today drops the row when a task moves to
 * "completed". The queue derives its rows from todoItems (PRD §4.8
 * nine sources), which is a separate query from `tasks.list` — without
 * this invalidation, a task marked complete in the Task panel would
 * stay in the queue until the next page refresh.
 */
function useInvalidateTask() {
  const utils = trpc.useUtils();
  return () => {
    void utils.tasks.list.invalidate();
    void utils.tasks.get.invalidate();
    void utils.activity.listForTask.invalidate();
    void utils.taskMilestones.listForTask.invalidate();
    void utils.taskMilestones.fleetStack.invalidate();
    void utils.todoItems.list.invalidate();
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
    onError: toastMutationError("update task status"),
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
  const mutation = trpc.tasks.assign.useMutation({
    onSuccess: invalidate,
    onError: toastMutationError("reassign task"),
  });
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
      toast.success("Working date deferred");
    },
    onError: toastMutationError("defer task"),
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
      toast.success("Extension filed · cascades to deadline");
    },
    onError: toastMutationError("file extension"),
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
    onSuccess: () => {
      invalidate();
      toast.success("Task marked not applicable");
    },
    onError: toastMutationError("mark not applicable"),
  });
  return (taskId: string, reason: string) => {
    if (env.useMockData) {
      actions.markTaskNotApplicable(taskId, reason);
    }
    mutation.mutate({ id: taskId, reason });
  };
}
