import { useSyncExternalStore } from "react";
import type {
  ActivityEntry,
  ActivityType,
  Announcement,
  Client,
  ClientNote,
  Deadline,
  DeadlineStatus,
  EntityType,
  ImportRecord,
  Notification,
  StateCode,
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

interface State {
  clients: Client[];
  deadlines: Deadline[];
  announcements: Announcement[];
  notifications: Notification[];
  imports: ImportRecord[];
}

const STORAGE_KEY = "duedatehq.store.v1";

function seedState(): State {
  return {
    clients: seedClients,
    deadlines: seedDeadlines,
    announcements: seedAnnouncements,
    notifications: extraNotifications,
    imports: [],
  };
}

function hydrate(): State {
  if (typeof window === "undefined") return seedState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as Partial<State>;
    const seeded = seedState();
    return {
      clients: parsed.clients ?? seeded.clients,
      deadlines: parsed.deadlines ?? seeded.deadlines,
      announcements: parsed.announcements ?? seeded.announcements,
      notifications: parsed.notifications ?? seeded.notifications,
      imports: parsed.imports ?? seeded.imports,
    };
  } catch {
    return seedState();
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
    state = { ...state, deadlines: [...state.deadlines, newDeadline] };
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

  dismissAnnouncement(id: string) {
    state = {
      ...state,
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, dismissed: true, read: true } : a
      ),
    };
    emit();
  },

  markAnnouncementRead(id: string) {
    state = {
      ...state,
      announcements: state.announcements.map((a) =>
        a.id === id ? { ...a, read: true } : a
      ),
    };
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
      | "servicePackages"
      | "nexusStates"
      | "noteEntries"
      | "activity"
    > & {
      nexusStates?: Client["nexusStates"];
      servicePackage?: string;
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
      county: client.county,
      industry: client.industry,
      fiscalYearEndMonth: client.fiscalYearEndMonth,
      dateOfIncorporation: client.dateOfIncorporation,
      priorYearStatus: client.priorYearStatus,
      status: "active",
      addedAt: now,
      servicePackages: [packageName],
      noteEntries: [],
      activity: [
        {
          id: makeId("act"),
          timestamp: nowIso(),
          type: "client_created",
          actorName: currentUserName(),
          summary: `Client created with package "${packageName}"`,
        },
      ],
    };
    const generated = generateDeadlinesFromBundle(bundle, {
      clientId: id,
      primaryState: client.primaryState,
      nexusStates,
    }).map((d) => ({ ...d, id: makeId("d") }));

    state = {
      ...state,
      clients: [...state.clients, newClient],
      deadlines: [...state.deadlines, ...generated],
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
        | "servicePackages"
        | "nexusStates"
        | "noteEntries"
        | "activity"
      > & {
        nexusStates?: Client["nexusStates"];
        servicePackage?: string;
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
    state = {
      ...state,
      clients: [...state.clients, ...newClients],
      deadlines: [...state.deadlines, ...generatedDeadlines],
      imports: [importRecord, ...state.imports],
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
        href: `/announcements/${resolved.id}`,
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
