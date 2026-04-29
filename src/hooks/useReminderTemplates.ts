import { useStore, actions } from "../data/store";
import type { ReminderTemplate } from "../types";

export function useReminderTemplates() {
  const { reminderTemplates } = useStore();
  return reminderTemplates;
}

export function useUpdateReminderTemplate() {
  return (id: string, patch: Partial<ReminderTemplate>) =>
    actions.updateReminderTemplate(id, patch);
}
