import { Link, Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { BottomTabBar } from "./BottomTabBar";
import { OfflineBanner } from "./OfflineBanner";
import { InstallPrompt } from "./InstallPrompt";
import { Toaster } from "./ui/sonner";
import { StatusBanner } from "./StatusBanner";
import { useSession } from "../data/session";
import { useStore } from "../data/store";
import { trpc } from "../lib/api/client";
import { TabsProvider } from "../lib/tabs/TabContext";

export function AppShell() {
  const session = useSession();
  const { clients } = useStore();
  // Source of truth for "has the firm been set up": BE clients count.
  // Local-store clients is always 0 in real mode (the store is FE-only),
  // so basing the banner on it caused it to nag users who had completed
  // setup. Falls back to the local count when BE is unreachable so demo /
  // mock workspaces still see the right state.
  const beClientsQuery = trpc.clients.list.useQuery(
    {},
    { retry: false, refetchOnWindowFocus: false },
  );
  const beClientCount = beClientsQuery.data?.items?.length ?? 0;
  const hasClients = beClientCount > 0 || clients.length > 0;
  // Show ONLY when: signed in, the flag explicitly says incomplete, AND
  // the firm genuinely has no clients on either side.
  const showSetupBanner =
    !!session && session.onboardingComplete !== true && !hasClients;

  return (
    <TabsProvider>
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
          {/* Workspace tabs — sticky strip below TopBar.
              Renders nothing when no tabs are open (saves canvas). */}
          <TabBar />
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
    </TabsProvider>
  );
}
