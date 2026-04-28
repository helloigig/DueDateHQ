import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 inset-x-2 md:left-1/2 md:right-auto md:-translate-x-1/2 md:max-w-sm z-50 bg-warn-bg border border-warn-border text-warn-ink rounded-md px-3 py-2 text-xs flex items-center gap-2 shadow-pop"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span>You're offline — changes will sync when you reconnect.</span>
    </div>
  );
}
