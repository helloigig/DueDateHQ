import { TRPCError } from "@trpc/server";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { firmProcedure, publicProcedure, router } from "../init.js";
import { db } from "../../db/client.js";
import { firms, teamInvites, users } from "../../db/schema.js";

const ROLE = ["owner", "member"] as const;
const INVITE_TTL_DAYS = 14;

function generateInviteToken() {
  // 32 url-safe chars. Phase 1 swaps for crypto.randomBytes.
  return Array.from({ length: 32 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789".charAt(
      Math.floor(Math.random() * 36),
    ),
  ).join("");
}

export const teamRouter = router({
  /** All users + pending invites for this firm. */
  list: firmProcedure.query(async ({ ctx }) => {
    const members = await db
      .select()
      .from(users)
      .where(eq(users.firmId, ctx.firmId));
    const pending = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.firmId, ctx.firmId),
          eq(teamInvites.status, "pending"),
          gt(teamInvites.expiresAt, new Date()),
        ),
      );
    return {
      members: members.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        timezone: u.timezone,
        lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
      })),
      invites: pending.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        invitedAt: i.createdAt.toISOString(),
        expiresAt: i.expiresAt.toISOString(),
      })),
    };
  }),

  /** Owner only. Creates a token-backed invite; emailing is Phase 1. */
  invite: firmProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(ROLE).default("member"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.dbUser.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "owner_only" });
      }
      const expiresAt = new Date(
        Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
      );
      const token = generateInviteToken();
      const [row] = await db
        .insert(teamInvites)
        .values({
          firmId: ctx.firmId,
          email: input.email.toLowerCase(),
          role: input.role,
          invitedByUserId: ctx.dbUser.id,
          token,
          expiresAt,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      return { inviteId: row.id, token };
    }),

  updateRole: firmProcedure
    .input(z.object({ userId: z.string().uuid(), role: z.enum(ROLE) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.dbUser.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "owner_only" });
      }
      const result = await db
        .update(users)
        .set({ role: input.role })
        .where(and(eq(users.id, input.userId), eq(users.firmId, ctx.firmId)));
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  remove: firmProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.dbUser.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "owner_only" });
      }
      if (input.userId === ctx.dbUser.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cannot_remove_self",
        });
      }
      // Hard-delete users; Phase 1 may switch to soft-delete with `deactivated_at`.
      const result = await db
        .delete(users)
        .where(and(eq(users.id, input.userId), eq(users.firmId, ctx.firmId)));
      if (result.count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { ok: true as const };
    }),

  revokeInvite: firmProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.dbUser.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "owner_only" });
      }
      await db
        .update(teamInvites)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(
          and(
            eq(teamInvites.id, input.inviteId),
            eq(teamInvites.firmId, ctx.firmId),
          ),
        );
      return { ok: true as const };
    }),

  /**
   * Public lookup by token — used by /accept-invite to render the firm
   * name + role before the user signs in. No auth required (the token
   * itself is the bearer secret).
   */
  inviteLookup: publicProcedure
    .input(z.object({ token: z.string().min(20).max(64) }))
    .query(async ({ input }) => {
      const invite = await db.query.teamInvites.findFirst({
        where: and(
          eq(teamInvites.token, input.token),
          eq(teamInvites.status, "pending"),
        ),
      });
      if (!invite) return null;
      if (invite.expiresAt.getTime() < Date.now()) return null;
      const firm = await db.query.firms.findFirst({
        where: eq(firms.id, invite.firmId),
      });
      const inviter = await db.query.users.findFirst({
        where: eq(users.id, invite.invitedByUserId),
      });
      return {
        firmName: firm?.name ?? "(unknown firm)",
        inviterName: inviter?.displayName ?? inviter?.email ?? "Owner",
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt.toISOString(),
      };
    }),

  /**
   * Companion to `auth.bootstrap` for invitees. Caller must already have
   * a Supabase Auth user (signup with the invite email). Token-bound.
   */
  acceptInvite: publicProcedure
    .input(z.object({ token: z.string().min(20).max(64) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      const invite = await db.query.teamInvites.findFirst({
        where: and(
          eq(teamInvites.token, input.token),
          eq(teamInvites.status, "pending"),
        ),
      });
      if (!invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "invalid_token" });
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "expired" });
      }
      if (invite.email !== ctx.user.email.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "invite_email_mismatch",
        });
      }

      await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id: ctx.user!.id,
          firmId: invite.firmId,
          email: ctx.user!.email,
          role: invite.role,
        });
        await tx
          .update(teamInvites)
          .set({ status: "accepted", acceptedAt: new Date() })
          .where(eq(teamInvites.id, invite.id));
      });
      return { firmId: invite.firmId };
    }),
});
