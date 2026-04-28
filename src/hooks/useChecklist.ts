import { useStore, actions } from "../data/store";
import type { DocumentState } from "../types";
import { buildChecklistsFromTasks } from "../data/mockChecklistItems";
import { buildTasksFromDeadlines } from "../data/mockTasks";

/** Ordered checklist for a Task. Lazy-builds from the deadline if missing. */
export function useChecklist(taskId: string | undefined) {
  const { checklistItems, tasks, deadlines } = useStore();
  if (!taskId) return [];
  const items = checklistItems
    .filter((c) => c.taskId === taskId)
    .sort((a, b) => a.order - b.order);
  if (items.length > 0) return items;
  // Fallback for tasks not in the seed (e.g., a deadline added later).
  const task = tasks.find((t) => t.id === taskId);
  if (task) return [];
  const deadlineId = taskId.startsWith("t-") ? taskId.slice(2) : taskId;
  const d = deadlines.find((x) => x.id === deadlineId);
  if (!d) return [];
  const lazyTask = buildTasksFromDeadlines([d])[0];
  return buildChecklistsFromTasks([lazyTask]);
}

/** Set state action — enforces PRD §5.3 invariant via the store. */
export function useSetChecklistItemState() {
  return (
    itemId: string,
    next: DocumentState,
    actor: "cpa" | "ai" | "system" = "cpa"
  ) => actions.setChecklistItemState(itemId, next, actor);
}

export function useAddChecklistItem() {
  return (taskId: string, label: string, itemType = "custom") =>
    actions.addChecklistItem(taskId, label, itemType);
}
