import { lazy, type ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = any;

/**
 * Wraps `React.lazy` so a failed dynamic-chunk fetch (the classic
 * stale-deploy footgun) reloads the page automatically instead of
 * dropping the user into the error boundary.
 *
 * Why this exists
 * ───────────────
 * Vite hashes each lazy chunk: `TaskDetail-Bw7ujMiq.js`. When prod
 * redeploys, the new build emits chunks with new hashes, and the OLD
 * `index.html` (still loaded in any open tab) references chunk URLs
 * that 404. Clicking a link that triggers the lazy import explodes:
 *
 *   TypeError: Failed to fetch dynamically imported module:
 *     https://duedatehq.space/assets/TaskDetail-Bw7ujMiq.js
 *
 * The fix is well-known: detect that exact failure mode + reload the
 * page once so the user picks up the fresh `index.html` with the new
 * chunk references. They see one short flash; the navigation works.
 *
 * Guard rails
 * ───────────
 * • We use `sessionStorage` to record the last reload timestamp so we
 *   never reload twice in a row (avoids an infinite loop if a chunk is
 *   genuinely missing — which would be a real bug, not a stale build).
 * • Only the chunk-load error message triggers reload; every other
 *   render error falls through to AppErrorBoundary as before.
 *
 * Usage
 * ─────
 *   const TaskDetail = lazyWithChunkRetry(() =>
 *     import("./pages/TaskDetail").then((m) => ({ default: m.TaskDetail })),
 *   );
 */

const RELOAD_KEY = "ddhq.chunk-reload-attempted-at";
const RELOAD_GUARD_MS = 30 * 1000; // 30s — avoids a tight reload loop

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String((err as { message?: unknown })?.message ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    // Safari variant
    message.includes("Unable to preload CSS") ||
    // Older Chromium
    message.includes("Loading chunk")
  );
}

function shouldAttemptReload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    if (!last) return true;
    const lastMs = Number(last);
    if (Number.isNaN(lastMs)) return true;
    // If the last reload was more than the guard window ago, it's
    // safe to try again — the user has likely been on the page long
    // enough that the deploy churn isn't the cause.
    return Date.now() - lastMs > RELOAD_GUARD_MS;
  } catch {
    // Storage might be blocked (Safari private mode); fall back to
    // "yes, reload" — the user-visible behaviour is no worse than
    // the stale-chunk error screen.
    return true;
  }
}

function recordReloadAttempt(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* storage blocked — proceed anyway */
  }
}

export function lazyWithChunkRetry<T extends ComponentType<AnyProps>>(
  load: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(() =>
    load().catch((err) => {
      if (isChunkLoadError(err) && shouldAttemptReload()) {
        recordReloadAttempt();
        // Hard reload — uses the network, not the bf-cache, so the
        // browser fetches the fresh index.html with new chunk
        // references.
        window.location.reload();
        // Return a never-resolving promise so React doesn't render the
        // suspense fallback before the reload kicks in. The reload
        // tears down the tab so this promise leak is fine.
        return new Promise<{ default: T }>(() => {});
      }
      // Re-throw so AppErrorBoundary still renders for non-chunk
      // errors (or chunk errors after the guard window expired).
      throw err;
    }),
  );
}
