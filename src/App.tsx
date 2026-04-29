import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { ClientDetail } from "./pages/ClientDetail";
import { TaskDetail } from "./pages/TaskDetail";
import { Inbox } from "./pages/Inbox";
import { Insights } from "./pages/Insights";
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
import { useSession } from "./data/session";

export default function App() {
  const localSession = useSession();

  return (
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
          <Route path="to-review" element={<Inbox />} />
          <Route path="calendar" element={<Calendar />} />
          {/* Legacy /inbox route — redirect to canonical /to-review */}
          <Route path="inbox" element={<Navigate to="/to-review" replace />} />
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
      ) : (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );
}
