import type { EmailDraft } from "../types";

/**
 * A handful of email drafts in mixed statuses so the activity timelines
 * have something to render and the email-history surfaces aren't empty.
 *
 * Some entries deliberately seed Pattern Precedent for the Phase 2
 * eligibility detector (PRD §7.3 condition 1):
 *   • 6 sent drafts of rt-02 (W-2 follow-up #1) to client c-ca-03 →
 *     unlocks rt-02 for Phase 2.
 *   • 3 sent drafts of rt-05 (1099 series follow-up) to client c-la-01
 *     → 3 of 5 approvals; the UI shows the progress.
 *   • 2 entries with sendMethod: "phase2_auto" demonstrate what an
 *     auto-send looks like in activity timelines once a template is
 *     promoted.
 */
export const emailDrafts: EmailDraft[] = [
  {
    id: "ed-001",
    taskId: "t-d1",
    clientId: "c-ca-03",
    checklistItemId: undefined,
    to: "mark.sullivan@gmail.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Quick check: missing 1099-INT for your 1040",
    body:
      "Hi Mark,\n\nI'm working on your 2025 return and noticed I haven't received this year's 1099-INT yet. Would you mind forwarding it?\n\nThanks,\nSarah",
    tone: "casual",
    aiSources: [
      { kind: "tone_match", note: "matched casual tone from your last 3 emails to Mark" },
      { kind: "prior_year", note: "1099-INT historically arrives Feb 8" },
    ],
    status: "sent",
    sentAt: "2026-04-10T15:23:00Z",
    sendMethod: "cpa_send",
    createdAt: "2026-04-10T15:20:00Z",
  },
  {
    id: "ed-002",
    taskId: "t-d2",
    clientId: "c-la-01",
    to: "ops@deltavinegar.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Partnership books — close-out for 1065",
    body:
      "Hi Delta Vinegar team,\n\nReady to start your 1065. Please confirm books are closed and send the trial balance plus partner capital schedules when you have a moment.\n\nThanks,\nSarah",
    tone: "formal",
    aiSources: [
      { kind: "substrate", note: "partnership_1065 default template" },
      { kind: "forwarding_email", note: "task forwarding inserted as Reply-To" },
    ],
    status: "draft",
    sendMethod: "cpa_send",
    createdAt: "2026-04-22T09:00:00Z",
  },

  // ── Pattern Precedent: rt-02 (W-2 follow-up #1) → Mark Sullivan ───────
  // Six approved-no-edit sends across the past six tax seasons. Unlocks
  // rt-02 for Phase 2 promotion.
  ...[
    "2024-03-12",
    "2024-03-26",
    "2025-03-04",
    "2025-03-18",
    "2026-02-25",
    "2026-03-11",
  ].map<EmailDraft>((iso, idx) => ({
    id: `ed-pp-rt02-${idx + 1}`,
    taskId: "t-d3",
    clientId: "c-ca-03",
    to: "mark.sullivan@gmail.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Following up on your W-2",
    body: "(prior-year approved draft — body retained for audit)",
    tone: "formal",
    aiSources: [],
    status: "sent",
    sentAt: `${iso}T15:00:00Z`,
    sendMethod: "cpa_send",
    templateId: "rt-02",
    createdAt: `${iso}T14:55:00Z`,
  })),

  // ── Pattern Precedent in progress: rt-05 → Delta Vinegar ──────────────
  // Three approved sends so far. The UI shows "3/5 approvals" so the CPA
  // can see exactly when this template will graduate to Phase 2.
  ...["2024-04-02", "2025-04-08", "2026-04-14"].map<EmailDraft>(
    (iso, idx) => ({
      id: `ed-pp-rt05-${idx + 1}`,
      taskId: "t-d2",
      clientId: "c-la-01",
      to: "ops@deltavinegar.com",
      cc: "sarah@mitchellcpa.com",
      subject: "Following up on your 1099s",
      body: "(prior-year approved draft — body retained for audit)",
      tone: "formal",
      aiSources: [],
      status: "sent",
      sentAt: `${iso}T15:00:00Z`,
      sendMethod: "cpa_send",
      templateId: "rt-05",
      createdAt: `${iso}T14:55:00Z`,
    })
  ),

  // ── Phase 2 in action: two auto-fires that landed last week ───────────
  // Demonstrates how an auto-send reads in the activity timeline when a
  // template has already been promoted to Phase 2.
  {
    id: "ed-auto-001",
    taskId: "t-d3",
    clientId: "c-ca-03",
    to: "mark.sullivan@gmail.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Following up on your W-2",
    body:
      "Hi Mark,\n\nI haven't seen your W-2 yet — your filing deadline is Apr 15 (28 days). Reply with the file attached when you have a moment.\n\nThanks,\nSarah",
    tone: "formal",
    aiSources: [
      {
        kind: "tone_match",
        note: "auto-fired: rt-02 promoted to Phase 2 after 6 approved sends",
      },
    ],
    status: "sent",
    sentAt: "2026-04-22T08:00:00Z",
    sendMethod: "phase2_auto",
    templateId: "rt-02",
    createdAt: "2026-04-22T08:00:00Z",
  },
  {
    id: "ed-auto-002",
    taskId: "t-d3",
    clientId: "c-ca-03",
    to: "mark.sullivan@gmail.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Following up on your W-2",
    body:
      "Hi Mark,\n\nQuick check-in — still need that W-2 to complete your return. Let me know if there's anything blocking on your side.\n\nThanks,\nSarah",
    tone: "formal",
    aiSources: [
      {
        kind: "tone_match",
        note: "auto-fired: rt-02 cadence",
      },
    ],
    status: "sent",
    sentAt: "2026-04-29T08:00:00Z",
    sendMethod: "phase2_auto",
    templateId: "rt-02",
    createdAt: "2026-04-29T08:00:00Z",
  },
];
