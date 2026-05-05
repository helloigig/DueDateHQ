import { toast } from "sonner";
import { useStore, actions } from "../data/store";
import type { ChecklistItem, DocumentState } from "../types";
import { buildChecklistsFromTasks } from "../data/mockChecklistItems";
import { buildTasksFromDeadlines } from "../data/mockTasks";
import { trpc } from "../lib/api/client";
import { env } from "../config";

/**
 * Ordered checklist for a Task. Real mode reads via `checklists.listForTask`;
 * mock mode keeps the store-with-lazy-build fallback so demos handle tasks
 * created from deadlines that weren't in the seed.
 */
export function useChecklist(taskId: string | undefined): ChecklistItem[] {
  const remote = trpc.checklists.listForTask.useQuery(
    { taskId: taskId ?? "" },
    { enabled: !!taskId && !env.useMockData, staleTime: 15_000 },
  );
  const { checklistItems, tasks, deadlines } = useStore();

  if (!taskId) return [];
  if (!env.useMockData) return remote.data ?? [];

  const items = checklistItems
    .filter((c) => c.taskId === taskId)
    .sort((a, b) => a.order - b.order);
  if (items.length > 0) return items;
  const task = tasks.find((t) => t.id === taskId);
  if (task) return [];
  const deadlineId = taskId.startsWith("t-") ? taskId.slice(2) : taskId;
  const d = deadlines.find((x) => x.id === deadlineId);
  if (!d) return [];
  const lazyTask = buildTasksFromDeadlines([d])[0];
  return buildChecklistsFromTasks([lazyTask]);
}

/**
 * Set state action — mocks dispatch through the store (which enforces the
 * §5.3 invariant client-side); real mode hits `checklists.setState` (which
 * is enforced again at app + DB layer). The `actor` arg is preserved for
 * mock-mode parity but always treated as "cpa" on the BE — system/AI writes
 * use the service-role connection.
 */
export function useSetChecklistItemState() {
  const utils = trpc.useUtils();
  const mutation = trpc.checklists.setState.useMutation({
    onSuccess: (_, vars) => {
      void utils.checklists.listForTask.invalidate();
      void utils.activity.listForTask.invalidate();
      void utils.tasks.get.invalidate();
      void utils.tasks.list.invalidate();
      // Suppress unused-var lint
      void vars;
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "couldn't update item";
      toast.error(`Update failed — ${message.slice(0, 120)}`);
    },
  });
  return (
    itemId: string,
    next: DocumentState,
    actor: "cpa" | "ai" | "system" = "cpa",
  ) => {
    if (env.useMockData) {
      actions.setChecklistItemState(itemId, next, actor);
      return;
    }
    mutation.mutate({ id: itemId, state: next });
  };
}

/**
 * Add a custom (user-authored) checklist item. The BE stamps
 * `addedByUserId = ctx.dbUser.id` so the row is identifiably non-template
 * and thus deletable via `useDeleteChecklistItem` below.
 */
export function useAddChecklistItem() {
  const utils = trpc.useUtils();
  const mutation = trpc.checklists.addCustom.useMutation({
    onSuccess: (_, vars) => {
      void utils.checklists.listForTask.invalidate({ taskId: vars.taskId });
      void utils.activity.listForTask.invalidate({ taskId: vars.taskId });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "couldn't add item";
      toast.error(`Add item failed — ${message.slice(0, 120)}`);
    },
  });
  return (taskId: string, label: string, itemType = "custom") => {
    if (env.useMockData) {
      actions.addChecklistItem(taskId, label, itemType);
    }
    mutation.mutate({ taskId, label, itemType });
  };
}

/**
 * Delete a custom checklist item. Template/system items are protected
 * server-side (FORBIDDEN); the FE should not surface the delete affordance
 * for them in the first place.
 */
export function useDeleteChecklistItem() {
  const utils = trpc.useUtils();
  const mutation = trpc.checklists.deleteCustom.useMutation({
    onSuccess: () => {
      void utils.checklists.listForTask.invalidate();
      void utils.activity.listForTask.invalidate();
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : "couldn't delete item";
      toast.error(`Delete failed — ${message.slice(0, 120)}`);
    },
  });
  return (itemId: string) => {
    if (env.useMockData) {
      actions.removeChecklistItem(itemId);
    }
    mutation.mutate({ id: itemId });
  };
}
