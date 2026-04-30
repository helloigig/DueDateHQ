/**
 * Bridges Supabase auth events to the local FirmSession used by FE routing.
 *
 * Without this bridge: clicking a magic-link in email leaves Supabase signed
 * in (tokens in URL hash) but the local FirmSession (data/session.ts) empty
 * → SessionProvider redirects back to /login. This bridge picks up Supabase
 * auth events from any source (magic link, OAuth callback) and creates the
 * local session uniformly.
 *
 * Fires on:
 *   - SIGNED_IN — magic-link tokens extracted from URL hash, OAuth callback
 *   - INITIAL_SESSION — page load with persisted Supabase session
 *   - SIGNED_OUT — supabase.auth.signOut() called from anywhere
 *
 * Idempotent: skips work when local session already matches Supabase email.
 *
 * Foundation for:
 *   - Google OAuth login (signInWithOAuth({provider: "google"}) — same flow)
 *   - Microsoft / GitHub / SSO providers (any OAuth completes via SIGNED_IN)
 *   - Refresh-token auto-renewal (Supabase fires TOKEN_REFRESHED; we ignore
 *     since local session doesn't track JWT itself)
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { signIn, signOut, getSession } from "../data/session";
import { trpc } from "./api/client";
import { env } from "../config";

export function SupabaseAuthBridge() {
  const navigate = useNavigate();
  const trpcUtils = trpc.useUtils();

  useEffect(() => {
    // Mock auth: nothing to bridge — local session is the source of truth.
    if (env.useMockAuth) return;

    const { data: subscription } = supabase().auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          signOut();
          return;
        }
        if (
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          session?.user
        ) {
          // Skip if local session already matches — avoids redundant remote
          // fetches on every page reload.
          const localSession = getSession();
          if (
            localSession &&
            localSession.userEmail === session.user.email
          ) {
            return;
          }

          const userEmail = session.user.email ?? "";
          const userMeta = (session.user.user_metadata ?? {}) as Record<
            string,
            unknown
          >;
          // Google OAuth populates `full_name` + `name`; magic-link only has
          // email. Fall back to the email localpart so the UI has something
          // to render until the user fills in their real name in onboarding.
          const userName =
            (userMeta.full_name as string | undefined) ??
            (userMeta.name as string | undefined) ??
            userEmail.split("@")[0] ??
            "";

          try {
            const remote = await trpcUtils.auth.session.fetch();
            if (remote) {
              // Returning user — firm exists, skip onboarding.
              signIn({
                firmName: remote.firm.name,
                userName: remote.user.displayName ?? userName,
                userEmail: remote.user.email,
                tier: remote.firm.tier,
              });
              // Only redirect away from auth pages; deep links stay put.
              const path = window.location.pathname;
              if (
                path === "/login" ||
                path === "/signup" ||
                path.startsWith("/magic-link") ||
                path.startsWith("/auth/")
              ) {
                navigate("/", { replace: true });
              }
            } else {
              // First-time sign-in — set _pending firm, send to onboarding.
              signIn({
                firmName: "_pending",
                userName,
                userEmail,
                tier: "pro",
              });
              const path = window.location.pathname;
              if (!path.startsWith("/onboarding")) {
                navigate("/onboarding/firm", { replace: true });
              }
            }
          } catch (err) {
            // BE unreachable (offline backend, network blip). Don't strand
            // the user on /login — Supabase confirms the auth, so we can
            // honour the sign-in locally with a _pending firm and route
            // them through onboarding. Once the BE comes back, the next
            // session.fetch will populate the real firm.
            // eslint-disable-next-line no-console
            console.error("supabase-auth-bridge.fetch_session_failed", err);
            signIn({
              firmName: "_pending",
              userName,
              userEmail,
              tier: "pro",
            });
            const path = window.location.pathname;
            if (
              path === "/login" ||
              path === "/signup" ||
              path.startsWith("/magic-link") ||
              path.startsWith("/auth/")
            ) {
              navigate("/onboarding/firm", { replace: true });
            }
          }
        }
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, [navigate, trpcUtils]);

  return null;
}
