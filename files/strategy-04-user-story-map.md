# DueDateHQ — User Story Map

> Activity backbone → tasks → 3 release slices. Unlike a flat backlog, a story map reads left-to-right as the user's workflow and top-to-bottom by release priority. Release 1 is the walking skeleton — the thinnest end-to-end slice that proves the product.

---

## Reading guide

```
 ← USER'S WORKFLOW OVER TIME →
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│Activity │Activity │Activity │Activity │Activity │Activity │Activity │  ← Backbone (high-level)
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Task    │ Task    │ Task    │ Task    │ Task    │ Task    │ Task    │  ← Walking skeleton
│ Task    │ Task    │ Task    │ Task    │ Task    │ Task    │         │  ← Release 1 (MVP)
│ Task    │ Task    │         │ Task    │ Task    │         │         │  ← Release 2
│         │         │         │ Task    │ Task    │         │         │  ← Release 3+
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

---

## Backbone — the 7 activities

A CPA's year-round workflow with DueDateHQ:

| # | Activity | Emotional arc | Frequency |
|---|----------|--------------|-----------|
| 1 | **Set up practice** | Anxious → relieved | Once |
| 2 | **Onboard clients** | Frustrated → proud | Once + ongoing |
| 3 | **Triage weekly work** | Exhausted → focused | 52×/yr |
| 4 | **Act on deadlines** | Heads-down | 100–300×/yr |
| 5 | **Respond to state events** | Panic → relief | 20–80×/yr |
| 6 | **Communicate with clients** | Nagging → hand-off | Continuous |
| 7 | **Close out & renew** | Reflective | 1×/yr |

---

## The full map

### Activity 1 · Set up practice

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| Sign up with email + password | SSO (Google, Microsoft) | SAML for Team tier |
| Set firm name + primary states | Firm branding (logo, colors) | Multi-office/branch support |
| Invite 1 teammate (Pro/Team) | Custom reminder email domain | Custom roles + ACLs |

### Activity 2 · Onboard clients

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| Manual "Quick Add" form (< 2 min) | Duplicate-template for similar clients | Bulk-edit entity fields |
| CSV paste-in + AI field mapping | CSV from TaxDome, Drake, ProConnect, QuickBooks, File In Time, plain Excel (all 6 schemas) | Native integrations (Drake, ProConnect API) |
| Assign 1 Service Package | AI-suggested Service Package by entity + state | User-authored Service Packages with templating |
| Auto-generate full-year calendar | Custom Services (user-defined filings) | Dependency authoring UI (1065→K-1→1040 chains user-editable) |

### Activity 3 · Triage weekly work

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| **Three-tier dashboard:** This week / This month / Long term | Smart priority ranking (AI: penalty × importance × history) | Natural-language query ("which clients need PTE this quarter?") |
| Filter by client, state, form type | Saved filter views | Custom columns / table-layout personalization |
| One-click status toggle (Complete / Defer / In Progress) | Keyboard shortcuts for power users | Bulk status actions |
| Weekend/holiday auto-adjust | Adjusted-date indicator with original date | Custom business-day rules per jurisdiction |

### Activity 4 · Act on deadlines

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| Mark Completed with date | Add internal target date (T-N) | Internal collaboration notes per deadline |
| Mark Deferred with reason | File extension with auto-generated post-extension deadline | Time-to-complete analytics |
| Client detail view (all deadlines for 1 client) | Note field per deadline | Document attachment pointer (link only — no storage) |
| Overdue auto-flag | Overdue severity levels (days past) | Overdue escalation rules per firm |

### Activity 5 · Respond to state events (Story 3 — the spine)

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| Dashboard announcement banner | LLM-parsed impact summary | Multi-source cross-verification |
| Email notification with affected-client list | In-app "inbox" of announcement history | Slack / Teams webhook notifications |
| One-click batch-adjust deadlines for affected clients | Preview diff before applying batch-adjust | Undo-batch within 24h |
| Official source link on every announcement | Human-review queue for low-confidence items | Public changelog at `/changes` with comment section |
| Auto-monitor 50 state DORs + DC + SoS | Expand to federal agency announcements (IRS, SSA) | Expand to local authorities (city / county) |

### Activity 6 · Communicate with clients

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| Automated client reminders (T-30, T-14, T-7) | Client-prep-date reminder with what's-needed checklist | Client reply threading inside app (opt-in; privacy considered) |
| PDF deadline report per client | iCal (.ics) subscription for client | Branded client portal page (read-only, no upload) |
| CAN-SPAM compliant unsubscribe | Bounce handling + invalid-email flagging | Client-side RSVP: "I'll send docs by [date]" |

### Activity 7 · Close out & renew

| Walking skeleton (R1) | Release 2 | Release 3+ |
|---|---|---|
| Monthly billing | Annual billing with 20% discount | Seat-based pricing (Team tier) |
| Self-service cancel + export-all | Year-end summary email ("what you tracked, what you caught") | Referral program |
| Archive inactive clients (7yr retention) | NPS survey + follow-up interview opt-in | Public case studies from power users |

---

## Release 1 — Walking skeleton (weeks 1–10)

**Scope:** the minimum set that lets a real CPA import a client, see a triage view, mark one deadline complete, and receive one state announcement — end-to-end.

**Why this set:**
- Tests the entire product hypothesis with minimum surface area
- Proves the Story 3 differentiator (without it the product is just a better Excel)
- Exposes the onboarding conversion bottleneck (which is where most of the learning lives)

**Explicitly cut from R1:**
- Native mobile apps (mobile-web only)
- Custom Services (Pre-built Service Packages only)
- Team roles beyond Owner/Member
- All P2 AI features (smart priority, NL query)
- Batch-adjust preview diff
- Annual billing

**Exit criteria for R1 → R2:**
- 10 real CPAs using it through 1 full filing-season week
- Onboarding ≤ 30 min for ≥ 70% of trials
- ≥ 1 real state announcement caught and acted on end-to-end

---

## Release 2 — Depth & confidence (months 3–6)

**Theme:** *"Make the rare loop trustworthy and the daily loop fast."*

- Full 6-schema CSV import
- AI-suggested Service Packages
- AI smart priority ranking
- Batch-adjust preview + undo
- Human-review queue for low-confidence announcements
- Annual billing + year-end summary

---

## Release 3 — Scale & retention (months 7–12)

**Theme:** *"Make it unthinkable to leave."*

- Natural-language query
- User-authored Service Packages + dependency authoring
- Native mobile apps (iOS / Android)
- Referral program
- `/changes` public backfill complete (2+ years)
- SOC 2 Type II

---

## Out-of-map (never, or very-far phase)

Anchor the positioning by being explicit about what this map will never include:

- Tax return preparation
- Document storage / vault
- Client portal with document upload
- E-signature
- Time tracking / billing / invoicing
- Bookkeeping
- IRS representation / tax resolution
- Desktop installer version

---

## How to use this map

| Use case | How to read it |
|---|---|
| Scoping a sprint | Read a column top-down — pick the next uncompleted task in the highest release-priority row |
| Defending a cut in review | "This is R2, not R1, because the walking skeleton doesn't need it to prove the hypothesis" |
| Explaining product to a new hire | Read the backbone left-to-right — that's the CPA's year in one line |
| Talking to investors | Backbone = market scope; R1 = risk reduction; R2–R3 = expansion runway |

---

*Inputs: Story 1/2/3 and their acceptance criteria from [01-product-brief.md](./01-product-brief.md) §5; P0/P1/P2 split from [duedatehq-prd.md](./duedatehq-prd.md) §4.*
