import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomTabBar } from "./BottomTabBar";
import { OfflineBanner } from "./OfflineBanner";
import { InstallPrompt } from "./InstallPrompt";
import { Toaster } from "./Toaster";
import { StatusBanner } from "./StatusBanner";
import { useSession } from "../data/session";
import { useStore } from "../data/store";

export function AppShell() {
  const session = useSession();
  const { clients } = useStore();
  // Only nag the user about setup if (a) the flag is unset AND (b) they
  // genuinely have no clients. If they're on the demo workspace or the
  // session flag was never flipped but data exists, the banner is noise.
  const showSetupBanner =
    session && !session.onboardingComplete && clients.length === 0;

  return (
    <div className="h-screen flex bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-accent focus:text-canvas focus:px-3 focus:py-1.5 focus:rounded-md focus:text-sm"
      >
        Skip to main content
      </a>
      <OfflineBanner />
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <StatusBanner />
        {showSetupBanner && (
          <div className="bg-info-bg border-b border-info-border px-4 py-2 text-xs text-info-ink flex items-center gap-2">
            <span>Complete setup to lock in your firm settings.</span>
            <Link
              to="/onboarding/firm"
              className="ml-auto underline hover:no-underline"
            >
              Resume setup
            </Link>
          </div>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto pb-14 md:pb-0 outline-none"
        >
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
      <InstallPrompt />
      <Toaster />
    </div>
  );
}
