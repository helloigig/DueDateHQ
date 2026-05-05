import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import type { Context } from "./context.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Requires a valid Supabase JWT. Looks up the user's firm row and attaches it
 * to ctx so handlers can scope queries by firmId without re-fetching.
 *
 * If the JWT is valid but no `users` row exists yet (post-signup, pre-firm-
 * provisioning), throws PRECONDITION_FAILED — the frontend should redirect
 * to onboarding/firm.
 */
export const firmProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const row = await db.query.users.findFirst({
    where: eq(users.id, ctx.user.id),
  });
  if (!row) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "no_firm_provisioned",
    });
  }
  return next({
    ctx: { ...ctx, user: ctx.user, dbUser: row, firmId: row.firmId },
  });
});
