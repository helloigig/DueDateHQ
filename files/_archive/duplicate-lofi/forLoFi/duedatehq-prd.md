# DueDateHQ — Product Requirements Document (PRD)

> **v0.2 · Draft for review** · Apr 2026
> **Authors:** Product team
> **Readers:** Product · Engineering · Design
> **Status:** Pre-build scoping. Targeted at MVP (Phase 1, 0–6 months).

---

## 0 · TL;DR

DueDateHQ is a **cloud-native tax-deadline intelligence layer** for solo CPAs and small firms (2–5 people). It's not a practice-management platform and it's not a client portal — it's the specialist tool that sits alongside whatever stack a CPA already uses and answers one question every Monday morning: *"What do I owe which client this week, and did anything change over the weekend?"*

The product thesis splits into two loops:

1. **Daily loop (Story 1, the *shell*):** A 30-second weekly triage dashboard grouped by time — this week / this month / long term.
2. **Rare-but-defining loop (Story 3, the *spine*):** A 24-hour SLA on state tax authority announcements, with automatic matching of affected clients in the user's portfolio.

Everything else in this PRD is in service of those two loops. Anything that isn't — billing, time tracking, document management, client portals — is **explicitly out of scope**. That's the positioning.

---

## 1 · Product thesis and positioning

### 1.1 One-sentence promise

> Independent CPAs never worry about missing any state tax deadline — and when a state announcement drops, they see their list of affected clients within 24 hours, not by reading news.

### 1.2 Framings to avoid

- ❌ "A lightweight, cloud-based tax deadline tracker" — generic, commoditized
- ❌ "Karbon alternative for solos" — implies all-in-one; we're not
- ❌ "AI-powered practice management" — wrong category
- ✅ "The state-deadline intelligence layer for CPAs"

### 1.3 Competitive positioning

| Axis | Where DueDateHQ lives |
|---|---|
| Price | $29 Solo · $49 Pro · $99 Team — below the $60 cloud-PM floor |
| Surface | Deadline-first, not workflow-first |
| Scope | Intentionally narrow — a *layer*, not a *platform* |
| Moat | Proprietary state-announcement data + 24h SLA |

We do not win on client portal (TaxDome wins), integrations breadth (Karbon wins), or tax resolution depth (Canopy wins). We win on state-deadline intelligence, a gap none of them is architected to build.

---

## 2 · Target users

### 2.1 Primary — Solo CPA

Owns their own practice. 20–100 clients, mix of individuals and small-business entities. Works across 2–10 states. Currently uses Excel + Outlook as baseline; may have File In Time desktop. Won't pay $5K+/yr for Karbon/Canopy.

### 2.2 Secondary — Small firm (2–5 CPAs)

Ortiz & Associates archetype. 100–300 clients. Needs cross-team visibility: handoffs when a partner is on vacation, shared client state. One partner picks the software; others just use it.

### 2.3 Not the user

Big 4 / mid-tier national firm staff; corporate in-house accountants; pure bookkeepers; firms > 10 people.

---

## 3 · Scope decisions (answering 23 design-review questions)

### 3.1 Target user → Solo CPA primary, small firm secondary

See §2. One primary persona drives the triage UX; small-firm flows are additive.

### 3.2 Team or individual? → Both, individual-first

Solo tier is single-user. Pro (1–3 seats) and Team (≤10) are multi-user from MVP. Core UX is designed for an individual; team features *add* to that, they don't reshape it.

### 3.3 Service groups → Yes, "Service Packages"

A **Service Package** is a named bundle of tax services applied to a client. Examples:

- *S-Corp Standard:* 1120-S + state equivalent + K-1 distribution + quarterly estimates
- *Individual with S-Corp:* 1040 + state 1040 + estimated taxes + K-1 receipt
- *Multi-state LLC:* 1065 + federal + 3 state filings + PTE elections

MVP ships with ~30 pre-built packages. Users assign in one click; deadlines auto-generate. Users can clone and customize any package.

**Why:** this is what makes onboarding ≤30 min. Without packages, users hand-pick 8–15 deadlines per client.

### 3.4 Export formats → PDF, CSV, iCal

| Format | Purpose | Tier |
|---|---|---|
| **PDF** | Client-facing deadline reports | All |
| **CSV** | Data portability, "no lock-in" promise | All |
| **iCal (.ics)** | Subscribe from Outlook / Google / Apple Calendar | All |
| **API** | Phase 4, Team tier only | Deferred |

### 3.5 Import formats → CSV from TaxDome, Drake, ProConnect, QuickBooks, File In Time, plain Excel

Six formats at MVP. AI-powered smart field mapping (entity-type recognition, state parsing, service detection) is the ✦ lever. File In Time migration is prioritized — most-direct competitor with stable CSV schema.

### 3.6 Client data model → Light, not full CRM

A **Client record** contains:

- Name, entity type (LLC / S-Corp / C-Corp / Sole Prop / Partnership / Individual / Trust / Non-profit)
- Primary state + additional nexus states
- Contact info (email, phone) — one primary contact per client
- Assigned Service Package(s)
- Status: Active · Inactive · Prospect · **Archived** (retained 7 years for historical queries; excluded from tier counts)
- Notes field (free text)
- Activity log (system-generated events only)

**Households (MFJ):** one client record, entity type = "Individual (MFJ)", two contacts, one 1040 deadline. No separate "household" object.

**We do NOT build:** CRM-style activity tracking of CPA's work, email threads, document vault, engagement letters, communication history.

### 3.7 Date types → Four

| Date type | What it is | Who sees it |
|---|---|---|
| **Official due date** | The legal deadline (e.g., Apr 15 for 1040) | Everyone |
| **Internal target date** | CPA's own working deadline — usually N days earlier | CPA only |
| **Client prep date** | When the client needs to have delivered docs | CPA + client |
| **Reminder dates** | When DueDateHQ notifies — configurable (T-30, T-14, T-7, T-1) | CPA + client |

**Weekend/holiday handling:** when the official due date falls on a weekend or federal holiday, auto-adjust to the next business day (mirrors IRS rule). UI shows "adjusted from [original date]" indicator.

**Payment vs filing:** single deadline object holds both `file_by` and `pay_by` dates; UI surfaces whichever is sooner. Rare in practice but matters for estimated taxes.

Extension filings and post-extension deadlines (e.g., Oct 15 for extended 1040) are separate deadline objects, not fields on the original.

### 3.8 Rollover → Yes, core

Recurring deadlines (annual returns, quarterly estimates, monthly payroll) auto-rollover to the next period on completion. Configurable rollover rules per service template. Non-recurring items don't rollover.

### 3.9 Default services vs custom → Both

MVP ships with the 50-state tax deadline database: every federal form + every state's equivalents + top 5 city taxes (NYC UBT, SF GRT, Portland Metro, Philadelphia BIRT, Chicago PPT). Users get these automatically via Service Packages. Users can create **Custom Services** for other local taxes, industry-specific filings, or one-offs. Custom services are firm-scoped.

### 3.10 Team roles → Two at MVP

- **Owner** — full access; manages users and billing
- **Member** — full data access; cannot manage users or billing

Client/deadline **assignment** is separate from permissions: any member can be assigned as responsible party.

**Concurrent edits:** last-write-wins with activity log (optimistic concurrency).

**Phase 2:** Admin role, Viewer role, client-level access restrictions.

### 3.11 Connected tax documents → Yes, via Service Package dependencies

Some deadlines depend on others:

- **Dependency within a client:** 1065 partnership return → K-1 production → state K-1 equivalents
- **Dependency across clients:** If Client A's 1065 completes, and Clients B/C/D are linked as partners, their K-1-receipt deadlines auto-activate.

**Partner-as-client modeling:** each Client record has an optional `related_clients[]` field linking entity owners to their own individual records. When a 1065/1120-S completes, system checks related clients and activates K-1 deadlines automatically.

MVP ships dependency chains within pre-built packages only (1065→K-1→1040, 1120-S→K-1→1040). User-defined dependency authoring ships in Phase 2.

### 3.12 Exports importance → Critical for trust

"You can leave any time" is how we counter the lock-in objection every CPA has after being burned by TaxDome's annual upfront. **Export parity with import**: anything importable is exportable in the same shape.

### 3.13 Platform surfaces → Cloud web first, mobile web second, native apps Phase 2

| Surface | Phase 1 | Phase 2 |
|---|---|---|
| Desktop web | ✅ Primary | Continues |
| Mobile web (responsive) | ✅ Read-optimized | Full parity |
| Native iOS / Android | ⛔ | ✅ |
| Native desktop | Never — that's File In Time's trap |

Mobile use case is **triage, not data entry**.

### 3.14 Hour tracking → NO, by design

Out of scope. Clearest "we are not Karbon/TaxDome/Canopy" signal. Time tracking pulls toward billing → invoicing → portal → documents → and we become a bad TaxDome.

### 3.15 Reduce client chasing → Automated email reminders

- Configurable schedule per service (T-30, T-14, T-7 before client prep date)
- Sent from `firm@duedatehq.com` or user's custom domain (Team tier)
- Branded with firm name/logo (Pro+)
- Reply-to = CPA's own email; replies go to them (we don't see, don't thread)
- Includes what's-needed checklist, not just "deadline coming"
- **Time zone:** client's primary state TZ; fallback to firm's primary state
- **Compliance:** unsubscribe link in every email, firm postal address in footer (CAN-SPAM)
- Bounce handling: 3 consecutive bounces → flag contact email as invalid, notify CPA

We do NOT build a client portal for document upload. Clients reply to reminders with docs attached; CPAs handle in their own inbox.

### 3.16 Existing + new clients → Both flows

- **Bulk import** for existing clients (CSV, day one)
- **Quick add** for new clients (< 2 min, form-based, AI pre-fills likely deadlines based on entity type + state)
- **Duplicate template** for onboarding many similar clients

### 3.17 Onboarding → < 30 minutes to first triage view

1. Sign up (< 1 min) — email + password, no credit card
2. Firm setup (< 2 min) — name, primary states served
3. Import clients (< 10 min) — CSV with AI mapping, OR paste 5 to start
4. Service package assignment (< 5 min) — AI suggests based on entity + state; user confirms
5. **First triage view** — see your week

### 3.18 Billing → NO

Out of scope. Forever. Same reasoning as §3.14.

### 3.19 Grouping → Time primary, client secondary, state/task as filters

This deserves a real defense.

**Primary grouping is TIME, not client.** The job-to-be-done at 9am Monday is *"what do I need to do this week?"* — not "tell me about every client." A 80-client × 5-service × 4-deadline portfolio = 1,600 deadline instances. Time-grouping collapses that into a short actionable list.

**Secondary grouping is CLIENT.** When drilling in from triage, next unit of thinking is "what does this client need?" — client detail page shows all their upcoming deadlines.

**State and task type are filters/slicers, not primary groupings.** Solo CPAs think in clients (they know names). They think in "California" only when a state event happens — which is Story 3, a separate surface.

| Surface | Primary grouping | Secondary |
|---|---|---|
| Triage dashboard (daily) | Time | Client (expand) |
| Client detail | Client (one) | Time |
| State intelligence (Story 3) | State event → affected clients | Client |
| Team workload (Team tier) | Assignee | Time |

### 3.20 Client portal → NO

TaxDome owns this. Automated email reminders (§3.15) cover 80% of portal value at 5% of scope cost.

### 3.21 Document management → NO, intentional weakness

"Weak (PDF/CSV only) — by design." Positioning choice. Users keep tax documents in their existing tool.

### 3.22 Store documents → NO

Never. Trust-and-scope decision.

### 3.23 Pre-built pipeline → Yes, via Service Packages (§3.3)

Service Packages ARE the pipeline. We don't build a separate pipeline engine.

---

## 4 · MVP feature list (Phase 1, 0–6 months)

### P0 · Must-have for launch

1. Account & auth (email/password, reset, session)
2. Client management (add/edit/archive, bulk CSV import, search, filters)
3. 50-state deadline database (federal + 50 states + top 5 city taxes)
4. Service Packages (~30 pre-built + clone/customize)
5. Weekly triage dashboard (three-tier time grouping, filter, status toggle)
6. Client detail view (all deadlines per client, history)
7. Deadline statuses: Not started · In progress · Completed · Deferred · Filed extension · **Overdue** (auto-applied when past due date without completion)
8. Rollover engine (recurring deadlines auto-regenerate)
9. Weekend/holiday auto-adjust
10. AI-powered CSV import (field mapping, entity recognition)
11. Automated client reminders (email, configurable, branded)
12. Exports: PDF, CSV, iCal
13. Mobile-responsive web (read-optimized)
14. Multi-user (Pro/Team): invite, assign clients, Owner/Member roles

### P1 · Story 3 differentiator (ship alongside or immediately after)

15. **State announcement monitoring** — auto-scrape 50+ state DORs + DC + Secretaries of State. Announcement types monitored in MVP:
    - Disaster extensions
    - Penalty relief
    - PTE election deadline changes
    - New filing requirements / form changes
    - Tax rate changes
    - Nexus rule changes
    - *(Rulings / guidance documents: Phase 2)*
16. **LLM interpretation pipeline** (Gemini or Grok — benchmark Week 1) — parse announcement → structured impact. Confidence-scored; low-confidence items routed to human review queue, high-confidence auto-publish.
17. **Affected-client matching** (state × county × entity × tax)
18. **Dashboard announcement banner**
19. **Email notification** of announcements with affected client list
20. **One-click batch deadline adjustment**
21. **Official source link** on every announcement
22. **Historical backfill** — 2+ years of announcements at launch, published publicly at `duedatehq.com/changes` (SEO + data moat)

### P2 · Polish

22. Smart priority ranking (AI): penalty × importance × delay history
23. Natural-language query (AI): "Which clients need PTE this quarter?"
24. Custom services (user-defined)
25. Pre-built package dependencies (1065→K-1→1040 chain)
26. Partner-as-client linking UI

### Out of scope for MVP (explicit)

Client portal · document management · billing · time tracking · native mobile apps · open API · native integrations with tax prep software · e-signature · tax resolution tools · bookkeeping.

---

## 5 · Data model

```
User
  ├── id, email, password_hash, role (Owner / Member)
  └── belongs to → Firm

Firm
  ├── id, name, primary_states[], logo, branding, postal_address
  └── has many → Users, Clients, ServicePackages (custom), CustomServices

Client
  ├── id, name, entity_type, primary_state, nexus_states[]
  ├── contact_email, contact_phone, notes
  ├── status (active / inactive / prospect / archived)
  ├── archived_at (nullable)
  ├── assigned_service_packages[]
  ├── related_clients[] → Client  (for K-1 chains across clients)
  └── has many → Deadlines

ServicePackage
  ├── id, name, description, is_system (bool)
  ├── applicable_entity_types[], applicable_states[]
  └── has many → ServiceTemplates

ServiceTemplate  (inside a package)
  ├── id, form_name, jurisdiction (fed/state/city code)
  ├── due_date_rule, rollover_rule
  ├── reminder_schedule[]
  └── dependencies[] → other ServiceTemplates

Deadline  (instance of a ServiceTemplate for a Client)
  ├── id, client_id, service_template_id
  ├── official_due_date, adjusted_due_date (weekend/holiday shift)
  ├── internal_target_date, client_prep_date
  ├── file_by_date, pay_by_date  (often same; different for estimated taxes)
  ├── status, assigned_user_id
  ├── completed_at, notes
  └── has many → Reminders

StateAnnouncement  (Story 3)
  ├── id, state_code, authority, announcement_date
  ├── raw_text, parsed_impact (JSON), source_url
  ├── affected_entity_types[], affected_counties[], affected_taxes[]
  └── has many → AffectedClients (materialized view)
```

---

## 6 · Key user flows

### 6.1 Weekly triage (Story 1)

```
Open app → Dashboard loads (This week / This month / Long term)
  → Top banner: new state announcements since last visit?
  → Scan "This week" — 8 items, sorted by date
  → Click deadline → quick-action (Complete / Defer / Note)
  → Filter by client or state (< 1 sec)
  → Close. Total: 3–5 min.
```

### 6.2 State announcement response (Story 3)

```
Louisiana DOR announces Hurricane extension → system scrapes within 24h
  → LLM parses: entities, counties, tax types, new date
  → Query user's portfolio for matches
  → If matches > 0: email + in-app banner
  → User clicks "View affected clients" — sees 6 clients
  → Clicks "Batch adjust deadlines" — all 6 move to new date
  → Optional: send reminder emails
  → Every step links to official source for manual verification
```

### 6.3 Onboarding — see §3.17

---

## 7 · Non-functional requirements

### 7.1 Performance

- Dashboard first paint < 1.5s on 4G
- Filter application < 1s
- CSV import of 100 clients < 30s
- State announcement detection within 24h of publication (commercial SLA)

### 7.2 Accuracy

- Federal deadline database: 100% accuracy required
- State deadline database: 99%+ accuracy required
- Every deadline links to official source URL
- **Accuracy SLA commitment:** if we miss a state extension within 24h of official announcement and a user incurs a penalty, the month's subscription is credited. (Legal review required before public use — see open questions.)

### 7.3 Security & compliance

- TLS 1.3 all traffic
- Passwords hashed with argon2id
- SOC 2 Type II — Phase 2 target
- SSO — Phase 2 (Team tier only)
- No storage of SSN, EIN, or sensitive tax identifiers beyond client naming
- CAN-SPAM compliance on all reminder emails
- US data residency at MVP; Canadian/UK Phase 2+

### 7.4 Reliability

- 99.9% uptime target
- Daily backups, 30-day retention (operational) + 7-year retention for archived client records (tax compliance)
- Graceful degradation if announcement-monitoring pipeline fails (async; core product still works)

### 7.5 Support model

- Email support (all tiers)
- In-app chat — Phase 2
- Phone support — Team tier only, Phase 2
- Self-service knowledge base from launch

---

## 8 · Success metrics

### Activation (first 30 days)

- Signup → onboarding completion → **70%**
- Time to first triage view → **median < 30 min**
- Pro trial → imports ≥ 10 clients → **60%**

### Engagement (weekly)

- WAU during busy season → **85%**
- Median triage session → **3–5 min** (vs ~45 min competitor baseline)

### Retention

- 3-month → **80%**
- 12-month → **70%**
- Annual churn → **8–12%**

### Story 3 impact

- Announcements detected within 24h → **95%**
- Announcement → user notification → **< 6 hours**
- User acts on announcement (click through → adjust) → **40%**

---

## 9 · Pricing

| Tier | Monthly | Annual (−20%) | Capacity |
|---|---|---|---|
| **Solo** | $29 | $278/yr | 1 user · ≤ 50 clients |
| **Pro** *(primary)* | $49 | $470/yr | 1–3 users · unlimited clients |
| **Team** | $99 | $950/yr | ≤ 10 users · API (Phase 4) |

Monthly billing is the default — no annual lock-in required. Counter to TaxDome's annual-upfront model.

### Trial & lifecycle mechanics

- **Trial:** 30 days, no credit card required
- **Day 31 (no payment):** read-only grace period, 14 days; banner prompts conversion
- **Day 45 (still no payment):** soft-suspend; data retained 90 days; account can be restored by paying
- **Day 135:** hard-delete following export-link email warning
- **Seat overages** (e.g., 4th user on Pro): blocked at invite step with upgrade prompt — no surprise charges
- **Downgrades:** allowed mid-cycle with proration; no data loss below tier limits
- **Upgrades:** immediate, prorated

Pricing decisions deferred to open-questions doc: freemium yes/no.

---

## 10 · Appendix

### Related documents

- `duedatehq-open-questions.md` — decisions not yet made
- `01-product-brief.md` — consolidated CEO brief + business plan
- `DueDateHQ___用户故事与价值主张画布.html` — user stories + VPC
- `competitive-analysis.html` — competitive report + feature matrix
- `pricing-landscape.md` — pricing deep-dive

### Glossary

- **1040 / 1065 / 1120-S / 1120** — individual / partnership / S-corp / C-corp federal returns
- **PTE** — Pass-Through Entity election (state-level SALT cap workaround)
- **Nexus** — sufficient state presence to owe tax there
- **Disaster extension** — IRS/state-granted extension for federally declared disaster areas
- **EA** — Enrolled Agent (treated as solo CPA for this product)
- **K-1** — partner/shareholder income statement flowing from 1065/1120-S to personal 1040

### Change log

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-04-23 | Initial PRD |
| v0.2 | 2026-04-23 | Absorbed decidable items from open-questions (weekend/holiday, statuses, archiving, households, partner-as-client, reminder TZ/CAN-SPAM, trial lifecycle, support model, concurrency) |
| v0.3 | 2026-04-23 | Story 3 scope locked: source scope confirmed (50 DORs + DC + SoS), announcement taxonomy expanded (6 types), human-in-loop via confidence threshold, accuracy targets FP<5%/FN<1%, 2-year historical backfill with public `/changes` page, model choice = Gemini or Grok (pending benchmark) |

---

*End of PRD v0.2.*
