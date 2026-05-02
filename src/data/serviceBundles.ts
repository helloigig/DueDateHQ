/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Service bundles — packages a CPA firm sells, defined by which federal
 *  forms they include.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  PURPOSE
 *  A bundle describes "what the firm does for a client on this package."
 *  Bundles reference forms by code (from `federalForms.ts`); the same form
 *  can appear in many bundles (e.g. Schedule E appears in both
 *  Individual+Rental and Individual+PTE because both kinds of clients
 *  receive Schedule E income from rental property or pass-through K-1s).
 *
 *  WHY NORMALIZED (forms separate from bundles)
 *  Earlier `bundles.ts` inlined form names + due dates per template, so
 *  the same form's metadata had to be repeated across bundles. With this
 *  catalog: one form = one source of truth (due date, extension, checklist),
 *  bundles just compose. Adding a new bundle is now a one-line change
 *  referencing existing form codes.
 *
 *  STATE FORMS
 *  This file lists only FEDERAL form codes. State equivalents (CA Form 100S,
 *  NY CT-3-S, LA IT-540, etc.) are added via the bundle's `stateForms`
 *  field, which is filled in per-client based on primaryState + nexusStates.
 *  Phase 5 will introduce a state catalog parallel to federalForms.ts.
 *
 *  BACKWARD COMPATIBILITY
 *  The legacy `bundles.ts` (with inline DeadlineTemplate) is left in place.
 *  Existing FE consumers continue to read from it. New consumers wire to
 *  this file. A follow-up PR will migrate the legacy bundles list to
 *  reference `serviceBundles.ts` and retire the inline templates.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { FormEntityScope } from "./federalForms";

export interface ServiceBundle {
  /** Stable id (lowercase-hyphen). */
  id: string;
  /** Display name shown to CPA + client. */
  name: string;
  /** Plain-English description of what's included and who it's for. */
  description: string;
  /** Which entity types typically buy this bundle. */
  entityTypes: FormEntityScope[];
  /** Federal form codes (refer to FEDERAL_FORMS in federalForms.ts). */
  includedFormCodes: string[];
  /**
   * Optional fee in USD/year. Metadata only — billing happens elsewhere
   * (QuickBooks, Stripe). Surfaces as context on Client view.
   */
  fee?: number;
  /** Short pitch shown when CPA is choosing a bundle to assign. */
  targetClient?: string;
  /** Indicates this bundle is an add-on layered on top of a primary bundle. */
  addOn?: boolean;
}

export const SERVICE_BUNDLES: ServiceBundle[] = [
  // ── INDIVIDUAL ────────────────────────────────────────────────────────────
  {
    id: "individual-standard",
    name: "Individual Standard",
    description: "Federal + state individual return for W-2 employees with standard tax situation.",
    entityTypes: ["Individual"],
    includedFormCodes: ["1040", "Schedule-A", "Schedule-B", "4868"],
    targetClient: "W-2 employees, simple tax situation, possibly itemizing.",
  },

  {
    id: "individual-self-employed",
    name: "Individual + Self-Employed",
    description: "Federal + state for sole proprietors and freelancers. Includes Schedule C, SE tax, quarterly estimates.",
    entityTypes: ["Individual", "Sole-Proprietor"],
    includedFormCodes: ["1040", "Schedule-C", "Schedule-SE", "Schedule-A", "Schedule-B", "1040-ES", "4868"],
    targetClient: "Freelancers, gig workers, single-member LLCs (default tax classification), consultants.",
  },

  {
    id: "individual-investments",
    name: "Individual + Investments",
    description: "Federal + state with significant investment activity — capital gains, dividend income, possibly K-1s from passive investments.",
    entityTypes: ["Individual"],
    includedFormCodes: ["1040", "Schedule-A", "Schedule-B", "Schedule-D", "8949", "Schedule-E", "1040-ES", "4868"],
    targetClient: "Active investors, those with significant brokerage activity, K-1 recipients from passive investments.",
  },

  {
    id: "individual-rental",
    name: "Individual + Rental Property",
    description: "Federal + state for landlords. Includes Schedule E rental reporting + depreciation tracking.",
    entityTypes: ["Individual"],
    includedFormCodes: ["1040", "Schedule-A", "Schedule-E", "4562", "4797", "1040-ES", "4868"],
    targetClient: "Single-family or small multi-family rental owners (held in personal name).",
  },

  {
    id: "individual-pte",
    name: "Individual + PTE Pass-Through Owner",
    description: "Federal + state for individuals receiving K-1 income from S-Corps or partnerships, with PTE state election support.",
    entityTypes: ["Individual"],
    includedFormCodes: ["1040", "Schedule-A", "Schedule-B", "Schedule-E", "1040-ES", "4868"],
    targetClient: "Owners of S-Corps or partnerships filing personal returns; SALT-cap optimization candidates.",
  },

  // ── BUSINESS — primary entity returns ────────────────────────────────────
  {
    id: "scorp-standard",
    name: "S-Corp Standard",
    description: "Federal S-Corp return + K-1s + reasonable-comp analysis + state. Includes quarterly estimates support.",
    entityTypes: ["S-Corp"],
    includedFormCodes: ["1120-S", "K-1-1120-S", "4562", "7004", "1040-ES"],
    targetClient: "Single-state S-Corps with active operations.",
  },

  {
    id: "partnership-standard",
    name: "Partnership Standard",
    description: "Federal partnership return + K-1s + capital account tracking + state. For multi-member LLCs taxed as partnerships, general partnerships, LPs.",
    entityTypes: ["Partnership", "LLC"],
    includedFormCodes: ["1065", "K-1-1065", "4562", "7004"],
    targetClient: "Multi-member LLCs, general partnerships, limited partnerships in a single state.",
  },

  {
    id: "ccorp-standard",
    name: "C-Corp Standard",
    description: "Federal C-Corp return + state corporate + quarterly federal estimates. For traditional C-corps not on S election.",
    entityTypes: ["C-Corp"],
    includedFormCodes: ["1120", "1120-W", "4562", "7004"],
    targetClient: "C-corps with simple-to-moderate complexity, not multi-state.",
  },

  // ── SPECIALTY ENTITIES ──────────────────────────────────────────────────
  {
    id: "trust-annual",
    name: "Trust Annual",
    description: "Federal Form 1041 + K-1 distributions to beneficiaries + state trust return.",
    entityTypes: ["Trust"],
    includedFormCodes: ["1041", "K-1-1041", "Schedule-D", "8949", "7004"],
    targetClient: "Living trusts, irrevocable trusts, complex trusts with annual income.",
  },

  {
    id: "estate-administration",
    name: "Estate Administration",
    description: "Estate tax return (Form 706) + final-year individual return + ongoing estate income tax (1041) until estate closes.",
    entityTypes: ["Estate"],
    includedFormCodes: ["706", "1040", "1041", "K-1-1041"],
    targetClient: "Estates of decedents with assets exceeding the federal exemption, or requiring portability election.",
  },

  {
    id: "nonprofit-standard",
    name: "Nonprofit Standard",
    description: "Form 990 (or 990-EZ / 990-N depending on size) + state nonprofit return. Tax-exempt entities only.",
    entityTypes: ["Nonprofit"],
    includedFormCodes: ["990", "990-EZ", "990-N", "8868"],
    targetClient: "501(c)(3) public charities, 501(c)(6) trade associations, etc. Form selected based on gross receipts thresholds.",
  },

  // ── ADD-ONS (layered on top of primary bundles) ──────────────────────────
  {
    id: "addon-payroll-tied",
    name: "Payroll-Tied Filings",
    description: "Quarterly + annual federal employment returns for employers with staff. Add-on to any business bundle.",
    entityTypes: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC", "Sole-Proprietor"],
    includedFormCodes: ["941", "940", "W-2", "W-3", "1099-NEC", "1099-MISC"],
    addOn: true,
    targetClient: "Any business with W-2 employees or 1099-NEC contractors.",
  },

  {
    id: "addon-multistate",
    name: "Multi-state Add-on",
    description: "State filings for any nexus state beyond the primary state. Charged per additional state. Federal forms unchanged.",
    entityTypes: ["C-Corp", "S-Corp", "Partnership", "LLC", "Individual", "Trust"],
    includedFormCodes: [],
    addOn: true,
    targetClient: "Clients with revenue / property / payroll in multiple states.",
  },

  {
    id: "addon-international",
    name: "International Disclosure Add-on",
    description: "Required forms for clients with foreign holdings, accounts, or income. Add-on to any individual or business bundle.",
    entityTypes: ["Individual", "C-Corp", "S-Corp", "Partnership", "LLC", "Trust", "Foreign-filer"],
    includedFormCodes: ["5471", "5472", "8865", "8938", "FinCEN-114", "1042-S"],
    addOn: true,
    targetClient: "Clients with foreign bank accounts > $10K (FBAR), foreign corporate ownership, foreign partnership interests, or US-source payments to foreign persons.",
  },

  {
    id: "addon-retirement-plan",
    name: "Retirement Plan Filings",
    description: "Form 5500 for sponsored employee benefit plans (401k, defined benefit). Add-on for businesses with qualified plans.",
    entityTypes: ["Employer", "C-Corp", "S-Corp", "Partnership", "LLC"],
    includedFormCodes: ["5500", "5558"],
    addOn: true,
    targetClient: "Businesses sponsoring 401(k), profit-sharing, or pension plans (some plans below 100 participants are exempt).",
  },

  {
    id: "addon-real-estate-business",
    name: "Real Estate Business Add-on",
    description: "Rental real estate held inside a partnership or S-Corp. Add-on to the entity's primary bundle.",
    entityTypes: ["Partnership", "S-Corp", "LLC"],
    includedFormCodes: ["8825", "4562", "4797"],
    addOn: true,
    targetClient: "Partnerships or S-corps that hold rental real estate as the primary business activity.",
  },

  {
    id: "addon-gift-tax",
    name: "Gift Tax Filing",
    description: "Form 709 for individuals making gifts above the annual exclusion. Filed alongside Form 1040.",
    entityTypes: ["Individual"],
    includedFormCodes: ["709"],
    addOn: true,
    targetClient: "Individuals making gifts > $18K per recipient per year (2024 exclusion), or using lifetime exemption.",
  },

  {
    id: "addon-entity-elections",
    name: "Entity Classification Election",
    description: "One-time forms to elect or change tax classification — S-Corp election, LLC tax classification.",
    entityTypes: ["LLC", "C-Corp", "Partnership"],
    includedFormCodes: ["2553", "8832"],
    addOn: true,
    targetClient: "New entities or those changing tax classification (e.g. LLC electing S-Corp treatment).",
  },
];

const SERVICE_BUNDLES_BY_ID: Map<string, ServiceBundle> = new Map(
  SERVICE_BUNDLES.map((b) => [b.id, b] as const),
);

export function serviceBundleById(id: string): ServiceBundle | undefined {
  return SERVICE_BUNDLES_BY_ID.get(id);
}

export function serviceBundlesForEntity(entity: FormEntityScope): ServiceBundle[] {
  return SERVICE_BUNDLES.filter(
    (b) => b.entityTypes.includes(entity) || b.entityTypes.includes("Any"),
  );
}

/** Add-on bundles that can be layered on top of a primary bundle. */
export function addOnBundles(): ServiceBundle[] {
  return SERVICE_BUNDLES.filter((b) => b.addOn === true);
}
