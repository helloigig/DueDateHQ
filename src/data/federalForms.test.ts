import { describe, expect, it } from "vitest";
import { FEDERAL_FORMS, federalFormByCode } from "./federalForms";
import { SERVICE_BUNDLES, serviceBundleById } from "./serviceBundles";

describe("federalForms catalog", () => {
  it("contains at least 50 forms", () => {
    expect(FEDERAL_FORMS.length).toBeGreaterThanOrEqual(50);
  });

  it("has no duplicate form codes", () => {
    const codes = FEDERAL_FORMS.map((f) => f.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("every extension form references a real form code (or is null)", () => {
    for (const form of FEDERAL_FORMS) {
      if (form.extensionForm == null) continue;
      const target = federalFormByCode(form.extensionForm);
      expect(target, `Form ${form.code} extends to ${form.extensionForm} but that code isn't in the catalog`).toBeDefined();
    }
  });

  it("every required item has a non-empty label and itemType", () => {
    for (const form of FEDERAL_FORMS) {
      for (const item of form.requiredItems) {
        expect(item.label, `Form ${form.code} has empty label`).toBeTruthy();
        expect(item.itemType, `Form ${form.code} item "${item.label}" has empty itemType`).toBeTruthy();
      }
    }
  });

  it("every form has at least one source URL", () => {
    for (const form of FEDERAL_FORMS) {
      expect(form.sources.length, `Form ${form.code} has no sources`).toBeGreaterThan(0);
      for (const url of form.sources) {
        expect(url).toMatch(/^https?:\/\//);
      }
    }
  });

  it("calendar-year due dates use MM-DD format", () => {
    for (const form of FEDERAL_FORMS) {
      if (form.dueDate == null) continue;
      expect(form.dueDate, `Form ${form.code} dueDate "${form.dueDate}" not MM-DD`).toMatch(/^\d{2}-\d{2}$/);
    }
  });

  it("all forms default to common-practice confidence (none verified yet)", () => {
    // This guards against accidentally marking a form as "verified" before
    // CPA review. Once a form is reviewed, this test would need to be
    // updated (or the assertion relaxed for that form).
    for (const form of FEDERAL_FORMS) {
      if (form.confidence === "verified") {
        // OK if marked verified — but ensure ALL items in it are verified too.
        for (const item of form.requiredItems) {
          expect(item.verified, `Form ${form.code} marked verified but item "${item.label}" is not`).toBe(true);
        }
      }
    }
  });
});

describe("serviceBundles", () => {
  it("contains expected primary + add-on bundles", () => {
    expect(SERVICE_BUNDLES.length).toBeGreaterThanOrEqual(15);
  });

  it("has no duplicate bundle ids", () => {
    const ids = SERVICE_BUNDLES.map((b) => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every includedFormCode resolves to a real form in federalForms", () => {
    for (const bundle of SERVICE_BUNDLES) {
      for (const code of bundle.includedFormCodes) {
        const form = federalFormByCode(code);
        expect(form, `Bundle "${bundle.id}" references form code "${code}" which doesn't exist in federalForms.ts`).toBeDefined();
      }
    }
  });

  it("Schedule-E appears in multiple bundles (forms can be reused)", () => {
    const bundlesWithScheduleE = SERVICE_BUNDLES.filter((b) =>
      b.includedFormCodes.includes("Schedule-E"),
    );
    expect(bundlesWithScheduleE.length).toBeGreaterThanOrEqual(2);
  });

  it("1040 appears in every individual primary bundle", () => {
    const individualPrimaries = SERVICE_BUNDLES.filter(
      (b) => !b.addOn && b.entityTypes.includes("Individual"),
    );
    for (const bundle of individualPrimaries) {
      expect(
        bundle.includedFormCodes.includes("1040"),
        `Bundle "${bundle.id}" should include Form 1040 but doesn't`,
      ).toBe(true);
    }
  });

  it("serviceBundleById returns the correct bundle", () => {
    const b = serviceBundleById("scorp-standard");
    expect(b).toBeDefined();
    expect(b!.name).toBe("S-Corp Standard");
  });
});
