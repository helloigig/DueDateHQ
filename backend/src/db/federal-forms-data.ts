/**
 * Curated federal forms catalog — the source-of-truth that seeds the
 * `federal_forms` table.
 *
 * What lives here: the ~30 forms that cover the overwhelming majority
 * of CPA work. The long tail (5471, 8865, 8606, 8938, niche excise
 * forms, …) is filled in on demand by `lib/federal-form-extractor.ts`,
 * which runs an LLM call against IRS.gov pages and writes the result
 * back with `extraction_method = 'llm'`.
 *
 * Editing rules:
 *   - Stable form numbers only (the column is UNIQUE)
 *   - dueDateRule is the same JSON shape `service_templates` already
 *     uses; computeDueDate() resolves it
 *   - notes is two sentences max — surfaced as a tooltip in FilingsTab
 *   - Re-running the seeder is idempotent on form_number
 *
 * Cross-references:
 *   - PRD v0.7 §10.3 P0 #11 — "50-state deadline database + ~30 service
 *     packages"; this catalog is the federal half of the deadline source
 *   - feedback_deadlines_dates_only — never include a time-of-day
 *     anywhere in this file
 */
import type { DueDateRule } from "../lib/due-date-rules.js";

export type FederalFormCategory =
  | "income"
  | "payroll"
  | "info_return"
  | "estimated"
  | "extension"
  | "excise"
  | "estate_gift"
  | "nonprofit"
  | "international"
  | "amendment"
  | "other";

export type FederalFormFrequency =
  | "annual"
  | "quarterly"
  | "monthly"
  | "per_event";

export interface CuratedFederalForm {
  formNumber: string;
  formName: string;
  category: FederalFormCategory;
  /** Canonical entity-type slugs from the clients table. */
  entityTypes: string[];
  frequency: FederalFormFrequency;
  /** Null when the due date depends on facts the row can't encode
   *  (e.g. 1099-NEC is "Jan 31 to recipient AND IRS"; 4868 is "filed
   *  alongside 1040, no statutory due date of its own"). The notes
   *  field surfaces the caveat. */
  dueDateRule: DueDateRule | null;
  notes?: string;
  irsUrl: string;
}

// ── Income tax — individuals ──────────────────────────────────────────
export const FEDERAL_FORMS: CuratedFederalForm[] = [
  {
    formNumber: "1040",
    formName: "U.S. Individual Income Tax Return",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "April 15 (or next business day). Extension to Oct 15 via Form 4868; payment of estimated tax still due by April 15.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040",
  },
  {
    formNumber: "1040-SR",
    formName: "U.S. Tax Return for Seniors",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "Available for taxpayers 65+. Same due date and extension rules as Form 1040.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040-sr",
  },
  {
    formNumber: "1040-NR",
    formName: "U.S. Nonresident Alien Income Tax Return",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "April 15 if wages subject to U.S. withholding; June 15 otherwise. Extension to Dec 15 available on request.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040-nr",
  },
  {
    formNumber: "1040-X",
    formName: "Amended U.S. Individual Income Tax Return",
    category: "amendment",
    entityTypes: ["Individual"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Generally must be filed within 3 years of the original return's due date or 2 years of paying the tax, whichever is later.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040-x",
  },
  {
    formNumber: "1040-ES",
    formName: "Estimated Tax for Individuals",
    category: "estimated",
    entityTypes: ["Individual"],
    frequency: "quarterly",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 15 },
        { month: 6, day: 15 },
        { month: 9, day: 15 },
        { month: 1, day: 15 },
      ],
    },
    notes:
      "Q4 voucher is due Jan 15 of the following year. Self-employed, gig workers, and high-investment-income clients typically owe.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1040-es",
  },

  // ── Income tax — entities ───────────────────────────────────────────
  {
    formNumber: "1120",
    formName: "U.S. Corporation Income Tax Return",
    category: "income",
    entityTypes: ["C-Corp"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "Calendar-year C-corps file by April 15. Fiscal-year filers due 15th day of the 4th month after year-end.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1120",
  },
  {
    formNumber: "1120-S",
    formName: "U.S. Income Tax Return for an S Corporation",
    category: "income",
    entityTypes: ["S-Corp"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes:
      "March 15 for calendar-year filers. K-1s to shareholders due same day.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1120-s",
  },
  {
    formNumber: "1120-W",
    formName: "Estimated Tax for Corporations",
    category: "estimated",
    entityTypes: ["C-Corp"],
    frequency: "quarterly",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 15 },
        { month: 6, day: 15 },
        { month: 9, day: 15 },
        { month: 12, day: 15 },
      ],
    },
    notes:
      "Worksheet only; no IRS submission. Required for C-corps expecting $500+ tax liability.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1120-w",
  },
  {
    formNumber: "1065",
    formName: "U.S. Return of Partnership Income",
    category: "income",
    entityTypes: ["Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes:
      "March 15 for calendar-year partnerships and LLCs taxed as partnerships. K-1s to partners due same day.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1065",
  },
  {
    formNumber: "1041",
    formName: "U.S. Income Tax Return for Estates and Trusts",
    category: "income",
    entityTypes: ["Trust"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "April 15 for calendar-year filers. Fiscal-year estates: 15th day of 4th month after year-end.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1041",
  },

  // ── Extensions ──────────────────────────────────────────────────────
  {
    formNumber: "4868",
    formName: "Application for Automatic Extension of Time To File U.S. Individual Income Tax Return",
    category: "extension",
    entityTypes: ["Individual"],
    frequency: "per_event",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "File by the original 1040 due date to push filing to Oct 15. Does not extend the time to pay tax.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-4868",
  },
  {
    formNumber: "7004",
    formName: "Application for Automatic Extension of Time To File Certain Business Income Tax, Information, and Other Returns",
    category: "extension",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Trust"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "File by the parent return's original due date. Extension length depends on the form being extended (5-6 months typical).",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-7004",
  },

  // ── Payroll / employment tax ────────────────────────────────────────
  {
    formNumber: "941",
    formName: "Employer's Quarterly Federal Tax Return",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "quarterly",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 30 },
        { month: 7, day: 31 },
        { month: 10, day: 31 },
        { month: 1, day: 31 },
      ],
    },
    notes:
      "Q1 due Apr 30, Q2 Jul 31, Q3 Oct 31, Q4 Jan 31. Reports federal income tax withheld plus employer/employee FICA.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-941",
  },
  {
    formNumber: "940",
    formName: "Employer's Annual Federal Unemployment (FUTA) Tax Return",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Due Jan 31 covering the prior calendar year. Extended to Feb 10 if all FUTA deposits made on time.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-940",
  },
  {
    formNumber: "943",
    formName: "Employer's Annual Federal Tax Return for Agricultural Employees",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Replaces 941 for ag employers. Due Jan 31; Feb 10 if all deposits timely.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-943",
  },
  {
    formNumber: "944",
    formName: "Employer's Annual Federal Tax Return",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Smaller employers ($1,000 or less annual liability). IRS notifies eligibility — don't file unless instructed.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-944",
  },
  {
    formNumber: "945",
    formName: "Annual Return of Withheld Federal Income Tax",
    category: "payroll",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Reports backup withholding + non-payroll withholding (pensions, gambling). Due Jan 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-945",
  },

  // ── Information returns ─────────────────────────────────────────────
  {
    formNumber: "W-2",
    formName: "Wage and Tax Statement",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Furnish to employees AND file with SSA by Jan 31. Form W-3 transmittal accompanies paper filings.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-w-2",
  },
  {
    formNumber: "1099-NEC",
    formName: "Nonemployee Compensation",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Issue to recipient AND file with IRS by Jan 31. No paper-vs-efile split — both deadlines are the same.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-nec",
  },
  {
    formNumber: "1099-MISC",
    formName: "Miscellaneous Information",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Recipient copy due Jan 31. IRS paper filing Feb 28; e-file Mar 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-misc",
  },
  {
    formNumber: "1099-INT",
    formName: "Interest Income",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Issue to recipient by Jan 31. IRS paper filing Feb 28; e-file Mar 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-int",
  },
  {
    formNumber: "1099-DIV",
    formName: "Dividends and Distributions",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Issue to recipient by Jan 31. IRS paper filing Feb 28; e-file Mar 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-div",
  },
  {
    formNumber: "1099-B",
    formName: "Proceeds From Broker and Barter Exchange Transactions",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 2, day: 15 },
    notes:
      "Recipient copy by Feb 15 (later than other 1099s). IRS e-file by Mar 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-b",
  },
  {
    formNumber: "1099-R",
    formName: "Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc.",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Issue to recipient by Jan 31. IRS paper Feb 28; e-file Mar 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-r",
  },
  {
    formNumber: "1099-K",
    formName: "Payment Card and Third Party Network Transactions",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Recipient by Jan 31. Threshold lowered for processors over recent years — verify current threshold per current IRS guidance before filing.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-k",
  },
  {
    formNumber: "1098",
    formName: "Mortgage Interest Statement",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Issued by lender to borrower; borrower attaches Schedule A to deduct mortgage interest.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1098",
  },
  {
    formNumber: "1098-T",
    formName: "Tuition Statement",
    category: "info_return",
    entityTypes: ["Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Issued by educational institution. Drives American Opportunity / Lifetime Learning credits on the recipient's 1040.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1098-t",
  },

  // ── Estate / gift ────────────────────────────────────────────────────
  {
    formNumber: "706",
    formName: "United States Estate (and Generation-Skipping Transfer) Tax Return",
    category: "estate_gift",
    entityTypes: ["Individual"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Due 9 months after date of death; 6-month extension via Form 4768. Required for gross estates above the federal exclusion.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-706",
  },
  {
    formNumber: "709",
    formName: "United States Gift (and Generation-Skipping Transfer) Tax Return",
    category: "estate_gift",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "Same due date as 1040 (Apr 15 / extended Oct 15). Required when gifts to any one donee exceed the annual exclusion.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-709",
  },

  // ── Nonprofit ────────────────────────────────────────────────────────
  {
    formNumber: "990",
    formName: "Return of Organization Exempt From Income Tax",
    category: "nonprofit",
    entityTypes: ["Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    notes:
      "May 15 for calendar-year orgs. Fiscal-year filers due 15th day of 5th month after year-end. 6-month extension via Form 8868.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-990",
  },
  {
    formNumber: "990-EZ",
    formName: "Short Form Return of Organization Exempt From Income Tax",
    category: "nonprofit",
    entityTypes: ["Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    notes:
      "For organizations with gross receipts < $200K and total assets < $500K.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-990-ez",
  },
  {
    formNumber: "990-PF",
    formName: "Return of Private Foundation",
    category: "nonprofit",
    entityTypes: ["Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    notes:
      "All private foundations file regardless of size. May 15 calendar year.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-990-pf",
  },

  // ── Other ────────────────────────────────────────────────────────────
  {
    formNumber: "5500",
    formName: "Annual Return/Report of Employee Benefit Plan",
    category: "other",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 7, day: 31 },
    notes:
      "Last day of 7th month after plan year-end. Filed with DOL (EFAST2), not IRS, but joint regulation requires CPA awareness.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-5500",
  },
  {
    formNumber: "2553",
    formName: "Election by a Small Business Corporation",
    category: "other",
    entityTypes: ["S-Corp"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "File no later than 2 months and 15 days after the start of the tax year the election is to take effect. Late-election relief available under Rev. Proc. 2013-30.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-2553",
  },
];
