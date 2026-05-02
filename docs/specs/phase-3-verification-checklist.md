# Phase 3 — BE worker verification checklist

> **Purpose:** Smoke tests + acceptance criteria to confirm the federal-forms BE worker (parallel session) is actually working. Run top-to-bottom after the PR lands on staging or prod.
>
> **Companion doc:** `phase-3-be-federal-forms-worker.md` (the spec the parallel session built from).

---

## Pre-deploy — confirm the spec was followed

These should all be true in the codebase before the worker even runs.

### ✓ Schema present

```bash
# In backend/, check the migration was generated
ls backend/src/db/migrations/ | grep federal_forms
```
Expected: at least one file like `00XX_federal_forms.sql` (or whatever migration naming convention is used).

```bash
# Confirm Drizzle schema export exists
grep -n "federalForms\|federal_forms" backend/src/db/schema.ts
```
Expected: ≥3 hits — `federalForms`, `federalFormsAudit`, `federalRegisterCursor` table definitions.

### ✓ Worker module structure

```bash
ls backend/src/workers/refreshFederalForms/
```
Expected at minimum: `index.ts`. Spec recommends 6 files (`index`, `seedFromHandCurated`, `pollFederalRegister`, `extractFromPdf`, `validateAgainstPub509`, `upsertCatalog`, `alerts`) — but a single `index.ts` with all stages inline is acceptable for v1.

### ✓ tRPC router mounted

```bash
grep -n "federalForms" backend/src/trpc/router.ts
```
Expected: an import + a route mount line.

### ✓ Required env vars set on the deploy target

On Fly: `fly secrets list -a <app-name>`. Expected entries:
- `ANTHROPIC_API_KEY`
- `FEDERAL_REGISTER_USER_AGENT` (optional but recommended)
- (Existing `DATABASE_URL`, Sentry config etc. should already be present)

If `ANTHROPIC_API_KEY` is missing, Stage C will fail silently or loudly — both are bad. Fix before first run.

### ✓ Catalog data available to BE

The BE needs access to `src/data/federalForms.ts` (in the FE root). Verify the build path:

```bash
# Should produce a JSON file the BE can import
ls backend/src/data/federalForms.json 2>/dev/null \
  || ls backend/dist/federalForms.json 2>/dev/null \
  || grep -r "FEDERAL_FORMS\|federalForms" backend/src/workers/
```
Expected: either a JSON file the BE generates at build time, OR a direct TypeScript import using a path alias. **NOT acceptable:** duplicated catalog data in `backend/src/data/` (silent drift risk).

---

## Post-deploy smoke tests — Stage A (seed)

The first time the worker runs, it should populate `federal_forms` with the 51 hand-curated entries.

### Test 1.1: Row count after first run

```sql
SELECT COUNT(*) FROM federal_forms WHERE source = 'hand-curated';
```
**Expected:** 51 (matching the count in `src/data/federalForms.ts`)
**If 0:** Stage A didn't run. Check worker logs for import errors.
**If <51:** Some rows failed. `SELECT * FROM federal_forms_audit WHERE source = 'hand-curated' ORDER BY changed_at DESC LIMIT 20;` to see what was inserted.

### Test 1.2: All forms have due-date basis

```sql
SELECT form_code, due_date_basis FROM federal_forms WHERE source = 'hand-curated' AND due_date_basis IS NULL;
```
**Expected:** zero rows.

### Test 1.3: Spot-check known forms

```sql
SELECT form_code, name, due_date, extension_form
FROM federal_forms
WHERE form_code IN ('1040', '1120-S', '1065', '1041', '990', '5471')
ORDER BY form_code;
```
**Expected output:**
```
 form_code |                         name                          | due_date | extension_form
-----------+-------------------------------------------------------+----------+----------------
 1040      | U.S. Individual Income Tax Return                     | 04-15    | 4868
 1041      | U.S. Income Tax Return for Estates and Trusts         | 04-15    | 7004
 1065      | U.S. Return of Partnership Income                     | 03-15    | 7004
 1120-S    | U.S. Income Tax Return for an S Corporation           | 03-15    | 7004
 5471      | Information Return of U.S. Persons With Respect ...   | 04-15    | 4868
 990       | Return of Organization Exempt From Income Tax         | 05-15    | 8868
```

If due dates differ — Stage A is using the wrong source field or the catalog file in `src/data/federalForms.ts` got out of sync.

### Test 1.4: Required items populated

```sql
SELECT form_code, jsonb_array_length(required_items) AS items
FROM federal_forms WHERE form_code IN ('1040', '1120-S', '1041')
ORDER BY form_code;
```
**Expected:**
```
 1040    | 15
 1041    | 9
 1120-S  | 10
```

If any form has `0` items or `NULL` — Stage A is dropping the JSONB array. Check the upsert path.

### Test 1.5: Source URLs resolve

```sql
SELECT form_code, source_urls->>0 AS first_source
FROM federal_forms
WHERE source = 'hand-curated' AND source_urls IS NOT NULL
LIMIT 5;
```
Pick one URL from output and run:
```bash
curl -sI -A "Mozilla/5.0" "<paste URL>" | head -1
```
**Expected:** `HTTP/2 200`. If 404 — IRS may have moved the file (rare). Worker doesn't auto-correct; row needs manual fix.

---

## Smoke tests — Stage B (Federal Register polling)

### Test 2.1: Cursor exists after first run

```sql
SELECT * FROM federal_register_cursor;
```
**Expected:** exactly one row with `id=1`, `last_polled_at` recent, `last_publication_date` NOT NULL.
**If empty:** Stage B never ran or failed. Check worker logs.

### Test 2.2: Cursor advances across runs

After two successive worker runs (>24h apart):
```sql
SELECT last_polled_at, last_publication_date FROM federal_register_cursor;
```
**Expected:** `last_polled_at` should be within the last 24h.
**If stuck:** Stage B is failing silently. Check Federal Register API rate limits or User-Agent header.

### Test 2.3: Manual Federal Register probe

This confirms the API itself is responding. Run independently:
```bash
curl -sL --max-time 15 \
  -A "DueDateHQ-catalog/1.0" \
  "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=internal-revenue-service&per_page=2" \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(f\"{d['count']} IRS docs available\")"
```
**Expected:** something like `"10247 IRS docs available"` (number varies).
**If error:** Federal Register API is down or rate-limiting. Worker should retry next run.

### Test 2.4: Form-code regex catches a known notice

Find a recent IRS notice with a form mention:
```bash
curl -sL --max-time 15 \
  "https://www.federalregister.gov/api/v1/documents.json?conditions%5Bagencies%5D%5B%5D=internal-revenue-service&conditions%5Bterm%5D=form&per_page=5&fields%5B%5D=title&fields%5B%5D=document_number" \
  | python3 -m json.tool | head -30
```
Pick a title containing "Form NNNN" (e.g. "Form 8717"). Then check whether the worker flagged that form for extraction:
```sql
SELECT form_code, needs_extraction, last_extracted_at
FROM federal_forms
WHERE form_code = '8717';  -- substitute the form code from the notice
```
**Expected:** row exists with `needs_extraction = true` (if not yet processed by Stage C) OR `needs_extraction = false` AND `last_extracted_at` recent (if Stage C already ran).
**If form_code is missing:** the regex didn't catch this form pattern, OR Stage B isn't creating stub rows for unknown forms. Check `pollFederalRegister.ts`.

---

## Smoke tests — Stage C (LLM extraction)

### Test 3.1: Extraction runs only on flagged rows

```sql
SELECT COUNT(*) FROM federal_forms WHERE needs_extraction = true;
```
After a worker run, this should be **lower** than before — Stage C should consume the queue.

### Test 3.2: AI-suggested rows present

```sql
SELECT form_code, name, confidence, needs_review
FROM federal_forms
WHERE source = 'ai-extraction'
ORDER BY last_extracted_at DESC
LIMIT 10;
```
**Expected:** new rows appear over time as IRS publishes notices about forms outside the hand-curated 50. `confidence` should be `'ai-suggested'`. `needs_review` should be `true` (CPA must approve before product surfaces these).

### Test 3.3: Spot-check an AI-extracted row

Pick one row from Test 3.2. Verify:
- `due_date` is `MM-DD` format or null
- `due_date_basis` matches one of the enum values from the spec
- `required_items` is non-empty JSONB array
- `source_urls` includes the IRS PDF URL

```sql
SELECT form_code, due_date, due_date_basis, jsonb_array_length(required_items), source_urls
FROM federal_forms WHERE form_code = '<picked form>';
```

If `required_items` is `[]` and `source` is `'ai-extraction'` — Stage C extracted but couldn't parse a checklist. This is OK for some forms (extension-only forms have minimal items) but should be rare.

### Test 3.4: Cross-validation flagged disagreements

```sql
SELECT form_code, due_date, confidence, needs_review
FROM federal_forms
WHERE confidence = 'low' OR (needs_review = true AND source = 'ai-extraction')
ORDER BY last_extracted_at DESC
LIMIT 20;
```
**Expected:** ≤5% of AI-extracted rows. If many — Pub 509 cross-validation isn't matching, or LLM is confidently wrong, or the validator regex is too strict.

### Test 3.5: LLM cost stays bounded

Worker logs (or Anthropic console) should show:
- ≤30 LLM calls per run in steady state (after the initial backfill burst)
- ≤$1 per run

If costs balloon — Stage C is re-extracting forms that haven't changed. Check that `needs_extraction` flag is being cleared after successful extraction.

---

## End-to-end UI verification

These confirm the BE worker output reaches the FE.

### Test 4.1: tRPC `federalForms.list` returns rows

In the dev preview console:
```js
fetch('/api/trpc/federalForms.list?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:{}}})))
  .then(r => r.json())
  .then(d => console.log('forms count:', d[0]?.result?.data?.json?.length));
```
**Expected:** `forms count: 51` (or more, if Stage C has added long-tail rows).
**If 0:** tRPC isn't reading from the table. Check the router's `from(federalForms)` clause.
**If error:** Router not mounted, or auth blocking. Spec says `publicProcedure`; verify nothing was accidentally changed to firmProcedure.

### Test 4.2: AddDeadlineModal lists catalog forms

1. Open any client (`/clients/<id>`)
2. Click "Add deadline" (the button on the Filings tab or in the empty state)
3. Open the form-type dropdown
4. **Expected:** "All federal forms" optgroup present, contains all 51 (or more) entries from the catalog. Scroll through — Form 5471, 990, 1041, 8606 should all be listed.

If the dropdown is short (only the legacy 15) — the FE is reading the in-memory fallback because the BE query failed. Check tRPC errors in browser console.

### Test 4.3: Bundle popover shows IRS links

1. Open a client with a service package (e.g. Jim Boudreaux on "Individual + PTE")
2. Click the package chip
3. **Expected:** popover opens showing "↗ IRS" link on every federal form row (5 of 6 rows for Individual+PTE; the LA state row has no link).

If no IRS links — `resolveFederalForm()` isn't finding catalog matches. The BE table might be empty (FE falls back to in-memory which still works).

### Test 4.4: New task gets richer checklist

1. Open Jim Boudreaux's 1040 task: `/clients/c-la-03/tasks/t-d-066`
2. Look at the checklist
3. **Expected:** ~15 items including W-2, 1099-INT, 1099-DIV, 1099-NEC, K-1, 1098 mortgage, 1098-T tuition, charitable receipts, property tax, brokerage 1099-B, HSA/FSA, estimated payments — the real catalog list, NOT the 7-item legacy hardcode.

If only 7 generic items — the templateFor() function isn't reading from the catalog. Check `src/data/mockChecklistItems.ts` import of `resolveFederalForm`.

### Test 4.5: Trust client gets trust-specific checklist

1. Find a Trust client (likely `c-???-trust` in seed data, or any client with entityType = "Trust")
2. Open one of their task details
3. **Expected:** checklist contains trust-specific items (trust accounting, beneficiary distributions, trustee fees) — NOT the generic "engagement letter / YE planning" default.

If generic — the catalog mapper isn't recognizing Trust forms (1041). Check `resolveFederalForm("1041 (federal)")` in the canonicalForm.ts module.

---

## Stage D — alerts

These are harder to test deterministically; check them after a few days of operation.

### Test 5.1: Alerts fire on real failures

Manually break the worker (e.g. set `ANTHROPIC_API_KEY=invalid`). Trigger a run. **Expected:** Sentry captures the exception within minutes. Email alert fires.

### Test 5.2: Stale-data alert

If the worker hasn't completed a successful run in 60 days, an alert should fire. **Hard to test directly** — check the cron schedule and the stale-check action exists.

### Test 5.3: No alert fatigue

After a successful run, no alerts should fire. Check the alerts inbox / Sentry dashboard for the past week — if there are dozens of warnings, the thresholds are too tight.

---

## Failure mode catalog

If something looks wrong, find the symptom here for likely cause + fix:

| Symptom | Likely cause | Fix |
|---|---|---|
| `federal_forms` table empty after deploy | Stage A never ran (worker entry point not wired or migration didn't run) | Check `backend/src/index.ts` for cron registration; manually run worker |
| All 51 rows present but no `'ai-extraction'` rows after a month | Stage B not detecting any forms in IRS notices | Verify Federal Register API call works (Test 2.3); inspect cursor + form-code regex |
| Stage C never fires | `needs_extraction = true` rows pile up forever | Worker entry point may only call Stages A+B; check `index.ts` |
| Federal Register cursor stuck at deploy date | Cursor row created but never updated | Stage B's `advanceCursor()` not being called on success |
| LLM extraction returns garbage / null | Wrong PDF URL pattern, or PDF too large for Claude context | Log the URL being fetched; verify PDF downloads (`curl -I`); check Anthropic SDK error responses |
| FE shows fallback in-memory data, not BE rows | tRPC route not mounted, or returns empty | Test 4.1; check router mount + DB connectivity |
| Costs > $5/run consistently | `needs_extraction` flag not clearing after extraction | Verify the UPDATE in `upsertCatalog.ts` sets `needs_extraction = false` |
| Sentry showing repeated `403 Forbidden` from Federal Register | User-Agent header missing or blocked | Set `FEDERAL_REGISTER_USER_AGENT` env var with a contact email |
| Worker takes > 10 min per run | Sequential PDF downloads + LLM calls; OK for v1 | Profile; consider parallelism if it bites |

---

## Acceptance criteria (go/no-go)

The worker is **production-ready** when ALL of these are true:

- [ ] Test 1.1: 51 hand-curated rows in `federal_forms` after first run
- [ ] Test 1.4: Required items populated for top-5 forms (1040, 1120-S, 1065, 1041, 990)
- [ ] Test 2.1: Federal Register cursor exists with recent timestamp
- [ ] Test 2.2: Cursor advances after a second worker run
- [ ] Test 4.1: `trpc.federalForms.list` returns ≥51 rows in production
- [ ] Test 4.2: AddDeadlineModal shows all catalog entries in production
- [ ] Test 4.4: Jim Boudreaux's 1040 task shows the 15-item rich checklist (not 7)
- [ ] No unhandled exceptions in Sentry for 7 consecutive days
- [ ] Cost per run < $1 in steady state

The worker is **acceptable to ship to staging** with these:
- [ ] Tests 1.1, 1.4, 4.1 pass
- [ ] Worker can be triggered manually via `workflow_dispatch` or admin endpoint
- [ ] Logs visible in standard infra (not buried in stdout-only output)

---

## Quick reference: useful one-liners

**Force-rerun the worker manually** (varies by deployment — adapt):
```bash
fly machine exec <machine-id> -a <app-name> "node dist/workers/refreshFederalForms/index.js"
```
or hit an admin endpoint if one exists.

**Re-seed from hand-curated only** (if catalog updates need to apply):
```bash
fly machine exec <machine-id> -a <app-name> "node dist/workers/refreshFederalForms/seedFromHandCurated.js"
```

**Inspect recent audit log**:
```sql
SELECT changed_at, form_code, changed_field, source
FROM federal_forms_audit
ORDER BY changed_at DESC LIMIT 50;
```

**Find rows pending CPA review**:
```sql
SELECT form_code, name, confidence, source
FROM federal_forms WHERE needs_review = true
ORDER BY form_code;
```

**Reset the Federal Register cursor** (for re-poll from a specific date):
```sql
UPDATE federal_register_cursor
SET last_publication_date = '2026-01-01', last_polled_at = NOW()
WHERE id = 1;
```

---

## What "working correctly" actually means

Walking the parallel session through this doc and getting greens on everything in the **acceptance criteria** section means:
1. The 51 hand-curated forms are persisted and queryable by the FE.
2. The Federal Register feed is being polled and form-code mentions are being detected.
3. New forms (outside the curated 50) are being extracted via LLM, with cross-validation to flag uncertain ones.
4. The FE consumers (AddDeadlineModal autocomplete, FilingsTab IRS links, per-task checklists) are reading the BE data, not just the in-memory fallback.
5. Failures alert; staleness alerts; cost stays bounded.

If any of those is missing, the worker is **partially working** — usable but with caveats. Common partial states:
- Stages A + B work, Stage C broken → catalog stays at 51 forms, no long-tail growth (acceptable for MVP)
- All stages work, FE doesn't read from BE → product still shows the 51 in-memory forms (acceptable; FE migration is a separate task)
- All stages work, FE reads from BE, but cross-validation flags too many rows → CPA review queue backs up (acceptable; flag the threshold for tuning)
