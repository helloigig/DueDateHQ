import { useSyncExternalStore } from "react";
import type {
  ActivityEntry,
  ActivityType,
  AiInsight,
  Announcement,
  ChecklistItem,
  Client,
  ClientNote,
  Deadline,
  DeadlineStatus,
  DocumentState,
  EmailDraft,
  EntityType,
  ImportRecord,
  ImportedFact,
  Notification,
  ReminderTemplate,
  StateCode,
  Task,
  TaskStatus,
} from "../types";
import { clients as seedClients } from "./mockClients";
import { deadlines as seedDeadlines } from "./mockDeadlines";
import { announcements as seedAnnouncements } from "./mockAnnouncements";
import { extraNotifications } from "./mockNotifications";
import { STATE_FEED } from "./mockStateFeed";
import { getSession } from "./session";
import {
  BUNDLES,
  bundleById,
  generateDeadlinesFromBundle,
  suggestBundleForEntity,
} from "./bundles";
import { buildTasksFromDeadlines } from "./mockTasks";
import { buildChecklistsFromTasks } from "./mockChecklistItems";
import { reminderTemplates as seedReminderTemplates } from "./mockReminderTemplates";
import { importedFacts as seedImportedFacts } from "./mockImportedFacts";
import { aiInsights as seedAiInsights } from "./mockAiInsights";
import { emailDrafts as seedEmailDrafts } from "./mockEmailDrafts";

interface State {
  clients: Client[];
  deadlines: Deadline[];
  announcements: Announcement[];
  notifications: Notification[];
  imports: ImportRecord[];
  tasks: Task[];
  checklistItems: ChecklistItem[];
  reminderTemplates: ReminderTemplate[];
  importedFacts: ImportedFact[];
  aiInsights: AiInsight[];
  emailDrafts: EmailDraft[];
}

// v4 bump: hydrate now defaults to EMPTY state (was: full demo seeds). The
// 41-client demo workspace is opt-in via actions.resetToSeeds(), wired to
// the "Try demo workspace" button on Login. This unblocks honest signup
// testing — fresh signup now lands in an empty firm, not Sarah's demo.
// Existing v3 localStorage will be ignored.
const STORAGE_KEY = "duedatehq.store.v4";

function emptyState(): State {
  return {
    clients: [],
    deadlines: [],
    announcements: [],
    notifications: [],
    imports: [],
    tasks: [],
    checklistItems: [],
    // Reminder templates are firm-scoped config, but the 18 PRD §7.6
    // defaults are always present from day 1 — they're substrate, not
    // user data. Keep them in the empty state.
    reminderTemplates: seedReminderTemplates,
    importedFacts: [],
    aiInsights: [],
    emailDrafts: [],
  };
}

function seedState(): State {
  const tasks = buildTasksFromDeadlines(seedDeadlines);
  const checklistItems = buildChecklistsFromTasks(tasks);
  return {
    clients: seedClients,
    deadlines: seedDeadlines,
    announcements: seedAnnouncements,
    notifications: extraNotifications,
    imports: [],
    tasks,
    checklistItems,
    reminderTemplates: seedReminderTemplates,
    importedFacts: seedImportedFacts,
    aiInsights: seedAiInsights,
    emailDrafts: seedEmailDrafts,
  };
}

function hydrate(): State {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<State>;
    const fallback = emptyState();
    return {
      clients: parsed.clients ?? fallback.clients,
      deadlines: parsed.deadlines ?? fallback.deadlines,
      announcements: parsed.announcements ?? fallback.announcements,
      notifications: parsed.notifications ?? fallback.notifications,
      imports: parsed.imports ?? fallback.imports,
      tasks: parsed.tasks ?? fallback.tasks,
      checklistItems: parsed.checklistItems ?? fallback.checklistItems,
      reminderTemplates:
        parsed.reminderTemplates ?? fallback.reminderTemplates,
      importedFacts: parsed.importedFacts ?? fallback.importedFacts,
      aiInsights: parsed.aiInsights ?? fallback.aiInsights,
      emailDrafts: parsed.emailDrafts ?? fallback.emailDrafts,
    };
  } catch {
    return emptyState();
  }
}

function persist(s: State) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* quota/denied — silent */
  }
}

let state: State = hydrate();

function currentUserName(): string {
  return getSession()?.userName ?? "Sarah Chen";
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  persist(state);
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot() {
  return state;
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-hook read access for the mock adapter layer. */
export function getState(): State {
  return state;
}

/** Subscribe to store changes (used by realtime/invalidation plumbing). */
export function subscribeStore(listener: () => void): () => void {
  return subscribe(listener);
}

// ---------- helpers ----------

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function statusLabel(s: DeadlineStatus): string {
  return (
    {
      not_started: "not started",
      in_progress: "in progress",
      completed: "complete",
      deferred: "deferred",
      filed_extension: "filed extension",
      overdue: "overdue",
    } as Record<DeadlineStatus, string>
  )[s];
}

function extensionDateFor(officialDueDateIso: string): string {
  // Most federal extensions = +6 months; use that as a sensible default.
  const d = new Date(officialDueDateIso + "T00:00:00");
  d.setMonth(d.getMonth() + 6);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeAffectedClients(
  a: Announcement,
  clients: Client[]
): string[] {
  const entityFilter =
    a.entityTypes.length > 0 ? new Set(a.entityTypes) : null;
  const countyFilter =
    a.counties.length > 0
      ? new Set(a.counties.map((c) => c.toLowerCase()))
      : null;
  return clients
    .filter((c) => c.status === "active")
    .filter((c) => {
      // State match: primary OR nexus
      if (c.primaryState !== a.stateCode && !c.nexusStates.includes(a.stateCode))
        return false;
      // Entity filter (if the announcement scopes to certain entity types)
      if (entityFilter && !entityFilter.has(c.entityType)) return false;
      // County filter: only apply if client has a county set AND the announcement
      // specifies counties; otherwise be inclusive (we can't rule out a client
      // whose county we don't know).
      if (countyFilter && c.county) {
        if (!countyFilter.has(c.county.toLowerCase())) return false;
      }
      return true;
    })
    .map((c) => c.id);
}

function appendActivity(
  clientId: string,
  type: ActivityType,
  summary: string,
  relatedDeadlineId?: string
) {
  const entry: ActivityEntry = {
    id: makeId("act"),
    timestamp: nowIso(),
    type,
    actorName: currentUserName(),
    summary,
    relatedDeadlineId,
  };
  state = {
    ...state,
    clients: state.clients.map((c) =>
      c.id === clientId
        ? { ...c, activity: [entry, ...(c.activity ?? [])] }
        : c
    ),
  };
}

// ---------- actions ----------

export const actions = {
  setDeadlineStatus(id: string, status: DeadlineStatus) {
    const d = state.deadlines.find((x) => x.id === id);
    if (!d) return;
    state = {
      ...state,
      deadlines: state.deadlines.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              completedAt: status === "completed" ? "2026-04-23" : x.completedAt,
            }
          : x
      ),
    };
    appendActivity(
      d.clientId,
      "status_change",
      `Marked ${d.form} ${statusLabel(status)}`,
      id
    );
    emit();
  },

  deferDeadline(id: string, newDateIso: string) {
    const d = state.deadlines.find((x) => x.id === id);
    if (!d) return;
    state = {
      ...state,
      deadlines: state.deadlines.map((x) =>
        x.id === id
          ? { ...x, status: "deferred", officialDueDate: newDateIso }
          : x
      ),
    };
    appendActivity(
      d.clientId,
      "status_change",
      `Deferred ${d.form} to ${newDateIso}`,
      id
    );
    emit();
  },

  fileExtension(id: string) {
    const d = state.deadlines.find((x) => x.id === id);
    if (!d) return;
    const extDate = extensionDateFor(d.officialDueDate);
    const newId = makeId("d");
    const now = nowIso();
    const ext: Deadline = {
      id: newId,
      clientId: d.clientId,
      form: `${d.form.replace(/\s*\(extension\)$/i, "")} (extension)`,
      jurisdiction: d.jurisdiction,
      officialDueDate: extDate,
      status: "not_started",
      assignedUser: d.assignedUser,
      extensionOfDeadlineId: id,
    };
    state = {
      ...state,
      deadlines: [
        ...state.deadlines.map((x) =>
          x.id === id
            ? {
                ...x,
                status: "filed_extension" as const,
                extensionSubmittedAt: now,
                linkedExtensionDeadlineId: newId,
              }
            : x
        ),
        ext,
      ],
    };
    appendActivity(
      d.clientId,
      "extension_filed",
      `Filed extension for ${d.form}; new deadline ${extDate} (awaiting approval)`,
      id
    );
    emit();
  },

  markExtensionApproved(id: string) {
    const d = state.deadlines.find((x) => x.id === id);
    if (!d || d.status !== "filed_extension") return;
    state = {
      ...state,
      deadlines: state.deadlines.map((x) =>
        x.id === id ? { ...x, extensionApprovedAt: nowIso() } : x
      ),
    };
    appendActivity(
      d.clientId,
      "extension_filed",
      `Extension approved for ${d.form}`,
      id
    );
    emit();
  },

  addDeadline(
    clientId: string,
    form: string,
    jurisdiction: Deadline["jurisdiction"],
    officialDueDate: string
  ) {
    const id = makeId("d");
    const newDeadline: Deadline = {
      id,
      clientId,
      form,
      jurisdiction,
      officialDueDate,
      status: "not_started",
    };
    const tasks = buildTasksFromDeadlines([newDeadline]);
    const checklists = buildChecklistsFromTasks(tasks);
    state = {
      ...state,
      deadlines: [...state.deadlines, newDeadline],
      tasks: [...state.tasks, ...tasks],
      checklistItems: [...state.checklistItems, ...checklists],
    };
    appendActivity(
      clientId,
      "deadline_added",
      `Added ${form} · due ${officialDueDate}`,
      id
    );
    emit();
    return id;
  },

  addNote(clientId: string, body: string, relatedDeadlineId?: string) {
    const note: ClientNote = {
      id: makeId("n"),
      createdAt: nowIso(),
      body,
      pinned: false,
      authorName: currentUserName(),
      relatedDeadlineId,
    };
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId
          ? { ...c, noteEntries: [note, ...(c.noteEntries ?? [])] }
          : c
      ),
    };
    appendActivity(clientId, "note_added", `Added note`, relatedDeadlineId);
    emit();
    return note.id;
  },

  toggleNotePin(clientId: string, noteId: string) {
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              noteEntries: (c.noteEntries ?? []).map((n) =>
                n.id === noteId ? { ...n, pinned: !n.pinned } : n
              ),
            }
          : c
      ),
    };
    emit();
  },

  deleteNote(clientId: string, noteId: string) {
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              noteEntries: (c.noteEntries ?? []).filter(
                (n) => n.id !== noteId
              ),
            }
          : c
      ),
    };
    emit();
  },

  archiveClient(clientId: string) {
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId ? { ...c, status: "archived" as const } : c
      ),
    };
    appendActivity(clientId, "client_archived", `Client archived`);
    emit();
  },

  updateClient(
    clientId: string,
    patch: {
      name?: string;
      entityType?: EntityType;
      primaryState?: StateCode;
      nexusStates?: StateCode[];
      contactEmail?: string;
      contactPhone?: string;
    }
  ) {
    const before = state.clients.find((c) => c.id === clientId);
    if (!before) return;
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId ? { ...c, ...patch } : c
      ),
    };
    const changed = Object.keys(patch).filter(
      (k) => (patch as never)[k] !== undefined
    );
    appendActivity(
      clientId,
      "client_edited",
      `Updated ${changed.join(", ")}`
    );
    emit();
  },

  dismissAnnouncement(id: string, reason?: string) {
    state = {
      ...state,
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, dismissed: true, read: true } : a
      ),
    };
    if (reason) {
      console.info("[alerts] dismiss reason logged", { id, reason });
    }
    emit();
  },

  markAnnouncementRead(id: string) {
    const ann = state.announcements.find((a) => a.id === id);
    const wasUnread = ann && !ann.read;
    state = {
      ...state,
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, read: true } : a
      ),
    };
    // Audit-trail integration: when the CPA opens an alert that affects
    // their clients, log it on each affected client's activity timeline.
    // Liability follows the paper trail (the graduated must-read model).
    if (wasUnread && ann && ann.affectedClientIds.length > 0) {
      for (const clientId of ann.affectedClientIds) {
        appendActivity(
          clientId,
          "ai_inferred",
          `📖 ${currentUserName()} reviewed state alert: ${ann.stateCode}: ${ann.title}`
        );
      }
    }
    emit();
  },

  markNotificationRead(id: string) {
    state = {
      ...state,
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    };
    emit();
  },

  markAllNotificationsRead() {
    state = {
      ...state,
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      announcements: state.announcements.map((a) => ({ ...a, read: true })),
    };
    emit();
  },

  batchAdjustDeadlines(
    clientIds: string[],
    oldIso: string,
    newIso: string,
    announcementTitle?: string
  ) {
    // Walk per-client so we can log an activity entry on each.
    for (const cid of clientIds) {
      const touched = state.deadlines.filter(
        (d) => d.clientId === cid && d.officialDueDate === oldIso
      );
      if (touched.length === 0) continue;
      state = {
        ...state,
        deadlines: state.deadlines.map((d) =>
          d.clientId === cid && d.officialDueDate === oldIso
            ? { ...d, officialDueDate: newIso }
            : d
        ),
      };
      const note = announcementTitle
        ? ` (from ${announcementTitle})`
        : "";
      appendActivity(
        cid,
        "batch_adjust",
        `Moved ${touched.length} deadline${
          touched.length === 1 ? "" : "s"
        } from ${oldIso} → ${newIso}${note}`
      );
    }
    emit();
  },

  addClient(
    client: Omit<
      Client,
      | "id"
      | "addedAt"
      | "status"
      | "tier"
      | "servicePackages"
      | "nexusStates"
      | "noteEntries"
      | "activity"
    > & {
      nexusStates?: Client["nexusStates"];
      servicePackage?: string;
      tier?: Client["tier"];
    }
  ) {
    const id = makeId("c-new");
    const now = new Date().toISOString().slice(0, 10);
    const nexusStates = client.nexusStates ?? [];
    const bundle =
      (client.servicePackage && BUNDLES.find((b) => b.name === client.servicePackage)) ||
      suggestBundleForEntity(client.entityType);
    const packageName = client.servicePackage ?? bundle.name;

    const newClient: Client = {
      id,
      name: client.name,
      entityType: client.entityType,
      primaryState: client.primaryState,
      nexusStates,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      status: "active",
      tier: client.tier ?? "standard",
      addedAt: now,
      servicePackages: [packageName],
      noteEntries: [],
      activity: [
        {
          id: makeId("act"),
          timestamp: nowIso(),
          type: "client_created",
          actorName: currentUserName(),
          summary: `Client created with bundle "${packageName}"`,
        },
      ],
    };
    const generated = generateDeadlinesFromBundle(bundle, {
      clientId: id,
      primaryState: client.primaryState,
      nexusStates,
    }).map((d) => ({ ...d, id: makeId("d") }));
    const newTasks = buildTasksFromDeadlines(generated);
    const newChecklists = buildChecklistsFromTasks(newTasks);

    state = {
      ...state,
      clients: [...state.clients, newClient],
      deadlines: [...state.deadlines, ...generated],
      tasks: [...state.tasks, ...newTasks],
      checklistItems: [...state.checklistItems, ...newChecklists],
    };
    emit();
    return id;
  },

  addClientsBulk(
    clients: Array<
      Omit<
        Client,
        | "id"
        | "addedAt"
        | "status"
        | "tier"
        | "servicePackages"
        | "nexusStates"
        | "noteEntries"
        | "activity"
      > & {
        nexusStates?: Client["nexusStates"];
        servicePackage?: string;
        tier?: Client["tier"];
      }
    >,
    meta?: { source?: string; skippedCount?: number }
  ) {
    const ids: string[] = [];
    const now = new Date().toISOString().slice(0, 10);
    const generatedDeadlines: Deadline[] = [];
    const newClients: Client[] = clients.map((c, i) => {
      const id = `c-imp-${Date.now().toString(36)}-${i}`;
      ids.push(id);
      const nexusStates = c.nexusStates ?? [];
      const bundle =
        (c.servicePackage && BUNDLES.find((b) => b.name === c.servicePackage)) ||
        suggestBundleForEntity(c.entityType);
      const packageName = c.servicePackage ?? bundle.name;
      for (const d of generateDeadlinesFromBundle(bundle, {
        clientId: id,
        primaryState: c.primaryState,
        nexusStates,
      })) {
        generatedDeadlines.push({ ...d, id: makeId("d") });
      }
      return {
        id,
        name: c.name,
        entityType: c.entityType,
        primaryState: c.primaryState,
        nexusStates,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        status: "active" as const,
        tier: c.tier ?? "standard",
        addedAt: now,
        servicePackages: [packageName],
        noteEntries: [],
        activity: [
          {
            id: makeId("act"),
            timestamp: nowIso(),
            type: "client_created",
            actorName: currentUserName(),
            summary: `Client imported from CSV · bundle "${packageName}"`,
          },
        ],
      };
    });
    const importRecord: ImportRecord = {
      id: makeId("imp"),
      importedAt: nowIso(),
      source: meta?.source ?? "CSV",
      clientIds: ids,
      deadlineCount: ids.length * 12,
      skippedCount: meta?.skippedCount ?? 0,
      undone: false,
    };
    const bulkTasks = buildTasksFromDeadlines(generatedDeadlines);
    const bulkChecklists = buildChecklistsFromTasks(bulkTasks);
    state = {
      ...state,
      clients: [...state.clients, ...newClients],
      deadlines: [...state.deadlines, ...generatedDeadlines],
      imports: [importRecord, ...state.imports],
      tasks: [...state.tasks, ...bulkTasks],
      checklistItems: [...state.checklistItems, ...bulkChecklists],
    };
    // Record real generated count for the import record
    importRecord.deadlineCount = generatedDeadlines.length;
    emit();
    return { ids, importId: importRecord.id };
  },

  undoImport(importId: string) {
    const record = state.imports.find((r) => r.id === importId);
    if (!record || record.undone) return 0;
    const removedClientIds = new Set(record.clientIds);
    const removedCount = state.clients.filter((c) =>
      removedClientIds.has(c.id)
    ).length;
    state = {
      ...state,
      clients: state.clients.filter((c) => !removedClientIds.has(c.id)),
      deadlines: state.deadlines.filter((d) => !removedClientIds.has(d.clientId)),
      imports: state.imports.map((r) =>
        r.id === importId ? { ...r, undone: true } : r
      ),
    };
    emit();
    return removedCount;
  },

  resetToSeeds() {
    state = seedState();
    emit();
  },

  assignBundle(clientId: string, bundleId: string) {
    const client = state.clients.find((c) => c.id === clientId);
    const bundle = bundleById(bundleId);
    if (!client || !bundle) return 0;
    // Avoid double-assigning
    if (client.servicePackages.includes(bundle.name)) return 0;
    const generated = generateDeadlinesFromBundle(bundle, {
      clientId,
      primaryState: client.primaryState,
      nexusStates: client.nexusStates,
    }).map((d) => ({ ...d, id: makeId("d") }));
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId
          ? { ...c, servicePackages: [...c.servicePackages, bundle.name] }
          : c
      ),
      deadlines: [...state.deadlines, ...generated],
    };
    appendActivity(
      clientId,
      "bundle_assigned",
      `Assigned bundle "${bundle.name}" · ${generated.length} deadline${
        generated.length === 1 ? "" : "s"
      } generated`
    );
    emit();
    return generated.length;
  },

  /**
   * Simulates the state-authority scraper. Compares the mock feed against
   * known announcements; surfaces any new ones with affected clients computed.
   * Returns the count of newly surfaced announcements.
   */
  detectNewAnnouncements(): number {
    const known = new Set(state.announcements.map((a) => a.id));
    const newOnes: Announcement[] = [];
    const newNotifs: Notification[] = [];

    for (const incoming of STATE_FEED) {
      if (known.has(incoming.id)) continue;
      const affectedClientIds = computeAffectedClients(
        incoming,
        state.clients
      );
      if (affectedClientIds.length === 0) continue;
      const resolved: Announcement = {
        ...incoming,
        affectedClientIds,
      };
      newOnes.push(resolved);
      newNotifs.push({
        id: makeId("notif"),
        kind: "alert",
        createdAt: nowIso(),
        title: `${resolved.stateCode}: ${resolved.title}`,
        detail: `${affectedClientIds.length} client${
          affectedClientIds.length === 1 ? "" : "s"
        } affected · ${resolved.authority}`,
        href: `/alerts/${resolved.id}`,
        read: false,
        announcementId: resolved.id,
      });
    }

    if (newOnes.length === 0) return 0;
    state = {
      ...state,
      announcements: [...newOnes, ...state.announcements],
      notifications: [...newNotifs, ...state.notifications],
    };
    emit();
    return newOnes.length;
  },

  // -------- Layer 2-4 actions (Task / ChecklistItem / Email / AI insights) --------

  /** Update a Task's status. Mirrored to the underlying Deadline. */
  updateTaskStatus(taskId: string, status: TaskStatus) {
    const t = state.tasks.find((x) => x.id === taskId);
    if (!t) return;
    state = {
      ...state,
      tasks: state.tasks.map((x) =>
        x.id === taskId
          ? {
              ...x,
              status,
              completedAt: status === "completed" ? nowIso() : x.completedAt,
              completedBy:
                status === "completed" ? currentUserName() : x.completedBy,
            }
          : x
      ),
      deadlines: state.deadlines.map((d) =>
        d.id === t.deadlineId ? { ...d, status: status as DeadlineStatus } : d
      ),
    };
    appendActivity(
      t.clientId,
      "status_change",
      `Task ${t.formType}: ${statusLabel(status as DeadlineStatus)}`,
      t.deadlineId
    );
    emit();
  },

  /** Set a checklist item's state. Enforces PRD §5.3: only "cpa" actor may
   *  promote to `received_confirmed`. AI/system writes silently fail. */
  setChecklistItemState(
    itemId: string,
    next: DocumentState,
    actor: "cpa" | "ai" | "system" = "cpa"
  ) {
    const item = state.checklistItems.find((c) => c.id === itemId);
    if (!item) return;
    if (next === "received_confirmed" && actor !== "cpa") {
      // PRD §5.3 invariant: AI never auto-promotes to received_confirmed.
      console.warn(
        "[ddhq] §5.3 invariant: rejected non-CPA promotion to received_confirmed",
        { itemId, actor }
      );
      return;
    }
    const task = state.tasks.find((t) => t.id === item.taskId);
    state = {
      ...state,
      checklistItems: state.checklistItems.map((c) =>
        c.id === itemId
          ? {
              ...c,
              state: next,
              confirmedAt:
                next === "received_confirmed" ? nowIso() : c.confirmedAt,
              confirmedBy:
                next === "received_confirmed" ? currentUserName() : c.confirmedBy,
              receivedAt:
                next.startsWith("received_") && !c.receivedAt
                  ? nowIso()
                  : c.receivedAt,
              flagReason: next === "received_issue" ? c.flagReason : undefined,
            }
          : c
      ),
    };
    if (task) {
      const summary =
        next === "received_confirmed"
          ? `Confirmed ${item.label}`
          : next === "received_issue"
          ? `Flagged ${item.label}`
          : next === "requested_waiting"
          ? `Sent reminder for ${item.label}`
          : next === "received_unreviewed"
          ? `Received ${item.label}`
          : next === "not_applicable"
          ? `Marked ${item.label} not applicable`
          : `Reset ${item.label}`;
      appendActivity(
        task.clientId,
        next === "received_confirmed"
          ? "document_confirmed"
          : next === "received_issue"
          ? "document_flagged"
          : next === "received_unreviewed"
          ? "document_received"
          : "checklist_state_change",
        summary,
        task.deadlineId
      );
    }
    emit();
  },

  /** Simulate an inbound document arriving via Method A forwarding (PRD §5.7
   *  Stage 3-4). AI classifies (Mode A) and runs anomaly check (Mode C).
   *  State moves to `received_unreviewed` (or `received_issue` for severe
   *  anomalies). Activity timeline records the inbound + AI inferences. */
  receiveDocument(
    itemId: string,
    payload: {
      filename: string;
      aiClassification: string;
      aiConfidence: "high" | "medium" | "low";
      flagReason?: string;
      flagSeverity?: "low" | "medium" | "high";
    }
  ) {
    const item = state.checklistItems.find((c) => c.id === itemId);
    if (!item) return;
    const task = state.tasks.find((t) => t.id === item.taskId);
    const next =
      payload.flagSeverity === "high" ? "received_issue" : "received_unreviewed";
    state = {
      ...state,
      checklistItems: state.checklistItems.map((c) =>
        c.id === itemId
          ? {
              ...c,
              state: next,
              receivedAt: nowIso(),
              receivedFilename: payload.filename,
              aiClassification: payload.aiClassification,
              aiConfidence: payload.aiConfidence,
              flagReason: payload.flagReason,
              flagSeverity: payload.flagSeverity,
            }
          : c
      ),
    };
    if (task) {
      appendActivity(
        task.clientId,
        "document_received",
        `📄 Received: ${payload.filename} — AI classified as ${payload.aiClassification} (${payload.aiConfidence})`,
        task.deadlineId
      );
      if (payload.flagReason) {
        appendActivity(
          task.clientId,
          "document_flagged",
          `⚠️ Mode C flag: ${payload.flagReason}`,
          task.deadlineId
        );
      }
    }
    emit();
  },

  /** Append a custom checklist item to a Task. */
  addChecklistItem(taskId: string, label: string, itemType: string) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const order =
      Math.max(
        0,
        ...state.checklistItems
          .filter((c) => c.taskId === taskId)
          .map((c) => c.order)
      ) + 1;
    const newItem: ChecklistItem = {
      id: makeId("ci"),
      taskId,
      label,
      itemType,
      state: "not_requested",
      order,
      custom: true,
    };
    state = {
      ...state,
      checklistItems: [...state.checklistItems, newItem],
    };
    appendActivity(
      task.clientId,
      "checklist_state_change",
      `Added custom item: ${label}`,
      task.deadlineId
    );
    emit();
    return newItem.id;
  },

  /** Persist an email draft (status="draft"). */
  saveEmailDraft(d: Omit<EmailDraft, "id" | "createdAt" | "status"> & {
    id?: string;
    status?: EmailDraft["status"];
  }) {
    const id = d.id ?? makeId("ed");
    const draft: EmailDraft = {
      ...d,
      id,
      createdAt: nowIso(),
      status: d.status ?? "draft",
    };
    state = {
      ...state,
      emailDrafts: [draft, ...state.emailDrafts.filter((x) => x.id !== id)],
    };
    emit();
    return id;
  },

  /** Mark a draft sent. Appends an activity entry on the linked client. */
  sendEmail(draftId: string) {
    const draft = state.emailDrafts.find((d) => d.id === draftId);
    if (!draft) return;
    state = {
      ...state,
      emailDrafts: state.emailDrafts.map((d) =>
        d.id === draftId
          ? { ...d, status: "sent" as const, sentAt: nowIso() }
          : d
      ),
    };
    const task = state.tasks.find((t) => t.id === draft.taskId);
    if (task) {
      // If this email was tied to a checklist item, flip that item to
      // requested_waiting (Mode D send → state transition).
      if (draft.checklistItemId) {
        state = {
          ...state,
          checklistItems: state.checklistItems.map((c) =>
            c.id === draft.checklistItemId
              ? {
                  ...c,
                  state:
                    c.state === "not_requested" ? "requested_waiting" : c.state,
                  lastReminderAt: nowIso(),
                }
              : c
          ),
        };
      }
      appendActivity(
        task.clientId,
        "email_sent",
        `Sent: ${draft.subject}`,
        task.deadlineId
      );
    }
    emit();
  },

  /** Quick-chase a checklist item: bypass the email composer and just
   *  record the chase. Used by the "Quick chase" affordance in the task
   *  row's AskClientMenu — the CPA trusts the template, so we skip the
   *  draft+edit step and go straight to "send" semantics: state transitions
   *  to requested_waiting (if not already), lastReminderAt = now, next
   *  cadence + 7 days, and an activity event records the action.
   *
   *  Real BE will dispatch an actual email via the firm's reminder
   *  template; in mock mode this is the implied template send. */
  quickChase(itemId: string, cadenceDays = 7) {
    const item = state.checklistItems.find((c) => c.id === itemId);
    if (!item) return;
    const now = nowIso();
    const next = new Date(Date.now() + cadenceDays * 24 * 60 * 60 * 1000)
      .toISOString();
    state = {
      ...state,
      checklistItems: state.checklistItems.map((c) =>
        c.id === itemId
          ? {
              ...c,
              state:
                c.state === "not_requested" ? "requested_waiting" : c.state,
              lastReminderAt: now,
              nextReminderAt: next,
            }
          : c,
      ),
    };
    const task = state.tasks.find((t) => t.id === item.taskId);
    if (task) {
      appendActivity(
        task.clientId,
        "email_sent",
        `Quick chase: ${item.label}`,
        task.deadlineId,
      );
    }
    emit();
  },

  /** Discard an unsent draft. */
  discardEmailDraft(draftId: string) {
    state = {
      ...state,
      emailDrafts: state.emailDrafts.map((d) =>
        d.id === draftId ? { ...d, status: "discarded" as const } : d
      ),
    };
    emit();
  },

  /** Resolve a Mode E AI insight. */
  resolveInsight(
    insightId: string,
    action: "ask_client" | "schedule_advisory" | "mark_known" | "snooze"
  ) {
    const insight = state.aiInsights.find((i) => i.id === insightId);
    if (!insight) return;
    const next =
      action === "snooze" ? ("snoozed" as const) : ("resolved" as const);
    state = {
      ...state,
      aiInsights: state.aiInsights.map((i) =>
        i.id === insightId ? { ...i, status: next } : i
      ),
    };
    appendActivity(
      insight.clientId,
      "ai_inferred",
      `Mode E insight: ${action.replace(/_/g, " ")} — "${insight.title}"`
    );
    emit();
  },

  /** Update a reminder template (custom only — system templates can be
   *  cloned, never directly edited). Wireframe simplification: we let
   *  edits proceed and just log the change. */
  updateReminderTemplate(id: string, patch: Partial<ReminderTemplate>) {
    state = {
      ...state,
      reminderTemplates: state.reminderTemplates.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
    };
    emit();
  },

  unassignBundle(clientId: string, bundleId: string) {
    const client = state.clients.find((c) => c.id === clientId);
    const bundle = bundleById(bundleId);
    if (!client || !bundle) return 0;
    if (!client.servicePackages.includes(bundle.name)) return 0;
    // Remove pending (not-started) deadlines tied to this bundle.
    const toRemove = state.deadlines.filter(
      (d) =>
        d.clientId === clientId &&
        d.bundleId === bundle.id &&
        d.status === "not_started"
    );
    const toRemoveIds = new Set(toRemove.map((d) => d.id));
    state = {
      ...state,
      clients: state.clients.map((c) =>
        c.id === clientId
          ? {
              ...c,
              servicePackages: c.servicePackages.filter(
                (p) => p !== bundle.name
              ),
            }
          : c
      ),
      deadlines: state.deadlines.filter((d) => !toRemoveIds.has(d.id)),
    };
    appendActivity(
      clientId,
      "bundle_assigned",
      `Removed bundle "${bundle.name}" · ${toRemove.length} pending deadline${
        toRemove.length === 1 ? "" : "s"
      } deleted`
    );
    emit();
    return toRemove.length;
  },
};
