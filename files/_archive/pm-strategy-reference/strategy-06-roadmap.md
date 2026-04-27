# DueDateHQ — Roadmap

> Sequenced 12-month roadmap. Each quarter has a theme, the bets being made, and the decision gate to the next quarter. Written for exec review, stakeholder alignment, and engineering capacity planning.

---

## Roadmap at a glance

```
Q2 2026    │ Q3 2026            │ Q4 2026            │ Q1 2027
(May–Jun)  │ (Jul–Sep)          │ (Oct–Dec)          │ (Jan–Mar)
───────────┼────────────────────┼────────────────────┼────────────────────
MVP build  │ Private beta +     │ Public launch +    │ First real filing
walking    │ off-season         │ pre-season         │ season in market
skeleton   │ hardening          │ acquisition push   │ (proving ground)
───────────┼────────────────────┼────────────────────┼────────────────────
R1 ship    │ R1.5 reliability   │ R2 depth           │ R2.5 retention
```

Filing season (Jan–Apr) is both the acquisition peak and the product's truth moment. The roadmap is timed so Q4 2026 is acquisition, Q1 2027 is battle-testing, and Q2 2027 is the expansion decision (beyond SOM).

---

## Q2 2026 · May–Jun · "Walking skeleton" (R1)

**Theme:** *Ship the thinnest end-to-end slice that proves the product hypothesis with 10 real CPAs.*

### Epics in this quarter

| Epic | Scope in Q2 |
|---|---|
| 1. Triage dashboard | Three-tier grouping, filters, status toggles, client detail |
| 2. State announcements | Pipeline for 10 highest-volume states (CA, TX, NY, FL, IL, PA, OH, GA, NC, NJ); email + banner; manual batch-adjust |
| 3. CSV import | 2 source schemas (TaxDome + plain Excel); AI field mapping with confidence score |
| 4. Service Packages | 15 pre-built packages (not 30); entity × state assignment logic |
| 5. Client reminders | T-30 / T-14 / T-7 schedule; firm-branded sending |
| 6. `/changes` page | Skeleton + 6-month backfill |
| 7. Mobile-responsive | Dashboard + deadline detail only |
| Foundation | Auth, billing (monthly only), CSV export, iCal, PDF report |

### Success criteria (decision gate → Q3)

- [ ] 10 real CPAs onboarded through full flow end-to-end
- [ ] ≥ 70% onboarding completion rate for paid-intent trials
- [ ] Weekly triage median ≤ 10 min by week 2 (target 5 min is R2)
- [ ] ≥ 1 real state announcement caught end-to-end (from scrape → email → batch-adjust)
- [ ] Zero P0 data-accuracy incidents

**If we miss → extend R1 by 30 days; cut Epic 6 (`/changes` page) from the current quarter.**

---

## Q3 2026 · Jul–Sep · "Private beta + harden" (R1.5)

**Theme:** *Close the gap between the walking skeleton and a product CPAs would trust in January.*

This is the off-season. Traffic is low. Use it to fix everything the first 10 users surfaced.

### Epics in this quarter

| Epic | Scope in Q3 |
|---|---|
| 2. State announcements | Expand to all 50 states + DC + SoS; confidence-scored human-review queue; false-positive < 5% gate |
| 3. CSV import | Add Drake, ProConnect, QuickBooks, File In Time schemas (all 6 total) |
| 4. Service Packages | Grow to 30 pre-built; AI-suggested on import |
| New: Accuracy SLA | Legal-reviewed public commitment + refund mechanism |
| New: Quarterly-estimates UX | Surface June 15 / Sep 15 deadlines prominently — off-season stickiness |
| New: Year-end onboarding prep | Service Package authoring UI (user-editable), data-quality dashboards |

### Private beta

- 30–50 invited CPAs (from Day 1 research contacts + LinkedIn)
- Paid at 50% off for 6 months (proves willingness-to-pay, not just usage)
- Weekly office-hours calls — these feed R2 backlog

### Success criteria (decision gate → Q4)

- [ ] 50-state coverage with < 5% FP, < 1% FN on verified announcements
- [ ] ≥ 40 paying beta users by end of Q3
- [ ] NPS ≥ 40
- [ ] Qualitative: ≥ 5 users explicitly tell us *"I'd pay full price"* unprompted
- [ ] Accuracy SLA published and defensible

**If we miss → delay public launch by 30 days; do not launch marketing until the 50-state FP rate is in range.**

---

## Q4 2026 · Oct–Dec · "Public launch + pre-season push" (R2)

**Theme:** *Convert the pre-filing-season window into a paying user base.*

CPAs shop for tools in November as they recover from extension-deadline exhaustion and brace for January. This quarter is acquisition, not product depth.

### Epics in this quarter

| Epic | Scope in Q4 |
|---|---|
| 1. Triage dashboard | Smart priority ranking (AI); saved filter views |
| 2. State announcements | Batch-adjust preview diff; undo-within-24h; Slack webhook (Team tier) |
| 5. Client reminders | What's-needed checklist; client-prep-date reminders |
| 6. `/changes` page | Full 2-year backfill; SEO optimization; external link-building |
| New: Annual billing | 20% discount tier; year-end upgrade emails |
| New: Referral program | 1 month free per referred paying CPA |
| New: Content + BD | LinkedIn thought-leadership program; Discord/Slack community presence |

### Growth loop wiring

- **Top-of-funnel:** `/changes` SEO + content marketing + CPA community posting
- **Mid-funnel:** No-credit-card 30-day trial → onboarding in ≤ 30 min → first-triage activation
- **Bottom:** Monthly → annual upsell in January; referral loop via renewal moment

### Success criteria (decision gate → Q1)

- [ ] 300–500 paying users by end of Q4
- [ ] CAC ≤ $180 (LTV/CAC ≥ 7× target)
- [ ] `/changes` traffic ≥ 2,000 sessions/month
- [ ] System ready for 10× announcement volume of filing season

**If we miss → slow hiring; concentrate marketing on the narrowest ICP segment (Jennifer-type multi-state CPAs) and push growth to Q1 via filing-season pain.**

---

## Q1 2027 · Jan–Mar · "The proving ground" (R2.5)

**Theme:** *Survive filing season with the differentiator intact.*

This is the quarter the product exists for. Every state announcement matters. Uptime and accuracy matter more than any feature.

### Epics in this quarter

| Epic | Scope in Q1 |
|---|---|
| Reliability | 99.9% uptime; monitoring dashboards per-state; on-call rotation |
| 2. State announcements | Filing-season surge coverage; federal IRS announcements as first-class |
| 1. Triage dashboard | Overdue severity; keyboard shortcuts; mobile parity expansion |
| 5. Client reminders | Bounce handling; deliverability hardening |
| New: Natural-language query (beta) | "Which clients need PTE?" — opt-in, instrumented |
| New: Team tier polish | Assignee views; workload balancing; Slack digest |

### Success criteria (decision gate → Q2 2027)

- [ ] ≥ 85% WAU during Jan–Apr
- [ ] Zero missed state announcements (public incident count = 0)
- [ ] 3-month retention ≥ 80%
- [ ] ≥ 1,000 paying users by end of Q1
- [ ] Median triage session ≤ 5 min

**If we miss a state announcement in filing season:** declare a public incident, honor the accuracy SLA, write a public post-mortem. Reputation > revenue in this quarter.

---

## Q2 2027+ · Expansion decisions

At end of Q1 2027, the business has its first full-season data. Three expansion directions to evaluate:

### Option A — Native mobile apps (iOS / Android)
**When:** Q2 2027 if mobile-web session share > 30%
**Why:** Push notifications unlock a whole use case (morning state-news digest)
**Risk:** Major capex, diverts from differentiator

### Option B — Adjacent segments
**When:** Q2–Q3 2027 if SOM saturation > 30%
**Candidates:** Enrolled Agents (already adjacent); fractional CFOs / bookkeepers who also file; international (Canadian CAs)
**Risk:** Positioning drift — the specialist layer becomes a platform by accident

### Option C — Open API + integration marketplace
**When:** Q3 2027 if Team tier adoption is strong
**Why:** Turns DueDateHQ into the compliance-intel *layer* underneath Karbon / TaxDome / Drake — makes it harder to displace
**Risk:** Competitors absorb the value via integration; we become middleware

### Option D — Accuracy-SLA-as-insurance-product
**When:** Q4 2027 if incident-free through two filing seasons
**Why:** Transforms the SLA from a retention feature into a revenue line; opens a conversation with malpractice insurers
**Risk:** Requires regulated-entity structure; significant legal overhead

---

## Roadmap-wide risks & mitigations

| Risk | Probability | Impact | Mitigation in roadmap |
|---|---|---|---|
| Intuit / Thomson Reuters copies the state-announcement feature | Med | Med | Race: Q3 backfill + Q4 `/changes` creates a compounding data moat they can't rebuild |
| A major state DOR announcement is missed in Q1 2027 | Med | **Critical** | Q3 coverage dashboards; Q1 on-call rotation; public incident protocol |
| Onboarding conversion < 60% in Q4 | Med | High | Q2 AI field-mapping has Q3 to iterate before traffic spike |
| Churn spike in off-season (May–Sep 2027) | Med | Med | Q3 quarterly-estimates UX; annual-billing discount; year-end summary |
| LLM costs balloon with volume | Low | Med | Per-epic budget guardrails; rule-based fallback for high-frequency templates |

---

## Capacity planning (rough)

| Quarter | Engineering | Design | GTM / Content |
|---|---|---|---|
| Q2 2026 | 3–4 eng | 1 designer | 0 |
| Q3 2026 | 4–5 eng | 1 designer | 0.5 FTE content |
| Q4 2026 | 5–6 eng | 2 designers | 1 FTE growth + 0.5 FTE content |
| Q1 2027 | 6–7 eng | 2 designers | 1 FTE growth + 1 FTE CS/support |

Hire triggers are tied to decision gates, not calendar.

---

## What this roadmap does NOT do

- ❌ Commit to dates for things past Q1 2027 (too far to plan; use directional themes)
- ❌ Build native mobile in year 1
- ❌ Chase tax-prep integration in year 1 (BD conversation, not product conversation)
- ❌ Add features to compete feature-for-feature with Karbon/TaxDome
- ❌ Internationalize before Canadian segment shows organic demand

---

*Inputs: phases timeline in [duedatehq-prd.md](./duedatehq-prd.md); business model & ARR scenarios from [01-product-brief.md](./01-product-brief.md) §8; risks §11.*
