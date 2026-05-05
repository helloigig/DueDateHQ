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

  // ── Reconciliation pass 2026-05-05: ports the FE catalog (src/data/
  // federalForms.ts, ~56 forms) into the BE seed so applicabilityForClient
  // and AddDeadlineModal autocomplete return the same set on both sides.
  // Keep this block in sync with the FE catalog when adding forms.

  // Info return — payroll wrapper
  {
    formNumber: "W-3",
    formName: "Transmittal of Wage and Tax Statements",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 1, day: 31 },
    notes:
      "Cover sheet that totals all W-2s; filed with SSA together with the W-2 batch by Jan 31.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-w-3",
  },

  // Info return — sales of property
  {
    formNumber: "1099-S",
    formName: "Proceeds From Real Estate Transactions",
    category: "info_return",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 2, day: 15 },
    notes:
      "Recipient by Feb 15 (mirrors 1099-B). Required for most real-estate closings unless statutory exception applies.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1099-s",
  },

  // Nonprofit — postcard + extension
  {
    formNumber: "990-N",
    formName: "Electronic Notice (e-Postcard) for Tax-Exempt Organizations Not Required to File 990 or 990-EZ",
    category: "nonprofit",
    entityTypes: ["Nonprofit"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    notes:
      "For orgs with gross receipts ≤ $50K. e-Postcard only — no paper option. May 15 for calendar-year filers.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-990-n",
  },
  {
    formNumber: "8868",
    formName: "Application for Automatic Extension of Time To File an Exempt Organization Return",
    category: "extension",
    entityTypes: ["Nonprofit"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Filed alongside the 990 return it extends. Grants automatic 6-month extension; no statutory due date of its own.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8868",
  },

  // International disclosures
  {
    formNumber: "5471",
    formName: "Information Return of U.S. Persons With Respect to Certain Foreign Corporations",
    category: "international",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to the filer's primary return (1040, 1120, etc.) — its due date follows the return. Multiple categories of filers; review instructions before each engagement.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-5471",
  },
  {
    formNumber: "5472",
    formName: "Information Return of a 25% Foreign-Owned U.S. Corporation or a Foreign Corporation Engaged in a U.S. Trade or Business",
    category: "international",
    entityTypes: ["C-Corp", "LLC"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to the corporation's 1120 (or pro-forma 1120 for foreign-owned single-member LLCs). Substantial penalties for non-filing — verify ownership chain annually.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-5472",
  },
  {
    formNumber: "8865",
    formName: "Return of U.S. Persons With Respect to Certain Foreign Partnerships",
    category: "international",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to the filer's primary return; due date follows. Required for >10% interest or ≥50% control of a foreign partnership.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8865",
  },
  {
    formNumber: "8938",
    formName: "Statement of Specified Foreign Financial Assets",
    category: "international",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to the primary return (1040, 1120, etc.). Threshold-driven by filing status and residency. Distinct from FinCEN-114 (FBAR) — both may be required.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8938",
  },
  {
    formNumber: "FinCEN-114",
    formName: "Report of Foreign Bank and Financial Accounts (FBAR)",
    category: "international",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "Filed electronically with FinCEN (BSA E-Filing System), not the IRS. Apr 15 with automatic Oct 15 extension. Threshold: aggregate foreign accounts > $10K.",
    irsUrl: "https://bsaefiling.fincen.treas.gov/main.html",
  },
  {
    formNumber: "1042-S",
    formName: "Foreign Person's U.S. Source Income Subject to Withholding",
    category: "international",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes:
      "Both recipient copy AND IRS filing due Mar 15. Accompanied by Form 1042 transmittal.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-1042-s",
  },

  // IRA / specialty
  {
    formNumber: "8606",
    formName: "Nondeductible IRAs",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "Attached to 1040; required when nondeductible contributions are made or when basis is being recovered on distribution.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8606",
  },

  // Depreciation / sales of business property
  {
    formNumber: "4562",
    formName: "Depreciation and Amortization",
    category: "income",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to the primary return; due date follows. Required when claiming depreciation/amortization, §179 expense, or listed-property deductions.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-4562",
  },
  {
    formNumber: "8949",
    formName: "Sales and Other Dispositions of Capital Assets",
    category: "income",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC", "Trust"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040 / Schedule D (or 1041 / 1120 equivalents). Reports each capital-asset disposition before totals roll up to Schedule D.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8949",
  },
  {
    formNumber: "4797",
    formName: "Sales of Business Property",
    category: "income",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to the primary return; due date follows. Required for sales of §1231/1245/1250 property and involuntary conversions.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-4797",
  },
  {
    formNumber: "8825",
    formName: "Rental Real Estate Income and Expenses of a Partnership or an S Corporation",
    category: "income",
    entityTypes: ["S-Corp", "Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1065 / 1120-S. Required when the entity holds rental real estate. Distinct from Schedule E (individuals).",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8825",
  },

  // Election forms
  {
    formNumber: "8832",
    formName: "Entity Classification Election",
    category: "other",
    entityTypes: ["LLC", "Partnership", "C-Corp"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Filed when an eligible entity elects to be classified differently than its default (e.g., LLC → C-Corp). Effective date is filer-chosen within statutory window.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-8832",
  },
  {
    formNumber: "5558",
    formName: "Application for Extension of Time to File Certain Employee Plan Returns",
    category: "extension",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Nonprofit"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Used to extend Form 5500 series and 8955-SSA. Must be filed by the original due date of the return being extended.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-5558",
  },
  {
    formNumber: "4768",
    formName: "Application for Extension of Time To File a Return and/or Pay U.S. Estate (and Generation-Skipping Transfer) Taxes",
    category: "extension",
    entityTypes: ["Individual"],
    frequency: "per_event",
    dueDateRule: null,
    notes:
      "Extends Form 706 by 6 months. Must be filed by the 706 due date (9 months after date of death).",
    irsUrl: "https://www.irs.gov/forms-pubs/about-form-4768",
  },

  // Schedules — workpapers attached to primary returns. Included so
  // AddDeadlineModal autocomplete can match them when CPAs reference
  // schedules by name; their dueDateRule is null (follows the parent).
  {
    formNumber: "SCHEDULE-A",
    formName: "Schedule A (Form 1040) — Itemized Deductions",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040. Required when itemizing instead of taking the standard deduction.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-a-form-1040",
  },
  {
    formNumber: "SCHEDULE-B",
    formName: "Schedule B (Form 1040) — Interest and Ordinary Dividends",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040 when taxable interest or ordinary dividends exceed $1,500, or when foreign account questions apply.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-b-form-1040",
  },
  {
    formNumber: "SCHEDULE-C",
    formName: "Schedule C (Form 1040) — Profit or Loss From Business (Sole Proprietorship)",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040 for sole proprietors and single-member LLCs treated as disregarded entities.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-c-form-1040",
  },
  {
    formNumber: "SCHEDULE-D",
    formName: "Schedule D (Form 1040) — Capital Gains and Losses",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040. Totals roll up from Form 8949.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-d-form-1040",
  },
  {
    formNumber: "SCHEDULE-E",
    formName: "Schedule E (Form 1040) — Supplemental Income and Loss",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040. Reports rental real estate, royalties, partnership / S-Corp K-1 income, estate/trust income, and REMICs.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-e-form-1040",
  },
  {
    formNumber: "SCHEDULE-SE",
    formName: "Schedule SE (Form 1040) — Self-Employment Tax",
    category: "income",
    entityTypes: ["Individual"],
    frequency: "annual",
    dueDateRule: null,
    notes:
      "Attached to 1040 when net earnings from self-employment exceed $400.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-se-form-1040",
  },
  {
    formNumber: "K-1-1065",
    formName: "Schedule K-1 (Form 1065) — Partner's Share of Income, Deductions, Credits, etc.",
    category: "info_return",
    entityTypes: ["Partnership", "LLC"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes:
      "Issued to partners alongside the 1065 filing. Each partner reports their share on their personal return.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065",
  },
  {
    formNumber: "K-1-1120-S",
    formName: "Schedule K-1 (Form 1120-S) — Shareholder's Share of Income, Deductions, Credits, etc.",
    category: "info_return",
    entityTypes: ["S-Corp"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    notes:
      "Issued to shareholders alongside the 1120-S filing.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1120-s",
  },
  {
    formNumber: "K-1-1041",
    formName: "Schedule K-1 (Form 1041) — Beneficiary's Share of Income, Deductions, Credits, etc.",
    category: "info_return",
    entityTypes: ["Trust"],
    frequency: "annual",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    notes:
      "Issued to trust/estate beneficiaries alongside the 1041 filing.",
    irsUrl: "https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1041",
  },
];
