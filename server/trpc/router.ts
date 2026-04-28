import { initTRPC } from "@trpc/server";
import { z } from "zod";
import {
  addClientNote,
  archiveClientRecord,
  assignPackageToClient,
  availableIntegrations,
  batchAdjustDeadlines,
  batchAdjustFromAnnouncement,
  commitImportRows,
  confirmChecklistItem,
  connectIntegration,
  createChecklistItem,
  createClient,
  createEmailDraft,
  deferDeadline,
  detectAnnouncements,
  disconnectIntegration,
  dismissAnnouncement,
  discardEmailDraft,
  fileExtension,
  getAnnouncementById,
  getClientDetail,
  getDashboardPayload,
  getFirmContext,
  getTaskActivity,
  getTaskDetail,
  listAnnouncements,
  listClients,
  listClientDeadlines,
  listImportHistoryRows,
  listIntegrationRows,
  listNotificationRows,
  listReminderTemplateRows,
  listServicePackageRows,
  listTeamMembers,
  listTriageDeadlines,
  markAllNotificationsRead,
  markAnnouncementRead,
  markChecklistItemNotApplicable,
  markExtensionApproved,
  markNotificationRead,
  markTaskComplete,
  quickAddDeadline,
  recallEmailDraft,
  rejectChecklistItem,
  restoreChecklistItem,
  scheduleEmailDraft,
  sendEmailDraft,
  simulateInboundDocument,
  syncIntegration,
  toggleClientNotePin,
  undoImportRun,
  unassignPackageFromClient,
  updateClientRecord,
  updateDeadlineStatus,
  updateEmailDraft,
  updateFirmProfile,
  updateReminderTemplateRow,
  updateTeamMemberRole,
  removeTeamMember,
  inviteTeamMember,
  cloneServicePackageRow,
  updateCustomServicePackageRow,
  deleteClientNote,
  getTaskDetail as getTask,
} from "../services/app-service";
import {
  acceptInviteSchema,
  addNoteSchema,
  announcementDismissSchema,
  assignBundleSchema,
  batchAdjustSchema,
  clientArchiveSchema,
  clientCreateSchema,
  clientUpdateSchema,
  deadlineDeferSchema,
  deadlineQuickAddSchema,
  deadlineStatusUpdateSchema,
  forgotPasswordSchema,
  importCommitSchema,
  importUndoSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  stateCodeSchema,
  entityTypeSchema,
  teamInviteSchema,
  firmTierSchema,
  unassignBundleSchema,
} from "../../src/types/schemas";

const t = initTRPC.create();
const jsonPassthrough = z.any();

const taskIdSchema = z.object({ id: z.string() });
const checklistActionSchema = z.object({ id: z.string() });
const checklistCreateSchema = z.object({
  taskId: z.string(),
  label: z.string().min(1),
  itemType: z.string().optional(),
  description: z.string().optional(),
});
const emailDraftCreateSchema = z.object({
  taskId: z.string(),
  checklistItemId: z.string().optional(),
  tone: z.string().optional(),
  intent: z.string().optional(),
});
const emailDraftUpdateSchema = z.object({
  id: z.string(),
  tone: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});
const emailDraftScheduleSchema = z.object({
  id: z.string(),
  sendAt: z.string(),
});
const integrationConnectSchema = z.object({ type: z.string() });
const integrationIdSchema = z.object({ id: z.string() });
const simulateInboundSchema = z.object({
  taskId: z.string(),
  filename: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
});
const reminderTemplateUpdateSchema = z.object({
  id: z.string(),
  patch: z.object({
    subject: z.string().optional(),
    bodyMdx: z.string().optional(),
    active: z.boolean().optional(),
  }),
});
const firmUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  primaryStates: z.array(stateCodeSchema).optional(),
  branding: z
    .object({
      primaryColor: z.string().optional(),
      emailSignature: z.string().optional(),
    })
    .optional(),
  tier: firmTierSchema.optional(),
});
const teamRoleUpdateSchema = z.object({
  id: z.string(),
  role: z.enum(["owner", "member"]),
});
const servicePackageCloneSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});
const servicePackageUpdateSchema = z.object({
  id: z.string(),
  patch: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    applicableEntityTypes: z.array(entityTypeSchema).optional(),
    applicableStates: z.array(stateCodeSchema).optional(),
  }),
});

export const appRouter = t.router({
  auth: t.router({
    session: t.procedure.query(async () => {
      const context = await getFirmContext();
      return {
        ...context,
        tier: context.firm.tier,
      };
    }),
    login: t.procedure.input(loginSchema).mutation(async () => ({ ok: true as const })),
    signup: t.procedure.input(signupSchema).mutation(async () => ({ ok: true as const })),
    logout: t.procedure.mutation(async () => ({ ok: true as const })),
    acceptInvite: t.procedure.input(acceptInviteSchema).mutation(async () => ({ ok: true as const })),
    forgotPassword: t.procedure.input(forgotPasswordSchema).mutation(async () => ({ ok: true as const })),
    resetPassword: t.procedure.input(resetPasswordSchema).mutation(async () => ({ ok: true as const })),
  }),

  dashboard: t.router({
    get: t.procedure.query(() => getDashboardPayload()),
  }),

  firm: t.router({
    get: t.procedure.query(() => getFirmContext()),
    update: t.procedure.input(firmUpdateSchema).mutation(({ input }) => updateFirmProfile(input)),
  }),

  clients: t.router({
    list: t.procedure
      .input(
        z
          .object({
            search: z.string().optional(),
            state: z.array(z.string()).optional(),
            entityType: z.array(z.string()).optional(),
            status: z.array(z.string()).optional(),
            hasDeadlineThisWeek: z.boolean().optional(),
            assigneeId: z.string().optional(),
            cursor: z.string().optional(),
          })
          .optional()
      )
      .query((opts) => listClients(opts.input ?? {})),
    get: t.procedure.input(taskIdSchema).query(({ input }) => getClientDetail(input.id)),
    create: t.procedure.input(clientCreateSchema).mutation(({ input }) => createClient(input)),
    update: t.procedure.input(clientUpdateSchema).mutation(({ input }) => updateClientRecord(input)),
    archive: t.procedure.input(clientArchiveSchema).mutation(({ input }) => archiveClientRecord(input.id)),
    previewPackageChange: t.procedure.input(jsonPassthrough).query(async () => ({ removed: [], added: [], kept: [] })),
    applyPackageChange: t.procedure.input(jsonPassthrough).mutation(async () => ({ ok: true as const })),
    assignBundle: t.procedure.input(assignBundleSchema).mutation(({ input }) =>
      assignPackageToClient(input.clientId, input.bundleId)
    ),
    unassignBundle: t.procedure.input(unassignBundleSchema).mutation(({ input }) =>
      unassignPackageFromClient(input.clientId, input.bundleId)
    ),
    addNote: t.procedure.input(addNoteSchema).mutation(({ input }) => addClientNote(input)),
    toggleNotePin: t.procedure
      .input(z.object({ clientId: z.string(), noteId: z.string() }))
      .mutation(({ input }) => toggleClientNotePin(input.clientId, input.noteId)),
    deleteNote: t.procedure
      .input(z.object({ clientId: z.string(), noteId: z.string() }))
      .mutation(({ input }) => deleteClientNote(input.clientId, input.noteId)),
  }),

  deadlines: t.router({
    listForTriage: t.procedure
      .input(z.object({ bucket: z.string().optional(), filters: jsonPassthrough.optional() }).optional())
      .query(() => listTriageDeadlines()),
    listForClient: t.procedure
      .input(z.object({ clientId: z.string() }))
      .query(({ input }) => listClientDeadlines(input.clientId)),
    updateStatus: t.procedure.input(deadlineStatusUpdateSchema).mutation(({ input }) => updateDeadlineStatus(input)),
    defer: t.procedure.input(deadlineDeferSchema).mutation(({ input }) => deferDeadline({ id: input.id, newDate: input.newDate })),
    fileExtension: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => fileExtension(input.id)),
    markExtensionApproved: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(({ input }) => markExtensionApproved(input.id)),
    batchAdjust: t.procedure.input(batchAdjustSchema).mutation(({ input }) =>
      batchAdjustDeadlines({
        clientIds: input.clientIds,
        oldDate: input.oldDate,
        newDate: input.newDate,
        announcementTitle: input.announcementTitle,
      })
    ),
    quickAdd: t.procedure.input(deadlineQuickAddSchema).mutation(({ input }) => quickAddDeadline(input)),
  }),

  tasks: t.router({
    get: t.procedure.input(taskIdSchema).query(({ input }) => getTask(input.id)),
    activity: t.procedure.input(taskIdSchema).query(({ input }) => getTaskActivity(input.id)),
    aiInsights: t.procedure.input(taskIdSchema).query(async ({ input }) => (await getTaskDetail(input.id))?.aiInsights ?? null),
    markComplete: t.procedure.input(taskIdSchema).mutation(({ input }) => markTaskComplete(input.id)),
    simulateInbound: t.procedure.input(simulateInboundSchema).mutation(({ input }) => simulateInboundDocument(input)),
  }),

  checklistItems: t.router({
    confirm: t.procedure.input(checklistActionSchema).mutation(({ input }) => confirmChecklistItem(input.id)),
    reject: t.procedure.input(checklistActionSchema).mutation(({ input }) => rejectChecklistItem(input.id)),
    markNotApplicable: t.procedure.input(checklistActionSchema).mutation(({ input }) => markChecklistItemNotApplicable(input.id)),
    restore: t.procedure.input(checklistActionSchema).mutation(({ input }) => restoreChecklistItem(input.id)),
    create: t.procedure.input(checklistCreateSchema).mutation(({ input }) => createChecklistItem(input)),
    draftEmail: t.procedure.input(emailDraftCreateSchema).mutation(({ input }) => createEmailDraft(input)),
  }),

  emailDrafts: t.router({
    create: t.procedure.input(emailDraftCreateSchema).mutation(({ input }) => createEmailDraft(input)),
    update: t.procedure.input(emailDraftUpdateSchema).mutation(({ input }) =>
      updateEmailDraft(input.id, { tone: input.tone, subject: input.subject, body: input.body })
    ),
    send: t.procedure.input(integrationIdSchema).mutation(({ input }) => sendEmailDraft(input.id)),
    schedule: t.procedure.input(emailDraftScheduleSchema).mutation(({ input }) => scheduleEmailDraft(input.id, input.sendAt)),
    discard: t.procedure.input(integrationIdSchema).mutation(({ input }) => discardEmailDraft(input.id)),
    recall: t.procedure.input(integrationIdSchema).mutation(({ input }) => recallEmailDraft(input.id)),
  }),

  servicePackages: t.router({
    list: t.procedure.query(() => listServicePackageRows()),
    suggestForClient: t.procedure.input(jsonPassthrough).query(async () => null),
    assignToClient: t.procedure.input(assignBundleSchema).mutation(({ input }) =>
      assignPackageToClient(input.clientId, input.bundleId)
    ),
    clone: t.procedure.input(servicePackageCloneSchema).mutation(({ input }) => cloneServicePackageRow(input)),
    updateCustom: t.procedure.input(servicePackageUpdateSchema).mutation(({ input }) => updateCustomServicePackageRow(input)),
  }),

  announcements: t.router({
    list: t.procedure.input(z.object({ activeOnly: z.boolean().optional() }).optional()).query(({ input }) =>
      listAnnouncements(input ?? {})
    ),
    get: t.procedure.input(taskIdSchema).query(({ input }) => getAnnouncementById(input.id)),
    acknowledge: t.procedure.input(jsonPassthrough).mutation(async () => ({ ok: true as const })),
    snooze: t.procedure.input(jsonPassthrough).mutation(async () => ({ ok: true as const })),
    dismiss: t.procedure.input(announcementDismissSchema).mutation(({ input }) => dismissAnnouncement(input.id, input.reason)),
    markRead: t.procedure.input(z.object({ id: z.string() })).mutation(({ input }) => markAnnouncementRead(input.id)),
    batchAdjustDeadlines: t.procedure
      .input(z.object({ id: z.string(), clientIds: z.array(z.string()) }))
      .mutation(({ input }) => batchAdjustFromAnnouncement(input)),
    detect: t.procedure.mutation(() => detectAnnouncements()),
  }),

  notifications: t.router({
    list: t.procedure.input(jsonPassthrough.optional()).query(() => listNotificationRows()),
    markRead: t.procedure.input(z.object({ id: z.string() })).mutation(({ input }) => markNotificationRead(input.id)),
    markAllRead: t.procedure.mutation(() => markAllNotificationsRead()),
    dismiss: t.procedure.input(jsonPassthrough).mutation(async () => ({ ok: true as const })),
    updatePreferences: t.procedure.input(jsonPassthrough).mutation(async () => ({ ok: true as const })),
  }),

  imports: t.router({
    detectFormat: t.procedure
      .input(jsonPassthrough)
      .mutation(async ({ input }) => ({ source: (input as { source?: string })?.source ?? "excel", confidence: "high" as const })),
    suggestFieldMapping: t.procedure.input(jsonPassthrough).mutation(async ({ input }) => input),
    preview: t.procedure.input(jsonPassthrough).mutation(async ({ input }) => input),
    commit: t.procedure.input(importCommitSchema).mutation(({ input }) => commitImportRows(input)),
    listHistory: t.procedure.query(() => listImportHistoryRows()),
    undo: t.procedure.input(importUndoSchema).mutation(({ input }) => undoImportRun(input.id)),
  }),

  reminderTemplates: t.router({
    list: t.procedure.query(() => listReminderTemplateRows()),
    update: t.procedure.input(reminderTemplateUpdateSchema).mutation(({ input }) => updateReminderTemplateRow(input)),
  }),

  integrations: t.router({
    list: t.procedure.query(() => listIntegrationRows()),
    available: t.procedure.query(() => availableIntegrations()),
    connect: t.procedure.input(integrationConnectSchema).mutation(({ input }) => connectIntegration(input.type)),
    syncNow: t.procedure.input(integrationIdSchema).mutation(({ input }) => syncIntegration(input.id)),
    disconnect: t.procedure.input(integrationIdSchema).mutation(({ input }) => disconnectIntegration(input.id)),
  }),

  uploads: t.router({
    requestUrl: t.procedure
      .input(
        z.object({
          kind: z.enum(["csv_import", "firm_logo"]),
          filename: z.string().min(1),
          contentType: z.string().min(1),
        })
      )
      .mutation(({ input }) => ({
        uploadUrl: `data:mock/${input.kind};${encodeURIComponent(input.filename)}`,
        storageKey: `${input.kind}/${Date.now()}-${input.filename}`,
      })),
  }),

  team: t.router({
    list: t.procedure.query(() => listTeamMembers()),
    invite: t.procedure.input(teamInviteSchema).mutation(({ input }) => inviteTeamMember(input)),
    updateRole: t.procedure.input(teamRoleUpdateSchema).mutation(({ input }) => updateTeamMemberRole(input)),
    remove: t.procedure.input(z.object({ id: z.string() })).mutation(({ input }) => removeTeamMember(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
