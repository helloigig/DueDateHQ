export type EntityType =
  | "LLC"
  | "S-Corp"
  | "C-Corp"
  | "Individual"
  | "Partnership"
  | "Trust";

// US 50 states + DC. Drives client primary/nexus state pickers, deadline
// jurisdictions, and announcement matching. Loosened from MVP-5 (CA/NY/TX/LA/FL)
// to full 50 in v0.7 alignment with the 50-state deadline DB + scrape pipeline.
export const STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export type StateCode = (typeof STATE_CODES)[number];

export const STATE_NAMES: Record<StateCode, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

export function isStateCode(value: string): value is StateCode {
  return (STATE_CODES as readonly string[]).includes(value);
}

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
  | "bundle_assigned";

export interface ActivityEntry {
  id: string;
  timestamp: string; // ISO datetime
  type: ActivityType;
  actorName: string;
  summary: string;
  relatedDeadlineId?: string;
}

/**
 * Prior-year posture relative to the current firm.
 *  - first_year: client has no prior return on file anywhere
 *  - returning_existing: this firm prepared the prior return
 *  - returning_new_to_us: client filed elsewhere last year, joined us this year
 *
 * Drives Mode A substrate generation: a "first_year" S-Corp gets the new-entity
 * checklist; a "returning_existing" gets the rollover checklist; a
 * "returning_new_to_us" gets the prior-year reconciliation checklist.
 */
export type PriorYearStatus =
  | "first_year"
  | "returning_existing"
  | "returning_new_to_us";

export interface Client {
  id: string;
  name: string;
  entityType: EntityType;
  primaryState: StateCode;
  nexusStates: StateCode[];
  contactEmail: string;
  contactPhone?: string;
  status: ClientStatus;
  addedAt: string;
  servicePackages: string[];
  county?: string;
  /** NAICS code or short industry tag — drives Mode A industry substrate. */
  industry?: string;
  /** 1–12. Defaults to 12 (calendar year) when unset. */
  fiscalYearEndMonth?: number;
  /** ISO date (YYYY-MM-DD). Used for "first year" filing logic. */
  dateOfIncorporation?: string;
  priorYearStatus?: PriorYearStatus;
  relatedClientIds?: string[];
  noteEntries?: ClientNote[];
  activity?: ActivityEntry[];
  contacts?: Contact[];
}

export interface Deadline {
  id: string;
  clientId: string;
  taskId?: string;
  form: string;
  jurisdiction: "federal" | StateCode;
  officialDueDate: string;
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

  /** Filing bundle that generated this deadline, if any. */
  bundleId?: string;
}

export type AnnouncementType =
  | "disaster_extension"
  | "penalty_relief"
  | "pte_change"
  | "form_change"
  | "rate_change"
  | "nexus_change";

export interface Announcement {
  id: string;
  stateCode: StateCode;
  authority: string;
  title: string;
  summary: string;
  publishedDate: string;
  detectedAt: string;
  type: AnnouncementType;
  confidence: "high" | "medium" | "low";
  counties: string[];
  entityTypes: EntityType[];
  taxTypes: string[];
  oldDeadline?: string;
  newDeadline?: string;
  sourceUrl: string;
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

export interface ReminderTemplate {
  id: string;
  firmId: string;
  packageId: string | null;
  templateKey:
    | "initial"
    | "t_minus_30"
    | "t_minus_14"
    | "t_minus_7"
    | "t_minus_1";
  subject: string;
  bodyMdx: string;
  sendTimeOfDay: string; // '09:00'
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

export type ChecklistState =
  | "not_requested"
  | "requested_waiting"
  | "received_unreviewed"
  | "received_confirmed"
  | "received_issue"
  | "not_applicable";

export interface ChecklistItem {
  id: string;
  taskId: string;
  label: string;
  itemType: string;
  description: string | null;
  sortOrder: number;
  state: ChecklistState;
  stateChangedAt: string;
  stateChangedByKind: "user" | "ai" | "system";
  stateChangedByUserId: string | null;
  aiConfidence: number | null;
  aiFlagReason: string | null;
  sourceDocumentUrl: string | null;
  lastReminderAt: string | null;
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  type: string;
  actorName: string;
  summary: string;
  relatedChecklistItemId?: string | null;
}

export interface TaskInsightBlock {
  timing: {
    windowLabel: string;
    confidence: "high" | "medium" | "low";
    basis: string;
  };
  anomalies: Array<{
    itemType: string;
    summary: string;
  }>;
  opportunities: string[];
}

export interface TaskRecord {
  id: string;
  clientId: string;
  deadlineId: string;
  title: string;
  assignedUser: string | null;
  status: DeadlineStatus;
  officialDueDate: string;
  adjustedDueDate: string;
  internalTargetDate: string | null;
  forwardingEmailAddress: string;
  completionPercentage: number;
}

export interface TaskDetail {
  task: TaskRecord;
  deadline: Deadline;
  checklistItems: ChecklistItem[];
  activityTimelineRecent: TimelineEntry[];
  aiInsights: TaskInsightBlock;
  client: Client;
}

export interface EmailDraftRecord {
  id: string;
  taskId: string;
  checklistItemId: string | null;
  status: string;
  subject: string;
  body: string;
  tone: string;
  aiSources: Record<string, unknown>;
  to: string[];
  cc: string[];
}

export interface IntegrationView {
  id: string;
  type: string;
  tier: number;
  status: string;
  lastSyncAt: string | null;
  metadata: Record<string, unknown>;
  error: Record<string, unknown> | null;
}

export type DeadlineExtensionSubStatus = "submitted" | "approved";

export interface DeadlineExtensionMeta {
  subStatus: DeadlineExtensionSubStatus | null;
  submittedAt: string | null;
  approvedAt: string | null;
  extendedFromDeadlineId: string | null;
}
