import { describe, expect, it } from "vitest";
import {
  buildQueueRows,
  pickPrimaryItem,
  summarizeClientGroup,
  type QueueTodoItem,
} from "./queueGrouping";

// Live-BE shape contract (from backend/src/trpc/routers/todoItems.ts):
//   • Mode F state alert    → clientId="", client="N clients"
//   • Mode A/B/C/D/E + reply → clientId=<UUID>, client=<name>
//   • Mode D in mock-adapter → client="N clients" (legacy multi-client)
//   • urgency_score ∈ ℕ; urgency bucket ∈ {high, medium, normal}
//
// These tests guard the grouping helper against regressions when the BE
// shape evolves and prove the consolidation contract holds for real users.

function chase(
  clientId: string,
  client: string,
  task: string,
  dueDate: string,
  score = 100,
  overrides: Partial<QueueTodoItem> = {},
): QueueTodoItem {
  return {
    id: `${clientId}-${task}-${overrides.source ?? "mode_b_reminder_due"}`,
    source: "mode_b_reminder_due",
    verb: "Send",
    client,
    clientId,
    task,
    dueDate,
    action: `Send reminder · ${task}`,
    context: "draft ready",
    urgency: score >= 200 ? "high" : score >= 100 ? "medium" : "normal",
    urgencyScore: score,
    surface: "email_draft_modal",
    ...overrides,
  };
}

describe("buildQueueRows", () => {
  it("returns empty array for empty input", () => {
    expect(buildQueueRows([])).toEqual([]);
  });

  it("groups multiple items for one client into one row", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme LLC", "1040", "2026-04-15", 250),
      chase("c1", "Acme LLC", "1040-ES", "2026-06-15", 120),
      chase("c1", "Acme LLC", "CA 540", "2026-04-15", 200),
    ];
    const rows = buildQueueRows(items);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("client_group");
    if (rows[0].kind !== "client_group") return;
    expect(rows[0].clientName).toBe("Acme LLC");
    expect(rows[0].items).toHaveLength(3);
    expect(rows[0].maxUrgency).toBe("high");
    expect(rows[0].maxUrgencyScore).toBe(250);
    expect(rows[0].earliestDueDate).toBe("2026-04-15");
  });

  it("does NOT collapse two clients with the same name but different ids", () => {
    // Real BE risk — two firms might import a client called "John Smith"
    // and we must not consolidate their work.
    const items: QueueTodoItem[] = [
      chase("c1", "John Smith", "1040", "2026-04-15"),
      chase("c2", "John Smith", "1040", "2026-04-15"),
    ];
    const rows = buildQueueRows(items);
    expect(rows).toHaveLength(2);
  });

  it("falls back to name-keying when clientId is missing or empty", () => {
    // Defensive: if a non-Mode-F item somehow has empty clientId, we
    // collapse only by name (not by the empty-string key, which would
    // merge unrelated rows into a single bucket).
    const items: QueueTodoItem[] = [
      chase("", "Acme LLC", "1040", "2026-04-15"),
      chase("", "Acme LLC", "1040-ES", "2026-06-15"),
      chase("", "Different Corp", "1120", "2026-03-15"),
    ];
    const rows = buildQueueRows(items);
    expect(rows).toHaveLength(2);
    const acmeRow = rows.find(
      (r) => r.kind === "client_group" && r.clientName === "Acme LLC",
    );
    expect(acmeRow?.kind).toBe("client_group");
    if (acmeRow?.kind === "client_group") {
      expect(acmeRow.items).toHaveLength(2);
    }
  });

  it("carves Mode F state alerts out as their own row variant", () => {
    // Live-BE shape: Mode F has clientId="" and client="N clients".
    const items: QueueTodoItem[] = [
      {
        id: "mode_f-ann-1",
        source: "mode_f_alert",
        verb: "Apply",
        client: "12 clients",
        clientId: "",
        action: "Apply CA FTB extension",
        context: "CA: published 6h ago · matched on 12 clients",
        urgency: "medium",
        urgencyScore: 150,
        surface: "alert_detail",
      },
      chase("c1", "Acme LLC", "1040", "2026-04-15", 250),
    ];
    const rows = buildQueueRows(items);
    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe("state_alert"); // pinned at top
    expect(rows[1].kind).toBe("client_group");
  });

  it("pins state alerts above client groups regardless of urgency score", () => {
    // Even when a chase row's score exceeds the alert's score, alerts
    // remain at the top — they're the highest-leverage surface.
    const items: QueueTodoItem[] = [
      chase("c1", "Acme LLC", "1040", "2026-04-15", 500),
      {
        id: "mode_f-ann-1",
        source: "mode_f_alert",
        verb: "Apply",
        client: "3 clients",
        clientId: "",
        action: "Apply NY extension",
        context: "low score on purpose",
        urgency: "normal",
        urgencyScore: 50,
        surface: "alert_detail",
      },
    ];
    const rows = buildQueueRows(items);
    expect(rows[0].kind).toBe("state_alert");
  });

  it("treats verb=Apply as a state alert even if source is not mode_f_alert", () => {
    // Defensive: live-BE source field is a string, future BE could use
    // a different source string for Apply-verb rows. We still want them
    // pinned as alerts.
    const items: QueueTodoItem[] = [
      {
        id: "manual-apply",
        source: "manual",
        verb: "Apply",
        client: "8 clients",
        clientId: "",
        action: "Manual broadcast",
        context: "",
        urgency: "medium",
        urgencyScore: 120,
        surface: "alert_detail",
      },
    ];
    expect(buildQueueRows(items)[0].kind).toBe("state_alert");
  });

  it("carves multi-client batches as bulk_batch rows", () => {
    // Mock-adapter Mode D path emits client="8 clients" for batch sends.
    // Live BE doesn't currently produce this, but the contract holds.
    const items: QueueTodoItem[] = [
      {
        id: "mode_d-batch",
        source: "mode_d_draft_ready",
        verb: "Send",
        client: "8 clients",
        clientId: "",
        action: "8 routine W-2 follow-ups · approve all",
        context: "Pattern Precedent met",
        urgency: "normal",
        urgencyScore: 50,
        surface: "email_draft_modal",
      },
    ];
    expect(buildQueueRows(items)[0].kind).toBe("bulk_batch");
  });

  it("orders client groups by max urgency score desc", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Low Urgency Co", "1040", "2026-06-15", 60),
      chase("c2", "High Urgency Co", "1040", "2026-04-15", 280),
      chase("c3", "Medium Urgency Co", "1040", "2026-05-15", 150),
    ];
    const rows = buildQueueRows(items);
    expect(rows.map((r) => r.kind === "client_group" && r.clientName)).toEqual(
      ["High Urgency Co", "Medium Urgency Co", "Low Urgency Co"],
    );
  });

  it("computes verbCounts for mixed-verb groups", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme LLC", "1040", "2026-04-15", 200, { verb: "Send" }),
      chase("c1", "Acme LLC", "1040", "2026-04-15", 150, {
        verb: "Confirm",
        source: "mode_a_inbound",
      }),
      chase("c1", "Acme LLC", "1040", "2026-04-15", 100, {
        verb: "Discuss",
        source: "reply_pushback",
      }),
    ];
    const rows = buildQueueRows(items);
    if (rows[0].kind !== "client_group") throw new Error("expected group");
    expect(rows[0].verbCounts).toEqual({ Send: 1, Confirm: 1, Discuss: 1 });
  });
});

describe("pickPrimaryItem", () => {
  it("returns undefined for empty array", () => {
    expect(pickPrimaryItem([])).toBeUndefined();
  });

  it("prefers Send over Confirm even when Confirm has higher urgency", () => {
    // The row's primary badge says 'Send' if any Send item exists, so
    // the click must land on a Send row to honor that contract — even
    // if a Confirm row in the same group is more urgent.
    const items: QueueTodoItem[] = [
      chase("c1", "Acme", "1040", "2026-04-15", 100, { verb: "Send" }),
      chase("c1", "Acme", "1040", "2026-04-15", 300, {
        verb: "Confirm",
        source: "mode_a_inbound",
      }),
    ];
    const top = pickPrimaryItem(items);
    expect(top?.verb).toBe("Send");
  });

  it("falls through to Confirm when no Send items present", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme", "1040", "2026-04-15", 100, {
        verb: "Confirm",
        source: "mode_a_inbound",
      }),
      chase("c1", "Acme", "1040", "2026-04-15", 50, {
        verb: "Discuss",
        source: "reply_question",
      }),
    ];
    expect(pickPrimaryItem(items)?.verb).toBe("Confirm");
  });

  it("picks highest urgency within the chosen verb", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme", "1040-Q1", "2026-04-15", 100),
      chase("c1", "Acme", "1040-Q2", "2026-06-15", 250),
      chase("c1", "Acme", "1040-Q3", "2026-09-15", 180),
    ];
    expect(pickPrimaryItem(items)?.urgencyScore).toBe(250);
  });
});

describe("summarizeClientGroup", () => {
  it("produces a verb-summary plus form list", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme LLC", "1040", "2026-04-15", 200, { verb: "Send" }),
      chase("c1", "Acme LLC", "1040", "2026-04-15", 150, {
        verb: "Send",
        source: "mode_b_reminder_due",
        id: "x2",
      }),
      chase("c1", "Acme LLC", "1040-ES", "2026-06-15", 100, {
        verb: "Confirm",
        source: "mode_a_inbound",
      }),
    ];
    const rows = buildQueueRows(items);
    if (rows[0].kind !== "client_group") throw new Error("expected group");
    const summary = summarizeClientGroup(rows[0]);
    expect(summary).toBe(
      "Send 2 reminders · Confirm 1 inbound · across 1040 + 1040-ES",
    );
  });

  it("handles single-item single-form group", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme LLC", "1040", "2026-04-15", 200),
    ];
    const rows = buildQueueRows(items);
    if (rows[0].kind !== "client_group") throw new Error("expected group");
    expect(summarizeClientGroup(rows[0])).toBe(
      "Send 1 reminder · across 1040",
    );
  });

  it("truncates the form list at 3 with overflow count", () => {
    const items: QueueTodoItem[] = [
      chase("c1", "Acme", "1040", "2026-04-15"),
      chase("c1", "Acme", "1040-ES", "2026-06-15"),
      chase("c1", "Acme", "CA 540", "2026-04-15"),
      chase("c1", "Acme", "NY IT-201", "2026-04-15"),
      chase("c1", "Acme", "TX Franchise", "2026-05-15"),
    ];
    const rows = buildQueueRows(items);
    if (rows[0].kind !== "client_group") throw new Error("expected group");
    const summary = summarizeClientGroup(rows[0]);
    // Order is whichever 3 unique tasks come first in the items array
    // post-sort. Just assert the overflow-count format.
    expect(summary).toMatch(/across .+ \+ .+ \+ .+ \+2/);
  });
});
