import { trpc } from "../lib/api/client";

/**
 * Polls active announcements every 30s. When the backend ships Supabase
 * Realtime, swap the internals for a subscription — the hook signature
 * stays identical so consumers don't change.
 *
 * React Query already pauses polling when the tab is hidden and de-dupes
 * concurrent identical requests across the app.
 */
export function useRealtimeAnnouncements() {
  return trpc.announcements.list.useQuery(
    { activeOnly: true },
    {
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    }
  );
}
