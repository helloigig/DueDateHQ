# DueDateHQ — Epic Hypotheses

> Each major initiative framed as a testable bet, not a commitment. Format: *We believe [user] will [behavior] because [reason]. We will know we're right if [signal]. We will kill this if [counter-signal].*

This protects engineering time. Build epics are hypotheses until a signal confirms them.

---

## Epic 1 — Three-tier time-grouped triage dashboard *(P0 · Story 1 · shell)*

**Hypothesis**

> We believe **solo and small-firm CPAs** will **complete their weekly triage in < 5 minutes after 3 weeks of use** because **the "This week / This month / Long term" grouping collapses a 200-row spreadsheet into an actionable 8–15 item list matching the 9am Monday job-to-be-done.**

**Success signals (any 2 of 3 = ship more)**
- Median triage session ≤ 5 min by week 3 of use
- ≥ 85% WAU during Jan–Apr
- Triage-session time trends *downward* week over week (muscle memory forming)

**Kill signals (any 1 = reconsider)**
- Median session > 15 min after week 4
- Users abandon the default grouping and live in client-by-client view > 60% of sessions → the grouping hypothesis is wrong
- < 40% WAU off-season → product isn't year-round

**Dependencies:** 50-state deadline database; client data model; Service Packages (for deadline generation)

**Risks:** Three-tier grouping may be wrong for seasonal extremes (April week ≠ September week). Mitigate with user-configurable tier windows in R2.

---

## Epic 2 — State announcement monitoring & affected-client matching *(P1 · Story 3 · spine)*

**Hypothesis**

> We believe **multi-state CPAs (Jennifer archetype)** will **click through the announcement banner and batch-adjust their affected clients within 24h** because **no competitor provides this, and being "the first to know about a state extension" converts directly into professional credibility they can show clients.**

**Success signals**
- Announcements detected within 24h of official publication: ≥ 95%
- Announcement → user notification: < 6h median
- Click-through → batch-adjust action: ≥ 40%
- Qualitative: ≥ 5 unprompted user quotes of *"I told my client before they asked"* in first 90 days

**Kill signals**
- Click-through < 20% after 60 days → users don't trust the alerts or don't find them relevant
- False-positive rate > 5% → trust erodes faster than it builds; mass-adjust risks making things worse
- CPAs verify the official source but don't batch-adjust → automation path isn't earning trust; rework required

**Dependencies:** 50 state DOR + DC + SoS scraping pipeline; LLM parsing (Gemini or Grok — benchmark Week 1); confidence-scoring + human-review queue; client portfolio query model

**Risks (high-severity)**
- **False negatives (miss an announcement)** → penalty liability spills back to us. Mitigate: accuracy SLA commitment with 1-month refund; FN target < 1%.
- **Model regression** when authorities change page structure. Mitigate: monitored coverage dashboard per state, alerts on zero-announcement weeks.

**Budget guardrails:** If LLM costs / month > $X per 1k announcements, fall back to rule-based extraction for high-frequency templates.

---

## Epic 3 — AI-powered CSV import & field mapping *(P0 · Story 2 · front door)*

**Hypothesis**

> We believe **CPAs evaluating DueDateHQ (David Park archetype)** will **finish importing 30+ clients in ≤ 30 minutes on their first session** because **AI field-mapping with visible confidence scores neutralizes the "day-of-manual-entry" objection that killed their previous 3–4 tool trials.**

**Success signals**
- Trial → ≥ 10 clients imported: ≥ 60%
- Trial → ≥ 30 clients imported: ≥ 40%
- Time from signup → first triage view: median ≤ 30 min
- Field-mapping AI acceptance rate (unchanged by user): ≥ 80% of rows

**Kill signals**
- ≥ 30% of trials abandon at the field-mapping step → AI isn't helping, it's confusing
- Users reject > 40% of AI mappings → the confidence signal is miscalibrated
- Entity-type auto-recognition accuracy < 85% → the leverage point isn't actually working

**Dependencies:** 6 supported source schemas (TaxDome, Drake, ProConnect, QuickBooks, File In Time, plain Excel); LLM or fine-tuned classifier for entity-type recognition; Service-Package auto-suggest

**Risks**
- Ambiguous / non-standard CSVs from small firms' custom Excel sheets. Mitigate: offer "import 5 to start" escape hatch — never block on mapping completeness.

---

## Epic 4 — Service Packages (pre-built + auto-assign) *(P0 · foundation)*

**Hypothesis**

> We believe **CPAs will accept ≥ 70% of AI-suggested Service Packages for imported clients** because **entity type + primary state + nexus states is a strong enough signal to pick the right package, and the cost of being wrong is low (one-click correction).**

**Success signals**
- AI Service Package suggestion acceptance: ≥ 70%
- Post-import, user modifies Service Package assignment for < 30% of clients
- Full-year calendar generated on import completion is usable without further config for ≥ 80% of clients

**Kill signals**
- Users override the default package > 50% of the time → the 30 pre-built packages don't match reality
- CPAs create custom packages for > 40% of clients in R1 → our package library is incomplete

**Dependencies:** Pre-built library of ~30 Service Packages (S-Corp Standard, Individual w/ S-Corp, Multi-state LLC, etc.); entity-type × state → package mapping logic

---

## Epic 5 — Automated client reminder emails *(P0 · retention)*

**Hypothesis**

> We believe **CPAs will leave automated client reminders ON for ≥ 80% of clients** because **chasing clients for documents is the #2 friction point (after state-deadline surprises), and "sent from my firm with one click" beats every manual alternative they have today.**

**Success signals**
- Clients with reminders enabled: ≥ 80% by day 14 of trial
- Reminder click-through (client clicks link in email): ≥ 25%
- CPA report (post-season): reduced client-chasing mentioned as top value by ≥ 50% of renewed users

**Kill signals**
- Bounce / spam-complaint rate > 2% (breaks CAN-SPAM posture and sender reputation)
- CPAs disable reminders for > 30% of clients after the first month → trust in automation not forming

**Dependencies:** Transactional email infra; firm-branded sending domain; CAN-SPAM compliance (unsubscribe, postal addr); timezone handling

**Risks**
- Reminder email appears spammy to clients, damaging the CPA's reputation → heavy investment in copy quality, branding, deliverability

---

## Epic 6 — Public `/changes` backfill page *(P1 · growth + moat)*

**Hypothesis**

> We believe **publishing a 2-year backfill of state announcements on a public page** will **generate ≥ 15% of top-of-funnel trial signups within 12 months** because **(a) it's a unique SEO corpus — no competitor has this; (b) it provides external proof of the 24h SLA; and (c) it builds a data moat that compounds over time.**

**Success signals**
- Organic search traffic to `/changes` ≥ 5,000 sessions / month by month 12
- Trial signups attributed to `/changes` ≥ 15% by month 12
- External backlinks from CPA forums / blogs referencing specific `/changes` entries

**Kill signals**
- Page indexes but traffic < 500 sessions / month after month 6 → SEO value overestimated
- No external citations within 6 months → the content isn't differentiated enough to share

**Cost framing:** Content maintenance is near-zero — the page is a render of existing data. The cost is in the historical backfill project, which is a one-time engineering investment.

---

## Epic 7 — Mobile-responsive read-optimized web *(P0)*

**Hypothesis**

> We believe **CPAs will use the mobile experience primarily for read-mode triage during client meetings and evenings** because **their actual deep work happens on desktop; mobile is for reference, not editing.**

**Success signals**
- ≥ 30% of weekly sessions include at least one mobile session
- Mobile session median duration < 2 min (consistent with read-mode hypothesis)
- < 5% of status changes happen on mobile (confirms edit-on-desktop pattern)

**Kill signals**
- ≥ 20% of users try to edit on mobile and abandon → read-only is the wrong bet
- Mobile session bounce rate > 70% → we're missing a key mobile-specific use case (likely "did I miss anything this morning?" push notification)

**Dependencies:** Responsive dashboard; deadline detail page; mobile-safe auth

---

## Cross-epic investment matrix

| Epic | Effort | Risk | Upside | Sequence |
|---|---|---|---|---|
| 1. Triage dashboard | M | L | M | R1 foundation |
| 2. State announcements | XL | **H** | **XL** | R1 parallel track |
| 3. AI CSV import | L | M | L | R1 conversion unlock |
| 4. Service Packages | M | M | M | R1 foundation |
| 5. Client reminders | S | L | M | R1 retention |
| 6. `/changes` page | M (one-time) | L | M–L (compounding) | R1 or R2 (growth loop) |
| 7. Mobile-responsive | S | L | S | R1 table-stakes |

**Budget allocation (engineering effort, R1):**
- Epic 2 (spine) should absorb ~35% of engineering — it's the differentiator *and* the highest-risk epic
- Epic 3 (front door) ~15% — high ROI per engineer-day
- Epic 1 + 4 (shell + foundation) ~30%
- Epic 5 + 6 + 7 ~20%

---

*Inputs: MVP feature list in [duedatehq-prd.md](./duedatehq-prd.md) §4; AI leverage points §7 of [01-product-brief.md](./01-product-brief.md); success metrics PRD §8.*
