import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

export function useAnnouncements(opts: { activeOnly?: boolean } = {}) {
  return trpc.announcements.list.useQuery(opts);
}

export function useAnnouncement(id: string | undefined) {
  return trpc.announcements.get.useQuery(
    { id: id ?? "" },
    { enabled: !!id }
  );
}

export function useInvalidateAnnouncements() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["announcements"]] });
    qc.invalidateQueries({ queryKey: [["notifications"]] });
  };
}

export function useDismissAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return trpc.announcements.dismiss.useMutation({ onSuccess: invalidate });
}

export function useMarkAnnouncementRead() {
  const invalidate = useInvalidateAnnouncements();
  return trpc.announcements.markRead.useMutation({ onSuccess: invalidate });
}

export function useBatchAdjustFromAnnouncement() {
  const invalidate = useInvalidateAnnouncements();
  return trpc.announcements.batchAdjustDeadlines.useMutation({
    onSuccess: invalidate,
  });
}

export function useDetectAnnouncements() {
  const invalidate = useInvalidateAnnouncements();
  return trpc.announcements.detect.useMutation({ onSuccess: invalidate });
}
