export type EntityType =
  | "LLC"
  | "S-Corp"
  | "C-Corp"
  | "Individual"
  | "Partnership"
  | "Trust";

export type StateCode =
  // The 10 states with seeded service templates in
  // backend/src/db/seed-data.ts. Picking one of these spawns deadlines
  // when the client's package is assigned. See `data/supportedStates.ts`
  // for the runtime gating; this union should stay aligned.
  | "CA"
  | "FL"
  | "GA"
  | "IL"
  | "LA"
  | "MA"
  | "NJ"
  | "NY"
  | "PA"
  | "TX"
  // Decorative-only — referenced by mock announcements (OR PTE, MI
  // corporate rate, WA B&O). The product won't generate filings here
  // until seed-data.ts grows templates for them.
  | "OR"
  | "MI"
  | "WA";

export const STATE_NAMES: Record<StateCode, string> = {
  CA: "California",
  FL: "Florida",
  GA: "Georgia",
  IL: "Illinois",
  LA: "Louisiana",
  MA: "Massachusetts",
  NJ: "New Jersey",
  NY: "New York",
  PA: "Pennsylvania",
  TX: "Texas",
  OR: "Oregon",
  MI: "Michigan",
  WA: "Washington",
};

export type ClientStatus = "active" | "inactive" | "prospect" | "archived";

export type DeadlineStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "deferred"
  | "filed_extension"
  | "overdue";

export interface ClientNote {
  id: string;
  createdAt: string; // ISO datetime
  body: string;
  pinned: boolean;
  authorName: string;
  relatedDeadlineId?: string;
}

export type ActivityType =
  | "status_change"
  | "deadline_added"
  | "deadline_updated"
  | "extension_filed"
  | "client_created"
  | "client_edited"
  | "client_archived"
  | "batch_adjust"
  | "note_added"
  | "bundle_assigned"
  | "email_sent"
  | "email_received"
  | "document_received"
  | "document_confirmed"
  | "document_flagged"
  | "ai_inferred"
  | "checklist_state_change";

export interface ActivityEntry {
  id: string;
  timestamp: string; // ISO datetime
  type: ActivityType;
  actorName: string;
  summary: string;
  relatedDeadlineId?: string;
}

export type ClientTier = "premium" | "standard" | "custom";

export interface Client {
  id: string;
  name: string;
  entityType: EntityType;
  primaryState: StateCode;
  nexusStates: StateCode[];
  contactEmail: string;
  contactPhone?: string;
  status: ClientStatus;
  tier: ClientTier;
  addedAt: string;
  servicePackages: string[];
  county?: string;
  relatedClientIds?: string[];
  noteEntries?: ClientNote[];
  activity?: ActivityEntry[];
  /**
   * CPA-authored override for the AI behaviour summary on the client
   * detail header. When null/undefined the FE displays the auto-composed
   * placeholder; when set, this string takes precedence and the
   * regenerator skips this client until cleared. Phase 2: persists to
   * `clients.ai_summary_override` server-side; Phase 1 keeps it in the
   * mock store via actions.updateClient.
   */
  aiSummaryOverride?: string | null;
}

export interface Deadline {
  id: string;
  clientId: string;
  form: string;
  jurisdiction: "federal" | StateCode;
  /** Hard deadline from the jurisdiction's calendar — immutable. */
  officialDueDate: string;
  /** Firm-set internal target (typically `officialDueDate - {buffer}`).
      Optional in the type for legacy / mock rows; UI derives a default
      buffer from the form class when absent. See DESIGN.md
      §Internal vs official due. ISO YYYY-MM-DD, no time component. */
  internalDueDate?: string;
  status: DeadlineStatus;
  assignedUser?: string;
  completedAt?: string;
  notes?: string;

  // Extension tracking (set when status transitions to "filed_extension")
  extensionSubmittedAt?: string; // ISO datetime
  extensionApprovedAt?: string; // ISO datetime — blank while pending
  /** On the ORIGINAL deadline: the id of the new extension-period deadline this one spawned. */
  linkedExtensionDeadlineId?: string;
  /** On the NEW extension-period deadline: the id of the original it came from. */
  extensionOfDeadlineId?: string;

  /** Service package that generated this deadline, if any. */
  bundleId?: string;
}

export type AnnouncementType =
  | "disaster_extension"
  | "penalty_relief"
  | "pte_change"
  | "form_change"
  | "rate_change"
  | "nexus_change";

export type TaxType =
  | "income"
  | "sales_use"
  | "franchise"
  | "payroll"
  | "property"
  | "excise"
  | "multiple";

export type SourceAuthority = "primary" | "editorial" | "briefing";

export type AIConfidence = "high" | "medium" | "low";

export interface Announcement {
  id: string;
  stateCode: StateCode;
  authority: string;
  title: string;
  summary: string;

  issuanceDate: string;
  effectiveDate?: string;
  detectedAt: string;

  type: AnnouncementType;
  taxType: TaxType;
  retroactive: boolean;

  counties: string[];
  entityTypes: EntityType[];
  taxTypes: string[];
  oldDeadline?: string;
  newDeadline?: string;

  sourceUrl: string;
  /** Additional anchor URLs the scraper saw for this same fingerprint
   *  (state + type + normalized title). Populated by the BE scraper's
   *  dedup path; the FE banner uses this to show the full source set in
   *  the cluster tooltip rather than guessing from cluster size alone. */
  relatedSourceUrls?: string[];
  sourceAuthority: SourceAuthority;
  relatedAnnouncementIds: string[];

  parseConfidence: AIConfidence;
  matchConfidence: AIConfidence;

  affectedClientIds: string[];
  read: boolean;
  dismissed: boolean;
}

export interface ImportRecord {
  id: string;
  importedAt: string;
  source: string;
  clientIds: string[];
  deadlineCount: number;
  skippedCount: number;
  undone: boolean;
}

export type NotificationKind =
  | "alert" // state announcement
  | "bounce" // client email bounced
  | "team_invite" // teammate accepted invite
  | "extension_approved"; // IRS/state confirmed extension

export interface Notification {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  title: string;
  detail: string;
  href: string;
  read: boolean;
  /** For alerts: the linked announcement id */
  announcementId?: string;
  clientId?: string;
}

// -------- Backend-aligned shapes (Phase 0+ contract) --------

export type FirmTier = "solo" | "pro" | "team";
export type UserRole = "owner" | "member";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  timezone: string;
  lastActiveAt: string | null;
}

export interface Firm {
  id: string;
  name: string;
  primaryStates: StateCode[];
  logoStorageKey: string | null;
  branding: {
    primaryColor?: string;
    emailSignature?: string;
  } | null;
  tier: FirmTier;
  subscriptionStatus:
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "suspended";
  trialEndsAt: string | null;
  seatLimit: number;
  clientLimit: number | null; // null = unlimited
}

export interface Contact {
  id: string;
  clientId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  emailVerified: boolean;
  emailBouncesConsecutive: number;
}

export interface ServicePackage {
  id: string;
  firmId: string | null; // null = system package
  name: string;
  description: string | null;
  applicableEntityTypes: EntityType[];
  applicableStates: StateCode[];
  isSystem: boolean;
}

/**
 * Reminder template — both the backend-aligned shape (firmId/packageId etc.)
 * and the v0.7 §7.6 library shape (name/trigger/phase/system/body) live here.
 * Most fields are optional so the 18 system templates and any user-created
 * customizations can share the same type.
 */
export interface ReminderTemplate {
  id: string;
  // Backend-aligned (Phase 0+) — optional for the system library
  firmId?: string;
  packageId?: string | null;
  templateKey?:
    | "initial"
    | "t_minus_30"
    | "t_minus_14"
    | "t_minus_7"
    | "t_minus_1";
  bodyMdx?: string;
  sendTimeOfDay?: string; // '09:00'

  // v0.7 §7.6 library shape
  /** Display name, e.g., "W-2 first request". */
  name?: string;
  /** Trigger window relative to deadline (T-30 / T-14 / T-7 / etc.). */
  trigger?: string;
  /** Item type the template applies to (wage_w2, 1099_any, k1, etc.). */
  itemType?: string;
  /** Deadline class (individual_1040, partnership_1065, etc.). */
  deadlineClass?: string;
  /** Cadence after first send (once, weekly, every 3 days, etc.). */
  cadence?: string;
  /** Email automation phase. Phase 1 = AI draft + CPA review (default).
   *  Phase 2 = auto-send when 3 conditions met. PRD §7.3. */
  phase?: 1 | 2;
  body?: string;
  /** True for the 18 system templates that ship Day-1. */
  system?: boolean;

  subject: string;
  active: boolean;
}

export type ImportRunStatus =
  | "in_progress"
  | "committed"
  | "undone"
  | "failed";

export interface ImportRun {
  id: string;
  firmId: string;
  sourceFormat:
    | "taxdome"
    | "drake"
    | "proconnect"
    | "quickbooks"
    | "file_in_time"
    | "excel"
    | null;
  originalFilename: string | null;
  clientsCreated: number;
  deadlinesCreated: number;
  rowsFailed: number;
  status: ImportRunStatus;
  committedAt: string | null;
  undoneAt: string | null;
  createdAt: string;
}

export interface FirmAnnouncement {
  announcementId: string;
  firmId: string;
  firstNotifiedAt: string;
  acknowledgedAt: string | null;
  snoozedUntil: string | null;
  snoozeReason: string | null;
  dismissedAt: string | null;
  dismissedReason: string | null;
  escalationLevel: "normal" | "dark" | "blocking";
  batchAdjustedAt: string | null;
}

export type DeadlineExtensionSubStatus = "submitted" | "approved";

export interface DeadlineExtensionMeta {
  subStatus: DeadlineExtensionSubStatus | null;
  submittedAt: string | null;
  approvedAt: string | null;
  extendedFromDeadlineId: string | null;
}

// -------- v0.7 Layer 2-4 model (Task / ChecklistItem / Activity / Email / AI) --------

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "deferred"
  | "filed_extension"
  | "overdue"
  // Distinct from `deferred` — this is a kill, not a push. Used when the
  // deadline becomes irrelevant mid-season (client fired, entity dissolved,
  // switched filing status). Always carries a reason (audit).
  | "not_applicable";

/**
 * The six PRD §5.2 document states. Critical: AI never auto-promotes to
 * `received_confirmed` — only an explicit CPA action transitions there.
 * Enforced in `actions.confirmChecklistItem` (PRD §5.3 invariant).
 */
export type DocumentState =
  | "not_requested"
  | "requested_waiting"
  | "received_unreviewed"
  | "received_confirmed"
  | "received_issue"
  | "not_applicable";

export type AiConfidence = "high" | "medium" | "low";

/**
 * One row in the per-task checklist (Layer 3). Each row's lifecycle is one
 * of the six DocumentStates. AI-related fields are populated when AI inbound-classifier
 * (classifier on inbound) or anomaly-detector (anomaly detector) has run.
 */
export interface ChecklistItem {
  id: string;
  taskId: string;
  label: string; // "W-2 from ADP", "K-1 from Apex Fund", etc.
  itemType: string; // "wage_w2", "1099_div", "k1", "1098", "schedule_e_support" — drives templates
  state: DocumentState;
  order: number;
  custom: boolean;
  /** Set when state moved to `received_*`. */
  receivedAt?: string;
  /** AI's classification confidence on the inbound document (inbound-classifier applied to inbound). */
  aiConfidence?: AiConfidence;
  /** AI's guess of what document this is, e.g. "W-2 from ADP". */
  aiClassification?: string;
  /** AI-flagged anomaly flag. */
  flagReason?: string;
  flagSeverity?: "low" | "medium" | "high";
  /** Set on `received_confirmed`. PRD §5.3 invariant: only "cpa" allowed here. */
  confirmedAt?: string;
  confirmedBy?: string;
  /** Reminder cadence. */
  lastReminderAt?: string;
  nextReminderAt?: string;
  /** Filename of the simulated received document (we never store the bytes). */
  receivedFilename?: string;
  /** Optional source link (CPA's existing system, e.g., SharePoint). */
  sourceUrl?: string;
  /** Provenance — null = template/system, set = user added it post-creation.
   *  Only the latter is deletable. Mock-mode also carries `custom: boolean`
   *  for the same signal; real-mode reads this id directly. */
  addedByUserId?: string | null;
}

/**
 * Layer 2 — one (Deadline × Client) pair. 1:1 with Deadline at MVP.
 * Carries forwarding email per PRD §7.4 Method A.
 */
export interface Task {
  id: string;
  clientId: string;
  deadlineId: string;
  formType: string; // mirrors deadline.form
  jurisdiction: "federal" | StateCode;
  officialDueDate: string;
  internalTargetDate: string;
  clientPrepDate?: string;
  status: TaskStatus;
  /** Per-task forwarding address — `firstname-form-{4charToken}@duedatehq.space`. */
  forwardingEmail: string;
  /** Display name of the preparer. Real-mode joins also resolve `assignedUserId`. */
  assignedUser: string;
  /** Preparer user id — mirrors `tasks.assigned_user_id`. */
  assignedUserId?: string | null;
  /** Reviewer user id — Phase-1 promotion of the v0.7 stub. */
  reviewerUserId?: string | null;
  /** Display name of the reviewer (resolved server-side or by mock). */
  reviewerUser?: string | null;
  completedAt?: string;
  completedBy?: string;
  /** Set when status moves to `not_applicable`. */
  notApplicableReason?: string | null;
  notApplicableAt?: string | null;
}

/** Per-task note feed — judgment scoped to a single filing. Distinct from
 *  client notes (cross-engagement context). */
export interface TaskNote {
  id: string;
  taskId: string;
  body: string;
  pinned: boolean;
  authorUserId: string | null;
  authorName: string;
  createdAt: string;
}

export type EmailTone = "formal" | "casual" | "urgent" | "apologetic";
export type EmailDraftStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "discarded"
  | "recalled";

export interface AiSource {
  kind: "tone_match" | "prior_year" | "forwarding_email" | "cohort" | "integration" | "substrate";
  note: string;
}

/**
 * email-drafter output. Lives at Layer 4. Always has the CPA CC'd (PRD §7.2).
 */
export interface EmailDraft {
  id: string;
  taskId: string;
  clientId: string;
  checklistItemId?: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  tone: EmailTone;
  aiSources: AiSource[];
  status: EmailDraftStatus;
  scheduledFor?: string;
  sentAt?: string;
  sendMethod: "cpa_send" | "phase2_auto";
  /** Source template (when the draft originated from a system or firm
   *  template). Used by the Phase 2 eligibility detector to count
   *  approved-without-edit sends per (template × client) pair. */
  templateId?: string;
  createdAt: string;
}

/**
 * Record of every AI call. Used for online eval (PRD §4.7) and the AI
 * insights panel sources (PRD §7.2).
 */
export interface AiInference {
  id: string;
  scope: "task" | "client" | "checklist_item";
  scopeId: string;
  mode: "A" | "B" | "C" | "D" | "E";
  confidence: AiConfidence;
  payload: unknown;
  createdAt: string;
}

/**
 * Per-client per-year facts pulled from prior tax software / QBO. Powers
 * AI capabilities (PRD §6.6 Import Tier 3 unlocks this). The store seeds
 * 2-3 prior years per client so arrival-timing / anomaly / cross-year have realistic baselines.
 */
export interface ImportedFact {
  id: string;
  clientId: string;
  year: number;
  itemType: string; // "wage_w2", "k1", "schedule_e", etc.
  /** ISO date the document arrived in the prior year. Drives arrival-timing. */
  observedDate?: string;
  /** Numeric value when relevant (AI-flagged anomaly threshold). */
  observedAmount?: number;
  /** Free-text note. */
  note?: string;
}

/**
 * AI insight cards shown in the AI insights panel (cross-year-insighter + arrival-timing aggregates).
 * Cold-start fallback per PRD §4.2 when no ImportedFact exists.
 */
export interface AiInsight {
  id: string;
  clientId: string;
  mode: "B" | "C" | "E";
  title: string;
  detail: string;
  /** Inline actions: "ask_client" opens the email modal pre-filled. */
  actions: Array<"ask_client" | "schedule_advisory" | "mark_known" | "snooze">;
  status: "open" | "resolved" | "snoozed";
  createdAt: string;
}
