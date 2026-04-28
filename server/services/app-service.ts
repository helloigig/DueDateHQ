import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  activityEvents,
  affectedClientMatches,
  aiInferences,
  checklistItems,
  checklistItemEvents,
  clientServicePackages,
  clients,
  contacts,
  deadlines,
  devInboundEvents,
  emailDrafts,
  firms,
  importRuns,
  importedFacts,
  integrationConnections,
  notifications,
  reminderTemplates,
  servicePackages,
  stateAnnouncements,
  tasks,
  users,
} from "../db/schema";
import {
  DEMO_FIRM_ID,
  DEMO_USER_ID,
  ensureClientServicePackage,
  findSystemPackageByName,
} from "../db/seed";
import type {
  ActivityEntry,
  Announcement,
  Client,
  ClientNote,
  Contact,
  Deadline,
  DeadlineStatus,
  Firm,
  ImportRun,
  Notification,
  ReminderTemplate,
  ServicePackage,
  StateCode,
  User,
} from "../../src/types";

export type ChecklistState =
  | "not_requested"
  | "requested_waiting"
  | "received_unreviewed"
  | "received_confirmed"
  | "received_issue"
  | "not_applicable";

export interface ChecklistItemRecord {
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

export interface TaskDetailPayload {
  task: TaskRecord;
  deadline: Deadline;
  checklistItems: ChecklistItemRecord[];
  activityTimelineRecent: TimelineEntry[];
  aiInsights: TaskInsightBlock;
  client: Client;
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

export interface EmailDraftPayload {
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

type FirmContext = {
  user: User;
  firm: Firm;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function asNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function textHash(input: string) {
  return createHash("sha1").update(input).digest("hex");
}

function pickActorName(actorKind: string, userId: string | null) {
  if (actorKind === "ai") return "AI";
  if (actorKind === "system") return "System";
  if (userId === DEMO_USER_ID) return "Sarah Mitchell";
  return "Team member";
}

function countdownBucket(dateIso: string): "overdue" | "this_week" | "this_month" | "long_term" {
  const now = new Date("2026-04-23T11:00:00Z");
  const target = new Date(`${dateIso}T00:00:00Z`);
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 7) return "this_week";
  if (diffDays <= 38) return "this_month";
  return "long_term";
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
}

function formShort(form: string) {
  const match = form.match(/\d{3,4}[a-z]?/i);
  if (match) return match[0].toLowerCase();
  return slug(form).split("-")[0] ?? "task";
}

async function getFirmRow() {
  const firmRows = await db.select().from(firms).where(eq(firms.id, DEMO_FIRM_ID));
  const userRows = await db.select().from(users).where(eq(users.id, DEMO_USER_ID));
  const firmRow = firmRows[0];
  const userRow = userRows[0];
  if (!firmRow || !userRow) {
    throw new Error("Demo firm not initialized");
  }
  const firm: Firm = {
    id: firmRow.id,
    name: firmRow.name,
    primaryStates: firmRow.primaryStates as StateCode[],
    logoStorageKey: null,
    branding: (firmRow.branding as Firm["branding"]) ?? null,
    tier: firmRow.plan as Firm["tier"],
    subscriptionStatus: "active",
    trialEndsAt: firmRow.trialEndsAt?.toISOString() ?? null,
    seatLimit: 3,
    clientLimit: null,
  };
  const user: User = {
    id: userRow.id,
    email: userRow.email,
    displayName: userRow.fullName,
    role: userRow.role as User["role"],
    timezone: "America/Los_Angeles",
    lastActiveAt: userRow.lastActiveAt?.toISOString() ?? null,
  };
  return { firm, user };
}

async function clientPackagesMap(clientIds: string[]) {
  if (clientIds.length === 0) return new Map<string, string[]>();
  const rows = await db
    .select({
      clientId: clientServicePackages.clientId,
      packageName: servicePackages.name,
    })
    .from(clientServicePackages)
    .innerJoin(servicePackages, eq(clientServicePackages.packageId, servicePackages.id))
    .where(inArray(clientServicePackages.clientId, clientIds));
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.clientId) ?? [];
    list.push(row.packageName);
    map.set(row.clientId, list);
  }
  return map;
}

async function clientContactsMap(clientIds: string[]) {
  if (clientIds.length === 0) return new Map<string, Contact[]>();
  const rows = await db
    .select()
    .from(contacts)
    .where(inArray(contacts.clientId, clientIds))
    .orderBy(desc(contacts.isPrimary), asc(contacts.createdAt));
  const map = new Map<string, Contact[]>();
  for (const row of rows) {
    const list = map.get(row.clientId) ?? [];
    list.push({
      id: row.id,
      clientId: row.clientId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      isPrimary: row.isPrimary,
      emailVerified: row.emailVerified,
      emailBouncesConsecutive: row.emailBouncesConsecutive,
    });
    map.set(row.clientId, list);
  }
  return map;
}

async function taskRowsForClientIds(clientIds: string[]) {
  if (clientIds.length === 0) return [];
  return db
    .select({
      deadlineId: deadlines.id,
      clientId: deadlines.clientId,
      form: deadlines.form,
      jurisdiction: deadlines.jurisdiction,
      officialDueDate: deadlines.officialDueDate,
      status: deadlines.status,
      completedMeta: deadlines.metadata,
      taskId: tasks.id,
      assignedUserId: tasks.assignedUserId,
      completionPercentage: tasks.completionPercentage,
      forwardingEmailLocalPart: tasks.forwardingEmailLocalPart,
    })
    .from(deadlines)
    .innerJoin(tasks, eq(tasks.deadlineId, deadlines.id))
    .where(inArray(deadlines.clientId, clientIds))
    .orderBy(asc(deadlines.officialDueDate));
}

async function noteEntriesForClient(clientId: string): Promise<ClientNote[]> {
  const clientRows = await db
    .select({ metadata: clients.metadata })
    .from(clients)
    .where(eq(clients.id, clientId));
  const raw = clientRows[0]?.metadata as { notes?: ClientNote[] } | undefined;
  return safeArray<ClientNote>(raw?.notes);
}

async function taskActivity(taskIds: string[]) {
  if (taskIds.length === 0) return [];
  return db
    .select()
    .from(activityEvents)
    .where(inArray(activityEvents.taskId, taskIds))
    .orderBy(desc(activityEvents.createdAt));
}

async function hydrateClient(row: typeof clients.$inferSelect) {
  const packageMap = await clientPackagesMap([row.id]);
  const contactsMap = await clientContactsMap([row.id]);
  const notes = await noteEntriesForClient(row.id);
  const taskRows = await taskRowsForClientIds([row.id]);
  const events = await taskActivity(taskRows.map((item) => item.taskId));
  const activity: ActivityEntry[] = events.slice(0, 40).map((event) => ({
    id: String(event.id),
    timestamp: event.createdAt.toISOString(),
    type: event.eventType as ActivityEntry["type"],
    actorName: pickActorName(event.actorKind, event.actorUserId),
    summary: event.description,
    relatedDeadlineId: undefined,
  }));
  return {
    id: row.id,
    name: row.name,
    entityType: row.entityType as Client["entityType"],
    primaryState: row.primaryState as Client["primaryState"],
    nexusStates: row.nexusStates as Client["nexusStates"],
    contactEmail: row.contactEmail ?? "",
    contactPhone: row.contactPhone ?? undefined,
    status: row.status as Client["status"],
    addedAt: row.createdAt.toISOString().slice(0, 10),
    servicePackages: packageMap.get(row.id) ?? [],
    county: row.county ?? undefined,
    relatedClientIds: safeArray<string>((row.metadata as { relatedClientIds?: string[] } | null)?.relatedClientIds),
    noteEntries: notes,
    activity,
    contacts: contactsMap.get(row.id) ?? [],
  } as Client & { contacts: Contact[] };
}

async function buildTimeline(taskId: string): Promise<TimelineEntry[]> {
  const rows = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.taskId, taskId))
    .orderBy(desc(activityEvents.createdAt));
  return rows.map((row) => ({
    id: String(row.id),
    timestamp: row.createdAt.toISOString(),
    type: row.eventType,
    actorName: pickActorName(row.actorKind, row.actorUserId),
    summary: row.description,
    relatedChecklistItemId: row.relatedChecklistItemId,
  }));
}

async function buildTaskInsights(taskId: string): Promise<TaskInsightBlock> {
  const itemRows = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId))
    .orderBy(asc(checklistItems.sortOrder));
  const taskRows = await db
    .select({
      taskId: tasks.id,
      clientId: deadlines.clientId,
      form: deadlines.form,
      entityType: clients.entityType,
    })
    .from(tasks)
    .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
    .innerJoin(clients, eq(deadlines.clientId, clients.id))
    .where(eq(tasks.id, taskId));
  const taskRow = taskRows[0];
  if (!taskRow) {
    return {
      timing: {
        windowLabel: "No timing baseline yet",
        confidence: "low",
        basis: "substrate",
      },
      anomalies: [],
      opportunities: [],
    };
  }
  const facts = await db
    .select()
    .from(importedFacts)
    .where(eq(importedFacts.clientId, taskRow.clientId))
    .orderBy(desc(importedFacts.importedAt));
  const timingFact = facts.find((fact) => fact.factType.includes("arrival_date"));
  const opportunities: string[] = [];
  if (facts.some((fact) => fact.factType === "response_time_days")) {
    opportunities.push("Response timing history is available for reminder tuning.");
  }
  if (taskRow.entityType === "Individual") {
    opportunities.push("Watch for year-end planning or advisory follow-up if income shifts materially.");
  }
  return {
    timing: {
      windowLabel: timingFact
        ? `Expected based on prior receipt pattern (${String((timingFact.value as { date?: string }).date ?? "prior year")})`
        : "Using substrate timing because no per-client arrival history is imported yet",
      confidence: timingFact ? "medium" : "low",
      basis: timingFact ? "personal_history" : "substrate",
    },
    anomalies: itemRows
      .filter((item) => item.aiFlagReason)
      .map((item) => ({
        itemType: item.itemType,
        summary: item.aiFlagReason ?? "",
      })),
    opportunities,
  };
}

function buildDraftSubject(clientName: string, itemLabel: string, form: string) {
  return `${itemLabel} needed for ${clientName} · ${form}`;
}

function buildDraftBody(
  tone: string,
  clientName: string,
  itemLabel: string,
  deadlineDate: string,
  form: string
) {
  const intro =
    tone === "urgent"
      ? "I need one quick item to keep this filing on track."
      : tone === "casual"
      ? "Quick follow-up on one item for your return."
      : tone === "apologetic"
      ? "Sorry for the extra nudge here."
      : "Following up on one item we still need.";
  return [
    `Hi ${clientName},`,
    "",
    intro,
    `Please send ${itemLabel} for ${form} due ${deadlineDate}.`,
    "",
    "Reply to this email and it will attach directly to the task on our side.",
    "",
    "Sarah Mitchell",
    "Mitchell CPA",
  ].join("\n");
}

async function logActivity(params: {
  taskId: string;
  eventType: string;
  actorKind: "user" | "ai" | "system";
  description: string;
  relatedChecklistItemId?: string | null;
  relatedEmailDraftId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const taskRows = await db
    .select({ firmId: tasks.firmId })
    .from(tasks)
    .where(eq(tasks.id, params.taskId));
  const taskRow = taskRows[0];
  if (!taskRow) return;
  await db.insert(activityEvents).values({
    firmId: taskRow.firmId,
    taskId: params.taskId,
    eventType: params.eventType,
    actorKind: params.actorKind,
    actorUserId: params.actorKind === "user" ? DEMO_USER_ID : null,
    description: params.description,
    payload: params.payload ?? {},
    relatedChecklistItemId: params.relatedChecklistItemId ?? null,
    relatedEmailDraftId: params.relatedEmailDraftId ?? null,
    createdAt: new Date(),
  });
}

async function recomputeTask(taskId: string) {
  const itemRows = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId))
    .orderBy(asc(checklistItems.sortOrder));
  const total = itemRows.length || 1;
  const complete = itemRows.filter(
    (item) => item.state === "received_confirmed" || item.state === "not_applicable"
  ).length;
  const percentage = Math.round((complete / total) * 100);
  const nextStatus: DeadlineStatus =
    percentage === 100 ? "completed" : percentage > 0 ? "in_progress" : "not_started";
  await db
    .update(tasks)
    .set({
      completionPercentage: percentage,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
}

async function recordChecklistTransition(
  itemId: string,
  toState: ChecklistState,
  actorKind: "user" | "ai" | "system",
  payload: Record<string, unknown> = {},
  options: {
    aiConfidence?: number | null;
    aiFlagReason?: string | null;
    sourceDocumentUrl?: string | null;
  } = {}
) {
  const itemRows = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.id, itemId));
  const current = itemRows[0];
  if (!current) throw new Error("Checklist item not found");
  await db
    .update(checklistItems)
    .set({
      state: toState,
      stateChangedAt: new Date(),
      stateChangedByKind: actorKind,
      stateChangedByUserId: actorKind === "user" ? DEMO_USER_ID : null,
      aiConfidence:
        options.aiConfidence !== undefined
          ? options.aiConfidence === null
            ? null
            : options.aiConfidence.toString()
          : current.aiConfidence,
      aiFlagReason:
        options.aiFlagReason !== undefined ? options.aiFlagReason : current.aiFlagReason,
      sourceDocumentUrl:
        options.sourceDocumentUrl !== undefined
          ? options.sourceDocumentUrl
          : current.sourceDocumentUrl,
      lastReminderAt:
        toState === "requested_waiting" ? new Date() : current.lastReminderAt,
    })
    .where(eq(checklistItems.id, itemId));
  await db.insert(checklistItemEvents).values({
    firmId: current.firmId,
    checklistItemId: itemId,
    fromState: current.state,
    toState,
    actorKind,
    actorUserId: actorKind === "user" ? DEMO_USER_ID : null,
    payload,
    createdAt: new Date(),
  });
  await logActivity({
    taskId: current.taskId,
    eventType: "checklist_item.state.changed",
    actorKind,
    description: `${current.label} moved to ${toState.replace(/_/g, " ")}`,
    relatedChecklistItemId: current.id,
    payload,
  });
  await recomputeTask(current.taskId);
}

export async function getFirmContext(): Promise<FirmContext> {
  return getFirmRow();
}

export async function listClients(filters: {
  search?: string;
  state?: string[];
  entityType?: string[];
  status?: string[];
  hasDeadlineThisWeek?: boolean;
}) {
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.firmId, DEMO_FIRM_ID))
    .orderBy(asc(clients.name));
  const hydrated = await Promise.all(rows.map((row) => hydrateClient(row)));
  const search = filters.search?.trim().toLowerCase();
  const filtered = hydrated.filter((client) => {
    if (search) {
      const hay = `${client.name} ${client.contactEmail} ${client.primaryState} ${client.entityType}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (filters.state?.length && !filters.state.includes(client.primaryState)) return false;
    if (filters.entityType?.length && !filters.entityType.includes(client.entityType)) return false;
    if (filters.status?.length && !filters.status.includes(client.status)) return false;
    return true;
  });
  if (!filters.hasDeadlineThisWeek) return { items: filtered, nextCursor: undefined };
  const tasksForClient = await taskRowsForClientIds(filtered.map((item) => item.id));
  const clientIds = new Set(
    tasksForClient
      .filter((item) => countdownBucket(item.officialDueDate) === "this_week")
      .map((item) => item.clientId)
  );
  return {
    items: filtered.filter((item) => clientIds.has(item.id)),
    nextCursor: undefined,
  };
}

export async function getClientDetail(clientId: string) {
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.firmId, DEMO_FIRM_ID)));
  const row = rows[0];
  if (!row) return null;
  const client = await hydrateClient(row);
  const taskRows = await taskRowsForClientIds([clientId]);
  const timeline = await taskActivity(taskRows.map((item) => item.taskId));
  const aiInsights = {
    nextWindow:
      taskRows.find((item) => item.status !== "completed")?.officialDueDate ?? null,
    openTasks: taskRows.filter((item) => item.status !== "completed").length,
    importedFactCount: (
      await db
        .select({ value: count() })
        .from(importedFacts)
        .where(eq(importedFacts.clientId, clientId))
    )[0]?.value ?? 0,
  };
  const documents = await buildDocumentsLongitudinal(clientId);
  return {
    client,
    aiInsights,
    tabs: {
      tasks: taskRows.map(convertTaskRowToDeadlineLike),
      documents,
      history: taskRows
        .filter((task) => task.status === "completed")
        .map(convertTaskRowToDeadlineLike),
      notes: client.noteEntries ?? [],
      activity: timeline.slice(0, 50).map((event) => ({
        id: String(event.id),
        timestamp: event.createdAt.toISOString(),
        type: event.eventType,
        actorName: pickActorName(event.actorKind, event.actorUserId),
        summary: event.description,
        relatedDeadlineId: undefined,
      })),
    },
  };
}

function convertTaskRowToDeadlineLike(row: Awaited<ReturnType<typeof taskRowsForClientIds>>[number]): Deadline {
  return {
    id: row.deadlineId,
    clientId: row.clientId,
    taskId: row.taskId,
    form: row.form,
    jurisdiction: row.jurisdiction as Deadline["jurisdiction"],
    officialDueDate: row.officialDueDate,
    status: row.status as Deadline["status"],
    assignedUser: "Sarah Mitchell",
    completedAt:
      (row.completedMeta as { completedAt?: string | null } | null)?.completedAt ?? undefined,
    extensionSubmittedAt:
      (row.completedMeta as { extensionSubmittedAt?: string | null } | null)
        ?.extensionSubmittedAt ?? undefined,
    extensionApprovedAt:
      (row.completedMeta as { extensionApprovedAt?: string | null } | null)
        ?.extensionApprovedAt ?? undefined,
  };
}

async function buildDocumentsLongitudinal(clientId: string) {
  const facts = await db
    .select()
    .from(importedFacts)
    .where(eq(importedFacts.clientId, clientId))
    .orderBy(desc(importedFacts.period));
  return facts.map((fact) => ({
    id: String(fact.id),
    factType: fact.factType,
    period: fact.period,
    value: fact.value,
    importTier: fact.importTier,
  }));
}

export async function createClient(input: {
  name: string;
  entityType: Client["entityType"];
  primaryState: Client["primaryState"];
  nexusStates: Client["nexusStates"];
  contactEmail: string;
  contactPhone?: string;
  county?: string;
  servicePackage?: string;
}) {
  const id = randomUUID();
  const now = new Date();
  await db.insert(clients).values({
    id,
    firmId: DEMO_FIRM_ID,
    name: input.name,
    entityType: input.entityType,
    primaryState: input.primaryState,
    nexusStates: input.nexusStates,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone ?? null,
    status: "active",
    tier: "standard",
    assignedUserId: DEMO_USER_ID,
    industry: "professional_services",
    county: input.county ?? null,
    notes: null,
    metadata: { notes: [] },
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  });
  await db.insert(contacts).values({
    id: randomUUID(),
    firmId: DEMO_FIRM_ID,
    clientId: id,
    name: input.name,
    email: input.contactEmail,
    phone: input.contactPhone ?? null,
    isPrimary: true,
    emailVerified: false,
    emailBouncesConsecutive: 0,
    createdAt: now,
    updatedAt: now,
  });
  if (input.servicePackage) {
    const pkg = await findSystemPackageByName(input.servicePackage);
    if (pkg) {
      await ensureClientServicePackage(id, pkg.id);
    }
  }
  return { id };
}

export async function updateClientRecord(input: {
  id: string;
  patch: Partial<Client>;
}) {
  const nextMetadataRows = await db
    .select({ metadata: clients.metadata })
    .from(clients)
    .where(eq(clients.id, input.id));
  const existingMetadata = (nextMetadataRows[0]?.metadata ?? {}) as Record<string, unknown>;
  await db
    .update(clients)
    .set({
      name: input.patch.name,
      entityType: input.patch.entityType,
      primaryState: input.patch.primaryState,
      nexusStates: input.patch.nexusStates,
      contactEmail: input.patch.contactEmail,
      contactPhone: input.patch.contactPhone,
      metadata: existingMetadata,
      updatedAt: new Date(),
    })
    .where(eq(clients.id, input.id));
  if (input.patch.contactEmail || input.patch.contactPhone || input.patch.name) {
    await db
      .update(contacts)
      .set({
        email: input.patch.contactEmail,
        phone: input.patch.contactPhone,
        name: input.patch.name,
        updatedAt: new Date(),
      })
      .where(and(eq(contacts.clientId, input.id), eq(contacts.isPrimary, true)));
  }
  return { ok: true as const };
}

export async function archiveClientRecord(id: string) {
  await db
    .update(clients)
    .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(clients.id, id));
  return { ok: true as const };
}

export async function addClientNote(input: {
  clientId: string;
  body: string;
  relatedDeadlineId?: string;
}) {
  const rows = await db
    .select({ metadata: clients.metadata })
    .from(clients)
    .where(eq(clients.id, input.clientId));
  const existing = (rows[0]?.metadata ?? {}) as { notes?: ClientNote[] };
  const note: ClientNote = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    body: input.body,
    pinned: false,
    authorName: "Sarah Mitchell",
    relatedDeadlineId: input.relatedDeadlineId,
  };
  await db
    .update(clients)
    .set({
      metadata: {
        ...existing,
        notes: [note, ...safeArray<ClientNote>(existing.notes)],
      },
      updatedAt: new Date(),
    })
    .where(eq(clients.id, input.clientId));
  const taskId = input.relatedDeadlineId
    ? (
        await db
          .select({ taskId: tasks.id })
          .from(tasks)
          .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
          .where(eq(deadlines.id, input.relatedDeadlineId))
      )[0]?.taskId
    : undefined;
  if (taskId) {
    await logActivity({
      taskId,
      eventType: "note_added",
      actorKind: "user",
      description: `Added note: ${input.body.slice(0, 80)}`,
      payload: { noteId: note.id },
    });
  }
  return { id: note.id };
}

export async function toggleClientNotePin(clientId: string, noteId: string) {
  const rows = await db
    .select({ metadata: clients.metadata })
    .from(clients)
    .where(eq(clients.id, clientId));
  const existing = (rows[0]?.metadata ?? {}) as { notes?: ClientNote[] };
  const notes = safeArray<ClientNote>(existing.notes).map((note) =>
    note.id === noteId ? { ...note, pinned: !note.pinned } : note
  );
  await db
    .update(clients)
    .set({ metadata: { ...existing, notes }, updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  return { ok: true as const };
}

export async function deleteClientNote(clientId: string, noteId: string) {
  const rows = await db
    .select({ metadata: clients.metadata })
    .from(clients)
    .where(eq(clients.id, clientId));
  const existing = (rows[0]?.metadata ?? {}) as { notes?: ClientNote[] };
  const notes = safeArray<ClientNote>(existing.notes).filter((note) => note.id !== noteId);
  await db
    .update(clients)
    .set({ metadata: { ...existing, notes }, updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  return { ok: true as const };
}

export async function assignPackageToClient(clientId: string, packageId: string) {
  await ensureClientServicePackage(clientId, packageId);
  return { added: 1 };
}

export async function unassignPackageFromClient(clientId: string, packageId: string) {
  await db
    .delete(clientServicePackages)
    .where(
      and(
        eq(clientServicePackages.clientId, clientId),
        eq(clientServicePackages.packageId, packageId)
      )
    );
  return { removed: 1 };
}

export async function listTriageDeadlines() {
  const rows = await db
    .select({
      id: deadlines.id,
      clientId: deadlines.clientId,
      form: deadlines.form,
      jurisdiction: deadlines.jurisdiction,
      officialDueDate: deadlines.officialDueDate,
      status: deadlines.status,
      metadata: deadlines.metadata,
      taskId: tasks.id,
    })
    .from(deadlines)
    .leftJoin(tasks, eq(tasks.deadlineId, deadlines.id))
    .where(eq(deadlines.firmId, DEMO_FIRM_ID))
    .orderBy(asc(deadlines.officialDueDate));
  const mapped = rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    taskId: row.taskId ?? undefined,
    form: row.form,
    jurisdiction: row.jurisdiction as Deadline["jurisdiction"],
    officialDueDate: row.officialDueDate,
    status: row.status as DeadlineStatus,
    assignedUser: "Sarah Mitchell",
    completedAt: (row.metadata as { completedAt?: string | null } | null)?.completedAt ?? undefined,
    extensionSubmittedAt:
      (row.metadata as { extensionSubmittedAt?: string | null } | null)
        ?.extensionSubmittedAt ?? undefined,
    extensionApprovedAt:
      (row.metadata as { extensionApprovedAt?: string | null } | null)
        ?.extensionApprovedAt ?? undefined,
  })) as Deadline[];
  return {
    overdue: mapped.filter((item) => countdownBucket(item.officialDueDate) === "overdue"),
    thisWeek: mapped.filter((item) => countdownBucket(item.officialDueDate) === "this_week"),
    thisMonth: mapped.filter((item) => countdownBucket(item.officialDueDate) === "this_month"),
    longTerm: mapped.filter((item) => countdownBucket(item.officialDueDate) === "long_term"),
  };
}

export async function listClientDeadlines(clientId: string) {
  const triage = await listTriageDeadlines();
  return [...triage.overdue, ...triage.thisWeek, ...triage.thisMonth, ...triage.longTerm].filter(
    (item) => item.clientId === clientId
  );
}

export async function updateDeadlineStatus(input: {
  id: string;
  status: DeadlineStatus;
}) {
  await db
    .update(deadlines)
    .set({
      status: input.status,
      metadata: sql`coalesce(${deadlines.metadata}, '{}'::jsonb) || ${JSON.stringify(
        input.status === "completed" ? { completedAt: new Date().toISOString().slice(0, 10) } : {}
      )}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(deadlines.id, input.id));
  const taskRows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.deadlineId, input.id));
  if (taskRows[0]) {
    await db.update(tasks).set({ status: input.status, updatedAt: new Date() }).where(eq(tasks.id, taskRows[0].id));
    await logActivity({
      taskId: taskRows[0].id,
      eventType: "status_change",
      actorKind: "user",
      description: `Marked task ${input.status.replace(/_/g, " ")}`,
    });
  }
  return { ok: true as const };
}

export async function deferDeadline(input: { id: string; newDate: string }) {
  await db
    .update(deadlines)
    .set({
      officialDueDate: input.newDate,
      adjustedDueDate: input.newDate,
      status: "deferred",
      updatedAt: new Date(),
    })
    .where(eq(deadlines.id, input.id));
  const taskRows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.deadlineId, input.id));
  if (taskRows[0]) {
    await db.update(tasks).set({ status: "deferred", updatedAt: new Date() }).where(eq(tasks.id, taskRows[0].id));
  }
  return { ok: true as const };
}

export async function fileExtension(deadlineId: string) {
  await db
    .update(deadlines)
    .set({
      status: "filed_extension",
      metadata: sql`coalesce(${deadlines.metadata}, '{}'::jsonb) || ${JSON.stringify({
        extensionSubmittedAt: new Date().toISOString(),
      })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(deadlines.id, deadlineId));
  const taskRows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.deadlineId, deadlineId));
  if (taskRows[0]) {
    await db.update(tasks).set({ status: "filed_extension", updatedAt: new Date() }).where(eq(tasks.id, taskRows[0].id));
  }
  return { id: deadlineId };
}

export async function markExtensionApproved(deadlineId: string) {
  await db
    .update(deadlines)
    .set({
      metadata: sql`coalesce(${deadlines.metadata}, '{}'::jsonb) || ${JSON.stringify({
        extensionApprovedAt: new Date().toISOString(),
      })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(deadlines.id, deadlineId));
  return { ok: true as const };
}

export async function batchAdjustDeadlines(input: {
  clientIds: string[];
  oldDate: string;
  newDate: string;
  announcementTitle?: string;
}) {
  const rows = await db
    .select({ id: deadlines.id, clientId: deadlines.clientId })
    .from(deadlines)
    .where(and(inArray(deadlines.clientId, input.clientIds), eq(deadlines.officialDueDate, input.oldDate)));
  for (const row of rows) {
    await db
      .update(deadlines)
      .set({
        officialDueDate: input.newDate,
        adjustedDueDate: input.newDate,
        updatedAt: new Date(),
      })
      .where(eq(deadlines.id, row.id));
  }
  return { ok: true as const };
}

export async function quickAddDeadline(input: {
  clientId: string;
  form: string;
  jurisdiction: string;
  officialDueDate: string;
}) {
  const id = randomUUID();
  const now = new Date();
  await db.insert(deadlines).values({
    id,
    firmId: DEMO_FIRM_ID,
    clientId: input.clientId,
    serviceTemplateId: null,
    period: input.officialDueDate.slice(0, 4),
    form: input.form,
    jurisdiction: input.jurisdiction,
    officialDueDate: input.officialDueDate,
    adjustedDueDate: input.officialDueDate,
    internalTargetDate: input.officialDueDate,
    clientPrepDate: null,
    fileByDate: input.officialDueDate,
    payByDate: input.officialDueDate,
    status: "not_started",
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });
  const alias = `manual-${formShort(input.form)}-${textHash(id).slice(0, 4)}`;
  const taskId = randomUUID();
  await db.insert(tasks).values({
    id: taskId,
    firmId: DEMO_FIRM_ID,
    deadlineId: id,
    assignedUserId: DEMO_USER_ID,
    forwardingEmailLocalPart: alias,
    forwardingEmailRevokedAt: null,
    completionPercentage: 0,
    status: "not_started",
    createdAt: now,
    updatedAt: now,
  });
  await logActivity({
    taskId,
    eventType: "deadline_added",
    actorKind: "user",
    description: `Added ${input.form}`,
  });
  return { id };
}

export async function listServicePackageRows(): Promise<ServicePackage[]> {
  const rows = await db
    .select()
    .from(servicePackages)
    .orderBy(desc(servicePackages.isSystem), asc(servicePackages.name));
  return rows.map((row) => ({
    id: row.id,
    firmId: row.firmId,
    name: row.name,
    description: row.description,
    applicableEntityTypes: row.applicableEntityTypes as ServicePackage["applicableEntityTypes"],
    applicableStates: (row.applicableStates ?? []) as ServicePackage["applicableStates"],
    isSystem: row.isSystem,
  }));
}

export async function listAnnouncements(opts: { activeOnly?: boolean }) {
  const rows = await db
    .select()
    .from(stateAnnouncements)
    .orderBy(desc(stateAnnouncements.detectedAt));
  const matchRows = await db
    .select()
    .from(affectedClientMatches)
    .where(eq(affectedClientMatches.firmId, DEMO_FIRM_ID));
  const grouped = new Map<string, typeof matchRows>();
  for (const row of matchRows) {
    const list = grouped.get(row.announcementId) ?? [];
    list.push(row);
    grouped.set(row.announcementId, list);
  }
  const notificationsRows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.firmId, DEMO_FIRM_ID), eq(notifications.type, "state_alert")));
  const readIds = new Set(
    notificationsRows
      .filter((item) => !!item.readAt)
      .map((item) => String((item.payload as { announcementId?: string }).announcementId))
  );
  const mapped: Announcement[] = rows.map((row) => {
    const matches = grouped.get(row.id) ?? [];
    return {
      id: row.id,
      stateCode: row.stateCode as Announcement["stateCode"],
      authority: row.authority,
      title: row.title,
      summary: row.rawText,
      publishedDate: row.announcementDate,
      detectedAt: row.detectedAt.toISOString(),
      type: inferAnnouncementType(row.title),
      confidence:
        asNumber(row.confidence) && asNumber(row.confidence)! >= 0.85
          ? "high"
          : asNumber(row.confidence) && asNumber(row.confidence)! >= 0.65
          ? "medium"
          : "low",
      counties: safeArray<string>((row.parsedImpact as { counties?: string[] }).counties),
      entityTypes: safeArray<Client["entityType"]>(
        (row.parsedImpact as { entityTypes?: Client["entityType"][] }).entityTypes
      ),
      taxTypes: safeArray<string>((row.parsedImpact as { taxTypes?: string[] }).taxTypes),
      oldDeadline: (row.parsedImpact as { oldDeadline?: string }).oldDeadline,
      newDeadline: (row.parsedImpact as { newDeadline?: string }).newDeadline,
      sourceUrl: row.sourceUrl,
      affectedClientIds: matches.map((item) => item.clientId),
      read: readIds.has(row.id),
      dismissed: matches.every((item) => item.status === "dismissed"),
    };
  });
  return opts.activeOnly ? mapped.filter((item) => !item.dismissed) : mapped;
}

function inferAnnouncementType(title: string): Announcement["type"] {
  const lower = title.toLowerCase();
  if (lower.includes("disaster") || lower.includes("hurricane")) return "disaster_extension";
  if (lower.includes("penalty")) return "penalty_relief";
  if (lower.includes("pte")) return "pte_change";
  if (lower.includes("nexus")) return "nexus_change";
  if (lower.includes("rate")) return "rate_change";
  return "form_change";
}

export async function getAnnouncementById(id: string) {
  const list = await listAnnouncements({ activeOnly: false });
  return list.find((item) => item.id === id) ?? null;
}

export async function dismissAnnouncement(id: string, reason?: string) {
  await db
    .update(affectedClientMatches)
    .set({ status: "dismissed", dismissedReason: reason ?? null })
    .where(and(eq(affectedClientMatches.announcementId, id), eq(affectedClientMatches.firmId, DEMO_FIRM_ID)));
  return { ok: true as const };
}

export async function markAnnouncementRead(id: string) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.firmId, DEMO_FIRM_ID),
        eq(notifications.type, "state_alert"),
        sql`${notifications.payload}->>'announcementId' = ${id}`
      )
    );
  return { ok: true as const };
}

export async function batchAdjustFromAnnouncement(input: {
  id: string;
  clientIds: string[];
}) {
  const ann = await getAnnouncementById(input.id);
  if (!ann || !ann.oldDeadline || !ann.newDeadline) {
    return { ok: true as const };
  }
  await batchAdjustDeadlines({
    clientIds: input.clientIds,
    oldDate: ann.oldDeadline,
    newDate: ann.newDeadline,
    announcementTitle: ann.title,
  });
  return { ok: true as const };
}

export async function detectAnnouncements() {
  return { count: 0 };
}

export async function listNotificationRows() {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, DEMO_USER_ID))
    .orderBy(desc(notifications.createdAt));
  return rows.map((row) => ({
    id: String(row.id),
    kind: row.type as Notification["kind"],
    createdAt: row.createdAt.toISOString(),
    title: row.title,
    detail: row.body ?? "",
    href: row.deepLink,
    read: !!row.readAt,
    announcementId: (row.payload as { announcementId?: string | null }).announcementId ?? undefined,
    clientId: (row.payload as { clientId?: string | null }).clientId ?? undefined,
  })) as Notification[];
}

export async function markNotificationRead(id: string) {
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, Number(id)));
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, DEMO_USER_ID), isNull(notifications.readAt)));
  return { ok: true as const };
}

export async function listImportHistoryRows(): Promise<ImportRun[]> {
  const rows = await db
    .select()
    .from(importRuns)
    .where(eq(importRuns.firmId, DEMO_FIRM_ID))
    .orderBy(desc(importRuns.createdAt));
  return rows.map((row) => ({
    id: row.id,
    firmId: row.firmId,
    sourceFormat: row.sourceFormat as ImportRun["sourceFormat"],
    originalFilename: row.originalFilename,
    clientsCreated: row.clientsCreated,
    deadlinesCreated: row.deadlinesCreated,
    rowsFailed: row.rowsFailed,
    status: row.status as ImportRun["status"],
    committedAt: row.committedAt?.toISOString() ?? null,
    undoneAt: row.undoneAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function commitImportRows(input: {
  rows: Array<Record<string, unknown>>;
  source?: string;
  skippedCount?: number;
}) {
  const importId = randomUUID();
  const createdIds: string[] = [];
  let deadlinesCreated = 0;
  for (const row of input.rows) {
    const name = String(row.name ?? row.client_name ?? "").trim();
    const entityType = String(row.entityType ?? row.entity_type ?? row.entity ?? "Individual") as Client["entityType"];
    const primaryState = String(row.primaryState ?? row.primary_state ?? row.state ?? "CA") as Client["primaryState"];
    const contactEmail = String(row.contactEmail ?? row.email ?? `${slug(name || "client")}@example.com`);
    if (!name) continue;
    const created = await createClient({
      name,
      entityType,
      primaryState,
      nexusStates: safeArray<StateCode>(row.nexusStates),
      contactEmail,
      contactPhone: row.contactPhone ? String(row.contactPhone) : undefined,
      county: row.county ? String(row.county) : undefined,
      servicePackage: row.servicePackage ? String(row.servicePackage) : undefined,
    });
    createdIds.push(created.id);
    const packageName = row.servicePackage
      ? String(row.servicePackage)
      : entityType === "Individual"
      ? "Individual + PTE"
      : entityType === "Trust"
      ? "Trust Annual"
      : entityType === "S-Corp"
      ? "S-Corp Standard"
      : entityType === "C-Corp"
      ? "C-Corp Standard"
      : entityType === "Partnership"
      ? "Partnership Standard"
      : "Multi-state LLC";
    deadlinesCreated += await generateDefaultDeadlinesForClient(created.id, entityType, primaryState, packageName);
  }
  await db.insert(importRuns).values({
    id: importId,
    firmId: DEMO_FIRM_ID,
    sourceFormat: (input.source ?? "excel") as ImportRun["sourceFormat"],
    originalFilename: input.source ?? "manual-upload.csv",
    clientsCreated: createdIds.length,
    deadlinesCreated,
    rowsFailed: input.skippedCount ?? 0,
    status: "committed",
    committedAt: new Date(),
    undoneAt: null,
    createdAt: new Date(),
  });
  return { importId, ids: createdIds };
}

async function generateDefaultDeadlinesForClient(
  clientId: string,
  entityType: Client["entityType"],
  primaryState: Client["primaryState"],
  packageName: string
) {
  const dueTemplates =
    entityType === "Individual"
      ? [
          ["1040 (federal)", "federal", "2026-10-15"],
          [`${primaryState} individual return`, primaryState, "2026-10-15"],
        ]
      : entityType === "S-Corp"
      ? [
          ["1120-S (federal)", "federal", "2026-09-15"],
          [`${primaryState} S-Corp return`, primaryState, "2026-09-15"],
        ]
      : entityType === "Partnership"
      ? [
          ["1065 (federal)", "federal", "2026-09-15"],
          [`${primaryState} partnership return`, primaryState, "2026-09-15"],
        ]
      : entityType === "Trust"
      ? [
          ["1041 (trust)", "federal", "2026-11-02"],
          [`${primaryState} trust return`, primaryState, "2026-11-15"],
        ]
      : [
          ["Business filing", "federal", "2026-09-15"],
          [`${primaryState} filing`, primaryState, "2026-09-15"],
        ];
  let count = 0;
  for (const [form, jurisdiction, dueDate] of dueTemplates) {
    await quickAddDeadline({
      clientId,
      form,
      jurisdiction,
      officialDueDate: dueDate,
    });
    count += 1;
  }
  const pkg = await findSystemPackageByName(packageName);
  if (pkg) {
    await ensureClientServicePackage(clientId, pkg.id);
  }
  return count;
}

export async function undoImportRun(id: string) {
  const rows = await db.select().from(importRuns).where(eq(importRuns.id, id));
  const row = rows[0];
  if (!row) return { removed: 0 };
  await db.update(importRuns).set({ status: "undone", undoneAt: new Date() }).where(eq(importRuns.id, id));
  return { removed: row.clientsCreated };
}

export async function getTaskDetail(taskId: string): Promise<TaskDetailPayload | null> {
  const taskRows = await db
    .select({
      id: tasks.id,
      deadlineId: tasks.deadlineId,
      assignedUserId: tasks.assignedUserId,
      completionPercentage: tasks.completionPercentage,
      forwardingEmailLocalPart: tasks.forwardingEmailLocalPart,
      taskStatus: tasks.status,
      officialDueDate: deadlines.officialDueDate,
      adjustedDueDate: deadlines.adjustedDueDate,
      internalTargetDate: deadlines.internalTargetDate,
      clientId: deadlines.clientId,
      form: deadlines.form,
      jurisdiction: deadlines.jurisdiction,
      deadlineStatus: deadlines.status,
      metadata: deadlines.metadata,
      clientName: clients.name,
      clientEntityType: clients.entityType,
      clientState: clients.primaryState,
    })
    .from(tasks)
    .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
    .innerJoin(clients, eq(deadlines.clientId, clients.id))
    .where(eq(tasks.id, taskId));
  const row = taskRows[0];
  if (!row) return null;
  const client = await getClientDetail(row.clientId);
  if (!client) return null;
  const itemRows = await db
    .select()
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId))
    .orderBy(asc(checklistItems.sortOrder));
  const timeline = await buildTimeline(taskId);
  const aiInsights = await buildTaskInsights(taskId);
  const deadline: Deadline = {
    id: row.deadlineId,
    clientId: row.clientId,
    taskId: row.id,
    form: row.form,
    jurisdiction: row.jurisdiction as Deadline["jurisdiction"],
    officialDueDate: row.officialDueDate,
    status: row.deadlineStatus as DeadlineStatus,
    assignedUser: "Sarah Mitchell",
    completedAt: (row.metadata as { completedAt?: string | null } | null)?.completedAt ?? undefined,
    extensionSubmittedAt:
      (row.metadata as { extensionSubmittedAt?: string | null } | null)
        ?.extensionSubmittedAt ?? undefined,
    extensionApprovedAt:
      (row.metadata as { extensionApprovedAt?: string | null } | null)
        ?.extensionApprovedAt ?? undefined,
  };
  return {
    task: {
      id: row.id,
      clientId: row.clientId,
      deadlineId: row.deadlineId,
      title: row.form,
      assignedUser: "Sarah Mitchell",
      status: row.taskStatus as DeadlineStatus,
      officialDueDate: row.officialDueDate,
      adjustedDueDate: row.adjustedDueDate,
      internalTargetDate: row.internalTargetDate,
      forwardingEmailAddress: `${row.forwardingEmailLocalPart}@duedatehq.com`,
      completionPercentage: row.completionPercentage,
    },
    deadline,
    checklistItems: itemRows.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      label: item.label,
      itemType: item.itemType,
      description: item.description,
      sortOrder: item.sortOrder,
      state: item.state as ChecklistState,
      stateChangedAt: item.stateChangedAt.toISOString(),
      stateChangedByKind: item.stateChangedByKind as ChecklistItemRecord["stateChangedByKind"],
      stateChangedByUserId: item.stateChangedByUserId,
      aiConfidence: asNumber(item.aiConfidence),
      aiFlagReason: item.aiFlagReason,
      sourceDocumentUrl: item.sourceDocumentUrl,
      lastReminderAt: item.lastReminderAt?.toISOString() ?? null,
    })),
    activityTimelineRecent: timeline.slice(0, 20),
    aiInsights,
    client: client.client,
  };
}

export async function getTaskActivity(taskId: string) {
  return buildTimeline(taskId);
}

export async function markTaskComplete(taskId: string) {
  await db
    .update(tasks)
    .set({
      status: "completed",
      completionPercentage: 100,
      forwardingEmailRevokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));
  await logActivity({
    taskId,
    eventType: "status_change",
    actorKind: "user",
    description: "Marked task complete",
  });
  return { ok: true as const };
}

export async function confirmChecklistItem(id: string) {
  await recordChecklistTransition(id, "received_confirmed", "user", {
    action: "confirm",
  });
  await markInferenceActedOn("checklist_item", id);
  return { ok: true as const };
}

export async function rejectChecklistItem(id: string) {
  await recordChecklistTransition(id, "received_issue", "user", {
    action: "reject",
  });
  await markInferenceActedOn("checklist_item", id);
  return { ok: true as const };
}

export async function markChecklistItemNotApplicable(id: string) {
  await recordChecklistTransition(id, "not_applicable", "user", {
    action: "mark_not_applicable",
  });
  return { ok: true as const };
}

export async function restoreChecklistItem(id: string) {
  await recordChecklistTransition(id, "requested_waiting", "user", {
    action: "restore",
  });
  return { ok: true as const };
}

export async function createChecklistItem(input: {
  taskId: string;
  label: string;
  itemType?: string;
  description?: string;
}) {
  const rows = await db
    .select({ firmId: tasks.firmId })
    .from(tasks)
    .where(eq(tasks.id, input.taskId));
  const maxRows = await db
    .select({ value: sql<number>`coalesce(max(${checklistItems.sortOrder}), -1)` })
    .from(checklistItems)
    .where(eq(checklistItems.taskId, input.taskId));
  const sortOrder = (maxRows[0]?.value ?? -1) + 1;
  const itemId = randomUUID();
  await db.insert(checklistItems).values({
    id: itemId,
    firmId: rows[0]?.firmId ?? DEMO_FIRM_ID,
    taskId: input.taskId,
    label: input.label,
    itemType: input.itemType ?? "custom",
    description: input.description ?? null,
    sortOrder,
    state: "not_requested",
    stateChangedAt: new Date(),
    stateChangedByKind: "user",
    stateChangedByUserId: DEMO_USER_ID,
    aiConfidence: null,
    aiFlagReason: null,
    sourceDocumentUrl: null,
    lastReminderAt: null,
    createdAt: new Date(),
  });
  await recomputeTask(input.taskId);
  return { id: itemId };
}

async function markInferenceActedOn(relatedObjectType: string, relatedObjectId: string) {
  await db
    .update(aiInferences)
    .set({ wasActedOn: true, cpaActionAt: new Date() })
    .where(
      and(
        eq(aiInferences.relatedObjectType, relatedObjectType),
        eq(aiInferences.relatedObjectId, relatedObjectId)
      )
    );
}

async function taskRecipient(taskId: string) {
  const rows = await db
    .select({
      clientEmail: clients.contactEmail,
      clientName: clients.name,
      form: deadlines.form,
      officialDueDate: deadlines.officialDueDate,
    })
    .from(tasks)
    .innerJoin(deadlines, eq(tasks.deadlineId, deadlines.id))
    .innerJoin(clients, eq(deadlines.clientId, clients.id))
    .where(eq(tasks.id, taskId));
  return rows[0] ?? null;
}

export async function createEmailDraft(input: {
  taskId: string;
  checklistItemId?: string;
  tone?: string;
  intent?: string;
}) {
  const task = await taskRecipient(input.taskId);
  if (!task) throw new Error("Task not found");
  const itemRows = input.checklistItemId
    ? await db.select().from(checklistItems).where(eq(checklistItems.id, input.checklistItemId))
    : [];
  const item = itemRows[0] ?? null;
  const tone = input.tone ?? "formal";
  const subject = buildDraftSubject(task.clientName, item?.label ?? "the requested item", task.form);
  const body = buildDraftBody(
    tone,
    task.clientName,
    item?.label ?? "the requested item",
    task.officialDueDate,
    task.form
  );
  const id = randomUUID();
  const aiSources = {
    toneMatch: "firm_default_voice",
    timing: "template cadence + task due date",
    retrieval: item ? ["task_context", "client_profile", "imported_facts"] : ["task_context"],
    intent: input.intent ?? "checklist_follow_up",
  };
  await db.insert(emailDrafts).values({
    id,
    firmId: DEMO_FIRM_ID,
    taskId: input.taskId,
    checklistItemId: input.checklistItemId ?? null,
    templateId: null,
    status: "draft",
    subject,
    body,
    tone,
    aiSources,
    sendMethod: "cpa_send",
    scheduledSendAt: null,
    recallWindowExpiresAt: null,
    sentAt: null,
    sentByUserId: null,
    bounceReason: null,
    createdAt: new Date(),
  });
  await db.insert(aiInferences).values({
    firmId: DEMO_FIRM_ID,
    mode: "D",
    model: "deterministic-dev",
    inputHash: textHash(`${input.taskId}:${input.checklistItemId ?? "none"}:${tone}`),
    output: { subject, body, aiSources },
    confidence: "0.89",
    costCents: "0.0000",
    latencyMs: 14,
    wasActedOn: null,
    cpaActionAt: null,
    relatedObjectType: "email_draft",
    relatedObjectId: id,
    createdAt: new Date(),
  });
  return {
    id,
    taskId: input.taskId,
    checklistItemId: input.checklistItemId ?? null,
    status: "draft",
    subject,
    body,
    tone,
    aiSources,
    to: [task.clientEmail ?? "unknown@example.com"],
    cc: ["sarah@mitchellcpa.com"],
  } satisfies EmailDraftPayload;
}

export async function updateEmailDraft(id: string, patch: { tone?: string; subject?: string; body?: string }) {
  const rows = await db.select().from(emailDrafts).where(eq(emailDrafts.id, id));
  const draft = rows[0];
  if (!draft) throw new Error("Draft not found");
  const task = await taskRecipient(draft.taskId);
  const itemRows = draft.checklistItemId
    ? await db.select().from(checklistItems).where(eq(checklistItems.id, draft.checklistItemId))
    : [];
  const item = itemRows[0] ?? null;
  let subject = patch.subject ?? draft.subject;
  let body = patch.body ?? draft.body;
  if (patch.tone) {
    subject = buildDraftSubject(task?.clientName ?? "Client", item?.label ?? "requested item", task?.form ?? "the filing");
    body = buildDraftBody(
      patch.tone,
      task?.clientName ?? "Client",
      item?.label ?? "the requested item",
      task?.officialDueDate ?? todayIsoDate(),
      task?.form ?? "the filing"
    );
  }
  await db
    .update(emailDrafts)
    .set({
      tone: patch.tone ?? draft.tone,
      subject,
      body,
    })
    .where(eq(emailDrafts.id, id));
  return {
    id,
    taskId: draft.taskId,
    checklistItemId: draft.checklistItemId,
    status: draft.status,
    subject,
    body,
    tone: patch.tone ?? draft.tone,
    aiSources: draft.aiSources as Record<string, unknown>,
    to: [task?.clientEmail ?? "unknown@example.com"],
    cc: ["sarah@mitchellcpa.com"],
  } satisfies EmailDraftPayload;
}

export async function sendEmailDraft(id: string) {
  const rows = await db.select().from(emailDrafts).where(eq(emailDrafts.id, id));
  const draft = rows[0];
  if (!draft) throw new Error("Draft not found");
  await db
    .update(emailDrafts)
    .set({
      status: "sent",
      sentAt: new Date(),
      sentByUserId: DEMO_USER_ID,
      recallWindowExpiresAt: null,
    })
    .where(eq(emailDrafts.id, id));
  if (draft.checklistItemId) {
    await db
      .update(checklistItems)
      .set({ lastReminderAt: new Date() })
      .where(eq(checklistItems.id, draft.checklistItemId));
    await recordChecklistTransition(draft.checklistItemId, "requested_waiting", "system", {
      action: "reminder_sent",
      draftId: id,
    });
  }
  await logActivity({
    taskId: draft.taskId,
    eventType: "reminder_sent",
    actorKind: "user",
    description: `Sent email draft "${draft.subject}"`,
    relatedChecklistItemId: draft.checklistItemId,
    relatedEmailDraftId: id,
    payload: {
      status: "sent",
    },
  });
  await markInferenceActedOn("email_draft", id);
  return { ok: true as const };
}

export async function scheduleEmailDraft(id: string, sendAt: string) {
  await db
    .update(emailDrafts)
    .set({ status: "scheduled", scheduledSendAt: new Date(sendAt) })
    .where(eq(emailDrafts.id, id));
  return { ok: true as const };
}

export async function discardEmailDraft(id: string) {
  await db.update(emailDrafts).set({ status: "discarded" }).where(eq(emailDrafts.id, id));
  return { ok: true as const };
}

export async function recallEmailDraft(id: string) {
  await db
    .update(emailDrafts)
    .set({ status: "recalled", recallWindowExpiresAt: null })
    .where(eq(emailDrafts.id, id));
  return { ok: true as const };
}

export async function listReminderTemplateRows(): Promise<ReminderTemplate[]> {
  const rows = await db
    .select()
    .from(reminderTemplates)
    .orderBy(asc(reminderTemplates.name));
  return rows.map((row) => ({
    id: row.id,
    firmId: row.firmId ?? DEMO_FIRM_ID,
    packageId: row.deadlineClassFilter,
    templateKey: "initial",
    subject: row.subjectTemplate,
    bodyMdx: row.bodyTemplate,
    sendTimeOfDay: "09:00",
    active: row.automationPhase === "phase_1" || row.automationPhase === "phase_2",
  }));
}

export async function updateReminderTemplateRow(input: {
  id: string;
  patch: Partial<ReminderTemplate>;
}) {
  await db
    .update(reminderTemplates)
    .set({
      subjectTemplate: input.patch.subject,
      bodyTemplate: input.patch.bodyMdx,
      automationPhase: input.patch.active === false ? "phase_1" : undefined,
    })
    .where(eq(reminderTemplates.id, input.id));
  return { ok: true as const };
}

export async function listIntegrationRows(): Promise<IntegrationView[]> {
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.firmId, DEMO_FIRM_ID))
    .orderBy(asc(integrationConnections.integrationType));
  return rows.map((row) => ({
    id: row.id,
    type: row.integrationType,
    tier: row.integrationTier,
    status: row.status,
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    error: (row.lastError as Record<string, unknown> | null) ?? null,
  }));
}

export async function availableIntegrations() {
  return [
    { type: "qbo", tier: 0, label: "QuickBooks Online" },
    { type: "xero", tier: 0, label: "Xero" },
    { type: "gmail", tier: 0, label: "Gmail" },
    { type: "outlook", tier: 0, label: "Outlook" },
    { type: "sharepoint", tier: 1, label: "SharePoint" },
    { type: "hubspot", tier: 1, label: "HubSpot" },
    { type: "mailchimp", tier: 1, label: "Mailchimp" },
    { type: "prior_year_pdf", tier: 1, label: "Prior-year PDF" },
  ];
}

export async function connectIntegration(type: string) {
  const rows = await db
    .select()
    .from(integrationConnections)
    .where(and(eq(integrationConnections.firmId, DEMO_FIRM_ID), eq(integrationConnections.integrationType, type)));
  const row = rows[0];
  if (!row) {
    const id = randomUUID();
    await db.insert(integrationConnections).values({
      id,
      firmId: DEMO_FIRM_ID,
      integrationType: type,
      integrationTier: type === "sharepoint" || type === "hubspot" || type === "mailchimp" ? 1 : 0,
      authBlobEncrypted: "configured",
      authBlobKmsKeyId: "dev",
      status: "connected",
      lastSyncAt: new Date(),
      nextSyncAt: null,
      lastError: null,
      metadata: { providerName: type.toUpperCase() },
      createdAt: new Date(),
    });
    return { connectionId: id, redirectUrl: `/settings/integrations?connected=${type}` };
  }
  await db
    .update(integrationConnections)
    .set({ status: "connected", lastSyncAt: new Date(), lastError: null })
    .where(eq(integrationConnections.id, row.id));
  return { connectionId: row.id, redirectUrl: `/settings/integrations?connected=${type}` };
}

export async function syncIntegration(id: string) {
  await db
    .update(integrationConnections)
    .set({ status: "connected", lastSyncAt: new Date(), lastError: null })
    .where(eq(integrationConnections.id, id));
  return { ok: true as const };
}

export async function disconnectIntegration(id: string) {
  await db
    .update(integrationConnections)
    .set({ status: "revoked" })
    .where(eq(integrationConnections.id, id));
  return { ok: true as const };
}

export async function getDashboardPayload() {
  const context = await getFirmContext();
  const triage = await listTriageDeadlines();
  const alertList = await listAnnouncements({ activeOnly: true });
  const activeClients = (await listClients({})).items.filter((item) => item.status === "active")
    .length;
  const allActive = [...triage.overdue, ...triage.thisWeek, ...triage.thisMonth, ...triage.longTerm];
  return {
    stats: {
      activeClients,
      overdue: triage.overdue.length,
      dueThisWeek: triage.thisWeek.length,
      inProgress: allActive.filter((item) => item.status === "in_progress").length,
    },
    alertBanner: alertList[0] ?? null,
    timeGroupedTasks: triage,
    onboardingWidget: {
      title: "Unlock more client intelligence",
      nextSteps: [
        "Connect one prior-year source to unlock timing predictions",
        "Connect Gmail or Outlook to improve reminder drafting",
      ],
    },
    me: context,
  };
}

export async function simulateInboundDocument(input: {
  taskId: string;
  filename?: string;
  subject?: string;
  body?: string;
}) {
  const task = await getTaskDetail(input.taskId);
  if (!task) throw new Error("Task not found");
  const heuristic = `${input.filename ?? ""} ${input.subject ?? ""} ${input.body ?? ""}`.toLowerCase();
  const target =
    task.checklistItems.find((item) => heuristic.includes(item.itemType.replace(/_/g, ""))) ??
    task.checklistItems.find((item) => heuristic.includes(item.label.toLowerCase().split(" ")[0])) ??
    task.checklistItems[0];
  if (!target) throw new Error("No checklist items available for task");
  const eventId = randomUUID();
  await db.insert(devInboundEvents).values({
    id: eventId,
    firmId: DEMO_FIRM_ID,
    taskId: input.taskId,
    checklistItemId: target.id,
    filename: input.filename ?? null,
    subject: input.subject ?? null,
    body: input.body ?? null,
    attachmentUrl: input.filename ? `/temp/${input.filename}` : null,
    processedAt: null,
    createdAt: new Date(),
  });
  const facts = await db
    .select()
    .from(importedFacts)
    .where(
      and(
        eq(importedFacts.clientId, task.client.id),
        eq(importedFacts.factType, target.itemType === "wage_w2" ? "wage_w2_amount" : "1099_any_present")
      )
    );
  const hasFlag = target.itemType === "wage_w2" && facts.length > 0;
  await recordChecklistTransition(
    target.id,
    hasFlag ? "received_issue" : "received_unreviewed",
    "ai",
    {
      action: "inbound_classified",
      filename: input.filename ?? null,
    },
    {
      aiConfidence: 0.9,
      aiFlagReason: hasFlag
        ? "Current amount differs materially from the imported prior-year W-2 baseline."
        : null,
      sourceDocumentUrl: input.filename ? `/temp/${input.filename}` : null,
    }
  );
  await db.insert(aiInferences).values({
    firmId: DEMO_FIRM_ID,
    mode: hasFlag ? "C" : "A",
    model: "deterministic-dev",
    inputHash: textHash(`${input.taskId}:${input.filename ?? ""}:${target.id}`),
    output: {
      classifiedChecklistItemId: target.id,
      flagged: hasFlag,
    },
    confidence: hasFlag ? "0.81" : "0.93",
    costCents: "0.0000",
    latencyMs: 19,
    wasActedOn: null,
    cpaActionAt: null,
    relatedObjectType: "checklist_item",
    relatedObjectId: target.id,
    createdAt: new Date(),
  });
  await db
    .update(devInboundEvents)
    .set({ processedAt: new Date() })
    .where(eq(devInboundEvents.id, eventId));
  return { ok: true as const, checklistItemId: target.id };
}
