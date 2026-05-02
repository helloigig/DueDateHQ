# Phase 3 — BE worker for federal forms catalog

> **Self-contained spec for the parallel session.** Drop this file into a fresh Claude Code session and it should be able to ship the whole thing.

## Goal

Build a backend worker that:

1. **Persists the federal forms catalog** to Postgres from the hand-curated JSON in `src/data/federalForms.ts` (already shipped — see PR #54).
2. **Polls the Federal Register API** to detect IRS notices that mention forms in our catalog. When something changes, mark that form for re-extraction.
3. **Adds an LLM extraction path for the long tail** — for forms NOT in the hand-curated top-50, extract due-date + checklist from the IRS instruction PDF using Claude.
4. **Exposes a tRPC router** so the FE can read the catalog (`federalForms.list`, `federalForms.get`).

The FE consumer wiring (AddDeadlineModal autocomplete, FilingsTab source URLs) is **already shipped in this same PR** — it currently reads from the in-memory `FEDERAL_FORMS` array. After your worker lands, the FE should switch to read from the BE table via tRPC for the long tail; the in-memory hand-curated 50 stays as a fallback / circuit-breaker.

---

## Architectural shape

```
┌──────────────────────────────────────────────────────────────────────┐
│ POSTGRES `federal_forms` TABLE — source of truth at runtime           │
│   tRPC `federalForms.list` / `.get` reads here                        │
│   Seeded initially from src/data/federalForms.ts (51 hand-curated)    │
│   Long-tail rows added by the worker over time                        │
└──────────────────────────────────────────────────────────────────────┘
                              ↑
                  upsert from worker on schedule
                              ↑
┌──────────────────────────────────────────────────────────────────────┐
│ DAILY BE WORKER (Fly Machines scheduled task)                         │
│                                                                        │
│ STAGE A — Catalog seed (idempotent on every run)                      │
│   For each row in src/data/federalForms.ts (the hand-curated 51):     │
│     UPSERT into federal_forms by (form_code, tax_year)                │
│   Source: "hand-curated"                                               │
│   Confidence: row's confidence field                                   │
│                                                                        │
│ STAGE B — Federal Register change detection                           │
│   GET federalregister.gov/api/v1/documents.json                       │
│       ?conditions[agencies][]=internal-revenue-service                │
│       &conditions[publication_date][gte]={lastRunDate}                │
│       &conditions[term]=form                                          │
│   Cursor in federal_register_cursor table; advance after success.     │
│   For each notice, regex the title + abstract for "Form NNN" or       │
│   "Form NNN-X" patterns. For each form code that:                     │
│     - matches an existing federal_forms row → mark needs_extraction   │
│     - does NOT exist → insert as a stub row with                      │
│       confidence='discovered', needs_extraction=true                  │
│                                                                        │
│ STAGE C — LLM extraction (only on flagged rows)                       │
│   Query: SELECT * FROM federal_forms WHERE needs_extraction = true    │
│   For each row:                                                        │
│     1. Resolve PDF URL (try irs.gov/pub/irs-pdf/f{code}.pdf for form  │
│        and i{code}.pdf for instructions; HEAD-check first)            │
│     2. Download instruction PDF (with ETag cache)                     │
│     3. Run Claude Sonnet with structured output:                      │
│          {                                                             │
│            dueDate: "MM-DD or null",                                  │
│            dueDateBasis: "<one of the enum values>",                  │
│            extensionForm: "form code or null",                        │
│            requiredItems: [{label, itemType}, ...],                   │
│            officialName: "official IRS form title"                    │
│          }                                                             │
│     4. Cross-validate dueDate against IRS Pub 509 (Tax Calendar PDF,  │
│        downloaded annually + parsed once)                             │
│     5. If validation passes → confidence='ai-suggested',              │
│        needs_review=true, persist                                     │
│     6. If validation fails → confidence='low', needs_review=true,     │
│        persist with conflict notes                                    │
│   Set needs_extraction=false on all processed rows                    │
│                                                                        │
│ STAGE D — Audit + alerts                                              │
│   federal_forms_audit row per change                                  │
│   If > 5% rows changed in one run → email/Sentry alert                │
│   If LLM cost > $10/run → email/Sentry alert                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Verified facts (don't re-verify; just use)

The previous session probed these endpoints — these are confirmed working as of 2026-05-02:

| Endpoint | Verified | Notes |
|---|---|---|
| `https://www.federalregister.gov/api/v1/documents.json` | ✅ Returns JSON | No auth. Filterable by agency, term, date range. ~10,000 IRS docs indexed. |
| `https://apps.irs.gov/app/picklist/list/formsPublications.html` | ⚠️ Partially | Returns 200 + ETag, BUT pagination via `indexOfFirstRow` does not work as documented. Returns first 25 only. **Use this only for ETag-based change detection on the canonical form list, not for full enumeration.** |
| `https://www.irs.gov/pub/irs-pdf/f{code}.pdf` | ✅ All ~35 probed | Standard URL pattern for form PDFs. |
| `https://www.irs.gov/pub/irs-pdf/i{code}.pdf` | ✅ Most probed | Instructions. Some forms bundle (W-2/W-3 instructions are at `iw2w3.pdf`). |
| `https://www.irs.gov/pub/irs-pdf/p509.pdf` | ✅ | IRS Pub 509 (Tax Calendar) — annual PDF for cross-validation. |

## Verified gaps (don't try these paths)

| Path | Why not |
|---|---|
| IRS MeF XSDs | Requires e-file Provider registration (6-8 week IRS application). May be worth pursuing in a separate engineering track but NOT blocking this worker. |
| `irs.gov/newsroom/rss` | Returns 404. Use Federal Register API instead. |
| `data.gov` IRS form catalog | Not indexed there. |
| Picklist pagination via HTTP | Doesn't work — endpoint caps at 25 rows. Skip for now. |

---

## Deliverables

### 1. Drizzle migration

```sql
-- backend/src/db/migrations/00XX_federal_forms.sql
CREATE TABLE federal_forms (
  form_code            text NOT NULL,
  tax_year             integer NOT NULL,
  name                 text NOT NULL,
  description          text,
  kind                 text NOT NULL,
  due_date             text,
  due_date_basis       text NOT NULL,
  extension_form       text,
  applicable_entities  jsonb NOT NULL DEFAULT '[]',
  required_items       jsonb NOT NULL DEFAULT '[]',
  source_urls          jsonb NOT NULL DEFAULT '[]',
  confidence           text NOT NULL DEFAULT 'common-practice',
  source               text NOT NULL DEFAULT 'hand-curated',
  needs_review         boolean NOT NULL DEFAULT false,
  needs_extraction     boolean NOT NULL DEFAULT false,
  last_extracted_at    timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (form_code, tax_year)
);

CREATE INDEX idx_federal_forms_needs_extraction
  ON federal_forms(needs_extraction)
  WHERE needs_extraction = true;
CREATE INDEX idx_federal_forms_needs_review
  ON federal_forms(needs_review)
  WHERE needs_review = true;

CREATE TABLE federal_forms_audit (
  id            bigserial PRIMARY KEY,
  form_code     text NOT NULL,
  tax_year      integer NOT NULL,
  changed_field text NOT NULL,
  old_value     jsonb,
  new_value     jsonb,
  source        text NOT NULL,           -- 'hand-curated', 'federal_register', 'ai-extraction'
  source_url    text,
  changed_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE federal_register_cursor (
  id                  integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_polled_at      timestamptz NOT NULL,
  last_publication_date date NOT NULL
);
```

### 2. Drizzle schema

Add to `backend/src/db/schema.ts`:

```ts
export const federalForms = pgTable("federal_forms", {
  formCode: text("form_code").notNull(),
  taxYear: integer("tax_year").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  kind: text("kind").notNull(),
  dueDate: text("due_date"),
  dueDateBasis: text("due_date_basis").notNull(),
  extensionForm: text("extension_form"),
  applicableEntities: jsonb("applicable_entities").$type<string[]>().notNull().default([]),
  requiredItems: jsonb("required_items").$type<Array<{label: string; itemType: string; source?: string; verified?: boolean}>>().notNull().default([]),
  sourceUrls: jsonb("source_urls").$type<string[]>().notNull().default([]),
  confidence: text("confidence").notNull().default("common-practice"),
  source: text("source").notNull().default("hand-curated"),
  needsReview: boolean("needs_review").notNull().default(false),
  needsExtraction: boolean("needs_extraction").notNull().default(false),
  lastExtractedAt: timestamp("last_extracted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.formCode, t.taxYear] }) }));

export const federalFormsAudit = pgTable("federal_forms_audit", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  formCode: text("form_code").notNull(),
  taxYear: integer("tax_year").notNull(),
  changedField: text("changed_field").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const federalRegisterCursor = pgTable("federal_register_cursor", {
  id: integer("id").primaryKey().default(1),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }).notNull(),
  lastPublicationDate: date("last_publication_date").notNull(),
});
```

### 3. Worker module structure

```
backend/src/workers/refreshFederalForms/
  index.ts                  # Entry point, runs all stages in sequence
  seedFromHandCurated.ts    # Stage A — UPSERT from src/data/federalForms.ts
  pollFederalRegister.ts    # Stage B — Federal Register API polling
  extractFromPdf.ts         # Stage C — Claude PDF extraction
  validateAgainstPub509.ts  # Cross-validation logic
  upsertCatalog.ts          # Shared UPSERT + audit logging
  alerts.ts                 # Email / Sentry on failures
```

### 4. Stage A — Seed from hand-curated JSON

```ts
// backend/src/workers/refreshFederalForms/seedFromHandCurated.ts
import { FEDERAL_FORMS } from "../../../../src/data/federalForms";  // adjust path
import { upsertForm } from "./upsertCatalog";

export async function seedFromHandCurated(taxYear: number) {
  let upserted = 0;
  for (const form of FEDERAL_FORMS) {
    await upsertForm({
      formCode: form.code,
      taxYear,
      name: form.name,
      description: form.description,
      kind: form.kind,
      dueDate: form.dueDate,
      dueDateBasis: form.dueDateBasis,
      extensionForm: form.extensionForm,
      applicableEntities: form.applicableEntities,
      requiredItems: form.requiredItems,
      sourceUrls: form.sources,
      confidence: form.confidence,
      source: "hand-curated",
      needsReview: false,
      needsExtraction: false,
    });
    upserted += 1;
  }
  console.info(`[seedFromHandCurated] upserted ${upserted} forms for TY${taxYear}`);
}
```

**Important:** Set up the import path correctly. The FE catalog file is at `src/data/federalForms.ts` (frontend root), not `backend/src`. Two options:
- (a) Add a TypeScript path alias so backend can import the FE catalog file
- (b) Build the catalog into a JSON output (`tsx src/data/federalForms.ts > backend/src/data/federalForms.json`) at backend build time
- (c) Duplicate the data — DON'T do this; gets out of sync

Recommended: option (b) — a `prebuild` step that emits the JSON. Keeps single source of truth (the TS file).

### 5. Stage B — Federal Register polling

```ts
// backend/src/workers/refreshFederalForms/pollFederalRegister.ts
const FR_BASE = "https://www.federalregister.gov/api/v1/documents.json";

export async function pollFederalRegister(): Promise<{
  notices: number;
  formsFlagged: string[];
}> {
  const cursor = await getCursor();
  const sinceDate = cursor.lastPublicationDate;

  const url = new URL(FR_BASE);
  url.searchParams.set("conditions[agencies][]", "internal-revenue-service");
  url.searchParams.set("conditions[publication_date][gte]", sinceDate);
  url.searchParams.set("conditions[term]", "form");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("fields[]", "title");
  url.searchParams.set("fields[]", "abstract");
  url.searchParams.set("fields[]", "publication_date");
  url.searchParams.set("fields[]", "document_number");
  url.searchParams.set("fields[]", "html_url");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "DueDateHQ-catalog/1.0 (contact@duedatehq.space)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Federal Register API ${res.status}`);
  const data = await res.json();

  const formsFlagged = new Set<string>();
  const formCodeRegex = /\bForm\s+(\d{3,4}(?:-[A-Z]+)?(?:\s*\([A-Z]+\))?)\b/gi;

  for (const notice of data.results) {
    const text = `${notice.title} ${notice.abstract ?? ""}`;
    let match;
    while ((match = formCodeRegex.exec(text)) !== null) {
      const code = match[1].toUpperCase().replace(/\s+/g, "");
      formsFlagged.add(code);
      // Mark for extraction; create stub if not yet in catalog
      await markForExtraction(code, {
        source: "federal_register",
        sourceUrl: notice.html_url,
      });
    }
  }

  // Advance cursor
  if (data.results.length > 0) {
    const latest = data.results
      .map((r: any) => r.publication_date)
      .sort()
      .reverse()[0];
    await advanceCursor(latest);
  }

  return { notices: data.results.length, formsFlagged: [...formsFlagged] };
}
```

**Pagination:** Federal Register paginates results. Loop while `next_page_url` exists, capping at ~10 pages per run to avoid runaway. Real catalog deltas are small per month.

### 6. Stage C — LLM extraction with cross-validation

```ts
// backend/src/workers/refreshFederalForms/extractFromPdf.ts
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const ExtractionSchema = z.object({
  dueDate: z.string().regex(/^\d{2}-\d{2}$/).nullable(),
  dueDateBasis: z.enum([
    "calendar-year-Apr15", "calendar-year-Mar15", "calendar-year-May15",
    "fiscal-year-15-of-3rd-month", "fiscal-year-15-of-4th-month",
    "fiscal-year-15-of-5th-month", "quarterly-estimate",
    "quarterly-employment-Jan31-Apr30-Jul31-Oct31", "annual-Jan31",
    "annual-Feb28-paper-Mar31-efile", "annual-Apr15", "annual-Jul31",
    "annual-Oct15", "event-driven", "received-not-filed",
  ]),
  extensionForm: z.string().nullable(),
  requiredItems: z.array(z.object({
    label: z.string().min(1),
    itemType: z.string().min(1),
  })),
  officialName: z.string().min(1),
});

const anthropic = new Anthropic();

export async function extractFromInstructionPdf(
  formCode: string,
  pdfUrl: string,
): Promise<z.infer<typeof ExtractionSchema>> {
  const pdfBuffer = await fetch(pdfUrl).then((r) => r.arrayBuffer());
  const base64Pdf = Buffer.from(pdfBuffer).toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Pdf } },
        { type: "text", text: `From this IRS Form ${formCode} instructions PDF, extract structured metadata.

Output JSON matching this schema:
{
  "dueDate": "MM-DD" (calendar-year filers only) or null,
  "dueDateBasis": one of [calendar-year-Apr15 | calendar-year-Mar15 | ... see enum],
  "extensionForm": form code that extends this form, or null,
  "requiredItems": [
    { "label": "Plain-English description of what the client must provide",
      "itemType": "stable_snake_case_id" }
  ],
  "officialName": "official IRS form title from page 1"
}

Cite page numbers in your reasoning if uncertain. Return strict JSON only.`,
        },
      ],
    }],
  });

  // Parse + validate
  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const json = JSON.parse(text.replace(/```json\n?|```/g, "").trim());
  return ExtractionSchema.parse(json);
}
```

### 7. tRPC router

```ts
// backend/src/trpc/routers/federalForms.ts
import { z } from "zod";
import { router, publicProcedure } from "../init";
import { db } from "../../db/client";
import { federalForms } from "../../db/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";

export const federalFormsRouter = router({
  list: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      taxYear: z.number().optional(),
      limit: z.number().max(200).default(50),
    }).optional())
    .query(async ({ input }) => {
      const taxYear = input?.taxYear ?? currentTaxYear();
      const search = input?.search?.trim();
      const where = search
        ? and(
            eq(federalForms.taxYear, taxYear),
            or(
              ilike(federalForms.formCode, `%${search}%`),
              ilike(federalForms.name, `%${search}%`),
            ),
          )
        : eq(federalForms.taxYear, taxYear);
      return db.select().from(federalForms).where(where).limit(input?.limit ?? 50);
    }),

  get: publicProcedure
    .input(z.object({ formCode: z.string(), taxYear: z.number().optional() }))
    .query(async ({ input }) => {
      const taxYear = input.taxYear ?? currentTaxYear();
      const [row] = await db.select().from(federalForms)
        .where(and(eq(federalForms.formCode, input.formCode), eq(federalForms.taxYear, taxYear)));
      return row ?? null;
    }),

  recentChanges: publicProcedure
    .input(z.object({ since: z.string().datetime().optional() }).optional())
    .query(async ({ input }) => {
      // Read federal_forms_audit
    }),
});

function currentTaxYear(): number {
  return new Date().getMonth() < 3 ? new Date().getFullYear() - 1 : new Date().getFullYear();
}
```

Mount in `backend/src/trpc/router.ts`.

### 8. Fly Machines scheduled task

Confirm against current Fly docs (this syntax may have evolved). Two viable patterns:

**Option A — Scheduled Machine** (preferred if Fly supports it cleanly):
```toml
# backend/fly.toml — add a separate process
[processes]
  app = "node dist/index.js"
  refresh_forms = "node dist/workers/refreshFederalForms/index.js"

# Schedule the refresh_forms machine to run daily
# (verify exact syntax against fly.io docs)
```

**Option B — node-cron inside main app** (simpler, less isolated):
```ts
// backend/src/index.ts
import cron from "node-cron";
import { runRefresh } from "./workers/refreshFederalForms";

cron.schedule("0 3 * * *", async () => {
  try { await runRefresh(); } catch (e) { reportError(e); }
});
```

Recommend Option B for v1 — simpler, no Fly-specific scheduler config. Move to A later if isolation matters.

### 9. Validation + alerts

Use existing Sentry config (per saved memory: "OpenTelemetry+Sentry"). Wire alerts on:

| Condition | Action |
|---|---|
| Worker run fails entirely | Sentry captureException + email |
| Stage B returns 0 results since last poll for > 14 days | Sentry warning |
| > 5% of catalog rows changed in one run | Sentry warning + email |
| LLM extraction cost > $10 in one run | Sentry warning |
| `needs_review` count > 50 | Daily digest email |
| Catalog hasn't been updated in 60 days | Sentry critical (separate health check) |

### 10. Required env vars / secrets

Set on Fly:

| Secret | Source | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Stage C |
| `FEDERAL_REGISTER_USER_AGENT` | "DueDateHQ-catalog/1.0 (contact@duedatehq.space)" | Stage B |
| `ALERT_EMAIL` | Your alert destination | Stage D |
| Existing Sentry config | Already configured | All stages |

---

## FE consumer wiring (already shipped — for context only)

This PR (`claude/phase-6-wire-catalog`) ships:

1. `src/data/canonicalForm.ts` — bridges legacy free-text form strings ("1040 (federal)") to catalog codes ("1040")
2. `PackageDetailsPopover` — bundle composition popover (PR #53) gets per-row "↗ IRS" links to the official PDF
3. `mockChecklistItems.ts` `templateFor()` — prefers `federalForms.requiredItems` for known forms; falls back to legacy 5-template hardcode
4. `AddDeadlineModal` — dropdown extended with "All federal forms" optgroup containing every catalog entry

After your worker is live, the FE consumers should be migrated from `import FEDERAL_FORMS from "../data/federalForms"` to `trpc.federalForms.list.useQuery()`. Migration plan:

- Keep `src/data/federalForms.ts` as a circuit-breaker fallback (if the BE query returns empty, fall back to the in-memory 51).
- Add a `useFederalForms()` hook that hits tRPC, falls back to in-memory if loading or empty.
- Update each consumer to use the hook.

---

## Implementation checklist for the new session

- [ ] Drizzle migration (federal_forms, federal_forms_audit, federal_register_cursor)
- [ ] Drizzle schema additions
- [ ] Worker directory structure under `backend/src/workers/refreshFederalForms/`
- [ ] Stage A — seedFromHandCurated (resolve TS path issue: build catalog to JSON in prebuild)
- [ ] Stage B — pollFederalRegister with cursor + form-code regex
- [ ] Stage C — extractFromPdf with Anthropic SDK + zod validation
- [ ] Stage D — alerts wiring through Sentry
- [ ] tRPC router with list/get/recentChanges
- [ ] Mount router in `backend/src/trpc/router.ts`
- [ ] node-cron schedule (or Fly Machines) wired to entry point
- [ ] Manual run end-to-end on staging — verify 51 hand-curated rows in DB
- [ ] Trigger Stage B manually — verify cursor advances + form detection works
- [ ] Trigger Stage C on one flagged row — verify LLM extraction succeeds + persists
- [ ] Verify tRPC `federalForms.list` returns rows in production

## Acceptance criteria

- [ ] After first deploy, `federal_forms` table contains all 51 hand-curated rows for current tax year
- [ ] Federal Register cursor advances correctly across runs
- [ ] LLM extraction only fires on flagged rows (not every form, every run)
- [ ] `federal_forms_audit` records one row per change
- [ ] tRPC `federalForms.list` returns rows in production
- [ ] Cost per run ≤ $1 in steady state (only delta extractions)
- [ ] No unhandled exceptions for 7 consecutive days

## Out of scope (defer)

- State catalogs (Phase 5)
- AI applicability layer (Phase 4)
- IRS MeF XSD integration (separate engineering track if e-file Provider registration ever happens)
- Sales tax (forever)

## Maintenance reality

| Trigger | Frequency | Effort |
|---|---|---|
| New IRS notice mentioning a form | Continuous (auto) | 0 |
| LLM extraction fails on a niche form | Random | ~30 min to manually fix the row |
| Pub 509 annual release | December | ~half day to re-parse calendar |
| Federal Register API change | Unlikely | 0 expected |
| Worker schedule misses a day | Rare | Self-recovers next run |

**~3-5 days/year of engineering** for this worker once it's stable.
