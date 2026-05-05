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
  // Single jsonb home for UI-level prefs that don't deserve their own
  // column. See migration 0011 for the daily-digest sub-schema and the
  // default-on backfill. Use `UserPreferences` (defined below) on read
  // paths so callers don't have to remember the shape.
  preferences: jsonb("preferences")
    .notNull()
    .default({
      dailyDigest: {
        enabled: true,
        sendHour: 7,
        days: ["mon", "tue", "wed", "thu", "fri"],
      },
    }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
});

/**
 * Shape of `users.preferences` — currently houses daily-digest opt-in
 * + cadence. Add new sub-keys here when introducing new user-scoped
 * UI prefs (e.g. notification volume, mail-density).
 *
 * Empty object = all defaults = digest disabled.
 */
export interface UserPreferences {
  dailyDigest?: {
    enabled: boolean;
    /** Hour-of-day (0-23) in the user's local timezone. */
    sendHour: number;
    /** Days of the week the digest fires. Mon-Fri default. */
    days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  };
}

// Daily-digest send history — one row per (user, local-date). Drives
// dedupe via the (user_id, local_date) UNIQUE constraint and provides
// an audit trail for ops. See migration 0011 for the schema rationale.
// Drizzle DDL mirrors the migration, but the migration is authoritative
// for the constraint name (`daily_digest_runs_user_local_date_unique`).
export const dailyDigestRuns = pgTable("daily_digest_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  localDate: date("local_date").notNull(),
  urgentCount: integer("urgent_count").notNull().default(0),
  alertsCount: integer("alerts_count").notNull().default(0),
  repliesCount: integer("replies_count").notNull().default(0),
  /** 'sent' | 'skipped_quiet' | 'skipped_disabled' | 'failed' */
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  emailId: text("email_id"),
});
export type DailyDigestRun = typeof dailyDigestRuns.$inferSelect;
export type DailyDigestRunInsert = typeof dailyDigestRuns.$inferInsert;

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
  // Service start date — when the firm took on this client. Defaults to
  // created_at on insert. Deadline-generator skips rows whose officialDueDate
  // falls before this date — the firm wasn't responsible for them, so they
  // shouldn't show up as "8d late" the moment a CPA imports a CSV. Users can
  // set it explicitly during import or per-client (P1 UI: AddClientModal +
  // Settings → Firm).
  serviceStartDate: date("service_start_date"),
  // ─── pte_change / nexus_change support (migration 0007) ───────────────
  // Tax year of the most recent PTE election (CA AB-150, NY PTET, etc.).
  // Null = never elected; latest year stored regardless of state.
  pteElectionYear: integer("pte_election_year"),
  // Computed status — drives PTE-status chip in the verdict block.
  // Values: 'elected' | 'eligible_not_elected' | 'not_eligible' | 'lapsed'.
  pteEligibilityStatus: text("pte_eligibility_status"),
  // Per-state estimated revenue from QBO sync or manual import; powers
  // nexus_change activity-signal matching. Shape: { "CA": 250000 }.
  estimatedStateRevenueJsonb: jsonb("estimated_state_revenue_jsonb")
    .notNull()
    .default({}),
  // Per-state employee count (payroll nexus signal).
  employeeCountByStateJsonb: jsonb("employee_count_by_state_jsonb")
    .notNull()
    .default({}),
  // Marketplace facilitator flag — exempts client from direct sales-tax
  // registration in many states (Amazon collects on behalf of the seller).
  hasMarketplaceFacilitator: boolean("has_marketplace_facilitator")
    .notNull()
    .default(false),
  // Auto-pay flag — when true, recomputeEstimates auto-creates a
  // "update bank instruction" TodoItem after mutation.
  estimateAutopay: boolean("estimate_autopay").notNull().default(false),
  // CPA-authored override for the AI behaviour summary on the client
  // detail header (the 1-2 sentence read of how this client behaves —
  // response speed, extension history, etc.). When null the FE renders
  // the auto-composed placeholder; when set, this string takes
  // precedence and the regenerator skips this client until cleared.
  aiSummaryOverride: text("ai_summary_override"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
});

// Per-client note entries — distinct from `clients.notes` (which is a
// freeform single text field for legacy/import notes). The note FEED
// surfaced on Client Detail (PRD §4.6) is an append-only list with
// pinning, author attribution, and optional deadline link.
export const clientNotes = pgTable("client_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id),
  body: text("body").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  relatedDeadlineId: uuid("related_deadline_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
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
  // ─── rate_change / nexus_change support (migration 0007) ─────────────
  // Estimate amount in cents (avoid float). Nullable — non-estimate
  // filings (annual returns) don't carry an amount.
  amountCents: integer("amount_cents"),
  // Original amount before any rate_change recompute. Populated by
  // recomputeEstimates so undo can restore.
  originalAmountCents: integer("original_amount_cents"),
  // Methodology used for the current estimate amount.
  estimateMethod: text("estimate_method"),
  // For nexus contraction cases: deadline marked kept-as-protective
  // through this filing year, then auto-disables.
  protectedAfterFilingYear: integer("protected_after_filing_year"),
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
  // `not_applicable` is distinct from `deferred` — kill, not push.
  // Used when a deadline becomes irrelevant mid-season (client fired,
  // entity dissolved, switched filing status). Requires a reason.
  "not_applicable",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  deadlineId: uuid("deadline_id")
    .notNull()
    .references(() => deadlines.id, { onDelete: "cascade" }),
  // Layer-1 preparer assignment.
  assignedUserId: uuid("assigned_user_id").references(() => users.id),
  // Layer-1 reviewer assignment. Phase 1 promotion of the v0.7 stub.
  // Reviewer can be different from preparer; both fields are nullable.
  reviewerUserId: uuid("reviewer_user_id").references(() => users.id),
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
  // Set when status moves to `not_applicable`. Reason is required
  // (enforced at app layer) for audit + downstream review.
  notApplicableReason: text("not_applicable_reason"),
  notApplicableAt: timestamp("not_applicable_at", { withTimezone: true }),
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
    // Provenance — null = system/template (Mode A baseline or seed); set =
    // user added it post-creation. Only user-added rows are deletable
    // (`checklists.deleteCustom` enforces this).
    addedByUserId: uuid("added_by_user_id").references(() => users.id),
    // v0.8 amendment additions per `feedback_no_manual_file_shuffle` Path E.
    // These hold AI-derived intelligence; original bytes stay in Gmail/Outlook.
    // sourceReferences: JSON list of {gmail_message_id, attachment_index,
    //   page_range?, link_strength, proposed_by, confirmed_at}. 0..N per item;
    //   handles multi-attachment emails, repeat resends, and 1-PDF-multi-K1
    //   cases without a separate Document entity (deferred per future
    //   considerations §1).
    sourceReferences: jsonb("source_references").notNull().default([]),
    // inlineText: full extracted text (email body + OCR'd attachments) for
    //   inline reading without bouncing to Gmail. ~5-30 KB per item.
    inlineText: text("inline_text"),
    // embedding: per-item semantic vector for full-text + cross-task search.
    //   Stored as jsonb (array of floats) for portability; if pgvector is
    //   provisioned the migration will swap to vector(1536). ~10 KB.
    embedding: jsonb("embedding"),
    // thumbnailUrl: signed URL to the 50 KB cached thumbnail (S3). Visual
    //   identity at-a-glance per IA §3.4.
    thumbnailUrl: text("thumbnail_url"),
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

// Per-task note feed — distinct from `clientNotes` (which lives on the
// client spine). A task note captures judgment on a specific filing
// ("client says K-1 will arrive late; OK to extend"); a client note
// captures cross-engagement context ("prefers PDFs"). Same shape as
// clientNotes, deliberately — pinning + author + free-form body.
export const taskNotes = pgTable("task_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id),
  body: text("body").notNull(),
  pinned: boolean("pinned").notNull().default(false),
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

// Mode F added in v0.8 amendment (PRD §4.3) — state change monitoring as
// first-class AI behavior, alongside Modes A-E.
export const aiMode = pgEnum("ai_mode", ["A", "B", "C", "D", "E", "F"]);

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
  /** Additional anchor URLs the scraper saw for this same canonical
   *  fingerprint — see migration 0005 + scraper.ts dedup notes. The
   *  primary `sourceUrl` is the first-seen URL; everything else lands
   *  here when fingerprint dedup fires. */
  relatedSourceUrls: text("related_source_urls")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
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

// ════════════════════════════════════════════════════════════════════════
// v0.8 amendment additions — per PRD §17.2 row 27/30/33 + 34-41.
//
// These tables operationalize the v0.8 architectural decisions: TaskMilestone
// (mini-timeline data), ImportedFact (history facts that drive Modes A-F),
// InboundReply + DeliveryEvent (Path E inbound classification + outbound
// delivery monitoring), StateAnnouncementSource (Mode F per-state freshness).
//
// All additive: zero existing-row migrations; only ALTER TABLE ADD COLUMN
// and CREATE TABLE statements. Drizzle migration safety preserved.
// ════════════════════════════════════════════════════════════════════════

// TaskMilestone — per PRD §9.4.1. The mini-timeline data model. Each Task
// has 0..N TaskMilestones (5 default types ship Day 1 per the schema spec).
// Rendered in IA v0.7 §3.4 Task detail header + §3.9a Timeline destination.
export const milestoneType = pgEnum("milestone_type", [
  "initial_meeting",
  "collect_materials",
  "prepare_workpapers",
  "internal_review",
  "client_review",
  "file",
  "pay",
]);

export const milestoneStatus = pgEnum("milestone_status", [
  "not_started",
  "in_progress",
  "blocked",
  "done",
  "overdue",
]);

export const taskMilestones = pgTable("task_milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  milestoneType: milestoneType("milestone_type").notNull(),
  // Custom milestone label (firms may name their own — P2 firm-custom types
  // per §9.4.1). Default null = use milestone_type label.
  customLabel: text("custom_label"),
  targetDate: date("target_date"),
  completedDate: date("completed_date"),
  status: milestoneStatus("status").notNull().default("not_started"),
  blockerReason: text("blocker_reason"),
  displayOrder: integer("display_order").notNull().default(0),
  // AI authority gradient (per §9.4.1):
  //   - Mode B can WRITE proposed target_date (yellow zone)
  //   - Mode E can WRITE proposed status=blocked + blocker_reason (yellow)
  //   - AI cannot WRITE status=done (mirrors §5.3 invariant)
  // proposedBy tracks origin so UI can surface "AI suggested" hints.
  proposedBy: actorKind("proposed_by").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// TaskMilestoneEvent — append-only audit log of status transitions. Required
// per §11.3 IRS audit-trail compliance.
export const taskMilestoneEvents = pgTable("task_milestone_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  milestoneId: uuid("milestone_id")
    .notNull()
    .references(() => taskMilestones.id, { onDelete: "cascade" }),
  fromStatus: milestoneStatus("from_status"),
  toStatus: milestoneStatus("to_status").notNull(),
  actorKind: actorKind("actor_kind").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ImportedFact — per PRD §6.6 + §9.4.1 + §17.2 row 39. Multi-year client
// facts extracted from inbound documents and prior-year imports. Powers
// Modes A/B/C/E. v0.8 amendment adds extraction_version provenance +
// gmail_message_status for graceful Gmail-deletion handling.
export const importedFactConfidence = pgEnum("imported_fact_confidence", [
  "high",
  "medium",
  "low",
]);

export const gmailMessageStatus = pgEnum("gmail_message_status", [
  "available",
  "gone_404",
  "pending_check",
]);

export const importedFacts = pgTable("imported_facts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "cascade",
  }),
  factType: text("fact_type").notNull(),
  // value is jsonb to handle scalars, dates, dollar amounts, structured.
  value: jsonb("value").notNull(),
  unit: text("unit"),
  taxYear: integer("tax_year"),
  // Provenance (v0.8 amendment §17.2 row 39):
  // sourceReference points to gmail_message_id + attachment_index that
  // produced this fact (when applicable). Allows re-extraction.
  sourceGmailMessageId: text("source_gmail_message_id"),
  sourceAttachmentIndex: integer("source_attachment_index"),
  sourcePageRange: text("source_page_range"),
  // extractionVersion: which Mode A version produced this fact. Enables
  // Mode A v2 re-extraction batch jobs.
  extractionVersion: text("extraction_version").notNull().default("v1"),
  lastReextractedAt: timestamp("last_reextracted_at", { withTimezone: true }),
  // gmailMessageStatus: pulled by periodic check; if `gone_404`, the source
  // is irrecoverable and Mode A v2 cannot re-extract — fact stays at v1.
  gmailMessageStatus: gmailMessageStatus("gmail_message_status")
    .notNull()
    .default("available"),
  confidence: importedFactConfidence("confidence").notNull().default("medium"),
  importTier: integer("import_tier").notNull().default(1),
  importedAt: timestamp("imported_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// InboundReply — per PRD §5.8. Every email arriving via Method A SES forward
// or Method B OAuth pull lands here. AI 7-class top-level classifier sets
// `topLevelClass`; 5-sub-intent classifier sets `replyIntent` when class =
// `client_reply_intent`.
//
// CRITICAL per Path E: bytes never copied to our storage. This table stores
// the gmail_message_id pointer + extracted text + classification metadata.
// "Open original" actions in UI deep-link back to Gmail.
export const inboundTopLevelClass = pgEnum("inbound_top_level_class", [
  "client_document",
  "client_reply_intent",
  "agency_correspondence",
  "third_party_data",
  "payment_confirm",
  "vendor_notification",
  "spam",
]);

export const inboundReplyIntent = pgEnum("inbound_reply_intent", [
  "document_provided",
  "timeline_pushback",
  "question_asked",
  "off_topic",
  "mismatched_attachment",
  "acknowledgment",
]);

export const inboundReplies = pgTable("inbound_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  // taskId is nullable until Mode A 7-class classifier assigns. Misrouted
  // inbound stays here with null taskId in a per-firm review queue.
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  // gmail_message_id is the canonical pointer; the actual email + attachments
  // live in CPA's Gmail/Outlook permanently (Path E).
  gmailMessageId: text("gmail_message_id").notNull(),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  subject: text("subject"),
  // bodyText: extracted at OAuth-read time, stored locally for inline reading
  // (per `feedback_no_manual_file_shuffle` content-chain spec).
  bodyText: text("body_text"),
  // attachmentMetadata: list of {filename, mime_type, size, attachment_index}
  // — but NOT the bytes. Bytes stay in Gmail.
  attachmentMetadata: jsonb("attachment_metadata").notNull().default([]),
  topLevelClass: inboundTopLevelClass("top_level_class"),
  replyIntent: inboundReplyIntent("reply_intent"),
  intentConfidence: numeric("intent_confidence", { precision: 3, scale: 2 }),
  // suggestedActionJson holds intent-specific routing context (propose-extension
  // date / draft-reply context / file-as-document target / etc.).
  suggestedAction: jsonb("suggested_action"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  classifiedAt: timestamp("classified_at", { withTimezone: true }),
  cpaActionedAt: timestamp("cpa_actioned_at", { withTimezone: true }),
});

// DeliveryEvent — per PRD §5.8 + §9.6. Outbound email lifecycle events from
// SES/Postmark webhooks. Bounces and complaints surface in IA v0.7 Mail
// Issues tab + Today Mailbox card + Task detail bounce banner.
export const deliveryEventType = pgEnum("delivery_event_type", [
  "submitted",
  "accepted",
  "delivered",
  "opened",
  "replied",
  "bounced",
  "complained",
  "unsubscribed",
]);

export const deliveryBounceReason = pgEnum("delivery_bounce_reason", [
  "hard_bounce",
  "soft_bounce",
  "mailbox_full",
  "spam_blocked",
  "address_not_found",
  "complaint",
  "unknown",
]);

export const deliveryEvents = pgTable("delivery_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  emailDraftId: uuid("email_draft_id")
    .notNull()
    .references(() => emailDrafts.id, { onDelete: "cascade" }),
  eventType: deliveryEventType("event_type").notNull(),
  eventAt: timestamp("event_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  rawProviderPayload: jsonb("raw_provider_payload"),
  bounceReason: deliveryBounceReason("bounce_reason"),
  diagnosticText: text("diagnostic_text"),
  // suppressedAt — when bounce led to address suppression (CPA action or
  // automatic per Settings → Mail bounce policy).
  suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
});

// StateAnnouncementSource — per IA v0.7 §3.9d Mode F Health real freshness.
// Per-state scrape job state. Drives the Mode F Health module's per-state
// breakdown (currently illustrative; this table provides the real data once
// the scraper writes here).
export const stateAnnouncementSourceStatus = pgEnum(
  "state_announcement_source_status",
  ["healthy", "stale_short", "stale_long", "rescrape_running", "broken"],
);

export const stateAnnouncementSources = pgTable(
  "state_announcement_sources",
  {
    stateCode: text("state_code").notNull(),
    authority: text("authority").notNull(), // 'DOR' / 'SoS' / 'IRS'
    sourceUrl: text("source_url").notNull(),
    lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastErrorMessage: text("last_error_message"),
    consecutiveErrorCount: integer("consecutive_error_count")
      .notNull()
      .default(0),
    nextScheduledScrapeAt: timestamp("next_scheduled_scrape_at", {
      withTimezone: true,
    }),
    status: stateAnnouncementSourceStatus("status")
      .notNull()
      .default("healthy"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.stateCode, t.authority] }),
  }),
);

// ════════════════════════════════════════════════════════════════════════
// End v0.8 amendment additions
// ════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// Federal forms catalog — see migrations/0006_federal_forms.sql for the
// rationale. The catalog is curated for the common ~30 forms; long-tail
// rows are filled in on demand via lib/federal-form-extractor.ts (LLM)
// and by lib/federal-register-poller.ts (when the Federal Register
// announces a brand-new form). FE consumers — AddDeadlineModal,
// FilingsTab, AI applicability — read from this table instead of the
// hardcoded COMMON_FORMS list that used to live in the modal.
// ════════════════════════════════════════════════════════════════════════

export const federalFormStatus = pgEnum("federal_form_status", [
  "active",
  "pending_review",
  "deprecated",
]);

export const federalFormExtractionMethod = pgEnum(
  "federal_form_extraction_method",
  ["curated", "llm", "federal_register"],
);

export const federalRegisterSourceStatus = pgEnum(
  "federal_register_source_status",
  ["healthy", "stale_short", "stale_long", "broken"],
);

export const federalFormChangeKind = pgEnum("federal_form_change_kind", [
  "due_date_change",
  "form_revision",
  "new_form",
  "deprecation",
  "instructions_update",
  "other",
]);

export const federalForms = pgTable("federal_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  formNumber: text("form_number").notNull().unique(),
  formName: text("form_name").notNull(),
  category: text("category").notNull(),
  entityTypes: text("entity_types").array().notNull().default(sql`'{}'::text[]`),
  frequency: text("frequency").notNull().default("annual"),
  dueDateRule: jsonb("due_date_rule"),
  notes: text("notes"),
  irsUrl: text("irs_url"),
  extractionMethod: federalFormExtractionMethod("extraction_method")
    .notNull()
    .default("curated"),
  confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 })
    .notNull()
    .default("1.0"),
  status: federalFormStatus("status").notNull().default("active"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  lastChangeCheckAt: timestamp("last_change_check_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const federalRegisterNotices = pgTable("federal_register_notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentNumber: text("document_number").notNull().unique(),
  title: text("title").notNull(),
  abstract: text("abstract"),
  documentType: text("document_type").notNull(),
  agency: text("agency").notNull(),
  publicationDate: date("publication_date").notNull(),
  effectiveDate: date("effective_date"),
  htmlUrl: text("html_url").notNull(),
  pdfUrl: text("pdf_url"),
  referencedFormNumbers: text("referenced_form_numbers")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  changeKind: federalFormChangeKind("change_kind").notNull().default("other"),
  parseConfidence: text("parse_confidence").notNull().default("medium"),
  rawPayload: jsonb("raw_payload"),
  detectedAt: timestamp("detected_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const federalFormChangeEvents = pgTable("federal_form_change_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  formId: uuid("form_id")
    .notNull()
    .references(() => federalForms.id, { onDelete: "cascade" }),
  noticeId: uuid("notice_id")
    .notNull()
    .references(() => federalRegisterNotices.id, { onDelete: "cascade" }),
  changeKind: federalFormChangeKind("change_kind").notNull(),
  summary: text("summary").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  // ─── form_change reviewer queue (migration 0007) ─────────────────────
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  appliedBy: uuid("applied_by").references(() => users.id, {
    onDelete: "set null",
  }),
  // Admin's modifications to parsed values before applying. AI may have
  // misclassified a field; admin edits before commit.
  userOverridesJsonb: jsonb("user_overrides_jsonb"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const federalRegisterSources = pgTable("federal_register_sources", {
  sourceKey: text("source_key").primaryKey(),
  label: text("label").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  consecutiveErrorCount: integer("consecutive_error_count")
    .notNull()
    .default(0),
  nextScheduledPollAt: timestamp("next_scheduled_poll_at", {
    withTimezone: true,
  }),
  status: federalRegisterSourceStatus("status").notNull().default("healthy"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type FederalForm = typeof federalForms.$inferSelect;
export type FederalFormInsert = typeof federalForms.$inferInsert;
export type FederalRegisterNotice = typeof federalRegisterNotices.$inferSelect;
export type FederalRegisterNoticeInsert =
  typeof federalRegisterNotices.$inferInsert;
export type FederalFormChangeEvent =
  typeof federalFormChangeEvents.$inferSelect;
export type FederalFormChangeEventInsert =
  typeof federalFormChangeEvents.$inferInsert;
export type FederalRegisterSource =
  typeof federalRegisterSources.$inferSelect;
export type FederalRegisterSourceInsert =
  typeof federalRegisterSources.$inferInsert;

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
export type TaskMilestone = typeof taskMilestones.$inferSelect;
export type TaskMilestoneInsert = typeof taskMilestones.$inferInsert;
export type ImportedFact = typeof importedFacts.$inferSelect;
export type ImportedFactInsert = typeof importedFacts.$inferInsert;
export type InboundReply = typeof inboundReplies.$inferSelect;
export type InboundReplyInsert = typeof inboundReplies.$inferInsert;
export type DeliveryEvent = typeof deliveryEvents.$inferSelect;
export type DeliveryEventInsert = typeof deliveryEvents.$inferInsert;
export type StateAnnouncementSource =
  typeof stateAnnouncementSources.$inferSelect;
export type StateAnnouncementSourceInsert =
  typeof stateAnnouncementSources.$inferInsert;

// ═════════════════════════════════════════════════════════════════════════
// Migration 0007 — alert action surfaces (penalty_relief / pte_change /
// rate_change / nexus_change). Companion docs:
//   - docs/specs/alert-detail-{variant}.md
//   - backend/migrations/0007_alert_action_tables.sql
// ═════════════════════════════════════════════════════════════════════════

export const clientTagKind = pgEnum("client_tag_kind", [
  "penalty_relief",
  "amnesty_program",
  "audit_window",
  "engagement_note",
]);

export const clientTagStatus = pgEnum("client_tag_status", [
  "active",
  "applied",
  "expired",
  "removed",
]);

export const planningCallTopic = pgEnum("planning_call_topic", [
  "pte_strategy",
  "rate_change_review",
  "nexus_review",
  "general_planning",
]);

export const planningCallStatus = pgEnum("planning_call_status", [
  "proposed",
  "scheduled",
  "completed",
  "missed",
  "canceled",
]);

export const planningCallOutcome = pgEnum("planning_call_outcome", [
  "renewed",
  "revoked",
  "opted_in",
  "deferred",
  "no_change",
]);

export const nexusKind = pgEnum("nexus_kind", [
  "sales",
  "income",
  "payroll",
  "franchise",
]);

export const nexusStatus = pgEnum("nexus_status", [
  "not_established",
  "check_pending",
  "established",
  "borderline",
  "confirmed_no_nexus",
]);

export const estimateMethod = pgEnum("estimate_method", [
  "safe_harbor_110",
  "safe_harbor_100",
  "current_year_estimate",
  "prior_year_actual",
  "manual",
]);

// ─── client_tags (penalty_relief) ─────────────────────────────────────────
export const clientTags = pgTable("client_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  alertId: uuid("alert_id").references(() => announcements.id, {
    onDelete: "set null",
  }),
  kind: clientTagKind("kind").notNull().default("penalty_relief"),
  // Pre-rendered label for Workspace + TaskDetail surfaces.
  tagText: text("tag_text").notNull(),
  // Free-form context — full notice ref, reasoning, link to source.
  tagContext: text("tag_context"),
  // Null = retroactive (no expiry). Set = auto-EXPIRE on this date.
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  appliedAt: timestamp("applied_at", { withTimezone: true }),
  // When applied via TaskDetail's "claim relief" button, links to that task.
  appliedInTaskId: uuid("applied_in_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  removedReason: text("removed_reason"),
  status: clientTagStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

// ─── planning_calls (pte_change) ──────────────────────────────────────────
export const planningCalls = pgTable("planning_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  alertId: uuid("alert_id").references(() => announcements.id, {
    onDelete: "set null",
  }),
  topic: planningCallTopic("topic").notNull(),
  // Mode E generated bullets shown on the verdict expansion + the eventual
  // TodoItem on Today. jsonb to preserve order + per-bullet edit later.
  talkingPointsJson: jsonb("talking_points_json").notNull().default([]),
  suggestedWindowStart: date("suggested_window_start"),
  suggestedWindowEnd: date("suggested_window_end"),
  scheduledLabel: text("scheduled_label"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  outcome: planningCallOutcome("outcome"),
  outcomeNotes: text("outcome_notes"),
  status: planningCallStatus("status").notNull().default("proposed"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

// ─── client_state_nexus (nexus_change) ────────────────────────────────────
export const clientStateNexus = pgTable("client_state_nexus", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  state: text("state").notNull(),
  nexusKind: nexusKind("nexus_kind").notNull(),
  status: nexusStatus("status").notNull().default("not_established"),
  // Set when status transitions to 'established' from a check.
  establishedAt: timestamp("established_at", { withTimezone: true }),
  establishedByAlertId: uuid("established_by_alert_id").references(
    () => announcements.id,
    { onDelete: "set null" },
  ),
  establishedByUserId: uuid("established_by_user_id").references(
    () => users.id,
    { onDelete: "set null" },
  ),
  // Contraction case — nexus no longer required but firm chose to keep
  // filing as protective.
  keptProtective: boolean("kept_protective").notNull().default(false),
  keptProtectiveReason: text("kept_protective_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ─── nexus_questionnaire_runs ─────────────────────────────────────────────
// Immutable audit of "what did Sarah see / what did Sarah answer." One row
// per check completion; never updated after write.
export const nexusQuestionnaireRuns = pgTable("nexus_questionnaire_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  firmId: uuid("firm_id")
    .notNull()
    .references(() => firms.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  alertId: uuid("alert_id").references(() => announcements.id, {
    onDelete: "set null",
  }),
  state: text("state").notNull(),
  nexusKind: nexusKind("nexus_kind").notNull(),
  questionsJsonb: jsonb("questions_jsonb").notNull(),
  answersJsonb: jsonb("answers_jsonb").notNull(),
  resultStatus: nexusStatus("result_status").notNull(),
  confidence: text("confidence").notNull().default("medium"),
  recommendedFilingsJsonb: jsonb("recommended_filings_jsonb")
    .notNull()
    .default([]),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  completedBy: uuid("completed_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

export type ClientTag = typeof clientTags.$inferSelect;
export type ClientTagInsert = typeof clientTags.$inferInsert;
export type PlanningCall = typeof planningCalls.$inferSelect;
export type PlanningCallInsert = typeof planningCalls.$inferInsert;
export type ClientStateNexus = typeof clientStateNexus.$inferSelect;
export type ClientStateNexusInsert = typeof clientStateNexus.$inferInsert;
export type NexusQuestionnaireRun =
  typeof nexusQuestionnaireRuns.$inferSelect;
export type NexusQuestionnaireRunInsert =
  typeof nexusQuestionnaireRuns.$inferInsert;
