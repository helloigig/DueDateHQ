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
  ActivityEntry,
  AiInsight,
  Announcement,
  ChecklistItem,
  Client,
  Deadline,
  DocumentState,
  EmailDraft,
  Firm,
  FirmTier,
  ImportRun,
  Notification,
  ReminderTemplate,
  ServicePackage,
  Task,
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
    /** Provisions firm + public.users row for a fresh Supabase Auth user.
     *  Called from /onboarding/firm in real mode; mock mode skips it. */
    bootstrap: t.procedure
      .input(
        z.object({
          firmName: z.string(),
          primaryStates: z.array(z.string()),
          displayName: z.string().optional(),
        })
      )
      .mutation(
        async (): Promise<{
          firmId: string;
          alreadyProvisioned: boolean;
        }> => NOT_IMPL()
      ),
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
      async (): Promise<{
        fetched: number;
        new: number;
        lowConfidence: number;
        matchedForFirm: number;
      }> => NOT_IMPL()
    ),
    /** Reviewer queue — low-confidence scraped notices awaiting approval */
    reviewerQueue: t.procedure.query(
      async (): Promise<
        Array<{
          id: string;
          stateCode: string;
          authority: string;
          title: string;
          summary: string;
          type: string;
          sourceUrl: string;
          parseConfidence: string;
          detectedAt: string;
        }>
      > => NOT_IMPL()
    ),
    approveScraped: t.procedure
      .input(
        z.object({
          id: z.string(),
          title: z.string().optional(),
          summary: z.string().optional(),
        }),
      )
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    rejectScraped: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
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
    /** Tier 3 — parse a prior-year return PDF (storageKey from
     *  uploads.requestUrl). Returns extracted fields for reviewer
     *  approval before write. */
    parsePriorYearReturn: t.procedure
      .input(
        z.object({
          storageKey: z.string().min(1),
          clientId: z.string().uuid().optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          fields: {
            clientName: string | null;
            ein: string | null;
            entityType: string | null;
            taxYear: number | null;
            priorAGI: number | null;
            formsFiled: string[];
            k1Sources: string[];
            confidence: number;
          };
          readyForCommit: boolean;
        }> => NOT_IMPL(),
      ),
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

  tasks: t.router({
    list: t.procedure
      .input(z.object({ clientId: z.string().optional() }).optional())
      .query(async (): Promise<Task[]> => NOT_IMPL()),
    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async (): Promise<Task | null> => NOT_IMPL()),
    updateStatus: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    createForDeadline: t.procedure
      .input(z.object({ deadlineId: z.string() }))
      .mutation(
        async (): Promise<{ id: string; alreadyExists: boolean }> =>
          NOT_IMPL()
      ),
  }),

  checklists: t.router({
    listForTask: t.procedure
      .input(z.object({ taskId: z.string() }))
      .query(async (): Promise<ChecklistItem[]> => NOT_IMPL()),
    setState: t.procedure
      .input(
        z.object({
          id: z.string(),
          state: z.string() as z.ZodType<DocumentState>,
        })
      )
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  activity: t.router({
    listForTask: t.procedure
      .input(z.object({ taskId: z.string(), limit: z.number().optional() }))
      .query(async (): Promise<ActivityEntry[]> => NOT_IMPL()),
  }),

  emails: t.router({
    listForTask: t.procedure
      .input(z.object({ taskId: z.string() }))
      .query(async (): Promise<EmailDraft[]> => NOT_IMPL()),
    saveDraft: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    send: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(
        async (): Promise<{
          id: string;
          sentAt: string;
          recallWindowExpiresAt: string;
        }> => NOT_IMPL()
      ),
    recall: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    discard: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  reminderTemplates: t.router({
    list: t.procedure.query(
      async (): Promise<ReminderTemplate[]> => NOT_IMPL()
    ),
  }),

  aiInferences: t.router({
    recordAcceptance: t.procedure
      .input(z.object({ inferenceId: z.number(), accepted: z.boolean() }))
      .mutation(
        async (): Promise<{ ok: boolean; reason?: string }> => NOT_IMPL()
      ),
    summary: t.procedure
      .input(z.object({ mode: z.string().optional() }).optional())
      .query(
        async (): Promise<{
          total: number;
          actedOn: number;
          accepted: number;
          acceptanceRate: number | null;
          totalCostCents: number;
        }> => NOT_IMPL()
      ),
    /** Drift report — per-mode acceptance rate bucketed by ISO week.
     *  Surfaces deteriorating model performance before users complain. */
    driftReport: t.procedure
      .input(z.object({ mode: z.string().optional() }).optional())
      .query(
        async (): Promise<{
          weeks: Array<{
            week: string;
            total: number;
            acceptanceRate: number | null;
          }>;
          drift: number | null;
          alert: boolean;
        }> => NOT_IMPL(),
      ),
  }),

  /** Provider integrations — QBO/Xero/Gmail/Outlook/Stripe. The
   *  configured field tells the FE whether the BE has client
   *  credentials in env, so we render Connect vs Coming soon. */
  integrations: t.router({
    list: t.procedure.query(
      async (): Promise<
        Array<{
          id: string;
          kind: "qbo" | "xero" | "gmail" | "outlook" | "stripe";
          status: "connected" | "disconnected" | "error";
          externalAccountId: string | null;
          scope: string | null;
          lastSyncedAt: string | null;
          lastError: string | null;
          expiresAt: string | null;
          configured: boolean;
        }>
      > => NOT_IMPL(),
    ),
    catalog: t.procedure.query(
      async (): Promise<
        Array<{
          kind: "qbo" | "xero" | "gmail" | "outlook" | "stripe";
          configured: boolean;
        }>
      > => NOT_IMPL(),
    ),
    startConnect: t.procedure
      .input(
        z.object({
          kind: z.enum(["qbo", "xero", "gmail", "outlook"]),
          redirectTo: z.string().url(),
        }),
      )
      .mutation(async (): Promise<{ authorizeUrl: string }> => NOT_IMPL()),
    disconnect: t.procedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  aiInsights: t.router({
    listForClient: t.procedure
      .input(z.object({ clientId: z.string() }))
      .query(async (): Promise<AiInsight[]> => NOT_IMPL()),
  }),

  multistate: t.router({
    preview: t.procedure
      .input(
        z.object({
          stateCodes: z.array(z.string()),
          includeFederal: z.boolean().default(true),
          year: z.number().int().optional(),
        })
      )
      .query(
        async (): Promise<{
          groups: Array<{
            jurisdiction: string;
            templateCount: number;
            deadlineCount: number;
            deadlines: Array<{
              templateId: string;
              formType: string;
              jurisdiction: string;
              period: string;
              officialDueDate: string;
              adjustedDueDate: string;
            }>;
          }>;
          totalDeadlines: number;
          totalTemplates: number;
          statesWithoutTemplates: string[];
        }> => NOT_IMPL()
      ),
    commit: t.procedure
      .input(
        z.object({
          clientId: z.string(),
          stateCodes: z.array(z.string()),
          includeFederal: z.boolean().default(true),
          year: z.number().int().optional(),
          excludedTemplateIds: z.array(z.string()).default([]),
          saveAsPackage: z.boolean().default(false),
          customPackageName: z.string().optional(),
        })
      )
      .mutation(
        async (): Promise<{
          ok: true;
          createdDeadlines: number;
          createdTasks: number;
          createdChecklistItems: number;
          createdPackageId: string | null;
        }> => NOT_IMPL()
      ),
  }),
});

export type AppRouter = typeof appRouter;
