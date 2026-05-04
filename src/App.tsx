import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
// Auth pages stay eagerly imported — they're the entry points (post-signout
// redirect target + magic-link landing) and are individually tiny. Loading
// them lazily would just add a Suspense flash on the most-hit page.
import { Login } from "./pages/Login";
import { Signup } from "./pages/auth/Signup";
import { AcceptInvite } from "./pages/auth/AcceptInvite";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { MagicLink } from "./pages/auth/MagicLink";
import { Changes } from "./pages/Changes";

// Protected app pages — code-split. Keeps /login bundle small (no
// Dashboard, Clients, mock seed data, etc. on the entry page).
const AppShell = lazy(() =>
  import("./components/AppShell").then((m) => ({ default: m.AppShell })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const Clients = lazy(() =>
  import("./pages/Clients").then((m) => ({ default: m.Clients })),
);
const ClientDetail = lazy(() =>
  import("./pages/ClientDetail").then((m) => ({ default: m.ClientDetail })),
);
const TaskDetail = lazy(() =>
  import("./pages/TaskDetail").then((m) => ({ default: m.TaskDetail })),
);
const Inbox = lazy(() =>
  import("./pages/Inbox").then((m) => ({ default: m.Inbox })),
);
const Insights = lazy(() =>
  import("./pages/Insights").then((m) => ({ default: m.Insights })),
);
const Activity = lazy(() =>
  import("./pages/Activity").then((m) => ({ default: m.Activity })),
);
const Mail = lazy(() =>
  import("./pages/Mail").then((m) => ({ default: m.Mail })),
);
const Timeline = lazy(() =>
  import("./pages/Timeline").then((m) => ({ default: m.Timeline })),
);
// /alerts is the v0u 3-column workshop surface (rail | feed | pane).
// Mounted OUTSIDE AppShell so the v0u layout owns the viewport — the rail
// inside Alerts.tsx carries primary nav for this surface.
const Alerts = lazy(() =>
  import("./pages/Alerts").then((m) => ({ default: m.Alerts })),
);
const Import = lazy(() =>
  import("./pages/Import").then((m) => ({ default: m.Import })),
);
const Placeholder = lazy(() =>
  import("./pages/Placeholder").then((m) => ({ default: m.Placeholder })),
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings })),
);
const Calendar = lazy(() =>
  import("./pages/Calendar").then((m) => ({ default: m.Calendar })),
);
const TodayDesign = lazy(() =>
  import("./pages/Today").then((m) => ({ default: m.Today })),
);
const TodayTriage = lazy(() =>
  import("./pages/TodayTriage").then((m) => ({ default: m.TodayTriage })),
);
const OnboardingFirm = lazy(() =>
  import("./pages/onboarding/OnboardingFirm").then((m) => ({
    default: m.OnboardingFirm,
  })),
);
const OnboardingChoosePath = lazy(() =>
  import("./pages/onboarding/OnboardingChoosePath").then((m) => ({
    default: m.OnboardingChoosePath,
  })),
);
const OnboardingManual = lazy(() =>
  import("./pages/onboarding/OnboardingManual").then((m) => ({
    default: m.OnboardingManual,
  })),
);
const OnboardingDemo = lazy(() =>
  import("./pages/onboarding/OnboardingDemo").then((m) => ({
    default: m.OnboardingDemo,
  })),
);
const OnboardingImport = lazy(() =>
  import("./pages/onboarding/OnboardingImport").then((m) => ({
    default: m.OnboardingImport,
  })),
);
const OnboardingPackages = lazy(() =>
  import("./pages/onboarding/OnboardingPackages").then((m) => ({
    default: m.OnboardingPackages,
  })),
);
const OnboardingDone = lazy(() =>
  import("./pages/onboarding/OnboardingDone").then((m) => ({
    default: m.OnboardingDone,
  })),
);
import { SessionProvider } from "./lib/session-provider";
import { SupabaseAuthBridge } from "./lib/supabase-auth-bridge";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { useSession } from "./data/session";
import { env } from "./config";

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
  if (env.useMockAuth) return false;
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
    <AppErrorBoundary>
      <SupabaseAuthBridge />
      <Suspense fallback={<RouteFallback />}>
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
          {/* Design preview: new Today page per docs/specs/today-page.md.
              Non-destructive — old Dashboard still serves "/" until this is
              approved as the Today replacement. */}
          <Route path="design/today" element={<TodayDesign />} />
          {/* v0m focused triage mode — single-card, keyboard-driven.
              Inherits the Action Queue from Today; mounted inside AppShell
              so the floating sidebar + topbar stay consistent. Reach via
              the "Triage mode →" link on Today, or directly /today/triage. */}
          <Route path="today/triage" element={<TodayTriage />} />
          <Route path="opportunities" element={<Insights />} />
          {/* Legacy /insights route — redirect to canonical /opportunities */}
          <Route path="insights" element={<Navigate to="/opportunities" replace />} />
          <Route path="activity" element={<Activity />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="clients/:id/tasks/:taskId" element={<TaskDetail />} />
          {/* /alerts is the v0u feed + co-pilot pane workshop. Mounted
              INSIDE AppShell so it shares the same sidebar/topbar/banner
              chrome as Today/Timeline/Clients (consistency). The page
              itself splits its main area into feed (flex-1) + 440px pane. */}
          <Route path="alerts" element={<Alerts />} />
          <Route path="alerts/:id" element={<Alerts />} />
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
      </Suspense>
    </AppErrorBoundary>
  );
}
