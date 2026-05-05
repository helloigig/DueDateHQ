/**
 * Environment-backed runtime config. Read from Vite's `import.meta.env`
 * and defaulted so the app runs without a `.env` file in development.
 *
 * `useMockApi` is the legacy single switch. We've split it conceptually:
 *   - `useMockData` controls the tRPC layer (clients, deadlines, etc.)
 *   - `useMockAuth` controls Supabase magic-link / OAuth
 *
 * Both default to the legacy `useMockApi` value. Override individually with
 * `VITE_USE_MOCK_DATA` and `VITE_USE_MOCK_AUTH` to get the common hybrid:
 * real auth (so users actually receive magic-link emails) + mock data
 * (so the app runs without a backend).
 */
const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "";

const legacyMockFlag =
  (import.meta.env.VITE_USE_MOCK_API as string | undefined) !== "false";

const dataOverride = import.meta.env.VITE_USE_MOCK_DATA as string | undefined;
const authOverride = import.meta.env.VITE_USE_MOCK_AUTH as string | undefined;

const useMockData =
  dataOverride === undefined ? legacyMockFlag : dataOverride !== "false";

// If Supabase keys are missing, force mock auth — there's no real auth
// service to call. This guards against accidental "false" + empty keys.
const useMockAuth =
  !supabaseUrl || !supabaseAnonKey
    ? true
    : authOverride === undefined
      ? legacyMockFlag
      : authOverride !== "false";

export const env = {
  apiUrl:
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:8000",
  supabaseUrl,
  supabaseAnonKey,
  publicAssetsUrl:
    (import.meta.env.VITE_PUBLIC_ASSETS_URL as string | undefined) ?? "",
  /** @deprecated prefer useMockData / useMockAuth — kept for callers. */
  useMockApi: useMockData && useMockAuth,
  useMockData,
  useMockAuth,
  sentryDsn: (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? "",
  enableDevTools:
    (import.meta.env.VITE_ENABLE_DEV_TOOLS as string | undefined) === "true",
};
