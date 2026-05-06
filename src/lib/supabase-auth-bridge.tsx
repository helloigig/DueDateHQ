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
import { signIn, clearLocalSession, getSession } from "../data/session";
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
          // Mirror to local state ONLY — never call signOut() here. signOut()
          // calls supabase.auth.signOut(), which re-fires the SIGNED_OUT we
          // just received, recursing this listener and freezing the page.
          // The signOut button + cross-tab token expiry both eventually land
          // here; either way, just clear local state. If signOut() is
          // already running, it'll do the hard reload itself; otherwise
          // (cross-tab logout, token expired) the next render redirects to
          // /login via App.tsx's catch-all <Navigate>.
          if (getSession()) clearLocalSession();
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

          // Demo-workspace short-circuit: when the user just signed in
          // as demo@duedatehq.com AND `tryDemo()` set the pending flag
          // before sending them off to email, we skip onboarding entirely
          // and instead provision-or-seed the demo firm via
          // `auth.bootstrapDemo`. The mutation is idempotent so a re-fired
          // INITIAL_SESSION (browser refresh after landing) won't re-seed.
          const demoBootstrapPending =
            userEmail.toLowerCase() === "demo@duedatehq.com" &&
            typeof localStorage !== "undefined" &&
            localStorage.getItem("duedatehq.bootstrap_demo_pending") === "1";

          if (demoBootstrapPending) {
            try {
              localStorage.removeItem("duedatehq.bootstrap_demo_pending");
              await trpcUtils.client.auth.bootstrapDemo.mutate();
              // Pull the now-seeded session so SessionProvider picks up
              // the firm name + tier we just created.
              const remote = await trpcUtils.auth.session.fetch();
              signIn({
                firmName: remote?.firm.name ?? "Mitchell CPA (demo)",
                userName: remote?.user.displayName ?? "Sarah Mitchell",
                userEmail,
                tier: remote?.firm.tier ?? "pro",
              });
              navigate("/", { replace: true });
              return;
            } catch (err) {
              // bootstrapDemo can fail if the BE is down or the FORBIDDEN
              // guard rejects (someone hand-set the flag with a different
              // email). Fall through to the normal sign-in path below so
              // the user at least lands somewhere coherent.
              // eslint-disable-next-line no-console
              console.error("supabase-auth-bridge.bootstrap_demo_failed", err);
            }
          }

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
