import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import {
  isInstallAvailable,
  isStandaloneDisplay,
  onInstallAvailableChange,
  promptInstall,
} from "../lib/pwa";

const DISMISS_KEY = "duedatehq.install.dismissed";

export function InstallPrompt() {
  const [available, setAvailable] = useState(() => isInstallAvailable());
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });

  useEffect(() => {
    return onInstallAvailableChange(setAvailable);
  }, []);

  if (!available || dismissed) return null;
  if (isStandaloneDisplay()) return null;

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  const onInstall = async () => {
    await promptInstall();
    setAvailable(false);
  };

  return (
    <div
      role="region"
      aria-label="Install DueDateHQ"
      className="hidden md:flex fixed bottom-4 right-4 z-30 items-center gap-3 bg-surface border border-line rounded-lg shadow-overlay px-3 py-2.5 max-w-sm"
    >
      <span className="w-7 h-7 flex items-center justify-center rounded bg-info-bg text-info-ink shrink-0">
        <Bell className="w-4 h-4" aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink-900">
          Install on your phone
        </div>
        <div className="text-xs text-ink-500 mt-0.5">
          Get a push when a state alert affects your clients.
        </div>
      </div>
      <button
        onClick={onInstall}
        className="text-xs font-medium px-3 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover shrink-0"
      >
        Install
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss install prompt"
        className="p-1 text-ink-500 hover:text-ink-900 shrink-0"
      >
        <X className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
