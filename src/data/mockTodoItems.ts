// Mock TodoItem feed for Phase 1 prototype — per PRD §4.8 + §9.6 + IA §3.1.
//
// TodoItem is a *computed view* (not a stored row) aggregating from 9 sources:
//   1. inbound-classifier — auto-checklist + inbound classification
//   2. arrival-timing — per-client arrival timing
//   3. anomaly-detector — sanity check anomaly flags
//   4. email-drafter — draft outbound emails
//   5. cross-year-insighter — cross-year insights / opportunities
//   6. state-monitor — state change monitoring
//   7. InboundReply intent (per §5.8: pushback / question / etc.)
//   8. DeliveryEvent bounces
//   9. Manual TaskNote
//
// urgency_score = base_source_score × waiting_multiplier × deadline_proximity ×
//                 tier_weight + stuck_duration_bonus  (per §4.8 v0.8 amendment)
//
// CPA-visible verb collapses 9 sources to 4: Send / Confirm / Apply / Discuss.

export type TodoSource =
  | "mode_a_inbound"
  | "mode_b_reminder_due"
  | "mode_c_anomaly"
  | "mode_d_draft_ready"
  | "mode_e_opportunity"
  | "mode_f_alert"
  | "reply_pushback"
  | "reply_question"
  | "delivery_bounce"
  | "manual";

export type TodoVerb = "Send" | "Confirm" | "Apply" | "Discuss";

export type ChecklistItemState =
  | "not_requested"
  | "requested_waiting"
  | "received_unreviewed"
  | "received_confirmed"
  | "received_issue"
  | "not_applicable";

export type ChecklistItemSnapshot = {
  id: string;
  label: string;
  state: ChecklistItemState;
};

export type MockTodoItem = {
  id: string;
  source: TodoSource;
  verb: TodoVerb;
  // Identity line
  client: string;
  task?: string;
  dueDate?: string;
  // Action line — natural language
  action: string;
  context: string;
  // Mini-timeline strip context (optional, task-bound rows only)
  stageLabel?: string;
  daysBehind?: number;
  // Urgency category for left-border color
  urgency: "high" | "medium" | "normal";
  urgencyScore: number;
  // Suggested next surface to open on click
  surface:
    | "email_draft_modal"
    | "task_detail"
    | "alert_detail"
    | "opportunity_detail"
    | "bounce_modal";
  // arrival-timing bundled rows only — per-checklist-item snapshots used by
  // the FE DotStack + inline expand. Other sources leave undefined.
  checklistItems?: ChecklistItemSnapshot[];
};

export const MOCK_TODO_ITEMS: MockTodoItem[] = [
  // High urgency — bounce + delivery_event
  {
    id: "todo-1",
    source: "delivery_bounce",
    verb: "Send",
    client: "Marcus Chen",
    task: "S-Corp CA",
    dueDate: "Mar 31",
    action: "Reminder bounced — fix address",
    context: "marcus@old-address.com · hard bounce 2h ago",
    urgency: "high",
    urgencyScore: 285,
    surface: "bounce_modal",
  },
  // High — reminder >7d unsent + missing items
  {
    id: "todo-2",
    source: "mode_b_reminder_due",
    verb: "Send",
    client: "Apex Fund",
    task: "1065 Partner Forms",
    dueDate: "Mar 15",
    action: "Send K-1 reminder · 11d unsent · draft ready",
    context: "arrival-timing says client K-1 typically arrives Aug 6; we're past pattern window",
    stageLabel: "Collect",
    daysBehind: 11,
    urgency: "high",
    urgencyScore: 250,
    surface: "email_draft_modal",
  },
  // High — AI-flagged anomaly flag
  {
    id: "todo-3",
    source: "mode_c_anomaly",
    verb: "Confirm",
    client: "Emily Hartfield",
    task: "1040 NY",
    dueDate: "Apr 15",
    action: "Confirm 1099-INT $1,240 · anomaly-detector flag: -33% YoY",
    context: "Last year: $1,860. Could be account closed (real change) or wrong year (issue).",
    stageLabel: "Review",
    urgency: "high",
    urgencyScore: 200,
    surface: "task_detail",
  },
  // High — pushback intent
  {
    id: "todo-4",
    source: "reply_pushback",
    verb: "Discuss",
    client: "Sarah Mitchell",
    task: "1040 TX",
    dueDate: "Apr 15",
    action: "Client says K-1 not ready until July · propose extension?",
    context: "InboundReply intent classifier (§5.8) routed; needs CPA decision",
    urgency: "high",
    urgencyScore: 180,
    surface: "task_detail",
  },
  // Medium — state-monitor alert
  {
    id: "todo-5",
    source: "mode_f_alert",
    verb: "Apply",
    client: "12 clients",
    action: "Apply California Franchise Tax Board extension · 12 affected clients",
    context: "Published 6h ago · matched on entity + state",
    urgency: "medium",
    urgencyScore: 150,
    surface: "alert_detail",
  },
  // Medium — AI-classified inbound classified, awaiting confirm
  {
    id: "todo-6",
    source: "mode_a_inbound",
    verb: "Confirm",
    client: "Jordan Lee",
    task: "1040 Federal",
    dueDate: "Apr 15",
    action: "Confirm W-2 from ADP · received Mon",
    context: "inbound-classifier high confidence · ImportedFact: wages $98K (consistent with 2024 $95K)",
    stageLabel: "Review",
    urgency: "medium",
    urgencyScore: 120,
    surface: "task_detail",
  },
  // Medium — question intent
  {
    id: "todo-7",
    source: "reply_question",
    verb: "Discuss",
    client: "Daniel O'Brien",
    task: "1040 (extension)",
    action: "Client asked: what's the IRA contribution limit this year?",
    context: "Open AI-drafted to reply, or mark for follow-up",
    urgency: "medium",
    urgencyScore: 100,
    surface: "email_draft_modal",
  },
  // Normal — cross-year-insighter opportunity
  {
    id: "todo-8",
    source: "mode_e_opportunity",
    verb: "Discuss",
    client: "Emily Hartfield",
    action: "Discuss RSU vesting · cross-year-insighter detected wages doubled YoY",
    context: "Layer B advisory trigger · est. revenue uplift $450 from 1hr advisory call",
    urgency: "normal",
    urgencyScore: 60,
    surface: "opportunity_detail",
  },
  // Normal — email-drafter batch
  {
    id: "todo-9",
    source: "mode_d_draft_ready",
    verb: "Send",
    client: "8 clients",
    action: "8 routine W-2 follow-ups ready · approve all (Phase 2 eligible)",
    context: "Pattern Precedent met for all 8 · standard cadence · CPA voice matched",
    urgency: "normal",
    urgencyScore: 50,
    surface: "email_draft_modal",
  },
  // Normal — manual note
  {
    id: "todo-10",
    source: "manual",
    verb: "Discuss",
    client: "Coastal Tech LLC",
    action: "Reminder: ask about second home purchase mentioned in Q1 call",
    context: "Self-added note · Mar 12",
    urgency: "normal",
    urgencyScore: 30,
    surface: "task_detail",
  },
];
