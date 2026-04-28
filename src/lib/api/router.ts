/**
 * Shared AppRouter type exported from the real server implementation.
 *
 * Frontend code imports this as a type only, so the server runtime never
 * bundles into the client.
 */
export type { AppRouter } from "../../../server/trpc/router";
