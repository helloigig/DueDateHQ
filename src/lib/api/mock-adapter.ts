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
      return {
        fetched: count,
        new: count,
        lowConfidence: 0,
        matchedForFirm: count,
      };
    },
    /** Mock reviewer queue — empty in mock mode. Real BE returns
     *  low-confidence scraped notices. */
    reviewerQueue: async () => {
      await delay();
      return [] as Array<{
        id: string;
        stateCode: string;
        authority: string;
        title: string;
        summary: string;
        type: string;
        sourceUrl: string;
        parseConfidence: string;
        detectedAt: string;
      }>;
    },
    approveScraped: async () => {
      await delay();
      return { ok: true as const };
    },
    rejectScraped: async () => {
      await delay();
      return { ok: true as const };
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
          href: `/alerts/${a.id}`,
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
    preview: async (input: {
      rows: Array<{ name: string; primaryState: string; servicePackage?: string }>;
    }) => {
      await delay();
      // Mock preview — count rows + flag any duplicates against the
      // current store. Real BE walks the clients table.
      const existing = new Set(
        getState().clients.map(
          (c) => `${c.name.toLowerCase()}|${c.primaryState}`,
        ),
      );
      let newClients = 0;
      let duplicates = 0;
      let withPackage = 0;
      for (const r of input.rows) {
        const key = `${r.name.toLowerCase()}|${r.primaryState}`;
        if (existing.has(key)) duplicates++;
        else {
          newClients++;
          if (r.servicePackage) withPackage++;
        }
      }
      return {
        newClients,
        duplicates,
        withPackage,
        // Mock store doesn't have a firm_packages list, so unmatched
        // package names are always empty here. Real BE checks against
        // the firm's packages.
        unmatchedPackages: [] as string[],
      };
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
      return {
        ids,
        importId,
        clientsCreated: ids.length,
        skippedCount: input.skippedCount ?? 0,
        deadlinesCreated: 0,
        tasksCreated: 0,
      };
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
    /** Mock prior-year PDF parser — deterministic by storageKey hash so
     *  re-running gives the same answer. Real BE reads the PDF + LLM. */
    parsePriorYearReturn: async ({ storageKey }: { storageKey: string }) => {
      await delay(800);
      const hash = Array.from(storageKey).reduce(
        (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
        0,
      );
      const entityType =
        hash % 3 === 0 ? "LLC" : hash % 3 === 1 ? "S-Corp" : "Individual";
      return {
        fields: {
          clientName: null,
          ein: null,
          entityType,
          taxYear: 2024,
          priorAGI: null,
          formsFiled: [],
          k1Sources: [],
          confidence: 0.4,
        },
        readyForCommit: false,
      };
    },
  },

  /** Files-from-clients — digest + SMS + cover sheet handlers.
   *  Mock mode synthesizes data from the local store. */
  filesFromClients: {
    digestForClient: async (input: {
      clientId: string;
      cpaSignature: string;
      tone?: "warm" | "neutral" | "urgent";
    }) => {
      await delay(400);
      const state = getState();
      const client = state.clients.find((c) => c.id === input.clientId);
      if (!client) return null;
      // Find this client's pending checklist items across all tasks
      const clientTasks = state.tasks.filter((t) => t.clientId === input.clientId);
      const taskBundles = clientTasks
        .map((task) => {
          const items = state.checklistItems.filter(
            (c) =>
              c.taskId === task.id &&
              (c.state === "not_requested" ||
                c.state === "requested_waiting" ||
                c.state === "received_issue"),
          );
          if (items.length === 0) return null;
          return {
            taskId: task.id,
            formType: task.formType,
            forwardingEmail: task.forwardingEmail,
            pendingItems: items.map((i) => ({
              itemType: i.itemType,
              label: i.label,
            })),
          };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);
      if (taskBundles.length === 0) return null;
      const formTypes = [...new Set(taskBundles.map((b) => b.formType))].join(" + ");
      const allLabels = [
        ...new Set(taskBundles.flatMap((b) => b.pendingItems.map((p) => p.label))),
      ];
      const firstName = client.name.split(/\s+/)[0] ?? client.name;
      return {
        clientId: client.id,
        clientName: client.name,
        clientEmail: client.contactEmail ?? null,
        tasks: taskBundles,
        draft: {
          subject: `Open items for your ${formTypes}`,
          body: `Hi ${firstName},\n\nQuick consolidated note — I still need ${allLabels.slice(0, 3).join(", ")}${allLabels.length > 3 ? `, and ${allLabels.length - 3} more` : ""}. Reply with whatever you have or send to ${taskBundles[0]?.forwardingEmail}.\n\nThanks,\n${input.cpaSignature}`,
          aiSources: [
            {
              kind: "digest",
              note: `Consolidated ${taskBundles.length} task${taskBundles.length === 1 ? "" : "s"} into one email`,
            },
          ],
          inferenceId: 0,
        },
      };
    },
    digestForFirm: async (input: {
      cpaSignature: string;
      tone?: "warm" | "neutral" | "urgent";
    }) => {
      await delay(800);
      // Reuse digestForClient for each client with pending items
      const state = getState();
      const out: Array<NonNullable<Awaited<ReturnType<typeof mockAdapter.filesFromClients.digestForClient>>>> = [];
      for (const c of state.clients) {
        const digest = await mockAdapter.filesFromClients.digestForClient({
          clientId: c.id,
          cpaSignature: input.cpaSignature,
          tone: input.tone,
        });
        if (digest) out.push(digest);
      }
      return out;
    },
    smsStatus: async () => {
      await delay();
      // Mock mode reports SMS as not-configured so the FE shows the
      // proper "coming soon" CTA. Real BE checks env vars.
      return { configured: false };
    },
    sendChaseSms: async () => {
      await delay();
      throw new Error("sms_not_configured_in_mock_mode");
    },
    composeChaseSms: async (input: {
      clientFirstName: string;
      cpaName: string;
      formType: string;
      missingItem?: string;
      forwardingEmail: string;
    }) => {
      await delay();
      const item = input.missingItem ?? "tax docs";
      return {
        body: `Hi ${input.clientFirstName} — ${input.cpaName} here. Still need ${item} for your ${input.formType}. Reply with photo or email ${input.forwardingEmail}. Thanks!`,
      };
    },
  },

  /** Mock integrations — empty list, all providers reported as
   *  not-configured so the FE renders "Coming soon" CTAs. Real BE
   *  reads from the integrations table + isConfigured(). */
  integrations: {
    list: async () => {
      await delay();
      return [] as Array<{
        id: string;
        kind: "qbo" | "xero" | "gmail" | "outlook" | "stripe";
        status: "connected" | "disconnected" | "error";
        externalAccountId: string | null;
        scope: string | null;
        lastSyncedAt: string | null;
        lastError: string | null;
        expiresAt: string | null;
        configured: boolean;
      }>;
    },
    catalog: async () => {
      await delay();
      return [
        { kind: "qbo" as const, configured: false },
        { kind: "xero" as const, configured: false },
        { kind: "gmail" as const, configured: false },
        { kind: "outlook" as const, configured: false },
        { kind: "stripe" as const, configured: false },
      ];
    },
    startConnect: async () => {
      await delay();
      // Mock — no real OAuth flow; throw so the FE can show the
      // "Coming soon" state without trying to navigate.
      throw new Error("oauth_not_configured_in_mock_mode");
    },
    disconnect: async () => {
      await delay();
      return { ok: true as const };
    },
    /** Method B poll — mock returns zeros (no real Gmail/Outlook
     *  in mock mode). Real BE polls the inbox, classifies attachments,
     *  writes checklist items. */
    pollMethodB: async () => {
      await delay(400);
      return {
        messagesScanned: 0,
        matched: 0,
        attachmentsClassified: 0,
        errors: 0,
      };
    },
    /** Mock sync — returns zeros (mock mode has no real QBO/Xero).
     *  Real BE pulls Customers and upserts Clients. */
    syncNow: async () => {
      await delay(500);
      return {
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      };
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
    /** Mock storage status — reports configured=false so the FE can
     *  surface "Upload not yet wired" honestly when no real Supabase
     *  Storage credentials are present. */
    status: async () => {
      await delay();
      return { configured: false };
    },
    requestUrl: async (input: { kind: string; filename: string }) => {
      await delay();
      // In mock mode the upload URL is a synthetic data: URI — the
      // FE upload component recognizes this and skips the real PUT,
      // calling the follow-up procedure with the mock storageKey.
      return {
        uploadUrl: `data:mock/${input.kind};${input.filename}`,
        storageKey: `mock-firm/${input.kind}/${Date.now()}-${input.filename}`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };
    },
    downloadUrl: async (input: { storageKey: string }) => {
      await delay();
      return { url: `data:mock/${input.storageKey}` };
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

  tasks: {
    list: async (input: { clientId?: string } = {}) => {
      await delay();
      const { tasks } = getState();
      return input.clientId
        ? tasks.filter((t) => t.clientId === input.clientId)
        : tasks;
    },
    get: async ({ id }: { id: string }) => {
      await delay();
      return getState().tasks.find((t) => t.id === id) ?? null;
    },
    updateStatus: async ({
      id,
      status,
    }: {
      id: string;
      status: import("../../types").TaskStatus;
    }) => {
      await delay();
      actions.updateTaskStatus(id, status);
      return { ok: true as const };
    },
    createForDeadline: async (_: { deadlineId: string }) => {
      // Tasks in mock mode are auto-built from deadlines on read; this
      // procedure is a no-op for parity with the BE contract.
      await delay();
      return { id: _.deadlineId, alreadyExists: true as const };
    },
  },

  checklists: {
    listForTask: async ({ taskId }: { taskId: string }) => {
      await delay();
      const { checklistItems } = getState();
      return checklistItems
        .filter((c) => c.taskId === taskId)
        .sort((a, b) => a.order - b.order);
    },
    setState: async ({
      id,
      state,
    }: {
      id: string;
      state: import("../../types").DocumentState;
    }) => {
      await delay();
      actions.setChecklistItemState(id, state, "cpa");
      return { ok: true as const };
    },
  },

  activity: {
    listForTask: async ({ taskId }: { taskId: string }) => {
      await delay();
      // Mock store keeps activity on the client. Surface only entries
      // related to this task — best-effort by `relatedDeadlineId`.
      const { tasks, clients } = getState();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return [];
      const client = clients.find((c) => c.id === task.clientId);
      return (client?.activity ?? []).filter(
        (a) => !a.relatedDeadlineId || a.relatedDeadlineId === task.deadlineId,
      );
    },
  },

  emails: {
    listForTask: async ({ taskId }: { taskId: string }) => {
      await delay();
      return getState().emailDrafts.filter((d) => d.taskId === taskId);
    },
    saveDraft: async (input: import("../../types").EmailDraft) => {
      await delay();
      const id = actions.saveEmailDraft(input);
      return { id };
    },
    send: async ({ id }: { id: string }) => {
      await delay();
      actions.sendEmail(id);
      const sentAt = new Date().toISOString();
      const recallWindowExpiresAt = new Date(Date.now() + 60_000).toISOString();
      return { id, sentAt, recallWindowExpiresAt };
    },
    recall: async () => {
      await delay();
      return { ok: true as const };
    },
    discard: async ({ id }: { id: string }) => {
      await delay();
      actions.discardEmailDraft(id);
      return { ok: true as const };
    },
  },

  reminderTemplates: {
    list: async () => {
      await delay();
      return getState().reminderTemplates;
    },
  },

  /** AI namespace — mock-mode dispatch. Real mode hits backend ai.* */
  ai: {
    status: async () => {
      await delay();
      // Mock mode reports AI as configured so the FE doesn't gate on it
      // for demo purposes. Real mode reflects actual env state.
      return { configured: true };
    },
    classifyDocument: async (input: {
      filename: string;
      itemType?: string;
      taskContext?: {
        pendingItems: Array<{ itemType: string; label: string }>;
      };
    }) => {
      await delay(300);
      const code =
        input.filename.charCodeAt(0) + input.filename.length;
      const confidence: "high" | "medium" | "low" =
        code % 5 === 0 ? "low" : code % 3 === 0 ? "medium" : "high";
      const guess = (input.itemType ?? "document")
        .replace(/_/g, " ")
        .toUpperCase();
      return {
        guess,
        itemType: input.itemType ?? null,
        confidence,
        flagReason: undefined,
        inferenceId: 0,
      };
    },
    /** Mock Mode B — returns the deterministic stub's window. Real
     *  BE calls Claude with prior arrival dates. */
    predictArrivalTiming: async () => {
      await delay();
      return {
        windowStart: "03-01",
        windowEnd: "03-15",
        confidence: "medium" as const,
        reasoning: "Based on a 2-year historical pattern.",
        inferenceId: 0,
      };
    },
    /** Mock Mode C — returns no-anomaly. Real BE has the contextual
     *  judgment branch. */
    detectAnomaly: async () => {
      await delay();
      return {
        isAnomaly: false,
        severity: "low" as const,
        reason: "Within 15% of prior-year mean.",
        likelyExplanation: "",
        needsCpaJudgment: false,
        inferenceId: 0,
      };
    },
    /** Mock Mode E — returns one example insight so the FE flow has
     *  shape to render. Real BE generates from multi-year context. */
    generateCrossYearInsights: async () => {
      await delay(400);
      return {
        insights: [
          {
            category: "missing_item" as const,
            title: "K-1 from Apex Fund expected",
            detail:
              "Last 3 years a K-1 from Apex Fund arrived in early March. Not yet seen this year — worth a chase.",
            confidence: "high" as const,
            priorYearsEvidence: [2022, 2023, 2024],
          },
        ],
        inferenceId: 0,
      };
    },
    draftEmail: async (input: {
      client: { name: string };
      task: { formType: string };
      itemLabel?: string;
      tone: "warm" | "neutral" | "urgent";
      cpaSignature: string;
      forwardingEmail: string;
    }) => {
      await delay(700);
      const item = input.itemLabel ?? "outstanding documents";
      const greeting =
        input.tone === "urgent"
          ? `Hi ${input.client.name},\n\nTime-sensitive: `
          : input.tone === "warm"
            ? `Hi ${input.client.name},\n\n`
            : `Dear ${input.client.name},\n\n`;
      const ask =
        input.tone === "urgent"
          ? `I still need your ${item} to file by your deadline. Please send as soon as possible.`
          : input.tone === "warm"
            ? `Could you forward your ${item} when you get a chance?`
            : `I am writing to request your ${item} so we can complete your return on schedule.`;
      const closer =
        input.tone === "urgent"
          ? `\n\nThanks for jumping on this,\n${input.cpaSignature}`
          : input.tone === "warm"
            ? `\n\nThanks,\n${input.cpaSignature}`
            : `\n\nKind regards,\n${input.cpaSignature}`;
      const subject =
        input.tone === "urgent"
          ? `Urgent: ${item} for your ${input.task.formType}`
          : `${item} for your ${input.task.formType}`;
      return {
        subject,
        body: `${greeting}${ask}\n\nYou can reply to this email or send to ${input.forwardingEmail}.${closer}`,
        aiSources: [
          {
            kind: "substrate",
            note: `Tone defaulted to ${input.tone}; connect Gmail/Outlook to mirror your voice.`,
          },
          {
            kind: "forwarding_email",
            note: `Per-task forwarding: ${input.forwardingEmail}`,
          },
        ],
        inferenceId: 0,
      };
    },
  },

  aiInferences: {
    recordAcceptance: async () => {
      await delay();
      return { ok: true as const };
    },
    summary: async () => {
      await delay();
      // Mock — show modest acceptance rates so the eval panel has shape.
      return {
        total: 142,
        actedOn: 121,
        accepted: 105,
        acceptanceRate: 105 / 121,
        totalCostCents: 487.2,
      };
    },
    /** Mock drift report — 8 weeks of buckets, slight downward trend
     *  to exercise both "stable" and "alert" branches in the UI. */
    driftReport: async () => {
      await delay();
      const today = new Date();
      const weeks: Array<{
        week: string;
        total: number;
        acceptanceRate: number | null;
      }> = [];
      // Generate the last 8 ISO weeks with a slight downtrend so the
      // UI has data to draw. Latest week is intentionally a bit lower.
      const baseRate = 0.88;
      for (let i = 7; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i * 7);
        const yr = d.getUTCFullYear();
        // Crude ISO-week-of-year approximation; close enough for mock.
        const week = Math.ceil(
          ((d.getTime() - Date.UTC(yr, 0, 1)) / 86_400_000 + 1) / 7,
        );
        const wobble = ((i * 13) % 7) / 100; // deterministic ±3pp wobble
        const drop = i === 0 ? 0.07 : 0; // latest week 7pp lower
        weeks.push({
          week: `${yr}-W${String(week).padStart(2, "0")}`,
          total: 18 + ((i * 5) % 11),
          acceptanceRate: baseRate + wobble - drop,
        });
      }
      const latest = weeks[weeks.length - 1]?.acceptanceRate ?? null;
      const prior = weeks
        .slice(-5, -1)
        .map((w) => w.acceptanceRate)
        .filter((r): r is number => r !== null);
      const priorMean =
        prior.length > 0 ? prior.reduce((s, r) => s + r, 0) / prior.length : null;
      const drift =
        latest !== null && priorMean !== null ? latest - priorMean : null;
      return { weeks, drift, alert: drift !== null && drift < -0.05 };
    },
  },

  aiInsights: {
    listForClient: async ({ clientId }: { clientId: string }) => {
      await delay();
      return getState().aiInsights.filter((i) => i.clientId === clientId);
    },
  },

  multistate: {
    preview: async (input: {
      stateCodes: string[];
      includeFederal?: boolean;
      year?: number;
    }) => {
      await delay();
      // Mock approximation: produce a synthetic deadline list per state.
      // Real BE uses actual seeded service_templates.
      const FED_FORMS = ["1040", "1040-ES", "941"];
      const STATE_FORMS_BY_STATE: Record<string, string[]> = {
        CA: ["CA 540", "CA 568", "CA 100S"],
        NY: ["NY IT-201", "NY CT-3"],
        TX: ["TX Franchise"],
        LA: ["LA IT-540", "LA CIFT-620"],
        FL: ["FL F-1120"],
        IL: ["IL-1040", "IL-1120"],
        PA: ["PA-40"],
        GA: ["GA-500"],
        NJ: ["NJ-1040"],
        MA: ["MA Form 1"],
      };
      const year = input.year ?? new Date().getFullYear();
      const groups = [] as Array<{
        jurisdiction: string;
        templateCount: number;
        deadlineCount: number;
        deadlines: Array<{
          templateId: string;
          formType: string;
          jurisdiction: string;
          period: string;
          officialDueDate: string;
          adjustedDueDate: string;
        }>;
      }>;
      let totalTemplates = 0;
      let totalDeadlines = 0;
      const statesWithoutTemplates: string[] = [];
      const due = `${year}-04-15`;
      if (input.includeFederal !== false) {
        const items = FED_FORMS.map((f, idx) => ({
          templateId: `mock-fed-${idx}`,
          formType: f,
          jurisdiction: "federal",
          period: `${year}`,
          officialDueDate: due,
          adjustedDueDate: due,
        }));
        groups.push({
          jurisdiction: "federal",
          templateCount: items.length,
          deadlineCount: items.length,
          deadlines: items,
        });
        totalTemplates += items.length;
        totalDeadlines += items.length;
      }
      for (const code of input.stateCodes) {
        const upper = code.toUpperCase();
        const forms = STATE_FORMS_BY_STATE[upper];
        if (!forms || forms.length === 0) {
          statesWithoutTemplates.push(upper.toLowerCase());
          continue;
        }
        const items = forms.map((f, idx) => ({
          templateId: `mock-${upper}-${idx}`,
          formType: f,
          jurisdiction: upper.toLowerCase(),
          period: `${year}`,
          officialDueDate: due,
          adjustedDueDate: due,
        }));
        groups.push({
          jurisdiction: upper.toLowerCase(),
          templateCount: items.length,
          deadlineCount: items.length,
          deadlines: items,
        });
        totalTemplates += items.length;
        totalDeadlines += items.length;
      }
      return { groups, totalDeadlines, totalTemplates, statesWithoutTemplates };
    },
    commit: async (input: {
      clientId: string;
      stateCodes: string[];
      saveAsPackage?: boolean;
    }) => {
      await delay(200);
      // Mock just acks; the real store doesn't persist multistate bundles.
      return {
        ok: true as const,
        createdDeadlines: input.stateCodes.length * 2,
        createdTasks: input.stateCodes.length * 2,
        createdChecklistItems: input.stateCodes.length * 6,
        createdPackageId: input.saveAsPackage ? "pkg-mock-multistate" : null,
      };
    },
  },
} as const;

export type MockAdapter = typeof mockAdapter;
