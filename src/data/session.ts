import { useSyncExternalStore } from "react";

export interface FirmSession {
  firmName: string;
  userName: string;
  userEmail: string;
  userInitials: string;
  tier: "solo" | "pro" | "team";
  digestMode: "digest_8am" | "per_alert";
  signedInAt: string;
  /** ISO timestamp when the 30-day Pro trial ends. After this, billing
   *  enforces the chosen plan; if no plan is chosen, account goes
   *  read-only. Set on signIn(). Surfaced in TopBar as a calm pill. */
  trialEndsAt?: string;
  /** Onboarding Layer 1 completion (PRD §8.4 / IA §3.8). */
  onboardingComplete?: boolean;
  /** Primary states served (collected in Onboarding step "firm setup"). */
  primaryStates?: string[];
  /** IANA time zone (e.g., "America/Los_Angeles"). Drives "due today" /
   *  "this week" calculations. Defaulted from browser at signup; user can
   *  override in Settings → Firm. */
  timeZone?: string;
  /** Calendar provider the partner wants deadlines pushed to. Each option
   *  triggers a Phase 1 OAuth flow when wired. "none" = don't push. */
  calendarProvider?: "google" | "outlook" | "apple" | "none";
  /** Firm-wide kill switch for Phase 2 auto-send (PRD §7.3). When true,
   *  every Phase-2-enabled template is paused regardless of per-template
   *  state. The CPA can flip it instantly from Settings → Reminders. */
  phase2AutoSendPaused?: boolean;
}

const KEY = "duedatehq.session.v1";
const listeners = new Set<() => void>();

function read(): FirmSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FirmSession;
  } catch {
    return null;
  }
}

function write(s: FirmSession | null) {
  if (typeof window === "undefined") return;
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  cached = s;
  for (const l of listeners) l();
}

let cached: FirmSession | null = read();

export function getSession(): FirmSession | null {
  return cached;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function signIn(input: {
  firmName: string;
  userName: string;
  userEmail: string;
  tier?: FirmSession["tier"];
}) {
  // Preserve trialEndsAt across re-signin — only set it once on first
  // signup. (In production the BE owns this; the FE just mirrors.)
  const existing = read();
  const trialEndsAt =
    existing?.trialEndsAt ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const s: FirmSession = {
    firmName: input.firmName.trim(),
    userName: input.userName.trim(),
    userEmail: input.userEmail.trim(),
    userInitials: initials(input.userName),
    tier: input.tier ?? "solo",
    digestMode: "digest_8am",
    signedInAt: new Date().toISOString(),
    trialEndsAt,
  };
  write(s);
  return s;
}

/**
 * Clears both Supabase auth and the local FirmSession.
 *
 * Synchronous-first design: we clear localStorage (sb-*-auth-token + the
 * local FirmSession) BEFORE we await anything. That way React re-renders
 * the app to /login immediately — no chance of getting trapped on the
 * "Signing you in…" loader, no chance of the network-bound Supabase API
 * call hanging the UI.
 *
 * The Supabase server-side revoke is best-effort, fire-and-forget: we use
 * scope: 'local' so it doesn't make a network round-trip, and we don't
 * await it. If the user is offline or Supabase is slow, sign-out still
 * completes instantly.
 */
export async function signOut() {
  if (typeof window === "undefined") {
    write(null);
    return;
  }
  // Step 1 (sync): purge every Supabase token from localStorage. This must
  // happen before any await — otherwise a slow `supabase.auth.signOut()`
  // call leaves the tokens visible to App.tsx's isSupabaseAuthPending
  // check during the await window, freezing the UI on the loader.
  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
      window.localStorage.removeItem(key);
    }
  }
  // Step 2 (sync): clear the local FirmSession + notify subscribers.
  write(null);

  // Step 3 (background): tell Supabase. scope:'local' skips the network
  // round-trip; we still call it so the auth client tears down its
  // in-memory session and stops auto-refreshing.
  try {
    // Inline env check (no config import — would be circular). Real auth
    // requires both Supabase keys set AND useMockAuth not explicitly true.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ie = (import.meta as any).env ?? {};
    const haveSupabaseKeys = !!ie.VITE_SUPABASE_URL && !!ie.VITE_SUPABASE_ANON_KEY;
    const authOverride = ie.VITE_USE_MOCK_AUTH;
    const legacy = ie.VITE_USE_MOCK_API;
    const useMockAuth = !haveSupabaseKeys
      ? true
      : authOverride === undefined
        ? legacy !== "false"
        : authOverride !== "false";
    if (!useMockAuth) {
      const { supabase } = await import("../lib/supabase");
      // Don't await — we already cleared local state, and a hang here
      // would block our caller's navigate("/login").
      void supabase()
        .auth.signOut({ scope: "local" })
        .catch(() => {
          /* ignore — local already cleared */
        });
    }
  } catch {
    /* ignore */
  }
}

export function updateSession(patch: Partial<FirmSession>) {
  if (!cached) return;
  const next: FirmSession = { ...cached, ...patch };
  if (patch.userName) next.userInitials = initials(patch.userName);
  write(next);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSession(): FirmSession | null {
  return useSyncExternalStore(subscribe, getSession, getSession);
}
