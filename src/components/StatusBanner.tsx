import { useState } from "react";
import { AlertTriangle, Info, X, Database } from "lucide-react";
import { trpc } from "../lib/api/client";
import { env } from "../config";

/**
 * Diagnostic banner that surfaces "why is my data empty?" answers in one
 * glance. Renders only when something is OFF (mock mode, BE error, or
 * unprovisioned firm) — silent in the normal real-mode-with-data path.
 *
 * Why this exists: every "empty data" symptom — Today queue blank,
 * Timeline showing fake Apex Fund rows, Clients page empty after CSV
 * import, Mail showing mock examples — has the same handful of root
 * causes (wrong env on Vercel, BE not provisioned, JWT not attached, BE
 * unreachable). The user shouldn't have to open DevTools to tell which.
 *
 * Pass ?debug=1 in the URL to force-show the diagnostic readout even
 * when nothing is off.
 */
export function StatusBanner() {
  const [dismissed, setDismissed] = useState(false);
  const sessionQuery = trpc.auth.session.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const clientsQuery = trpc.clients.list.useQuery(
    {},
    { retry: false, refetchOnWindowFocus: false },
  );

  const isDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  if (dismissed && !isDebug) return null;

  const sessionData = sessionQuery.data;
  const sessionError = sessionQuery.error;
  const clientsCount = clientsQuery.data?.items?.length ?? 0;
  const clientsError = clientsQuery.error;

  // Decide what to show
  let level: "info" | "warn" | "danger" | null = null;
  let message: string | null = null;
  let details: string[] = [];

  if (clientsError || sessionError) {
    level = "danger";
    message = "Backend error — your data isn't loading.";
    if (sessionError) details.push(`auth.session: ${sessionError.message}`);
    if (clientsError) details.push(`clients.list: ${clientsError.message}`);
  } else if (env.useMockData) {
    level = "info";
    message =
      "You're in MOCK mode. CSV imports won't persist beyond this browser session.";
    details.push(
      "Set VITE_USE_MOCK_DATA=false in Vercel env vars + redeploy to use the real backend.",
    );
  } else if (!sessionData && !sessionQuery.isLoading) {
    level = "warn";
    message = "Account not provisioned in backend.";
    details.push(
      "Your Supabase user exists but no firm row was created. Visit /onboarding/firm to provision.",
    );
  } else if (sessionData && clientsCount === 0 && !clientsQuery.isLoading) {
    level = "info";
    message = "Backend is connected but your firm has no clients yet.";
    details.push(
      `Firm: ${sessionData.firm.name} (${sessionData.firm.id.slice(0, 8)}…) · Import a CSV via /onboarding/import or /import.`,
    );
  }

  if (!message && !isDebug) return null;

  const palette =
    level === "danger"
      ? "bg-danger-bg border-danger-border text-danger-ink"
      : level === "warn"
        ? "bg-warning-bg border-warning-border text-warning-ink"
        : "bg-info-bg border-info-border text-info-ink";

  return (
    <div
      className={`border-b px-4 py-2 text-xs flex items-start gap-2 ${palette}`}
      role="status"
    >
      {level === "danger" || level === "warn" ? (
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
      ) : (
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
      )}
      <div className="flex-1 min-w-0">
        {message && <div className="font-medium">{message}</div>}
        {details.map((d, i) => (
          <div key={i} className="opacity-80 mt-0.5">
            {d}
          </div>
        ))}
        {isDebug && (
          <div className="mt-2 pt-2 border-t border-current/20 font-mono opacity-70 leading-relaxed">
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" aria-hidden />
              <span>
                mode: {env.useMockData ? "mock" : "real"} data ·{" "}
                {env.useMockAuth ? "mock" : "real"} auth
              </span>
            </div>
            <div>api: {env.apiUrl}</div>
            <div>
              session:{" "}
              {sessionQuery.isLoading
                ? "loading"
                : sessionData
                  ? `${sessionData.user.email} → firm ${sessionData.firm.id.slice(0, 12)} (${sessionData.firm.name})`
                  : "null"}
            </div>
            <div>
              clients.list:{" "}
              {clientsQuery.isLoading
                ? "loading"
                : `${clientsCount} returned`}
            </div>
          </div>
        )}
      </div>
      {!isDebug && (
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
