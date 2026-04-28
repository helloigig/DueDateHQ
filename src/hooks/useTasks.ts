import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

function useInvalidateTaskFamily() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["tasks"]] });
    qc.invalidateQueries({ queryKey: [["clients"]] });
    qc.invalidateQueries({ queryKey: [["deadlines"]] });
    qc.invalidateQueries({ queryKey: [["dashboard"]] });
  };
}

export function useTask(taskId: string | undefined) {
  return trpc.tasks.get.useQuery({ id: taskId ?? "" }, { enabled: !!taskId });
}

export function useTaskActivity(taskId: string | undefined) {
  return trpc.tasks.activity.useQuery({ id: taskId ?? "" }, { enabled: !!taskId });
}

export function useTaskInsights(taskId: string | undefined) {
  return trpc.tasks.aiInsights.useQuery({ id: taskId ?? "" }, { enabled: !!taskId });
}

export function useMarkTaskComplete() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.tasks.markComplete.useMutation({ onSuccess: invalidate });
}

export function useSimulateInbound() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.tasks.simulateInbound.useMutation({ onSuccess: invalidate });
}

export function useConfirmChecklistItem() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.checklistItems.confirm.useMutation({ onSuccess: invalidate });
}

export function useRejectChecklistItem() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.checklistItems.reject.useMutation({ onSuccess: invalidate });
}

export function useMarkChecklistItemNotApplicable() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.checklistItems.markNotApplicable.useMutation({
    onSuccess: invalidate,
  });
}

export function useRestoreChecklistItem() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.checklistItems.restore.useMutation({ onSuccess: invalidate });
}

export function useCreateChecklistItem() {
  const invalidate = useInvalidateTaskFamily();
  return trpc.checklistItems.create.useMutation({ onSuccess: invalidate });
}
