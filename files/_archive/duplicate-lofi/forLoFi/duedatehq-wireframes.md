# DueDateHQ — Screen Wireframes (Announcement Detail · Client Detail · Import Wizard)

> **v0.1** · Supplements `duedatehq-dashboard-spec.md`
> Three screens covering the rest of Flows A/B/C

---

## 1 · Announcement Detail

**Route:** `/announcements/:id`
**Entry:** dashboard banner · bell dropdown · email link · State Intel list

```
┌────────────┬──────────────────────────────────────────────────────────┐
│ [sidebar]  │  🔍 Search (⌘K)     [+ New]    🔔    👤  Sarah K.        │
│            │──────────────────────────────────────────────────────────│
│            │  ‹ State Intelligence                                    │
│            │                                                          │
│            │  ╔══════════════════════════════════════════════════════╗│
│            │  ║ Louisiana DOR · Hurricane Delta Extension           ║│  ← Header block
│            │  ║ Published Sep 15, 2026 · Detected Sep 15, 14:22 UTC ║│
│            │  ║ [ View official source ↗ ]  ·  Disaster extension   ║│
│            │  ╚══════════════════════════════════════════════════════╝│
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ 📋 PARSED IMPACT                        AI · High  │  │  ← LLM output
│            │  │ ─────────────────────────────────────────────────  │  │
│            │  │ Counties     Orleans, Jefferson, St. Bernard       │  │
│            │  │ Entities     LLC · S-Corp · Individual             │  │
│            │  │ Taxes        State income · PTE · Q-estimates      │  │
│            │  │ Old deadline Oct 15, 2026                          │  │
│            │  │ New deadline Feb 15, 2027                          │  │
│            │  │                                                    │  │
│            │  │ ⚠ Always verify against official source before     │  │
│            │  │   acting. [Report parsing issue]                   │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ 🎯 AFFECTED CLIENTS (6)          [Select all]      │  │  ← Impact list
│            │  │ ─────────────────────────────────────────────────  │  │
│            │  │ ☑ Acme LLC          New Orleans   1065 + state    │  │
│            │  │ ☑ Bayou Corp        Metairie      1120-S + state  │  │
│            │  │ ☑ Jim Boudreaux     Chalmette     1040 + state    │  │
│            │  │ ☑ Lafitte Holdings  New Orleans   PTE election    │  │
│            │  │ ☑ Crescent LLC      New Orleans   Q3 estimates    │  │
│            │  │ ☑ Marie Theriot     Metairie      1040 + state    │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ ACTIONS                                            │  │  ← Sticky
│            │  │ ─────────────────────────────────────────────────  │  │    footer
│            │  │ [ Batch-adjust 6 deadlines → Feb 15 ]  ← primary  │  │
│            │  │ [ Notify 6 clients by email ]                     │  │
│            │  │ [ Review one-by-one ]                              │  │
│            │  │ [ Not applicable — dismiss ]                       │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

**Interactions:**
- Checkboxes on client rows → actions operate on selected subset only (default: all selected)
- "Batch-adjust" → confirm modal → deadlines updated + activity logged on each client
- "Notify" → preview email template → send with CPA's reply-to
- "Review one-by-one" → paginated flow through each client's deadline(s)
- "Not applicable" → confirm + optional reason → announcement archived for this firm, no more nags
- "Report parsing issue" → opens form; feeds human review queue (for Q3 accuracy improvement)

**States:**
- Parsed · High confidence → auto-published (as shown above)
- Parsed · Low confidence → "⏳ Under human review — you'll be notified when verified" banner; action buttons disabled
- Already acted on → actions replaced with summary: "✓ 6 deadlines adjusted on Sep 15 by Sarah"

**Mobile:** single column; action buttons become sticky bottom bar.

---

## 2 · Client Detail

**Route:** `/clients/:id`
**Entry:** Clients list · Dashboard row click · global search · announcement affected-client link

```
┌────────────┬──────────────────────────────────────────────────────────┐
│ [sidebar]  │  🔍    [+ New]    🔔    👤                                │
│            │──────────────────────────────────────────────────────────│
│            │  ‹ Clients                                               │
│            │                                                          │
│            │  Acme LLC                          [ Edit ] [ Archive ]  │  ← Header
│            │  S-Corp · Louisiana + Texas · Active · Added Jan 2026    │
│            │                                                          │
│            │  ┌──────────────────────────────────────────────────┐    │
│            │  │ Deadlines · Notes · Contacts · Activity          │    │  ← Tabs
│            │  └──────────────────────────────────────────────────┘    │
│            │                                                          │
│            │  DEADLINES                                               │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ Service Packages                       [+ Assign]  │  │
│            │  │ · S-Corp Standard (Louisiana)                      │  │
│            │  │ · Multi-state add-on (Texas)                       │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ Upcoming (5)                                       │  │
│            │  │ ─────────────────────────────────────────────────  │  │
│            │  │ Mar 15   1120-S federal              Not started ⋯│  │
│            │  │ Mar 15   LA CIFT-620                 Not started ⋯│  │
│            │  │ Mar 15   TX Franchise                Not started ⋯│  │
│            │  │ Apr 15   Q1 estimate federal         Not started ⋯│  │
│            │  │ Apr 15   LA Q1 estimate              Not started ⋯│  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ This year                                   ▸ 18   │  │  ← collapsed
│            │  │ Completed                                   ▸ 12   │  │
│            │  │ Archived history (2025)                     ▸ 17   │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │ 🔗 Related clients              [+ Link client]    │  │  ← K-1 chain
│            │  │ · John Acme (1040 · personal)    Partner           │  │
│            │  │ · Jane Acme (1040 · personal)    Partner           │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

**Tab contents:**
- **Deadlines** (shown above) — primary surface
- **Notes** — free-text with timestamps; pinnable; searchable
- **Contacts** — primary + additional contacts; email/phone; preferred channel
- **Activity** — system-generated event log: "Mar 10, Sarah marked 1120-S complete"; "Sep 15, system added 6 deadlines from Hurricane extension"

**Header actions:**
- Edit → modal with client fields (name, entity, states, contacts)
- Archive → confirm modal; moves to archived state (7-year retention)
- Export (in `⋯` menu) → PDF report of client's deadlines; CSV; iCal

**Right-rail on wide screens (optional, Phase 1.5):** quick-glance sidebar with primary contact + next deadline + days until.

**Mobile:** tabs become horizontal scroll; Related clients section collapses.

---

## 3 · Import Wizard

**Route:** `/import` (also used during onboarding at `/onboarding/import`)
**Entry:** onboarding flow · Clients list "Import" button · Settings › Imports

```
┌────────────┬──────────────────────────────────────────────────────────┐
│ [sidebar]  │  🔍    🔔    👤                                           │
│            │──────────────────────────────────────────────────────────│
│            │                                                          │
│            │   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━       │  ← 4-step
│            │   (1) Upload → (2) Map → (3) Preview → (4) Commit        │    progress
│            │                                                          │
│            │  ┌────────────────────────────────────────────────────┐  │
│            │  │                                                    │  │
│            │  │   STEP 1 · Upload your CSV                         │  │
│            │  │                                                    │  │
│            │  │   ┌────────────────────────────────────────────┐   │  │
│            │  │   │                                            │   │  │
│            │  │   │     📁  Drop CSV here or click to browse   │   │  │
│            │  │   │                                            │   │  │
│            │  │   └────────────────────────────────────────────┘   │  │
│            │  │                                                    │  │
│            │  │   Supported sources:                               │  │
│            │  │   · File In Time  · TaxDome  · Drake               │  │
│            │  │   · ProConnect  · QuickBooks  · plain Excel        │  │
│            │  │                                                    │  │
│            │  │   Don't see yours? Any CSV with client data works. │  │
│            │  │                                                    │  │
│            │  │                                   [ Continue → ]   │  │
│            │  └────────────────────────────────────────────────────┘  │
│            │                                                          │
└────────────┴──────────────────────────────────────────────────────────┘
```

### Step 2 · Field mapping

```
┌────────────────────────────────────────────────────────┐
│   STEP 2 · Map fields                                  │
│                                                        │
│   We detected: File In Time export (confidence: high)  │  ← AI detection
│                                                        │
│   Your column              → DueDateHQ field           │
│   ──────────────────────────────────────────           │
│   Client Name              → Name           ✓          │
│   Entity                   → Entity type    ✓          │
│   Primary State            → Primary state  ✓          │
│   Email                    → Contact email  ✓          │
│   Phone                    → Contact phone  ✓          │
│   Service Type             → Service Package ⚠ review │  ← low conf
│   Notes                    → Notes          ✓          │
│   Client ID (legacy)       → [Ignore]                  │  ← skip field
│                                                        │
│   [ ← Back ]                        [ Continue → ]     │
└────────────────────────────────────────────────────────┘
```

**Each row is a dropdown** — user can re-map or mark "Ignore". Low-confidence fields flagged for review. Can't advance until all required DueDateHQ fields (Name, Entity, State) are mapped.

### Step 3 · Preview

```
┌────────────────────────────────────────────────────────┐
│   STEP 3 · Preview (showing 10 of 87)                  │
│                                                        │
│   ✓ 84 ready · ⚠ 3 need attention                      │
│                                                        │
│   Name            Entity   State   Email         Pkg   │
│   ──────────────────────────────────────────────────── │
│   Acme LLC        S-Corp   LA      ac@acme.com   ✓     │
│   Bayou Corp      S-Corp   LA      bc@bayou.co   ✓     │
│   ⚠ ??? Holdings  ?        TX      —             —     │  ← needs fix
│   ⚠ Smith Trust   Trust    ??      s@trust.org   —     │
│   Jim Boudreaux   Indiv    LA      jb@jim.com    ✓     │
│   ...                                                  │
│                                                        │
│   [ Fix issues inline ]  [ Skip problematic rows ]     │
│                                                        │
│   [ ← Back ]                [ Commit import → ]        │
└────────────────────────────────────────────────────────┘
```

**Inline fix:** click ⚠ row → expand to form → correct missing fields → row turns ✓.
**Skip option:** non-fixable rows can be deferred; user sees them in a "Problems" tab post-import.

### Step 4 · Commit

```
┌────────────────────────────────────────────────────────┐
│   STEP 4 · Importing...                                │
│                                                        │
│   ████████████████░░░░   62%                           │  ← progress
│   54 of 87 clients imported                            │
│                                                        │
│   · Creating client records                            │
│   · Assigning Service Packages (AI)                    │
│   · Generating deadlines for 2026                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Step 4 complete

```
┌────────────────────────────────────────────────────────┐
│   ✓ Import complete                                    │
│                                                        │
│   84 clients imported                                  │
│   3 needing attention (see Problems)                   │
│   1,247 deadlines generated for 2026                   │
│                                                        │
│   [ Go to Dashboard → ]  [ Review problems (3) ]       │
└────────────────────────────────────────────────────────┘
```

**Failure states:**
- CSV malformed → error at Step 1 with specific line number
- All rows fail at Step 3 → "Something's off with this file. [Try different CSV] [Contact support]"
- Partial import interrupted → resumable via Settings › Imports

**Import history:** Settings › Imports shows every run with: date, source file, count imported, count failed, "Undo" option (available for 7 days).

---

*End of wireframes v0.1.*
