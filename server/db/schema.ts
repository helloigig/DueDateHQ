import {
  bigint,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const firms = pgTable("firms", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  primaryStates: text("primary_states").array().notNull().default([]),
  branding: jsonb("branding").notNull().default({}),
  plan: text("plan").notNull().default("solo"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(),
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("owner"),
    fullName: text("full_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  })
);

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(),
  primaryState: text("primary_state").notNull(),
  nexusStates: text("nexus_states").array().notNull().default([]),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("active"),
  tier: text("tier").default("standard"),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  industry: text("industry"),
  county: text("county"),
  notes: text("notes"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailBouncesConsecutive: integer("email_bounces_consecutive")
    .notNull()
    .default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
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
  (table) => ({
    pk: primaryKey({
      columns: [table.parentClientId, table.relatedClientId],
    }),
  })
);

export const servicePackages = pgTable("service_packages", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id").references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  applicableEntityTypes: text("applicable_entity_types").array().notNull(),
  applicableStates: text("applicable_states").array(),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const serviceTemplates = pgTable("service_templates", {
  id: uuid("id").primaryKey(),
  packageId: uuid("package_id")
    .notNull()
    .references(() => servicePackages.id, { onDelete: "cascade" }),
  formType: text("form_type").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  dueDateRule: jsonb("due_date_rule").notNull().default({}),
  rolloverRule: jsonb("rollover_rule").notNull().default({}),
  defaultReminderSchedule: jsonb("default_reminder_schedule")
    .notNull()
    .default({}),
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
      .references(() => servicePackages.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.packageId] }),
  })
);

export const deadlines = pgTable("deadlines", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceTemplateId: uuid("service_template_id").references(() => serviceTemplates.id),
  period: text("period").notNull().default("2026"),
  form: text("form").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  officialDueDate: date("official_due_date").notNull(),
  adjustedDueDate: date("adjusted_due_date").notNull(),
  internalTargetDate: date("internal_target_date"),
  clientPrepDate: date("client_prep_date"),
  fileByDate: date("file_by_date"),
  payByDate: date("pay_by_date"),
  status: text("status").notNull().default("not_started"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  deadlineId: uuid("deadline_id")
    .notNull()
    .references(() => deadlines.id, { onDelete: "cascade" }),
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  forwardingEmailLocalPart: text("forwarding_email_local_part").notNull(),
  forwardingEmailRevokedAt: timestamp("forwarding_email_revoked_at", {
    withTimezone: true,
  }),
  completionPercentage: integer("completion_percentage").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey(),
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
  state: text("state").notNull().default("not_requested"),
  stateChangedAt: timestamp("state_changed_at", { withTimezone: true }).notNull(),
  stateChangedByKind: text("state_changed_by_kind").notNull().default("system"),
  stateChangedByUserId: uuid("state_changed_by_user_id").references(() => users.id),
  aiConfidence: numeric("ai_confidence", { precision: 3, scale: 2 }),
  aiFlagReason: text("ai_flag_reason"),
  sourceDocumentUrl: text("source_document_url"),
  lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const checklistItemEvents = pgTable("checklist_item_events", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  checklistItemId: uuid("checklist_item_id")
    .notNull()
    .references(() => checklistItems.id, { onDelete: "cascade" }),
  fromState: text("from_state"),
  toState: text("to_state").notNull(),
  actorKind: text("actor_kind").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const activityEvents = pgTable("activity_events", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  actorKind: text("actor_kind").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  description: text("description").notNull(),
  payload: jsonb("payload").notNull().default({}),
  relatedChecklistItemId: uuid("related_checklist_item_id").references(
    () => checklistItems.id
  ),
  relatedEmailDraftId: uuid("related_email_draft_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const reminderTemplates = pgTable("reminder_templates", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id").references(() => firms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  itemTypeFilter: text("item_type_filter").notNull(),
  deadlineClassFilter: text("deadline_class_filter"),
  triggerOffsetDays: integer("trigger_offset_days").notNull(),
  cadence: text("cadence").notNull().default("once"),
  subjectTemplate: text("subject_template").notNull(),
  bodyTemplate: text("body_template").notNull(),
  defaultTone: text("default_tone").notNull().default("default"),
  automationPhase: text("automation_phase").notNull().default("phase_1"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const emailDrafts = pgTable("email_drafts", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  checklistItemId: uuid("checklist_item_id").references(() => checklistItems.id),
  templateId: uuid("template_id").references(() => reminderTemplates.id),
  status: text("status").notNull().default("draft"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  tone: text("tone").notNull().default("default"),
  aiSources: jsonb("ai_sources").notNull().default({}),
  sendMethod: text("send_method"),
  scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
  recallWindowExpiresAt: timestamp("recall_window_expires_at", {
    withTimezone: true,
  }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentByUserId: uuid("sent_by_user_id").references(() => users.id),
  bounceReason: text("bounce_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const aiInferences = pgTable("ai_inferences", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  mode: text("mode").notNull(),
  model: text("model").notNull(),
  inputHash: text("input_hash").notNull(),
  output: jsonb("output").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  costCents: numeric("cost_cents", { precision: 8, scale: 4 }).notNull(),
  latencyMs: integer("latency_ms").notNull(),
  wasActedOn: boolean("was_acted_on"),
  cpaActionAt: timestamp("cpa_action_at", { withTimezone: true }),
  relatedObjectType: text("related_object_type"),
  relatedObjectId: uuid("related_object_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const integrationConnections = pgTable("integration_connections", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  integrationType: text("integration_type").notNull(),
  integrationTier: integer("integration_tier").notNull(),
  authBlobEncrypted: text("auth_blob_encrypted").notNull().default(""),
  authBlobKmsKeyId: text("auth_blob_kms_key_id").notNull().default("dev"),
  status: text("status").notNull().default("not_connected"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
  lastError: jsonb("last_error"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const importedFacts = pgTable("imported_facts", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  connectionId: uuid("connection_id").references(() => integrationConnections.id),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  sourceObjectId: text("source_object_id"),
  factType: text("fact_type").notNull(),
  period: text("period").notNull(),
  value: jsonb("value").notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),
  importTier: integer("import_tier").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
});

export const stateAnnouncements = pgTable("state_announcements", {
  id: uuid("id").primaryKey(),
  stateCode: text("state_code").notNull(),
  authority: text("authority").notNull(),
  title: text("title").notNull(),
  rawText: text("raw_text").notNull(),
  parsedImpact: jsonb("parsed_impact").notNull().default({}),
  sourceUrl: text("source_url").notNull(),
  announcementDate: date("announcement_date").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
  confidence: numeric("confidence", { precision: 3, scale: 2 }).notNull(),
  parseStatus: text("parse_status").notNull().default("auto_published"),
});

export const affectedClientMatches = pgTable("affected_client_matches", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  announcementId: uuid("announcement_id")
    .notNull()
    .references(() => stateAnnouncements.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  matchBasis: text("match_basis").notNull(),
  matchPayload: jsonb("match_payload").notNull().default({}),
  status: text("status").notNull().default("pending"),
  dismissedReason: text("dismissed_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const notifications = pgTable("notifications", {
  id: bigint("id", { mode: "number" }).generatedByDefaultAsIdentity().primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  deepLink: text("deep_link").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const importRuns = pgTable("import_runs", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  sourceFormat: text("source_format"),
  originalFilename: text("original_filename"),
  clientsCreated: integer("clients_created").notNull().default(0),
  deadlinesCreated: integer("deadlines_created").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  status: text("status").notNull().default("in_progress"),
  committedAt: timestamp("committed_at", { withTimezone: true }),
  undoneAt: timestamp("undone_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const devInboundEvents = pgTable("dev_inbound_events", {
  id: uuid("id").primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  checklistItemId: uuid("checklist_item_id").references(() => checklistItems.id),
  filename: text("filename"),
  subject: text("subject"),
  body: text("body"),
  attachmentUrl: text("attachment_url"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const schema = {
  firms,
  users,
  clients,
  contacts,
  relatedClients,
  servicePackages,
  serviceTemplates,
  clientServicePackages,
  deadlines,
  tasks,
  checklistItems,
  checklistItemEvents,
  activityEvents,
  reminderTemplates,
  emailDrafts,
  aiInferences,
  integrationConnections,
  importedFacts,
  stateAnnouncements,
  affectedClientMatches,
  notifications,
  importRuns,
  devInboundEvents,
};

export type Schema = typeof schema;
