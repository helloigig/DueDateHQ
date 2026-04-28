import { createHash } from "node:crypto";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "./client";
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
  emailDrafts,
  firms,
  importedFacts,
  integrationConnections,
  notifications,
  reminderTemplates,
  servicePackages,
  serviceTemplates,
  stateAnnouncements,
  tasks,
  users,
} from "./schema";
import { BUNDLES } from "../../src/data/bundles";
import { clients as seedClients } from "../../src/data/mockClients";
import { deadlines as seedDeadlines } from "../../src/data/mockDeadlines";
import { announcements as seedAnnouncements } from "../../src/data/mockAnnouncements";
import { extraNotifications } from "../../src/data/mockNotifications";
import type { Client, Deadline, StateCode } from "../../src/types";

export const DEMO_FIRM_ID = stringToUuid("firm:demo");
export const DEMO_USER_ID = stringToUuid("user:owner");

function stringToUuid(input: string): string {
  const hash = createHash("md5").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(
    12,
    16
  )}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
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

function makeForwardingAlias(clientName: string, form: string) {
  const first = slug(clientName).split("-")[0] ?? "client";
  const token = createHash("md5").update(`${clientName}:${form}`).digest("hex").slice(0, 4);
  return `${first}-${formShort(form)}-${token}`;
}

type ChecklistSeed = {
  label: string;
  itemType: string;
  description?: string;
};

function checklistLibrary(deadline: Deadline, client: Client): ChecklistSeed[] {
  const form = deadline.form.toLowerCase();
  if (form.includes("1040")) {
    return [
      { label: "W-2", itemType: "wage_w2" },
      { label: "1099 series", itemType: "1099_any" },
      { label: "1098 mortgage interest", itemType: "1098" },
      { label: "Schedule E supporting docs", itemType: "schedule_e_support" },
      { label: "K-1", itemType: "k1" },
    ];
  }
  if (form.includes("1065")) {
    return [
      { label: "Partnership books", itemType: "partnership_books" },
      { label: "Partner K-1 detail", itemType: "partnership_k1" },
      { label: "Engagement letter", itemType: "engagement_letter" },
    ];
  }
  if (form.includes("1120-s") || form.includes("100s") || client.entityType === "S-Corp") {
    return [
      { label: "S-Corp books closing", itemType: "scorp_books" },
      { label: "Shareholder distributions", itemType: "scorp_distribution" },
      { label: "Engagement letter", itemType: "engagement_letter" },
    ];
  }
  if (form.includes("1120") || client.entityType === "C-Corp") {
    return [
      { label: "Corporate books", itemType: "corporate_books" },
      { label: "Estimated tax support", itemType: "est_payment" },
      { label: "Engagement letter", itemType: "engagement_letter" },
    ];
  }
  if (form.includes("1041") || client.entityType === "Trust") {
    return [
      { label: "Trust income statements", itemType: "trust_income" },
      { label: "Beneficiary distributions", itemType: "trust_distribution" },
      { label: "Engagement letter", itemType: "engagement_letter" },
    ];
  }
  return [
    { label: "Entity support documents", itemType: "entity_support" },
    { label: "State filing support", itemType: "state_support" },
    { label: "Engagement letter", itemType: "engagement_letter" },
  ];
}

function seededChecklistState(
  deadline: Deadline,
  index: number
): {
  state: string;
  actorKind: "system" | "user" | "ai";
  aiConfidence: string | null;
  aiFlagReason: string | null;
} {
  if (deadline.status === "completed" || deadline.status === "filed_extension") {
    return {
      state: "received_confirmed",
      actorKind: "user",
      aiConfidence: "0.94",
      aiFlagReason: null,
    };
  }
  if (deadline.status === "in_progress") {
    if (index === 0) {
      return {
        state: "received_unreviewed",
        actorKind: "ai",
        aiConfidence: "0.91",
        aiFlagReason: null,
      };
    }
    if (index === 1) {
      return {
        state: "requested_waiting",
        actorKind: "system",
        aiConfidence: null,
        aiFlagReason: null,
      };
    }
  }
  if (deadline.status === "overdue") {
    if (index === 0) {
      return {
        state: "received_issue",
        actorKind: "ai",
        aiConfidence: "0.77",
        aiFlagReason: "Current amount differs materially from prior-year baseline.",
      };
    }
    if (index === 1) {
      return {
        state: "requested_waiting",
        actorKind: "system",
        aiConfidence: null,
        aiFlagReason: null,
      };
    }
  }
  if (index === 0) {
    return {
      state: "requested_waiting",
      actorKind: "system",
      aiConfidence: null,
      aiFlagReason: null,
    };
  }
  return {
    state: "not_requested",
    actorKind: "system",
    aiConfidence: null,
    aiFlagReason: null,
  };
}

const reminderSeed = [
  ["W-2 first request", "wage_w2", "individual_1040", -30, "once"],
  ["W-2 follow-up #1", "wage_w2", "individual_1040", -14, "weekly"],
  ["W-2 follow-up #2 (urgent)", "wage_w2", "individual_1040", -7, "every_3_days"],
  ["1099 series first request", "1099_any", "individual_1040", -30, "once"],
  ["1099 series follow-up", "1099_any", "individual_1040", -14, "weekly"],
  ["K-1 first request", "k1", "individual_1040", -60, "once"],
  ["K-1 status check", "k1", "individual_1040", -21, "biweekly"],
  ["Schedule E supporting docs", "schedule_e_support", "individual_1040", -21, "once"],
  ["Schedule C books", "schedule_c_books", "individual_1040", -30, "once"],
  ["1098 mortgage interest", "1098", "individual_1040", -21, "once"],
  ["Estimated payment reminder", "est_payment", "quarterly", -7, "once"],
  ["Partnership books closing", "partnership_books", "partnership_1065", -45, "once"],
  ["Partner K-1 distribution prep", "partnership_k1", "partnership_1065", -21, "once"],
  ["S-Corp books closing", "scorp_books", "scorp_1120s", -45, "once"],
  ["S-Corp shareholder distribution", "scorp_distribution", "scorp_1120s", -21, "once"],
  ["Sales tax monthly", "sales_tax", "sales_tax_monthly", -7, "once"],
  ["Year-end planning request", "yep_documents", "individual_1040", -60, "once"],
  ["Engagement letter (annual)", "engagement_letter", "annual_renewal", -90, "once"],
] as const;

async function seedReminderTemplates() {
  for (const [name, itemTypeFilter, deadlineClassFilter, triggerOffsetDays, cadence] of reminderSeed) {
    await db.insert(reminderTemplates).values({
      id: stringToUuid(`template:${name}`),
      firmId: null,
      name,
      itemTypeFilter,
      deadlineClassFilter,
      triggerOffsetDays,
      cadence,
      subjectTemplate: `${name} · {{client_name}}`,
      bodyTemplate:
        "Hi {{client_name}},\n\nWe're following up on {{item_label}} for {{deadline_form}} due {{deadline_date}}.\n\nPlease reply with the material when ready.\n\n{{cpa_name}}\n{{firm_name}}",
      defaultTone: "formal",
      automationPhase: "phase_1",
      isSystem: true,
      createdAt: new Date("2026-04-20T09:00:00Z"),
    });
  }
}

async function seedServicePackages() {
  for (const bundle of BUNDLES) {
    const packageId = stringToUuid(`package:${bundle.id}`);
    await db.insert(servicePackages).values({
      id: packageId,
      firmId: null,
      name: bundle.name,
      description: bundle.description,
      applicableEntityTypes: bundle.entityTypes,
      applicableStates: null,
      isSystem: true,
      createdAt: new Date("2026-04-20T09:00:00Z"),
    });
    for (let index = 0; index < bundle.templates.length; index += 1) {
      const template = bundle.templates[index];
      await db.insert(serviceTemplates).values({
        id: stringToUuid(`service-template:${bundle.id}:${index}`),
        packageId,
        formType: template.form,
        jurisdiction: template.jurisdiction,
        dueDateRule: { month: template.month, day: template.day, currentYear: !!template.currentYear },
        rolloverRule: { source: "bundle" },
        defaultReminderSchedule: { cadence: "once" },
        dependencies: {},
        standardChecklist: checklistLibrary(
          {
            id: "seed",
            clientId: "seed",
            form: template.form,
            jurisdiction: template.jurisdiction === "primary" ? "CA" : template.jurisdiction === "nexus" ? "CA" : "federal",
            officialDueDate: "2026-04-15",
            status: "not_started",
          } as Deadline,
          {
            id: "seed",
            name: "Seed",
            entityType: bundle.entityTypes[0],
            primaryState: "CA" as StateCode,
            nexusStates: [],
            contactEmail: "",
            status: "active",
            addedAt: "2026-01-01",
            servicePackages: [],
          } as Client
        ),
      });
    }
  }
}

function findBundleIdByName(name: string): string | null {
  const bundle = BUNDLES.find((item) => item.name === name);
  return bundle ? stringToUuid(`package:${bundle.id}`) : null;
}

export async function seedDatabase() {
  const existing = await db.select({ value: count() }).from(firms);
  if ((existing[0]?.value ?? 0) > 0) return;

  const now = new Date("2026-04-23T11:00:00Z");

  await db.insert(firms).values({
    id: DEMO_FIRM_ID,
    name: "Mitchell CPA",
    primaryStates: ["CA", "NY", "TX", "LA", "FL"],
    branding: { primaryColor: "#0f172a" },
    plan: "pro",
    trialEndsAt: new Date("2026-05-30T00:00:00Z"),
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(users).values({
    id: DEMO_USER_ID,
    firmId: DEMO_FIRM_ID,
    email: "sarah@mitchellcpa.com",
    passwordHash: "demo-password",
    role: "owner",
    fullName: "Sarah Mitchell",
    createdAt: now,
    lastActiveAt: now,
  });

  await seedServicePackages();
  await seedReminderTemplates();
  await seedIntegrations(now);

  const clientUuidByLegacy = new Map<string, string>();

  for (const client of seedClients) {
    const clientId = stringToUuid(`client:${client.id}`);
    clientUuidByLegacy.set(client.id, clientId);
    await db.insert(clients).values({
      id: clientId,
      firmId: DEMO_FIRM_ID,
      name: client.name,
      entityType: client.entityType,
      primaryState: client.primaryState,
      nexusStates: client.nexusStates,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone ?? null,
      status: client.status,
      tier: "standard",
      assignedUserId: DEMO_USER_ID,
      industry: inferIndustry(client),
      county: client.county ?? null,
      notes: null,
      metadata: {
        legacyId: client.id,
        addedAt: client.addedAt,
      },
      createdAt: new Date(`${client.addedAt}T09:00:00Z`),
      updatedAt: now,
      archivedAt: client.status === "archived" ? now : null,
    });
    await db.insert(contacts).values({
      id: stringToUuid(`contact:${client.id}`),
      firmId: DEMO_FIRM_ID,
      clientId,
      name: client.name,
      email: client.contactEmail,
      phone: client.contactPhone ?? null,
      isPrimary: true,
      emailVerified: true,
      emailBouncesConsecutive: 0,
      createdAt: now,
      updatedAt: now,
    });

    for (const packageName of client.servicePackages) {
      const packageId = findBundleIdByName(packageName);
      if (!packageId) continue;
      await db.insert(clientServicePackages).values({
        clientId,
        packageId,
        assignedAt: now,
      });
    }

    await seedImportedFactsForClient(clientId, client, now);
  }

  for (const deadline of seedDeadlines) {
    const deadlineId = stringToUuid(`deadline:${deadline.id}`);
    const clientId = clientUuidByLegacy.get(deadline.clientId);
    if (!clientId) continue;
    await db.insert(deadlines).values({
      id: deadlineId,
      firmId: DEMO_FIRM_ID,
      clientId,
      serviceTemplateId: null,
      period: deadline.officialDueDate.slice(0, 4),
      form: deadline.form,
      jurisdiction: deadline.jurisdiction,
      officialDueDate: deadline.officialDueDate,
      adjustedDueDate: deadline.officialDueDate,
      internalTargetDate: deadline.officialDueDate,
      clientPrepDate: null,
      fileByDate: deadline.officialDueDate,
      payByDate: deadline.officialDueDate,
      status: deadline.status,
      metadata: {
        completedAt: deadline.completedAt ?? null,
        extensionSubmittedAt: deadline.extensionSubmittedAt ?? null,
        extensionApprovedAt: deadline.extensionApprovedAt ?? null,
        legacyId: deadline.id,
      },
      createdAt: now,
      updatedAt: now,
    });

    const taskId = stringToUuid(`task:${deadline.id}`);
    const client = seedClients.find((item) => item.id === deadline.clientId);
    if (!client) continue;
    const forwardingAlias = makeForwardingAlias(client.name, deadline.form);
    await db.insert(tasks).values({
      id: taskId,
      firmId: DEMO_FIRM_ID,
      deadlineId,
      assignedUserId: DEMO_USER_ID,
      forwardingEmailLocalPart: forwardingAlias,
      forwardingEmailRevokedAt:
        deadline.status === "completed" ? now : null,
      completionPercentage:
        deadline.status === "completed" || deadline.status === "filed_extension"
          ? 100
          : deadline.status === "in_progress"
          ? 50
          : 0,
      status: deadline.status,
      createdAt: now,
      updatedAt: now,
    });

    const checklist = checklistLibrary(deadline, client);
    for (let index = 0; index < checklist.length; index += 1) {
      const item = checklist[index];
      const itemId = stringToUuid(`checklist:${deadline.id}:${index}`);
      const seededState = seededChecklistState(deadline, index);
      await db.insert(checklistItems).values({
        id: itemId,
        firmId: DEMO_FIRM_ID,
        taskId,
        label: item.label,
        itemType: item.itemType,
        description: item.description ?? null,
        sortOrder: index,
        state: seededState.state,
        stateChangedAt: now,
        stateChangedByKind: seededState.actorKind,
        stateChangedByUserId:
          seededState.actorKind === "user" ? DEMO_USER_ID : null,
        aiConfidence: seededState.aiConfidence,
        aiFlagReason: seededState.aiFlagReason,
        sourceDocumentUrl: null,
        lastReminderAt:
          seededState.state === "requested_waiting" ? now : null,
        createdAt: now,
      });
      await db.insert(checklistItemEvents).values({
        id: parseInt(
          createHash("md5")
            .update(`event:${deadline.id}:${index}`)
            .digest("hex")
            .slice(0, 10),
          16
        ),
        firmId: DEMO_FIRM_ID,
        checklistItemId: itemId,
        fromState: null,
        toState: seededState.state,
        actorKind: seededState.actorKind,
        actorUserId: seededState.actorKind === "user" ? DEMO_USER_ID : null,
        payload: {
          source: "seed",
        },
        createdAt: now,
      });
    }

    await db.insert(activityEvents).values({
      id: parseInt(
        createHash("md5")
          .update(`activity:${deadline.id}`)
          .digest("hex")
          .slice(0, 10),
        16
      ),
      firmId: DEMO_FIRM_ID,
      taskId,
      eventType: "task_seeded",
      actorKind: "system",
      actorUserId: null,
      description: `Task opened for ${deadline.form}`,
      payload: {
        dueDate: deadline.officialDueDate,
      },
      relatedChecklistItemId: null,
      relatedEmailDraftId: null,
      createdAt: now,
    });
  }

  for (const announcement of seedAnnouncements) {
    const announcementId = stringToUuid(`announcement:${announcement.id}`);
    await db.insert(stateAnnouncements).values({
      id: announcementId,
      stateCode: announcement.stateCode,
      authority: announcement.authority,
      title: announcement.title,
      rawText: announcement.summary,
      parsedImpact: {
        counties: announcement.counties,
        entityTypes: announcement.entityTypes,
        taxTypes: announcement.taxTypes,
        oldDeadline: announcement.oldDeadline ?? null,
        newDeadline: announcement.newDeadline ?? null,
      },
      sourceUrl: announcement.sourceUrl,
      announcementDate: announcement.publishedDate,
      detectedAt: new Date(announcement.detectedAt),
      confidence: announcement.confidence === "high" ? "0.92" : announcement.confidence === "medium" ? "0.72" : "0.54",
      parseStatus: "auto_published",
    });

    for (const legacyClientId of announcement.affectedClientIds) {
      const clientId = clientUuidByLegacy.get(legacyClientId);
      if (!clientId) continue;
      await db.insert(affectedClientMatches).values({
        firmId: DEMO_FIRM_ID,
        announcementId,
        clientId,
        matchBasis: "seeded_match",
        matchPayload: {
          state: announcement.stateCode,
        },
        status: "pending",
        dismissedReason: null,
        createdAt: new Date(announcement.detectedAt),
      });
    }

    await db.insert(notifications).values({
      firmId: DEMO_FIRM_ID,
      userId: DEMO_USER_ID,
      type: "state_alert",
      title: announcement.title,
      body: `${announcement.affectedClientIds.length} affected clients`,
      deepLink: `/alerts/${announcementId}`,
      readAt: announcement.read ? now : null,
      payload: {
        announcementId,
      },
      createdAt: new Date(announcement.detectedAt),
    });
  }

  for (const item of extraNotifications) {
    await db.insert(notifications).values({
      firmId: DEMO_FIRM_ID,
      userId: DEMO_USER_ID,
      type: item.kind,
      title: item.title,
      body: item.detail,
      deepLink: item.href,
      readAt: item.read ? new Date(item.createdAt) : null,
      payload: {
        announcementId: item.announcementId
          ? stringToUuid(`announcement:${item.announcementId}`)
          : null,
        clientId: item.clientId ? clientUuidByLegacy.get(item.clientId) : null,
      },
      createdAt: new Date(item.createdAt),
    });
  }

  await seedDrafts(now);
  await seedInferenceHistory(now);
}

async function seedIntegrations(now: Date) {
  const rows = [
    ["qbo", 0, "connected", "2026-04-22T10:00:00Z"],
    ["xero", 0, "not_connected", null],
    ["gmail", 0, "connected", "2026-04-21T09:00:00Z"],
    ["outlook", 0, "not_connected", null],
    ["sharepoint", 1, "not_connected", null],
    ["hubspot", 1, "not_connected", null],
    ["mailchimp", 1, "not_connected", null],
    ["prior_year_pdf", 1, "connected", "2026-04-20T08:30:00Z"],
  ] as const;

  for (const [integrationType, integrationTier, status, lastSync] of rows) {
    await db.insert(integrationConnections).values({
      id: stringToUuid(`integration:${integrationType}`),
      firmId: DEMO_FIRM_ID,
      integrationType,
      integrationTier,
      authBlobEncrypted: status === "connected" ? "configured" : "",
      authBlobKmsKeyId: "dev",
      status,
      lastSyncAt: lastSync ? new Date(lastSync) : null,
      nextSyncAt: null,
      lastError: null,
      metadata: {
        providerName: integrationType.toUpperCase(),
      },
      createdAt: now,
    });
  }
}

async function seedDrafts(now: Date) {
  const demoTaskId = stringToUuid("task:d-004");
  const demoChecklistId = stringToUuid("checklist:d-004:0");
  await db.insert(emailDrafts).values({
    id: stringToUuid("draft:demo:1"),
    firmId: DEMO_FIRM_ID,
    taskId: demoTaskId,
    checklistItemId: demoChecklistId,
    templateId: stringToUuid("template:W-2 first request"),
    status: "sent",
    subject: "W-2 follow-up for your 1040 filing",
    body: "Hi Daniel,\n\nFollowing up on your W-2 so we can keep your 1040 on track.\n\nSarah Mitchell\nMitchell CPA",
    tone: "formal",
    aiSources: {
      toneMatch: "firm default",
      timing: "T-14 cadence",
    },
    sendMethod: "cpa_send",
    scheduledSendAt: null,
    recallWindowExpiresAt: null,
    sentAt: new Date("2026-04-22T14:30:00Z"),
    sentByUserId: DEMO_USER_ID,
    bounceReason: null,
    createdAt: now,
  });
}

async function seedInferenceHistory(now: Date) {
  await db.insert(aiInferences).values({
    id: 1001,
    firmId: DEMO_FIRM_ID,
    mode: "A",
    model: "deterministic-dev",
    inputHash: "seed-mode-a",
    output: {
      itemsGenerated: 5,
    },
    confidence: "0.83",
    costCents: "0.0000",
    latencyMs: 12,
    wasActedOn: true,
    cpaActionAt: now,
    relatedObjectType: "task",
    relatedObjectId: stringToUuid("task:d-001"),
    createdAt: now,
  });
}

async function seedImportedFactsForClient(clientId: string, client: Client, now: Date) {
  const facts = buildImportedFacts(client);
  await Promise.all(
    facts.map((fact, index) =>
      db.insert(importedFacts).values({
        id: 2000 + parseInt(clientId.replace(/-/g, "").slice(0, 4), 16) + index,
        firmId: DEMO_FIRM_ID,
        connectionId: stringToUuid("integration:prior_year_pdf"),
        clientId,
        sourceObjectId: `${client.id}:${fact.factType}`,
        factType: fact.factType,
        period: fact.period,
        value: fact.value,
        confidence: "0.88",
        importTier: fact.importTier,
        importedAt: now,
      })
    )
  );
}

function buildImportedFacts(client: Client) {
  const common = [
    {
      factType: "response_time_days",
      period: "2025",
      value: { mean: client.entityType === "Individual" ? 3 : 6 },
      importTier: 2,
    },
  ];
  if (client.entityType === "Individual") {
    return [
      ...common,
      {
        factType: "wage_w2_amount",
        period: "2025",
        value: { amount: 120000 },
        importTier: 3,
      },
      {
        factType: "1099_any_present",
        period: "2025",
        value: { present: true },
        importTier: 3,
      },
      {
        factType: "k1_arrival_date",
        period: "2025",
        value: { date: "2025-08-06" },
        importTier: 4,
      },
    ];
  }
  if (client.entityType === "S-Corp") {
    return [
      ...common,
      {
        factType: "scorp_books_closed_date",
        period: "2025",
        value: { date: "2025-02-18" },
        importTier: 3,
      },
      {
        factType: "shareholder_distribution_present",
        period: "2025",
        value: { present: true },
        importTier: 3,
      },
    ];
  }
  if (client.entityType === "Partnership" || client.entityType === "LLC") {
    return [
      ...common,
      {
        factType: "partnership_books_closed_date",
        period: "2025",
        value: { date: "2025-02-25" },
        importTier: 3,
      },
      {
        factType: "k1_arrival_date",
        period: "2025",
        value: { date: "2025-03-28" },
        importTier: 4,
      },
    ];
  }
  return common;
}

function inferIndustry(client: Client): string {
  const lower = client.name.toLowerCase();
  if (lower.includes("realty") || lower.includes("holdings")) return "real_estate";
  if (lower.includes("labs") || lower.includes("tech")) return "technology";
  if (lower.includes("dental")) return "healthcare";
  if (lower.includes("construction")) return "construction";
  return "professional_services";
}

export async function ensureClientServicePackage(clientId: string, packageId: string) {
  const existing = await db
    .select()
    .from(clientServicePackages)
    .where(
      and(
        eq(clientServicePackages.clientId, clientId),
        eq(clientServicePackages.packageId, packageId)
      )
    );
  if (existing.length > 0) return;
  await db.insert(clientServicePackages).values({
    clientId,
    packageId,
    assignedAt: new Date(),
  });
}

export async function findSystemPackageByName(name: string) {
  const rows = await db
    .select()
    .from(servicePackages)
    .where(and(eq(servicePackages.name, name), isNull(servicePackages.firmId)));
  return rows[0] ?? null;
}
