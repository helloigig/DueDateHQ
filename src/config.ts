/**
 * Environment-backed runtime config. Read from Vite's `import.meta.env`
 * and defaulted so the app runs without a `.env` file in development.
 */
export const env = {
  apiUrl:
    (import.meta.env.VITE_API_URL as string | undefined) ??
    "http://localhost:3001",
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "",
  supabaseAnonKey:
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
  publicAssetsUrl:
    (import.meta.env.VITE_PUBLIC_ASSETS_URL as string | undefined) ?? "",
  useMockApi:
    (import.meta.env.VITE_USE_MOCK_API as string | undefined) === "true",
  sentryDsn: (import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? "",
  enableDevTools:
    (import.meta.env.VITE_ENABLE_DEV_TOOLS as string | undefined) === "true",
};
