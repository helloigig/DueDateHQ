/**
 * Supabase Auth client. Used only when VITE_USE_MOCK_API=false — in mock mode
 * the FE has its own localStorage-backed session in `src/data/session.ts`.
 *
 * Tokens are persisted in localStorage by Supabase under the key
 * `sb-<project>-auth-token`. The tRPC client injects the access token into
 * the Authorization header (see `src/lib/api/client.ts`).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config";

let _client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (_client) return _client;
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      "Supabase env vars missing — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
    );
  }
  _client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

/**
 * Returns the current Supabase access token, refreshing if needed. Returns
 * null when no session exists. Safe to call from anywhere; cheap when the
 * session is fresh.
 */
export async function getAccessToken(): Promise<string | null> {
  if (env.useMockApi) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
