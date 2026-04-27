/**
 * Zod schemas — the input contract between frontend and backend.
 * When backend ships, it imports these verbatim. Any drift surfaces at compile time.
 */
import { z } from "zod";

export const stateCodeSchema = z.enum(["CA", "NY", "TX", "LA", "FL"]);

export const entityTypeSchema = z.enum([
  "LLC",
  "S-Corp",
  "C-Corp",
  "Individual",
  "Partnership",
  "Trust",
]);

export const deadlineStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "filed_extension",
  "overdue",
]);

export const clientStatusSchema = z.enum([
  "active",
  "inactive",
  "prospect",
  "archived",
]);

export const firmTierSchema = z.enum(["solo", "pro", "team"]);

// ---- Mutations ----

export const clientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  entityType: entityTypeSchema,
  primaryState: stateCodeSchema,
  nexusStates: z.array(stateCodeSchema).default([]),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  county: z.string().optional(),
  servicePackage: z.string().optional(),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = z.object({
  id: z.string(),
  patch: z.object({
    name: z.string().min(1).max(120).optional(),
    entityType: entityTypeSchema.optional(),
    primaryState: stateCodeSchema.optional(),
    nexusStates: z.array(stateCodeSchema).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
  }),
});
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

export const clientArchiveSchema = z.object({ id: z.string() });

export const deadlineStatusUpdateSchema = z.object({
  id: z.string(),
  status: deadlineStatusSchema,
});
export type DeadlineStatusUpdateInput = z.infer<
  typeof deadlineStatusUpdateSchema
>;

export const deadlineDeferSchema = z.object({
  id: z.string(),
  newDate: z.string(), // ISO date (YYYY-MM-DD)
});

export const deadlineQuickAddSchema = z.object({
  clientId: z.string(),
  form: z.string().min(1),
  jurisdiction: z.union([z.literal("federal"), stateCodeSchema]),
  officialDueDate: z.string(), // ISO date
});
export type DeadlineQuickAddInput = z.infer<typeof deadlineQuickAddSchema>;

export const batchAdjustSchema = z.object({
  clientIds: z.array(z.string()).min(1),
  oldDate: z.string(),
  newDate: z.string(),
  announcementTitle: z.string().optional(),
});

export const announcementDismissSchema = z.object({
  id: z.string(),
  reason: z.string().optional(),
});

export const announcementSnoozeSchema = z.object({
  id: z.string(),
  until: z.string(),
  reason: z.string().optional(),
});

export const assignBundleSchema = z.object({
  clientId: z.string(),
  bundleId: z.string(),
});

export const unassignBundleSchema = z.object({
  clientId: z.string(),
  bundleId: z.string(),
});

export const addNoteSchema = z.object({
  clientId: z.string(),
  body: z.string().min(1),
  relatedDeadlineId: z.string().optional(),
});

export const importCommitSchema = z.object({
  rows: z.array(z.any()), // parsed rows — backend re-validates per row
  source: z.string().optional(),
  skippedCount: z.number().int().nonnegative().default(0),
});

export const importUndoSchema = z.object({ id: z.string() });

export const uploadRequestSchema = z.object({
  kind: z.enum(["csv_import", "firm_logo"]),
  filename: z.string(),
  contentType: z.string(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firmName: z.string().min(1),
  userName: z.string().min(1),
  tier: firmTierSchema.default("solo"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  userName: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const teamInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});
