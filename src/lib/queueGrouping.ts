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

export type BulkBatchRow = {
  kind: "bulk_batch";
  key: string;
  item: QueueTodoItem;
};

export type QueueRow = ClientGroupRow | BulkBatchRow;

// state-monitor state alerts (verb=Apply / source=mode_f_alert) live in the
// dedicated state-alert surface (StateAlertsPreview on Dashboard, the State
// alerts section on Today). They DON'T appear here — duplicating them as
// pinned queue rows violated "one thing, one entrance, one name" (see
// feedback_one_entrance_one_name). They're filtered out below.
//
// email-drafter bulk drafts have "N clients" as the client field — that's
// the only multi-client row that still belongs in the queue (no other
// canonical surface owns those drafts yet).
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
  // Live BE returns `clientId: ""` (empty string) for state-monitor batch rows
  // (carved out before this runs) and a UUID for everything else. Mock
  // adapter omits `clientId` entirely for some sources. Treat both empty
  // string and undefined as "no canonical id" → fall back to name keying
  // so a malformed live row can't collapse N unrelated clients into one.
  if (item.clientId && item.clientId.length > 0) return item.clientId;
  return `name:${item.client}`;
}

// Pick the item whose surface the row's primary action should open. The
// row label promises a verb (e.g. "Send"); the click must land on a row
// of that verb so label and destination agree. Order: Send > Confirm >
// Discuss > Apply, breaking ties by urgency_score desc.
const PRIMARY_VERB_ORDER: MockTodoItem["verb"][] = [
  "Send",
  "Confirm",
  "Discuss",
  "Apply",
];

export function pickPrimaryItem(
  items: QueueTodoItem[],
): QueueTodoItem | undefined {
  if (items.length === 0) return undefined;
  for (const v of PRIMARY_VERB_ORDER) {
    const matches = items.filter((it) => it.verb === v);
    if (matches.length > 0) {
      return matches.slice().sort((a, b) => b.urgencyScore - a.urgencyScore)[0];
    }
  }
  return items[0];
}

export function buildQueueRows(items: QueueTodoItem[]): QueueRow[] {
  const bulks: BulkBatchRow[] = [];
  const groups = new Map<string, QueueTodoItem[]>();

  for (const item of items) {
    // Mode F state alerts live in the dedicated state-alert surface, not
    // here — skip them so the queue stays focused on per-client chase work.
    if (item.source === "mode_f_alert" || item.verb === "Apply") continue;
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

  return [...clientGroups, ...bulks].sort((a, b) => {
    const aScore =
      a.kind === "client_group" ? a.maxUrgencyScore : a.item.urgencyScore;
    const bScore =
      b.kind === "client_group" ? b.maxUrgencyScore : b.item.urgencyScore;
    return bScore - aScore;
  });
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
