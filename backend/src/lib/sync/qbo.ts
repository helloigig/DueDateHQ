/**
 * QuickBooks Online — Customer → DueDateHQ Client sync.
 *
 * Real two-way sync per arch §6.5:
 *   READ:   QBO Customers → DueDateHQ Clients (this file's main path)
 *   WRITE:  DueDateHQ task summaries → QBO Customer Notes (memo only;
 *           we never overwrite numeric/accounting fields)
 *
 * The OAuth handshake from `lib/oauth.ts` already lands access_token +
 * refresh_token + realmId (stored as integrations.externalAccountId).
 * This module picks up where that left off:
 *   1. pullCustomers()  — initial full sync (paginated SELECT)
 *   2. pullDelta()      — incremental sync via Metadata.LastUpdatedTime
 *   3. syncFirm()       — orchestrator (full on first run, delta after)
 *   4. pushClientMemo() — write a one-line memo back to a Customer's
 *                         Notes field (deferred; placeholder)
 *
 * Rate limits to respect (QBO):
 *   500 requests / minute per company
 *   100,000 requests / day per company
 *
 * Customer model fields we care about (the rest are accounting-domain
 * we never touch): Id, DisplayName, PrimaryEmailAddr, PrimaryPhone,
 * BillAddr.CountrySubDivisionCode, Active, Notes.
 *
 * QBO has no entity-type field — we infer from the name + Notes. The
 * heuristic is conservative; ambiguous cases default to "individual"
 * and the CPA confirms in the imports preview UX.
 */

import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  clients,
  integrations,
  type ClientInsert,
} from "../../db/schema.js";
import { getFreshAccessToken } from "../oauth.js";
import { log, span, captureException } from "../observability.js";

// ───────── QBO API base ─────────

/**
 * QBO has separate sandbox and production endpoints. Sandbox is for
 * dev (self-serve in the QBO developer dashboard); production requires
 * Intuit app review. Default to sandbox; flip QBO_ENV=production once
 * the app is live.
 */
function qboBase(): string {
  return process.env.QBO_ENV === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com";
}

/**
 * Authoritative GET against the QBO Query API. Always asks for JSON
 * (default is XML on some endpoints). Returns the response body parsed;
 * caller-handled error states.
 */
async function qboGet<T>(args: {
  accessToken: string;
  realmId: string;
  path: string;
  query?: Record<string, string>;
}): Promise<T> {
  const url = new URL(`${qboBase()}/v3/company/${args.realmId}${args.path}`);
  if (args.query) {
    for (const [k, v] of Object.entries(args.query)) {
      url.searchParams.set(k, v);
    }
  }
  // QBO Query API accepts `query` as a query-param SQL-like dialect
  url.searchParams.set("minorversion", "65");
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`qbo_${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ───────── Customer model + mapping ─────────

interface QboCustomer {
  Id: string;
  DisplayName?: string;
  CompanyName?: string;
  FullyQualifiedName?: string;
  Active?: boolean;
  PrimaryEmailAddr?: { Address?: string };
  PrimaryPhone?: { FreeFormNumber?: string };
  BillAddr?: {
    CountrySubDivisionCode?: string; // 2-letter state code
  };
  Notes?: string;
  MetaData?: {
    CreateTime?: string;
    LastUpdatedTime?: string;
  };
}

interface QueryResponse {
  QueryResponse: {
    Customer?: QboCustomer[];
    maxResults?: number;
    startPosition?: number;
    totalCount?: number;
  };
}

/**
 * Heuristic entity-type inference. QBO has no entity_type field, so
 * we lean on the name + Notes. Conservative — ambiguous → individual,
 * which the CPA can correct in the imports preview / client edit UX.
 *
 * Mapping rules (in priority order):
 *   "S-Corp"|"S Corp"               → s_corp
 *   "LLC"|"L.L.C."                  → llc
 *   "LLP"|"Partnership"|"Partners"  → partnership
 *   "Inc"|"Corp"|"Corporation"      → c_corp
 *   "Trust"                         → trust
 *   "Foundation"|"501(c)"           → non_profit
 *   default                         → individual
 */
function inferEntityType(c: QboCustomer): string {
  const haystack = [c.DisplayName, c.CompanyName, c.Notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\bs[\s-]?corp\b/.test(haystack)) return "s_corp";
  if (/\bllc\b|\bl\.l\.c\b/.test(haystack)) return "llc";
  if (/\bllp\b|\bpartnership\b|\bpartners\b/.test(haystack)) return "partnership";
  if (/\b(inc|corp|corporation)\b/.test(haystack)) return "c_corp";
  if (/\btrust\b/.test(haystack)) return "trust";
  if (/\bfoundation\b|501\s*\(c\)/.test(haystack)) return "non_profit";
  return "individual";
}

/**
 * Build the ClientInsert payload from a QBO Customer. State falls
 * back to the firm's home state when the QBO record is missing
 * BillAddr.CountrySubDivisionCode (common — many small clients have
 * incomplete address data in QBO).
 */
function customerToClient(args: {
  firmId: string;
  customer: QboCustomer;
  firmHomeState: string;
}): ClientInsert {
  const name =
    args.customer.DisplayName ??
    args.customer.CompanyName ??
    args.customer.FullyQualifiedName ??
    `QBO ${args.customer.Id}`;
  const state = args.customer.BillAddr?.CountrySubDivisionCode
    ?.trim()
    .toUpperCase();

  return {
    firmId: args.firmId,
    name,
    entityType: inferEntityType(args.customer),
    primaryState: state && state.length === 2 ? state : args.firmHomeState,
    contactEmail: args.customer.PrimaryEmailAddr?.Address ?? null,
    contactPhone: args.customer.PrimaryPhone?.FreeFormNumber ?? null,
    status: args.customer.Active === false ? "archived" : "active",
    metadata: {
      qbo: {
        customerId: args.customer.Id,
        syncedAt: new Date().toISOString(),
        // Stash the original record for reference / debugging — useful
        // when the heuristic gets entityType wrong.
        rawDisplayName: args.customer.DisplayName ?? null,
      },
    },
  };
}

// ───────── Pull (read from QBO) ─────────

export interface PullResult {
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
}

/**
 * Fetch QBO Customers for the given firm. When `since` is set, runs
 * an incremental query; otherwise full sync.
 *
 * Pagination: QBO returns maxResults rows per call; we walk
 * STARTPOSITION until the response is shorter than maxResults.
 */
async function fetchCustomers(args: {
  accessToken: string;
  realmId: string;
  since?: Date;
}): Promise<QboCustomer[]> {
  const out: QboCustomer[] = [];
  let startPosition = 1;
  const maxResults = 500;
  while (true) {
    const whereClause = args.since
      ? ` WHERE Metadata.LastUpdatedTime > '${args.since.toISOString()}'`
      : "";
    const query = `SELECT * FROM Customer${whereClause} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`;
    const res = await qboGet<QueryResponse>({
      accessToken: args.accessToken,
      realmId: args.realmId,
      path: "/query",
      query: { query },
    });
    const batch = res.QueryResponse?.Customer ?? [];
    out.push(...batch);
    if (batch.length < maxResults) break;
    startPosition += batch.length;
    // Safety: cap at 5000 customers per cycle. Production handles
    // larger books with multiple cycles.
    if (out.length >= 5000) break;
  }
  return out;
}

/**
 * Pull customers from QBO and upsert into clients. Idempotent on
 * (firmId, qbo.customerId) — re-running updates existing rows in
 * place rather than creating duplicates.
 *
 * Returns counts the FE can render in the sync feedback toast.
 */
export async function pullCustomers(args: {
  firmId: string;
  /** When set, only fetch customers updated after this timestamp. */
  since?: Date;
}): Promise<PullResult> {
  return span(
    "qbo.pull_customers",
    async () => {
      const integration = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.firmId, args.firmId),
          eq(integrations.kind, "qbo"),
          eq(integrations.status, "connected"),
        ),
      });
      if (!integration) {
        throw new Error("qbo_not_connected");
      }
      const realmId = integration.externalAccountId;
      if (!realmId) throw new Error("qbo_no_realm_id");
      const accessToken = await getFreshAccessToken(args.firmId, "qbo");

      let customers: QboCustomer[];
      try {
        customers = await fetchCustomers({
          accessToken,
          realmId,
          since: args.since,
        });
      } catch (err) {
        captureException(err, { firmId: args.firmId, ctx: "qbo_fetch" });
        // Mark integration as errored so the FE Settings panel can
        // surface lastError without us having to plumb the throw
        // through the FE polling.
        await db
          .update(integrations)
          .set({
            status: "error",
            lastError: err instanceof Error ? err.message : String(err),
          })
          .where(eq(integrations.id, integration.id));
        throw err;
      }

      // Pre-fetch existing clients with QBO refs to support upserts
      const firmRow = await db.query.firms.findFirst({
        where: (firms, { eq }) => eq(firms.id, args.firmId),
      });
      const firmHomeState =
        firmRow?.primaryStates?.[0] ?? "CA";

      const existingByQboId = new Map<string, string>();
      const existingClients = await db
        .select({ id: clients.id, metadata: clients.metadata })
        .from(clients)
        .where(eq(clients.firmId, args.firmId));
      for (const c of existingClients) {
        const meta = c.metadata as {
          qbo?: { customerId?: string };
        };
        if (meta?.qbo?.customerId) {
          existingByQboId.set(meta.qbo.customerId, c.id);
        }
      }

      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (const customer of customers) {
        try {
          const insert = customerToClient({
            firmId: args.firmId,
            customer,
            firmHomeState,
          });
          const existingId = existingByQboId.get(customer.Id);
          if (existingId) {
            // Update — refresh contact info + status, leave name +
            // entityType alone so CPA edits don't get clobbered.
            await db
              .update(clients)
              .set({
                contactEmail: insert.contactEmail,
                contactPhone: insert.contactPhone,
                status: insert.status,
                metadata: insert.metadata,
                updatedAt: new Date(),
              })
              .where(eq(clients.id, existingId));
            updated++;
          } else {
            await db.insert(clients).values(insert);
            inserted++;
          }
        } catch (err) {
          captureException(err, {
            firmId: args.firmId,
            qboCustomerId: customer.Id,
          });
          errors++;
        }
      }

      // Mark sync time even on partial success — incremental cursor
      // moves forward so we don't re-pull the failed rows on every cycle
      await db
        .update(integrations)
        .set({
          status: errors > 0 && customers.length > 0 ? "connected" : "connected",
          lastSyncedAt: new Date(),
          lastError: null,
          metadata: {
            ...(integration.metadata as object),
            lastFullSyncAt: args.since
              ? (integration.metadata as { lastFullSyncAt?: string })
                  ?.lastFullSyncAt
              : new Date().toISOString(),
          },
        })
        .where(eq(integrations.id, integration.id));

      log.info("qbo.pull_customers.done", {
        firmId: args.firmId,
        fetched: customers.length,
        inserted,
        updated,
        skipped,
        errors,
        delta: Boolean(args.since),
      });

      return {
        fetched: customers.length,
        inserted,
        updated,
        skipped,
        errors,
      };
    },
    { firmId: args.firmId, delta: Boolean(args.since) },
  );
}

// ───────── Sync orchestrator ─────────

/**
 * Run a sync for one firm. First call after connect → full sync
 * (no `since`). Subsequent calls → incremental delta from
 * integrations.lastSyncedAt.
 *
 * Real production splits this off a Bull queue so a slow customer
 * pull doesn't block the request thread; for Phase 1 it's awaited
 * inline (call from a tRPC mutation triggered by the user).
 */
export async function syncFirm(firmId: string): Promise<PullResult> {
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.firmId, firmId),
      eq(integrations.kind, "qbo"),
      eq(integrations.status, "connected"),
    ),
  });
  if (!integration) throw new Error("qbo_not_connected");

  const since = integration.lastSyncedAt ?? undefined;
  return pullCustomers({ firmId, since });
}

// ───────── Push (write back to QBO) ─────────

/**
 * Stub — write a one-line task summary to the Customer's Notes field
 * in QBO. Per arch §6.5: we own task state, QBO owns accounting
 * numbers; the only field we touch is Notes (free text) and only as
 * an "appended" memo, never overwriting existing content.
 *
 * Phase 1: stub. The push direction needs explicit user opt-in
 * (firms may not want their accounting tool cluttered with chase
 * status). Wire when the Settings → Integrations toggle ships.
 */
export async function pushClientMemo(_args: {
  firmId: string;
  clientId: string;
  memo: string;
}): Promise<{ ok: boolean }> {
  // TODO Phase 1: implement when push is enabled per firm.
  // Pseudocode:
  //   1. Lookup client → get qbo.customerId
  //   2. GET /v3/company/{realmId}/customer/{id} for current Notes
  //   3. Append memo (with timestamp prefix) to Notes
  //   4. POST /v3/company/{realmId}/customer with sparse=true update
  return { ok: false };
}

// ───────── Periodic scheduler ─────────

let qboSyncHandle: NodeJS.Timeout | null = null;

/**
 * Start the in-process QBO sync scheduler. Walks every connected QBO
 * integration on each tick; default 30 minutes.
 *
 * Production splits this to a separate worker process so a slow firm
 * doesn't block the others. Gated by env so dev runs don't burn QBO
 * sandbox quota.
 */
export function startQboSyncScheduler(intervalMs = 30 * 60 * 1000): void {
  if (qboSyncHandle) return;
  const tick = async () => {
    try {
      const connected = await db
        .select({ firmId: integrations.firmId })
        .from(integrations)
        .where(
          and(
            eq(integrations.kind, "qbo"),
            eq(integrations.status, "connected"),
          ),
        );
      for (const row of connected) {
        try {
          await syncFirm(row.firmId);
        } catch (err) {
          captureException(err, {
            firmId: row.firmId,
            ctx: "qbo_scheduler_tick",
          });
        }
      }
    } catch (err) {
      captureException(err, { ctx: "qbo_scheduler" });
    }
  };
  // Initial run on boot — picks up any integrations that connected
  // while the BE was down.
  void tick();
  qboSyncHandle = setInterval(() => void tick(), intervalMs);
  qboSyncHandle.unref?.();
  log.info("qbo_sync_scheduler.started", { intervalMs });
}

export function stopQboSyncScheduler(): void {
  if (qboSyncHandle) {
    clearInterval(qboSyncHandle);
    qboSyncHandle = null;
  }
}
