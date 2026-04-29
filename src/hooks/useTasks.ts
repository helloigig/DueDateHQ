import { useStore, actions } from "../data/store";
import type { TaskStatus } from "../types";
import { buildTasksFromDeadlines } from "../data/mockTasks";

/** All tasks (for filters / lists). */
export function useTasks() {
  const { tasks } = useStore();
  return tasks;
}

/** Lookup one task. Falls back to lazily building from the matching
 *  Deadline if the seeded task list is out of sync (e.g., after import). */
export function useTask(taskId: string | undefined) {
  const { tasks, deadlines } = useStore();
  if (!taskId) return undefined;
  const task = tasks.find((t) => t.id === taskId);
  if (task) return task;
  // Fallback: derive from deadline (handles tasks added via new deadlines).
  const deadlineId = taskId.startsWith("t-") ? taskId.slice(2) : taskId;
  const d = deadlines.find((x) => x.id === deadlineId);
  if (!d) return undefined;
  return buildTasksFromDeadlines([d])[0];
}

/** Tasks for a single client. */
export function useTasksForClient(clientId: string | undefined) {
  const { tasks } = useStore();
  if (!clientId) return [];
  return tasks.filter((t) => t.clientId === clientId);
}

export function useUpdateTaskStatus() {
  return (taskId: string, status: TaskStatus) =>
    actions.updateTaskStatus(taskId, status);
}
