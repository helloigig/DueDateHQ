/**
 * tRPC React client + link selection.
 *
 * Mock mode: requests are dispatched to `mockAdapter` via `mockLink`.
 * Real mode: swap `mockLink` for `httpBatchLink({ url })` on integration day.
 */
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./router";
import { mockLink } from "./mock-link";
import { env } from "../../config";

export const trpc = createTRPCReact<AppRouter>();

export function createTrpcClient() {
  return trpc.createClient({
    links: env.useMockApi
      ? [mockLink]
      : [httpBatchLink({ url: `${env.apiUrl}/trpc` })],
  });
}
