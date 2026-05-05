import type { AiInsight } from "../types";

/**
 * Mode E proactive cross-year insights, plus a few Mode B/C aggregates.
 * Surfaces in the AI insights panel on Client and Task detail. Cold-start
 * fallback (PRD §4.2) replaces these when ImportedFact history is missing.
 */
export const aiInsights: AiInsight[] = [
  {
    id: "ai-ins-001",
    clientId: "c-ca-03",
    mode: "E",
    title: "Schedule E disappeared after 5 years",
    detail:
      "Mark reported Schedule E (Sunset Beach rental, ~$42K gross) for 5 consecutive years — 2020-2024. This year, no Schedule E filed. Did the property sell? If so, plan for Schedule D capital gains.",
    actions: ["ask_client", "schedule_advisory", "mark_known", "snooze"],
    status: "open",
    createdAt: "2026-04-12T10:00:00Z",
  },
  {
    id: "ai-ins-002",
    clientId: "c-ca-02",
    mode: "E",
    title: "Wages climbed $80K → $200K",
    detail:
      "Pacific Ridge S-Corp officer wages rose 150% year over year. Worth a conversation about maxing 401(k) contributions and Solo-K eligibility for next year.",
    actions: ["ask_client", "schedule_advisory", "mark_known", "snooze"],
    status: "open",
    createdAt: "2026-04-15T10:00:00Z",
  },
  {
    id: "ai-ins-003",
    clientId: "c-la-01",
    mode: "B",
    title: "K-1 typically arrives Aug 6-12",
    detail:
      "Across 3 prior years, this client's K-1 from Apex Fund arrives between Aug 6 and Aug 12. Schedule the first reminder for early August, not at deadline minus 21.",
    actions: ["mark_known"],
    status: "open",
    createdAt: "2026-04-18T10:00:00Z",
  },
  {
    id: "ai-ins-004",
    clientId: "c-ny-07",
    mode: "C",
    title: "Wages dropped 33% versus prior year",
    detail:
      "W-2 received shows $80K — last year was $120K. Could be a job change, a reduced-hours year, or the wrong year's W-2 sent by mistake.",
    actions: ["ask_client", "mark_known"],
    status: "open",
    createdAt: "2026-04-20T10:00:00Z",
  },
];
