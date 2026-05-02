/**
 * Per-state nexus rule config + questionnaire banks for nexus_change alerts.
 *
 * Spec: docs/specs/alert-detail-nexus-change.md
 *
 * Each state × nexus_kind combination defines:
 *   - questions[]: 4–6 yes/no questions specific to the state's rule
 *   - thresholds: dollar/transaction triggers (informational; pipeline
 *     uses `client.estimated_state_revenue_jsonb` to pre-filter matches)
 *   - suggestedFilings: forms to recommend when nexus is established
 *   - resultStrategy: function deciding established / borderline / no_nexus
 *     based on the answers
 *
 * Adding a new state: add to STATE_NEXUS_RULES below. The shape is
 * load-bearing — the FE NexusCheckModal renders directly from this config
 * (over tRPC), so changes propagate without code changes.
 */

export type NexusKind = "sales" | "income" | "payroll" | "franchise";

export type NexusResultStatus =
  | "established"
  | "borderline"
  | "confirmed_no_nexus";

export interface NexusQuestion {
  id: string;
  text: string;
  // When this question is decisive — answering this way locks the result.
  decisiveYes?: NexusResultStatus;
  decisiveNo?: NexusResultStatus;
  // Weight in the heuristic result computation when not decisive.
  weight: number;
}

export interface SuggestedFiling {
  formCode: string;
  formName: string;
  // Optional — surfaces as a chip on the FE checkbox.
  caveat?: string;
  // When true, pre-checked. When false, requires explicit user check.
  preCheckedOnEstablished: boolean;
}

export interface NexusRuleSet {
  state: string; // StateCode
  nexusKind: NexusKind;
  /** Plain-English summary of the threshold rule. */
  thresholdSummary: string;
  /** Effective date of the most recent rule revision. */
  ruleEffectiveDate: string;
  questions: NexusQuestion[];
  suggestedFilings: SuggestedFiling[];
  /** Per-state heuristic deciding nexus from answers + signals. */
  resultStrategy: (answers: Record<string, boolean>) => {
    status: NexusResultStatus;
    confidence: "high" | "medium" | "low";
    reason: string;
  };
}

/**
 * Default heuristic — used by most rule sets unless overridden.
 *   - Any decisive-yes answer → its decisive status (high)
 *   - Any decisive-no → its decisive status (high)
 *   - Otherwise: weighted yes-score; >0.6 = established, >0.3 = borderline
 */
function defaultHeuristic(questions: NexusQuestion[]) {
  return (
    answers: Record<string, boolean>,
  ): ReturnType<NexusRuleSet["resultStrategy"]> => {
    const totalAnswered = Object.keys(answers).length;
    if (totalAnswered === 0) {
      return {
        status: "confirmed_no_nexus",
        confidence: "low",
        reason: "No answers provided",
      };
    }
    // Decisive checks first.
    for (const q of questions) {
      const ans = answers[q.id];
      if (ans === true && q.decisiveYes) {
        return {
          status: q.decisiveYes,
          confidence: "high",
          reason: `Decisive yes on "${q.text}"`,
        };
      }
      if (ans === false && q.decisiveNo) {
        return {
          status: q.decisiveNo,
          confidence: "high",
          reason: `Decisive no on "${q.text}"`,
        };
      }
    }
    // Weighted yes-score.
    let totalWeight = 0;
    let yesWeight = 0;
    for (const q of questions) {
      totalWeight += q.weight;
      if (answers[q.id] === true) yesWeight += q.weight;
    }
    const score = totalWeight > 0 ? yesWeight / totalWeight : 0;
    if (score >= 0.6) {
      return {
        status: "established",
        confidence: "high",
        reason: `${(score * 100).toFixed(0)}% nexus signal score`,
      };
    }
    if (score >= 0.3) {
      return {
        status: "borderline",
        confidence: "medium",
        reason: `${(score * 100).toFixed(0)}% nexus signal — review per-client`,
      };
    }
    return {
      status: "confirmed_no_nexus",
      confidence: "high",
      reason: `${(score * 100).toFixed(0)}% nexus signal`,
    };
  };
}

// ─── Pennsylvania — sales tax ─────────────────────────────────────────────
const PA_SALES: NexusRuleSet = {
  state: "PA",
  nexusKind: "sales",
  thresholdSummary:
    "Economic nexus: $100K in PA sales OR 200 separate PA transactions in current or prior calendar year.",
  ruleEffectiveDate: "2026-07-01",
  questions: [
    {
      id: "pa_sales_1",
      text: "Did the client deliver tangible goods to PA addresses in 2025?",
      weight: 3,
    },
    {
      id: "pa_sales_2",
      text: "Did the client provide services to PA-based customers?",
      weight: 2,
    },
    {
      id: "pa_sales_3",
      text: "Did the client use a marketplace facilitator (Amazon, Etsy) for PA sales?",
      weight: 1,
      decisiveYes: "established",
    },
    {
      id: "pa_sales_4",
      text: "Does the client already have a PA sales tax license?",
      weight: 1,
      decisiveYes: "established",
    },
  ],
  suggestedFilings: [
    {
      formCode: "PA REV-72",
      formName: "Sales tax registration",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "PA-3",
      formName: "Quarterly sales tax remittance",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "PA Corp Tax",
      formName: "Corporate income tax",
      caveat: "verify income nexus separately",
      preCheckedOnEstablished: false,
    },
  ],
  resultStrategy: defaultHeuristic([
    {
      id: "pa_sales_1",
      text: "...",
      weight: 3,
    },
    { id: "pa_sales_2", text: "...", weight: 2 },
    {
      id: "pa_sales_3",
      text: "...",
      weight: 1,
      decisiveYes: "established",
    },
    {
      id: "pa_sales_4",
      text: "...",
      weight: 1,
      decisiveYes: "established",
    },
  ]),
};

// ─── California — sales tax ───────────────────────────────────────────────
const CA_SALES: NexusRuleSet = {
  state: "CA",
  nexusKind: "sales",
  thresholdSummary:
    "Economic nexus: $500K in CA sales in current or prior calendar year. Marketplace sales count.",
  ruleEffectiveDate: "2019-04-01",
  questions: [
    {
      id: "ca_sales_1",
      text: "Did the client deliver tangible goods or services to CA in 2025?",
      weight: 3,
    },
    {
      id: "ca_sales_2",
      text: "Did the client's CA sales (including marketplace) exceed $500K in 2025?",
      weight: 4,
      decisiveYes: "established",
      decisiveNo: "confirmed_no_nexus",
    },
    {
      id: "ca_sales_3",
      text: "Does the client have a CA seller's permit?",
      weight: 1,
      decisiveYes: "established",
    },
    {
      id: "ca_sales_4",
      text: "Does the client have inventory in a CA fulfillment center?",
      weight: 2,
      decisiveYes: "established",
    },
  ],
  suggestedFilings: [
    {
      formCode: "BOE-1",
      formName: "Seller's permit application",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "CDTFA-401-A",
      formName: "Quarterly sales and use tax return",
      preCheckedOnEstablished: true,
    },
  ],
  resultStrategy: defaultHeuristic([
    { id: "ca_sales_1", text: "...", weight: 3 },
    {
      id: "ca_sales_2",
      text: "...",
      weight: 4,
      decisiveYes: "established",
      decisiveNo: "confirmed_no_nexus",
    },
    {
      id: "ca_sales_3",
      text: "...",
      weight: 1,
      decisiveYes: "established",
    },
    {
      id: "ca_sales_4",
      text: "...",
      weight: 2,
      decisiveYes: "established",
    },
  ]),
};

// ─── New York — convenience-of-employer (income tax for remote workers) ──
const NY_INCOME_COE: NexusRuleSet = {
  state: "NY",
  nexusKind: "income",
  thresholdSummary:
    "Convenience-of-employer rule: non-resident wages from NY employer are NY-taxable unless work in NY office is required by the employer.",
  ruleEffectiveDate: "2026-01-01",
  questions: [
    {
      id: "ny_coe_1",
      text: "Does the client (or their employer) have a NY office?",
      weight: 3,
    },
    {
      id: "ny_coe_2",
      text: "Is the client a remote employee who only works in NY occasionally for convenience?",
      weight: 4,
      decisiveYes: "established",
    },
    {
      id: "ny_coe_3",
      text: "Is the client's NY presence required by the employer (necessity, not convenience)?",
      weight: 3,
      decisiveYes: "confirmed_no_nexus",
    },
    {
      id: "ny_coe_4",
      text: "Does the client's W-2 already include NY withholding?",
      weight: 2,
      decisiveYes: "established",
    },
  ],
  suggestedFilings: [
    {
      formCode: "IT-203",
      formName: "Nonresident & Part-Year Resident Income Tax Return",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "IT-225",
      formName: "NY State Modifications",
      caveat: "if client elects allocation method",
      preCheckedOnEstablished: false,
    },
  ],
  resultStrategy: defaultHeuristic([
    { id: "ny_coe_1", text: "...", weight: 3 },
    {
      id: "ny_coe_2",
      text: "...",
      weight: 4,
      decisiveYes: "established",
    },
    {
      id: "ny_coe_3",
      text: "...",
      weight: 3,
      decisiveYes: "confirmed_no_nexus",
    },
    {
      id: "ny_coe_4",
      text: "...",
      weight: 2,
      decisiveYes: "established",
    },
  ]),
};

// ─── Texas — franchise tax ────────────────────────────────────────────────
const TX_FRANCHISE: NexusRuleSet = {
  state: "TX",
  nexusKind: "franchise",
  thresholdSummary:
    "Franchise tax owed if total revenue > $2.47M (raised from $1.23M in 2026). All entities doing business in TX must file even if no tax due.",
  ruleEffectiveDate: "2026-01-01",
  questions: [
    {
      id: "tx_franchise_1",
      text: "Did the entity have any TX-source revenue in the report year?",
      weight: 3,
      decisiveNo: "confirmed_no_nexus",
    },
    {
      id: "tx_franchise_2",
      text: "Was the entity's total revenue (all sources) > $2.47M?",
      weight: 4,
      decisiveYes: "established",
    },
    {
      id: "tx_franchise_3",
      text: "Was the entity's TX-only revenue > $500K?",
      weight: 2,
      decisiveYes: "established",
    },
    {
      id: "tx_franchise_4",
      text: "Does the entity have TX-based employees, property, or operations?",
      weight: 2,
    },
  ],
  suggestedFilings: [
    {
      formCode: "Form 05-158",
      formName: "Texas Franchise Tax Report",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "Form 05-102",
      formName: "Public Information Report",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "Form 05-163",
      formName: "No-Tax-Due Report (if applicable)",
      caveat: "use if total revenue under threshold",
      preCheckedOnEstablished: false,
    },
  ],
  resultStrategy: defaultHeuristic([
    {
      id: "tx_franchise_1",
      text: "...",
      weight: 3,
      decisiveNo: "confirmed_no_nexus",
    },
    {
      id: "tx_franchise_2",
      text: "...",
      weight: 4,
      decisiveYes: "established",
    },
    {
      id: "tx_franchise_3",
      text: "...",
      weight: 2,
      decisiveYes: "established",
    },
    { id: "tx_franchise_4", text: "...", weight: 2 },
  ]),
};

// ─── New Jersey — payroll telework (employer creates NJ payroll obligation) ─
const NJ_PAYROLL_TELEWORK: NexusRuleSet = {
  state: "NJ",
  nexusKind: "payroll",
  thresholdSummary:
    "Per 2026 NJ guidance, employers with NJ-resident remote employees must register for NJ payroll, withhold NJ income tax, and file NJ-927 quarterly.",
  ruleEffectiveDate: "2026-01-01",
  questions: [
    {
      id: "nj_pay_1",
      text: "Does the entity have any employees who reside in NJ?",
      weight: 5,
      decisiveNo: "confirmed_no_nexus",
    },
    {
      id: "nj_pay_2",
      text: "Have those employees worked from NJ for more than 25% of the year?",
      weight: 3,
      decisiveYes: "established",
    },
    {
      id: "nj_pay_3",
      text: "Is the entity already registered with NJ for unemployment insurance?",
      weight: 2,
      decisiveYes: "established",
    },
    {
      id: "nj_pay_4",
      text: "Does the entity's payroll provider already withhold NJ income tax for these employees?",
      weight: 1,
    },
  ],
  suggestedFilings: [
    {
      formCode: "NJ-REG",
      formName: "Business registration application",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "NJ-927",
      formName: "Employer's quarterly report",
      preCheckedOnEstablished: true,
    },
    {
      formCode: "WR-30",
      formName: "Quarterly wage report",
      preCheckedOnEstablished: true,
    },
  ],
  resultStrategy: defaultHeuristic([
    {
      id: "nj_pay_1",
      text: "...",
      weight: 5,
      decisiveNo: "confirmed_no_nexus",
    },
    {
      id: "nj_pay_2",
      text: "...",
      weight: 3,
      decisiveYes: "established",
    },
    {
      id: "nj_pay_3",
      text: "...",
      weight: 2,
      decisiveYes: "established",
    },
    { id: "nj_pay_4", text: "...", weight: 1 },
  ]),
};

/**
 * The lookup table — keyed by `${state}__${nexusKind}`.
 * Add a new entry here to support a new (state, nexusKind) pair.
 */
export const STATE_NEXUS_RULES: Record<string, NexusRuleSet> = {
  PA__sales: PA_SALES,
  CA__sales: CA_SALES,
  NY__income: NY_INCOME_COE,
  TX__franchise: TX_FRANCHISE,
  NJ__payroll: NJ_PAYROLL_TELEWORK,
};

export function getNexusRules(
  state: string,
  nexusKind: NexusKind,
): NexusRuleSet | null {
  return STATE_NEXUS_RULES[`${state}__${nexusKind}`] ?? null;
}

/**
 * Returns the list of (state, nexusKind) pairs we support — useful for
 * admin UI showing coverage.
 */
export function getSupportedNexusRules(): Array<{
  state: string;
  nexusKind: NexusKind;
  thresholdSummary: string;
}> {
  return Object.values(STATE_NEXUS_RULES).map((r) => ({
    state: r.state,
    nexusKind: r.nexusKind,
    thresholdSummary: r.thresholdSummary,
  }));
}
