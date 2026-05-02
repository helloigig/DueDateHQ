import type { MockTodoItem } from "../data/mockTodoItems";

// Live TodoItem may have clientId/taskId on top of MockTodoItem fields. Wire
// this here so the grouping helper works for both mock and live data.
export type QueueTodoItem = MockTodoItem & {
  clientId?: string;
  taskId?: string;
};

export type ClientGroupRow = {
  kind: "client_group";
  key: string;
  clientName: string;
  clientId?: string;
  items: QueueTodoItem[];
  maxUrgency: MockTodoItem["urgency"];
  maxUrgencyScore: number;
  earliestDueDate?: string;
  verbCounts: Partial<Record<MockTodoItem["verb"], number>>;
};

export type StateAlertRow = {
  kind: "state_alert";
  key: string;
  item: QueueTodoItem;
};

export type BulkBatchRow = {
  kind: "bulk_batch";
  key: string;
  item: QueueTodoItem;
};

export type QueueRow = ClientGroupRow | StateAlertRow | BulkBatchRow;

// Mode F state alerts (verb=Apply) fan out to N clients — they're event-shaped,
// not client-shaped, so they render as their own row. Mode D bulk drafts have
// "N clients" as the client field — also not a single-client row.
//
// Heuristic: if `client` looks like "12 clients" / "8 clients", treat as
// non-grouping. Otherwise group by client name (mock) or clientId (live).
const MULTI_CLIENT_RE = /^\d+\s+clients?$/i;

function isMultiClient(item: QueueTodoItem): boolean {
  return MULTI_CLIENT_RE.test(item.client.trim());
}

function urgencyRank(u: MockTodoItem["urgency"]): number {
  return u === "high" ? 2 : u === "medium" ? 1 : 0;
}

function maxUrgency(items: QueueTodoItem[]): MockTodoItem["urgency"] {
  let best: MockTodoItem["urgency"] = "normal";
  for (const it of items) {
    if (urgencyRank(it.urgency) > urgencyRank(best)) best = it.urgency;
  }
  return best;
}

function earliestDue(items: QueueTodoItem[]): string | undefined {
  const dates = items.map((i) => i.dueDate).filter((d): d is string => !!d);
  if (dates.length === 0) return undefined;
  // Lexicographic compare works for both ISO ("2026-04-15") and "Mar 31" given
  // the mock data is consistent within a feed; the live BE returns ISO.
  return dates.sort()[0];
}

function groupKey(item: QueueTodoItem): string {
  return item.clientId ?? `name:${item.client}`;
}

export function buildQueueRows(items: QueueTodoItem[]): QueueRow[] {
  const stateAlerts: StateAlertRow[] = [];
  const bulks: BulkBatchRow[] = [];
  const groups = new Map<string, QueueTodoItem[]>();

  for (const item of items) {
    if (item.source === "mode_f_alert" || item.verb === "Apply") {
      stateAlerts.push({ kind: "state_alert", key: `alert:${item.id}`, item });
      continue;
    }
    if (isMultiClient(item)) {
      bulks.push({ kind: "bulk_batch", key: `bulk:${item.id}`, item });
      continue;
    }
    const k = groupKey(item);
    const existing = groups.get(k);
    if (existing) existing.push(item);
    else groups.set(k, [item]);
  }

  const clientGroups: ClientGroupRow[] = [];
  for (const [k, gItems] of groups) {
    const verbCounts: Partial<Record<MockTodoItem["verb"], number>> = {};
    for (const it of gItems) {
      verbCounts[it.verb] = (verbCounts[it.verb] ?? 0) + 1;
    }
    const sortedItems = gItems
      .slice()
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
    clientGroups.push({
      kind: "client_group",
      key: `client:${k}`,
      clientName: gItems[0].client,
      clientId: gItems[0].clientId,
      items: sortedItems,
      maxUrgency: maxUrgency(gItems),
      maxUrgencyScore: Math.max(...gItems.map((i) => i.urgencyScore)),
      earliestDueDate: earliestDue(gItems),
      verbCounts,
    });
  }

  // Final order: state alerts pinned to top (sorted by urgencyScore among
  // themselves), then a merged stream of client groups + bulk rows by score.
  stateAlerts.sort((a, b) => b.item.urgencyScore - a.item.urgencyScore);
  const tail: QueueRow[] = [...clientGroups, ...bulks].sort((a, b) => {
    const aScore =
      a.kind === "client_group" ? a.maxUrgencyScore : a.item.urgencyScore;
    const bScore =
      b.kind === "client_group" ? b.maxUrgencyScore : b.item.urgencyScore;
    return bScore - aScore;
  });
  return [...stateAlerts, ...tail];
}

// Summarize the items for a client group as a single sentence, e.g.
//   "Send 2 reminders · Confirm 1 inbound · across 1040 + 1040-ES"
export function summarizeClientGroup(group: ClientGroupRow): string {
  const parts: string[] = [];
  const verbOrder: MockTodoItem["verb"][] = [
    "Send",
    "Confirm",
    "Discuss",
    "Apply",
  ];
  const verbNoun: Record<MockTodoItem["verb"], [string, string]> = {
    Send: ["reminder", "reminders"],
    Confirm: ["inbound", "inbounds"],
    Discuss: ["reply", "replies"],
    Apply: ["alert", "alerts"],
  };
  for (const v of verbOrder) {
    const n = group.verbCounts[v];
    if (!n) continue;
    const [s, p] = verbNoun[v];
    parts.push(`${v} ${n} ${n === 1 ? s : p}`);
  }
  const tasks = Array.from(
    new Set(group.items.map((i) => i.task).filter((t): t is string => !!t)),
  );
  if (tasks.length > 0) {
    parts.push(`across ${tasks.slice(0, 3).join(" + ")}${tasks.length > 3 ? ` +${tasks.length - 3}` : ""}`);
  }
  return parts.join(" · ");
}
