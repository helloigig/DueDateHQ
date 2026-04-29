import { actions } from "../data/store";
import type { ReminderTemplate } from "../types";
import { trpc } from "../lib/api/client";

export function useReminderTemplates(): ReminderTemplate[] {
  const query = trpc.reminderTemplates.list.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  return query.data ?? [];
}

export function useUpdateReminderTemplate() {
  // Mock-only for now — the BE doesn't expose a per-firm template-update
  // procedure yet (Phase 1). In real mode this will be a tRPC mutation
  // routed to a `reminderTemplates.updateCustom` procedure.
  return (id: string, patch: Partial<ReminderTemplate>) =>
    actions.updateReminderTemplate(id, patch);
}
