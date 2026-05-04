/**
 * Idempotent system-data seeder. Run with `npm run backend:seed`. Safe to
 * re-run — uses `name + is_system=true` to detect existing rows and skips
 * them. Re-running after editing seed-data.ts will NOT update existing
 * rows; treat seed data as immutable once seeded. To change a system
 * package, write a follow-up migration.
 *
 * The seeded packages have firm_id=NULL (system-wide, visible to all firms
 * via the servicePackages.list query).
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./client.js";
import { reminderTemplates, servicePackages, serviceTemplates } from "./schema.js";
import { PACKAGES, TEMPLATES } from "./seed-data.js";
import { REMINDER_TEMPLATES } from "./seed-templates.js";
import { seedFederalForms } from "./seed-federal-forms.js";
import { seedAnnouncements } from "./seed-announcements.js";

async function seed() {
  // Index existing system packages by name for idempotency.
  const existingPackages = await db
    .select()
    .from(servicePackages)
    .where(and(eq(servicePackages.isSystem, true), isNull(servicePackages.firmId)));
  const packagesByName = new Map(existingPackages.map((p) => [p.name, p]));

  let createdPackages = 0;
  let createdTemplates = 0;

  for (const pkg of PACKAGES) {
    let pkgRow = packagesByName.get(pkg.name);
    if (!pkgRow) {
      const [inserted] = await db
        .insert(servicePackages)
        .values({
          firmId: null,
          name: pkg.name,
          description: pkg.description,
          applicableEntityTypes: pkg.applicableEntityTypes,
          applicableStates: pkg.applicableStates,
          isSystem: true,
        })
        .returning();
      if (!inserted) throw new Error(`failed to insert package ${pkg.name}`);
      pkgRow = inserted;
      createdPackages++;
    }

    // Insert templates for this package. Idempotent by (package_id, formType).
    const existingTemplates = await db
      .select()
      .from(serviceTemplates)
      .where(eq(serviceTemplates.packageId, pkgRow.id));
    const tmplByForm = new Set(existingTemplates.map((t) => t.formType));

    for (const key of pkg.templateKeys) {
      const tmpl = TEMPLATES.find((t) => t.key === key);
      if (!tmpl) throw new Error(`unknown template key "${key}" in ${pkg.name}`);
      if (tmplByForm.has(tmpl.formType)) continue;
      await db.insert(serviceTemplates).values({
        packageId: pkgRow.id,
        formType: tmpl.formType,
        jurisdiction: tmpl.jurisdiction,
        dueDateRule: tmpl.dueDateRule,
        rolloverRule: tmpl.rolloverRule,
        defaultReminderSchedule: tmpl.defaultReminderSchedule,
        dependencies: {},
        standardChecklist: tmpl.standardChecklist,
      });
      createdTemplates++;
    }
  }

  // System reminder templates — 18 from PRD §7.6. Idempotent on (templateKey, firm_id IS NULL).
  let createdReminderTemplates = 0;
  for (const rt of REMINDER_TEMPLATES) {
    const existing = await db
      .select()
      .from(reminderTemplates)
      .where(
        and(
          eq(reminderTemplates.templateKey, rt.templateKey),
          isNull(reminderTemplates.firmId),
          eq(reminderTemplates.isSystem, true),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(reminderTemplates).values({
      firmId: null,
      packageId: null,
      templateKey: rt.templateKey,
      name: rt.name,
      subject: rt.subject,
      bodyMdx: rt.bodyMdx,
      itemType: rt.itemType,
      trigger: rt.trigger,
      cadence: rt.cadence,
      deadlineClass: rt.deadlineClass,
      phase: rt.phase,
      isSystem: true,
      active: true,
    });
    createdReminderTemplates++;
  }

  // Federal forms catalog — see seed-federal-forms.ts. Bundled here so a
  // fresh deploy gets one seeder call to populate every system catalog
  // (packages + reminder templates + federal forms).
  const federalFormsResult = await seedFederalForms();

  // Demo state announcements — keeps `/alerts` populated until the
  // Cloudflare Workers scraper is deployed. Idempotent on sourceUrl.
  const announcementsResult = await seedAnnouncements();

  // eslint-disable-next-line no-console
  console.log(
    `[ddhq-backend] seed complete — packages: +${createdPackages}, service templates: +${createdTemplates}, reminder templates: +${createdReminderTemplates}, federal forms: +${federalFormsResult.inserted} inserted, ${federalFormsResult.updated} updated, ${federalFormsResult.unchanged} unchanged, announcements: +${announcementsResult.inserted} (skipped ${announcementsResult.skipped})`,
  );
}

await seed();
process.exit(0);
