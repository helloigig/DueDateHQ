/**
 * Idempotent federal-forms seeder. Runs alongside `seed.ts` (the system
 * service-packages seeder) and writes the curated catalog from
 * `federal-forms-data.ts` into the `federal_forms` table.
 *
 * Idempotency key: form_number (UNIQUE in DB). Re-running upserts the
 * latest curated values for an existing row — unlike the service-template
 * seeder, we DO update. Reasoning: federal_forms.notes / irsUrl /
 * dueDateRule are reference data the catalog owns; if the curator edits
 * them they should propagate. The LLM- and Federal-Register-sourced rows
 * are unaffected because their form_numbers don't appear in the curated
 * list.
 *
 * What this never touches:
 *   - confidence_score (1.0 for curated rows)
 *   - extraction_method (always 'curated')
 *   - LLM-extracted long-tail rows (different form_numbers)
 *   - federal_form_change_events (audit log; only the poller writes there)
 */
import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { federalForms } from "./schema.js";
import { FEDERAL_FORMS } from "./federal-forms-data.js";

export interface SeedFederalFormsResult {
  inserted: number;
  updated: number;
  unchanged: number;
}

export async function seedFederalForms(): Promise<SeedFederalFormsResult> {
  const result: SeedFederalFormsResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };
  const now = new Date();

  for (const form of FEDERAL_FORMS) {
    const existing = await db.query.federalForms.findFirst({
      where: eq(federalForms.formNumber, form.formNumber),
    });

    if (!existing) {
      await db.insert(federalForms).values({
        formNumber: form.formNumber,
        formName: form.formName,
        category: form.category,
        entityTypes: form.entityTypes,
        frequency: form.frequency,
        // Cast: drizzle's jsonb column accepts unknown; the rule is
        // already-shaped per `due-date-rules.ts:DueDateRule`.
        dueDateRule: form.dueDateRule ?? null,
        notes: form.notes ?? null,
        irsUrl: form.irsUrl,
        extractionMethod: "curated",
        confidenceScore: "1.0",
        status: "active",
        lastVerifiedAt: now,
      });
      result.inserted++;
      continue;
    }

    // Compare — skip the update when the curated values match what's in
    // the row, so re-runs don't churn updated_at unnecessarily.
    const curatedStringified = JSON.stringify({
      formName: form.formName,
      category: form.category,
      entityTypes: [...form.entityTypes].sort(),
      frequency: form.frequency,
      dueDateRule: form.dueDateRule ?? null,
      notes: form.notes ?? null,
      irsUrl: form.irsUrl,
    });
    const existingStringified = JSON.stringify({
      formName: existing.formName,
      category: existing.category,
      entityTypes: [...existing.entityTypes].sort(),
      frequency: existing.frequency,
      dueDateRule: existing.dueDateRule ?? null,
      notes: existing.notes ?? null,
      irsUrl: existing.irsUrl,
    });

    if (curatedStringified === existingStringified) {
      result.unchanged++;
      continue;
    }

    // Refuse to overwrite an LLM- or Federal-Register-sourced row from a
    // curated edit. If the curator added the same form number that an
    // upstream extraction wrote earlier, log + skip — the curator should
    // delete the LLM row first (or the catalog should use a different
    // form_number).
    if (existing.extractionMethod !== "curated") {
      console.warn(
        `[seed-federal-forms] skipped ${form.formNumber} — existing row was ${existing.extractionMethod}; refusing to overwrite`,
      );
      result.unchanged++;
      continue;
    }

    await db
      .update(federalForms)
      .set({
        formName: form.formName,
        category: form.category,
        entityTypes: form.entityTypes,
        frequency: form.frequency,
        dueDateRule: form.dueDateRule ?? null,
        notes: form.notes ?? null,
        irsUrl: form.irsUrl,
        lastVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(federalForms.id, existing.id));
    result.updated++;
  }

  return result;
}

// CLI entry — executed by `npm run backend:seed:federal-forms`.
// Top-level await is fine: package is "type": "module" + tsx runs ESM.
if (
  import.meta.url ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (await import("node:url")).pathToFileURL(process.argv[1] ?? "").href
) {
  const out = await seedFederalForms();
  console.log(
    `[ddhq-backend] federal forms seed — inserted: ${out.inserted}, updated: ${out.updated}, unchanged: ${out.unchanged}`,
  );
  process.exit(0);
}
