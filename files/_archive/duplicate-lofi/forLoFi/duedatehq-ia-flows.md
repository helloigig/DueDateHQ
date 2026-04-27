# DueDateHQ — Information Architecture & Key User Flows

> **v0.1 · Draft** · Apr 2026
> Companion to `duedatehq-prd.md` v0.3
> **Purpose:** screen inventory, navigation model, and the three key flows (triage / onboarding / state response)

---

## 1 · Information architecture

### 1.1 Sitemap — top-level

```
DueDateHQ
│
├── 🏠 Dashboard (home — daily triage)
│    └── Announcement banner (when active)
│
├── 👥 Clients
│    ├── Client list (table)
│    └── Client detail  [/clients/:id]
│         ├── Deadlines tab
│         ├── Contacts tab
│         ├── Notes tab
│         └── Activity log tab
│
├── 📡 State Intelligence
│    ├── Recent announcements (list)
│    ├── Announcement detail  [/announcements/:id]
│    │    ├── Parsed impact
│    │    ├── Affected clients
│    │    └── Batch actions
│    └── Change log (public-facing view)
│
├── 📅 Calendar (secondary view — iCal-style month grid)
│
└── ⚙️  Settings
     ├── Firm profile (name, logo, branding, primary states)
     ├── Team (users, roles, invites)          [Pro/Team only]
     ├── Service Packages (library + custom)
     ├── Reminder templates
     ├── Imports (history, re-run)
     ├── Billing & subscription
     └── Account (profile, password, notifications)
```

### 1.2 Why 4 top-level destinations, not more

Most practice-management tools have 8–12 top-level nav items (Karbon has inbox/tasks/clients/pipelines/time/docs/billing/reports). DueDateHQ has **4**: Dashboard, Clients, State Intelligence, Calendar. Settings is tucked behind a gear icon. This is a positioning signal — the user should feel how narrow and focused the product is within 10 seconds of opening it.

### 1.3 Information hierarchy

```
System-wide (shared across all firms)
├── Deadline database (federal + 50 states + DC + top-5 cities)
├── Service Package library (~30 pre-built)
└── State Announcements (parsed, historical backfill + live feed)

Firm-scoped
├── Firm record (settings, branding, states)
├── Users (Owner, Member)
├── Custom Service Packages (cloned/created)
├── Custom Services
├── Reminder templates (custom)
└── Clients
     ├── Contacts
     ├── Service Package assignments
     ├── Deadlines (instances of Service Templates)
     ├── Notes
     ├── Activity log
     └── Related clients (for K-1 chains)
```

### 1.4 Global elements (always visible)

- **Top bar:** logo | global search (⌘K) | quick-add (+ Client / Deadline) | announcement bell | user menu
- **Side nav:** 4 primary icons + labels (Dashboard / Clients / State Intelligence / Calendar)
- **Bottom:** Settings gear (separate from primary nav)

### 1.5 Screen inventory

| # | Screen | Route | Primary purpose |
|---|---|---|---|
| 1 | **Dashboard** | `/` | Weekly triage — the 3-min Monday ritual |
| 2 | **Client list** | `/clients` | Table of all clients, searchable, filterable |
| 3 | **Client detail** | `/clients/:id` | All deadlines + contact info for one client |
| 4 | **State Intelligence home** | `/announcements` | Recent announcements, affecting-me-first |
| 5 | **Announcement detail** | `/announcements/:id` | Parsed impact + affected clients + batch actions |
| 6 | **Calendar** | `/calendar` | Month/week grid view, all deadlines |
| 7 | **Service Package library** | `/settings/packages` | Browse + clone + customize |
| 8 | **Package detail / editor** | `/settings/packages/:id` | Edit services inside a package |
| 9 | **Import wizard** | `/import` | Upload CSV → map fields → preview → commit |
| 10 | **Team settings** | `/settings/team` | Invite, roles, assignments (Pro/Team) |
| 11 | **Firm settings** | `/settings/firm` | Branding, reminder defaults, primary states |
| 12 | **Billing** | `/settings/billing` | Subscription, invoices, seat count |
| 13 | **Onboarding flow** | `/onboarding/*` | 5-step first-run sequence |
| 14 | **Empty-state dashboards** | `/` (no clients yet) | "Import clients" or "Try demo data" CTAs |
| 15 | **Global search results** | overlay (⌘K) | Clients + deadlines + announcements |

### 1.6 Modals & overlays (not full screens)

- Quick-add client
- Quick deadline status change (Complete / Defer / Note / Extension filed)
- Service Package assignment picker
- Bulk deadline-adjust confirmation (from announcement)
- Export (PDF / CSV / iCal chooser)
- Invite teammate
- Reminder-now override (send reminder immediately rather than scheduled)

---

## 2 · Navigation model

### 2.1 Primary nav — persistent left sidebar

Fixed for desktop. Collapses to bottom tab bar on mobile.

```
┌────────────────────┐
│  DueDateHQ         │
├────────────────────┤
│  🏠  Dashboard     │  ← default landing
│  👥  Clients       │
│  📡  State Intel   │  ← badge shows unread count
│  📅  Calendar      │
├────────────────────┤
│  ⚙️   Settings      │
│  👤  Account       │
└────────────────────┘
```

### 2.2 Context nav (breadcrumbs + back)

Within each section, a breadcrumb shows lineage:
- `Clients › Acme Corp › Deadlines`
- `State Intel › LA-2026-09-15-Hurricane › Affected clients`

Back button goes to the previous list view, preserving filter state.

### 2.3 Global search (⌘K / Ctrl+K)

Command-palette style. Searches:
- Clients (by name, contact email)
- Deadlines (by form type, client, date range)
- Announcements (by state, date, keyword)

Top result opens directly on Enter.

### 2.4 Quick actions (+ button, top bar)

Dropdown:
- New client (opens modal, ~2 min form)
- New deadline (for a selected client)
- Import from CSV (→ `/import`)

### 2.5 Announcement bell (top bar)

- Red dot when unread announcements affect user's clients
- Click → dropdown of last 5 announcements → full list link
- Click announcement → Announcement detail screen

---

## 3 · Key user flows

### 3.1 Flow A · Weekly Triage (Story 1 — daily loop)

**Entry:** user opens app Monday morning (browser bookmark / email link / direct URL).

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Login  →  auto-redirects to Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│ 2. Dashboard renders (< 1.5s)                                   │
│    ├─ TOP: Announcement banner (if any unread affecting clients)│
│    ├─ HERO: "This week" — day-level countdown, sorted by date   │
│    ├─ SECONDARY: "This month" — week-grouped                    │
│    └─ FOOTER: "Long term" — quarter-grouped, collapsed by default│
├─────────────────────────────────────────────────────────────────┤
│ 3. User scans "This week" — ~8 items typical                    │
├─────────────────────────────────────────────────────────────────┤
│ 4. OPTIONAL: apply filter (client / state / form type)          │
│    → list re-renders < 1s                                       │
├─────────────────────────────────────────────────────────────────┤
│ 5. Click deadline row → quick-action modal                      │
│    ┌────────────────────────────────────┐                       │
│    │ Acme Corp · Form 1120-S · Mar 15   │                       │
│    │ ──────────────────────────────────  │                       │
│    │  ○ Mark complete                    │                       │
│    │  ○ Mark in progress                 │                       │
│    │  ○ Defer to date: [picker]          │                       │
│    │  ○ Filed extension (opens extension │                       │
│    │    deadline auto-created)           │                       │
│    │  ○ Add note (free text)             │                       │
│    │  [View client detail →]             │                       │
│    └────────────────────────────────────┘                       │
├─────────────────────────────────────────────────────────────────┤
│ 6. Status applied → row moves/updates in list                   │
├─────────────────────────────────────────────────────────────────┤
│ 7. Repeat 5–6 until "This week" is triaged                      │
├─────────────────────────────────────────────────────────────────┤
│ 8. Close tab. Total: 3–5 min.                                   │
└─────────────────────────────────────────────────────────────────┘
```

**Decision points & edge cases:**
- Dashboard is empty (no clients yet) → onboarding CTA screen
- No deadlines this week → "All clear. Next deadline: [date]" message
- Announcement banner present → see Flow C
- User is on mobile → same layout but stacked; quick-action modal is bottom sheet

**Exit states:**
- Most common: close tab (success)
- To State Intel: click announcement banner
- To Client detail: click client name inside a deadline row
- To Calendar: click "view in calendar" icon

---

### 3.2 Flow B · First-time onboarding (Story 2 — one-time loop)

**Entry:** user signs up from marketing site or cold conversion.

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SIGNUP  (/signup)                                            │
│    Fields: email, password, firm name                           │
│    No credit card. Trial starts now (30 days).                  │
│    → Email verification sent                                    │
├─────────────────────────────────────────────────────────────────┤
│ 2. EMAIL VERIFIED  → /onboarding/firm                           │
│    Firm setup (< 2 min):                                        │
│    - Firm name ✓ (pre-filled from signup)                       │
│    - Primary states served (multi-select, min 1)                │
│    - Firm size: Solo / 2-3 / 4-10                               │
│    - Your role: Owner (locked for first user)                   │
├─────────────────────────────────────────────────────────────────┤
│ 3. /onboarding/clients — HOW DO YOU WANT TO START?              │
│    Three choices (large cards):                                 │
│                                                                  │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐                  │
│    │ 📁        │  │ ✏️         │  │ 🎭        │                  │
│    │ Import    │  │ Add 5      │  │ Try demo  │                  │
│    │ CSV       │  │ clients    │  │ data      │                  │
│    │ (10 min)  │  │ manually   │  │ (1 min)   │                  │
│    │           │  │ (5 min)    │  │           │                  │
│    └───────────┘  └───────────┘  └───────────┘                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 4a. PATH: IMPORT CSV  (/onboarding/import)                      │
│     ┌─────────────────────────────────────────┐                 │
│     │ Step 1: Upload                          │                 │
│     │  - Drag-drop or file picker              │                 │
│     │  - "What's supported?" link shows:      │                 │
│     │    File In Time, TaxDome, Drake,        │                 │
│     │    ProConnect, QuickBooks, plain Excel  │                 │
│     ├─────────────────────────────────────────┤                 │
│     │ Step 2: AI field mapping                │                 │
│     │  - LLM detects source format            │                 │
│     │  - Shows detected mapping               │                 │
│     │  - User can override any column mapping │                 │
│     │  - "Confidence: High/Medium/Low" badge  │                 │
│     ├─────────────────────────────────────────┤                 │
│     │ Step 3: Preview                         │                 │
│     │  - Shows first 10 clients as they'd be  │                 │
│     │    saved                                │                 │
│     │  - Flag issues: unknown state, missing  │                 │
│     │    email, ambiguous entity type         │                 │
│     │  - User confirms / fixes inline         │                 │
│     ├─────────────────────────────────────────┤                 │
│     │ Step 4: Commit                          │                 │
│     │  - Progress bar (30s for 100 clients)   │                 │
│     │  - On complete: "Imported 87 of 90.     │                 │
│     │    Review 3 that need attention."       │                 │
│     └─────────────────────────────────────────┘                 │
├─────────────────────────────────────────────────────────────────┤
│ 5. /onboarding/packages — ASSIGN SERVICE PACKAGES               │
│    - System shows all imported clients                          │
│    - For each: AI suggests a Service Package based on           │
│      entity_type + primary_state                                │
│    - User confirms (single click) or picks different package    │
│    - Bulk action: "Apply S-Corp Standard to all S-Corps"        │
├─────────────────────────────────────────────────────────────────┤
│ 6. FIRST TRIAGE VIEW  (/dashboard)                              │
│    - System has now generated all deadlines                     │
│    - Dashboard renders with "This week" populated               │
│    - One-time overlay: "Here's your week. Click any row to      │
│      update status. Your next big deadline is March 15."        │
│    - Dismiss overlay → normal Flow A begins                     │
└─────────────────────────────────────────────────────────────────┘
```

**Decision points:**
- CSV import fails (unsupported format, corrupt file) → error + fallback to manual add
- AI confidence on field mapping < 70% → force user review, don't auto-commit
- User skips onboarding entirely → empty dashboard + persistent "Complete setup" banner
- Demo data path → pre-populated 8 fake clients + sample announcement; can be wiped anytime

**Total time target: ≤ 30 min end-to-end for 30-client import.**

---

### 3.3 Flow C · State Announcement Response (Story 3 — the spine)

**Entry:** state DOR publishes announcement → system detects within 24h → user sees banner/email.

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (async, no user involvement)                            │
├─────────────────────────────────────────────────────────────────┤
│ 1. Scraper detects new announcement from LA DOR RSS             │
│ 2. LLM parses: state, counties, entity_types, tax_types,        │
│    old_date, new_date, announcement_type                        │
│ 3. Confidence score:                                            │
│    - High → auto-publish                                        │
│    - Low  → human review queue → reviewer publishes             │
│ 4. System queries each firm's client portfolio for matches      │
│ 5. For firms with matches > 0:                                  │
│    - Creates Announcement record linked to affected clients     │
│    - Sends email to firm owner (+ assignees, configurable)      │
│    - Sets banner flag on firm's dashboard                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER EXPERIENCE                                                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. User sees one of three entry signals:                        │
│    a. Email in inbox ("6 clients affected by LA Hurricane ext") │
│    b. Bell badge (top bar) on next app visit                    │
│    c. Red banner atop Dashboard                                 │
├─────────────────────────────────────────────────────────────────┤
│ 2. User clicks through → /announcements/:id                     │
├─────────────────────────────────────────────────────────────────┤
│ 3. ANNOUNCEMENT DETAIL SCREEN                                   │
│    ┌──────────────────────────────────────────────────────────┐ │
│    │ Louisiana Dept of Revenue · Hurricane Delta Extension   │ │
│    │ Published Sep 15, 2026 · Detected Sep 15, 14:22 UTC     │ │
│    │ [ View official source ↗ ]                               │ │
│    ├──────────────────────────────────────────────────────────┤ │
│    │ PARSED IMPACT (LLM)                                     │ │
│    │ · Affects: Orleans, Jefferson, St. Bernard counties     │ │
│    │ · Entity types: LLC, S-Corp, Individual                 │ │
│    │ · Tax types: State income tax, PTE, quarterly estimates │ │
│    │ · New deadline: Feb 15, 2027 (was Oct 15, 2026)         │ │
│    │ · Confidence: High · ⚠️ Verify against source link above│ │
│    ├──────────────────────────────────────────────────────────┤ │
│    │ AFFECTED CLIENTS (6)                                    │ │
│    │ ┌─────────────────────────────────────────────────────┐ │ │
│    │ │ ☑ Acme LLC      · New Orleans  · 1065 + state      │ │ │
│    │ │ ☑ Bayou Corp    · Metairie     · 1120-S + state    │ │ │
│    │ │ ☑ Jim Boudreaux · Chalmette    · 1040 + state      │ │ │
│    │ │ ☑ ... (3 more)                                     │ │ │
│    │ └─────────────────────────────────────────────────────┘ │ │
│    ├──────────────────────────────────────────────────────────┤ │
│    │ ACTIONS                                                 │ │
│    │ [ Batch-adjust deadlines ]  [ Notify clients ]          │ │
│    │ [ Review one-by-one ]       [ Dismiss (not applicable) ]│ │
│    └──────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ 4. USER CHOOSES ACTION                                          │
├─────────────────────────────────────────────────────────────────┤
│ 4a. BATCH-ADJUST (most common, ~60% of cases)                   │
│     - Confirm modal: "Move 6 deadlines from Oct 15 → Feb 15?"   │
│     - User confirms → all deadlines updated + activity logged   │
│     - Success toast → back to announcement detail               │
├─────────────────────────────────────────────────────────────────┤
│ 4b. NOTIFY CLIENTS                                              │
│     - Preview email template (editable)                         │
│     - Send to 6 primary contacts                                │
│     - Reply-to = CPA's email                                    │
├─────────────────────────────────────────────────────────────────┤
│ 4c. REVIEW ONE-BY-ONE                                           │
│     - Paginate through each affected client's deadline detail   │
│     - Per client: accept adjustment / override / skip           │
├─────────────────────────────────────────────────────────────────┤
│ 4d. DISMISS                                                     │
│     - Mark announcement as "not applicable to my clients"       │
│     - Requires confirmation (with reason, optional)             │
│     - Announcement stays in history but no banner pressure      │
└─────────────────────────────────────────────────────────────────┘
```

**Decision points & edge cases:**
- Zero affected clients for this firm → announcement does NOT trigger banner/email (silence is signal)
- LLM parsing confidence low → announcement routed to review queue first, user sees it only after human verification
- User dismisses → future announcements from same state/authority still show
- Batch adjust conflicts with manually-set deadline (user had already moved it) → flag for manual review

---

### 3.4 Sub-flows (secondary but common)

#### 3.4.1 Add new client (quick)

```
[+] menu → "New client"
  → Modal opens (not full page)
    ├─ Name *
    ├─ Entity type * (select)
    ├─ Primary state * (select)
    ├─ Nexus states (multi-select, optional)
    ├─ Primary contact email
    ├─ Primary contact phone (optional)
    └─ Service Package * (AI-suggested based on entity + state; user confirms)
  → Save → Client record created + deadlines auto-generated
  → Toast: "Acme Corp added. 12 deadlines generated for 2026."
  → Stay on current screen (no forced navigation)
```

**Target:** < 2 min per client.

#### 3.4.2 Export deadlines for a client

```
Client detail → Export button → Modal with format choice:
  - PDF (client-facing report)
  - CSV (raw data)
  - iCal (.ics subscription URL — copy link or download file)
→ File downloads OR URL copied to clipboard
```

#### 3.4.3 Invite team member (Pro/Team)

```
Settings › Team › Invite button
  → Modal: email + role (Owner / Member)
  → Send invite → pending state shown in team list
  → Invitee receives email with signup link
  → On accept: joins firm; gets access to all clients (member role)
```

#### 3.4.4 Create custom Service Package

```
Settings › Service Packages › "+ New package" OR "Clone this package"
  → Package editor
    - Name, description
    - Applicable entity types, states
    - Add services (from catalog or custom)
    - Set dependencies between services
    - Set reminder schedules
  → Save → Available in package picker firm-wide
```

#### 3.4.5 Configure reminder template

```
Settings › Reminder templates
  → List of templates (one per Service Package, or generic)
  → Edit template:
    - Subject line
    - Body (with variables: {{client_name}}, {{deadline}}, {{days_until}})
    - Timing: T-30 / T-14 / T-7 / T-1 (toggles)
    - Send time of day
    - From address (custom domain for Team tier)
  → Save → applies to all future reminders
```

---

## 4 · State transitions

### 4.1 Deadline status state machine

```
    ┌──────────────┐
    │ Not started  │ ──────┐
    └──────┬───────┘       │
           │               │
           ▼               ▼
    ┌──────────────┐   ┌──────────────┐
    │ In progress  │──▶│   Deferred   │
    └──────┬───────┘   └──────┬───────┘
           │                  │
           │                  │
           ▼                  ▼
    ┌──────────────┐   ┌──────────────────┐
    │  Completed   │   │ Filed extension  │──┐
    └──────────────┘   └──────────────────┘  │
                                              │
                              ┌───────────────┘
                              │
                              ▼
                       (new deadline object
                        created for extended date,
                        status = Not started)


  Any status → Overdue (auto, when past official due date
                        without Completed or Filed extension)
```

### 4.2 Client status state machine

```
  Prospect ──▶ Active ◀──▶ Inactive ──▶ Archived (7-year retention)
                                            │
                                            └──▶ Hard delete (manual, admin only)
```

---

## 5 · Empty & edge states

| Condition | Screen behavior |
|---|---|
| No clients yet | Dashboard shows import CTA + demo data option |
| No deadlines this week | "All clear. Next deadline: [Client · Form · Date]" |
| All filters applied yielding zero | "No matching deadlines. Clear filters?" |
| Announcement detected but no affected clients | No banner, no email, stored in State Intel history only |
| CSV import low confidence | Force manual field mapping review, block auto-commit |
| Trial expired (day 31+) | Read-only mode + conversion banner |
| Team member removed | Their client assignments revert to firm owner |
| Service Package has 0 services (edit in progress) | Block save with error |
| Client deleted while deadline exists | Soft-delete; deadlines archive with client |

---

## 6 · Accessibility & responsive notes

- **Keyboard:** all row actions operable via keyboard; `⌘K` search; `/` focuses filter
- **Mobile breakpoint (< 768px):**
  - Sidebar collapses to bottom tab bar (4 icons)
  - Dashboard three-tier becomes stacked single column
  - Quick-action modals become full-screen bottom sheets
  - Data tables become card-list views
- **Contrast:** WCAG AA minimum on all text; deadline urgency indicators (red/amber/green) paired with icons — not color alone

---

## 7 · Open IA/flow questions

Not yet resolved; flagged for design review:

1. **Bulk selection** on dashboard — multi-select deadlines for bulk status change? (Lean: yes for Pro+, not MVP)
2. **Global inbox** for all reminders sent → replies? (Lean: no, stays in CPA's own email)
3. **Dashboard customization** — can users reorder/hide the three tiers? (Lean: no MVP, yes Phase 2)
4. **Announcement digest** — daily email roundup vs per-announcement emails? (Lean: per-announcement for urgency; daily digest as opt-in)
5. **Calendar view density** — one deadline per day cell or list-per-day? (Design call)
6. **Client detail tab order** — Deadlines default, but does Contact or Notes come second? (Lean: Deadlines, Notes, Contacts, Activity)

---

*End of IA & flows v0.1.*
