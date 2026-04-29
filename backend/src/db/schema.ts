import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Enums (mirror v0.7 arch §5.2-5.5)

export const firmTier = pgEnum("firm_tier", ["solo", "pro", "team"]);
export const firmSubscriptionStatus = pgEnum("firm_subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "suspended",
]);
export const userRole = pgEnum("user_role", ["owner", "member"]);
export const clientStatus = pgEnum("client_status", [
  "prospect",
  "active",
  "inactive",
  "archived",
]);
export const deadlineStatus = pgEnum("deadline_status", [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "filed_extension",
  "overdue",
]);

export const firms = pgTable("firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  primaryStates: text("primary_states").array().notNull(),
  branding: jsonb("branding").notNull().default({}),
  tier: firmTier("tier").notNull().default("solo"),
  subscriptionStatus: firmSubscriptionStatus("subscription_status")
    .notNull()
    .default("trialing"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  seatLimit: integer("seat_limit").notNull().default(1),
  clientLimit: integer("client_limit"),
  logoStorageKey: text("logo_storage_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// users.id is the Supabase Auth user id (auth.users.id), so we don't generate
// our own — we rely on Supabase to mint UUIDs at signup. The relationship is
// 1:1 by id.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  role: userRole("role").notNull().default("owner"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(),
  primaryState: text("primary_state").notNull(),
  nexusStates: text("nexus_states").array().notNull().default(sql`'{}'::text[]`),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: clientStatus("status").notNull().default("active"),
  tier: text("tier").default("standard"),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  industry: text("industry"),
  county: text("county"),
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const relatedClients = pgTable(
  "related_clients",
  {
    parentClientId: uuid("parent_client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    relatedClientId: uuid("related_client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    relationship: text("relationship").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.parentClientId, t.relatedClientId] }),
  }),
);

export const servicePackages = pgTable("service_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id").references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  applicableEntityTypes: text("applicable_entity_types").array().notNull(),
  applicableStates: text("applicable_states").array(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const serviceTemplates = pgTable("service_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => servicePackages.id, { onDelete: "cascade" }),
  formType: text("form_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  dueDateRule: jsonb("due_date_rule").notNull(),
  rolloverRule: jsonb("rollover_rule").notNull(),
  defaultReminderSchedule: jsonb("default_reminder_schedule").notNull(),
  dependencies: jsonb("dependencies").notNull().default({}),
  standardChecklist: jsonb("standard_checklist").notNull().default([]),
});

export const clientServicePackages = pgTable(
  "client_service_packages",
  {
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    packageId: uuid("package_id")
      .notNull()
      .references(() => servicePackages.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({ pk: primaryKey({ columns: [t.clientId, t.packageId] }) }),
);

export const deadlines = pgTable("deadlines", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceTemplateId: uuid("service_template_id").references(
    () => serviceTemplates.id,
  ),
  period: text("period").notNull(),
  formType: text("form_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  officialDueDate: date("official_due_date").notNull(),
  adjustedDueDate: date("adjusted_due_date").notNull(),
  internalTargetDate: date("internal_target_date"),
  clientPrepDate: date("client_prep_date"),
  fileByDate: date("file_by_date"),
  payByDate: date("pay_by_date"),
  status: deadlineStatus("status").notNull().default("not_started"),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// Layer 2 — Task (PRD §3, arch §5.4)
// ───────────────────────────────────────────────────────────────────────

export const taskStatus = pgEnum("task_status", [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "filed_extension",
  "overdue",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  deadlineId: uuid("deadline_id")
    .notNull()
    .references(() => deadlines.id, { onDelete: "cascade" }),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  // Per-task forwarding-email local part. Method A — PRD §7.4. Globally
  // unique because a single inbound mailbox is fanned out by local-part.
  forwardingEmailLocalPart: text("forwarding_email_local_part")
    .notNull()
    .unique(),
  forwardingEmailRevokedAt: timestamp("forwarding_email_revoked_at", {
    withTimezone: true,
  }),
  completionPercentage: integer("completion_percentage")
    .notNull()
    .default(0),
  status: taskStatus("status").notNull().default("not_started"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedByUserId: uuid("completed_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// Layer 3 — ChecklistItem (PRD §5, arch §5.5) with §5.3 invariant at DB
// ───────────────────────────────────────────────────────────────────────

export const checklistState = pgEnum("checklist_state", [
  "not_requested",
  "requested_waiting",
  "received_unreviewed",
  "received_confirmed",
  "received_issue",
  "not_applicable",
]);

export const actorKind = pgEnum("actor_kind", ["user", "ai", "system"]);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    itemType: text("item_type").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    state: checklistState("state").notNull().default("not_requested"),
    stateChangedAt: timestamp("state_changed_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    stateChangedByKind: actorKind("state_changed_by_kind")
      .notNull()
      .default("system"),
    stateChangedByUserId: uuid("state_changed_by_user_id").references(
      () => users.id,
    ),
    aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),
    aiClassification: text("ai_classification"),
    aiFlagReason: text("ai_flag_reason"),
    aiFlagSeverity: text("ai_flag_severity"),
    sourceDocumentUrl: text("source_document_url"),
    receivedFilename: text("received_filename"),
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
    nextReminderAt: timestamp("next_reminder_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    // PRD §5.3 invariant — defense-in-depth at the DB layer. AI/system
    // writes with state=received_confirmed are silently rejected by app
    // code in `actions.setChecklistItemState`; this CHECK is the safety
    // net if app code is bypassed.
    aiCannotConfirm: check(
      "ai_cannot_confirm",
      sql`${t.state} != 'received_confirmed' OR ${t.stateChangedByKind} = 'user'`,
    ),
  }),
);

export const checklistItemEvents = pgTable("checklist_item_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  checklistItemId: uuid("checklist_item_id")
    .notNull()
    .references(() => checklistItems.id, { onDelete: "cascade" }),
  fromState: checklistState("from_state"),
  toState: checklistState("to_state").notNull(),
  actorKind: actorKind("actor_kind").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// Layer 4 — Activity, AI inferences, email drafts (arch §5.6)
// ───────────────────────────────────────────────────────────────────────

export const activityEvents = pgTable("activity_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorKind: actorKind("actor_kind").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  description: text("description").notNull(),
  payload: jsonb("payload").notNull().default({}),
  relatedChecklistItemId: uuid("related_checklist_item_id").references(
    () => checklistItems.id,
  ),
  relatedEmailDraftId: uuid("related_email_draft_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const emailDraftStatus = pgEnum("email_draft_status", [
  "draft",
  "sent",
  "discarded",
  "recalled",
  "scheduled",
  "bounced",
]);

export const emailSendMethod = pgEnum("email_send_method", [
  "cpa_send",
  "phase2_auto",
]);

export const reminderTemplates = pgTable("reminder_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id").references(() => firms.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => servicePackages.id, {
    onDelete: "cascade",
  }),
  // Stable key so we can reference the 18 v0.7 §7.6 system templates from
  // service-template default schedules.
  templateKey: text("template_key").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyMdx: text("body_mdx").notNull(),
  itemType: text("item_type"),
  trigger: text("trigger").notNull(),
  cadence: text("cadence"),
  deadlineClass: text("deadline_class"),
  phase: integer("phase").notNull().default(1),
  isSystem: boolean("is_system").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const emailDrafts = pgTable("email_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  checklistItemId: uuid("checklist_item_id").references(() => checklistItems.id),
  templateId: uuid("template_id").references(() => reminderTemplates.id),
  status: emailDraftStatus("status").notNull().default("draft"),
  toAddress: text("to_address").notNull(),
  ccAddress: text("cc_address"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  tone: text("tone").notNull().default("default"),
  aiSources: jsonb("ai_sources").notNull().default({}),
  sendMethod: emailSendMethod("send_method"),
  scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
  recallWindowExpiresAt: timestamp("recall_window_expires_at", {
    withTimezone: true,
  }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentByUserId: uuid("sent_by_user_id").references(() => users.id),
  bounceReason: text("bounce_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const aiMode = pgEnum("ai_mode", ["A", "B", "C", "D", "E"]);

export const aiInferences = pgTable("ai_inferences", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  mode: aiMode("mode").notNull(),
  model: text("model").notNull(),
  inputHash: text("input_hash").notNull(),
  output: jsonb("output").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  costCents: numeric("cost_cents", { precision: 8, scale: 4 }).notNull(),
  latencyMs: integer("latency_ms").notNull(),
  // Online eval (P0.18, PRD §4.7) — set when CPA accepts/rejects.
  wasActedOn: boolean("was_acted_on"),
  cpaActionAt: timestamp("cpa_action_at", { withTimezone: true }),
  relatedObjectType: text("related_object_type"),
  relatedObjectId: uuid("related_object_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// State announcements (system-wide, no firm_id) — arch §5.9
// ───────────────────────────────────────────────────────────────────────

export const announcementType = pgEnum("announcement_type", [
  "disaster_extension",
  "penalty_relief",
  "pte_change",
  "form_change",
  "rate_change",
  "nexus_change",
]);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  stateCode: text("state_code").notNull(),
  authority: text("authority").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  type: announcementType("type").notNull(),
  taxType: text("tax_type"),
  retroactive: boolean("retroactive").notNull().default(false),
  counties: text("counties").array().notNull().default(sql`'{}'::text[]`),
  entityTypes: text("entity_types").array().notNull().default(sql`'{}'::text[]`),
  taxTypes: text("tax_types").array().notNull().default(sql`'{}'::text[]`),
  oldDeadline: date("old_deadline"),
  newDeadline: date("new_deadline"),
  sourceUrl: text("source_url").notNull(),
  sourceAuthority: text("source_authority").notNull().default("primary"),
  parseConfidence: text("parse_confidence").notNull().default("medium"),
  rawPayload: jsonb("raw_payload"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  detectedAt: timestamp("detected_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  effectiveDate: date("effective_date"),
});

export const escalationLevel = pgEnum("escalation_level", [
  "normal",
  "dark",
  "blocking",
]);

export const firmAnnouncements = pgTable(
  "firm_announcements",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    firstNotifiedAt: timestamp("first_notified_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedByUserId: uuid("acknowledged_by_user_id").references(
      () => users.id,
    ),
    snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
    snoozeReason: text("snooze_reason"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    dismissedReason: text("dismissed_reason"),
    escalationLevel: escalationLevel("escalation_level")
      .notNull()
      .default("normal"),
    batchAdjustedAt: timestamp("batch_adjusted_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.announcementId, t.firmId] }),
  }),
);

export const announcementMatches = pgTable(
  "announcement_matches",
  {
    announcementId: uuid("announcement_id")
      .notNull()
      .references(() => announcements.id, { onDelete: "cascade" }),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    matchConfidence: text("match_confidence").notNull().default("medium"),
    matchReason: text("match_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.announcementId, t.firmId, t.clientId] }),
  }),
);

// ───────────────────────────────────────────────────────────────────────
// Notifications (per-user; arch §5.10)
// ───────────────────────────────────────────────────────────────────────

export const notificationKind = pgEnum("notification_kind", [
  "alert",
  "bounce",
  "team_invite",
  "extension_approved",
  "ai_flag",
]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  kind: notificationKind("kind").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  href: text("href").notNull(),
  payload: jsonb("payload").notNull().default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  announcementId: uuid("announcement_id").references(() => announcements.id),
  clientId: uuid("client_id").references(() => clients.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// Integrations (Tier 0) + sync runs — arch §5.8
// ───────────────────────────────────────────────────────────────────────

export const integrationKind = pgEnum("integration_kind", [
  "qbo",
  "xero",
  "gmail",
  "outlook",
  "stripe",
]);

export const integrationStatus = pgEnum("integration_status", [
  "connected",
  "syncing",
  "error",
  "disconnected",
]);

export const integrations = pgTable("integrations", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  kind: integrationKind("kind").notNull(),
  // Encrypted in storage layer (Phase 1 wires KMS); plaintext in dev.
  accessTokenCiphertext: text("access_token_ciphertext"),
  refreshTokenCiphertext: text("refresh_token_ciphertext"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  externalAccountId: text("external_account_id"),
  scope: text("scope"),
  status: integrationStatus("status").notNull().default("connected"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastError: text("last_error"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// Team invites (P0.16) — arch §5.2 implied
// ───────────────────────────────────────────────────────────────────────

export const teamInviteStatus = pgEnum("team_invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const teamInvites = pgTable("team_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: userRole("role").notNull().default("member"),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  // Opaque random token. Email link → /accept-invite?token=<this>.
  token: text("token").notNull().unique(),
  status: teamInviteStatus("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ───────────────────────────────────────────────────────────────────────
// Exports (PDF / CSV / iCal) + Audit-trail packs — arch §5.6+, PRD §15.4
// ───────────────────────────────────────────────────────────────────────

export const exportKind = pgEnum("export_kind", [
  "deadlines_csv",
  "deadlines_pdf",
  "deadlines_ical",
  "audit_trail_pdf",
  "audit_trail_json",
]);

export const exportStatus = pgEnum("export_status", [
  "queued",
  "running",
  "ready",
  "failed",
]);

export const exportRuns = pgTable("export_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id")
    .notNull()
    .references(() => users.id),
  kind: exportKind("kind").notNull(),
  // Scope hint — what this export covers. Free-form to keep flexible.
  scope: jsonb("scope").notNull().default({}),
  status: exportStatus("status").notNull().default("queued"),
  storageKey: text("storage_key"),
  downloadUrl: text("download_url"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type Firm = typeof firms.$inferSelect;
export type FirmInsert = typeof firms.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type Client = typeof clients.$inferSelect;
export type ClientInsert = typeof clients.$inferInsert;
export type Deadline = typeof deadlines.$inferSelect;
export type DeadlineInsert = typeof deadlines.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type ChecklistItemInsert = typeof checklistItems.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type AnnouncementInsert = typeof announcements.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type TeamInvite = typeof teamInvites.$inferSelect;
export type ExportRun = typeof exportRuns.$inferSelect;
