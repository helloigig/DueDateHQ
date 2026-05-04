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
  TaskNote,
  User,
} from "../../types";

const t = initTRPC.create();

const NOT_IMPL = () => {
  throw new Error("Procedure not wired to real server yet");
};

const jsonPassthrough = z.any();

// Row shapes mirroring backend Drizzle return types for v0.8 amendment tables.
// Kept narrow (only the columns the FE consumes) so refactors land cleanly.
export type TaskMilestoneRow = {
  id: string;
  firmId: string;
  taskId: string;
  milestoneType: string;
  customLabel: string | null;
  targetDate: string | null;
  completedDate: string | null;
  status: "not_started" | "in_progress" | "blocked" | "done" | "overdue";
  blockerReason: string | null;
  displayOrder: number;
  proposedBy: "user" | "ai" | "system";
};

export type InboundReplyRow = {
  id: string;
  firmId: string;
  taskId: string | null;
  gmailMessageId: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  bodyText: string | null;
  attachmentMetadata: unknown;
  topLevelClass:
    | "client_document"
    | "client_reply_intent"
    | "agency_correspondence"
    | "third_party_data"
    | "payment_confirm"
    | "vendor_notification"
    | "spam"
    | null;
  replyIntent:
    | "document_provided"
    | "timeline_pushback"
    | "question_asked"
    | "off_topic"
    | "mismatched_attachment"
    | "acknowledgment"
    | null;
  intentConfidence: string | null;
  receivedAt: string | Date;
  classifiedAt: string | Date | null;
  cpaActionedAt: string | Date | null;
};

export type DeliveryEventRow = {
  id: number;
  firmId: string;
  emailDraftId: string;
  eventType:
    | "submitted"
    | "accepted"
    | "delivered"
    | "opened"
    | "replied"
    | "bounced"
    | "complained"
    | "unsubscribed";
  eventAt: string | Date;
  bounceReason: string | null;
  diagnosticText: string | null;
  suppressedAt: string | Date | null;
};

export type DeliveryEventIssueRow = {
  ev: DeliveryEventRow;
  draft: {
    id: string;
    subject: string | null;
    body: string | null;
  };
};

// Federal forms catalog DTOs — mirror the BE shape from
// backend/src/trpc/routers/federalForms.ts. Kept narrow (only what FE
// consumes) so refactors don't ripple.
export type FederalFormDTO = {
  id: string;
  formNumber: string;
  formName: string;
  category: string;
  entityTypes: string[];
  frequency: string;
  /** JSON shape — see backend `lib/due-date-rules.ts:DueDateRule`.
   *  Optional because the inferred tRPC return type marks `unknown`
   *  fields as optional even when always present. */
  dueDateRule?: unknown;
  notes: string | null;
  irsUrl: string | null;
  extractionMethod: "curated" | "llm" | "federal_register";
  confidenceScore: number;
  status: "active" | "pending_review" | "deprecated";
  lastVerifiedAt: string | null;
  lastChangeCheckAt: string | null;
};

export type FederalFormChangeKind =
  | "due_date_change"
  | "form_revision"
  | "new_form"
  | "deprecation"
  | "instructions_update"
  | "other";

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
    sendBulletinEmails: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{
          sentCount: number;
          skippedCount: number;
          sent: Array<{ clientId: string; draftId: string }>;
          skipped: Array<{ clientId: string; reason: string }>;
        }> => NOT_IMPL(),
      ),
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

  // todoItems — computed view per PRD §4.8 + IA v0.7 §3.1. NOT a stored
  // table; aggregates from 9 sources (Modes A-F + InboundReply intent +
  // DeliveryEvent bounces + manual). Frontend renders via ActionQueue.
  todoItems: t.router({
    list: t.procedure
      .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
      .query(
        async (): Promise<{
          items: Array<{
            id: string;
            source: string;
            verb: "Send" | "Confirm" | "Apply" | "Discuss";
            client: string;
            clientId: string;
            task?: string;
            taskId?: string;
            dueDate?: string;
            action: string;
            context: string;
            stageLabel?: string;
            daysBehind?: number;
            urgency: "high" | "medium" | "normal";
            urgencyScore: number;
            surface:
              | "email_draft_modal"
              | "task_detail"
              | "alert_detail"
              | "opportunity_detail"
              | "bounce_modal";
          }>;
          total: number;
          sourcesPending: string[];
        }> => NOT_IMPL(),
      ),
  }),

  // modeFHealth — IA v0.7 §3.9d. State-monitoring's own monitoring (overall
  // status from the announcement pipeline; per-state breakdown illustrative
  // pending Phase 3 backend last_scraped_at).
  modeFHealth: t.router({
    status: t.procedure.query(
      async (): Promise<{
        overall: "green" | "amber" | "red";
        total: number;
        stale: number;
        lastSyncMinAgo: number | null;
        nextSyncInMin: number;
        perState: Array<{
          code: string;
          label: string;
          staleHours: number;
          status: string;
        }>;
        perStateIllustrative: boolean;
      }> => NOT_IMPL(),
    ),
  }),

  // taskMilestones — PRD §9.4.1. Mini-timeline data model. Powers Task detail
  // header + Timeline destination. AI authority: Mode B writes target_date;
  // Mode E writes status=blocked; AI cannot write status=done.
  taskMilestones: t.router({
    listForTask: t.procedure
      .input(z.object({ taskId: z.string().uuid() }))
      .query(async (): Promise<TaskMilestoneRow[]> => NOT_IMPL()),
    fleetStack: t.procedure
      .input(
        z
          .object({
            waitingOnly: z.boolean().optional(),
            limit: z.number().min(1).max(500).optional(),
          })
          .optional(),
      )
      .query(async (): Promise<TaskMilestoneRow[]> => NOT_IMPL()),
    /** Mode B propose-and-seed — calls predictMilestoneTargetDates and inserts
     *  5 default milestones. Idempotent — returns existing on repeat call. */
    proposeForTask: t.procedure
      .input(z.object({ taskId: z.string().uuid() }))
      .mutation(
        async (): Promise<{
          proposed: boolean;
          milestones: TaskMilestoneRow[];
          overallConfidence?: "high" | "medium" | "low";
          basisOfEstimate?: string;
        }> => NOT_IMPL(),
      ),
    /** Mode E blocker detection — proposes status="blocked" for at-risk
     *  milestones (yellow zone). CPA dismisses via update mutation. */
    detectBlockers: t.procedure
      .input(z.object({ taskId: z.string().uuid() }))
      .mutation(
        async (): Promise<{
          decisions: Array<{
            milestoneId: string;
            shouldBlock: boolean;
            blockerReason: string;
            confidence: "high" | "medium" | "low";
          }>;
          appliedCount: number;
        }> => NOT_IMPL(),
      ),
    update: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<TaskMilestoneRow> => NOT_IMPL()),
    add: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<TaskMilestoneRow> => NOT_IMPL()),
  }),

  // inboundReplies — PRD §5.8. Mail Inbox + Task detail conversation surface.
  // 7-class top-level + 5+1 sub-intent classification persisted here.
  inboundReplies: t.router({
    list: t.procedure
      .input(
        z
          .object({
            taskId: z.string().uuid().optional(),
            topLevelClass: z.string().optional(),
            replyIntent: z.string().optional(),
            limit: z.number().min(1).max(200).optional(),
          })
          .optional(),
      )
      .query(async (): Promise<InboundReplyRow[]> => NOT_IMPL()),
    markActioned: t.procedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async (): Promise<InboundReplyRow> => NOT_IMPL()),
    linkToTask: t.procedure
      .input(z.object({ id: z.string().uuid(), taskId: z.string().uuid() }))
      .mutation(async (): Promise<InboundReplyRow> => NOT_IMPL()),
  }),

  // deliveryEvents — PRD §5.8. Mail Issues tab + bounce surfacing.
  deliveryEvents: t.router({
    issues: t.procedure
      .input(z.object({ limit: z.number().min(1).max(200).optional() }).optional())
      .query(async (): Promise<DeliveryEventIssueRow[]> => NOT_IMPL()),
    forDraft: t.procedure
      .input(z.object({ emailDraftId: z.string().uuid() }))
      .query(async (): Promise<DeliveryEventRow[]> => NOT_IMPL()),
    suppressEvent: t.procedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async (): Promise<DeliveryEventRow | null> => NOT_IMPL()),
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
      .mutation(
        async (): Promise<{
          newClients: number;
          duplicates: number;
          withPackage: number;
          unmatchedPackages: string[];
        }> => NOT_IMPL(),
      ),
    commit: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{
          importId: string;
          ids: string[];
          clientsCreated?: number;
          skippedCount?: number;
          deadlinesCreated?: number;
          tasksCreated?: number;
        }> => NOT_IMPL()
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
    /** Tier 3 commit — write reviewed prior-year extraction to imported_facts.
     *  Mode E reads these via generateCrossYearInsights. */
    commitPriorYearReturn: t.procedure
      .input(
        z.object({
          clientId: z.string().uuid(),
          taxYear: z.number().int(),
          fields: z.object({
            clientName: z.string().nullable().optional(),
            ein: z.string().nullable().optional(),
            entityType: z.string().nullable().optional(),
            priorAGI: z.number().nullable().optional(),
            formsFiled: z.array(z.string()).optional(),
            k1Sources: z.array(z.string()).optional(),
            confidence: z.number(),
          }),
          sourceStorageKey: z.string().optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          inserted: number;
          factTypes: string[];
        }> => NOT_IMPL(),
      ),
    /** Cross-fact consistency check — Mode C-style flag list for ImportedFact
     *  rows where the same (client × year × fact_type) has multiple sources
     *  with values that disagree beyond tolerance. */
    factConsistency: t.procedure
      .input(z.object({ clientId: z.string().uuid().optional() }).optional())
      .query(
        async (): Promise<{
          flags: Array<{
            clientId: string;
            taxYear: number;
            factType: string;
            severity: "low" | "medium" | "high";
            reason: string;
            values: Array<{
              factId: number;
              value: unknown;
              sourceGmailMessageId: string | null;
              extractionVersion: string;
              confidence: string;
            }>;
          }>;
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
    status: t.procedure.query(
      async (): Promise<{ configured: boolean }> => NOT_IMPL(),
    ),
    requestUrl: t.procedure
      .input(
        z.object({
          kind: z.enum([
            "firm_logo",
            "avatar",
            "inbound_attachment",
            "prior_year_return",
            "client_doc",
          ]),
          filename: z.string().min(1).max(200),
          contentType: z.string().min(1).max(100),
        }),
      )
      .mutation(
        async (): Promise<{
          uploadUrl: string;
          storageKey: string;
          expiresAt: string | Date;
        }> => NOT_IMPL(),
      ),
    downloadUrl: t.procedure
      .input(
        z.object({
          storageKey: z.string().min(1),
          ttlSeconds: z.number().int().min(60).max(86400).optional(),
        }),
      )
      .query(async (): Promise<{ url: string }> => NOT_IMPL()),
  }),

  team: t.router({
    list: t.procedure.query(
      async (): Promise<{
        members: Array<{
          id: string;
          email: string;
          displayName: string | null;
          role: "owner" | "member";
          timezone: string;
          lastActiveAt: string | null;
        }>;
        invites: Array<{
          id: string;
          email: string;
          role: "owner" | "member";
          invitedAt: string;
          expiresAt: string;
        }>;
      }> => NOT_IMPL(),
    ),
    invite: t.procedure
      .input(jsonPassthrough)
      .mutation(
        async (): Promise<{ inviteId: string; token?: string }> => NOT_IMPL(),
      ),
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
    // Phase-1 task action surface (canonical 8-action set).
    assign: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    defer: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    fileExtension: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    markNotApplicable: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
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
    // Phase-1 add/delete for ad-hoc (user-authored) items. Template
    // items remain protected — `deleteCustom` rejects FORBIDDEN if the
    // item has no `addedByUserId`.
    addCustom: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    deleteCustom: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
  }),

  activity: t.router({
    listForTask: t.procedure
      .input(z.object({ taskId: z.string(), limit: z.number().optional() }))
      .query(async (): Promise<ActivityEntry[]> => NOT_IMPL()),
  }),

  // Per-task note feed — Phase-1 promotion of the v0.7 stub. Distinct
  // from `clients.*` notes which capture cross-engagement context.
  taskNotes: t.router({
    listForTask: t.procedure
      .input(z.object({ taskId: z.string() }))
      .query(async (): Promise<TaskNote[]> => NOT_IMPL()),
    add: t.procedure
      .input(jsonPassthrough)
      .mutation(async (): Promise<{ id: string }> => NOT_IMPL()),
    togglePin: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true; pinned: boolean }> => NOT_IMPL()),
    delete: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
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

  /** AI mode dispatchers — call Anthropic via the BE in real mode. */
  ai: t.router({
    status: t.procedure.query(
      async (): Promise<{ configured: boolean }> => NOT_IMPL(),
    ),
    classifyDocument: t.procedure
      .input(
        z.object({
          filename: z.string().min(1),
          itemType: z.string().optional(),
          textPreview: z.string().optional(),
          taskContext: z
            .object({
              formType: z.string(),
              clientName: z.string(),
              pendingItems: z.array(
                z.object({ itemType: z.string(), label: z.string() }),
              ),
            })
            .optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          guess: string;
          itemType: string | null;
          confidence: "high" | "medium" | "low";
          flagReason?: string;
          inferenceId: number;
        }> => NOT_IMPL(),
      ),
    draftEmail: t.procedure
      .input(
        z.object({
          client: z.object({ name: z.string() }),
          task: z.object({ formType: z.string() }),
          itemLabel: z.string().optional(),
          itemType: z.string().optional(),
          context: z.string().optional(),
          tone: z.enum(["warm", "neutral", "urgent"]),
          cpaSignature: z.string(),
          forwardingEmail: z.string(),
          methodBConnected: z.boolean().optional(),
          voiceSamples: z.array(z.string()).optional(),
          missingDocs: z
            .array(
              z.object({
                itemType: z.string(),
                label: z.string(),
                lastYearArrival: z.string().optional(),
              }),
            )
            .optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          subject: string;
          body: string;
          aiSources: Array<{ kind: string; note: string }>;
          inferenceId: number;
        }> => NOT_IMPL(),
      ),
    /** Mode B — arrival timing prediction for chase scheduling */
    predictArrivalTiming: t.procedure
      .input(
        z.object({
          clientId: z.string(),
          itemType: z.string(),
          priorArrivals: z.array(z.string()),
          today: z.string(),
          cohortWindow: z
            .object({ start: z.string(), end: z.string() })
            .optional(),
        }),
      )
      .query(
        async (): Promise<{
          windowStart: string | null;
          windowEnd: string | null;
          confidence: "high" | "medium" | "low";
          reasoning: string;
          anomalyHint?: string;
          inferenceId: number;
        } | null> => NOT_IMPL(),
      ),
    /** Mode C — contextual anomaly detection on financial values */
    detectAnomaly: t.procedure
      .input(
        z.object({
          clientId: z.string(),
          fieldLabel: z.string(),
          currentValue: z.number(),
          priorValues: z.array(z.number()),
          context: z.string().optional(),
          entityType: z.string().optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          isAnomaly: boolean;
          severity: "low" | "medium" | "high";
          reason: string;
          likelyExplanation: string;
          needsCpaJudgment: boolean;
          inferenceId: number;
        } | null> => NOT_IMPL(),
      ),
    /** Mode E — cross-year advisory insights */
    generateCrossYearInsights: t.procedure
      .input(
        z.object({
          clientId: z.string(),
          clientName: z.string(),
          entityType: z.string(),
          primaryState: z.string(),
          yearlyFacts: z.array(
            z.object({
              year: z.number(),
              items: z.array(
                z.object({
                  itemType: z.string(),
                  value: z.number().optional(),
                  label: z.string().optional(),
                }),
              ),
            }),
          ),
          currentChecklist: z.array(
            z.object({
              itemType: z.string(),
              label: z.string(),
              state: z.string(),
            }),
          ),
        }),
      )
      .mutation(
        async (): Promise<{
          insights: Array<{
            category:
              | "missing_item"
              | "election_opportunity"
              | "credit_eligibility"
              | "structural"
              | "regression_risk";
            title: string;
            detail: string;
            confidence: "high" | "medium" | "low";
            priorYearsEvidence: number[];
          }>;
          inferenceId: number;
        } | null> => NOT_IMPL(),
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
          p50LatencyMs: number | null;
          p95LatencyMs: number | null;
        }> => NOT_IMPL()
      ),
    /** Multi-mode overview — one row per Mode A-F in a single query. Drives
     *  Settings → AI eval all-modes table. */
    summaryAll: t.procedure.query(
      async (): Promise<
        Array<{
          mode: "A" | "B" | "C" | "D" | "E" | "F";
          total: number;
          actedOn: number;
          accepted: number;
          acceptanceRate: number | null;
          totalCostCents: number;
          p50LatencyMs: number | null;
          p95LatencyMs: number | null;
        }>
      > => NOT_IMPL(),
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

  /** Files-from-clients channels — digests, SMS, cover sheets. The
   *  through-line of the product. */
  filesFromClients: t.router({
    digestForClient: t.procedure
      .input(
        z.object({
          clientId: z.string(),
          cpaSignature: z.string(),
          tone: z.enum(["warm", "neutral", "urgent"]).optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          clientId: string;
          clientName: string;
          clientEmail: string | null;
          tasks: Array<{
            taskId: string;
            formType: string;
            forwardingEmail: string;
            pendingItems: Array<{ itemType: string; label: string }>;
          }>;
          draft: {
            subject: string;
            body: string;
            aiSources: Array<{ kind: string; note: string }>;
            inferenceId: number;
          } | null;
        } | null> => NOT_IMPL(),
      ),
    digestForFirm: t.procedure
      .input(
        z.object({
          cpaSignature: z.string(),
          tone: z.enum(["warm", "neutral", "urgent"]).optional(),
        }),
      )
      .mutation(
        async (): Promise<
          Array<{
            clientId: string;
            clientName: string;
            clientEmail: string | null;
            tasks: Array<{
              taskId: string;
              formType: string;
              forwardingEmail: string;
              pendingItems: Array<{ itemType: string; label: string }>;
            }>;
            draft: {
              subject: string;
              body: string;
              aiSources: Array<{ kind: string; note: string }>;
              inferenceId: number;
            } | null;
          }>
        > => NOT_IMPL(),
      ),
    smsStatus: t.procedure.query(
      async (): Promise<{ configured: boolean }> => NOT_IMPL(),
    ),
    sendChaseSms: t.procedure
      .input(
        z.object({
          to: z.string().min(8),
          body: z.string().min(1).max(160),
          taskId: z.string().uuid().optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          ok: true;
          provider: "twilio";
          providerMessageId: string;
        }> => NOT_IMPL(),
      ),
    composeChaseSms: t.procedure
      .input(
        z.object({
          clientFirstName: z.string(),
          cpaName: z.string(),
          formType: z.string(),
          missingItem: z.string().optional(),
          forwardingEmail: z.string(),
        }),
      )
      .query(async (): Promise<{ body: string }> => NOT_IMPL()),
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
    /** Method B on-demand poll for Gmail/Outlook inbox */
    pollMethodB: t.procedure
      .input(z.object({ provider: z.enum(["gmail", "outlook"]) }))
      .mutation(
        async (): Promise<{
          messagesScanned: number;
          matched: number;
          attachmentsClassified: number;
          errors: number;
        }> => NOT_IMPL(),
      ),
    /** On-demand sync — pull QBO/Xero customers into clients now */
    syncNow: t.procedure
      .input(z.object({ provider: z.enum(["qbo", "xero"]) }))
      .mutation(
        async (): Promise<{
          fetched: number;
          inserted: number;
          updated: number;
          skipped: number;
          errors: number;
        }> => NOT_IMPL(),
      ),
  }),

  aiInsights: t.router({
    listForClient: t.procedure
      .input(z.object({ clientId: z.string() }))
      .query(async (): Promise<AiInsight[]> => NOT_IMPL()),
  }),

  // Federal forms catalog — backs AddDeadlineModal's form picker,
  // FilingsTab, and AI applicability. Replaces the hardcoded
  // COMMON_FORMS list.
  federalForms: t.router({
    list: t.procedure
      .input(
        z
          .object({
            search: z.string().optional(),
            entityType: z.string().optional(),
            category: z.string().optional(),
            frequency: z.string().optional(),
            status: z.array(z.string()).optional(),
            includePendingReview: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async (): Promise<FederalFormDTO[]> => NOT_IMPL()),
    getByFormNumber: t.procedure
      .input(z.object({ formNumber: z.string() }))
      .query(async (): Promise<FederalFormDTO | null> => NOT_IMPL()),
    applicabilityForClient: t.procedure
      .input(z.object({ clientId: z.string() }))
      .query(
        async (): Promise<{
          clientId: string;
          entityType: string;
          primaryState: string;
          forms: Array<{
            form: FederalFormDTO;
            confidence: "high" | "medium";
            reason: string;
          }>;
        }> => NOT_IMPL(),
      ),
    extractFromLlm: t.procedure
      .input(z.object({ formNumber: z.string(), hint: z.string().optional() }))
      .mutation(
        async (): Promise<{
          form: FederalFormDTO;
          created: boolean;
          llmCalled: boolean;
          confidence: number;
          needsReview: boolean;
        }> => NOT_IMPL(),
      ),
    recentChanges: t.procedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(200).optional(),
            includeReviewed: z.boolean().optional(),
          })
          .optional(),
      )
      .query(
        async (): Promise<
          Array<{
            eventId: number;
            changeKind: FederalFormChangeKind;
            summary: string;
            createdAt: string;
            reviewedAt: string | null;
            appliedAt: string | null;
            form: { id: string; formNumber: string; formName: string };
            notice: {
              id: string;
              documentNumber: string;
              title: string;
              publicationDate: string;
              htmlUrl: string;
              parseConfidence: string;
            };
          }>
        > => NOT_IMPL(),
      ),
    markChangeReviewed: t.procedure
      .input(z.object({ eventId: z.number().int(), applied: z.boolean() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    /** Admin applies a parsed catalog change. Optional per-field
     *  userOverrides edit AI-parsed values before commit. */
    applyChangeEvent: t.procedure
      .input(
        z.object({
          eventId: z.number().int(),
          userOverrides: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .mutation(
        async (): Promise<{
          applied: true;
          appliedAt: string;
          fieldsApplied: string[];
        }> => NOT_IMPL(),
      ),
    /** Admin rejects with required reason; feeds parser feedback loop. */
    rejectChangeEvent: t.procedure
      .input(
        z.object({
          eventId: z.number().int(),
          reason: z.string().min(1).max(500),
        }),
      )
      .mutation(
        async (): Promise<{
          rejected: true;
          rejectedAt: string;
        }> => NOT_IMPL(),
      ),
    /** Non-admin acknowledge — read-only mark-as-seen. */
    acknowledgeChangeEvent: t.procedure
      .input(z.object({ eventId: z.number().int() }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),
    pollNow: t.procedure.mutation(
      async (): Promise<{
        fetched: number;
        inserted: number;
        changeEvents: number;
        lowConfidence: number;
        duplicatesSkipped: number;
      }> => NOT_IMPL(),
    ),
  }),

  /** Action surfaces for the 5 non-disaster alertType variants —
   *  penalty_relief / pte_change / rate_change / nexus_change.
   *  (form_change procedures live on federalForms above since they
   *  mutate the catalog directly.) */
  alertActions: t.router({
    // ─── penalty_relief ──────────────────────────────────────────────────
    tagClientsForRelief: t.procedure
      .input(
        z.object({
          announcementId: z.string(),
          clientIds: z.array(z.string()).min(1),
          expiresAt: z.string().nullable(),
        }),
      )
      .mutation(
        async (): Promise<{
          taggedCount: number;
          duplicateCount: number;
          failedCount: number;
        }> => NOT_IMPL(),
      ),
    markTagApplied: t.procedure
      .input(z.object({ tagId: z.string(), taskId: z.string().optional() }))
      .mutation(
        async (): Promise<{ ok: true; appliedAt?: string }> => NOT_IMPL(),
      ),
    untag: t.procedure
      .input(z.object({ tagId: z.string(), reason: z.string().min(1) }))
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),

    // ─── pte_change ──────────────────────────────────────────────────────
    schedulePlanningCalls: t.procedure
      .input(
        z.object({
          announcementId: z.string(),
          clientIds: z.array(z.string()).min(1),
          suggestedWindow: z.enum([
            "this_week",
            "next_2_weeks",
            "before_deadline",
          ]),
        }),
      )
      .mutation(
        async (): Promise<{
          callsCreated: number;
          todoItemsAdded: number;
        }> => NOT_IMPL(),
      ),
    markPlanningCallCompleted: t.procedure
      .input(
        z.object({
          callId: z.string(),
          outcome: z.enum([
            "renewed",
            "revoked",
            "opted_in",
            "deferred",
            "no_change",
          ]),
          notes: z.string().optional(),
        }),
      )
      .mutation(async (): Promise<{ ok: true }> => NOT_IMPL()),

    // ─── rate_change ─────────────────────────────────────────────────────
    recomputeEstimates: t.procedure
      .input(
        z.object({
          announcementId: z.string(),
          selections: z.array(
            z.object({
              deadlineId: z.string(),
              overrideAmountCents: z.number().int().optional(),
            }),
          ),
          ruleJurisdiction: z.enum([
            "federal",
            "CA",
            "NY",
            "NJ",
            "MA",
            "IL",
            "AZ",
          ]),
          ruleTaxYear: z.number().int(),
        }),
      )
      .mutation(
        async (): Promise<{
          recomputedCount: number;
          bankUpdateTodos: number;
          undoToken: string;
          expiresAt: string;
        }> => NOT_IMPL(),
      ),
    undoRecomputeEstimates: t.procedure
      .input(z.object({ undoToken: z.string() }))
      .mutation(
        async (): Promise<{ restoredCount: number }> => NOT_IMPL(),
      ),

    // ─── nexus_change ────────────────────────────────────────────────────
    getNexusQuestionnaire: t.procedure
      .input(
        z.object({
          state: z.string().length(2),
          nexusKind: z.enum(["sales", "income", "payroll", "franchise"]),
        }),
      )
      .query(
        async (): Promise<{
          state: string;
          nexusKind: string;
          thresholdSummary: string;
          ruleEffectiveDate: string;
          questions: Array<{ id: string; text: string }>;
          suggestedFilings: Array<{
            formCode: string;
            formName: string;
            caveat?: string;
            preCheckedOnEstablished: boolean;
          }>;
        } | null> => NOT_IMPL(),
      ),
    runNexusCheck: t.procedure
      .input(
        z.object({
          announcementId: z.string(),
          clientId: z.string(),
          state: z.string().length(2),
          nexusKind: z.enum(["sales", "income", "payroll", "franchise"]),
          answers: z.record(z.string(), z.boolean()),
        }),
      )
      .mutation(
        async (): Promise<{
          status:
            | "established"
            | "borderline"
            | "confirmed_no_nexus";
          confidence: "high" | "medium" | "low";
          reason: string;
          recommendedFilings: Array<{
            formCode: string;
            formName: string;
            caveat?: string;
            preCheckedOnEstablished: boolean;
          }>;
        }> => NOT_IMPL(),
      ),
    addNexusFilings: t.procedure
      .input(
        z.object({
          announcementId: z.string(),
          clientId: z.string(),
          state: z.string().length(2),
          filings: z.array(
            z.object({
              formCode: z.string(),
              formName: z.string(),
              dueDate: z.string().optional(),
            }),
          ),
        }),
      )
      .mutation(
        async (): Promise<{
          filingsAdded: number;
          clientId: string;
        }> => NOT_IMPL(),
      ),
    markFilingsProtective: t.procedure
      .input(
        z.object({
          announcementId: z.string(),
          deadlineIds: z.array(z.string()).min(1),
          reason: z.string().min(1),
          protectedThroughYear: z.number().int(),
        }),
      )
      .mutation(
        async (): Promise<{
          markedCount: number;
          protectedThroughYear: number;
        }> => NOT_IMPL(),
      ),
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
