import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { useSession } from "../data/session";

const STORAGE_KEY_DISMISSED = "duedatehq.pwaInstallCard.dismissed.v1";

/**
 * PWA install card — calm, dismissible, surfaced on day 2-3 visits.
 *
 * Logic:
 *   - Only show after the user has been signed in for >24h (signedInAt
 *     check). Day-1 they're still evaluating; nagging install would be
 *     intrusive.
 *   - Hidden if already dismissed (localStorage).
 *   - Hidden if the browser doesn't fire `beforeinstallprompt` (already
 *     installed / browser doesn't support PWA install).
 *   - Hidden during the welcome tour (if it's still open) — the tour
 *     dismissal flag and the >24h check naturally separate them.
 *
 * The PWA itself is provided by the existing pwa.ts + service worker.
 * This card just surfaces the install affordance.
 */
export function PwaInstallCard() {
  const session = useSession();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(true);

  // Wire the beforeinstallprompt listener. The browser fires this when
  // installation criteria are met (HTTPS + manifest + SW + heuristic).
  useEffect(() => {
    if (typeof window === "undefined") return;

    setDismissed(localStorage.getItem(STORAGE_KEY_DISMISSED) === "1");

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY_DISMISSED, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") {
      dismiss();
    }
    setInstallEvent(null);
  };

  // Don't render if no install event available, dismissed, or signed in
  // less than 24 hours. The 24h check stops day-1 nagging.
  const signedInAtMs = session?.signedInAt
    ? new Date(session.signedInAt).getTime()
    : null;
  const hoursSinceSignIn =
    signedInAtMs !== null ? (Date.now() - signedInAtMs) / 3_600_000 : 0;
  const showAfterDay1 = hoursSinceSignIn >= 24;

  if (!installEvent || dismissed || !showAfterDay1) return null;

  return (
    <div className="bg-surface border border-line rounded-md p-4 flex items-start gap-3">
      <span className="w-9 h-9 rounded-md bg-info-bg border border-info-border text-info-ink flex items-center justify-center shrink-0">
        <Smartphone className="w-4 h-4" aria-hidden />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900">
          Install on your phone — get state alerts within 24h
        </p>
        <p className="text-xs text-ink-500 mt-0.5">
          A real app icon, push notifications, full offline access. No app
          store, no extra account — just add to home screen.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={install}
            className="text-sm px-3 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1.5 text-ink-500 hover:text-ink-900 hover:bg-sunken rounded"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="text-ink-400 hover:text-ink-900 p-1 -mt-1 -mr-1"
        aria-label="Dismiss install prompt"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// Minimal type definition for the BeforeInstallPromptEvent — not yet in
// the standard lib.dom.d.ts as of TS 5.6.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}
