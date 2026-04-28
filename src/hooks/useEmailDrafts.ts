import { useStore, actions } from "../data/store";
import type { EmailDraft } from "../types";

export function useEmailDrafts(filter?: { taskId?: string; clientId?: string }) {
  const { emailDrafts } = useStore();
  if (!filter) return emailDrafts;
  return emailDrafts.filter((d) => {
    if (filter.taskId && d.taskId !== filter.taskId) return false;
    if (filter.clientId && d.clientId !== filter.clientId) return false;
    return true;
  });
}

export function useSaveEmailDraft() {
  return (
    d: Omit<EmailDraft, "id" | "createdAt" | "status"> & {
      id?: string;
      status?: EmailDraft["status"];
    }
  ) => actions.saveEmailDraft(d);
}

export function useSendEmail() {
  return (id: string) => actions.sendEmail(id);
}

export function useDiscardDraft() {
  return (id: string) => actions.discardEmailDraft(id);
}
