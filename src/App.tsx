import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Clients } from "./pages/Clients";
import { ClientDetail } from "./pages/ClientDetail";
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
import { SessionProvider } from "./lib/session-provider";
import { useSession } from "./data/session";

export default function App() {
  const localSession = useSession();

  return (
    <Routes>
      {/* Public auth routes — outside the AppShell */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

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
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="announcements" element={<AnnouncementList />} />
          <Route path="announcements/:id" element={<AnnouncementDetail />} />
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
