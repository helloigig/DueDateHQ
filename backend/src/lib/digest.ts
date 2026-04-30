/**
 * Client digest — consolidate one CPA's chase queue per client into
 * a single email per day, instead of N emails (one per task).
 *
 * Real CPAs do this manually today: they batch their morning chases
 * into one consolidated message per client. Without this, a client
 * with 3 open tasks gets 3 separate chase emails — feels like spam,
 * lowers response rate, undermines the per-task forwarding-address
 * value (the client doesn't know which to use).
 *
 * This module:
 *   - Aggregates pending checklist items per (client × firm)
 *   - Drafts ONE email per client (Mode D with all items in
 *     missingDocs[]) instead of N drafts
 *   - The CPA reviews + sends OR auto-sends (Phase 2 governance)
 *
 * The digest is opt-in per firm (firms.metadata.digestMode='client'
 * vs 'task'). Default = 'task' to preserve existing behavior.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  checklistItems,
  clients,
  deadlines,
  tasks,
} from "../db/schema.js";
import { draftEmail, isAiConfigured, type DraftEmailOutput } from "./ai.js";
import { log } from "./observability.js";

export interface ClientDigestOutput {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  /** Tasks aggregated into the digest — useful for the FE preview */
  tasks: Array<{
    taskId: string;
    formType: string;
    forwardingEmail: string;
    pendingItems: Array<{ itemType: string; label: string }>;
  }>;
  /** The single drafted email for this client. Null if AI not configured. */
  draft: DraftEmailOutput | null;
}

/**
 * Build a digest for one client — all open chases consolidated into
 * one Mode D draft. Skips clients with no pending items.
 */
export async function generateClientDigest(args: {
  firmId: string;
  clientId: string;
  cpaSignature: string;
  tone?: "warm" | "neutral" | "urgent";
}): Promise<ClientDigestOutput | null> {
  const client = await db.query.clients.findFirst({
    where: and(
      eq(clients.id, args.clientId),
      eq(clients.firmId, args.firmId),
    ),
  });
  if (!client) return null;

  // Walk the client's open tasks, collect pending checklist items per task
  const taskRows = await db
    .select({
      id: tasks.id,
      formType: deadlines.formType,
      forwardingLocalPart: tasks.forwardingEmailLocalPart,
    })
    .from(tasks)
    .leftJoin(deadlines, eq(deadlines.id, tasks.deadlineId))
    .where(
      and(
        eq(tasks.firmId, args.firmId),
        eq(deadlines.clientId, args.clientId),
        sql`${tasks.status} NOT IN ('completed', 'filed_extension')`,
      ),
    );

  if (taskRows.length === 0) return null;

  const taskBundles: ClientDigestOutput["tasks"] = [];
  const allMissing: Array<{ itemType: string; label: string }> = [];
  for (const tr of taskRows) {
    if (!tr.formType) continue;
    const items = await db
      .select()
      .from(checklistItems)
      .where(eq(checklistItems.taskId, tr.id));
    const pending = items.filter(
      (i) =>
        i.state === "not_requested" ||
        i.state === "requested_waiting" ||
        i.state === "received_issue",
    );
    if (pending.length === 0) continue;
    const pendingItems = pending.map((p) => ({
      itemType: p.itemType,
      label: p.label,
    }));
    taskBundles.push({
      taskId: tr.id,
      formType: tr.formType,
      forwardingEmail: `${tr.forwardingLocalPart}@inbound.duedatehq.com`,
      pendingItems,
    });
    // Dedup across tasks — a client doesn't need "send your W-2" twice
    // because they have a 1040 + 1040-X for the same year. The
    // forwarding address differs per task, but for the digest we use
    // the primary task's address (first in list).
    for (const p of pendingItems) {
      if (!allMissing.some((m) => m.itemType === p.itemType)) {
        allMissing.push(p);
      }
    }
  }

  if (taskBundles.length === 0) return null;

  // Use the FIRST task's forwarding address as the digest reply-to.
  // Real production would generate a per-client digest forwarding
  // address that fans out to all tasks. Phase 2.
  const primaryForwarding = taskBundles[0]!.forwardingEmail;
  const formTypes = [...new Set(taskBundles.map((b) => b.formType))].join(
    " + ",
  );

  let draft: DraftEmailOutput | null = null;
  if (isAiConfigured()) {
    try {
      draft = await draftEmail({
        firmId: args.firmId,
        client: { name: client.name },
        task: { formType: formTypes },
        tone: args.tone ?? "warm",
        cpaSignature: args.cpaSignature,
        forwardingEmail: primaryForwarding,
        missingDocs: allMissing,
        context:
          taskBundles.length > 1
            ? `This client has ${taskBundles.length} open filings (${formTypes}). Consolidate the asks into a single warm email.`
            : undefined,
      });
    } catch (err) {
      log.warn("digest.draft_failed", {
        clientId: args.clientId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    clientId: args.clientId,
    clientName: client.name,
    clientEmail: client.contactEmail,
    tasks: taskBundles,
    draft,
  };
}

/**
 * Generate digests for every client of the firm with pending chases.
 * Used by the daily digest job (cron, not yet wired) and by the
 * "Generate today's digests" button in the FE.
 */
export async function generateFirmDigests(args: {
  firmId: string;
  cpaSignature: string;
  tone?: "warm" | "neutral" | "urgent";
}): Promise<ClientDigestOutput[]> {
  const firmClients = await db.query.clients.findMany({
    where: eq(clients.firmId, args.firmId),
  });

  const out: ClientDigestOutput[] = [];
  for (const c of firmClients) {
    const digest = await generateClientDigest({
      firmId: args.firmId,
      clientId: c.id,
      cpaSignature: args.cpaSignature,
      tone: args.tone,
    });
    if (digest) out.push(digest);
  }
  log.info("digest.firm_generated", {
    firmId: args.firmId,
    digestCount: out.length,
    clientCount: firmClients.length,
  });
  return out;
}
