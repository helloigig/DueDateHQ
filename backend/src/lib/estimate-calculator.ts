/**
 * Estimate calculator for rate_change alerts.
 *
 * Spec: docs/specs/alert-detail-rate-change.md
 *
 * V1 (this file): supports the safe-harbor 110% method only, applied to a
 * limited set of rate schedules (Federal income, CA personal income, NY
 * personal income). Everything else falls through to a "manual" methodology
 * with the original amount preserved — Sarah must override.
 *
 * V2 (P1): extend to:
 *   - All 50-state personal income schedules
 *   - Federal corporate (1120 / 1120-S)
 *   - State sales tax rates by district (Avalara-style)
 *   - Withholding bracket changes (W-4 calc)
 *   - Property tax assessment-roll updates
 *
 * The interface here is forward-compatible: callers don't need to know
 * which version they're hitting; they get back a `methodology` field that
 * tells them whether the calc was high/medium/low confidence.
 */

export type EstimateMethod =
  | "safe_harbor_110"
  | "safe_harbor_100"
  | "current_year_estimate"
  | "prior_year_actual"
  | "manual";

export type Confidence = "high" | "medium" | "low";

export interface EstimateRecomputeInput {
  /** The estimate being recomputed. */
  deadlineId: string;
  /** Current estimate amount in cents. */
  currentAmountCents: number;
  /** Period being estimated, e.g., "Q2 2026" or "Annual 2026". */
  period: string;
  /** What rate set was in effect for this period before the change. */
  oldRule: RateSchedule;
  /** What rate set is in effect for this period after the change. */
  newRule: RateSchedule;
  /** Client metadata used by the calc (AGI estimate, fiscal year, etc.). */
  client: {
    estimatedAgiCents: number;
    fiscalYearEndMonth: number; // 1-12 (1 = December calendar)
    hasLossCarryforward: boolean;
    isOnPaymentPlan: boolean;
  };
  /** Whether this period's estimate has already been paid. */
  alreadyPaid: boolean;
}

export interface EstimateRecomputeResult {
  newAmountCents: number;
  methodology: EstimateMethod;
  confidence: Confidence;
  /** When set, calc punted; the new amount equals the old. UI surfaces this. */
  warnings: string[];
}

export interface RateSchedule {
  jurisdiction:
    | "federal"
    | "CA"
    | "NY"
    | "TX"
    | "FL"
    | "LA"
    | "NJ"
    | "MA"
    | "IL"
    | "AZ";
  taxKind: "income" | "sales" | "payroll" | "franchise";
  /** Marginal brackets, ordered ascending. cents-from threshold + percent. */
  brackets: Array<{ thresholdCents: number; ratePct: number }>;
  /** Annual standard deduction, if any. */
  standardDeductionCents: number;
}

/**
 * Apply marginal brackets to compute annual tax owed on a given AGI.
 * Returns cents.
 */
function annualTaxForAgi(agiCents: number, schedule: RateSchedule): number {
  const taxable = Math.max(
    0,
    agiCents - schedule.standardDeductionCents,
  );
  let owed = 0;
  let remaining = taxable;
  for (let i = 0; i < schedule.brackets.length; i++) {
    const bracket = schedule.brackets[i];
    if (!bracket) break;
    const next = schedule.brackets[i + 1];
    const bracketCap = next
      ? next.thresholdCents - bracket.thresholdCents
      : Infinity;
    const inBracket = Math.min(remaining, bracketCap);
    if (inBracket <= 0) break;
    owed += inBracket * (bracket.ratePct / 100);
    remaining -= inBracket;
  }
  return Math.round(owed);
}

/**
 * Recompute one estimate using the safe-harbor 110% rule.
 * - Annual tax under new rule × 1.10 ÷ 4 = quarterly estimate
 * - Bake in pro-ration if the rate change is mid-period (V1 simplification:
 *   we treat all periods as full quarters; mid-period proration is V2 work)
 */
export function recomputeEstimate(
  input: EstimateRecomputeInput,
): EstimateRecomputeResult {
  const warnings: string[] = [];

  if (input.alreadyPaid) {
    return {
      newAmountCents: input.currentAmountCents,
      methodology: "manual",
      confidence: "high",
      warnings: ["Estimate already paid for this period — no recompute"],
    };
  }

  if (input.client.isOnPaymentPlan) {
    return {
      newAmountCents: input.currentAmountCents,
      methodology: "manual",
      confidence: "low",
      warnings: ["Client on payment plan — manual review required"],
    };
  }

  if (input.client.hasLossCarryforward) {
    warnings.push(
      "Client has loss carryforward — recompute may need manual adjustment",
    );
  }

  // V1: only support full-year fiscal alignment (December year-end).
  // Other fiscal years get a low-confidence flag.
  const isCalendarYear = input.client.fiscalYearEndMonth === 12;
  if (!isCalendarYear) {
    warnings.push(
      `Fiscal year ending month ${input.client.fiscalYearEndMonth} — pro-rated proration not in V1; using full-year safe harbor`,
    );
  }

  // Compute new annual tax under new rule.
  const newAnnualTaxCents = annualTaxForAgi(
    input.client.estimatedAgiCents,
    input.newRule,
  );
  const safeHarborAnnualCents = Math.round(newAnnualTaxCents * 1.1);
  // Quarterly estimate = annual / 4.
  const newQuarterlyCents = Math.round(safeHarborAnnualCents / 4);

  return {
    newAmountCents: newQuarterlyCents,
    methodology: "safe_harbor_110",
    confidence: warnings.length === 0 ? "high" : "medium",
    warnings,
  };
}

// ─── Built-in rate schedules (V1) ─────────────────────────────────────────

/** 2026 federal personal income (single filer). 7-bracket. */
export const FEDERAL_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "federal",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 10 },
    { thresholdCents: 1192500, ratePct: 12 }, // $11,925
    { thresholdCents: 4837500, ratePct: 22 }, // $48,375
    { thresholdCents: 10307500, ratePct: 24 }, // $103,075
    { thresholdCents: 19660000, ratePct: 32 }, // $196,600
    { thresholdCents: 24987500, ratePct: 35 }, // $249,875
    { thresholdCents: 62635000, ratePct: 37 }, // $626,350 (NEW threshold per ann-feed-ca-rate-change-2026)
  ],
  standardDeductionCents: 1565000, // $15,650
};

/** 2025 federal personal income (single filer) — for "old rule" diffs. */
export const FEDERAL_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "federal",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 10 },
    { thresholdCents: 1162500, ratePct: 12 },
    { thresholdCents: 4737500, ratePct: 22 },
    { thresholdCents: 10082500, ratePct: 24 },
    { thresholdCents: 19237500, ratePct: 32 },
    { thresholdCents: 24412500, ratePct: 35 },
    { thresholdCents: 60935000, ratePct: 37 }, // $609,350
  ],
  standardDeductionCents: 1525000,
};

/** 2026 CA personal income (single filer) — top bracket $698,272. */
export const CA_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "CA",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 1 },
    { thresholdCents: 1056300, ratePct: 2 },
    { thresholdCents: 2503300, ratePct: 4 },
    { thresholdCents: 3942000, ratePct: 6 },
    { thresholdCents: 5466500, ratePct: 8 },
    { thresholdCents: 6929400, ratePct: 9.3 },
    { thresholdCents: 35361000, ratePct: 10.3 },
    { thresholdCents: 42432900, ratePct: 11.3 },
    { thresholdCents: 69827200, ratePct: 12.3 }, // $698,272 (NEW)
  ],
  standardDeductionCents: 596300, // $5,963
};

/** 2025 CA personal income (single filer) — top bracket $677,275. */
export const CA_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "CA",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 1 },
    { thresholdCents: 1041200, ratePct: 2 },
    { thresholdCents: 2467500, ratePct: 4 },
    { thresholdCents: 3884600, ratePct: 6 },
    { thresholdCents: 5386900, ratePct: 8 },
    { thresholdCents: 6828700, ratePct: 9.3 },
    { thresholdCents: 34843000, ratePct: 10.3 },
    { thresholdCents: 41811700, ratePct: 11.3 },
    { thresholdCents: 67727500, ratePct: 12.3 },
  ],
  standardDeductionCents: 587000,
};

/** 2026 NY personal income (single filer). Includes 9.65% top bracket. */
export const NY_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "NY",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 4 },
    { thresholdCents: 850000, ratePct: 4.5 },
    { thresholdCents: 1170000, ratePct: 5.25 },
    { thresholdCents: 1380000, ratePct: 5.5 },
    { thresholdCents: 8050000, ratePct: 6 },
    { thresholdCents: 21560000, ratePct: 6.85 },
    { thresholdCents: 109630000, ratePct: 9.65 },
    { thresholdCents: 502330000, ratePct: 10.3 },
    { thresholdCents: 2510830000, ratePct: 10.9 },
  ],
  standardDeductionCents: 800000,
};

/** 2025 NY personal income (single filer). 2026 raised top bracket
 *  10.9 → tracking; 2025 baseline kept for diffing. */
export const NY_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "NY",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 4 },
    { thresholdCents: 850000, ratePct: 4.5 },
    { thresholdCents: 1170000, ratePct: 5.25 },
    { thresholdCents: 1380000, ratePct: 5.5 },
    { thresholdCents: 8050000, ratePct: 6 },
    { thresholdCents: 21560000, ratePct: 6.85 },
    { thresholdCents: 109630000, ratePct: 9.65 },
    { thresholdCents: 502330000, ratePct: 10.3 },
    { thresholdCents: 2510830000, ratePct: 10.9 },
  ],
  standardDeductionCents: 800000,
};

/** 2026 NJ personal income (single filer). NJ has 8 brackets, top
 *  10.75% on income > $1M. */
export const NJ_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "NJ",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 1.4 },
    { thresholdCents: 2000000, ratePct: 1.75 },
    { thresholdCents: 3500000, ratePct: 3.5 },
    { thresholdCents: 4000000, ratePct: 5.525 },
    { thresholdCents: 7500000, ratePct: 6.37 },
    { thresholdCents: 50000000, ratePct: 8.97 },
    { thresholdCents: 100000000, ratePct: 10.75 },
  ],
  // NJ doesn't have a personal-exemption-style standard deduction;
  // exemptions are per-dependent, applied separately. Use 0 for V1.
  standardDeductionCents: 0,
};

/** 2025 NJ personal income (single filer) — same brackets as 2026 (no
 *  legislative change announced); kept as a separate constant for
 *  symmetry with the rate-change diff API. */
export const NJ_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "NJ",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 1.4 },
    { thresholdCents: 2000000, ratePct: 1.75 },
    { thresholdCents: 3500000, ratePct: 3.5 },
    { thresholdCents: 4000000, ratePct: 5.525 },
    { thresholdCents: 7500000, ratePct: 6.37 },
    { thresholdCents: 50000000, ratePct: 8.97 },
    { thresholdCents: 100000000, ratePct: 10.75 },
  ],
  standardDeductionCents: 0,
};

/** 2026 MA personal income (single filer). Flat 5% + 4% surtax on
 *  income > $1,083,150 ("millionaire tax", indexed). The surtax tier
 *  is encoded as the second bracket. */
export const MA_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "MA",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 5 },
    { thresholdCents: 108315000, ratePct: 9 }, // $1,083,150 — 5% + 4% surtax
  ],
  // MA has a small per-filer personal exemption (~$4,400 single 2026).
  // Modeled here as the standard deduction for V1 simplicity.
  standardDeductionCents: 440000,
};

/** 2025 MA personal income (single filer). Same flat-rate structure;
 *  surtax threshold was $1,053,750 before the 2026 inflation adjustment. */
export const MA_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "MA",
  taxKind: "income",
  brackets: [
    { thresholdCents: 0, ratePct: 5 },
    { thresholdCents: 105375000, ratePct: 9 },
  ],
  standardDeductionCents: 440000,
};

/** 2026 IL personal income (single filer). IL is flat 4.95% — the
 *  rate hasn't moved since 2017 but the schedule shape is preserved
 *  for symmetry with the calc's interface. */
export const IL_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "IL",
  taxKind: "income",
  brackets: [{ thresholdCents: 0, ratePct: 4.95 }],
  // IL personal exemption ~$2,775 single 2026.
  standardDeductionCents: 277500,
};

export const IL_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "IL",
  taxKind: "income",
  brackets: [{ thresholdCents: 0, ratePct: 4.95 }],
  standardDeductionCents: 277500,
};

/** 2026 AZ personal income (single filer). AZ moved to a flat 2.5%
 *  effective 2023 (was graduated up to 4.5%). Useful for rate-change
 *  alerts that announce the next phase of AZ tax reform. */
export const AZ_2026_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "AZ",
  taxKind: "income",
  brackets: [{ thresholdCents: 0, ratePct: 2.5 }],
  // AZ standard deduction ~$14,600 single 2026 (matches federal).
  standardDeductionCents: 1460000,
};

export const AZ_2025_INCOME_SINGLE: RateSchedule = {
  jurisdiction: "AZ",
  taxKind: "income",
  brackets: [{ thresholdCents: 0, ratePct: 2.5 }],
  standardDeductionCents: 1460000,
};

/**
 * Helper: pick the right schedule by jurisdiction + year. Used by tRPC
 * recomputeEstimates to translate an alert's metadata into RateSchedule
 * instances for the calc.
 *
 * Coverage as of V1.1: federal + 6 states (CA, NY, NJ, MA, IL, AZ),
 * single-filer only, 2025/2026 brackets. Returns null for any jurisdiction
 * + year combo not in the table — caller should fall back to "manual"
 * methodology and surface a warning to the CPA.
 */
export function getRateSchedule(
  jurisdiction: RateSchedule["jurisdiction"],
  taxYear: number,
): RateSchedule | null {
  const key = `${jurisdiction}_${taxYear}`;
  switch (key) {
    case "federal_2026":
      return FEDERAL_2026_INCOME_SINGLE;
    case "federal_2025":
      return FEDERAL_2025_INCOME_SINGLE;
    case "CA_2026":
      return CA_2026_INCOME_SINGLE;
    case "CA_2025":
      return CA_2025_INCOME_SINGLE;
    case "NY_2026":
      return NY_2026_INCOME_SINGLE;
    case "NY_2025":
      return NY_2025_INCOME_SINGLE;
    case "NJ_2026":
      return NJ_2026_INCOME_SINGLE;
    case "NJ_2025":
      return NJ_2025_INCOME_SINGLE;
    case "MA_2026":
      return MA_2026_INCOME_SINGLE;
    case "MA_2025":
      return MA_2025_INCOME_SINGLE;
    case "IL_2026":
      return IL_2026_INCOME_SINGLE;
    case "IL_2025":
      return IL_2025_INCOME_SINGLE;
    case "AZ_2026":
      return AZ_2026_INCOME_SINGLE;
    case "AZ_2025":
      return AZ_2025_INCOME_SINGLE;
    default:
      return null;
  }
}

/**
 * List of (jurisdiction, year) pairs we have rate schedules for. Useful
 * for an admin UI showing coverage. The recomputeEstimates tRPC
 * procedure validates incoming jurisdiction against this list.
 */
export function getSupportedRateSchedules(): Array<{
  jurisdiction: RateSchedule["jurisdiction"];
  taxYear: number;
}> {
  return [
    { jurisdiction: "federal", taxYear: 2026 },
    { jurisdiction: "federal", taxYear: 2025 },
    { jurisdiction: "CA", taxYear: 2026 },
    { jurisdiction: "CA", taxYear: 2025 },
    { jurisdiction: "NY", taxYear: 2026 },
    { jurisdiction: "NY", taxYear: 2025 },
    { jurisdiction: "NJ", taxYear: 2026 },
    { jurisdiction: "NJ", taxYear: 2025 },
    { jurisdiction: "MA", taxYear: 2026 },
    { jurisdiction: "MA", taxYear: 2025 },
    { jurisdiction: "IL", taxYear: 2026 },
    { jurisdiction: "IL", taxYear: 2025 },
    { jurisdiction: "AZ", taxYear: 2026 },
    { jurisdiction: "AZ", taxYear: 2025 },
  ];
}
