/**
 * tRPC router shape. Mirrors what the backend will expose (Supabase + Hono + tRPC).
 *
 * Until the backend ships, every procedure throws at runtime. Procedures only
 * exist so frontend types line up. At runtime, calls are routed through the
 * mock link (`src/lib/api/mock-link.ts`) which dispatches to the mock adapter.
 *
 * On integration day, replace the link in `src/lib/api/client.ts` with an
 * `httpBatchLink({ url: env.apiUrl + '/trpc' })` and the real backend takes over.
 */
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import type {
  Announcement,
  Client,
  Deadline,
  Firm,
  FirmTier,
  ImportRun,
  Notification,
  ServicePackage,
  User,
} from "../../types";

const t = initTRPC.create();

const NOT_IMPL = () => {
  throw new Error("Procedure not wired to real server yet");
};

const jsonPassthrough = z.any();

export const appRouter = t.router({
  auth: t.router({
    session: t.procedure.query(
      async (): Promise<{
        user: User;
        firm: Firm;
        tier: FirmTier;
      } | null> => NOT_IMPL()
    ),
    login: t.procedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    signup: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string(),
          firmName: z.string(),
          userName: z.string(),
        })
      )
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    logout: t.procedure.mutation(
      async (): Promise<{ ok: true }> => NOT_IMPL()
    ),
    acceptInvite: t.procedure
      .input(z.object({ token: z.string(), password: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    forgotPassword: t.procedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    resetPassword: t.procedure
      .input(z.object({ token: z.string(), password: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  clients: t.router({
    list: t.procedure
      .input(
        z.object({
          search: z.string().optional(),
          state: z.array(z.string()).optional(),
          entityType: z.array(z.string()).optional(),
          status: z.array(z.string()).optional(),
          tier: z.array(z.string()).optional(),
          servicePackage: z.array(z.string()).optional(),
          hasDeadlineThisWeek: z.boolean().optional(),
          assigneeId: z.string().optional(),
          cursor: z.string().optional(),
        })
      )
      .query(
        async (): Promise<{ items: Client[]; nextCursor?: string }> =>
          NOT_IMPL()
      ),
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async (): Promise<Client | null> => NOT_IMPL()),
    create: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    update: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    archive: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    previewPackageChange: t.procedure
      .input(jsonPassthrough)
      .query(
        async (): Promise<{
          removed: Deadline[];
          added: Array<Omit<Deadline, "id">>;
          kept: Deadline[];
        }> => NOT_IMPL()
      ),
    applyPackageChange: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    assignBundle: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ added: number }> => NOT_IMPL()),
    unassignBundle: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ removed: number }> => NOT_IMPL()),
    addNote: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    toggleNotePin: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    deleteNote: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  deadlines: t.router({
    listForTriage: t.procedure
      .input(
        z.object({
          bucket: z
            .enum(["overdue", "this_week", "this_month", "long_term"])
            .optional(),
          filters: jsonPassthrough.optional(),
        })
      )
      .query(
        async (): Promise<{
          overdue: Deadline[];
          thisWeek: Deadline[];
          thisMonth: Deadline[];
          longTerm: Deadline[];
        }> => NOT_IMPL()
      ),
    listForClient: t.procedure
      .input(z.object({ clientId: z.string() }))
      .query(async (): Promise<Deadline[]> => NOT_IMPL()),
    updateStatus: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    defer: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    fileExtension: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    markExtensionApproved: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    batchAdjust: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    quickAdd: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
  }),

  servicePackages: t.router({
    list: t.procedure.query(
      async (): Promise<ServicePackage[]> => NOT_IMPL()
    ),
    suggestForClient: t.procedure
      .input(jsonPassthrough)
      .query(async (): Promise<ServicePackage | null> => NOT_IMPL()),
    assignToClient: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    clone: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    updateCustom: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  announcements: t.router({
    list: t.procedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async (): Promise<Announcement[]> => NOT_IMPL()),
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async (): Promise<Announcement | null> => NOT_IMPL()),
    acknowledge: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    snooze: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    dismiss: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    markRead: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    batchAdjustDeadlines: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    detect: t.procedure.mutation(
      async (): Promise<{ count: number }> => NOT_IMPL()
    ),
  }),

  notifications: t.router({
    list: t.procedure
      .input(jsonPassthrough.optional())
      .query(async (): Promise<Notification[]> => NOT_IMPL()),
    markRead: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    markAllRead: t.procedure.mutation(
      async (): Promise<{ ok: true }> => NOT_IMPL()
    ),
    dismiss: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    updatePreferences: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  imports: t.router({
    detectFormat: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{
          source: string;
          confidence: "high" | "low" | "ignore";
        }> => NOT_IMPL()
      ),
    suggestFieldMapping: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<unknown> => NOT_IMPL()),
    preview: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<unknown> => NOT_IMPL()),
    commit: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{ importId: string; ids: string[] }> =>
          NOT_IMPL()
      ),
    listHistory: t.procedure.query(
      async (): Promise<ImportRun[]> => NOT_IMPL()
    ),
    undo: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ removed: number }> => NOT_IMPL()),
  }),

  exports: t.router({
    request: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{ exportId: string; url?: string }> => NOT_IMPL()
      ),
    status: t.procedure
      .input(z.object({ id: z.string() }))
      .query(
        async (): Promise<{
          status: "queued" | "ready" | "failed";
          url?: string;
        }> => NOT_IMPL()
      ),
  }),

  uploads: t.router({
    requestUrl: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{ uploadUrl: string; storageKey: string }> =>
          NOT_IMPL()
      ),
  }),

  team: t.router({
    list: t.procedure.query(async (): Promise<User[]> => NOT_IMPL()),
    invite: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ inviteId: string }> => NOT_IMPL()),
    updateRole: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    remove: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),
});

export type AppRouter = typeof appRouter;
