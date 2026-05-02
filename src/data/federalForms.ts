/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Federal forms catalog — top 50 forms most US CPA practices touch.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  PURPOSE
 *  This is the catalog of federal forms the product knows about. It powers:
 *    • AddDeadlineModal autocomplete (real form list, not free-text)
 *    • FilingsTab default checklist per filing
 *    • Bundle composition (a bundle references forms by code; one form
 *      can appear in many bundles)
 *    • Future AI applicability layer (the option set AI selects from)
 *
 *  PROVENANCE
 *  Each form has a `sources` array of IRS PDF URLs (form + instructions)
 *  the CPA can click through to verify. These URLs follow the irs.gov
 *  convention (`pub/irs-pdf/f{code}.pdf` for forms, `i{code}.pdf` for
 *  instructions). Every URL in this file was HTTP-200-confirmed against
 *  irs.gov on 2026-05-02.
 *
 *  CONFIDENCE
 *  Every form is `confidence: "common-practice"` until a CPA / Enrolled
 *  Agent reviews and signs off (`confidence: "verified"`). The `verified`
 *  field on each checklist item gates the same — false until human review.
 *  The product UX MUST surface this distinction (e.g. show a "AI-suggested,
 *  please review" hint on common-practice items the first time a CPA
 *  encounters them on a new filing).
 *
 *  WHAT'S NOT HERE
 *    • State forms — separate Phase 5 catalog
 *    • Sales tax forms — never (product does not cover sales tax)
 *    • Local jurisdictions — never
 *    • Schedules treated as workpapers (Schedule A, B, D, etc.) — these
 *      are not separately filed; the CPA prepares them as part of the
 *      primary filing's workflow. They show up in `requiredItems` of the
 *      parent form when relevant ("Schedule B inputs: 1099-INT and
 *      1099-DIV statements").
 *
 *  STATUTORY BASIS
 *  Due dates derive from IRC §6072 (calendar-year filings) with the
 *  weekend/holiday push to the next business day per §7503. For fiscal-
 *  year filers the "15th day of Nth month after fiscal year end" rule
 *  applies — the FE must compute these per-client.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { EntityType } from "../types";

/**
 * Some federal forms apply to roles that aren't in the core EntityType
 * enum. We extend the scope here without polluting the canonical type.
 */
export type FormEntityScope =
  | EntityType
  | "Nonprofit"
  | "Sole-Proprietor"
  | "Estate"
  | "Employer"
  | "Foreign-filer"
  | "Any";

export type FormKind =
  | "primary_filing"        // The main return filed by entity (1040, 1120-S, 1065)
  | "extension"             // Time-extension request (4868, 7004, 8868)
  | "estimated_payment"     // Quarterly estimate voucher set (1040-ES)
  | "info_return_filed"     // Filed BY the entity to report payments to others (W-2, 1099-NEC)
  | "info_return_received"  // Received from a third party as input to a filing (1099-INT, 1098)
  | "specialty"             // Foreign disclosure, IRA reporting, depreciation, sales of property
  | "election";             // Entity classification, S-Corp election, etc.

export type DueDateBasis =
  | "calendar-year-Apr15"
  | "calendar-year-Mar15"
  | "calendar-year-May15"
  | "fiscal-year-15-of-3rd-month"   // 1065, 1120-S — 2.5 months after FYE
  | "fiscal-year-15-of-4th-month"   // 1120, 1041 — 3.5 months after FYE
  | "fiscal-year-15-of-5th-month"   // 990 — 4.5 months after FYE
  | "quarterly-estimate"            // 1040-ES quarterly schedule
  | "quarterly-employment-Jan31-Apr30-Jul31-Oct31"  // 941
  | "annual-Jan31"                  // W-2/W-3 to SSA, 1099-NEC to IRS
  | "annual-Feb28-paper-Mar31-efile" // 1099-MISC, 1099-INT etc to IRS
  | "annual-Apr15"                  // 990 series for calendar-year nonprofits = May 15
  | "annual-Jul31"                  // 5500 — 7 months after plan year end
  | "annual-Oct15"                  // FBAR — calendar-year only
  | "event-driven"                  // 706 (estate), 8606, 8832
  | "received-not-filed";           // Info returns the client receives, not filed by CPA

export type Confidence = "verified" | "common-practice" | "ai-suggested";

export interface FormChecklistItem {
  /** Plain-English label shown to the CPA in the checklist UI. */
  label: string;
  /** Stable enum-ish key for this item type (used to group / template across clients). */
  itemType: string;
  /** Optional citation — IRS Pub or instructions URL where this requirement is documented. */
  source?: string;
  /** True only after CPA review. False default → UX shows "AI-suggested, please review". */
  verified?: boolean;
}

export interface FederalForm {
  /** Form code (without "Form" prefix). Primary key. */
  code: string;
  /** Official IRS title. */
  name: string;
  /** Short plain-English description for tooltips / search. */
  description: string;
  kind: FormKind;
  /** "MM-DD" for calendar-year filers. null when due-date depends on event/fiscal-year. */
  dueDate: string | null;
  dueDateBasis: DueDateBasis;
  /** Form code that extends THIS form. null if no standard extension. */
  extensionForm: string | null;
  applicableEntities: FormEntityScope[];
  requiredItems: FormChecklistItem[];
  /** IRS PDF URLs (form + instructions) — every URL was HTTP-200 on 2026-05-02. */
  sources: string[];
  confidence: Confidence;
}

const IRS_PDF = (slug: string) => `https://www.irs.gov/pub/irs-pdf/${slug}.pdf`;

// ─────────────────────────────────────────────────────────────────────────────
//  THE CATALOG — top 50 federal forms
// ─────────────────────────────────────────────────────────────────────────────

export const FEDERAL_FORMS: FederalForm[] = [
  // ── TIER 1 — Core individual + business returns ──────────────────────────

  {
    code: "1040",
    name: "U.S. Individual Income Tax Return",
    description: "The main federal return for individuals. Required for any US person with income above the filing threshold.",
    kind: "primary_filing",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual", "Sole-Proprietor"],
    requiredItems: [
      { label: "All W-2s (wage statements from employers)", itemType: "wage_w2", source: IRS_PDF("p17") },
      { label: "All 1099-INT (interest income)", itemType: "1099_int", source: IRS_PDF("f1099int") },
      { label: "All 1099-DIV (dividend income)", itemType: "1099_div", source: IRS_PDF("f1099div") },
      { label: "All 1099-NEC and 1099-MISC (self-employment / contractor income)", itemType: "1099_nec_misc", source: IRS_PDF("f1099nec") },
      { label: "All 1099-R (retirement distributions)", itemType: "1099_r", source: IRS_PDF("f1099r") },
      { label: "All 1099-K (payment app / marketplace income)", itemType: "1099_k", source: IRS_PDF("f1099k") },
      { label: "All Schedule K-1s received (from partnerships, S-Corps, trusts)", itemType: "k1_received" },
      { label: "Form 1098 (mortgage interest, if itemizing)", itemType: "1098_mortgage", source: IRS_PDF("f1098") },
      { label: "Form 1098-T (tuition, if claiming education credits)", itemType: "1098_t_tuition", source: IRS_PDF("f1098t") },
      { label: "Charitable contribution receipts (if itemizing)", itemType: "charitable_receipts" },
      { label: "Property tax statements (if itemizing)", itemType: "property_tax" },
      { label: "State tax payments / refunds from prior year", itemType: "state_tax" },
      { label: "Brokerage 1099-B + cost basis (if any sales)", itemType: "1099_b_brokerage" },
      { label: "HSA / FSA contribution and distribution statements", itemType: "hsa_fsa" },
      { label: "Estimated tax payments made during the year", itemType: "estimates_paid" },
    ],
    sources: [IRS_PDF("f1040"), IRS_PDF("i1040gi"), IRS_PDF("p17")],
    confidence: "common-practice",
  },

  {
    code: "1040-ES",
    name: "Estimated Tax for Individuals",
    description: "Quarterly estimated-tax payment vouchers for individuals not subject to sufficient withholding (self-employed, investors, S-Corp owners).",
    kind: "estimated_payment",
    dueDate: null,
    dueDateBasis: "quarterly-estimate",
    extensionForm: null,
    applicableEntities: ["Individual", "Sole-Proprietor"],
    requiredItems: [
      { label: "Prior-year Form 1040 (for safe-harbor calculation)", itemType: "prior_year_1040" },
      { label: "Year-to-date income summary by source", itemType: "ytd_income" },
      { label: "Year-to-date federal withholding", itemType: "ytd_withholding" },
      { label: "Expected major income / deduction events for remainder of year", itemType: "future_events" },
    ],
    sources: [IRS_PDF("f1040es")],
    confidence: "common-practice",
  },

  {
    code: "4868",
    name: "Application for Automatic Extension of Time To File U.S. Individual Income Tax Return",
    description: "Six-month extension (to Oct 15) for individual returns. Does NOT extend time to PAY — estimated tax must still be paid by Apr 15.",
    kind: "extension",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: null,
    applicableEntities: ["Individual", "Sole-Proprietor"],
    requiredItems: [
      { label: "Estimated tax liability (best-effort; will refine on actual return)", itemType: "estimated_liability" },
      { label: "Total payments + withholding to date", itemType: "payments_to_date" },
      { label: "Balance due payment (if any)", itemType: "balance_due_payment" },
    ],
    sources: [IRS_PDF("f4868")],
    confidence: "common-practice",
  },

  {
    code: "1120",
    name: "U.S. Corporation Income Tax Return",
    description: "The main federal return for C-corporations. Calendar-year corps file by Apr 15; fiscal-year corps file by 15th of the 4th month after FYE.",
    kind: "primary_filing",
    dueDate: "04-15",
    dueDateBasis: "fiscal-year-15-of-4th-month",
    extensionForm: "7004",
    applicableEntities: ["C-Corp"],
    requiredItems: [
      { label: "Closed corporate books / trial balance", itemType: "corp_books" },
      { label: "Bank statements for all corporate accounts", itemType: "bank_statements" },
      { label: "Fixed asset additions + dispositions during year", itemType: "fixed_assets" },
      { label: "Officer compensation summary", itemType: "officer_comp" },
      { label: "Shareholder distributions / dividends paid", itemType: "shareholder_distribution" },
      { label: "Loans to/from shareholders (with notes)", itemType: "shareholder_loans" },
      { label: "Prior-year Form 1120 + Schedule M-3 reconciliation if applicable", itemType: "prior_year_1120" },
      { label: "1099-DIV preparation list (any dividends paid to shareholders)", itemType: "1099_div_prep" },
    ],
    sources: [IRS_PDF("f1120"), IRS_PDF("i1120")],
    confidence: "common-practice",
  },

  {
    code: "1120-S",
    name: "U.S. Income Tax Return for an S Corporation",
    description: "The main federal return for S-corporations. Calendar-year S-corps file by Mar 15; fiscal-year S-corps by 15th of 3rd month after FYE.",
    kind: "primary_filing",
    dueDate: "03-15",
    dueDateBasis: "fiscal-year-15-of-3rd-month",
    extensionForm: "7004",
    applicableEntities: ["S-Corp"],
    requiredItems: [
      { label: "Closed S-Corp books / trial balance", itemType: "scorp_books" },
      { label: "Bank statements for all corporate accounts", itemType: "bank_statements" },
      { label: "Officer / shareholder W-2s (S-Corp owners must take reasonable comp)", itemType: "officer_w2" },
      { label: "Officer compensation reasonableness analysis", itemType: "officer_comp_analysis" },
      { label: "Shareholder distribution log", itemType: "scorp_distribution" },
      { label: "Health insurance premiums paid for >2% shareholders", itemType: "scorp_2pct_health" },
      { label: "Fixed asset additions + dispositions", itemType: "fixed_assets" },
      { label: "Prior-year Form 1120-S + Schedule K-1s", itemType: "prior_year_1120s" },
      { label: "Updated shareholder list with ownership %", itemType: "shareholder_list" },
      { label: "State S-Corp election proof (if applicable)", itemType: "scorp_state_election" },
    ],
    sources: [IRS_PDF("f1120s"), IRS_PDF("i1120s")],
    confidence: "common-practice",
  },

  {
    code: "1065",
    name: "U.S. Return of Partnership Income",
    description: "The main federal return for partnerships and multi-member LLCs taxed as partnerships. Due Mar 15 for calendar-year; 15th of 3rd month after FYE for fiscal-year.",
    kind: "primary_filing",
    dueDate: "03-15",
    dueDateBasis: "fiscal-year-15-of-3rd-month",
    extensionForm: "7004",
    applicableEntities: ["Partnership", "LLC"],
    requiredItems: [
      { label: "Closed partnership books / trial balance", itemType: "partnership_books" },
      { label: "Bank statements for all partnership accounts", itemType: "bank_statements" },
      { label: "Partner capital account schedules (current year activity)", itemType: "partner_capital" },
      { label: "Updated partner list with ownership % and capital contributions", itemType: "partner_list" },
      { label: "Distributions to each partner during year", itemType: "partner_distributions" },
      { label: "Special allocations (if any)", itemType: "special_allocations" },
      { label: "Guaranteed payments to partners (if any)", itemType: "guaranteed_payments" },
      { label: "Fixed asset additions + dispositions", itemType: "fixed_assets" },
      { label: "Prior-year Form 1065 + K-1s", itemType: "prior_year_1065" },
      { label: "Schedule K-1 distribution prep for each partner", itemType: "partnership_k1_prep" },
    ],
    sources: [IRS_PDF("f1065"), IRS_PDF("i1065")],
    confidence: "common-practice",
  },

  {
    code: "7004",
    name: "Application for Automatic Extension of Time To File Certain Business Income Tax, Information, and Other Returns",
    description: "Six-month extension for most business returns (1120, 1120-S, 1065, 1041 trusts). Does NOT extend time to pay tax due.",
    kind: "extension",
    dueDate: null,
    dueDateBasis: "fiscal-year-15-of-3rd-month",
    extensionForm: null,
    applicableEntities: ["C-Corp", "S-Corp", "Partnership", "LLC", "Trust"],
    requiredItems: [
      { label: "Form being extended (1120 / 1120-S / 1065 / 1041)", itemType: "extended_form_choice" },
      { label: "Estimated tax liability (best-effort)", itemType: "estimated_liability" },
      { label: "Tentative payment (any balance due)", itemType: "tentative_payment" },
    ],
    sources: [IRS_PDF("f7004"), IRS_PDF("i7004")],
    confidence: "common-practice",
  },

  // ── TIER 2 — Trust, exempt org, employer ─────────────────────────────────

  {
    code: "1041",
    name: "U.S. Income Tax Return for Estates and Trusts",
    description: "Federal return for estates and trusts. Calendar-year trusts due Apr 15; fiscal-year due 15th of 4th month after FYE.",
    kind: "primary_filing",
    dueDate: "04-15",
    dueDateBasis: "fiscal-year-15-of-4th-month",
    extensionForm: "7004",
    applicableEntities: ["Trust", "Estate"],
    requiredItems: [
      { label: "Trust agreement (or estate documents)", itemType: "trust_documents" },
      { label: "Trust accounting / fiduciary income statement", itemType: "trust_accounting" },
      { label: "All 1099-INT, 1099-DIV, 1099-B for trust accounts", itemType: "trust_1099s" },
      { label: "Schedule of distributions to beneficiaries", itemType: "beneficiary_distributions" },
      { label: "Beneficiary list with TINs", itemType: "beneficiary_list" },
      { label: "Trustee fees paid", itemType: "trustee_fees" },
      { label: "Investment / brokerage statements year-end", itemType: "trust_investment_stmts" },
      { label: "Prior-year Form 1041 + K-1s", itemType: "prior_year_1041" },
      { label: "Schedule K-1 distribution prep for each beneficiary", itemType: "trust_k1_prep" },
    ],
    sources: [IRS_PDF("f1041"), IRS_PDF("i1041")],
    confidence: "common-practice",
  },

  {
    code: "990",
    name: "Return of Organization Exempt From Income Tax",
    description: "Annual information return for tax-exempt organizations (501(c)(3) and others). Due 15th of 5th month after fiscal year end (May 15 for calendar-year filers).",
    kind: "primary_filing",
    dueDate: "05-15",
    dueDateBasis: "fiscal-year-15-of-5th-month",
    extensionForm: "8868",
    applicableEntities: ["Nonprofit"],
    requiredItems: [
      { label: "Closed organizational books / trial balance", itemType: "nonprofit_books" },
      { label: "Mission statement + program accomplishments narrative", itemType: "mission_program" },
      { label: "Board member roster + compensation (if any)", itemType: "board_roster" },
      { label: "Top-5 highest-paid employees + contractors", itemType: "highest_paid" },
      { label: "Donor list (≥$5,000 contributions, Schedule B)", itemType: "donor_list" },
      { label: "Grants / scholarships disbursed", itemType: "grants_disbursed" },
      { label: "Lobbying activity log (if any)", itemType: "lobbying_log" },
      { label: "Related-party transactions (if any)", itemType: "related_party_tx" },
      { label: "Prior-year Form 990 + state nonprofit return", itemType: "prior_year_990" },
    ],
    sources: [IRS_PDF("f990"), IRS_PDF("i990")],
    confidence: "common-practice",
  },

  {
    code: "990-EZ",
    name: "Short Form Return of Organization Exempt From Income Tax",
    description: "Shorter version of Form 990 for nonprofits with gross receipts < $200,000 AND total assets < $500,000.",
    kind: "primary_filing",
    dueDate: "05-15",
    dueDateBasis: "fiscal-year-15-of-5th-month",
    extensionForm: "8868",
    applicableEntities: ["Nonprofit"],
    requiredItems: [
      { label: "Closed organizational books / trial balance", itemType: "nonprofit_books" },
      { label: "Program service accomplishments summary", itemType: "program_summary" },
      { label: "Officer + director compensation", itemType: "board_compensation" },
      { label: "Donor list (≥$5,000, Schedule B)", itemType: "donor_list" },
      { label: "Prior-year Form 990-EZ", itemType: "prior_year_990ez" },
    ],
    sources: [IRS_PDF("f990ez"), IRS_PDF("i990ez")],
    confidence: "common-practice",
  },

  {
    code: "990-N",
    name: "Electronic Notice (e-Postcard) for Tax-Exempt Organizations Not Required to File Form 990 or 990-EZ",
    description: "Online-only filing for very small nonprofits (gross receipts ≤ $50,000). Submitted directly through IRS website, no PDF.",
    kind: "primary_filing",
    dueDate: "05-15",
    dueDateBasis: "fiscal-year-15-of-5th-month",
    extensionForm: null,
    applicableEntities: ["Nonprofit"],
    requiredItems: [
      { label: "Organization legal name + EIN", itemType: "org_id" },
      { label: "Mailing address + principal officer name", itemType: "principal_officer" },
      { label: "Confirmation gross receipts ≤ $50,000", itemType: "small_org_confirmation" },
    ],
    sources: ["https://www.irs.gov/charities-non-profits/annual-electronic-filing-requirement-for-small-exempt-organizations-form-990-n-e-postcard"],
    confidence: "common-practice",
  },

  {
    code: "8868",
    name: "Application for Extension of Time To File an Exempt Organization Return",
    description: "Six-month extension for Form 990, 990-EZ, 990-PF, 4720, 5227, 6069, and 8870.",
    kind: "extension",
    dueDate: "05-15",
    dueDateBasis: "fiscal-year-15-of-5th-month",
    extensionForm: null,
    applicableEntities: ["Nonprofit"],
    requiredItems: [
      { label: "Organization name + EIN", itemType: "org_id" },
      { label: "Form being extended", itemType: "extended_form_choice" },
      { label: "Tax year covered", itemType: "tax_year" },
    ],
    sources: [IRS_PDF("f8868"), IRS_PDF("i8868")],
    confidence: "common-practice",
  },

  {
    code: "706",
    name: "United States Estate (and Generation-Skipping Transfer) Tax Return",
    description: "Filed by executor when a decedent's estate exceeds the federal estate-tax exemption. Due 9 months after date of death; 6-month extension available.",
    kind: "primary_filing",
    dueDate: null,
    dueDateBasis: "event-driven",
    extensionForm: "4768",
    applicableEntities: ["Estate"],
    requiredItems: [
      { label: "Death certificate", itemType: "death_certificate" },
      { label: "Will + any trust documents", itemType: "estate_documents" },
      { label: "Letters testamentary / letters of administration", itemType: "letters_testamentary" },
      { label: "Date-of-death valuations for ALL assets (real estate appraisal, brokerage statements, business interests)", itemType: "dod_valuations" },
      { label: "List of debts owed by decedent at death", itemType: "decedent_debts" },
      { label: "Prior gifts above annual exclusion (Form 709 history)", itemType: "prior_gifts" },
      { label: "Beneficiary list with TINs and relationships", itemType: "beneficiary_list" },
      { label: "Funeral expense receipts", itemType: "funeral_expenses" },
    ],
    sources: [IRS_PDF("f706"), IRS_PDF("i706")],
    confidence: "common-practice",
  },

  {
    code: "709",
    name: "United States Gift (and Generation-Skipping Transfer) Tax Return",
    description: "Filed by donor when total gifts to any one person in a year exceed the annual exclusion ($18,000 for 2024). Due Apr 15 of year after gift.",
    kind: "primary_filing",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "List of all gifts during year by recipient (with values)", itemType: "gift_list" },
      { label: "Appraisals for non-cash gifts (real estate, art, business interests)", itemType: "gift_appraisals" },
      { label: "Recipient TINs (for gifts > annual exclusion)", itemType: "recipient_tins" },
      { label: "Prior-year Form 709 history (lifetime gift tracking)", itemType: "prior_form_709" },
      { label: "Spousal consent for gift-splitting (if applicable)", itemType: "spousal_consent" },
    ],
    sources: [IRS_PDF("f709"), IRS_PDF("i709")],
    confidence: "common-practice",
  },

  // ── TIER 2 cont. — Employment / payroll ──────────────────────────────────

  {
    code: "940",
    name: "Employer's Annual Federal Unemployment (FUTA) Tax Return",
    description: "Annual federal unemployment tax return for any employer who paid wages of $1,500+ in a quarter or had ≥1 employee for any part of 20+ weeks.",
    kind: "primary_filing",
    dueDate: "01-31",
    dueDateBasis: "annual-Jan31",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    requiredItems: [
      { label: "Total wages paid during year by employee", itemType: "wages_total" },
      { label: "State unemployment tax payments (each state with employees)", itemType: "suta_payments" },
      { label: "FUTA tax deposits made during year", itemType: "futa_deposits" },
      { label: "Quarterly Form 941s (cross-check)", itemType: "form_941_history" },
    ],
    sources: [IRS_PDF("f940"), IRS_PDF("i940")],
    confidence: "common-practice",
  },

  {
    code: "941",
    name: "Employer's QUARTERLY Federal Tax Return",
    description: "Quarterly return reporting federal income tax, Social Security, and Medicare withheld from employee wages, plus the employer's matching share.",
    kind: "primary_filing",
    dueDate: null,
    dueDateBasis: "quarterly-employment-Jan31-Apr30-Jul31-Oct31",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    requiredItems: [
      { label: "Payroll register for the quarter", itemType: "payroll_register" },
      { label: "Federal income tax withheld this quarter", itemType: "fit_withheld" },
      { label: "Social Security + Medicare wages (both employee + employer share)", itemType: "ss_medicare_wages" },
      { label: "Tip income reported by employees (if applicable)", itemType: "tip_income" },
      { label: "Federal tax deposits made (cross-check)", itemType: "fed_deposits" },
      { label: "Sick pay / family leave wages (if any)", itemType: "sick_leave_wages" },
    ],
    sources: [IRS_PDF("f941"), IRS_PDF("i941")],
    confidence: "common-practice",
  },

  {
    code: "944",
    name: "Employer's ANNUAL Federal Tax Return",
    description: "Annual alternative to quarterly Form 941 — for very small employers whose annual liability is ≤ $1,000 (must be approved by IRS).",
    kind: "primary_filing",
    dueDate: "01-31",
    dueDateBasis: "annual-Jan31",
    extensionForm: null,
    applicableEntities: ["Employer", "Sole-Proprietor", "S-Corp", "C-Corp", "Partnership", "LLC"],
    requiredItems: [
      { label: "IRS approval letter authorizing 944 (vs 941)", itemType: "form_944_approval" },
      { label: "Annual payroll register", itemType: "payroll_register_annual" },
      { label: "Federal income tax withheld", itemType: "fit_withheld" },
      { label: "Social Security + Medicare wages", itemType: "ss_medicare_wages" },
      { label: "Federal tax deposits made", itemType: "fed_deposits" },
    ],
    sources: [IRS_PDF("f941"), IRS_PDF("i941")], // 944 typically references 941 instructions
    confidence: "common-practice",
  },

  {
    code: "W-2",
    name: "Wage and Tax Statement",
    description: "Filed by employers for each employee. Reports wages and taxes withheld. Due to employee by Jan 31; due to SSA (with W-3 transmittal) by Jan 31.",
    kind: "info_return_filed",
    dueDate: "01-31",
    dueDateBasis: "annual-Jan31",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    requiredItems: [
      { label: "Employee list with SSN, name, address", itemType: "employee_roster" },
      { label: "Annual wages by employee", itemType: "wages_by_employee" },
      { label: "Federal + state + local tax withheld per employee", itemType: "tax_withheld_per_employee" },
      { label: "Pre-tax deductions (401k, health, HSA) per employee", itemType: "pretax_deductions" },
      { label: "Box 12 codes (group-term life, dependent care, etc.)", itemType: "w2_box12_codes" },
    ],
    sources: [IRS_PDF("fw2"), IRS_PDF("iw2w3")],
    confidence: "common-practice",
  },

  {
    code: "W-3",
    name: "Transmittal of Wage and Tax Statements",
    description: "Summary cover sheet that accompanies all W-2s sent to the SSA. Due Jan 31 with the W-2 batch.",
    kind: "info_return_filed",
    dueDate: "01-31",
    dueDateBasis: "annual-Jan31",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    requiredItems: [
      { label: "All W-2s for the year (totals)", itemType: "w2_batch_totals" },
      { label: "Employer EIN", itemType: "employer_ein" },
      { label: "Total wages, SS wages, Medicare wages", itemType: "w3_wage_totals" },
      { label: "Total federal income tax withheld", itemType: "w3_fit_total" },
    ],
    sources: [IRS_PDF("fw3"), IRS_PDF("iw2w3")],
    confidence: "common-practice",
  },

  // ── TIER 3 — Information returns received + 1099s filed ──────────────────

  {
    code: "1099-NEC",
    name: "Nonemployee Compensation",
    description: "Filed by businesses to report payments of $600+ to non-employee contractors. Due Jan 31 to both contractor and IRS.",
    kind: "info_return_filed",
    dueDate: "01-31",
    dueDateBasis: "annual-Jan31",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    requiredItems: [
      { label: "List of all contractors paid ≥$600 during year", itemType: "contractor_list" },
      { label: "Form W-9 from each contractor (with TIN)", itemType: "w9_collected" },
      { label: "Total nonemployee compensation per contractor", itemType: "nec_amounts" },
      { label: "Federal backup withholding (if any)", itemType: "backup_withholding" },
    ],
    sources: [IRS_PDF("f1099nec")],
    confidence: "common-practice",
  },

  {
    code: "1099-MISC",
    name: "Miscellaneous Information",
    description: "Reports payments of rent, royalties, prizes, medical/health payments, attorney payments, etc. Due Feb 28 (paper) / Mar 31 (e-file) to IRS.",
    kind: "info_return_filed",
    dueDate: "02-28",
    dueDateBasis: "annual-Feb28-paper-Mar31-efile",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    requiredItems: [
      { label: "Rent payments to landlords (≥$600)", itemType: "rent_payments" },
      { label: "Royalty payments (≥$10)", itemType: "royalty_payments" },
      { label: "Attorney payments (any amount, gross proceeds)", itemType: "attorney_payments" },
      { label: "Medical / health-care payments (≥$600)", itemType: "medical_payments" },
      { label: "W-9 from each recipient", itemType: "w9_collected" },
    ],
    sources: [IRS_PDF("f1099nec")], // IRS bundles 1099-NEC and 1099-MISC instructions together
    confidence: "common-practice",
  },

  {
    code: "1099-INT",
    name: "Interest Income",
    description: "Received by individuals from banks, brokerages, etc. for interest income ≥$10 in a year. Used as input to Form 1040 Schedule B.",
    kind: "info_return_received",
    dueDate: null,
    dueDateBasis: "received-not-filed",
    extensionForm: null,
    applicableEntities: ["Individual", "Trust", "Estate"],
    requiredItems: [
      { label: "Statement from each bank / brokerage / payer", itemType: "1099_int_statement" },
    ],
    sources: [IRS_PDF("f1099int")],
    confidence: "common-practice",
  },

  {
    code: "1099-DIV",
    name: "Dividends and Distributions",
    description: "Received by individuals/trusts for dividends and capital gain distributions ≥$10. Input to Form 1040 Schedule B + Schedule D.",
    kind: "info_return_received",
    dueDate: null,
    dueDateBasis: "received-not-filed",
    extensionForm: null,
    applicableEntities: ["Individual", "Trust", "Estate"],
    requiredItems: [
      { label: "Statement from each brokerage / mutual fund / corporation", itemType: "1099_div_statement" },
    ],
    sources: [IRS_PDF("f1099div")],
    confidence: "common-practice",
  },

  {
    code: "1099-R",
    name: "Distributions From Pensions, Annuities, Retirement or Profit-Sharing Plans, IRAs, Insurance Contracts, etc.",
    description: "Received by individuals when retirement / pension distributions are taken. Input to Form 1040.",
    kind: "info_return_received",
    dueDate: null,
    dueDateBasis: "received-not-filed",
    extensionForm: null,
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "Statement from each plan administrator", itemType: "1099_r_statement" },
      { label: "Confirmation of any rollovers (60-day or trustee-to-trustee)", itemType: "rollover_confirmation" },
    ],
    sources: [IRS_PDF("f1099r")],
    confidence: "common-practice",
  },

  {
    code: "1099-K",
    name: "Payment Card and Third Party Network Transactions",
    description: "Received from payment processors (Stripe, PayPal, Venmo for business, marketplace platforms). Threshold has shifted; must reconcile against actual income.",
    kind: "info_return_received",
    dueDate: null,
    dueDateBasis: "received-not-filed",
    extensionForm: null,
    applicableEntities: ["Individual", "Sole-Proprietor", "S-Corp", "C-Corp", "Partnership", "LLC"],
    requiredItems: [
      { label: "Statement from each platform / processor", itemType: "1099_k_statement" },
      { label: "Reconciliation: gross 1099-K amounts vs actual revenue (must match or explain)", itemType: "1099_k_reconciliation" },
    ],
    sources: [IRS_PDF("f1099k")],
    confidence: "common-practice",
  },

  {
    code: "1098",
    name: "Mortgage Interest Statement",
    description: "Received by homeowners from mortgage lenders. Reports mortgage interest paid during the year. Used if itemizing on Schedule A.",
    kind: "info_return_received",
    dueDate: null,
    dueDateBasis: "received-not-filed",
    extensionForm: null,
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "Statement from each mortgage lender", itemType: "1098_statement" },
      { label: "Property address (for identification)", itemType: "property_address" },
    ],
    sources: [IRS_PDF("f1098")],
    confidence: "common-practice",
  },

  {
    code: "1098-T",
    name: "Tuition Statement",
    description: "Received by students/parents from educational institutions. Used to claim American Opportunity Credit or Lifetime Learning Credit.",
    kind: "info_return_received",
    dueDate: null,
    dueDateBasis: "received-not-filed",
    extensionForm: null,
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "Statement from each educational institution", itemType: "1098t_statement" },
      { label: "Out-of-pocket education expenses not on 1098-T (books, required equipment)", itemType: "education_oop_expenses" },
    ],
    sources: [IRS_PDF("f1098t")],
    confidence: "common-practice",
  },

  // ── TIER 3 cont. — Foreign / international ───────────────────────────────

  {
    code: "5471",
    name: "Information Return of U.S. Persons With Respect To Certain Foreign Corporations",
    description: "Required of US persons who are officers, directors, or 10%+ shareholders of foreign corporations. Filed with the US person's main return.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual", "Foreign-filer", "C-Corp", "S-Corp", "Partnership", "LLC", "Trust"],
    requiredItems: [
      { label: "Foreign corporation's financials (income statement + balance sheet, in functional currency)", itemType: "foreign_corp_financials" },
      { label: "Ownership history (acquisition / disposition during year)", itemType: "foreign_corp_ownership_history" },
      { label: "List of all US shareholders with TINs", itemType: "us_shareholders_list" },
      { label: "Subpart F income computation (if applicable)", itemType: "subpart_f_computation" },
      { label: "GILTI computation (if applicable)", itemType: "gilti_computation" },
      { label: "Foreign corporation's Articles of Incorporation", itemType: "foreign_articles" },
    ],
    sources: [IRS_PDF("f5471"), IRS_PDF("i5471")],
    confidence: "common-practice",
  },

  {
    code: "5472",
    name: "Information Return of a 25% Foreign-Owned U.S. Corporation or a Foreign Corporation Engaged in a U.S. Trade or Business",
    description: "Filed by US corporations that are 25%+ foreign-owned, or foreign corps doing business in the US. Reports related-party transactions.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "fiscal-year-15-of-4th-month",
    extensionForm: "7004",
    applicableEntities: ["C-Corp", "Foreign-filer"],
    requiredItems: [
      { label: "List of foreign related parties (with countries + TINs)", itemType: "foreign_related_parties" },
      { label: "Reportable transactions with each related party (sales, loans, royalties, services)", itemType: "related_party_transactions" },
      { label: "Transfer-pricing documentation", itemType: "transfer_pricing_docs" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-5472"],
    confidence: "common-practice",
  },

  {
    code: "8865",
    name: "Return of U.S. Persons With Respect to Certain Foreign Partnerships",
    description: "Required of US persons with controlling interests or transfers in foreign partnerships. Filed with main return.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual", "Foreign-filer", "C-Corp", "S-Corp", "Partnership", "LLC"],
    requiredItems: [
      { label: "Foreign partnership's financials", itemType: "foreign_partnership_financials" },
      { label: "Capital account schedules for all partners", itemType: "foreign_partnership_capital" },
      { label: "Ownership history (changes during year)", itemType: "foreign_partnership_ownership" },
      { label: "Schedule K-1 from foreign partnership (if received)", itemType: "foreign_k1" },
    ],
    sources: [IRS_PDF("f8865"), IRS_PDF("i8865")],
    confidence: "common-practice",
  },

  {
    code: "8938",
    name: "Statement of Specified Foreign Financial Assets",
    description: "Required of US persons with foreign financial assets exceeding thresholds ($50K to $400K depending on filing status / residency). Filed with main return.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual", "Foreign-filer", "Trust"],
    requiredItems: [
      { label: "List of all foreign financial accounts (bank, brokerage) with year-end + max values", itemType: "foreign_financial_accounts" },
      { label: "List of foreign stocks / interests in foreign entities", itemType: "foreign_stocks_interests" },
      { label: "Foreign retirement accounts", itemType: "foreign_retirement" },
    ],
    sources: [IRS_PDF("f8938"), IRS_PDF("i8938")],
    confidence: "common-practice",
  },

  {
    code: "FinCEN-114",
    name: "Report of Foreign Bank and Financial Accounts (FBAR)",
    description: "Required of US persons with foreign financial accounts exceeding $10,000 at any time during the year. Filed with FinCEN (NOT IRS) by Apr 15 with auto-extension to Oct 15.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "annual-Oct15",
    extensionForm: null,
    applicableEntities: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC", "Trust", "Foreign-filer"],
    requiredItems: [
      { label: "List of all foreign accounts: bank name, country, account number, max balance", itemType: "fbar_account_list" },
      { label: "Confirmation of $10,000 aggregate threshold crossed at any time during year", itemType: "fbar_threshold_check" },
      { label: "Joint-owner information (if applicable)", itemType: "fbar_joint_owners" },
    ],
    sources: ["https://bsaefiling.fincen.treas.gov/main.html"],
    confidence: "common-practice",
  },

  // ── TIER 3 cont. — Specialty individual / entity ─────────────────────────

  {
    code: "8606",
    name: "Nondeductible IRAs",
    description: "Filed by individuals with nondeductible IRA contributions, Roth conversions, or distributions from IRAs with basis. Filed with Form 1040.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "Total IRA contributions for year (deductible + nondeductible)", itemType: "ira_contributions" },
      { label: "Roth conversion confirmations (if any)", itemType: "roth_conversions" },
      { label: "Prior-year Form 8606 (running basis)", itemType: "prior_8606" },
      { label: "1099-R for any IRA distributions", itemType: "ira_distributions_1099r" },
    ],
    sources: [IRS_PDF("f8606"), IRS_PDF("i8606")],
    confidence: "common-practice",
  },

  {
    code: "4562",
    name: "Depreciation and Amortization",
    description: "Filed with most business returns to claim depreciation on fixed assets. Section 179 + bonus depreciation elections also made here.",
    kind: "specialty",
    dueDate: null,
    dueDateBasis: "fiscal-year-15-of-4th-month",
    extensionForm: null,
    applicableEntities: ["Sole-Proprietor", "C-Corp", "S-Corp", "Partnership", "LLC", "Trust"],
    requiredItems: [
      { label: "Fixed asset additions during year (description, cost, date placed in service)", itemType: "fixed_asset_additions" },
      { label: "Fixed asset dispositions (sales price, accumulated depreciation)", itemType: "fixed_asset_dispositions" },
      { label: "Section 179 election decision (which assets, how much)", itemType: "section_179_election" },
      { label: "Listed-property usage logs (vehicles, computers used personally)", itemType: "listed_property_logs" },
      { label: "Prior-year depreciation schedule", itemType: "prior_depreciation_schedule" },
    ],
    sources: [IRS_PDF("f4562"), IRS_PDF("i4562")],
    confidence: "common-practice",
  },

  {
    code: "8949",
    name: "Sales and Other Dispositions of Capital Assets",
    description: "Lists every individual sale of stocks, crypto, real estate, etc. Aggregates flow to Schedule D. Filed with Form 1040 or 1041.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual", "Trust", "Estate"],
    requiredItems: [
      { label: "1099-B (every brokerage sale with cost basis)", itemType: "1099_b_brokerage" },
      { label: "Crypto exchange transaction history (CSV)", itemType: "crypto_transactions" },
      { label: "Real estate sale closing statements (HUD-1 / closing disclosure)", itemType: "real_estate_closing" },
      { label: "Cost basis records for un-tracked sales (gifts received, inherited assets)", itemType: "cost_basis_untracked" },
    ],
    sources: [IRS_PDF("f8949"), IRS_PDF("i8949")],
    confidence: "common-practice",
  },

  {
    code: "4797",
    name: "Sales of Business Property",
    description: "Reports sale of business assets (Section 1231 / 1245 / 1250). Filed with main business return.",
    kind: "specialty",
    dueDate: null,
    dueDateBasis: "fiscal-year-15-of-4th-month",
    extensionForm: null,
    applicableEntities: ["Sole-Proprietor", "C-Corp", "S-Corp", "Partnership", "LLC"],
    requiredItems: [
      { label: "Asset disposal records (description, date acquired, date sold, original cost, accumulated depreciation, sale price)", itemType: "asset_disposal_records" },
      { label: "Like-kind exchange documentation (if applicable, Form 8824)", itemType: "like_kind_exchange" },
    ],
    sources: [IRS_PDF("f4797"), IRS_PDF("i4797")],
    confidence: "common-practice",
  },

  {
    code: "5500",
    name: "Annual Return/Report of Employee Benefit Plan",
    description: "Required of employers sponsoring qualified retirement plans (401k, defined benefit, etc.) and certain welfare benefit plans. Due 7 months after plan year end (Jul 31 for calendar-year plans).",
    kind: "primary_filing",
    dueDate: "07-31",
    dueDateBasis: "annual-Jul31",
    extensionForm: "5558",
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC"],
    requiredItems: [
      { label: "Plan document + amendments", itemType: "plan_document" },
      { label: "Plan year-end financial statements", itemType: "plan_financial_statements" },
      { label: "Participant census (active + terminated + retired)", itemType: "participant_census" },
      { label: "Employer + employee contributions for the year", itemType: "plan_contributions" },
      { label: "Trust statements (assets at year-end + transactions)", itemType: "plan_trust_statements" },
      { label: "Auditor report (required if 100+ participants)", itemType: "plan_audit_report" },
    ],
    sources: [IRS_PDF("f5500"), IRS_PDF("i5500")],
    confidence: "common-practice",
  },

  {
    code: "8832",
    name: "Entity Classification Election",
    description: "Used to elect how a business entity is classified for federal tax purposes (e.g. LLC electing to be taxed as a corporation). Effective date is event-driven.",
    kind: "election",
    dueDate: null,
    dueDateBasis: "event-driven",
    extensionForm: null,
    applicableEntities: ["LLC", "Partnership", "C-Corp", "S-Corp"],
    requiredItems: [
      { label: "Entity formation documents (Articles of Organization / Incorporation)", itemType: "formation_documents" },
      { label: "Current EIN", itemType: "ein" },
      { label: "Desired classification + effective date", itemType: "classification_election" },
      { label: "Consent of all members / shareholders", itemType: "member_consent" },
    ],
    sources: [IRS_PDF("f8832")],
    confidence: "common-practice",
  },

  {
    code: "2553",
    name: "Election by a Small Business Corporation",
    description: "Used to elect S-Corp tax treatment. Generally must be filed within 2 months and 15 days of the start of the tax year for which the election is to take effect.",
    kind: "election",
    dueDate: null,
    dueDateBasis: "event-driven",
    extensionForm: null,
    applicableEntities: ["C-Corp", "LLC"],
    requiredItems: [
      { label: "Articles of Incorporation", itemType: "articles_incorporation" },
      { label: "Current EIN", itemType: "ein" },
      { label: "All shareholder consents (signed Form 2553 Part I)", itemType: "shareholder_consents" },
      { label: "Reasonable cause statement (if late election)", itemType: "late_election_cause" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-2553"],
    confidence: "common-practice",
  },

  // ── TIER 4 — Less common but still in top 50 ─────────────────────────────

  {
    code: "1120-W",
    name: "Estimated Tax for Corporations",
    description: "Quarterly estimated tax voucher set for C-corporations. Required when expected tax liability is $500+.",
    kind: "estimated_payment",
    dueDate: null,
    dueDateBasis: "quarterly-estimate",
    extensionForm: null,
    applicableEntities: ["C-Corp"],
    requiredItems: [
      { label: "Prior-year Form 1120 (for safe-harbor calculation)", itemType: "prior_year_1120" },
      { label: "Year-to-date taxable income", itemType: "ytd_corp_income" },
      { label: "Estimated full-year taxable income", itemType: "estimated_corp_income" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-1120-w"],
    confidence: "common-practice",
  },

  {
    code: "8825",
    name: "Rental Real Estate Income and Expenses of a Partnership or an S Corporation",
    description: "Used by partnerships and S-corps to report rental real estate income/expenses. Filed with Form 1065 or 1120-S.",
    kind: "specialty",
    dueDate: null,
    dueDateBasis: "fiscal-year-15-of-3rd-month",
    extensionForm: null,
    applicableEntities: ["Partnership", "S-Corp", "LLC"],
    requiredItems: [
      { label: "Per-property rent income statements", itemType: "property_rent_income" },
      { label: "Per-property operating expenses (taxes, insurance, repairs, utilities, management)", itemType: "property_operating_expenses" },
      { label: "Per-property depreciation schedule", itemType: "property_depreciation" },
      { label: "Mortgage interest paid per property (1098)", itemType: "property_mortgage_interest" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-8825"],
    confidence: "common-practice",
  },

  {
    code: "1099-S",
    name: "Proceeds From Real Estate Transactions",
    description: "Filed by closing agents / title companies for most real estate sales. Used by seller to report gain/loss.",
    kind: "info_return_received",
    dueDate: "02-28",
    dueDateBasis: "annual-Feb28-paper-Mar31-efile",
    extensionForm: null,
    applicableEntities: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC", "Trust", "Estate"],
    requiredItems: [
      { label: "Closing statement (HUD-1 / closing disclosure)", itemType: "real_estate_closing" },
      { label: "Original cost basis + improvements", itemType: "property_basis" },
      { label: "Selling expenses (commissions, fees)", itemType: "selling_expenses" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-1099-s"],
    confidence: "common-practice",
  },

  {
    code: "Schedule-C",
    name: "Profit or Loss from Business (Sole Proprietorship)",
    description: "Schedule attached to Form 1040 for self-employed individuals and single-member LLCs (default tax classification).",
    kind: "primary_filing",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Sole-Proprietor", "Individual", "LLC"],
    requiredItems: [
      { label: "Gross receipts / sales for the year", itemType: "business_receipts" },
      { label: "Cost of goods sold (if applicable, with year-end inventory)", itemType: "cogs" },
      { label: "Business expenses by category (advertising, supplies, travel, meals, etc.)", itemType: "business_expenses" },
      { label: "Vehicle mileage log (if claiming vehicle expenses)", itemType: "vehicle_mileage" },
      { label: "Home-office square footage and total home size (if claiming)", itemType: "home_office" },
      { label: "1099-NEC, 1099-K, 1099-MISC received for business income", itemType: "business_1099s_received" },
      { label: "Bank statements for business accounts", itemType: "business_bank_statements" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-c-form-1040"],
    confidence: "common-practice",
  },

  {
    code: "Schedule-SE",
    name: "Self-Employment Tax",
    description: "Computes Social Security + Medicare taxes for self-employed individuals. Attached to Form 1040 alongside Schedule C.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Sole-Proprietor", "Individual"],
    requiredItems: [
      { label: "Net earnings from self-employment (from Schedule C / K-1)", itemType: "self_employment_income" },
      { label: "Religious / clergy exemption documentation (if applicable)", itemType: "se_exemption" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-se-form-1040"],
    confidence: "common-practice",
  },

  {
    code: "Schedule-E",
    name: "Supplemental Income and Loss",
    description: "Schedule attached to Form 1040 for rental real estate, royalties, partnerships, S-corps, estates, trusts (K-1 income flows here).",
    kind: "primary_filing",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "All Schedule K-1s received from partnerships / S-Corps / trusts / estates", itemType: "k1_received" },
      { label: "Per-property rental income (rents collected)", itemType: "property_rent_income" },
      { label: "Per-property rental expenses (taxes, insurance, repairs, utilities, mortgage interest)", itemType: "property_operating_expenses" },
      { label: "Per-property depreciation schedule (or basis info to compute)", itemType: "property_depreciation" },
      { label: "Royalty statements (oil/gas/intellectual property)", itemType: "royalty_statements" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-e-form-1040"],
    confidence: "common-practice",
  },

  {
    code: "K-1-1065",
    name: "Partner's Share of Income, Deductions, Credits, etc. (Form 1065)",
    description: "Issued by partnerships to each partner. Reports the partner's allocable share. Used as input to the partner's individual or business return.",
    kind: "info_return_filed",
    dueDate: "03-15",
    dueDateBasis: "fiscal-year-15-of-3rd-month",
    extensionForm: "7004",
    applicableEntities: ["Partnership", "LLC"],
    requiredItems: [
      { label: "Final Form 1065 with all schedules", itemType: "final_1065" },
      { label: "Partner-by-partner allocation of income / deductions / credits", itemType: "partner_allocation" },
      { label: "Updated capital account per partner", itemType: "partner_capital" },
      { label: "Distributions per partner during year", itemType: "partner_distributions" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065"],
    confidence: "common-practice",
  },

  {
    code: "K-1-1120-S",
    name: "Shareholder's Share of Income, Deductions, Credits, etc. (Form 1120-S)",
    description: "Issued by S-corps to each shareholder. Reports the shareholder's allocable share. Used as input to the shareholder's Form 1040.",
    kind: "info_return_filed",
    dueDate: "03-15",
    dueDateBasis: "fiscal-year-15-of-3rd-month",
    extensionForm: "7004",
    applicableEntities: ["S-Corp"],
    requiredItems: [
      { label: "Final Form 1120-S with all schedules", itemType: "final_1120s" },
      { label: "Shareholder-by-shareholder allocation (pro-rata by share %)", itemType: "shareholder_allocation" },
      { label: "Stock + debt basis tracking per shareholder", itemType: "shareholder_basis" },
      { label: "Distributions per shareholder during year", itemType: "scorp_distribution" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1120-s"],
    confidence: "common-practice",
  },

  {
    code: "K-1-1041",
    name: "Beneficiary's Share of Income, Deductions, Credits, etc. (Form 1041)",
    description: "Issued by trusts/estates to each beneficiary. Reports the beneficiary's allocable share. Used as input to the beneficiary's Form 1040.",
    kind: "info_return_filed",
    dueDate: "04-15",
    dueDateBasis: "fiscal-year-15-of-4th-month",
    extensionForm: "7004",
    applicableEntities: ["Trust", "Estate"],
    requiredItems: [
      { label: "Final Form 1041 with all schedules", itemType: "final_1041" },
      { label: "Beneficiary-by-beneficiary distribution allocation (DNI calculation)", itemType: "beneficiary_allocation" },
      { label: "Beneficiary list with TINs", itemType: "beneficiary_list" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1041"],
    confidence: "common-practice",
  },

  {
    code: "Schedule-B",
    name: "Interest and Ordinary Dividends",
    description: "Attached to Form 1040 when interest or dividend income exceeds $1,500. Lists each payer.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "All 1099-INT statements", itemType: "1099_int_statement" },
      { label: "All 1099-DIV statements", itemType: "1099_div_statement" },
      { label: "Foreign accounts disclosure (Part III) — yes/no for FBAR / 8938", itemType: "foreign_account_disclosure" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-b-form-1040"],
    confidence: "common-practice",
  },

  {
    code: "Schedule-D",
    name: "Capital Gains and Losses",
    description: "Attached to Form 1040, 1041, 1120, etc. when there are capital gains/losses. Aggregates from Form 8949.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual", "C-Corp", "Trust", "Estate"],
    requiredItems: [
      { label: "Form 8949 (computed first)", itemType: "form_8949_complete" },
      { label: "Capital loss carryover from prior year", itemType: "capital_loss_carryover" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-d-form-1040"],
    confidence: "common-practice",
  },

  {
    code: "Schedule-A",
    name: "Itemized Deductions",
    description: "Attached to Form 1040 when itemized deductions exceed the standard deduction. Covers medical, taxes (SALT capped at $10K), mortgage interest, charitable, casualty.",
    kind: "specialty",
    dueDate: "04-15",
    dueDateBasis: "calendar-year-Apr15",
    extensionForm: "4868",
    applicableEntities: ["Individual"],
    requiredItems: [
      { label: "Medical expense receipts (out-of-pocket, > 7.5% AGI floor)", itemType: "medical_receipts" },
      { label: "State income tax + property tax payments (SALT cap $10K)", itemType: "state_local_taxes" },
      { label: "Mortgage interest (1098 statements)", itemType: "1098_mortgage" },
      { label: "Charitable contribution receipts (cash + non-cash with appraisals if >$5K)", itemType: "charitable_receipts" },
      { label: "Casualty loss documentation (federally declared disasters only)", itemType: "casualty_loss_docs" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-schedule-a-form-1040"],
    confidence: "common-practice",
  },

  {
    code: "5558",
    name: "Application for Extension of Time to File Certain Employee Plan Returns",
    description: "Two-and-a-half-month extension for Form 5500 series. Must be filed by the original 5500 due date (Jul 31 for calendar plans).",
    kind: "extension",
    dueDate: "07-31",
    dueDateBasis: "annual-Jul31",
    extensionForm: null,
    applicableEntities: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC"],
    requiredItems: [
      { label: "Plan name + EIN + plan number", itemType: "plan_id" },
      { label: "Plan year being extended", itemType: "plan_year" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-5558"],
    confidence: "common-practice",
  },

  {
    code: "4768",
    name: "Application for Extension of Time To File a Return and/or Pay U.S. Estate (and Generation-Skipping Transfer) Taxes",
    description: "Six-month extension of time to file Form 706. Must be filed by the original 706 due date (9 months after date of death).",
    kind: "extension",
    dueDate: null,
    dueDateBasis: "event-driven",
    extensionForm: null,
    applicableEntities: ["Estate"],
    requiredItems: [
      { label: "Decedent name + SSN + date of death", itemType: "decedent_id" },
      { label: "Executor name + address", itemType: "executor_id" },
      { label: "Estimated estate tax liability", itemType: "estimated_estate_tax" },
      { label: "Reason for extension request", itemType: "extension_reason" },
    ],
    sources: [IRS_PDF("f4768")],
    confidence: "common-practice",
  },

  {
    code: "1042-S",
    name: "Foreign Person's U.S. Source Income Subject to Withholding",
    description: "Filed by US payers reporting US-source income paid to foreign persons (interest, dividends, royalties, services). Due Mar 15.",
    kind: "info_return_filed",
    dueDate: "03-15",
    dueDateBasis: "calendar-year-Mar15",
    extensionForm: null,
    applicableEntities: ["C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor", "Trust", "Estate", "Employer"],
    requiredItems: [
      { label: "List of foreign payees with W-8 forms (W-8BEN, W-8BEN-E, W-8ECI, etc.)", itemType: "foreign_payee_w8" },
      { label: "Income paid by category and recipient (gross + withholding)", itemType: "foreign_income_paid" },
      { label: "Treaty claims (if any)", itemType: "treaty_claims" },
    ],
    sources: ["https://www.irs.gov/forms-pubs/about-form-1042-s"],
    confidence: "common-practice",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FEDERAL_FORMS_BY_CODE: Map<string, FederalForm> = new Map(
  FEDERAL_FORMS.map((f) => [f.code, f] as const),
);

export function federalFormByCode(code: string): FederalForm | undefined {
  return FEDERAL_FORMS_BY_CODE.get(code);
}

export function federalFormsForEntity(entity: FormEntityScope): FederalForm[] {
  return FEDERAL_FORMS.filter(
    (f) => f.applicableEntities.includes(entity) || f.applicableEntities.includes("Any"),
  );
}

export function federalFormsByKind(kind: FormKind): FederalForm[] {
  return FEDERAL_FORMS.filter((f) => f.kind === kind);
}
