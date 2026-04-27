import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "../lib/api/client";

export function useNotifications() {
  return trpc.notifications.list.useQuery(undefined);
}

export function useInvalidateNotifications() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [["notifications"]] });
  };
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return trpc.notifications.markRead.useMutation({ onSuccess: invalidate });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return trpc.notifications.markAllRead.useMutation({
    onSuccess: invalidate,
  });
}
