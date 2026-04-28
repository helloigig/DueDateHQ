import type { EmailDraft } from "../types";

/**
 * A handful of email drafts in mixed statuses so the activity timelines
 * have something to render and the email-history surfaces aren't empty.
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
];
