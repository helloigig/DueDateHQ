import type {
  AIConfidence,
  AnnouncementType,
  SourceAuthority,
  TaxType,
} from "../types";

export const TOPIC_LABEL: Record<AnnouncementType, string> = {
  disaster_extension: "Disaster ext.",
  penalty_relief: "Penalty relief",
  pte_change: "PTE change",
  form_change: "Form change",
  rate_change: "Rate change",
  nexus_change: "Nexus change",
};

export const TAX_TYPE_LABEL: Record<TaxType, string> = {
  income: "Income",
  sales_use: "Sales/Use",
  franchise: "Franchise",
  payroll: "Payroll",
  property: "Property",
  excise: "Excise",
  multiple: "Multiple",
};

export const SOURCE_AUTHORITY_LABEL: Record<SourceAuthority, string> = {
  primary: "DOR primary",
  editorial: "Editorial",
  briefing: "Firm briefing",
};

export const SOURCE_AUTHORITY_TOOLTIP: Record<SourceAuthority, string> = {
  primary:
    "Direct from the issuing authority (state DOR, IRS, governor) — act on it.",
  editorial:
    "Editorial coverage (Bloomberg Tax / CCH / RIA) — generally citable, verify against the primary source for material decisions.",
  briefing:
    "Firm briefing (Deloitte / EY / GT alerts) — informational, not authority. Confirm against the primary source before acting.",
};

export const CONFIDENCE_LABEL: Record<AIConfidence, string> = {
  high: "high",
  medium: "med",
  low: "low",
};
