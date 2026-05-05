import type { EmailDraft } from "../types";

/**
 * A handful of email drafts in mixed statuses so the activity timelines
 * have something to render and the email-history surfaces aren't empty.
 *
 * Status coverage: draft, scheduled, sent, discarded, recalled.
 * Tone coverage: casual, formal, urgent, apologetic.
 * Send-method coverage: cpa_send, phase2_auto.
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
  // ── Casual tone, sent — Mark Sullivan 1099-INT chase ─────────────
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

  // ── Formal tone, draft — Acme Bayou 1065 books close ─────────────
  // (Was previously addressed to "Delta Vinegar" — a name that doesn't
  // exist in the roster. Re-pointed at Acme Bayou's actual contact.)
  {
    id: "ed-002",
    taskId: "t-d2",
    clientId: "c-la-01",
    to: "rob@acmebayou.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Partnership books — close-out for 1065",
    body:
      "Hi Rob,\n\nReady to start your 1065. Please confirm books are closed and send the trial balance plus partner capital schedules when you have a moment.\n\nThanks,\nSarah",
    tone: "formal",
    aiSources: [
      { kind: "substrate", note: "partnership_1065 default template" },
      { kind: "forwarding_email", note: "task forwarding inserted as Reply-To" },
    ],
    status: "draft",
    sendMethod: "cpa_send",
    createdAt: "2026-05-04T09:00:00Z",
  },

  // ── Urgent tone, scheduled — Pacific Ridge K-1 chase ─────────────
  // Scheduled for tomorrow morning so it lands in Maya's inbox before
  // her standup. Demonstrates the scheduled+future-send affordance.
  {
    id: "ed-003",
    taskId: "t-d3",
    clientId: "c-ca-02",
    to: "kyle@pacificridge.co",
    cc: "sarah@mitchellcpa.com",
    subject: "Urgent: Shareholder distribution confirmation needed today",
    body:
      "Hi Kyle,\n\nWe're at the deadline for your CA 100S filing — May 5. I need confirmation of the 2025 shareholder distributions before I can finalize K-1s. Reply with the totals (or a doc) and I can get this filed today.\n\nThanks,\nSarah",
    tone: "urgent",
    aiSources: [
      { kind: "substrate", note: "rt-15 S-Corp shareholder distribution template" },
      { kind: "prior_year", note: "Pacific Ridge has consistently sent these on the day-of" },
    ],
    status: "scheduled",
    scheduledFor: "2026-05-06T13:00:00Z",
    sendMethod: "cpa_send",
    templateId: "rt-15",
    createdAt: "2026-05-05T08:30:00Z",
  },

  // ── Apologetic tone, sent — Empire Advisory extension status ─────
  // Demonstrates the "we owe you a status update" template that
  // softens the message when approval is dragging.
  {
    id: "ed-004",
    taskId: "t-d4",
    clientId: "c-ny-04",
    to: "rachel@empireadvisory.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Update on your 1120-S extension",
    body:
      "Hi Rachel,\n\nApologies for the silence — your 1120-S extension was filed Mar 14 but IRS hasn't issued the formal approval yet (they're running about 50 days behind on Form 7004 confirmations this year). The filing is in good standing; you're protected from late-filing penalties either way.\n\nI'll let you know the moment the approval lands.\n\nBest,\nSarah",
    tone: "apologetic",
    aiSources: [
      { kind: "tone_match", note: "softer register matches your prior outreach to Rachel" },
    ],
    status: "sent",
    sentAt: "2026-05-04T16:42:00Z",
    sendMethod: "cpa_send",
    createdAt: "2026-05-04T16:30:00Z",
  },

  // ── Discarded — earlier draft Sarah scrapped before sending ──────
  {
    id: "ed-005",
    taskId: "t-d4",
    clientId: "c-ny-04",
    to: "rachel@empireadvisory.com",
    cc: "sarah@mitchellcpa.com",
    subject: "1120-S extension status",
    body:
      "Hi Rachel,\n\nYour 1120-S extension has been pending IRS approval since March 14...",
    tone: "formal",
    aiSources: [],
    status: "discarded",
    sendMethod: "cpa_send",
    createdAt: "2026-05-04T16:18:00Z",
  },

  // ── Recalled — Maya sent the wrong template, recalled within 90s ─
  // The recall surface should show this as a faded entry on the
  // outbox with the recall reason in the hover.
  {
    id: "ed-006",
    taskId: "t-d6",
    clientId: "c-ga-02",
    to: "olivia.bennett@protonmail.com",
    cc: "maya@mitchellcpa.com",
    subject: "Following up on your W-2",
    body:
      "Hi Olivia,\n\nFollowing up on your W-2 from your employer — please reply with the file...",
    tone: "formal",
    aiSources: [],
    status: "recalled",
    sentAt: "2026-05-04T11:47:00Z",
    sendMethod: "cpa_send",
    templateId: "rt-02",
    createdAt: "2026-05-04T11:46:00Z",
  },

  // ── Bounced (sent but underlying delivery failed) — Johnson Family
  // Shows up in the Issues tab + drives todo-1 (delivery_bounce row).
  // EmailDraftStatus has no "bounced" enum member, so we model this as
  // status: "sent" + the bounce lives on the DeliveryEvent stream that
  // the bounce_modal renders. Keeping the draft itself as sent is what
  // the FE expects — the bounce is a separate signal.
  {
    id: "ed-007",
    taskId: "t-d7",
    clientId: "c-fl-07",
    to: "johnson.family@gmail.com",
    cc: "sarah@mitchellcpa.com",
    subject: "Q1 estimate reminder — Johnson Family",
    body:
      "Hi,\n\nFollow-up on your Q1 estimate voucher. Please confirm receipt or let me know if you'd prefer me to reroute the file...",
    tone: "formal",
    aiSources: [
      { kind: "substrate", note: "rt-11 estimated payment reminder template" },
    ],
    status: "sent",
    sentAt: "2026-05-04T22:15:00Z",
    sendMethod: "cpa_send",
    templateId: "rt-11",
    createdAt: "2026-05-04T22:10:00Z",
  },

  // ── Pattern Precedent: rt-02 (W-2 follow-up #1) → Mark Sullivan ───
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

  // ── Pattern Precedent in progress: rt-05 → Acme Bayou ─────────────
  // Three approved sends so far. The UI shows "3/5 approvals" so the CPA
  // can see exactly when this template will graduate to Phase 2.
  ...["2024-04-02", "2025-04-08", "2026-04-14"].map<EmailDraft>(
    (iso, idx) => ({
      id: `ed-pp-rt05-${idx + 1}`,
      taskId: "t-d2",
      clientId: "c-la-01",
      to: "rob@acmebayou.com",
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

  // ── Phase 2 in action: two auto-fires that landed last week ───────
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
