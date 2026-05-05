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
//
// All client + task references are real entries from mockClients.ts /
// mockDeadlines.ts so the FE can navigate from a Today row → live detail.

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
  // ── HIGH urgency ───────────────────────────────────────────────────

  // Bounce — Johnson Family's reminder bounced (Hillsborough County, inactive
  // status, last contact 2024). The bounce_modal opens with their record.
  {
    id: "todo-1",
    source: "delivery_bounce",
    verb: "Send",
    client: "Johnson Family",
    task: "Q1 estimate (federal)",
    dueDate: "Dec 15",
    action: "Reminder bounced — fix address",
    context: "johnson.family@gmail.com · 3 consecutive hard bounces (last attempt 6h ago)",
    urgency: "high",
    urgencyScore: 285,
    surface: "bounce_modal",
  },

  // Reminder >7d unsent + missing items — Acme Bayou's K-1 chase. arrival-timing
  // says K-1 typically arrives Aug 6, but it's only May 5 — this row exists
  // because LA IT-565 prep can't start without it and the partnership
  // package's auto-reminder cadence already missed.
  {
    id: "todo-2",
    source: "mode_b_reminder_due",
    verb: "Send",
    client: "Acme Bayou LLC",
    task: "1065 Partner Forms",
    dueDate: "Sep 15",
    action: "Send K-1 status check · 11d unsent · draft ready",
    context: "Source partnership's deadline passed Mar 15 — safe to ping Rob now without spooking him",
    stageLabel: "Collect",
    daysBehind: 11,
    urgency: "high",
    urgencyScore: 250,
    surface: "email_draft_modal",
  },

  // AI-flagged anomaly — Daniel O'Brien's 1099-INT down 33%. Real client
  // (c-ny-07, archived but still has historical facts). The anomaly was
  // flagged on his 1040 (extension) which is in_progress.
  {
    id: "todo-3",
    source: "mode_c_anomaly",
    verb: "Confirm",
    client: "Daniel O'Brien",
    task: "1040 (extension)",
    dueDate: "Oct 15",
    action: "Confirm 1099-INT $1,240 · anomaly-detector flag: -33% YoY",
    context: "Last year: $1,860. Could be account closed (real change) or wrong year sent.",
    stageLabel: "Review",
    urgency: "high",
    urgencyScore: 200,
    surface: "task_detail",
  },

  // Pushback intent — Mark Sullivan said his K-1 won't be ready until July.
  // (Real client, c-ca-03, just had his 1040 extension approved.) The reply
  // routes to his task; Sarah needs to decide if she planned for this.
  {
    id: "todo-4",
    source: "reply_pushback",
    verb: "Discuss",
    client: "Mark Sullivan",
    task: "1040 (extension)",
    dueDate: "Oct 15",
    action: "Client says K-1 not ready until July · proposes pushing to August",
    context: "InboundReply intent classifier (§5.8) routed; needs CPA decision on revised timeline",
    urgency: "high",
    urgencyScore: 180,
    surface: "task_detail",
  },

  // ── MEDIUM urgency ─────────────────────────────────────────────────

  // Blockbuster state alert — CA storm relief hits 18 clients. Sarah
  // batch-applies the new Aug 17 deadline. Surface jumps to /alerts detail.
  {
    id: "todo-5",
    source: "mode_f_alert",
    verb: "Apply",
    client: "18 clients",
    action: "Apply CA storm extension · 18 affected clients",
    context: "Published 3h ago · matched on entity + state + nexus · CA FTB primary source",
    urgency: "medium",
    urgencyScore: 175,
    surface: "alert_detail",
  },

  // AI-classified inbound — W-2 from ADP confirmed for Olivia Bennett (real
  // client c-ga-02, GA premium individual). Wages consistent with prior year.
  {
    id: "todo-6",
    source: "mode_a_inbound",
    verb: "Confirm",
    client: "Olivia Bennett",
    task: "Q2 estimate (federal)",
    dueDate: "Jun 15",
    action: "Confirm W-2 from ADP · received Mon",
    context: "inbound-classifier high confidence · ImportedFact: wages $112K (consistent with 2024 $108K)",
    stageLabel: "Review",
    urgency: "medium",
    urgencyScore: 120,
    surface: "task_detail",
  },

  // Question intent — Mark Sullivan asked an IRA question via reply.
  {
    id: "todo-7",
    source: "reply_question",
    verb: "Discuss",
    client: "Mark Sullivan",
    task: "1040 (extension)",
    action: "Client asked: what's the IRA contribution limit this year?",
    context: "Open AI-drafted reply, or mark for follow-up call",
    urgency: "medium",
    urgencyScore: 100,
    surface: "email_draft_modal",
  },

  // arrival-timing bundled row — Pacific Ridge S-Corp (c-ca-02), batch of
  // missing items the chase loop is tracking. The DotStack on the row
  // expands inline to show per-item state.
  {
    id: "todo-8",
    source: "mode_b_reminder_due",
    verb: "Send",
    client: "Pacific Ridge S-Corp",
    task: "CA 100S (S-Corp)",
    dueDate: "May 5",
    action: "4 of 6 docs in · send reminder for last 2",
    context: "S-Corp books closed · K-1 prep waiting on shareholder distribution confirm",
    stageLabel: "Collect",
    daysBehind: 0,
    urgency: "medium",
    urgencyScore: 95,
    surface: "task_detail",
    checklistItems: [
      { id: "ck-pr-1", label: "S-Corp books (closed)", state: "received_confirmed" },
      { id: "ck-pr-2", label: "Officer compensation report", state: "received_confirmed" },
      { id: "ck-pr-3", label: "Shareholder distributions", state: "requested_waiting" },
      { id: "ck-pr-4", label: "K-1 to shareholders", state: "requested_waiting" },
      { id: "ck-pr-5", label: "Schedule M-3 reconciliation", state: "received_unreviewed" },
      { id: "ck-pr-6", label: "State S-Corp election proof", state: "received_confirmed" },
    ],
  },

  // ── NORMAL urgency ─────────────────────────────────────────────────

  // cross-year-insighter opportunity — Pacific Ridge wages doubled YoY.
  // Mode E aggregate insight; Sarah can convert to a billable advisory call.
  {
    id: "todo-9",
    source: "mode_e_opportunity",
    verb: "Discuss",
    client: "Pacific Ridge S-Corp",
    action: "Discuss Solo-K eligibility · cross-year-insighter detected wages doubled YoY",
    context: "Layer B advisory trigger · est. revenue uplift $450 from 1hr planning call",
    urgency: "normal",
    urgencyScore: 60,
    surface: "opportunity_detail",
  },

  // email-drafter batch — 8 routine W-2 follow-ups ready for Phase 2 auto-send
  // approval. rt-02 is already promoted; this is the cadence row that fires
  // weekly.
  {
    id: "todo-10",
    source: "mode_d_draft_ready",
    verb: "Send",
    client: "8 clients",
    action: "8 routine W-2 follow-ups ready · approve all (Phase 2 eligible)",
    context: "Pattern Precedent met for all 8 · standard cadence · CPA voice matched",
    urgency: "normal",
    urgencyScore: 50,
    surface: "email_draft_modal",
  },

  // Manual note — Sarah added a self-reminder to ask about the second home
  // mentioned in Coastal Tech's Q1 call.
  {
    id: "todo-11",
    source: "manual",
    verb: "Discuss",
    client: "Coastal Tech LLC",
    action: "Reminder: ask about second home purchase mentioned in Q1 call",
    context: "Self-added note · Mar 12",
    urgency: "normal",
    urgencyScore: 30,
    surface: "task_detail",
  },

  // cross-year-insighter — Mark Sullivan's missing Schedule E (the flagship
  // demo insight). Lives at normal urgency because it's already on the
  // extension; Sarah will close the loop when Mark confirms the property
  // status.
  {
    id: "todo-12",
    source: "mode_e_opportunity",
    verb: "Discuss",
    client: "Mark Sullivan",
    task: "1040 (extension)",
    action: "Schedule E disappeared after 5 years · sale or carry-forward?",
    context: "cross-year-insighter detected: Sunset Beach rental (~$42K gross) reported 2020-2024, missing this year",
    urgency: "normal",
    urgencyScore: 45,
    surface: "opportunity_detail",
  },
];
