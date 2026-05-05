/**
 * tRPC React client + link selection.
 *
 * Mock mode (VITE_USE_MOCK_API=true): requests dispatch to `mockAdapter`
 * via `mockLink` (in-memory, no network).
 *
 * Real mode: requests go to `${VITE_API_URL}/trpc` with a Bearer token
 * sourced from the Supabase Auth session.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./router";
import { mockLink } from "./mock-link";
import { env } from "../../config";
import { getAccessToken } from "../supabase";

export const trpc = createTRPCReact<AppRouter>();

function realLink() {
  return httpBatchLink({
    url: `${env.apiUrl}/trpc`,
    async headers() {
      const token = await getAccessToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });
}

function buildLinks() {
  return env.useMockData ? [mockLink] : [realLink()];
}

export function createTrpcClient() {
  return trpc.createClient({ links: buildLinks() });
}

/**
 * Vanilla (non-hook) tRPC client for use outside of React components —
 * file uploads, route loaders, one-shot calls.
 */
export const trpcClientUntyped = createTRPCClient<AppRouter>({
  links: buildLinks(),
});
