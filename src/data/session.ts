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
 * Clears both Supabase auth (when not in mock mode) AND the local FirmSession.
 *
 * Without the Supabase signOut, the SupabaseAuthBridge's INITIAL_SESSION
 * listener sees a still-valid Supabase session on the next render and
 * re-populates the local session — user gets signed back in immediately.
 *
 * Async because supabase.auth.signOut() is async; callers can await or
 * fire-and-forget. We swallow Supabase errors (network down, already signed
 * out) — the local session always clears regardless.
 *
 * Lazy-import of supabase to avoid circular dep at module-load time
 * (data/session is imported by many places that don't need supabase).
 */
export async function signOut() {
  // Local clear first — this fires our subscribers immediately so any
  // subscriber-driven UI updates (TopBar avatar, etc.) flip on the same tick.
  write(null);
  if (typeof window === "undefined") return;
  try {
    // Inline check for VITE_USE_MOCK_API to avoid importing config (circular).
    const useMockApi =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (import.meta as any).env?.VITE_USE_MOCK_API !== "false";
    if (useMockApi) return;
    const { supabase } = await import("../lib/supabase");
    await supabase().auth.signOut();
  } catch {
    /* ignore — local already cleared */
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
