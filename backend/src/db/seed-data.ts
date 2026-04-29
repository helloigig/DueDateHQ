/**
 * System service packages + templates seed data.
 *
 * Phase 0 scope: federal forms + CA / NY / TX / LA / FL state forms. ~12
 * packages, ~20 templates. Enough for demo coverage and for a real CPA
 * working in any of the five Phase 0 states. PRD v0.7 §10.3 P0 #11 calls
 * for "50-state deadline database + ~30 service packages" — that's the
 * full target; this file is a meaningful subset.
 *
 * Each template carries:
 *  - dueDateRule: JSONB consumed by `lib/due-date-rules.ts:computeDueDate`
 *  - rolloverRule: how the period rolls forward (annual vs quarterly)
 *  - defaultReminderSchedule: when to fire reminders relative to the deadline
 *  - standardChecklist: Mode A baseline items the AI uses as starting point
 *
 * Adding a new template: append to `TEMPLATES`, then reference its key in
 * a package's `templateKeys` array.
 */
import type { DueDateRule } from "../lib/due-date-rules.js";

interface SystemTemplate {
  /** Stable key — referenced from packages. Not stored in DB. */
  key: string;
  formType: string;
  jurisdiction: string; // 'federal' | 'ca' | 'ny' | 'tx' | 'la' | 'fl'
  description: string;
  dueDateRule: DueDateRule;
  rolloverRule: { type: "annual" | "quarterly" };
  defaultReminderSchedule: Array<{ trigger: string; templateKey: string }>;
  standardChecklist: Array<{ label: string; itemType: string }>;
}

interface SystemPackage {
  name: string;
  description: string;
  applicableEntityTypes: string[]; // 'Individual'|'LLC'|'S-Corp'|'C-Corp'|'Partnership'|'Trust'
  applicableStates: string[] | null; // null = federal-only / any
  templateKeys: string[];
}

const ANNUAL_REMINDERS = [
  { trigger: "T-90", templateKey: "initial" },
  { trigger: "T-30", templateKey: "t_minus_30" },
  { trigger: "T-14", templateKey: "t_minus_14" },
  { trigger: "T-7", templateKey: "t_minus_7" },
  { trigger: "T-1", templateKey: "t_minus_1" },
];

const QUARTERLY_REMINDERS = [
  { trigger: "T-21", templateKey: "initial" },
  { trigger: "T-7", templateKey: "t_minus_7" },
  { trigger: "T-1", templateKey: "t_minus_1" },
];

export const TEMPLATES: SystemTemplate[] = [
  // ---------- Federal ----------
  {
    key: "fed-1040",
    formType: "1040",
    jurisdiction: "federal",
    description: "U.S. Individual Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "W-2 wage statements", itemType: "wage_w2" },
      { label: "1099 forms (DIV / INT / NEC / B / R)", itemType: "1099_any" },
      { label: "K-1 from any pass-through", itemType: "k1" },
      { label: "1098 mortgage interest", itemType: "1098_mortgage" },
      { label: "Schedule E supporting docs (if rental)", itemType: "schedule_e_support" },
      { label: "Engagement letter (signed)", itemType: "engagement_letter" },
    ],
  },
  {
    key: "fed-1040-es",
    formType: "1040-ES",
    jurisdiction: "federal",
    description: "Individual Estimated Tax — quarterly vouchers",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 15 },
        { month: 6, day: 15 },
        { month: 9, day: 15 },
        { month: 1, day: 15 },
      ],
    },
    rolloverRule: { type: "quarterly" },
    defaultReminderSchedule: QUARTERLY_REMINDERS,
    standardChecklist: [
      { label: "Year-end planning request", itemType: "advisory_request" },
      { label: "Estimate worksheet", itemType: "estimate_worksheet" },
    ],
  },
  {
    key: "fed-1065",
    formType: "1065",
    jurisdiction: "federal",
    description: "Partnership Return of Income",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "Partnership books closed", itemType: "books_closing" },
      { label: "Partner list with ownership %", itemType: "partner_list" },
      { label: "K-1 distributions schedule", itemType: "k1_distributions" },
      { label: "Year-end balance sheet", itemType: "balance_sheet" },
    ],
  },
  {
    key: "fed-1120s",
    formType: "1120-S",
    jurisdiction: "federal",
    description: "S-Corporation Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "S-Corp books closed", itemType: "books_closing" },
      { label: "Shareholder list with ownership %", itemType: "shareholder_list" },
      { label: "Officer compensation summary", itemType: "officer_comp" },
      { label: "Distributions ledger", itemType: "distributions_ledger" },
    ],
  },
  {
    key: "fed-1120",
    formType: "1120",
    jurisdiction: "federal",
    description: "C-Corporation Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "Year-end financials closed", itemType: "books_closing" },
      { label: "Officer compensation", itemType: "officer_comp" },
      { label: "Trial balance", itemType: "trial_balance" },
    ],
  },
  {
    key: "fed-1120w",
    formType: "1120-W",
    jurisdiction: "federal",
    description: "C-Corp Estimated Tax — quarterly",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 15 },
        { month: 6, day: 15 },
        { month: 9, day: 15 },
        { month: 12, day: 15 },
      ],
    },
    rolloverRule: { type: "quarterly" },
    defaultReminderSchedule: QUARTERLY_REMINDERS,
    standardChecklist: [{ label: "Estimate worksheet", itemType: "estimate_worksheet" }],
  },
  {
    key: "fed-941",
    formType: "941",
    jurisdiction: "federal",
    description: "Quarterly Federal Payroll Tax Return",
    dueDateRule: {
      type: "quarterly_fixed",
      periods: [
        { month: 4, day: 30 },
        { month: 7, day: 31 },
        { month: 10, day: 31 },
        { month: 1, day: 31 },
      ],
    },
    rolloverRule: { type: "quarterly" },
    defaultReminderSchedule: QUARTERLY_REMINDERS,
    standardChecklist: [
      { label: "Payroll register for the quarter", itemType: "payroll_register" },
      { label: "Form 941 schedule B (semi-weekly depositors)", itemType: "941_schedule_b" },
    ],
  },

  // ---------- California ----------
  {
    key: "ca-540",
    formType: "CA 540",
    jurisdiction: "ca",
    description: "California Resident Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [{ label: "CA-source income summary", itemType: "ca_source_income" }],
  },
  {
    key: "ca-100s",
    formType: "CA 100S",
    jurisdiction: "ca",
    description: "California S-Corporation Franchise Tax Return",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "$800 minimum tax verification", itemType: "ca_min_tax" },
    ],
  },
  {
    key: "ca-565",
    formType: "CA 565",
    jurisdiction: "ca",
    description: "California Partnership Return of Income",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "ca-568",
    formType: "CA 568",
    jurisdiction: "ca",
    description: "California LLC Return of Income (with annual fee + $800 min)",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "Total CA income (drives LLC fee tier)", itemType: "ca_llc_income" },
      { label: "$800 minimum tax verification", itemType: "ca_min_tax" },
    ],
  },
  {
    key: "ca-100",
    formType: "CA 100",
    jurisdiction: "ca",
    description: "California Corporation Franchise Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- New York ----------
  {
    key: "ny-it201",
    formType: "NY IT-201",
    jurisdiction: "ny",
    description: "NY Resident Individual Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [{ label: "NY-source income summary", itemType: "ny_source_income" }],
  },
  {
    key: "ny-ct3",
    formType: "NY CT-3",
    jurisdiction: "ny",
    description: "NY Corporation Franchise Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "ny-it204",
    formType: "NY IT-204",
    jurisdiction: "ny",
    description: "NY Partnership Return",
    dueDateRule: { type: "annual_fixed", month: 3, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- Texas ----------
  {
    key: "tx-franchise",
    formType: "TX Franchise",
    jurisdiction: "tx",
    description: "Texas Franchise Tax Report (Form 05-158-A or 05-163 No-Tax-Due)",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [
      { label: "Total TX revenue (drives no-tax-due eligibility)", itemType: "tx_revenue" },
    ],
  },

  // ---------- Louisiana ----------
  {
    key: "la-cift620",
    formType: "LA CIFT-620",
    jurisdiction: "la",
    description: "Louisiana Corporation Income & Franchise Tax",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "la-it540",
    formType: "LA IT-540",
    jurisdiction: "la",
    description: "Louisiana Resident Individual Income Tax",
    dueDateRule: { type: "annual_fixed", month: 5, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- Florida ----------
  {
    key: "fl-f1120",
    formType: "FL F-1120",
    jurisdiction: "fl",
    description: "Florida Corporate Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 5, day: 1 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- Illinois ----------
  {
    key: "il-1040",
    formType: "IL-1040",
    jurisdiction: "il",
    description: "Illinois Individual Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "il-1120",
    formType: "IL-1120",
    jurisdiction: "il",
    description: "Illinois Corporation Income & Replacement Tax",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- Pennsylvania ----------
  {
    key: "pa-40",
    formType: "PA-40",
    jurisdiction: "pa",
    description: "Pennsylvania Individual Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "pa-rct101",
    formType: "PA RCT-101",
    jurisdiction: "pa",
    description: "Pennsylvania Corporate Tax Report",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- Georgia ----------
  {
    key: "ga-500",
    formType: "GA-500",
    jurisdiction: "ga",
    description: "Georgia Individual Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "ga-600",
    formType: "GA-600",
    jurisdiction: "ga",
    description: "Georgia Corporation Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- New Jersey ----------
  {
    key: "nj-1040",
    formType: "NJ-1040",
    jurisdiction: "nj",
    description: "NJ Resident Individual Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "nj-cbt100",
    formType: "NJ CBT-100",
    jurisdiction: "nj",
    description: "NJ Corporation Business Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },

  // ---------- Massachusetts ----------
  {
    key: "ma-1",
    formType: "MA Form 1",
    jurisdiction: "ma",
    description: "Massachusetts Resident Income Tax Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
  {
    key: "ma-355",
    formType: "MA Form 355",
    jurisdiction: "ma",
    description: "Massachusetts Corporate Excise Return",
    dueDateRule: { type: "annual_fixed", month: 4, day: 15 },
    rolloverRule: { type: "annual" },
    defaultReminderSchedule: ANNUAL_REMINDERS,
    standardChecklist: [],
  },
];

export const PACKAGES: SystemPackage[] = [
  {
    name: "Individual — Federal",
    description: "1040 + quarterly estimates. Federal-only.",
    applicableEntityTypes: ["Individual"],
    applicableStates: null,
    templateKeys: ["fed-1040", "fed-1040-es"],
  },
  {
    name: "Individual — Federal + CA",
    description: "Federal 1040 + estimates + CA resident return.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["CA"],
    templateKeys: ["fed-1040", "fed-1040-es", "ca-540"],
  },
  {
    name: "Individual — Federal + NY",
    description: "Federal 1040 + estimates + NY IT-201.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["NY"],
    templateKeys: ["fed-1040", "fed-1040-es", "ny-it201"],
  },
  {
    name: "Individual — Federal + LA",
    description: "Federal 1040 + estimates + LA IT-540.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["LA"],
    templateKeys: ["fed-1040", "fed-1040-es", "la-it540"],
  },
  {
    name: "S-Corp — Federal + CA",
    description: "1120-S + quarterly 941 + CA 100S franchise.",
    applicableEntityTypes: ["S-Corp"],
    applicableStates: ["CA"],
    templateKeys: ["fed-1120s", "fed-941", "ca-100s"],
  },
  {
    name: "S-Corp — Federal + NY",
    description: "1120-S + quarterly 941 + NY CT-3.",
    applicableEntityTypes: ["S-Corp"],
    applicableStates: ["NY"],
    templateKeys: ["fed-1120s", "fed-941", "ny-ct3"],
  },
  {
    name: "S-Corp — Federal + TX",
    description: "1120-S + quarterly 941 + TX Franchise.",
    applicableEntityTypes: ["S-Corp"],
    applicableStates: ["TX"],
    templateKeys: ["fed-1120s", "fed-941", "tx-franchise"],
  },
  {
    name: "Partnership — Federal + CA",
    description: "1065 + 941 + CA 565.",
    applicableEntityTypes: ["Partnership"],
    applicableStates: ["CA"],
    templateKeys: ["fed-1065", "fed-941", "ca-565"],
  },
  {
    name: "Partnership — Federal + NY",
    description: "1065 + 941 + NY IT-204.",
    applicableEntityTypes: ["Partnership"],
    applicableStates: ["NY"],
    templateKeys: ["fed-1065", "fed-941", "ny-it204"],
  },
  {
    name: "C-Corp — Federal + CA",
    description: "1120 + quarterly estimates + CA 100.",
    applicableEntityTypes: ["C-Corp"],
    applicableStates: ["CA"],
    templateKeys: ["fed-1120", "fed-1120w", "ca-100"],
  },
  {
    name: "C-Corp — Federal + FL",
    description: "1120 + quarterly estimates + FL F-1120.",
    applicableEntityTypes: ["C-Corp"],
    applicableStates: ["FL"],
    templateKeys: ["fed-1120", "fed-1120w", "fl-f1120"],
  },
  {
    name: "LLC Pass-Through — Federal + CA",
    description: "1065 + CA 568 (LLC fee + $800 min). For LLCs taxed as partnerships.",
    applicableEntityTypes: ["LLC"],
    applicableStates: ["CA"],
    templateKeys: ["fed-1065", "ca-568"],
  },
  {
    name: "Individual — Federal + IL",
    description: "Federal 1040 + estimates + IL-1040.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["IL"],
    templateKeys: ["fed-1040", "fed-1040-es", "il-1040"],
  },
  {
    name: "Individual — Federal + PA",
    description: "Federal 1040 + estimates + PA-40.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["PA"],
    templateKeys: ["fed-1040", "fed-1040-es", "pa-40"],
  },
  {
    name: "Individual — Federal + GA",
    description: "Federal 1040 + estimates + GA-500.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["GA"],
    templateKeys: ["fed-1040", "fed-1040-es", "ga-500"],
  },
  {
    name: "Individual — Federal + NJ",
    description: "Federal 1040 + estimates + NJ-1040.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["NJ"],
    templateKeys: ["fed-1040", "fed-1040-es", "nj-1040"],
  },
  {
    name: "Individual — Federal + MA",
    description: "Federal 1040 + estimates + MA Form 1.",
    applicableEntityTypes: ["Individual"],
    applicableStates: ["MA"],
    templateKeys: ["fed-1040", "fed-1040-es", "ma-1"],
  },
  {
    name: "C-Corp — Federal + IL",
    description: "1120 + estimates + IL-1120.",
    applicableEntityTypes: ["C-Corp"],
    applicableStates: ["IL"],
    templateKeys: ["fed-1120", "fed-1120w", "il-1120"],
  },
  {
    name: "C-Corp — Federal + NJ",
    description: "1120 + estimates + NJ CBT-100.",
    applicableEntityTypes: ["C-Corp"],
    applicableStates: ["NJ"],
    templateKeys: ["fed-1120", "fed-1120w", "nj-cbt100"],
  },
  {
    name: "C-Corp — Federal + GA",
    description: "1120 + estimates + GA-600.",
    applicableEntityTypes: ["C-Corp"],
    applicableStates: ["GA"],
    templateKeys: ["fed-1120", "fed-1120w", "ga-600"],
  },
];
