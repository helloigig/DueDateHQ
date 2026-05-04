/**
 * Mock implementation of every tRPC procedure. Reads from `src/data/store.ts`.
 * Each method returns a Promise with a realistic 100-300ms delay so that UI
 * loading states are exercised during development.
 *
 * When the backend ships, this file goes away — or stays in place, guarded by
 * `env.useMockData`, for offline-demo / Storybook use.
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
  ActivityEntry,
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

// In-memory mock store for taskMilestones — survives across calls within a
// page session, cleared on reload. Supports `proposeForTask` round-trips so
// TaskMiniTimeline can demo the Mode B propose flow without a backend.
type MockMilestoneRow = {
  id: string;
  firmId: string;
  taskId: string;
  milestoneType: string;
  customLabel: string | null;
  targetDate: string | null;
  completedDate: string | null;
  status: "not_started" | "in_progress" | "blocked" | "done" | "overdue";
  blockerReason: string | null;
  displayOrder: number;
  proposedBy: "user" | "ai" | "system";
};
const mockMilestoneStore = new Map<string, MockMilestoneRow[]>();

// Mutable mock inbound-replies store. Lets the mock-mode UI exercise the
// real linkToTask + markActioned flows: actioned rows are removed from
// list output (mirrors the BE filter on cpaActionedAt). Seeded with three
// rows that match the static demo INBOX_MOCK in Mail.tsx so the row text
// is consistent.
type MockInboundReply = {
  id: string;
  firmId: string;
  taskId: string | null;
  clientId: string | null;
  gmailMessageId: string;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  bodyText: string | null;
  attachmentMetadata: unknown[];
  topLevelClass: string | null;
  replyIntent: string | null;
  intentConfidence: string | null;
  suggestedAction: unknown;
  receivedAt: string;
  classifiedAt: string | null;
  cpaActionedAt: string | null;
};
const mockInboundReplies: MockInboundReply[] = (() => {
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 60 * 60 * 1000).toISOString();
  return [
    {
      id: "reply-mock-1",
      firmId: "firm-mock",
      taskId: null,
      clientId: null,
      gmailMessageId: "gmail-mock-1",
      fromAddress: "sarah.mitchell@example.com",
      toAddress: "intake@duedatehq.space",
      subject: "1040 NY — K-1 timing",
      bodyText:
        "Hi! K-1 from my fund won't be ready until late July...",
      attachmentMetadata: [],
      topLevelClass: "client_reply",
      replyIntent: "timeline_pushback",
      intentConfidence: "0.91",
      suggestedAction: null,
      receivedAt: ago(3),
      classifiedAt: ago(3),
      cpaActionedAt: null,
    },
    {
      id: "reply-mock-2",
      firmId: "firm-mock",
      taskId: null,
      clientId: null,
      gmailMessageId: "gmail-mock-2",
      fromAddress: "jordan.lee@example.com",
      toAddress: "intake@duedatehq.space",
      subject: "S-Corp CA — IRA limit",
      bodyText:
        "Quick question — what's the IRA contribution limit this year?",
      attachmentMetadata: [],
      topLevelClass: "client_reply",
      replyIntent: "question_asked",
      intentConfidence: "0.88",
      suggestedAction: null,
      receivedAt: ago(7),
      classifiedAt: ago(7),
      cpaActionedAt: null,
    },
    {
      id: "reply-mock-3",
      firmId: "firm-mock",
      taskId: null,
      clientId: null,
      gmailMessageId: "gmail-mock-3",
      fromAddress: "emily.hartfield@example.com",
      toAddress: "intake@duedatehq.space",
      subject: "1040 NY — W-2",
      bodyText: "Attached: W-2 for 2025 (ADP via Acme Corp)",
      attachmentMetadata: [{ filename: "W2-2025.pdf", size: 12834 }],
      topLevelClass: "client_doc",
      replyIntent: "document_provided",
      intentConfidence: "0.96",
      suggestedAction: null,
      receivedAt: ago(14),
      classifiedAt: ago(14),
      cpaActionedAt: null,
    },
  ];
})();

function nextApril15(): string {
  const now = new Date();
  const year =
    now.getMonth() < 3 || (now.getMonth() === 3 && now.getDate() < 15)
      ? now.getFullYear()
      : now.getFullYear() + 1;
  return `${year}-04-15`;
}

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

  // todoItems — computed view per PRD §4.8 + IA v0.7 §3.1. Mock adapter
  // computes from the same in-memory store the rest of the app uses, so
  // the action queue stays in sync with checklist state changes.
  todoItems: {
    list: async (
      input: { limit?: number } | undefined = undefined,
    ): Promise<{
      items: Array<{
        id: string;
        source: string;
        verb: "Send" | "Confirm" | "Apply" | "Discuss";
        client: string;
        clientId: string;
        task?: string;
        taskId?: string;
        dueDate?: string;
        action: string;
        context: string;
        stageLabel?: string;
        daysBehind?: number;
        urgency: "high" | "medium" | "normal";
        urgencyScore: number;
        surface:
          | "email_draft_modal"
          | "task_detail"
          | "alert_detail"
          | "opportunity_detail"
          | "bounce_modal";
      }>;
      total: number;
      sourcesPending: string[];
    }> => {
      await delay();
      const limit = input?.limit ?? 50;
      const { checklistItems, tasks, clients, deadlines, announcements } =
        getState();
      const items: Array<{
        id: string;
        source: string;
        verb: "Send" | "Confirm" | "Apply" | "Discuss";
        client: string;
        clientId: string;
        task?: string;
        taskId?: string;
        dueDate?: string;
        action: string;
        context: string;
        stageLabel?: string;
        daysBehind?: number;
        urgency: "high" | "medium" | "normal";
        urgencyScore: number;
        surface:
          | "email_draft_modal"
          | "task_detail"
          | "alert_detail"
          | "opportunity_detail"
          | "bounce_modal";
      }> = [];

      const TIER_WEIGHT: Record<string, number> = {
        premium: 1.5,
        standard: 1,
        custom: 1,
      };
      const taskById = new Map(tasks.map((t) => [t.id, t]));
      const clientById = new Map(clients.map((c) => [c.id, c]));
      const deadlineById = new Map(deadlines.map((d) => [d.id, d]));

      const proximityFactor = (iso: string | null | undefined): number => {
        if (!iso) return 1;
        const days =
          (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        if (days < 0) return 3;
        if (days < 7) return 2;
        if (days < 30) return 1.5;
        return 1;
      };

      const urgencyBucket = (s: number): "high" | "medium" | "normal" => {
        if (s >= 200) return "high";
        if (s >= 100) return "medium";
        return "normal";
      };

      // Sources 1-3: checklist-derived (Mode A inbound, Mode C anomaly,
      // Mode B reminder due). One pass over checklistItems.
      for (const ci of checklistItems) {
        const task = taskById.get(ci.taskId);
        if (!task) continue;
        const deadline = deadlineById.get(task.deadlineId);
        const client = clientById.get(deadline?.clientId ?? "");
        if (!client || !deadline) continue;
        const tierW = TIER_WEIGHT[client.tier ?? "standard"] ?? 1;
        const due = deadline.officialDueDate;

        if (ci.state === "received_issue") {
          const score = 80 * proximityFactor(due) * tierW;
          items.push({
            id: `mode_c-${ci.id}`,
            source: "mode_c_anomaly",
            verb: "Confirm",
            client: client.name,
            clientId: client.id,
            task: task.formType,
            taskId: task.id,
            dueDate: due,
            action: `Resolve flag · ${ci.label}`,
            context:
              ci.flagReason ?? "Mode C flagged anomaly — review before confirming",
            stageLabel: "Review",
            urgency: urgencyBucket(score),
            urgencyScore: Math.round(score),
            surface: "task_detail",
          });
        } else if (ci.state === "received_unreviewed") {
          const score = 50 * proximityFactor(due) * tierW;
          items.push({
            id: `mode_a-${ci.id}`,
            source: "mode_a_inbound",
            verb: "Confirm",
            client: client.name,
            clientId: client.id,
            task: task.formType,
            taskId: task.id,
            dueDate: due,
            action: `Confirm ${ci.label}`,
            context: `AI ${ci.aiConfidence ?? "medium"} confidence · received and waiting for your decision`,
            stageLabel: "Review",
            urgency: urgencyBucket(score),
            urgencyScore: Math.round(score),
            surface: "task_detail",
          });
        } else if (
          ci.state === "requested_waiting" ||
          ci.state === "not_requested"
        ) {
          const lastReminder = ci.lastReminderAt
            ? new Date(ci.lastReminderAt).getTime()
            : null;
          const daysSinceReminder = lastReminder
            ? Math.floor((Date.now() - lastReminder) / (24 * 60 * 60 * 1000))
            : null;
          const wm =
            ci.state === "not_requested"
              ? 2.0
              : !lastReminder
                ? 1.0
                : daysSinceReminder! > 7
                  ? 2.5
                  : daysSinceReminder! > 3
                    ? 1.5
                    : 1.0;
          const stuck = lastReminder
            ? Math.max(0, daysSinceReminder! * 5)
            : 0;
          const score = 50 * wm * proximityFactor(due) * tierW + stuck;
          const reminderText =
            daysSinceReminder != null
              ? `last sent ${daysSinceReminder}d ago`
              : "not yet requested";
          items.push({
            id: `mode_b-${ci.id}`,
            source: "mode_b_reminder_due",
            verb: "Send",
            client: client.name,
            clientId: client.id,
            task: task.formType,
            taskId: task.id,
            dueDate: due,
            action: `Send reminder · ${ci.label}`,
            context: `${reminderText}${lastReminder ? " · draft ready" : ""}`,
            stageLabel: "Collect",
            daysBehind:
              daysSinceReminder != null && daysSinceReminder > 7
                ? daysSinceReminder
                : undefined,
            urgency: urgencyBucket(score),
            urgencyScore: Math.round(score),
            surface: "email_draft_modal",
          });
        }
      }

      // Source 6: Mode F alert — active firm announcements.
      const activeAlerts = announcements.filter(
        (a) => !a.dismissed && (a.affectedClientIds?.length ?? 0) > 0,
      );
      for (const a of activeAlerts.slice(0, 8)) {
        const matchCount = a.affectedClientIds.length;
        const score = 100 * (matchCount > 5 ? 1.5 : 1.0);
        items.push({
          id: `mode_f-${a.id}`,
          source: "mode_f_alert",
          verb: "Apply",
          client: matchCount === 1 ? "1 client" : `${matchCount} clients`,
          clientId: "",
          action: `Apply ${a.title}`,
          context: `${a.stateCode}: ${a.summary?.slice(0, 80) ?? ""} · matched on ${matchCount} client${matchCount === 1 ? "" : "s"}`,
          urgency: urgencyBucket(score),
          urgencyScore: Math.round(score),
          surface: "alert_detail",
        });
      }

      items.sort((a, b) => b.urgencyScore - a.urgencyScore);
      return {
        items: items.slice(0, limit),
        total: items.length,
        sourcesPending: [
          "reply_pushback",
          "reply_question",
          "delivery_bounce",
          "mode_d_draft_ready",
          "mode_e_opportunity",
        ],
      };
    },
  },

  // taskMilestones — mock simulates Mode B target_date proposals so the FE
  // round-trip works in mock mode. proposeForTask synthesizes 5 substrate-
  // default milestones (per PRD §4.2 cold-start: -90/-60/-21/-7/0 days from
  // due_date) and stashes them in mockMilestoneStore so subsequent listForTask
  // calls return them. Real wiring happens against the backend when
  // VITE_USE_MOCK_API=false — the BE calls predictMilestoneTargetDates.
  taskMilestones: {
    listForTask: async (input: { taskId: string }) => {
      await delay();
      return mockMilestoneStore.get(input.taskId) ?? [];
    },
    fleetStack: async (_input?: { waitingOnly?: boolean; limit?: number }) => {
      await delay();
      // Flatten everything we've synthesized so far for the cross-client view
      return Array.from(mockMilestoneStore.values()).flat();
    },
    detectBlockers: async (input: { taskId: string }) => {
      await delay(400);
      const existing = mockMilestoneStore.get(input.taskId) ?? [];
      if (existing.length === 0) {
        return { decisions: [], appliedCount: 0 };
      }
      // Heuristic-only mock: block any not-done milestone whose target_date
      // is in the past. Mirrors the backend heuristic fallback so dev
      // demos see meaningful Mode E behavior without an API key.
      const todayMs = Date.now();
      let appliedCount = 0;
      const decisions = existing.map((m) => {
        if (m.status === "done") {
          return {
            milestoneId: m.id,
            shouldBlock: false,
            blockerReason: "",
            confidence: "high" as const,
          };
        }
        if (m.targetDate && new Date(m.targetDate).getTime() < todayMs) {
          const daysLate = Math.round(
            (todayMs - new Date(m.targetDate).getTime()) /
              (24 * 60 * 60 * 1000),
          );
          // Apply the block to the in-memory store so listForTask reflects it
          if (m.status !== "blocked") {
            m.status = "blocked";
            m.blockerReason = `target was ${daysLate}d ago; status still ${m.status}`;
            appliedCount++;
          }
          return {
            milestoneId: m.id,
            shouldBlock: true,
            blockerReason: `target was ${daysLate}d ago`,
            confidence: "high" as const,
          };
        }
        return {
          milestoneId: m.id,
          shouldBlock: false,
          blockerReason: "",
          confidence: "low" as const,
        };
      });
      return { decisions, appliedCount };
    },
    proposeForTask: async (input: { taskId: string }) => {
      await delay();
      const existing = mockMilestoneStore.get(input.taskId);
      if (existing && existing.length > 0) {
        return { proposed: false, milestones: existing };
      }
      // Synthesize 5 substrate milestones from the task's due date if known.
      // The mock store doesn't have task data; default to ~April 15 of next
      // year as a reasonable filing-due anchor for demo purposes. Real BE
      // looks up officialDueDate from the deadline row.
      const due = nextApril15();
      const offsetDays = (days: number) => {
        const d = new Date(due);
        d.setDate(d.getDate() - days);
        return d.toISOString().slice(0, 10);
      };
      const stages = [
        { type: "initial_meeting", offset: 90 },
        { type: "collect_materials", offset: 60 },
        { type: "prepare_workpapers", offset: 21 },
        { type: "internal_review", offset: 7 },
        { type: "file", offset: 0 },
      ] as const;
      const synthesized = stages.map((s, idx) => ({
        id: `mock-mil-${input.taskId}-${idx}`,
        firmId: "mock-firm",
        taskId: input.taskId,
        milestoneType: s.type,
        customLabel: null,
        targetDate: s.offset === 0 ? due : offsetDays(s.offset),
        completedDate: null,
        status: "not_started" as const,
        blockerReason: null,
        displayOrder: idx,
        proposedBy: "ai" as const,
      }));
      mockMilestoneStore.set(input.taskId, synthesized);
      return {
        proposed: true,
        milestones: synthesized,
        overallConfidence: "low" as const,
        basisOfEstimate:
          "mock substrate (PRD §4.2 cold-start defaults — no firm history)",
      };
    },
    update: async (_input: unknown) => {
      await delay();
      return {} as unknown;
    },
    add: async (_input: unknown) => {
      await delay();
      return {} as unknown;
    },
  },

  // inboundReplies — mock returns empty by default; the static frontend
  // mock in Mail.tsx covers the design-review-quality variety until real
  // backend traffic flows.
  inboundReplies: {
    list: async (
      input?: {
        taskId?: string;
        topLevelClass?: string;
        replyIntent?: string;
        limit?: number;
      },
    ) => {
      await delay();
      const params = input ?? {};
      const rows = mockInboundReplies.filter((r) => {
        if (r.cpaActionedAt) return false;
        if (params.taskId && r.taskId !== params.taskId) return false;
        if (params.topLevelClass && r.topLevelClass !== params.topLevelClass)
          return false;
        if (params.replyIntent && r.replyIntent !== params.replyIntent)
          return false;
        return true;
      });
      return params.limit ? rows.slice(0, params.limit) : rows;
    },
    markActioned: async (input: { id: string }) => {
      await delay();
      const row = mockInboundReplies.find((r) => r.id === input.id);
      if (!row) throw new Error("not_found");
      row.cpaActionedAt = new Date().toISOString();
      return row as unknown;
    },
    linkToTask: async (input: { id: string; taskId: string }) => {
      await delay();
      const row = mockInboundReplies.find((r) => r.id === input.id);
      if (!row) throw new Error("not_found");
      row.taskId = input.taskId;
      return row as unknown;
    },
  },

  // deliveryEvents — mock returns empty issues queue. Mail.tsx Issues tab
  // shows static mock until SES/Postmark/Resend webhooks fire real events.
  deliveryEvents: {
    issues: async (_input?: { limit?: number }) => {
      await delay();
      return [] as unknown[];
    },
    forDraft: async (_input: { emailDraftId: string }) => {
      await delay();
      return [] as unknown[];
    },
    suppressEvent: async (_input: { id: number }) => {
      await delay();
      return null as unknown;
    },
  },

  // modeFHealth — IA v0.7 §3.9d. State-monitoring's own monitoring.
  modeFHealth: {
    status: async (): Promise<{
      overall: "green" | "amber" | "red";
      total: number;
      stale: number;
      lastSyncMinAgo: number | null;
      nextSyncInMin: number;
      perState: Array<{
        code: string;
        label: string;
        staleHours: number;
        status: string;
      }>;
      perStateIllustrative: boolean;
    }> => {
      await delay();
      // Per-state breakdown is illustrative until backend exposes
      // last_scraped_at (Phase 3 follow-up).
      const perState = [
        { code: "NY", label: "New York", staleHours: 4, status: "stale_short" },
        { code: "TX", label: "Texas", staleHours: 12, status: "stale_short" },
        {
          code: "CA",
          label: "California",
          staleHours: 28,
          status: "rescrape_running",
        },
      ];
      const longStale = perState.filter((s) => s.staleHours > 24).length;
      const overall =
        longStale > 0 ? "red" : perState.length > 0 ? "amber" : "green";
      return {
        overall,
        total: 50,
        stale: perState.length,
        lastSyncMinAgo: 14,
        nextSyncInMin: 16,
        perState,
        perStateIllustrative: true,
      };
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
      // Backend signature: { id }. Mock pulls affected clients +
      // newDeadline from the announcement so the call site matches the
      // real-mode tRPC contract.
      id?: string;
      // Legacy direct signature still supported for older callers
      // (BatchNotifyModal, AnnouncementDetail) until they migrate to
      // useBatchAdjustFromAnnouncement.
      clientIds?: string[];
      oldDate?: string;
      newDate?: string;
      announcementTitle?: string;
    }) => {
      await delay(200);
      if (input.id && !input.clientIds) {
        const a = getState().announcements.find((x) => x.id === input.id);
        if (!a || !a.newDeadline) {
          return { ok: true as const, deadlinesUpdated: 0 };
        }
        actions.batchAdjustDeadlines(
          a.affectedClientIds,
          a.oldDeadline ?? "",
          a.newDeadline,
          a.title,
        );
        actions.markAnnouncementRead(a.id);
        return {
          ok: true as const,
          deadlinesUpdated: a.affectedClientIds.length,
        };
      }
      if (input.clientIds && input.oldDate && input.newDate) {
        actions.batchAdjustDeadlines(
          input.clientIds,
          input.oldDate,
          input.newDate,
          input.announcementTitle,
        );
      }
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
    sendBulletinEmails: async (input: {
      announcementId: string;
      recipients: Array<{ clientId: string; subject: string; body: string }>;
    }) => {
      await delay(300);
      const sent: Array<{ clientId: string; draftId: string }> = [];
      const skipped: Array<{ clientId: string; reason: string }> = [];
      const { clients, tasks } = getState();
      const clientById = new Map(clients.map((c) => [c.id, c]));
      const taskByClient = new Map<string, string>();
      for (const t of tasks) {
        if (!taskByClient.has(t.clientId)) taskByClient.set(t.clientId, t.id);
      }
      for (const r of input.recipients) {
        const c = clientById.get(r.clientId);
        if (!c) {
          skipped.push({ clientId: r.clientId, reason: "client_not_in_firm" });
          continue;
        }
        if (!c.contactEmail) {
          skipped.push({ clientId: r.clientId, reason: "no_email" });
          continue;
        }
        const taskId = taskByClient.get(r.clientId);
        if (!taskId) {
          skipped.push({ clientId: r.clientId, reason: "no_task" });
          continue;
        }
        const id = actions.saveEmailDraft({
          taskId,
          clientId: r.clientId,
          to: c.contactEmail,
          cc: "",
          subject: r.subject,
          body: r.body,
          tone: "formal",
          aiSources: [
            {
              kind: "substrate",
              note: `state announcement ${input.announcementId}`,
            },
          ],
          status: "draft",
          sendMethod: "cpa_send",
        });
        actions.sendEmail(id);
        sent.push({ clientId: r.clientId, draftId: id });
      }
      return {
        sentCount: sent.length,
        skippedCount: skipped.length,
        sent,
        skipped,
      };
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
      // Mock returns above-threshold confidence so the commit button is
      // exercisable end-to-end in mock mode (real LLM extraction varies).
      return {
        fields: {
          clientName: "Mitchell Demo Client",
          ein: "12-3456789",
          entityType,
          taxYear: 2024,
          priorAGI: 145000,
          formsFiled: ["1040", "Schedule C", "Schedule E"],
          k1Sources: ["Apex Fund LP"],
          confidence: 0.82,
        },
        readyForCommit: true,
      };
    },
    /** Mock commit — synthesizes inserted-fact-row counts so the FE round-
     *  trip works in mock mode. Real BE inserts into imported_facts. */
    commitPriorYearReturn: async (input: {
      clientId: string;
      taxYear: number;
      fields: {
        priorAGI?: number | null;
        formsFiled?: string[];
        k1Sources?: string[];
        entityType?: string | null;
        ein?: string | null;
      };
    }) => {
      await delay();
      const factTypes: string[] = [];
      if (input.fields.priorAGI != null) factTypes.push("prior_agi");
      if (input.fields.formsFiled && input.fields.formsFiled.length > 0)
        factTypes.push("forms_filed");
      if (input.fields.k1Sources && input.fields.k1Sources.length > 0)
        factTypes.push("k1_sources");
      if (input.fields.entityType) factTypes.push("entity_type");
      if (input.fields.ein) factTypes.push("ein");
      return { inserted: factTypes.length, factTypes };
    },
    /** Cross-fact consistency — mock returns one illustrative flag per
     *  client (when clientId provided) so the AiInsightsPanel surface
     *  renders meaningfully in mock mode. Real BE walks imported_facts
     *  and flags actual discrepancies. */
    factConsistency: async (input?: { clientId?: string }) => {
      await delay();
      if (!input?.clientId) return { flags: [] };
      // Hash the clientId so different clients show different flag types
      // in mock — variety for design review.
      const hash = Array.from(input.clientId).reduce(
        (h, c) => (h * 31 + c.charCodeAt(0)) | 0,
        0,
      );
      const m = Math.abs(hash) % 4;
      // 1 in 4 mock clients shows no flags (the healthy case).
      if (m === 0) return { flags: [] };
      const flag =
        m === 1
          ? {
              clientId: input.clientId,
              taxYear: 2024,
              factType: "prior_agi",
              severity: "medium" as const,
              reason:
                "prior_agi spreads 12% across sources ($142,000 → $159,000)",
              values: [
                {
                  factId: 1001,
                  value: 142000,
                  sourceGmailMessageId: "gm-1040-pdf-2024",
                  extractionVersion: "v1",
                  confidence: "high",
                },
                {
                  factId: 1002,
                  value: 159000,
                  sourceGmailMessageId: "gm-irs-transcript-2024",
                  extractionVersion: "v1",
                  confidence: "medium",
                },
              ],
            }
          : m === 2
            ? {
                clientId: input.clientId,
                taxYear: 2023,
                factType: "forms_filed",
                severity: "medium" as const,
                reason: "forms_filed: 1 item present in some sources but not others",
                values: [
                  {
                    factId: 2001,
                    value: ["1040", "Schedule C", "Schedule E"],
                    sourceGmailMessageId: "gm-1040-pdf-2023",
                    extractionVersion: "v1",
                    confidence: "high",
                  },
                  {
                    factId: 2002,
                    value: ["1040", "Schedule C"],
                    sourceGmailMessageId: "gm-summary-2023",
                    extractionVersion: "v1",
                    confidence: "medium",
                  },
                ],
              }
            : {
                clientId: input.clientId,
                taxYear: 2024,
                factType: "entity_type",
                severity: "high" as const,
                reason: "entity_type extracted as 2 different values across sources",
                values: [
                  {
                    factId: 3001,
                    value: "S-Corp",
                    sourceGmailMessageId: "gm-articles-2024",
                    extractionVersion: "v1",
                    confidence: "high",
                  },
                  {
                    factId: 3002,
                    value: "LLC",
                    sourceGmailMessageId: "gm-1120s-cover-2024",
                    extractionVersion: "v1",
                    confidence: "medium",
                  },
                ],
              };
      return { flags: [flag] };
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
    list: async () => {
      await delay();
      // Mock past-exports for design preview. Real BE reads from
      // export_runs table — see backend/src/trpc/routers/exports.ts.
      const now = Date.now();
      const mk = (offsetHours: number, kind: string, status: "queued" | "ready" | "failed") => ({
        id: `mock-exp-${offsetHours}`,
        kind,
        status,
        downloadUrl:
          status === "ready"
            ? `data:text/csv;base64,bW9jay1leHBvcnQ=`
            : null,
        errorMessage:
          status === "failed" ? "Mock failure: simulated network error" : null,
        requestedAt: new Date(now - offsetHours * 60 * 60 * 1000).toISOString(),
        completedAt:
          status === "ready"
            ? new Date(now - offsetHours * 60 * 60 * 1000 + 5_000).toISOString()
            : null,
        createdAt: new Date(now - offsetHours * 60 * 60 * 1000).toISOString(),
      });
      return [
        mk(0.5, "clients_csv", "ready"),
        mk(8, "audit_trail_pdf", "ready"),
        mk(72, "clients_csv", "ready"),
        mk(168, "deadlines_csv", "failed"),
      ];
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
    list: async (
      input?: {
        limit?: number;
        beforeCreatedAt?: string;
        eventType?: string;
        clientId?: string;
      },
    ) => {
      await delay();
      const { clients, tasks, deadlines } = getState();
      const params = input ?? {};
      const limit = params.limit ?? 100;
      // Flatten every client's activity into one ordered feed, joining
      // task formType + jurisdiction so the FE can render the "X · Y" line
      // without follow-up lookups (mirrors the BE's join shape).
      const all: Array<{
        id: number;
        firmId: string;
        taskId: string;
        eventType: string;
        actorKind: "user" | "system" | "ai" | "client";
        actorUserId: string | null;
        description: string;
        payload: unknown;
        relatedChecklistItemId: string | null;
        relatedEmailDraftId: string | null;
        createdAt: Date;
        clientId: string;
        clientName: string;
        taskFormType: string;
        taskJurisdiction: string;
      }> = [];
      for (const c of clients) {
        // ActivityEntry on the FE store is keyed differently from the BE
        // row. Map: type → eventType, summary → description, timestamp →
        // createdAt. The store doesn't carry payload / actor metadata so
        // those fall back to neutral defaults.
        const activity = (c as unknown as { activity?: ActivityEntry[] }).activity;
        if (!activity) continue;
        for (const a of activity) {
          if (params.clientId && c.id !== params.clientId) continue;
          if (params.eventType && a.type !== params.eventType) continue;
          const dl = a.relatedDeadlineId
            ? deadlines.find((d) => d.id === a.relatedDeadlineId)
            : undefined;
          const task = dl ? tasks.find((t) => t.deadlineId === dl.id) : undefined;
          if (!task) continue;
          all.push({
            id: 0,
            firmId: "mock-firm",
            taskId: task.id,
            eventType: a.type,
            actorKind: "user",
            actorUserId: null,
            description: a.summary,
            payload: {},
            relatedChecklistItemId: null,
            relatedEmailDraftId: null,
            createdAt: new Date(a.timestamp),
            clientId: c.id,
            clientName: c.name,
            taskFormType: dl?.form ?? "",
            taskJurisdiction: dl?.jurisdiction ?? "",
          });
        }
      }
      all.sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
      let filtered = all;
      if (params.beforeCreatedAt) {
        const cutoff = new Date(params.beforeCreatedAt).getTime();
        filtered = filtered.filter((r) => r.createdAt.getTime() < cutoff);
      }
      const items = filtered.slice(0, limit);
      const hasMore = filtered.length > limit;
      const nextCursor = hasMore
        ? items[items.length - 1]?.createdAt.toISOString() ?? null
        : null;
      return { items, nextCursor };
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
        p50LatencyMs: 850,
        p95LatencyMs: 2400,
      };
    },
    /** Multi-mode overview mock — 6 modes with realistic-shape data. Mode A
     *  (classify) has highest volume; Mode F (state alerts) has lowest. */
    summaryAll: async () => {
      await delay();
      // Hand-tuned shape so the all-modes table looks realistic in demos.
      // A = highest volume (every inbound email); D = high volume (every
      // chase draft); B/C/E = mid; F = low (handful of state announcements).
      return [
        { mode: "A" as const, total: 612, actedOn: 588, accepted: 547, acceptanceRate: 547 / 588, totalCostCents: 122.4, p50LatencyMs: 720, p95LatencyMs: 2100 },
        { mode: "B" as const, total: 89, actedOn: 71, accepted: 64, acceptanceRate: 64 / 71, totalCostCents: 17.8, p50LatencyMs: 880, p95LatencyMs: 2600 },
        { mode: "C" as const, total: 34, actedOn: 22, accepted: 19, acceptanceRate: 19 / 22, totalCostCents: 6.8, p50LatencyMs: 950, p95LatencyMs: 3100 },
        { mode: "D" as const, total: 198, actedOn: 174, accepted: 155, acceptanceRate: 155 / 174, totalCostCents: 297.0, p50LatencyMs: 1400, p95LatencyMs: 4200 },
        { mode: "E" as const, total: 42, actedOn: 28, accepted: 22, acceptanceRate: 22 / 28, totalCostCents: 12.6, p50LatencyMs: 1100, p95LatencyMs: 3500 },
        { mode: "F" as const, total: 11, actedOn: 8, accepted: 8, acceptanceRate: 1.0, totalCostCents: 4.4, p50LatencyMs: 1850, p95LatencyMs: 5200 },
      ];
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

  // Federal forms catalog — mock substitute for the BE's federal_forms
  // table. Trimmed to the most common ~15 forms; the FE consumers
  // (AddDeadlineModal, FilingsTab) treat this as authoritative when
  // env.useMockData is on.
  federalForms: {
    list: async (
      input?: {
        search?: string;
        entityType?: string;
        category?: string;
        frequency?: string;
        status?: string[];
        includePendingReview?: boolean;
      },
    ) => {
      await delay();
      const all = MOCK_FEDERAL_FORMS;
      const allowed = new Set<string>(
        input?.status ??
          (input?.includePendingReview
            ? ["active", "pending_review"]
            : ["active"]),
      );
      const search = input?.search?.toLowerCase() ?? "";
      return all.filter((f) => {
        if (!allowed.has(f.status)) return false;
        if (input?.entityType && !f.entityTypes.includes(input.entityType))
          return false;
        if (input?.category && f.category !== input.category) return false;
        if (input?.frequency && f.frequency !== input.frequency) return false;
        if (search) {
          const hay = `${f.formNumber} ${f.formName} ${f.notes ?? ""}`
            .toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });
    },
    getByFormNumber: async ({ formNumber }: { formNumber: string }) => {
      await delay();
      const cleaned = formNumber.trim().toUpperCase();
      return MOCK_FEDERAL_FORMS.find((f) => f.formNumber === cleaned) ?? null;
    },
    applicabilityForClient: async ({ clientId }: { clientId: string }) => {
      await delay();
      const { clients } = getState();
      const client = clients.find((c) => c.id === clientId);
      const entityType = client?.entityType ?? "Individual";
      const primaryState = client?.primaryState ?? "CA";
      const CATEGORY_RANK: Record<string, number> = {
        income: 0,
        estimated: 1,
        payroll: 2,
        info_return: 3,
        nonprofit: 4,
        excise: 5,
        estate_gift: 6,
        international: 7,
        other: 8,
        extension: 9,
        amendment: 10,
      };
      const forms = MOCK_FEDERAL_FORMS.filter(
        (f) => f.status === "active" && f.entityTypes.includes(entityType),
      )
        .map((form) => {
          const exactMatch = form.entityTypes.length <= 2;
          const isCurated = form.extractionMethod === "curated";
          const confidence: "high" | "medium" =
            exactMatch && isCurated ? "high" : "medium";
          return {
            form,
            confidence,
            reason: isCurated
              ? `Curated catalog · ${entityType} listed in entity_types`
              : `LLM-extracted (${(form.confidenceScore * 100).toFixed(0)}% confidence)`,
          };
        })
        .sort((a, b) => {
          const ra = CATEGORY_RANK[a.form.category] ?? 99;
          const rb = CATEGORY_RANK[b.form.category] ?? 99;
          if (ra !== rb) return ra - rb;
          return a.form.formNumber.localeCompare(b.form.formNumber);
        });
      return {
        clientId: clientId,
        entityType,
        primaryState,
        forms,
      };
    },
    extractFromLlm: async ({
      formNumber,
      hint,
    }: {
      formNumber: string;
      hint?: string;
    }) => {
      await delay(300);
      const cleaned = formNumber.trim().toUpperCase();
      const existing = MOCK_FEDERAL_FORMS.find(
        (f) => f.formNumber === cleaned,
      );
      if (existing) {
        return {
          form: existing,
          created: false,
          llmCalled: false,
          confidence: existing.confidenceScore,
          needsReview: existing.status === "pending_review",
        };
      }
      const synthesized = {
        id: `mock-llm-${cleaned}`,
        formNumber: cleaned,
        formName: hint?.slice(0, 200) ?? `Form ${cleaned}`,
        category: "other",
        entityTypes: [] as string[],
        frequency: "annual",
        dueDateRule: null,
        notes:
          "Mock LLM extraction. Real backend would populate this from Claude.",
        irsUrl: null,
        extractionMethod: "llm" as const,
        confidenceScore: 0.4,
        status: "pending_review" as const,
        lastVerifiedAt: null,
        lastChangeCheckAt: null,
      };
      return {
        form: synthesized,
        created: true,
        llmCalled: true,
        confidence: 0.4,
        needsReview: true,
      };
    },
    recentChanges: async (input?: {
      limit?: number;
      includeReviewed?: boolean;
    }) => {
      await delay();
      // Sample mock events so the SettingsFederalFormsPanel has data to
      // render in MOCK mode. Real BE writes these from federal-register-
      // poller. Each row mirrors backend/src/trpc/routers/federalForms.ts
      // recentChanges projection.
      const allEvents: Array<{
        eventId: number;
        changeKind: string;
        summary: string;
        createdAt: string;
        reviewedAt: string | null;
        appliedAt: string | null;
        form: { id: string; formNumber: string; formName: string };
        notice: {
          id: string;
          documentNumber: string;
          title: string;
          publicationDate: string;
          htmlUrl: string;
          parseConfidence: string;
        };
      }> = [
        {
          eventId: 1,
          changeKind: "instructions_update",
          summary:
            "Form 941 instructions clarify Q1 deposit reconciliation rules — see updated §3.2.",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          reviewedAt: null,
          appliedAt: null,
          form: { id: "f941", formNumber: "941", formName: "Employer's Quarterly Federal Tax Return" },
          notice: {
            id: "n-fr-2026-12345",
            documentNumber: "2026-12345",
            title: "Updated Instructions for Form 941 — Q1 2026 deposit clarifications",
            publicationDate: "2026-04-29",
            htmlUrl: "https://www.federalregister.gov/documents/2026/04/29/2026-12345",
            parseConfidence: "high",
          },
        },
        {
          eventId: 2,
          changeKind: "form_revision",
          summary:
            "Schedule K-3 reporting requirements expanded — partner-level detail now required for all foreign-source income.",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          reviewedAt: null,
          appliedAt: null,
          form: {
            id: "fk3",
            formNumber: "Schedule K-3",
            formName: "Partner's Share of Income, Deductions, Credits — International",
          },
          notice: {
            id: "n-fr-2026-11890",
            documentNumber: "2026-11890",
            title: "Final Rule — Schedule K-3 partner-level reporting expansion",
            publicationDate: "2026-04-25",
            htmlUrl: "https://www.federalregister.gov/documents/2026/04/25/2026-11890",
            parseConfidence: "medium",
          },
        },
        {
          eventId: 3,
          changeKind: "due_date_change",
          summary:
            "Form 1099-K transactional threshold delayed: $5K minimum (was $600) for 2024 reporting.",
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          appliedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          form: { id: "f1099k", formNumber: "1099-K", formName: "Payment Card and Third Party Network Transactions" },
          notice: {
            id: "n-fr-2026-09001",
            documentNumber: "2026-09001",
            title: "Notice 2024-85 — 1099-K transition relief for 2024",
            publicationDate: "2026-04-22",
            htmlUrl: "https://www.federalregister.gov/documents/2026/04/22/2026-09001",
            parseConfidence: "high",
          },
        },
        {
          eventId: 4,
          changeKind: "other",
          summary:
            "E-file mandate threshold lowered to 10 returns — affects payroll and information-return filers.",
          createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          reviewedAt: null,
          appliedAt: null,
          form: { id: "f8508", formNumber: "8508", formName: "Application for a Waiver from Electronic Filing of Information Returns" },
          notice: {
            id: "n-fr-2026-07770",
            documentNumber: "2026-07770",
            title: "Final Rule — Section 6011(e) e-file threshold change",
            publicationDate: "2026-04-19",
            htmlUrl: "https://www.federalregister.gov/documents/2026/04/19/2026-07770",
            parseConfidence: "low",
          },
        },
      ];
      const limit = input?.limit ?? 50;
      return allEvents
        .filter((e) => input?.includeReviewed || !e.reviewedAt)
        .slice(0, limit);
    },
    markChangeReviewed: async () => {
      await delay();
      return { ok: true as const };
    },
    applyChangeEvent: async (input: {
      eventId: number;
      userOverrides?: Record<string, unknown>;
    }) => {
      await delay();
      console.info("[mock] federalForms.applyChangeEvent", input);
      return {
        applied: true as const,
        appliedAt: new Date().toISOString(),
        fieldsApplied: input.userOverrides
          ? Object.keys(input.userOverrides)
          : ["notes"],
      };
    },
    rejectChangeEvent: async (input: { eventId: number; reason: string }) => {
      await delay();
      console.info("[mock] federalForms.rejectChangeEvent", input);
      return {
        rejected: true as const,
        rejectedAt: new Date().toISOString(),
      };
    },
    acknowledgeChangeEvent: async (input: { eventId: number }) => {
      await delay();
      console.info("[mock] federalForms.acknowledgeChangeEvent", input);
      return { ok: true as const };
    },
    pollNow: async () => {
      await delay(200);
      return {
        fetched: 0,
        inserted: 0,
        changeEvents: 0,
        lowConfidence: 0,
        duplicatesSkipped: 0,
      };
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

  /**
   * alertActions — mocks for the 5 non-disaster alert variant procedures.
   * V1 mocks log to console + return realistic-shape responses; they do
   * NOT mutate any persisted store. The flash banner on AnnouncementDetail
   * shows "X clients tagged" / "X estimates recomputed" etc — sufficient
   * for design demos. Real DB writes happen in production once migration
   * 0007 is deployed and the BE handlers replace these mocks.
   */
  alertActions: {
    // ─── penalty_relief ──────────────────────────────────────────────────
    tagClientsForRelief: async (input: {
      announcementId: string;
      clientIds: string[];
      expiresAt: string | null;
    }) => {
      await delay();
      console.info("[mock] alertActions.tagClientsForRelief", input);
      return {
        taggedCount: input.clientIds.length,
        duplicateCount: 0,
        failedCount: 0,
      };
    },
    markTagApplied: async (input: { tagId: string; taskId?: string }) => {
      await delay();
      console.info("[mock] alertActions.markTagApplied", input);
      return { ok: true as const, appliedAt: new Date().toISOString() };
    },
    untag: async (input: { tagId: string; reason: string }) => {
      await delay();
      console.info("[mock] alertActions.untag", input);
      return { ok: true as const };
    },

    // ─── pte_change ──────────────────────────────────────────────────────
    schedulePlanningCalls: async (input: {
      announcementId: string;
      clientIds: string[];
      suggestedWindow: "this_week" | "next_2_weeks" | "before_deadline";
    }) => {
      await delay();
      console.info("[mock] alertActions.schedulePlanningCalls", input);
      return {
        callsCreated: input.clientIds.length,
        // Mocked count of "schedule call with X" TodoItems on Today.
        // Real BE will fan out via the todoItems router once it exposes
        // a public `create` mutation.
        todoItemsAdded: input.clientIds.length,
      };
    },
    markPlanningCallCompleted: async (input: {
      callId: string;
      outcome:
        | "renewed"
        | "revoked"
        | "opted_in"
        | "deferred"
        | "no_change";
      notes?: string;
    }) => {
      await delay();
      console.info("[mock] alertActions.markPlanningCallCompleted", input);
      return { ok: true as const };
    },

    // ─── rate_change ─────────────────────────────────────────────────────
    recomputeEstimates: async (input: {
      announcementId: string;
      selections: Array<{
        deadlineId: string;
        overrideAmountCents?: number;
      }>;
      ruleJurisdiction: "federal" | "CA" | "NY" | "NJ" | "MA" | "IL" | "AZ";
      ruleTaxYear: number;
    }) => {
      await delay(200);
      console.info("[mock] alertActions.recomputeEstimates", input);
      return {
        recomputedCount: input.selections.length,
        // Stub: roughly 33% of clients flagged as auto-pay (matches the
        // mock heuristic in RecomputeEstimatesModal).
        bankUpdateTodos: Math.ceil(input.selections.length / 3),
        undoToken: `undo_mock_${Date.now()}`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };
    },
    undoRecomputeEstimates: async (input: { undoToken: string }) => {
      await delay();
      console.info("[mock] alertActions.undoRecomputeEstimates", input);
      return { restoredCount: 0 };
    },

    // ─── nexus_change ────────────────────────────────────────────────────
    getNexusQuestionnaire: async (input: {
      state: string;
      nexusKind: "sales" | "income" | "payroll" | "franchise";
    }) => {
      await delay();
      // Mock returns the PA sales questionnaire regardless of input — the
      // real BE reads from per-state config in nexus-rules.ts. The FE
      // NexusCheckModal is built to render whatever shape comes back, so
      // this stub is enough for demo.
      console.info("[mock] alertActions.getNexusQuestionnaire", input);
      return {
        state: input.state,
        nexusKind: input.nexusKind,
        thresholdSummary:
          "Economic nexus: $100K in PA sales OR 200 separate PA transactions in current or prior calendar year.",
        ruleEffectiveDate: "2026-07-01",
        questions: [
          {
            id: "pa_sales_1",
            text: "Did the client deliver tangible goods to PA addresses in 2025?",
          },
          {
            id: "pa_sales_2",
            text: "Did the client provide services to PA-based customers?",
          },
          {
            id: "pa_sales_3",
            text: "Did the client use a marketplace facilitator (Amazon, Etsy) for PA sales?",
          },
          {
            id: "pa_sales_4",
            text: "Does the client already have a PA sales tax license?",
          },
        ],
        suggestedFilings: [
          {
            formCode: "PA REV-72",
            formName: "Sales tax registration",
            preCheckedOnEstablished: true,
          },
          {
            formCode: "PA-3",
            formName: "Quarterly sales tax remittance",
            preCheckedOnEstablished: true,
          },
          {
            formCode: "PA Corp Tax",
            formName: "Corporate income tax",
            caveat: "verify income nexus separately",
            preCheckedOnEstablished: false,
          },
        ],
      };
    },
    runNexusCheck: async (input: {
      announcementId: string;
      clientId: string;
      state: string;
      nexusKind: "sales" | "income" | "payroll" | "franchise";
      answers: Record<string, boolean>;
    }) => {
      await delay();
      console.info("[mock] alertActions.runNexusCheck", input);
      // Mirror the BE's default heuristic: ≥2 yes-answers = established.
      const yesCount = Object.values(input.answers).filter(Boolean).length;
      const total = Object.keys(input.answers).length;
      let status:
        | "established"
        | "borderline"
        | "confirmed_no_nexus";
      let confidence: "high" | "medium" | "low";
      if (total === 0) {
        status = "confirmed_no_nexus";
        confidence = "low";
      } else if (yesCount >= 2) {
        status = "established";
        confidence = "high";
      } else if (yesCount === 1) {
        status = "borderline";
        confidence = "medium";
      } else {
        status = "confirmed_no_nexus";
        confidence = "high";
      }
      return {
        status,
        confidence,
        reason: `${yesCount} of ${total} signals positive`,
        recommendedFilings:
          status === "established"
            ? [
                {
                  formCode: "PA REV-72",
                  formName: "Sales tax registration",
                  preCheckedOnEstablished: true,
                },
                {
                  formCode: "PA-3",
                  formName: "Quarterly sales tax remittance",
                  preCheckedOnEstablished: true,
                },
              ]
            : [],
      };
    },
    addNexusFilings: async (input: {
      announcementId: string;
      clientId: string;
      state: string;
      filings: Array<{
        formCode: string;
        formName: string;
        dueDate?: string;
      }>;
    }) => {
      await delay();
      console.info("[mock] alertActions.addNexusFilings", input);
      return {
        filingsAdded: input.filings.length,
        clientId: input.clientId,
      };
    },
    markFilingsProtective: async (input: {
      announcementId: string;
      deadlineIds: string[];
      reason: string;
      protectedThroughYear: number;
    }) => {
      await delay();
      console.info("[mock] alertActions.markFilingsProtective", input);
      return {
        markedCount: input.deadlineIds.length,
        protectedThroughYear: input.protectedThroughYear,
      };
    },
  },
} as const;

export type MockAdapter = typeof mockAdapter;

// ─── Mock federal forms catalog ──────────────────────────────────────
// Trimmed to the most common forms — the BE seed has more (see
// backend/src/db/federal-forms-data.ts). Status is always 'active' here;
// real BE has 'pending_review' for low-confidence LLM rows.
type MockFederalForm = {
  id: string;
  formNumber: string;
  formName: string;
  category: string;
  entityTypes: string[];
  frequency: string;
  dueDateRule: unknown;
  notes: string | null;
  irsUrl: string | null;
  extractionMethod: "curated" | "llm" | "federal_register";
  confidenceScore: number;
  status: "active" | "pending_review" | "deprecated";
  lastVerifiedAt: string | null;
  lastChangeCheckAt: string | null;
};

const MOCK_FEDERAL_FORMS: MockFederalForm[] = [
  {
    id: "mock-fed-form-1040",
    formNumber: "1040",
    formName: "U.S. Individual Income Tax Return",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes: "April 15. Extension via Form 4868 to Oct 15; payment still due Apr 15.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1040-es",
    formNumber: "1040-ES",
    formName: "Estimated Tax for Individuals",
    category: "estimated",
    entityTypes: ["Individual"],
    frequency: "quarterly",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 15 },
        { month: 6, day: 15 },
        { month: 9, day: 15 },
        { month: 1, day: 15 },
      ],
    },
    notes: "Quarterly vouchers; Q4 due Jan 15 of the following year.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040-es",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1040-x",
    formNumber: "1040-X",
    formName: "Amended U.S. Individual Income Tax Return",
    category: "amendment",
    entityTypes: ["Individual"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Within 3 years of original return's due date or 2 years of paying tax, whichever is later.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040-x",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1120",
    formNumber: "1120",
    formName: "U.S. Corporation Income Tax Return",
    category: "income",
    entityTypes: ["C-Corp"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes: "April 15 calendar year. Fiscal year: 15th day of 4th month after year-end.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1120",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1120-s",
    formNumber: "1120-S",
    formName: "U.S. Income Tax Return for an S Corporation",
    category: "income",
    entityTypes: ["S-Corp"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes: "March 15 calendar year. K-1s to shareholders due same day.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1120-s",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1065",
    formNumber: "1065",
    formName: "U.S. Return of Partnership Income",
    category: "income",
    entityTypes: ["Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes: "March 15 calendar year. K-1s to partners due same day.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1065",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1041",
    formNumber: "1041",
    formName: "U.S. Income Tax Return for Estates and Trusts",
    category: "income",
    entityTypes: ["Trust"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes: "April 15 calendar year. Fiscal year: 15th day of 4th month after year-end.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1041",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-941",
    formNumber: "941",
    formName: "Employer's Quarterly Federal Tax Return",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "quarterly",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 30 },
        { month: 7, day: 31 },
        { month: 10, day: 31 },
        { month: 1, day: 31 },
      ],
    },
    notes: "Q1 Apr 30, Q2 Jul 31, Q3 Oct 31, Q4 Jan 31. Reports withheld income tax + FICA.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-941",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-940",
    formNumber: "940",
    formName: "Employer's Annual Federal Unemployment (FUTA) Tax Return",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes: "Jan 31 covering prior calendar year. Feb 10 if all FUTA deposits timely.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-940",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-w-2",
    formNumber: "W-2",
    formName: "Wage and Tax Statement",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes: "Jan 31 to employees AND SSA. W-3 transmittal accompanies paper filings.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-w-2",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1099-nec",
    formNumber: "1099-NEC",
    formName: "Nonemployee Compensation",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes: "Jan 31 to recipient AND IRS — no paper-vs-efile split.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-nec",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-1099-misc",
    formNumber: "1099-MISC",
    formName: "Miscellaneous Information",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes: "Recipient by Jan 31. IRS paper Feb 28; e-file Mar 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-misc",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-4868",
    formNumber: "4868",
    formName: "Application for Automatic Extension to File 1040",
    category: "extension",
    entityTypes: ["Individual"],
    frequency: "per_event",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes: "File by original 1040 due date. Pushes filing to Oct 15; does NOT extend payment.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-4868",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-7004",
    formNumber: "7004",
    formName: "Application for Automatic Extension — Business Returns",
    category: "extension",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Trust"],
    frequency: "per_event",
    dueDateRule: null,
    notes: "File by parent return's original due date. Length depends on form.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-7004",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
  {
    id: "mock-fed-form-990",
    formNumber: "990",
    formName: "Return of Organization Exempt From Income Tax",
    category: "nonprofit",
    entityTypes: ["Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    notes: "May 15 calendar year. 6-month extension via Form 8868.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-990",
    extractionMethod: "curated",
    confidenceScore: 1.0,
    status: "active",
    lastVerifiedAt: null,
    lastChangeCheckAt: null,
  },
];
