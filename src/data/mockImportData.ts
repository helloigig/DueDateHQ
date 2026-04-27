import type { EntityType, StateCode } from "../types";

export interface DetectedRow {
  sourceName: string;
  sourceEntity: string;
  sourceState: string;
  sourceEmail: string;
  sourcePhone?: string;
  sourceService: string;
  // resolved / normalized fields after mapping
  name: string;
  entityType: EntityType | null;
  primaryState: StateCode | null;
  email: string;
  phone?: string;
  bundle: string | null;
  issues: string[]; // ["state_unknown", "entity_ambiguous", "email_missing"]
}

export const DETECTED_SOURCE = "File In Time export";
export const DETECTED_CONFIDENCE: "high" | "medium" | "low" = "high";

export type TargetField =
  | "client_name"
  | "entity_type"
  | "primary_state"
  | "contact_email"
  | "contact_phone"
  | "bundle"
  | "__ignored__"
  | string;

export interface FieldMapping {
  sourceColumn: string;
  targetField: TargetField;
  confidence: "high" | "low" | "ignore";
}

export const FIELD_MAPPING: FieldMapping[] = [
  { sourceColumn: "Client Name", targetField: "Name", confidence: "high" },
  { sourceColumn: "Entity", targetField: "Entity type", confidence: "high" },
  { sourceColumn: "Primary State", targetField: "Primary state", confidence: "high" },
  { sourceColumn: "Email", targetField: "Contact email", confidence: "high" },
  { sourceColumn: "Phone", targetField: "Contact phone", confidence: "high" },
  { sourceColumn: "Service Type", targetField: "Filing bundle", confidence: "low" },
  { sourceColumn: "Notes", targetField: "Notes", confidence: "high" },
  { sourceColumn: "Client ID (legacy)", targetField: "[Ignore]", confidence: "ignore" },
];

// 12 synthetic detected rows: 9 clean, 3 with issues
export const DETECTED_ROWS: DetectedRow[] = [
  {
    sourceName: "Thorne Industries LLC",
    sourceEntity: "LLC",
    sourceState: "CA",
    sourceEmail: "ap@thorne-industries.com",
    sourcePhone: "(415) 555-0112",
    sourceService: "Multi-state LLC",
    name: "Thorne Industries LLC",
    entityType: "LLC",
    primaryState: "CA",
    email: "ap@thorne-industries.com",
    phone: "(415) 555-0112",
    bundle: "Multi-state LLC",
    issues: [],
  },
  {
    sourceName: "Vega & Sons Partnership",
    sourceEntity: "Partnership",
    sourceState: "NY",
    sourceEmail: "accounting@vegaandsons.com",
    sourceService: "Partnership Standard",
    name: "Vega & Sons Partnership",
    entityType: "Partnership",
    primaryState: "NY",
    email: "accounting@vegaandsons.com",
    bundle: "Partnership Standard (NY)",
    issues: [],
  },
  {
    sourceName: "Emily Hartfield",
    sourceEntity: "Individual",
    sourceState: "TX",
    sourceEmail: "emily.hartfield@fastmail.com",
    sourceService: "1040",
    name: "Emily Hartfield",
    entityType: "Individual",
    primaryState: "TX",
    email: "emily.hartfield@fastmail.com",
    bundle: "Individual + PTE",
    issues: [],
  },
  {
    sourceName: "Big Easy Fabricators",
    sourceEntity: "S-Corp",
    sourceState: "LA",
    sourceEmail: "finance@bigeasyfab.com",
    sourcePhone: "(504) 555-0161",
    sourceService: "S-Corp Standard",
    name: "Big Easy Fabricators",
    entityType: "S-Corp",
    primaryState: "LA",
    email: "finance@bigeasyfab.com",
    phone: "(504) 555-0161",
    bundle: "S-Corp Standard (LA)",
    issues: [],
  },
  {
    sourceName: "Coral Reef Designs",
    sourceEntity: "LLC",
    sourceState: "FL",
    sourceEmail: "hello@coralreefdesigns.com",
    sourceService: "LLC Standard",
    name: "Coral Reef Designs",
    entityType: "LLC",
    primaryState: "FL",
    email: "hello@coralreefdesigns.com",
    bundle: "Multi-state LLC",
    issues: [],
  },
  {
    sourceName: "Westwood Tax Services",
    sourceEntity: "S-Corp",
    sourceState: "CA",
    sourceEmail: "billing@westwoodtax.com",
    sourceService: "S-Corp Standard",
    name: "Westwood Tax Services",
    entityType: "S-Corp",
    primaryState: "CA",
    email: "billing@westwoodtax.com",
    bundle: "S-Corp Standard (CA)",
    issues: [],
  },
  {
    sourceName: "Ana Gutierrez",
    sourceEntity: "Individual",
    sourceState: "FL",
    sourceEmail: "ana.g@protonmail.com",
    sourceService: "1040",
    name: "Ana Gutierrez",
    entityType: "Individual",
    primaryState: "FL",
    email: "ana.g@protonmail.com",
    bundle: "Individual + PTE",
    issues: [],
  },
  {
    sourceName: "Meadowlark Family Trust",
    sourceEntity: "Trust",
    sourceState: "TX",
    sourceEmail: "trust@meadowlark.law",
    sourceService: "1041",
    name: "Meadowlark Family Trust",
    entityType: "Trust",
    primaryState: "TX",
    email: "trust@meadowlark.law",
    bundle: "Trust Annual",
    issues: [],
  },
  {
    sourceName: "Hudson Data C-Corp",
    sourceEntity: "C-Corp",
    sourceState: "NY",
    sourceEmail: "cfo@hudsondata.io",
    sourceService: "C-Corp Standard",
    name: "Hudson Data C-Corp",
    entityType: "C-Corp",
    primaryState: "NY",
    email: "cfo@hudsondata.io",
    bundle: "C-Corp Standard (NY)",
    issues: [],
  },
  // --- problem rows ---
  {
    sourceName: "??? Holdings",
    sourceEntity: "",
    sourceState: "TX",
    sourceEmail: "",
    sourceService: "",
    name: "??? Holdings",
    entityType: null,
    primaryState: "TX",
    email: "",
    bundle: null,
    issues: ["entity_missing", "email_missing"],
  },
  {
    sourceName: "Smith Trust",
    sourceEntity: "Trust",
    sourceState: "??",
    sourceEmail: "s@smithtrust.org",
    sourceService: "",
    name: "Smith Trust",
    entityType: "Trust",
    primaryState: null,
    email: "s@smithtrust.org",
    bundle: null,
    issues: ["state_unknown"],
  },
  {
    sourceName: "Nielsen Brothers",
    sourceEntity: "Partnrshp", // typo
    sourceState: "CA",
    sourceEmail: "ap@nielsenbros.co",
    sourceService: "",
    name: "Nielsen Brothers",
    entityType: null,
    primaryState: "CA",
    email: "ap@nielsenbros.co",
    bundle: null,
    issues: ["entity_ambiguous"],
  },
];
