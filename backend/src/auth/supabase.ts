import { createClient } from "@supabase/supabase-js";
import { env } from "../env.js";

// Service-role client. Bypasses RLS — use only for trusted server work
// (looking up user→firm relationships from JWT).
export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

export interface AuthedUser {
  id: string;
  email: string;
}

/**
 * Verify a Supabase Auth JWT and return the user. Returns null on any failure
 * (missing, malformed, expired, revoked) — caller decides whether the route
 * tolerates that or 401s.
 */
export async function verifyJwt(token: string): Promise<AuthedUser | null> {
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user || !data.user.email) return null;
  return { id: data.user.id, email: data.user.email };
}
