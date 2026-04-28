/**
 * tRPC React client + link selection.
 *
 * Mock mode: requests are dispatched to `mockAdapter` via `mockLink`.
 * Real mode: swap `mockLink` for `httpBatchLink({ url })` on integration day.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./router";
import { mockLink } from "./mock-link";
import { env } from "../../config";

export const trpc = createTRPCReact<AppRouter>();

function buildLinks() {
  return env.useMockApi
    ? [mockLink]
    : [httpBatchLink({ url: `${env.apiUrl}/trpc` })];
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
