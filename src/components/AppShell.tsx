import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomTabBar } from "./BottomTabBar";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell() {
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
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto pb-14 md:pb-0 outline-none"
        >
          <Outlet />
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
