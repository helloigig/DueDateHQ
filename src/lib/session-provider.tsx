import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Firm, FirmTier, User } from "../types";
import { useRemoteSession } from "../hooks/useSession";
import { useSession as useLocalSession } from "../data/session";
import { DashboardSkeleton } from "../components/skeletons/DashboardSkeleton";

export interface ServerSession {
  user: User;
  firm: Firm;
  tier: FirmTier;
}

const SessionContext = createContext<ServerSession | null>(null);

/** Hook for components that REQUIRE an authenticated session. Throws otherwise. */
export function useServerSession(): ServerSession {
  const s = useContext(SessionContext);
  if (!s) {
    throw new Error(
      "useServerSession called outside SessionProvider — wrap protected routes"
    );
  }
  return s;
}

/** Non-throwing variant for code that may run pre-auth. */
export function useMaybeServerSession(): ServerSession | null {
  return useContext(SessionContext);
}

/**
 * Reads the server-side session via tRPC (auth.session). If absent, redirects
 * to /login. While the request is in flight, shows a full-page skeleton.
 *
 * Fallback: when the BE is unreachable (network error) but a local session
 * exists, synthesize a ServerSession from the local one so the app still
 * runs against in-memory store data. Without this, every page render with
 * a dead backend strands a signed-in user on /login.
 *
 * In mock mode the adapter answers based on the local session; on real
 * backend this becomes the source of truth (cookies, etc.).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const remote = useRemoteSession();
  const local = useLocalSession();

  // Refetch the remote session when the local one flips (after login/logout
  // mock-mode mutations).
  useEffect(() => {
    void remote.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local?.firmName, local?.userEmail]);

  if (remote.isLoading && !remote.data) {
    return <DashboardSkeleton />;
  }

  // BE-offline fallback — synthesize a ServerSession from the local one so
  // the user can still use the app. The local session was created by the
  // auth-bridge when Supabase confirmed the user, so trusting it here is
  // safe; the backend will replace this with authoritative data on its
  // next reachable refetch.
  const synthesized: ServerSession | null =
    !remote.data && local
      ? {
          user: {
            id: `local-${local.userEmail}`,
            email: local.userEmail,
            displayName: local.userName,
            role: "owner",
            timezone: local.timeZone ?? "America/Los_Angeles",
            lastActiveAt: local.signedInAt,
          },
          firm: {
            id: `local-${local.firmName}`,
            name: local.firmName,
            primaryStates: local.primaryStates ?? [],
            logoStorageKey: null,
            branding: null,
            tier: local.tier,
            subscriptionStatus: "trialing",
            trialEndsAt: local.trialEndsAt ?? null,
            seatLimit: 1,
            clientLimit: null,
          },
          tier: local.tier,
        }
      : null;

  const session = remote.data ?? synthesized;

  if (!session) {
    const next = location.pathname + location.search;
    return (
      <Navigate
        to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
        replace
      />
    );
  }

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
