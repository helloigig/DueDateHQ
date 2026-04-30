/**
 * Hooks for the scraper reviewer queue + on-demand detect.
 *
 * Real mode hits the BE directly; mock mode dispatches via the
 * mock-adapter (currently returns empty for the queue, since the FE
 * mock store doesn't simulate the scraper).
 */
import { trpc } from "../lib/api/client";

export function useReviewerQueue() {
  return trpc.announcements.reviewerQueue.useQuery(undefined, {
    refetchInterval: 60_000,
  });
}

export function useApproveScraped() {
  const utils = trpc.useUtils();
  return trpc.announcements.approveScraped.useMutation({
    onSuccess: () => {
      void utils.announcements.reviewerQueue.invalidate();
      void utils.announcements.list.invalidate();
    },
  });
}

export function useRejectScraped() {
  const utils = trpc.useUtils();
  return trpc.announcements.rejectScraped.useMutation({
    onSuccess: () => {
      void utils.announcements.reviewerQueue.invalidate();
    },
  });
}

/**
 * Manual scrape trigger — useful when a state authority just published
 * a notice and the firm wants to check now rather than wait for the
 * hourly cycle.
 */
export function useManualDetect() {
  const utils = trpc.useUtils();
  return trpc.announcements.detect.useMutation({
    onSuccess: () => {
      void utils.announcements.list.invalidate();
      void utils.announcements.reviewerQueue.invalidate();
    },
  });
}
