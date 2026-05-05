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
  // Preserve fields the BE owns or the user has already set across
  // sign-in cycles. Without this, every re-login wipes
  // onboardingComplete / primaryStates / timeZone — the user logs back
  // in and sees the setup banner reappear despite already finishing.
  // Only blow these away when the new sign-in is for a DIFFERENT email
  // (different account).
  const existing = read();
  const sameAccount =
    existing != null && existing.userEmail === input.userEmail.trim();
  const trialEndsAt =
    existing?.trialEndsAt ??
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const s: FirmSession = {
    firmName: input.firmName.trim(),
    userName: input.userName.trim(),
    userEmail: input.userEmail.trim(),
    userInitials: initials(input.userName),
    tier: input.tier ?? (sameAccount ? existing?.tier : undefined) ?? "solo",
    digestMode: (sameAccount ? existing?.digestMode : undefined) ?? "digest_8am",
    signedInAt: new Date().toISOString(),
    trialEndsAt,
    onboardingComplete: sameAccount ? existing?.onboardingComplete : undefined,
    primaryStates: sameAccount ? existing?.primaryStates : undefined,
    timeZone: sameAccount ? existing?.timeZone : undefined,
    calendarProvider: sameAccount ? existing?.calendarProvider : undefined,
    phase2AutoSendPaused: sameAccount
      ? existing?.phase2AutoSendPaused
      : undefined,
  };
  write(s);
  return s;
}

/**
 * Clear local session state synchronously. Used by:
 *   - signOut() — full sign-out flow (this + supabase + reload)
 *   - SupabaseAuthBridge — when supabase fires SIGNED_OUT from another tab
 *     or token expiry. We mirror to local state but must NOT call signOut(),
 *     which would re-trigger the very SIGNED_OUT event we're handling and
 *     recurse the auth listener.
 */
export function clearLocalSession() {
  write(null);
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-")) localStorage.removeItem(k);
    }
    for (const k of Object.keys(sessionStorage)) {
      if (k.startsWith("sb-")) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

// Re-entry guard. signOut() calls supabase.auth.signOut(), which fires the
// SIGNED_OUT event the auth-bridge listens to. Without this guard, any path
// that re-enters signOut() (e.g. a stray bridge handler that wasn't yet
// updated) would loop the 800ms race + redundant window.location.replace
// calls, freezing the page for seconds.
let signingOut = false;

/**
 * Sign out: clears Supabase auth + local FirmSession, then HARD-RELOADS
 * the page to /login.
 *
 * Why hard reload: every gentler approach failed in production. The
 * SupabaseAuthBridge's auth-state listener kept catching post-signout
 * events and re-populating the session via INITIAL_SESSION before the
 * router could settle. Hard reload guarantees:
 *   - All React state is destroyed
 *   - All cached tRPC / React Query data is destroyed
 *   - All subscriber lists are cleared
 *   - Page boots fresh with empty localStorage and empty Supabase storage
 *
 * The user may briefly see a flash of white during reload — acceptable
 * trade for "logout actually works."
 */
export async function signOut() {
  if (signingOut) return;
  signingOut = true;

  clearLocalSession();

  // Tell Supabase to tear down its in-memory session and stop auto-
  // refreshing. Read the canonical flag from config.ts — earlier code
  // referenced the obsolete VITE_USE_MOCK_API, which silently skipped
  // this call once we split into useMockData / useMockAuth.
  try {
    const { env } = await import("../config");
    if (!env.useMockAuth) {
      const { supabase } = await import("../lib/supabase");
      // 400ms cap — if Supabase's network call hangs, we still reload.
      // Tokens are already cleared from localStorage above, so a hanging
      // remote signOut just means the server-side session expires naturally.
      await Promise.race([
        supabase().auth.signOut({ scope: "local" }),
        new Promise((resolve) => setTimeout(resolve, 400)),
      ]);
    }
  } catch {
    /* ignore — tokens are already gone, hard reload below finishes the job */
  }

  // Hard reload — bypasses all SPA state. window.location.replace so the
  // /login page can't be back-button'd into the signed-in state.
  window.location.replace("/login");
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
