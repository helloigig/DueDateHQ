import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

function useInvalidateEmailFamily() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["tasks"]] });
    qc.invalidateQueries({ queryKey: [["clients"]] });
    qc.invalidateQueries({ queryKey: [["deadlines"]] });
  };
}

export function useCreateEmailDraft() {
  return trpc.emailDrafts.create.useMutation();
}

export function useUpdateEmailDraft() {
  return trpc.emailDrafts.update.useMutation();
}

export function useSendEmailDraft() {
  const invalidate = useInvalidateEmailFamily();
  return trpc.emailDrafts.send.useMutation({ onSuccess: invalidate });
}

export function useScheduleEmailDraft() {
  const invalidate = useInvalidateEmailFamily();
  return trpc.emailDrafts.schedule.useMutation({ onSuccess: invalidate });
}

export function useDiscardEmailDraft() {
  return trpc.emailDrafts.discard.useMutation();
}

export function useRecallEmailDraft() {
  const invalidate = useInvalidateEmailFamily();
  return trpc.emailDrafts.recall.useMutation({ onSuccess: invalidate });
}
