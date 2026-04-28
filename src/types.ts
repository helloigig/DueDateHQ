export type EntityType =
  | "LLC"
  | "S-Corp"
  | "C-Corp"
  | "Individual"
  | "Partnership"
  | "Trust";

export type StateCode = "CA" | "NY" | "TX" | "LA" | "FL";

export const STATE_NAMES: Record<StateCode, string> = {
  CA: "California",
  NY: "New York",
  TX: "Texas",
  LA: "Louisiana",
  FL: "Florida",
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
  | "bundle_assigned";

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
}

export interface Deadline {
  id: string;
  clientId: string;
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

export type DeadlineExtensionSubStatus = "submitted" | "approved";

export interface DeadlineExtensionMeta {
  subStatus: DeadlineExtensionSubStatus | null;
  submittedAt: string | null;
  approvedAt: string | null;
  extendedFromDeadlineId: string | null;
}
