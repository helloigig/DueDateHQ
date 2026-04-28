import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

export function useReminderTemplates() {
  return trpc.reminderTemplates.list.useQuery();
}

export function useUpdateReminderTemplate() {
  const qc = useQueryClient();
  return trpc.reminderTemplates.update.useMutation({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [["reminderTemplates"]] });
    },
  });
}
