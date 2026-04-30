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
  // Synchronous local clear — fires subscribers and updates the UI on the
  // same tick, so any pre-reload render shows the signed-out state.
  write(null);

  // Step 3 (background): tell Supabase. scope:'local' skips the network
  // round-trip; we still call it so the auth client tears down its
  // in-memory session and stops auto-refreshing.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useMockApi =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import.meta as any).env?.VITE_USE_MOCK_API !== "false";
    if (!useMockApi) {
      const { supabase } = await import("../lib/supabase");
      // Clear Supabase auth from localStorage. The SDK persists tokens
      // under sb-<project>-auth-token; this nukes them.
      await supabase().auth.signOut();
    }
  } catch {
    /* ignore — we'll force-clear via the hard reload below */
  }
  // Belt-and-suspenders: nuke any leftover Supabase auth keys directly.
  // If supabase.auth.signOut() hung or errored, this still clears the
  // tokens so the post-reload page can't re-auth from cached JWT.
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
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
