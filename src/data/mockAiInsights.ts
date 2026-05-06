import type { AiInsight } from "../types";

/**
 * cross-year-insighter proactive cross-year insights, plus a few
 * arrival-timing / anomaly-detector aggregates. Surfaces in the AI
 * insights panel on Client and Task detail. Cold-start fallback (PRD
 * §4.2) replaces these when ImportedFact history is missing.
 *
 * Coverage: all 3 modes (B/C/E), all 3 statuses (open/resolved/snoozed),
 * all 4 action types (ask_client / schedule_advisory / mark_known /
 * snooze), spread across 9 clients spanning 5 entity types.
 */
export const aiInsights: AiInsight[] = [
  // ── E: cross-year — Mark Sullivan's Schedule E disappearance (flagship)
  {
    id: "ai-ins-001",
    clientId: "c-ca-03",
    mode: "E",
    title: "Schedule E disappeared after 5 years",
    detail:
      "Mark reported Schedule E (Sunset Beach rental, ~$42K gross) for 5 consecutive years — 2020-2024. This year, no Schedule E filed. Did the property sell? If so, plan for Schedule D capital gains.",
    actions: ["ask_client", "schedule_advisory", "mark_known", "snooze"],
    status: "open",
    createdAt: "2026-05-01T09:14:00Z",
  },

  // ── E: cross-year — Pacific Ridge wages doubled (advisory opportunity)
  {
    id: "ai-ins-002",
    clientId: "c-ca-02",
    mode: "E",
    title: "Wages climbed $80K → $200K",
    detail:
      "Pacific Ridge S-Corp officer wages rose 150% year over year. Worth a conversation about maxing 401(k) contributions and Solo-K eligibility for next year.",
    actions: ["ask_client", "schedule_advisory", "mark_known", "snooze"],
    status: "open",
    createdAt: "2026-04-28T10:00:00Z",
  },

  // ── B: arrival-timing — Acme Bayou's K-1 cadence
  {
    id: "ai-ins-003",
    clientId: "c-la-01",
    mode: "B",
    title: "K-1 typically arrives Aug 6-12",
    detail:
      "Across 3 prior years, this client's K-1 from Apex Fund arrives between Aug 6 and Aug 12. Schedule the first reminder for early August, not at deadline minus 21.",
    actions: ["mark_known"],
    status: "open",
    createdAt: "2026-05-04T10:00:00Z",
  },

  // ── C: anomaly — Daniel O'Brien's wages dropped (unresolved)
  {
    id: "ai-ins-004",
    clientId: "c-ny-07",
    mode: "C",
    title: "Wages dropped 33% versus prior year",
    detail:
      "W-2 received shows $80K — last year was $120K. Could be a job change, a reduced-hours year, or the wrong year's W-2 sent by mistake.",
    actions: ["ask_client", "mark_known"],
    status: "open",
    createdAt: "2026-05-03T10:00:00Z",
  },

  // ── E: cross-year — Madison Labs RSU vesting opportunity
  {
    id: "ai-ins-005",
    clientId: "c-ny-06",
    mode: "E",
    title: "Series B closed Q1 — RSU vesting starts Q3",
    detail:
      "Madison Labs raised in Q1 with new equity comp triggering Q3. Q3-Q4 estimates need a substantial true-up; year-end planning call recommended in November.",
    actions: ["schedule_advisory", "mark_known"],
    status: "open",
    createdAt: "2026-04-30T16:20:00Z",
  },

  // ── E: RESOLVED — Carlos Mendoza's prior insight Sarah closed out
  {
    id: "ai-ins-006",
    clientId: "c-fl-03",
    mode: "E",
    title: "1099-NEC consulting income climbed 4x",
    detail:
      "Carlos's 1099-NEC contractor income went from $24K to $96K. Discussed S-Corp election in February call; client opted to wait one more year. Closed.",
    actions: ["mark_known"],
    status: "resolved",
    createdAt: "2026-02-18T14:00:00Z",
  },

  // ── B: SNOOZED — Hill Country Winery's K-1 timing (snoozed til July)
  {
    id: "ai-ins-007",
    clientId: "c-tx-05",
    mode: "B",
    title: "Partner capital schedules arrive late June",
    detail:
      "Three-year pattern: capital schedules arrive June 22-28. Snoozed reminder cadence until June 15 to avoid early-chase noise.",
    actions: ["mark_known"],
    status: "snoozed",
    createdAt: "2026-04-22T11:00:00Z",
  },

  // ── C: anomaly — Granite Ventures Q1 estimate computation flag
  {
    id: "ai-ins-008",
    clientId: "c-ca-10",
    mode: "C",
    title: "Q1 estimate 40% lower than prior quarter",
    detail:
      "Granite's Q1 federal estimate landed at $12,400 vs. Q4 2025's $20,800. Either income dropped (real) or the QBO export pulled the wrong period — verify before sending the voucher.",
    actions: ["ask_client", "mark_known"],
    status: "open",
    createdAt: "2026-04-18T15:30:00Z",
  },

  // ── E: opportunity — Lakeshore Realty + Daniel Voss related-entity
  // planning. Demonstrates an insight that spans related clients.
  {
    id: "ai-ins-009",
    clientId: "c-il-01",
    mode: "E",
    title: "Cost-segregation study eligible — 2 properties acquired in 2025",
    detail:
      "Lakeshore Realty acquired two Cook County properties in 2025 (combined basis $4.2M). Cost-seg study could accelerate ~$380K of depreciation; pairs with Daniel Voss's individual return for pass-through impact.",
    actions: ["schedule_advisory", "ask_client", "snooze"],
    status: "open",
    createdAt: "2026-04-25T09:45:00Z",
  },

  // ── C: anomaly — Allegheny Forge officer comp dropped
  {
    id: "ai-ins-010",
    clientId: "c-pa-01",
    mode: "C",
    title: "Officer comp dropped to $0 mid-year",
    detail:
      "Allegheny Forge's officer compensation reported through Q3 then stopped. Either officer transitioned out (real) or W-2s for Q4 weren't filed (issue). Confirm before issuing K-1s.",
    actions: ["ask_client", "schedule_advisory"],
    status: "open",
    createdAt: "2026-05-02T12:00:00Z",
  },
];
