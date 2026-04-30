import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { ClientDetail } from "./pages/ClientDetail";
import { TaskDetail } from "./pages/TaskDetail";
import { Inbox } from "./pages/Inbox";
import { Insights } from "./pages/Insights";
import { Mail } from "./pages/Mail";
import { Timeline } from "./pages/Timeline";
import { AnnouncementList } from "./pages/AnnouncementList";
import { AnnouncementDetail } from "./pages/AnnouncementDetail";
import { Import } from "./pages/Import";
import { Placeholder } from "./pages/Placeholder";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Signup } from "./pages/auth/Signup";
import { AcceptInvite } from "./pages/auth/AcceptInvite";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { MagicLink } from "./pages/auth/MagicLink";
import { Changes } from "./pages/Changes";
import { Calendar } from "./pages/Calendar";
import { OnboardingFirm } from "./pages/onboarding/OnboardingFirm";
import { OnboardingChoosePath } from "./pages/onboarding/OnboardingChoosePath";
import { OnboardingManual } from "./pages/onboarding/OnboardingManual";
import { OnboardingDemo } from "./pages/onboarding/OnboardingDemo";
import { OnboardingImport } from "./pages/onboarding/OnboardingImport";
import { OnboardingPackages } from "./pages/onboarding/OnboardingPackages";
import { OnboardingDone } from "./pages/onboarding/OnboardingDone";
import { SessionProvider } from "./lib/session-provider";
import { SupabaseAuthBridge } from "./lib/supabase-auth-bridge";
import { useSession } from "./data/session";
import { env } from "./config";

/**
 * Synchronously detect "Supabase has a session, local FirmSession doesn't" —
 * the window between the magic-link click landing on the page and the
 * SupabaseAuthBridge useEffect firing to populate the local session.
 *
 * Without this gate, the catch-all <Navigate to="/login"> renders FIRST
 * (synchronous), the bridge fires SECOND (post-render), and the user lands
 * on /login with the auth tokens already lost during the redirect.
 *
 * Returns true when:
 *   - URL hash has access_token (Supabase JS hasn't yet read+stored it), OR
 *   - localStorage has a sb-*-auth-token entry (Supabase JS already stored)
 *
 * Triggers a "Signing you in…" loading state in App.tsx until the bridge
 * resolves and the local session populates.
 */
function isSupabaseAuthPending(): boolean {
  if (env.useMockApi) return false;
  if (typeof window === "undefined") return false;
  if (window.location.hash.includes("access_token=")) return true;
  try {
    const keys = Object.keys(window.localStorage);
    return keys.some(
      (k) =>
        k.startsWith("sb-") &&
        k.endsWith("-auth-token") &&
        !!window.localStorage.getItem(k),
    );
  } catch {
    return false;
  }
}

export default function App() {
  const localSession = useSession();
  const supabaseAuthPending = isSupabaseAuthPending();

  return (
    <>
      <SupabaseAuthBridge />
      <Routes>
      {/* Public auth routes — outside the AppShell */}
      <Route path="/login" element={<Login />} />
      <Route path="/changes" element={<Changes />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/magic-link" element={<MagicLink />} />

      {/* Onboarding wizard — wizard chrome, no sidebar (IA §3.8) */}
      {localSession && (
        <>
          <Route path="/onboarding/firm" element={<OnboardingFirm />} />
          <Route
            path="/onboarding/choose-path"
            element={<OnboardingChoosePath />}
          />
          <Route path="/onboarding/import" element={<OnboardingImport />} />
          <Route path="/onboarding/manual" element={<OnboardingManual />} />
          <Route path="/onboarding/demo" element={<OnboardingDemo />} />
          <Route path="/onboarding/packages" element={<OnboardingPackages />} />
          <Route path="/onboarding/done" element={<OnboardingDone />} />
        </>
      )}

      {/* Protected app routes */}
      {localSession ? (
        <Route
          element={
            <SessionProvider>
              <AppShell />
            </SessionProvider>
          }
        >
          <Route index element={<Dashboard />} />
          {/* IA v0.7 amendment §2: 7 sidebar destinations.
              Today (/) · Timeline (/timeline) · Clients · Mail · Alerts ·
              Opportunities · Settings */}
          <Route path="timeline" element={<Timeline />} />
          <Route path="mail" element={<Mail />} />
          {/* /legacy/dashboard — old Dashboard view without ActionQueue +
              Mode F Health. Kept reachable during the v0.7-amendment
              transition so CPAs can A/B compare and we have a rollback
              path. Same component, branched on location.pathname. */}
          <Route path="legacy/dashboard" element={<Dashboard />} />
          {/* /to-review and /inbox kept as legacy redirects to canonical /mail
              (Mail surface subsumes the old "review queue" concept per IA v0.7
              §3.8). Also keep /to-review as a back-compat aliased route to the
              old Inbox page in case anyone deep-linked it. */}
          <Route path="to-review" element={<Navigate to="/mail" replace />} />
          <Route path="inbox" element={<Navigate to="/mail" replace />} />
          <Route path="legacy/to-review" element={<Inbox />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="opportunities" element={<Insights />} />
          {/* Legacy /insights route — redirect to canonical /opportunities */}
          <Route path="insights" element={<Navigate to="/opportunities" replace />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="clients/:id/tasks/:taskId" element={<TaskDetail />} />
          <Route path="alerts" element={<AnnouncementList />} />
          <Route path="alerts/:id" element={<AnnouncementDetail />} />
          <Route path="import" element={<Import />} />
          <Route path="settings/*" element={<Settings />} />
          <Route path="*" element={<Placeholder name="Not found" />} />
        </Route>
      ) : supabaseAuthPending ? (
        // Supabase has auth (URL hash or stored token) but local session
        // hasn't been bridged yet. Show a non-redirecting loading screen so
        // the SupabaseAuthBridge useEffect has time to fire + populate the
        // local session, after which this branch unmounts and the protected
        // routes render normally. Without this gate the catch-all <Navigate>
        // races the bridge and wins, dropping the auth tokens.
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-canvas">
              <div className="text-center">
                <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-ink-500 mt-4">Signing you in…</p>
              </div>
            </div>
          }
        />
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
      </Routes>
    </>
  );
}
