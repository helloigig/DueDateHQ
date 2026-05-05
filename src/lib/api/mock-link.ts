/**
 * Custom tRPC link that dispatches `op.path` to the mock adapter.
 *
 * Mirrors `httpBatchLink` shape so swapping later is a one-line change.
 */
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "./router";
import { mockAdapter } from "./mock-adapter";

function resolveFn(path: string): ((input: unknown) => unknown) | null {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = mockAdapter;
  for (const p of parts) {
    if (node == null) return null;
    node = node[p];
  }
  return typeof node === "function" ? node : null;
}

export const mockLink: TRPCLink<AppRouter> = () => {
  return ({ op }) =>
    observable((observer) => {
      const fn = resolveFn(op.path);
      if (!fn) {
        observer.error(
          new TRPCClientError(`Mock adapter has no handler for ${op.path}`)
        );
        return;
      }
      let cancelled = false;
      Promise.resolve()
        .then(() => fn(op.input))
        .then((result) => {
          if (cancelled) return;
          observer.next({ result: { type: "data", data: result } });
          observer.complete();
        })
        .catch((err) => {
          if (cancelled) return;
          observer.error(
            err instanceof TRPCClientError
              ? err
              : TRPCClientError.from(err as Error)
          );
        });
      return () => {
        cancelled = true;
      };
    });
};
