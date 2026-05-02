# AlertDetail — `form_change` Action Spec

_Companion to [alert-detail-disaster-extension.md](./alert-detail-disaster-extension.md). Scope: `/alerts/:id` for alertType=`form_change`._

---

## 1. Real-world context

`form_change` alerts fire when a tax form itself is revised — the form catalog needs updating, not the clients' deadlines or amounts directly. Examples of real form changes the pipeline catches:

| Year | Form change | Type | Downstream impact |
|------|-------------|------|-------------------|
| 2020 | **Form 1099-NEC introduced** (replaced Box 7 of 1099-MISC) | new form / split | Every payer reclassifies |
| 2021 | **Schedule K-3 introduced** (international info reporting; required even if "no foreign source") | new schedule | Many partnerships had to file unexpectedly |
| 2022 | **Form 1040 Schedule 1 renumbered** (lines/credits shifted) | numbering change | Software updates needed |
| 2023 | **Form 941 quarterly revision** (ERC reconciliation lines added then removed) | minor revision | Multiple within year |
| 2024 | **E-file mandate threshold lowered from 250 to 10 returns** | filing-method rule | Many firms needed to enroll in IRS e-file |
| 2024 | **Form 1099-K threshold delayed to $5K (was $600)** | threshold change | Reduced volume of 1099-K alerts |
| 2025 | **Schedule K-1 expanded reporting** (more partner-level detail) | content expansion | Tax-prep template updates |
| 2026 | **Form 941 Q-quarterly revision** (deposit-rule annotation refined) | minor revision | Catalog metadata updates |

Form changes have **two distinct downstream effects**:

1. **Catalog metadata update** — `federal_forms.due_date_rule`, `notes`, `irs_url`, `requiredItems`, etc. need to change. This is what the alert triggers admin to do.
2. **Per-client awareness** — clients filing the form may need a heads-up ("Form K-3 is now required even if you have no foreign income — we'll handle it"). Most often informational, sometimes requires Sarah to update the engagement letter or fee.

This makes `form_change` a **curatorial** alert type — most of the action happens at the catalog level (admin reviewer queue), not at the per-client batch level. The CPA's role for non-admin members is **awareness**, not action.

## 2. Real examples our pipeline catches

| Authority | Notice (paraphrased) | Catalog update needed |
|-----------|----------------------|------------------------|
| IRS | "Form 1099-NEC released — separate from 1099-MISC for nonemployee compensation" | Add new form row; update 1099-MISC notes |
| IRS | "Schedule K-3 mandatory for partnerships starting 2021" | Add Schedule K-3 row; update 1065 + 1120-S to reference it |
| IRS | "2026 Form 941 instructions clarify Q1 deposit rules" | Update 941.notes only |
| IRS | "1099-K transactional threshold delayed to $5,000 for 2024" | Update 1099-K.notes; surface alert to firms with marketplace clients |
| State | "AZ Form 140 simplified for flat-tax filers (2025)" | Update AZ catalog entry |

All flow through `federal_register_notices` → `federal_form_change_events` → admin reviewer queue.

## 3. Two audiences for this alert

`form_change` has **two distinct user experiences** depending on `users.role`:

- **Admin / owner** — sees the change_event detail with apply/reject buttons; this is the catalog-update workflow
- **CPA (non-admin)** — sees a read-only acknowledgment view explaining what changed and which of their clients use the form, with no action buttons (other than acknowledge, snooze, dismiss)

We render different action bars for these two audiences. Same alert, different UX.

## 4. The CPA's job

**Non-admin Sarah's mental model**: "FYI — a form changed. My clients who file this form will need awareness, but I don't update the catalog myself."

She does NOT need to:
- File anything different immediately
- Tag clients for relief or planning
- Recompute amounts

She DOES need to:
- Acknowledge that she's seen the change
- Optionally notify clients who use the form (informational email)

**Admin's mental model**: "This is a catalog-update task. Let me review the parsed change against the official source and decide whether to apply, reject, or modify."

Admin's actions:
- Apply: catalog row updates, all downstream FilingsTab / AddDeadlineModal usages get the new metadata
- Reject: change_event marked `rejected`, no catalog change
- Modify: edit the parsed values before applying (e.g., AI parsed wrong)

---

## 5. Page anatomy (non-admin Sarah)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER                                                       │
│  ← Alerts · IRS · form_change · Detected 6h                 │
│  Form 941 instructions clarify Q1 deposit rules             │
│  Catalog update pending admin review                         │
│  [Source: irs.gov/form-941-instructions ↗] [Authority: IRS] │
├─────────────────────────────────────────────────────────────┤
│ ADMIN NOTICE (info-toned)                                    │
│  📋 This change is queued for admin review.                  │
│  Your firm's admin will review and apply the catalog update.│
│  No action needed from you.                                  │
├─────────────────────────────────────────────────────────────┤
│ CONTEXT — clients using this form                            │
│  Used by 4 of your 49 clients (informational)                │
│                                                              │
│  · Acme LLC (S-Corp · CA) — Form 941 quarterly             │
│  · Bob Williams Construction (LLC · TX) — Form 941 quarterly│
│  · Carol's Catering (LLC · CA) — Form 941 quarterly        │
│  · Lone Star Logistics (Partnership · TX) — Form 941 qtly  │
│                                                              │
│  These deadlines remain unchanged for now. The form's       │
│  notes will update once admin applies the catalog change.   │
├─────────────────────────────────────────────────────────────┤
│ EVIDENCE — what changed ▾                                    │
│  Field: notes                                                │
│  Old: "Quarterly payroll deposit reconciliation."           │
│  New: "Quarterly payroll deposit reconciliation. Q1         │
│        deposits clarified — see updated instructions §3.2." │
│                                                              │
│  AI parse: high confidence                                   │
│  Source notice: "irs.gov/.../form-941-instructions-2026.pdf"│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR                                            │
│  [Primary] Acknowledge                                       │
│  [Overflow ⋮] Snooze · Notify clients (optional) · Share    │
└─────────────────────────────────────────────────────────────┘
```

## 6. Page anatomy (admin)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER (same)                                                │
├─────────────────────────────────────────────────────────────┤
│ ADMIN PANEL — review this catalog change                     │
│                                                              │
│  Form: 941                                                   │
│  Change kind: instructions_update                            │
│  Detected: 6h ago via Federal Register doc 2026-12345        │
│                                                              │
│  ── Diff (current → proposed) ──                            │
│  notes:                                                      │
│  - Quarterly payroll deposit reconciliation.                │
│  + Quarterly payroll deposit reconciliation. Q1 deposits    │
│    clarified — see updated instructions §3.2.                │
│                                                              │
│  irs_url: (no change)                                        │
│  due_date_rule: (no change)                                  │
│  required_items: (no change)                                 │
│                                                              │
│  AI parse confidence: high                                   │
│                                                              │
│  [Source notice: federalregister.gov/.../2026-12345 ↗]      │
├─────────────────────────────────────────────────────────────┤
│ DOWNSTREAM IMPACT                                            │
│  This change will appear in:                                 │
│   · FilingsTab (4 of your clients use Form 941)             │
│   · AddDeadlineModal picker (form description)              │
│   · TaskDetail tooltip on Form 941 deadlines                │
│                                                              │
│  Existing Form 941 deadlines: NOT modified.                  │
│  Existing Form 941 ChecklistItems: NOT modified.             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STICKY ACTION BAR (admin)                                    │
│  [Primary] Apply catalog change                              │
│  [Secondary] Modify before applying                          │
│  [Overflow ⋮] Reject · Dismiss without applying · Share     │
└─────────────────────────────────────────────────────────────┘
```

The admin variant is essentially a code review for catalog data.

## 7. Header

Subtitle template (both audiences):

`"{change-summary}. Catalog update {pending|applied}."`

Examples:
- "Form 941 instructions clarify Q1 deposit rules. Catalog update pending admin review."
- "Schedule K-3 added to 1065 / 1120-S filings. Catalog update applied 2026-04-30."

## 8. Verdict / Context section

### 8.1 Headline (non-admin)

```
Used by 4 of your 49 clients (informational)
```

The "(informational)" tag is critical — sets non-action expectations. Without it, Sarah might wonder if she needs to do something for these 4.

If 0 clients use the form:
```
None of your clients use this form. No catalog action needed for your firm.
[Dismiss] [Open source ↗]
```

### 8.2 Per-client list (non-admin)

Read-only — no checkboxes, no actions.

```
· Acme LLC (S-Corp · CA) — Form 941 quarterly
· Bob Williams Construction (LLC · TX) — Form 941 quarterly
```

Slots:

| Slot | Content |
|------|---------|
| Name | `client.name` (link to ClientDetail) |
| Metadata | `entityType · primaryState` |
| Usage chip | Which deadline(s) use this form ("Form 941 quarterly", "Form 1040 individual") |

Notably absent from this variant: checkboxes, "+ Deadline" links, per-row actions. The list is informational only.

### 8.3 Admin diff panel

For admin users, the verdict-equivalent is the **diff panel**:

```
notes:
- Quarterly payroll deposit reconciliation.
+ Quarterly payroll deposit reconciliation. Q1 deposits
  clarified — see updated instructions §3.2.
```

For each `federal_forms` field that the parser thinks should change, show old → new with markdown-diff styling. Fields not changing show `(no change)`.

Critical fields:
- `notes` (most common)
- `irs_url` (rare — only on URL renames)
- `due_date_rule` (huge impact — needs careful review)
- `required_items` (per-form-checklist edits)
- `extension_form` (very rare)

Each field has its own `confidence` per the LLM extractor. Admin can edit the proposed value inline before applying.

### 8.4 Downstream impact callout

Both variants surface what will and won't change:

```
This change will appear in:
  · FilingsTab (4 of your clients use Form 941)
  · AddDeadlineModal picker (form description)
  · TaskDetail tooltip on Form 941 deadlines

Existing Form 941 deadlines: NOT modified.
Existing Form 941 ChecklistItems: NOT modified.
```

This is essential for trust. Sarah / admin should never wonder "wait, will this break things I've already filed?"

---

## 9. Action bar — non-admin

### 9.1 Primary — `"Acknowledge"`

Removes alert from Today queue. Writes activity event. No mutation to client data.

### 9.2 Overflow

- **Snooze 7d** / 14d / `"until applied"` (auto-resolves when admin marks `applied_at`)
- **Notify clients (optional)** — opens BatchNotifyModal pre-populated with informational email ("FYI: Form 941 instructions updated; we're handling it"). Most form_change alerts don't merit this; offer it but don't push.
- **Share** (copy link)

### 9.3 No "Dismiss" verb

Reasoning: form_change alerts represent real catalog changes. "Dismiss" would imply the change isn't real, which is misleading. Use Snooze (push to later) or Acknowledge (mark seen) instead. The overflow has a "Dismiss without applying" option for admins only — and that requires a reason.

---

## 10. Action bar — admin

### 10.1 Primary — `"Apply catalog change"`

The catalog-update verb.

**On click**:

1. Optimistic UI: action bar shows "Applying…"
2. BE call: `trpc.federalForms.applyChangeEvent({ changeEventId, userOverrides? })`
3. BE in transaction:
   - For each field in the diff: `UPDATE federal_forms SET <field>=<new> WHERE id=$formId`
   - UPDATE `federal_form_change_events SET applied_at=now(), applied_by=user`
   - UPDATE `federal_forms.last_change_check_at = now()`
   - Insert activity_event (firm-scoped, type='catalog_change_applied')
4. FE flash: `"Catalog updated · 4 clients' Form 941 metadata refreshed"`

### 10.2 Secondary — `"Modify before applying"`

Opens an inline editor for the diff. Admin can:
- Edit the proposed `notes` text
- Reject specific field changes (apply some but not all)
- Add a manual reviewer note for audit trail

After modification, click "Apply with modifications" → same backend call with `userOverrides`.

### 10.3 Overflow (admin)

- **Reject** — opens rejection-reason dialog. Required reason. Marks event `rejected_at` + `rejected_reason`.
- **Dismiss without applying** — alias for reject with reason "duplicate" or "not relevant" (for events the parser caught that aren't actually changes — e.g., editorial-only PDF re-publishes).
- **Share** (copy link)

---

## 11. Edge cases

| Case | Behavior |
|------|---------|
| Same form has multiple unreviewed change_events | Show them stacked (most recent on top) on the alert; admin reviews each in order |
| Change_event references a form not in catalog | Annotation: `[unknown form — extract first]`; admin can use LLM extractor to add the form before applying |
| Change_event affects `due_date_rule` | Show extra warning: "This will change deadline calculations for X future deadlines" |
| Deprecated form (status=deprecated) | Disable apply; show deprecation note; admin must un-deprecate first |
| Form has 0 active deadlines | Note: "No active client deadlines; safe to apply." |
| Multi-field change with mixed confidence | Apply high-confidence fields by default; defer low-confidence fields with annotation |
| Admin changes role mid-review (admin → member) | Action bar re-renders to non-admin variant; partial changes lost (in-progress not autosaved) |
| Concurrent edit (two admins on same change_event) | Optimistic lock on `change_event.acted_at`; second admin gets "another admin just applied this" prompt |
| Source notice link breaks (404) | Annotation in evidence: `[source URL no longer accessible — last verified {date}]`; doesn't block apply |
| Apply fails midway (DB error) | Roll back transaction; surface error message; admin retries |

---

## 12. State diagram

Two-level state machine.

**Alert level** (shared with other types):
```
PENDING → ACTED (acknowledged by non-admin) | SNOOZED | DISMISSED | EXPIRED
```

**change_event level** (admin-only, distinct from alert):
```
PROPOSED → APPLIED (catalog mutated)
        → REJECTED (with reason)
        → MODIFIED-AND-APPLIED (admin edited then applied)
```

When admin applies: alert auto-resolves (moves to ACTED), all subscribed users see updated catalog data on next FilingsTab load.

---

## 13. BE data contract

### `trpc.announcements.detailWithAffected({ announcementId })`

For form_change, `affected` is informational only:

```typescript
{
  announcement: {
    // ...shared
    alertType: 'form_change';
    formNumber: string;            // "941", "1099-NEC", "Schedule K-3"
    changeKind: 'due_date_change' | 'form_revision' | 'new_form' |
                'deprecation' | 'instructions_update' | 'other';
    summary: string;
    sourceNoticeId: string;        // FK to federal_register_notices
    changeEventId: string;         // FK to federal_form_change_events
    diff: {                        // computed by BE from change_event
      notes?: { old: string | null; new: string | null; confidence: number };
      irsUrl?: { old: string | null; new: string | null; confidence: number };
      dueDateRule?: { old: unknown; new: unknown; confidence: number };
      requiredItems?: { old: unknown[]; new: unknown[]; confidence: number };
      // etc.
    };
    isAdminGated: true;
    catalogStatus: 'pending' | 'applied' | 'rejected';
    appliedAt: ISODate | null;
  };

  affected: Array<{
    client: { id, name, entityType, primaryState };
    usage: string[];               // ["Form 941 quarterly Q1", "Form 941 quarterly Q2"]
  }>;

  // No notAffected — for form_change, the entire roster is potentially relevant
  // (we just don't list the ones who don't use the form)
}
```

### `trpc.federalForms.applyChangeEvent({ changeEventId, userOverrides? })`

Admin-only. Returns:
```typescript
{
  applied: boolean;
  fieldsApplied: string[];
  appliedAt: ISODate;
  affectedDeadlineCount: number;   // how many existing deadlines reference the form (informational only)
}
```

### `trpc.federalForms.rejectChangeEvent({ changeEventId, reason })`

Admin-only.

### `trpc.federalForms.acknowledgeChangeEvent({ changeEventId })`

Non-admin. Marks alert as ACTED for the user; doesn't mutate catalog.

---

## 14. Copy

| Element | Copy |
|---------|------|
| Browser tab | `"{Authority} · Form {N} change · DueDateHQ"` |
| Subtitle | `"{change-summary}. Catalog update {pending\|applied} {date}."` |
| Admin notice (non-admin) | `"📋 This change is queued for admin review."` |
| Admin notice subhead | `"Your firm's admin will review and apply the catalog update. No action needed from you."` |
| Verdict header (non-admin) | `"Used by {N} of your {totalActive} clients (informational)"` |
| Verdict header (N=0) | `"None of your clients use this form. No catalog action needed for your firm."` |
| Diff prefix | `"Field: {fieldName}"` |
| Diff old line | `"- {old value}"` (red strikethrough in UI) |
| Diff new line | `"+ {new value}"` (green) |
| No-change line | `"{fieldName}: (no change)"` |
| Downstream callout heading | `"This change will appear in:"` |
| Downstream callout NOT-modified | `"Existing {form} deadlines: NOT modified."` |
| Primary verb (non-admin) | `"Acknowledge"` |
| Primary verb (admin) | `"Apply catalog change"` |
| Secondary verb (admin) | `"Modify before applying"` |
| Confirmation flash (admin) | `"Catalog updated · {N} clients' {form} metadata refreshed"` |
| Confirmation flash (non-admin) | `"Acknowledged · removed from Today"` |
| Reject reason dialog title | `"Why are you rejecting this catalog change?"` |
| Snooze "until applied" | `"Resurface when admin applies"` |

**Tone (non-admin)**: reassuring, low-stakes, "FYI." Avoid alarm.
**Tone (admin)**: precise, technical, code-review-like. Diffs are king; commentary is minimal.

---

## 15. Telemetry

| Event | When | Payload |
|-------|------|---------|
| `alert_viewed` (form_change, role=admin) | Page mount | `{ announcementId, isAdmin: true }` |
| `alert_viewed` (form_change, role=member) | Page mount | `{ announcementId, isAdmin: false }` |
| `catalog_change_applied` | Admin applies | `{ changeEventId, fieldsChanged, appliedAt, daysFromDetected }` |
| `catalog_change_modified_and_applied` | Admin edits then applies | `{ changeEventId, modifiedFields }` |
| `catalog_change_rejected` | Admin rejects | `{ changeEventId, reason }` |
| `catalog_change_acknowledged` | Non-admin acknowledges | `{ changeEventId, daysFromDetected }` |

Goal: measure (a) admin review SLA (avg days from detection to apply/reject), (b) non-admin acknowledgment rate (proxy for "is this useful to non-admins or just noise?"), (c) modification rate (proxy for "how often is the AI parse exactly right?").

---

## 16. What's NOT in scope

- **Editing the catalog directly via this page** — admin must use the dedicated `/settings/federal-forms` reviewer queue for full edits (rename, deprecate, etc.). This page handles single-event apply only.
- **Auto-publishing form changes to client portals** — per `forever_no` no client portal.
- **Versioned catalog history** — yes we audit log every change, but no "see version 3 of Form 941" UI in this scope. Audit log is enough.
- **Cross-firm catalog sharing** — catalog is system-wide; no per-firm forks (per `forever_no`).
- **Auto-applying low-stakes changes** (e.g., `notes` only with high confidence) — discussed but rejected. Always require admin to apply. The reason: a misclassified "low-stakes" change could still be wrong, and we'd rather have admin glance at it than have a silent catalog drift.

---

## 17. Build order

| Phase | Work | Effort |
|-------|------|--------|
| 1 | Schema: `federal_form_change_events.applied_at`, `rejected_at`, `rejected_reason`, `applied_by`, `userOverrides_jsonb` | XS |
| 2 | BE: `applyChangeEvent`, `rejectChangeEvent`, `acknowledgeChangeEvent` procedures | M |
| 3 | BE: diff computation (compare current `federal_forms` row vs proposed change) | M |
| 4 | BE: role-gating helper (`firmProcedure.requireRole('admin')`) | XS |
| 5 | FE: variant page — admin diff panel, non-admin notice + read-only client list | L |
| 6 | FE: inline diff editor (for "Modify before applying") | M |
| 7 | FE: rejection-reason dialog | S |
| 8 | Telemetry events | XS |
| 9 | E2E test: admin applies, non-admin acknowledges, both flow correctly | M |

Estimated total: ~2 sprints.

---

_End of form_change spec._
