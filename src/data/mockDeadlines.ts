import type { Deadline } from "../types";

type D = Omit<Deadline, "id">;

// Anchor: today is 2026-05-05 (Tue). Buckets:
//   · OVERDUE         = before May 5
//   · THIS WEEK       = May 5 – May 10
//   · THIS MONTH      = May 11 – May 31
//   · LONG TERM       = June onward
//   · COMPLETED / EXT = mixed historical for client-detail realism
//
// Two preparers:
//   · "Sarah Mitchell" (firm owner, primary)
//   · "Maya Patel"     (member, junior preparer; carries ~25% of load)
//
// Statuses exercised: not_started, in_progress, overdue, completed,
// filed_extension (submitted + approved), deferred, not_applicable.

const raw: D[] = [
  // ============================================================
  // OVERDUE (6) — past 2026-05-05, no completion. Old TX/CA franchise
  // and federal estimates that slipped — this is the loudest bucket
  // when Sarah opens Today, and it should bite.
  // ============================================================
  {
    clientId: "c-ca-01",
    form: "CA 568 (LLC)",
    jurisdiction: "CA",
    officialDueDate: "2026-04-20",
    internalDueDate: "2026-04-13",
    status: "overdue",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-ca-03",
    form: "Q1 estimate (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-15",
    status: "overdue",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-tx-08",
    form: "TX Franchise",
    jurisdiction: "TX",
    officialDueDate: "2026-05-01",
    internalDueDate: "2026-04-24",
    status: "overdue",
    assignedUser: "Maya Patel",
  },
  {
    clientId: "c-fl-02",
    form: "F-1120 (FL corporate)",
    jurisdiction: "FL",
    officialDueDate: "2026-05-01",
    status: "overdue",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-ny-04",
    form: "NY CT-3-S",
    jurisdiction: "NY",
    officialDueDate: "2026-05-02",
    status: "overdue",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-la-02",
    form: "LA CIFT-620",
    jurisdiction: "LA",
    officialDueDate: "2026-05-04",
    status: "overdue",
    assignedUser: "Maya Patel",
  },

  // ============================================================
  // THIS WEEK (10) — May 5 (today, Tue) through May 10 (Sun)
  // ============================================================
  {
    clientId: "c-ca-02",
    form: "CA 100S (S-Corp)",
    jurisdiction: "CA",
    officialDueDate: "2026-05-05",
    internalDueDate: "2026-04-28",
    status: "in_progress",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-ny-01",
    form: "NY IT-204-LL",
    jurisdiction: "NY",
    officialDueDate: "2026-05-05",
    status: "in_progress",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-tx-01",
    form: "TX Franchise",
    jurisdiction: "TX",
    officialDueDate: "2026-05-06",
    status: "not_started",
    assignedUser: "Maya Patel",
  },
  {
    clientId: "c-tx-03",
    form: "1120-S (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-05-06",
    status: "not_started",
    assignedUser: "Maya Patel",
  },
  {
    clientId: "c-la-03",
    form: "LA IT-540 (individual)",
    jurisdiction: "LA",
    officialDueDate: "2026-05-07",
    status: "not_started",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-fl-01",
    form: "F-1120 (FL corporate)",
    jurisdiction: "FL",
    officialDueDate: "2026-05-08",
    status: "not_started",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-pa-01",
    form: "PA RCT-101 (corporate)",
    jurisdiction: "PA",
    officialDueDate: "2026-05-08",
    status: "in_progress",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-ga-01",
    form: "GA 600S (S-Corp)",
    jurisdiction: "GA",
    officialDueDate: "2026-05-08",
    status: "not_started",
    assignedUser: "Maya Patel",
  },
  {
    clientId: "c-il-01",
    form: "IL-1065 (partnership)",
    jurisdiction: "IL",
    officialDueDate: "2026-05-10",
    status: "not_started",
    assignedUser: "Sarah Mitchell",
  },
  {
    clientId: "c-or-01",
    form: "OR-20-S (S-Corp)",
    jurisdiction: "OR",
    officialDueDate: "2026-05-10",
    status: "not_started",
    assignedUser: "Maya Patel",
  },

  // ============================================================
  // THIS MONTH (24) — May 11 through May 31
  // ============================================================
  // Week of May 11 (8)
  { clientId: "c-ca-05", form: "1120 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-11", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ny-03", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-12", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-ny-04", form: "NY CT-3-S", jurisdiction: "NY", officialDueDate: "2026-05-12", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-01", form: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-13", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-la-04", form: "LA IT-565 (partnership)", jurisdiction: "LA", officialDueDate: "2026-05-14", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-04", form: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-05-15", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ca-06", form: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-15", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-05", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-15", status: "not_started", assignedUser: "Maya Patel" },

  // Week of May 18 (8)
  { clientId: "c-ca-08", form: "1040 (extension filing)", jurisdiction: "federal", officialDueDate: "2026-05-18", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ny-05", form: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-19", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-05", form: "LA IT-540 (extension)", jurisdiction: "LA", officialDueDate: "2026-05-20", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-tx-06", form: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-21", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-fl-03", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-22", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ca-09", form: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-05-22", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-nj-01", form: "NJ-1065 (partnership)", jurisdiction: "NJ", officialDueDate: "2026-05-22", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-ma-01", form: "MA Form 2 (trust)", jurisdiction: "MA", officialDueDate: "2026-05-22", status: "not_started", assignedUser: "Sarah Mitchell" },

  // Week of May 25 (8)
  { clientId: "c-ny-06", form: "NY CT-3 (C-Corp)", jurisdiction: "NY", officialDueDate: "2026-05-26", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-06", form: "LA IT-565 (partnership)", jurisdiction: "LA", officialDueDate: "2026-05-27", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-tx-07", form: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-28", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-05", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-29", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-mi-01", form: "MI CIT (C-Corp)", jurisdiction: "MI", officialDueDate: "2026-05-29", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ga-02", form: "GA 500 (individual)", jurisdiction: "GA", officialDueDate: "2026-05-29", status: "not_started", assignedUser: "Maya Patel" },
  { clientId: "c-il-02", form: "IL-1040 (individual)", jurisdiction: "IL", officialDueDate: "2026-05-29", status: "not_started", assignedUser: "Sarah Mitchell" },
  { clientId: "c-pa-01", form: "PA RCT-101 (final)", jurisdiction: "PA", officialDueDate: "2026-05-31", status: "not_started", assignedUser: "Sarah Mitchell" },

  // ============================================================
  // LONG TERM (50) — June onward
  // ============================================================
  // Jun 15 — Q2 estimates (8)
  { clientId: "c-ca-03", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-ny-02", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-tx-04", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-la-03", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-fl-03", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-ca-08", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-ga-02", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-il-02", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },

  // July (6)
  { clientId: "c-tx-01", form: "TX Franchise (Q2)", jurisdiction: "TX", officialDueDate: "2026-07-10", status: "not_started" },
  { clientId: "c-ca-10", form: "CA PTE election", jurisdiction: "CA", officialDueDate: "2026-07-15", status: "not_started" },
  { clientId: "c-ny-01", form: "NY PTE estimate", jurisdiction: "NY", officialDueDate: "2026-07-15", status: "not_started" },
  { clientId: "c-la-01", form: "LA IT-565 (extension)", jurisdiction: "LA", officialDueDate: "2026-07-15", status: "not_started" },
  { clientId: "c-fl-04", form: "F-1120 (Q2)", jurisdiction: "FL", officialDueDate: "2026-07-31", status: "not_started" },
  { clientId: "c-or-01", form: "OR PTE election", jurisdiction: "OR", officialDueDate: "2026-07-15", status: "not_started" },

  // August (5)
  { clientId: "c-tx-08", form: "TX Franchise (extension)", jurisdiction: "TX", officialDueDate: "2026-08-15", status: "not_started" },
  { clientId: "c-ny-08", form: "NY IT-204-LL", jurisdiction: "NY", officialDueDate: "2026-08-17", status: "not_started" },
  { clientId: "c-ca-04", form: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-08-17", status: "not_started" },
  { clientId: "c-fl-06", form: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-08-31", status: "not_started" },
  { clientId: "c-ga-01", form: "GA 600 (extension)", jurisdiction: "GA", officialDueDate: "2026-08-31", status: "not_started" },

  // Sep 15 — extended 1065 / 1120-S (12)
  { clientId: "c-ca-01", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-ca-02", form: "1120-S (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-ny-01", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-ny-03", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-ny-04", form: "1120-S (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-la-02", form: "1120-S (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-la-04", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-tx-03", form: "1120-S (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-tx-05", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-fl-05", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-nj-01", form: "1065 (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },
  { clientId: "c-or-01", form: "1120-S (extension)", jurisdiction: "federal", officialDueDate: "2026-09-15", status: "not_started" },

  // Oct 15 — extended individual / C-Corp (12) — including the Mark Sullivan
  // extension that was approved on Apr 15 (cross-references the "filed_extension"
  // entry at the bottom via extensionOfDeadlineId).
  {
    clientId: "c-ca-03",
    form: "1040 (extension)",
    jurisdiction: "federal",
    officialDueDate: "2026-10-15",
    status: "not_started",
    extensionOfDeadlineId: "d-ext-mark-1040", // resolves to original below
  },
  { clientId: "c-ca-05", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ny-02", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ny-06", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ny-07", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-tx-04", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-tx-06", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-la-03", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-fl-03", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-fl-04", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-pa-01", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-mi-01", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },

  // November (5)
  { clientId: "c-ca-06", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-ny-05", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-tx-07", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-la-07", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-ma-01", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },

  // December (8)
  { clientId: "c-ca-01", form: "CA annual LLC fee", jurisdiction: "CA", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-ca-07", form: "CA annual LLC fee", jurisdiction: "CA", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-ca-09", form: "CA annual LLC fee", jurisdiction: "CA", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-ny-08", form: "NY sales tax Q4", jurisdiction: "NY", officialDueDate: "2026-12-20", status: "not_started" },
  { clientId: "c-tx-02", form: "TX Franchise (extension)", jurisdiction: "TX", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-fl-01", form: "Q4 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-fl-07", form: "Q4 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-il-01", form: "IL annual LLC fee", jurisdiction: "IL", officialDueDate: "2026-12-15", status: "not_started" },

  // ============================================================
  // COMPLETED (10) — recent for activity timelines + history feel
  // ============================================================
  { clientId: "c-la-01", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2026-03-15", status: "completed", completedAt: "2026-03-12", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-01", form: "LA CIFT-620", jurisdiction: "LA", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-10", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-01", form: "Q4 2025 estimate", jurisdiction: "federal", officialDueDate: "2026-01-15", status: "completed", completedAt: "2026-01-14", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ny-06", form: "Q4 2025 estimate", jurisdiction: "federal", officialDueDate: "2026-01-15", status: "completed", completedAt: "2026-01-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ca-05", form: "Q1 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-11", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-06", form: "Q1 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-12", assignedUser: "Maya Patel" },
  { clientId: "c-ny-02", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-09", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-04", form: "Q1 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-10", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ga-02", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-08", assignedUser: "Maya Patel" },
  { clientId: "c-il-02", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-12", assignedUser: "Sarah Mitchell" },

  // ============================================================
  // FILED_EXTENSION lifecycle (3 examples spanning the lifecycle)
  // ============================================================
  // 1. Mark Sullivan 1040 — submitted Apr 14, approved 2h later. The new
  //    extension-period deadline above (c-ca-03 / 1040 (extension), Oct 15)
  //    references this id via extensionOfDeadlineId.
  {
    clientId: "c-ca-03",
    form: "1040 (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-15",
    status: "filed_extension",
    completedAt: "2026-04-15",
    assignedUser: "Sarah Mitchell",
    extensionSubmittedAt: "2026-04-14T10:00:00Z",
    extensionApprovedAt: "2026-04-15T14:30:00Z",
    linkedExtensionDeadlineId: "d-ext-mark-1040-target",
  },
  // 2. Empire Advisory 1120-S — submitted Mar 14, awaiting approval (the
  //    "submitted but pending" state — Sarah should still see this in her
  //    timeline as a watch item).
  {
    clientId: "c-ny-04",
    form: "1120-S (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-03-15",
    status: "filed_extension",
    completedAt: "2026-03-14",
    assignedUser: "Sarah Mitchell",
    extensionSubmittedAt: "2026-03-14T09:00:00Z",
    // no extensionApprovedAt yet
  },
  // 3. Coastal Tech LLC 1065 — submitted + approved cleanly in March.
  //    Demonstrates the "happy path" extension that's no longer noisy.
  {
    clientId: "c-ca-07",
    form: "1065 (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-03-15",
    status: "filed_extension",
    completedAt: "2026-03-13",
    assignedUser: "Sarah Mitchell",
    extensionSubmittedAt: "2026-03-13T11:00:00Z",
    extensionApprovedAt: "2026-03-13T16:45:00Z",
  },

  // ============================================================
  // DEFERRED (2) — pushed by the firm on purpose. Distinct from
  // not_applicable (kill); deferred = "we'll come back to this."
  // ============================================================
  {
    clientId: "c-ca-04",
    form: "Sales tax Q1 (CA CDTFA)",
    jurisdiction: "CA",
    officialDueDate: "2026-04-30",
    status: "deferred",
    assignedUser: "Sarah Mitchell",
    notes: "Deferred — client is restructuring entity; revisit after May 15.",
  },
  {
    clientId: "c-tx-02",
    form: "TX Franchise (Q1)",
    jurisdiction: "TX",
    officialDueDate: "2026-04-30",
    status: "deferred",
    assignedUser: "Maya Patel",
    notes: "Deferred pending updated revenue numbers from QBO export.",
  },

  // ============================================================
  // PRIOR-YEAR HISTORY (tax year 2024, filed in 2025) — backfilled
  // 2026-05-06 so every active client added before 2025 has at least
  // one completed annual return on record. Without this, ~38 of 49
  // clients had no past-filings on their detail page, making the
  // demo read like a brand-new firm rather than an established one
  // that's been with these clients for years. One federal annual
  // return per client, dated to the 2025 filing season window.
  // ============================================================
  { clientId: "c-ca-06", form: "1041 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-09", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ca-09", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ca-10", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Maya Patel" },
  { clientId: "c-ny-01", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ny-03", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ny-05", form: "1041 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-09", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-01", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-03", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-05", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-tx-08", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Maya Patel" },
  { clientId: "c-la-02", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-03", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-08", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-06", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-la-07", form: "1041 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-09", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-01", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-02", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-03", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-08", assignedUser: "Sarah Mitchell" },
  { clientId: "c-fl-05", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ga-01", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-il-01", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-pa-01", form: "1120 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-09", assignedUser: "Sarah Mitchell" },
  { clientId: "c-nj-01", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
  { clientId: "c-ma-01", form: "1041 (federal)", jurisdiction: "federal", officialDueDate: "2025-04-15", status: "completed", completedAt: "2025-04-09", assignedUser: "Sarah Mitchell" },
  { clientId: "c-or-01", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2025-03-17", status: "completed", completedAt: "2025-03-13", assignedUser: "Sarah Mitchell" },
];

// We assign IDs deterministically so cross-references (the
// `extensionOfDeadlineId` / `linkedExtensionDeadlineId` pair on Mark
// Sullivan's 1040) resolve to stable strings. The pair uses two named ids
// so the FE can navigate from original → extension and back.
export const deadlines: Deadline[] = raw.map((d, i) => {
  const id = `d-${String(i + 1).padStart(3, "0")}`;
  // Patch in the named ids for the Mark Sullivan extension pair so the
  // cross-references survive future reordering.
  if (d.clientId === "c-ca-03" && d.status === "filed_extension") {
    return { ...d, id: "d-ext-mark-1040" };
  }
  if (
    d.clientId === "c-ca-03" &&
    d.form === "1040 (extension)" &&
    d.officialDueDate === "2026-10-15"
  ) {
    return { ...d, id: "d-ext-mark-1040-target" };
  }
  return { id, ...d };
});
