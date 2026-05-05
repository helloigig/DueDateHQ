# DueDateHQ — Product Brief (Consolidated)

> Internal reference for Product Engineer Bootcamp · Round 1 · LangGenius, Inc.
> Consolidated from: CEO brief, business plan, value proposition canvas, and coaching discussions.

---

## 1. Thesis

### The product thesis in one sentence

**You will never be the last CPA in your state to find out about a filing extension — and when an announcement drops, you'll see the list of your affected clients within 24 hours, not by reading news.**

### Weaker framings to avoid

- ❌ "A lightweight, cloud-based tax deadline tracker." *(Describes File In Time equally well.)*
- ❌ "AI-powered tax compliance using Gemini/Grok." *(Sells the tech, not the outcome.)*
- ❌ "Never miss a tax deadline." *(Table-stakes, no defensible position.)*

### Why this framing wins

Every competitor can claim "don't miss deadlines" — that's what a calendar does.

What no competitor does today is continuously watch 50 state tax agencies for announcements and cross-reference them against a CPA's client portfolio inside 24 hours.

That capability is only affordable because LLMs can read government announcement language and structurally identify impact. Without AI, this requires a human compliance team. With AI, it costs $49/month. **The thesis and the economics are the same argument.**

---

## 2. Personas

Four personas cover the core use cases. The brief originally supplied three constructed personas; the fourth (small firm) is an explicit expansion to cover the 1–3 user Pro tier.

### Persona 01 — Sarah Mitchell, CPA *(Primary · P0)*

- **Role:** Solo practitioner · 80 clients · multi-state
- **Tools today:** 200+ row Excel deadline sheet + Outlook
- **Core pain:** Decision fatigue during Monday morning triage (currently 45 minutes)
- **Quote:** *"I now spend more time figuring out what I have to do this week than actually doing it."*

**Note:** Brief-supplied persona. Replace with a real interviewed CPA before presentation.

---

### Persona 02 — David Park, CPA *(Conversion · P0)*

- **Role:** Newly switching from a competitor tool
- **Tools today:** Has trialed TaxDome, Drake, Karbon, QuickBooks — abandoned all at manual entry step
- **Core pain:** Migration friction. Gives up during onboarding.
- **Quote:** *"By the third client I'd already given up on every tool I tried."*

**Note:** Represents the trial-to-paid conversion funnel. Brief-supplied persona.

---

### Persona 03 — Jennifer Wu, CPA *(Differentiator · P1)*

- **Role:** Multi-state practice · compliance-risk-focused
- **Tools today:** Same as above + manual browsing of state tax authority websites
- **Core pain:** Found out about IRS LA County extension from a client's group chat *after the fact*, discovered 6 affected clients too late.
- **Quote:** *"The IRS gave LA County an extension until October last year. I found out from a client's group chat. Turns out 6 of my clients qualified."*

**Note:** Brief-supplied persona. This is the highest-liability user — and the one your differentiator story exists for.

---

### Persona 04 — Ortiz & Associates *(Added · Small Firm)*

- **Role:** 2–3 CPAs · ~200 clients · shared workflow
- **Tools today:** Mixed — often one partner picks the software, others just use it
- **Core pain:** Cross-team visibility. Handoffs when one CPA is on vacation. Different from solo in that **shared state matters**.
- **Why this matters:** The $49 Pro tier targets exactly this segment (1–3 users, unlimited clients). The brief's three personas are all solo — this one fills the gap.

**Note:** Added persona. Validate quote + details with real small-firm interview.

---

### Who is NOT the user

- Big 4 or large-firm staff accountants (structured workflows, enterprise tools, not buyers)
- In-house corporate accountants (not tax-season-driven)
- Pure bookkeepers (don't file taxes)
- Enrolled Agents are **adjacent** — treat like solo CPAs for this product

---

## 3. Pain Points (Ranked by Severity)

### High severity

1. **Excel can't scale.** 50 states × multiple tax types × client portfolio = combinatorial complexity Excel cannot handle. One sort/filter error can cost a filing.

2. **State announcements are dispersed.** 50+ government websites to monitor. Staying current requires daily manual scanning that no solo CPA actually does.

3. **Government announcement language is arcane.** Deciding "does this affect my clients?" takes 10–30 minutes of reading per announcement.

4. **Cross-state requirements require manual research.** When a client operates in a new state, CPA must manually look up PTE elections, franchise tax rules, etc. — a research task, not a workflow task.

5. **Penalty liability lands on the CPA.** Current tools provide no accuracy SLA, no backstop, no protection.

### Medium severity

6. **Professional tools are priced for mid-sized firms.** Karbon, Canopy at $5,000+/year per firm — unaffordable for solo and 1–3 person practices.

7. **Competitor migration is brutal.** Manual client re-entry over days. Most CPAs give up on the trial before finishing setup.

8. **Filing season grind.** Jan–April means 20+ hours of weekly overtime, and the CPA still goes home worried about missing something.

---

## 4. Competitors

The tools solo CPAs actually use at 9am Monday.

### Excel / Google Sheets — DIY · Default · $0
The most common approach. Manual entry, manual updates. Zero automated notification when a state issues an extension. Catastrophic at 80+ clients across multiple states.

### Google Calendar · Outlook — Reminders only · $0
Can only remind "something is due." Cannot track completion status, relate deadlines to each other, or indicate progress. 100 clients = several hundred manually created events.

### Karbon · Canopy — Practice Management · $5,000+/yr
Feature-rich but priced for 5+ person firms. Workflow-management core, not a tax deadline database. State deadlines still need manual entry. TaxDome occupies a similar slot with stronger client-portal emphasis.

### File In Time — Most direct competitor · $199/mo+
**The incumbent to displace.** Ships with ~200 federal/state deadline types built in. Functionally closest to DueDateHQ — but still a Windows desktop installer, no cloud, no auto-update, UI from 2010s. The fact that this is the market leader in 2026 is the opportunity, not the threat.

### Comparison

| Dimension | File In Time | Karbon / Jetpack | **DueDateHQ** |
|-----------|--------------|------------------|---------------|
| Cloud / mobile | Desktop install | Cloud | Cloud + mobile |
| State-deadline auto-update | Manual | Manual | **Automatic (AI)** |
| Solo-CPA pricing | $199+/mo | $30–79/user | **$49/mo full** |
| Focus | Deadlines | Workflow | Deadlines + compliance intel |
| Onboarding | Days (install + config) | Hours | **< 30 min** |

### The market gap in one sentence

> There is no lightweight, cloud-native, auto-syncing, solo-CPA-priced modern product in this category. That is the gap.

---

## 5. User Stories

Three stories, three loops. Each is a different product surface and engineering challenge.

### Story 1 — Weekly triage during filing season *(P0 · Core · Daily loop)*

> **As** a solo CPA with 80 clients,
> **I want** to see all deadlines needing action this week within 30 seconds of opening my laptop,
> **so that** I can decide my priorities without switching between Excel, Outlook, and handwritten notes.

**Acceptance criteria:**
- Default dashboard groups deadlines into "Due this week / This month / Long term"
- This-week items show day-level countdown
- Filter by client, state, form type — response time < 1 second
- Every deadline supports one-click: Completed · Deferred · In-progress
- Full weekly triage takes < 5 minutes (vs. 45 today)

**Features:** Main dashboard · Three-tier grouping · Status management · Filter · ✦ Smart priority ranking

---

### Story 2 — Import 30 clients from a competitor in 30 minutes *(P0 · Core · One-time loop)*

> **As** a CPA just switching from TaxDome,
> **I want** to import 30 clients in 30 minutes and auto-generate their full-year deadline calendar,
> **so that** I can start using the product immediately, not spend a week on data entry.

**Acceptance criteria:**
- Supports CSV exports from TaxDome / Drake / Karbon / QuickBooks
- Auto-detects field mappings (name, EIN, state, entity type)
- For fuzzy or missing fields, offers smart suggestions — never blocks with errors
- Post-import: full-year deadline calendar is ready immediately, no extra config
- P95 completion ≤ 30 minutes (30-client benchmark)

**Features:** CSV import · Field mapping · Calendar auto-generation · ✦ Entity-type auto-recognition · ✦ Field smart matching

---

### Story 3 — 24-hour response to state tax authority announcement *(P1 · Differentiator · Rare-but-defining loop)*

> **As** a CPA with multi-state clients,
> **I want** to receive a list of all affected clients within 24 hours of any state extension or policy announcement,
> **so that** I can notify clients immediately without browsing 50 state tax websites daily.

**Acceptance criteria:**
- System captures state tax authority official announcements within 24h
- Auto-determines which clients are affected (state + county + entity + tax type)
- Top-of-dashboard banner + email notification
- "View affected clients" + "Batch-adjust deadlines" one-click actions
- Every announcement links to the official source for manual verification

**Features:** Live bulletin banner · Affected-client matching · Official source link · ✦ Announcement auto-monitoring · ✦ Announcement semantic parsing · ✦ Impact-scope identification

---

### The reframing argument worth making in your presentation

The brief marks Story 1 as P0/Core and Story 3 as P1/Differentiator. But **Story 3 *is* the business** — the thing no competitor has. A tier-1 move is to argue: **Story 1 is the shell, Story 3 is the spine.** The triage dashboard is how users experience the product day-to-day; the 24h state response is why the product exists at all.

---

## 6. Value Proposition Canvas (Condensed)

### Customer Profile — Solo & small-firm CPA

**Jobs to be done:**
- Track every federal + state deadline for every client
- Determine which taxes apply (by state + entity + industry)
- Plan workflow ahead to avoid gaps
- Respond to tax law and deadline changes
- Explain compliance requirements to clients
- Notify clients to prepare documents before penalty risk

**Pains (by severity):**

| Severity | Pain |
|----------|------|
| High | Excel can't scale to 50 states × multiple tax types |
| High | State announcements are dispersed across gov sites |
| High | Announcement language is arcane — time-consuming to interpret |
| High | Cross-state PTE / franchise tax rules require manual research |
| High | Penalty liability sits with CPA, no SLA from tools |
| Med | Karbon-class tools cost $5k+/yr — unaffordable for solo |
| Med | Competitor migration takes days of manual entry |
| Med | 20+ hrs/wk overtime during Jan–Apr, still worried |

**Gains (by importance):**

| Importance | Gain |
|------------|------|
| High | 5-minute weekly triage instead of 45 |
| High | Complete confidence that nothing was missed |
| High | Know about state law changes first, see affected clients |
| Med | Onboarding ≤ 30 minutes, no training |
| Med | Look professional and reliable to clients |
| Low | Take on more multi-state clients without added risk |

---

### Value Map — DueDateHQ

**Products & Services:**
- 50-state tax deadline database (federal + state + local)
- Multi-client cross-state deadline dashboard (web + mobile)
- Client profile system (state / entity / tax type bindings)
- Multi-channel smart alerts (in-app + email + SMS)
- Extension request tracking
- CSV import / PDF client report export
- Compliance calendar API (Phase 4)

**Pain relievers (✦ = AI-enabled):**

| Severity | Reliever |
|----------|----------|
| High | Pre-built 50-state database — no manual entry |
| High | ✦ AI auto-monitors 50+ state agency RSS and bulletin pages |
| High | ✦ LLM auto-interprets announcements and tags impact |
| High | ✦ AI auto-matches affected clients (state + county + entity + tax) |
| Med | ✦ CSV import: smart field mapping + entity-type recognition |
| Med | $49/mo — solo-CPA-friendly |
| Med | "Official source" link for manual verification |
| Low | Professional liability insurance + accuracy SLA |

**Gain creators (✦ = AI-enabled):**

| Importance | Creator |
|------------|---------|
| High | Three-tier dashboard: 45 → 5 minute triage |
| High | ✦ AI priority ranking (penalty × importance × history) |
| Med | Multi-client calendar auto-generated on import |
| Med | ✦ AI assistant answers natural-language queries |
| Med | Professional PDF client reports |
| Low | Export to other tools — no lock-in anxiety |

---

## 7. AI Leverage Points

Nine ✦ items in the VPC, all solving one kind of problem: **turning dispersed, obscure, high-dimensional government data into actionable intel for one specific CPA's client list.**

### The business-model argument

> Without AI, DueDateHQ doesn't exist at $49/month. With AI, it has a moat.

Maintaining an accurate, real-time 50-state tax deadline database used to require a dedicated compliance team. LLM + automated monitoring reduces this by ~80%, which is what lets the unit economics work at solo-CPA pricing. **The AI argument is the business-model argument.**

### Key metrics
- **9** AI-enabled items in the VPC
- **~80%** expected maintenance cost reduction (vs. human compliance team)
- **24h** state announcement response SLA (the core differentiation promise)

### The nine ✦ items

1. **Announcement auto-monitoring** across 50+ state tax agency websites
2. **Announcement semantic parsing** — reading government language and extracting structured meaning
3. **Impact-scope identification** — translating "disaster relief for X county" into "here are your 6 clients affected"
4. **Affected-client matching** — state × county × entity × tax type joins
5. **Entity-type auto-recognition** — classifying a client from CSV context (LLC, S-Corp, sole-prop, partnership)
6. **Field smart-matching** — mapping arbitrary CSV columns from Drake / TaxDome / QuickBooks into DueDateHQ's schema
7. **Smart priority ranking** — penalty size × client importance × historical delay patterns
8. **Natural-language query assistant** — "Which clients need to file PTE?"
9. **LLM-driven cross-referencing** between announcements and client portfolios

---

## 8. Business Model

### Pricing tiers

| Tier | Price | Capacity |
|------|-------|----------|
| Solo | $29/mo | 1 user · ≤ 50 clients |
| **Pro *(Primary)*** | **$49/mo** | **1–3 users · unlimited clients** |
| Team | $99/mo | ≤ 10 users · API access |

Annual payment discount: −20% (≈ 2 months free).

### Unit economics targets

| Metric | Target |
|--------|--------|
| CAC | $120–180 |
| ARPU (Pro) | $49/mo |
| Annual churn | 8–12% |
| LTV (3-year) | $1,320–1,764 |
| LTV/CAC ratio | 7–12× |

**High stickiness** because switching tools mid-season is unthinkable — tax-software users are naturally season-locked Jan–Apr.

### Year-3 ARR scenarios

| Scenario | ARR | Customers | ARPU |
|----------|-----|-----------|------|
| Conservative | $720K | 1,200 | $50/mo |
| **Base *(Target)*** | **$3.6M** | **6,000** | **$50/mo** |
| Optimistic | $9M | 15,000 | $50/mo |

---

## 9. Market

| Number | What it is |
|--------|------------|
| 400K+ | Licensed CPAs in the US (AICPA) |
| 34.8M | US small businesses — 99.9% of all businesses |
| $15.7B | Vertical-SaaS market size (2025), growing ~23.9%/yr |
| 43.5% | Share of US GDP contributed by small businesses |

### SAM breakdown

| Level | Number |
|-------|--------|
| Total licensed CPAs (US) | 400,000 |
| Solo practice + small firm (< 5 people), ~40% | ~160,000 |
| With multi-state client needs & willingness to pay | **~60,000** |
| Annual ARPU target (at $49/mo Pro) | $588 |
| **SAM ceiling (ARR at full penetration)** | **~$35M** |

---

## 10. Why Now

Three structural forces, simultaneously mature.

### 1. AI lowered the data-maintenance cost

Maintaining an accurate, real-time 50-state deadline database used to need a dedicated compliance team. LLMs + automated monitoring reduce that cost by roughly 80% — which is exactly what makes the unit economics work at solo-CPA pricing. **Five years ago, this business couldn't exist at $49/month.**

### 2. Small-business growth keeps compounding

US has added 5M+ new business applications per year since 2020. Each new small business creates downstream work for a CPA, and an increasing share operate in multiple states from day one. Demand is structurally rising.

### 3. Vertical SaaS pricing logic is validated

Toast, SimplePractice, Jobber all proved that deep solutions to narrow industry pains generate extraordinary retention. Tax compliance is the least-negotiable part of a CPA's work — a natural stickiness anchor.

### The framing sentence worth memorizing

> "The most direct competitor, File In Time, is a desktop installer still being sold in 2026. That's not a threat — it's an invitation."

---

## 11. Risks & Responses

| Risk | Level | Response |
|------|-------|----------|
| Intuit / Thomson Reuters copies the feature | Med | Large incumbents iterate slowly. First-mover + community credibility + data-quality moat. If acquired, it's a good exit path. |
| Tax law changes outpace database-maintenance capacity | **High** | Core engineering investment: auto-monitoring 50-state RSS / bulletins, LLM-assisted interpretation, human review. "Accuracy SLA" is a differentiation feature. |
| Solo-CPA payment willingness / budget limits | Med | $49/mo is < 1/3 of industry-average CAC. ROI narrative: "one missed penalty > annual fee." Annual discounts lower psychological barrier. |
| Market education cost | Med | Filing season (Jan–Apr) is natural acquisition window — tool pain is maximal. Concentrate marketing in Q4/Q1. |
| Data errors cause a client to miss a real deadline | **High** | "Official source link" surfaced in-product for manual verification. TOS clarifies reference nature. Professional liability insurance. |

---

*Last updated: April 21, 2026 · v1*
