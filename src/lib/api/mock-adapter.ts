/**
 * Mock implementation of every tRPC procedure. Reads from `src/data/store.ts`.
 * Each method returns a Promise with a realistic 100-300ms delay so that UI
 * loading states are exercised during development.
 *
 * When the backend ships, this file goes away — or stays in place, guarded by
 * `env.useMockApi`, for offline-demo / Storybook use.
 */
import { actions, getState } from "../../data/store";
import {
  bucketOf,
  TODAY,
  toIso,
  addDays,
} from "../../data/dateHelpers";
import { BUNDLES, bundleById } from "../../data/bundles";
import { getSession } from "../../data/session";
import type {
  Client,
  Deadline,
  Firm,
  FirmTier,
  ImportRun,
  Notification,
  ServicePackage,
  User,
} from "../../types";

const delay = (ms = 150) =>
  new Promise((r) => setTimeout(r, ms + Math.random() * 100));

function sessionOrDefault() {
  const s = getSession();
  return {
    firmId: "firm-mock",
    firmName: s?.firmName ?? "Mitchell CPA",
    userId: "user-mock",
    userName: s?.userName ?? "Sarah Mitchell",
    userEmail: s?.userEmail ?? "sarah@mitchellcpa.com",
    tier: (s?.tier ?? "solo") as FirmTier,
  };
}

function currentUser(): User {
  const s = sessionOrDefault();
  return {
    id: s.userId,
    email: s.userEmail,
    displayName: s.userName,
    role: "owner",
    timezone: "America/Los_Angeles",
    lastActiveAt: new Date().toISOString(),
  };
}

function currentFirm(): Firm {
  const s = sessionOrDefault();
  return {
    id: s.firmId,
    name: s.firmName,
    primaryStates: ["CA"],
    logoStorageKey: null,
    branding: null,
    tier: s.tier,
    subscriptionStatus: "active",
    trialEndsAt: null,
    seatLimit: s.tier === "team" ? 5 : s.tier === "pro" ? 1 : 1,
    clientLimit: s.tier === "solo" ? 80 : null,
  };
}

function bundleToServicePackage(bundleId: string): ServicePackage | null {
  const b = bundleById(bundleId);
  if (!b) return null;
  return {
    id: b.id,
    firmId: null,
    name: b.name,
    description: b.description,
    applicableEntityTypes: b.entityTypes,
    applicableStates: [],
    isSystem: true,
  };
}

export const mockAdapter = {
  auth: {
    session: async () => {
      await delay();
      if (!getSession()) return null;
      return {
        user: currentUser(),
        firm: currentFirm(),
        tier: sessionOrDefault().tier,
      };
    },
    login: async (input: { email: string; password: string }) => {
      await delay(400);
      // Mock accepts anything; real backend validates.
      if (!input.email.includes("@")) throw new Error("Invalid email");
      return { ok: true as const };
    },
    signup: async (input: {
      email: string;
      password: string;
      firmName: string;
      userName: string;
    }) => {
      await delay(500);
      if (input.password.length < 8)
        throw new Error("Password must be 8+ characters");
      return { ok: true as const };
    },
    logout: async () => {
      await delay();
      return { ok: true as const };
    },
    acceptInvite: async () => {
      await delay(400);
      return { ok: true as const };
    },
    forgotPassword: async () => {
      await delay(300);
      return { ok: true as const };
    },
    resetPassword: async () => {
      await delay(400);
      return { ok: true as const };
    },
  },

  clients: {
    list: async (input: {
      search?: string;
      state?: string[];
      entityType?: string[];
      status?: string[];
      tier?: string[];
      servicePackage?: string[];
      hasDeadlineThisWeek?: boolean;
    } = {}) => {
      await delay();
      const { clients, deadlines } = getState();
      const q = (input.search ?? "").trim().toLowerCase();
      const stateSet = input.state ? new Set(input.state) : null;
      const entitySet = input.entityType ? new Set(input.entityType) : null;
      const statusSet = input.status ? new Set(input.status) : null;
      const tierSet = input.tier ? new Set(input.tier) : null;
      const packageSet = input.servicePackage ? new Set(input.servicePackage) : null;

      const weekEnd = toIso(addDays(TODAY, 7));
      const hasThisWeek = (cid: string) =>
        deadlines.some(
          (d) =>
            d.clientId === cid &&
            d.officialDueDate >= toIso(TODAY) &&
            d.officialDueDate < weekEnd &&
            d.status !== "completed" &&
            d.status !== "filed_extension"
        );

      const items: Client[] = clients.filter((c) => {
        if (q) {
          const hay = `${c.name} ${c.contactEmail} ${c.primaryState} ${c.entityType}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        // State filter matches primary OR any nexus state.
        if (stateSet) {
          const matches = stateSet.has(c.primaryState) || c.nexusStates.some((s) => stateSet.has(s));
          if (!matches) return false;
        }
        if (entitySet && !entitySet.has(c.entityType)) return false;
        if (statusSet && !statusSet.has(c.status)) return false;
        if (tierSet && !tierSet.has(c.tier)) return false;
        if (packageSet) {
          const matches = c.servicePackages.some((p) => packageSet.has(p));
          if (!matches) return false;
        }
        if (input.hasDeadlineThisWeek && !hasThisWeek(c.id)) return false;
        return true;
      });
      return { items, nextCursor: undefined as string | undefined };
    },
    get: async ({ id }: { id: string }) => {
      await delay();
      return getState().clients.find((c) => c.id === id) ?? null;
    },
    create: async (input: Parameters<typeof actions.addClient>[0]) => {
      await delay(200);
      const id = actions.addClient(input);
      return { id };
    },
    update: async (input: {
      id: string;
      patch: Parameters<typeof actions.updateClient>[1];
    }) => {
      await delay();
      actions.updateClient(input.id, input.patch);
      return { ok: true as const };
    },
    archive: async ({ id }: { id: string }) => {
      await delay();
      actions.archiveClient(id);
      return { ok: true as const };
    },
    previewPackageChange: async (_input: unknown) => {
      // Advisory only for now — migration preview uses heuristics in-modal.
      await delay();
      return { removed: [], added: [], kept: [] };
    },
    applyPackageChange: async (_input: unknown) => {
      await delay();
      return { ok: true as const };
    },
    assignBundle: async (input: { clientId: string; bundleId: string }) => {
      await delay();
      const added = actions.assignBundle(input.clientId, input.bundleId);
      return { added };
    },
    unassignBundle: async (input: { clientId: string; bundleId: string }) => {
      await delay();
      const removed = actions.unassignBundle(input.clientId, input.bundleId);
      return { removed };
    },
    addNote: async (input: {
      clientId: string;
      body: string;
      relatedDeadlineId?: string;
    }) => {
      await delay();
      const id = actions.addNote(
        input.clientId,
        input.body,
        input.relatedDeadlineId
      );
      return { id };
    },
    toggleNotePin: async (input: { clientId: string; noteId: string }) => {
      await delay();
      actions.toggleNotePin(input.clientId, input.noteId);
      return { ok: true as const };
    },
    deleteNote: async (input: { clientId: string; noteId: string }) => {
      await delay();
      actions.deleteNote(input.clientId, input.noteId);
      return { ok: true as const };
    },
  },

  deadlines: {
    listForTriage: async () => {
      await delay();
      const { deadlines } = getState();
      const active = deadlines.filter(
        (d) => d.status !== "completed" && d.status !== "filed_extension"
      );
      const buckets = {
        overdue: [] as Deadline[],
        thisWeek: [] as Deadline[],
        thisMonth: [] as Deadline[],
        longTerm: [] as Deadline[],
      };
      for (const d of active) {
        const b = bucketOf(d.officialDueDate);
        if (b === "overdue") buckets.overdue.push(d);
        else if (b === "this_week") buckets.thisWeek.push(d);
        else if (b === "this_month") buckets.thisMonth.push(d);
        else buckets.longTerm.push(d);
      }
      const byDate = (a: Deadline, b: Deadline) =>
        a.officialDueDate.localeCompare(b.officialDueDate);
      buckets.overdue.sort(byDate);
      buckets.thisWeek.sort(byDate);
      buckets.thisMonth.sort(byDate);
      buckets.longTerm.sort(byDate);
      return buckets;
    },
    listForClient: async ({ clientId }: { clientId: string }) => {
      await delay();
      return getState().deadlines.filter((d) => d.clientId === clientId);
    },
    updateStatus: async (input: {
      id: string;
      status: Deadline["status"];
    }) => {
      await delay();
      actions.setDeadlineStatus(input.id, input.status);
      return { ok: true as const };
    },
    defer: async (input: { id: string; newDate: string }) => {
      await delay();
      actions.deferDeadline(input.id, input.newDate);
      return { ok: true as const };
    },
    fileExtension: async ({ id }: { id: string }) => {
      await delay();
      actions.fileExtension(id);
      return { id };
    },
    markExtensionApproved: async ({ id }: { id: string }) => {
      await delay();
      actions.markExtensionApproved(id);
      return { ok: true as const };
    },
    batchAdjust: async (input: {
      clientIds: string[];
      oldDate: string;
      newDate: string;
      announcementTitle?: string;
    }) => {
      await delay(200);
      actions.batchAdjustDeadlines(
        input.clientIds,
        input.oldDate,
        input.newDate,
        input.announcementTitle
      );
      return { ok: true as const };
    },
    quickAdd: async (input: {
      clientId: string;
      form: string;
      jurisdiction: Deadline["jurisdiction"];
      officialDueDate: string;
    }) => {
      await delay();
      const id = actions.addDeadline(
        input.clientId,
        input.form,
        input.jurisdiction,
        input.officialDueDate
      );
      return { id };
    },
  },

  servicePackages: {
    list: async (): Promise<ServicePackage[]> => {
      await delay();
      return BUNDLES.map((b) => bundleToServicePackage(b.id)).filter(
        (p): p is ServicePackage => !!p
      );
    },
    suggestForClient: async ({ entityType }: { entityType: string }) => {
      await delay();
      const b = BUNDLES.find((x) => x.entityTypes.includes(entityType as never));
      return b ? bundleToServicePackage(b.id) : null;
    },
    assignToClient: async (input: { clientId: string; bundleId: string }) => {
      await delay();
      actions.assignBundle(input.clientId, input.bundleId);
      return { ok: true as const };
    },
    clone: async () => {
      await delay();
      return { id: "pkg-clone-stub" };
    },
    updateCustom: async () => {
      await delay();
      return { ok: true as const };
    },
  },

  announcements: {
    list: async (input: { activeOnly?: boolean } = {}) => {
      await delay();
      const { announcements } = getState();
      if (input.activeOnly)
        return announcements.filter((a) => !a.dismissed);
      return announcements;
    },
    get: async ({ id }: { id: string }) => {
      await delay();
      return getState().announcements.find((a) => a.id === id) ?? null;
    },
    acknowledge: async ({ id }: { id: string }) => {
      await delay();
      actions.markAnnouncementRead(id);
      return { ok: true as const };
    },
    snooze: async (_input: {
      id: string;
      until: string;
      reason?: string;
    }) => {
      await delay();
      return { ok: true as const };
    },
    dismiss: async ({ id }: { id: string }) => {
      await delay();
      actions.dismissAnnouncement(id);
      return { ok: true as const };
    },
    markRead: async ({ id }: { id: string }) => {
      await delay();
      actions.markAnnouncementRead(id);
      return { ok: true as const };
    },
    batchAdjustDeadlines: async (input: {
      clientIds: string[];
      oldDate: string;
      newDate: string;
      announcementTitle?: string;
    }) => {
      await delay(200);
      actions.batchAdjustDeadlines(
        input.clientIds,
        input.oldDate,
        input.newDate,
        input.announcementTitle
      );
      return { ok: true as const };
    },
    detect: async () => {
      await delay(200);
      const count = actions.detectNewAnnouncements();
      return { count };
    },
  },

  notifications: {
    list: async (): Promise<Notification[]> => {
      await delay();
      // Merge announcements-as-notifications + notifications for consumer parity
      const { notifications, announcements } = getState();
      const fromAnnouncements: Notification[] = announcements
        .filter((a) => !a.dismissed)
        .map((a) => ({
          id: `ann-notif:${a.id}`,
          kind: "alert" as const,
          createdAt: a.detectedAt,
          title: `${a.stateCode}: ${a.title}`,
          detail: `${a.affectedClientIds.length} client${
            a.affectedClientIds.length === 1 ? "" : "s"
          } affected · ${a.authority}`,
          href: `/announcements/${a.id}`,
          read: a.read,
          announcementId: a.id,
        }));
      return [...fromAnnouncements, ...notifications].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
    },
    markRead: async ({ id }: { id: string }) => {
      await delay();
      actions.markNotificationRead(id);
      return { ok: true as const };
    },
    markAllRead: async () => {
      await delay();
      actions.markAllNotificationsRead();
      return { ok: true as const };
    },
    dismiss: async () => {
      await delay();
      return { ok: true as const };
    },
    updatePreferences: async () => {
      await delay();
      return { ok: true as const };
    },
  },

  imports: {
    detectFormat: async () => {
      await delay(400);
      return { source: "CSV", confidence: "high" as const };
    },
    suggestFieldMapping: async (input: unknown) => {
      await delay(300);
      return input;
    },
    preview: async (input: unknown) => {
      await delay();
      return input;
    },
    commit: async (input: {
      rows: Array<Parameters<typeof actions.addClientsBulk>[0][number]>;
      source?: string;
      skippedCount?: number;
    }) => {
      await delay(500);
      const { ids, importId } = actions.addClientsBulk(input.rows, {
        source: input.source,
        skippedCount: input.skippedCount,
      });
      return { ids, importId };
    },
    listHistory: async (): Promise<ImportRun[]> => {
      await delay();
      return getState().imports.map((r) => ({
        id: r.id,
        firmId: "firm-mock",
        sourceFormat: (r.source?.toLowerCase() === "csv"
          ? "excel"
          : null) as ImportRun["sourceFormat"],
        originalFilename: null,
        clientsCreated: r.clientIds.length,
        deadlinesCreated: r.deadlineCount,
        rowsFailed: r.skippedCount,
        status: r.undone ? "undone" : "committed",
        committedAt: r.importedAt,
        undoneAt: r.undone ? r.importedAt : null,
        createdAt: r.importedAt,
      }));
    },
    undo: async ({ id }: { id: string }) => {
      await delay();
      const removed = actions.undoImport(id);
      return { removed };
    },
  },

  exports: {
    request: async () => {
      await delay(300);
      return { exportId: `exp-${Date.now()}` };
    },
    status: async () => {
      await delay();
      return { status: "ready" as const };
    },
  },

  uploads: {
    requestUrl: async (input: { kind: string; filename: string }) => {
      await delay();
      return {
        uploadUrl: `data:mock/${input.kind};${input.filename}`,
        storageKey: `${input.kind}/${Date.now()}-${input.filename}`,
      };
    },
  },

  team: {
    list: async (): Promise<User[]> => {
      await delay();
      return [currentUser()];
    },
    invite: async () => {
      await delay();
      return { inviteId: `inv-${Date.now()}` };
    },
    updateRole: async () => {
      await delay();
      return { ok: true as const };
    },
    remove: async () => {
      await delay();
      return { ok: true as const };
    },
  },
} as const;

export type MockAdapter = typeof mockAdapter;
