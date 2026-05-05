import {
  useSession as useLocalSession,
  type FirmSession,
} from "../data/session";
import { trpc } from "../lib/api/client";

/**
 * Server-side session (what the backend says). In mock mode this mirrors the
 * local firm identity. On real backend this becomes the source of truth.
 */
export function useRemoteSession() {
  return trpc.auth.session.useQuery(undefined, { staleTime: 60_000 });
}

export { useLocalSession as useSession };
export type { FirmSession };
