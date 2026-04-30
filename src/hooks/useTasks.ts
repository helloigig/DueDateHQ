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
 * Returns a function that updates a task's status. tRPC handles both modes
 * via the mock adapter / real BE. After mutation, invalidates the relevant
 * `tasks.list` queries so the UI refreshes.
 */
export function useUpdateTaskStatus() {
  const utils = trpc.useUtils();
  const mutation = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => {
      void utils.tasks.list.invalidate();
    },
  });
  return (taskId: string, status: TaskStatus) => {
    if (env.useMockData) {
      // Optimistic store update so the FE feels instant in mock mode.
      actions.updateTaskStatus(taskId, status);
    }
    mutation.mutate({ id: taskId, status });
  };
}
