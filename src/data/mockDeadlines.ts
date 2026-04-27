import type { Deadline } from "../types";

type D = Omit<Deadline, "id">;

const raw: D[] = [
  // ============================================================
  // OVERDUE (2) — past today (2026-04-23), no completion
  // ============================================================
  {
    clientId: "c-ca-01",
    form: "CA 568 (LLC)",
    jurisdiction: "CA",
    officialDueDate: "2026-04-20",
    status: "overdue",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-ca-03",
    form: "Q1 estimate (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-22",
    status: "overdue",
    assignedUser: "Sarah Chen",
  },

  // ============================================================
  // THIS WEEK (8) — Apr 23 (Thu) through Apr 26 (Sun)
  // ============================================================
  {
    clientId: "c-la-01",
    form: "1065 (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-23",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-ny-07",
    form: "1040 (extension filing)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-23",
    status: "in_progress",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-la-02",
    form: "1120-S (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-24",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-tx-02",
    form: "Q1 estimate (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-24",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-ca-07",
    form: "CA 568 (LLC)",
    jurisdiction: "CA",
    officialDueDate: "2026-04-25",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-tx-04",
    form: "1040 (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-25",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-ny-02",
    form: "1040 (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-26",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },
  {
    clientId: "c-fl-02",
    form: "Q1 estimate (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-26",
    status: "not_started",
    assignedUser: "Sarah Chen",
  },

  // ============================================================
  // THIS MONTH (23) — Apr 27 through May 31
  // ============================================================
  // Week of May 4 (5)
  { clientId: "c-ca-02", form: "CA 100S (S-Corp)", jurisdiction: "CA", officialDueDate: "2026-05-04", status: "not_started" },
  { clientId: "c-ny-01", form: "NY IT-204-LL", jurisdiction: "NY", officialDueDate: "2026-05-05", status: "not_started" },
  { clientId: "c-tx-03", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2026-05-06", status: "not_started" },
  { clientId: "c-la-03", form: "LA IT-540 (individual)", jurisdiction: "LA", officialDueDate: "2026-05-07", status: "not_started" },
  { clientId: "c-fl-01", form: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-05-08", status: "not_started" },

  // Week of May 11 (8)
  { clientId: "c-ca-05", form: "1120 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-11", status: "not_started" },
  { clientId: "c-ny-03", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-12", status: "not_started" },
  { clientId: "c-ny-04", form: "NY CT-3-S", jurisdiction: "NY", officialDueDate: "2026-05-12", status: "not_started" },
  { clientId: "c-tx-01", form: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-13", status: "not_started" },
  { clientId: "c-la-04", form: "LA IT-565 (partnership)", jurisdiction: "LA", officialDueDate: "2026-05-14", status: "not_started" },
  { clientId: "c-fl-04", form: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-05-15", status: "not_started" },
  { clientId: "c-ca-06", form: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-15", status: "not_started" },
  { clientId: "c-tx-05", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-15", status: "not_started" },

  // Week of May 18 (6)
  { clientId: "c-ca-08", form: "1040 (extension filing)", jurisdiction: "federal", officialDueDate: "2026-05-18", status: "not_started" },
  { clientId: "c-ny-05", form: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-19", status: "not_started" },
  { clientId: "c-la-05", form: "LA IT-540 (extension)", jurisdiction: "LA", officialDueDate: "2026-05-20", status: "not_started" },
  { clientId: "c-tx-06", form: "TX Franchise", jurisdiction: "TX", officialDueDate: "2026-05-21", status: "not_started" },
  { clientId: "c-fl-03", form: "1040 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-22", status: "not_started" },
  { clientId: "c-ca-09", form: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-05-22", status: "not_started" },

  // Week of May 25 (4)
  { clientId: "c-ny-06", form: "NY CT-3 (C-Corp)", jurisdiction: "NY", officialDueDate: "2026-05-26", status: "not_started" },
  { clientId: "c-la-06", form: "LA IT-565 (partnership)", jurisdiction: "LA", officialDueDate: "2026-05-27", status: "not_started" },
  { clientId: "c-tx-07", form: "1041 (trust)", jurisdiction: "federal", officialDueDate: "2026-05-28", status: "not_started" },
  { clientId: "c-fl-05", form: "1065 (federal)", jurisdiction: "federal", officialDueDate: "2026-05-29", status: "not_started" },

  // ============================================================
  // LONG TERM (47) — June onward
  // ============================================================
  // Jun 15 — Q2 estimates (6)
  { clientId: "c-ca-03", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-ny-02", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-tx-04", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-la-03", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-fl-03", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },
  { clientId: "c-ca-08", form: "Q2 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-06-15", status: "not_started" },

  // July (5)
  { clientId: "c-tx-01", form: "TX Franchise (Q2)", jurisdiction: "TX", officialDueDate: "2026-07-10", status: "not_started" },
  { clientId: "c-ca-10", form: "CA PTE election", jurisdiction: "CA", officialDueDate: "2026-07-15", status: "not_started" },
  { clientId: "c-ny-01", form: "NY PTE estimate", jurisdiction: "NY", officialDueDate: "2026-07-15", status: "not_started" },
  { clientId: "c-la-01", form: "LA IT-565 (extension)", jurisdiction: "LA", officialDueDate: "2026-07-15", status: "not_started" },
  { clientId: "c-fl-04", form: "F-1120 (Q2)", jurisdiction: "FL", officialDueDate: "2026-07-31", status: "not_started" },

  // August (4)
  { clientId: "c-tx-08", form: "TX Franchise (extension)", jurisdiction: "TX", officialDueDate: "2026-08-15", status: "not_started" },
  { clientId: "c-ny-08", form: "NY IT-204-LL", jurisdiction: "NY", officialDueDate: "2026-08-17", status: "not_started" },
  { clientId: "c-ca-04", form: "CA 568 (LLC)", jurisdiction: "CA", officialDueDate: "2026-08-17", status: "not_started" },
  { clientId: "c-fl-06", form: "F-1120 (FL corporate)", jurisdiction: "FL", officialDueDate: "2026-08-31", status: "not_started" },

  // Sep 15 — extended 1065 / 1120-S (10)
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

  // Oct 15 — extended individual / C-Corp (10)
  { clientId: "c-ca-03", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ca-05", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ny-02", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ny-06", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-ny-07", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-tx-04", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-tx-06", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-la-03", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-fl-03", form: "1040 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },
  { clientId: "c-fl-04", form: "1120 (extension)", jurisdiction: "federal", officialDueDate: "2026-10-15", status: "not_started" },

  // November (5)
  { clientId: "c-ca-06", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-ny-05", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-tx-07", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-la-07", form: "1041 (extension)", jurisdiction: "federal", officialDueDate: "2026-11-02", status: "not_started" },
  { clientId: "c-la-07", form: "LA IT-541 (trust)", jurisdiction: "LA", officialDueDate: "2026-11-15", status: "not_started" },

  // December (7)
  { clientId: "c-ca-01", form: "CA annual LLC fee", jurisdiction: "CA", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-ca-07", form: "CA annual LLC fee", jurisdiction: "CA", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-ca-09", form: "CA annual LLC fee", jurisdiction: "CA", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-ny-08", form: "NY sales tax Q4", jurisdiction: "NY", officialDueDate: "2026-12-20", status: "not_started" },
  { clientId: "c-tx-02", form: "TX Franchise (extension)", jurisdiction: "TX", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-fl-01", form: "Q4 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-12-15", status: "not_started" },
  { clientId: "c-fl-07", form: "Q4 estimate (federal)", jurisdiction: "federal", officialDueDate: "2026-12-15", status: "not_started" },

  // ============================================================
  // COMPLETED (a few, for client detail realism)
  // ============================================================
  { clientId: "c-la-01", form: "1120-S (federal)", jurisdiction: "federal", officialDueDate: "2026-03-15", status: "completed", completedAt: "2026-03-12" },
  { clientId: "c-la-01", form: "LA CIFT-620", jurisdiction: "LA", officialDueDate: "2026-04-15", status: "completed", completedAt: "2026-04-10" },
  { clientId: "c-la-01", form: "Q4 2025 estimate", jurisdiction: "federal", officialDueDate: "2026-01-15", status: "completed", completedAt: "2026-01-14" },
  {
    clientId: "c-ca-03",
    form: "1040 (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-04-15",
    status: "filed_extension",
    completedAt: "2026-04-15",
    extensionSubmittedAt: "2026-04-14T10:00:00Z",
    extensionApprovedAt: "2026-04-15T14:30:00Z",
  },
  {
    clientId: "c-ny-04",
    form: "1120-S (federal)",
    jurisdiction: "federal",
    officialDueDate: "2026-03-15",
    status: "filed_extension",
    completedAt: "2026-03-14",
    extensionSubmittedAt: "2026-03-14T09:00:00Z",
    // no extensionApprovedAt — awaiting approval
  },
];

export const deadlines: Deadline[] = raw.map((d, i) => ({
  id: `d-${String(i + 1).padStart(3, "0")}`,
  ...d,
}));
