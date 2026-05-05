# Pitch — Q&A Preparation: DueDateHQ

*Skill: startup-pitch | Generated: 2026-05-05 (v2 — internal narrative)*

The 12 questions any informed listener will ask, with prepared answers. Order roughly by likelihood. Internal-narrative version — no funding-ask Q. New Q on user research methodology added (Q12), since that's the load-bearing asset.

---

## Q1 — "How is your AI different from Lacerte's organizer or any tax software's prior-year rollover?"

**This is the defining competitive question.** [Source: PRD v0.8 §1.4] Every customer asks it and you must answer it the same way every time.

> **Mechanical rollover vs. pattern recognition.** Lacerte copies last year's W-2 placeholder to this year. We notice that *this client's* W-2 historically arrives Feb 5 — and this year it's Feb 12 with no email, so we ask. Lacerte re-uses last year's checklist items. We notice that Schedule E was on the checklist for 5 years and *disappeared* this year, so we flag the question: did the client sell the rental?
>
> Mechanical rollover is the floor. Pattern recognition is the product. Every AI feature we build has to pass that test — *would Lacerte's organizer give this same answer?* If yes, we haven't built anything new.

---

## Q2 — "Why is the bottleneck supply-side, not just bad software? Why won't a better Karbon kill you?"

> Karbon is excellent at workflow visibility — but its AI is shallow, and structurally has to be, because Karbon is also a billing system, a client portal, a document store, and a project manager. The product P&L can't justify the AI investment we're making at $49 a seat. Their roadmap proves it: they shipped "AI agents" in 2026 as a feature; we built our entire architecture around the 5 machine-replicated activities.
>
> The structural moat: we are a **layer**. Anyone who copies our features still has to drop the suite mentality, which is a multi-year reorganization. TaxDome would have to deprecate revenue lines to ship our wedge.

---

## Q3 — "TAM looks small. ~$22M ARR fully penetrated? How is this venture-scale?"

**Don't dodge this.** [Source: intake.md market sizing]

> The wedge is small. We know. That's a deliberate sequencing decision, not a market-size limitation.
>
> Three expansions: **Layer B** in Year 3 — advisory triggers, churn risk, pricing intelligence — moves pricing from $49/seat to $200–500/seat. **Year 5 firm-brain** opens mid-tier firms (10–100 person) at $1K–5K/seat. **Adjacent verticals** — bookkeeping firms, EAs, fractional CFOs, international tax — same architecture, ~5× the firm count.
>
> The question is whether you believe the wedge generates the data that makes the platform work. We think it does because the data is generated *by use* — every imported PDF, every email watched, every state announcement matched compounds the AI's value across that customer's whole book.

---

## Q4 — "Why now? What changed in the last 24 months that makes this work?"

> Three things. **One — LLM economics.** State-DOR scraping plus per-firm matching costs us $3–5 per firm per month. Five years ago that was a Bloomberg-data-feed business at thousands per year. **Two — desktop incumbents are bleeding.** File In Time is still a Windows installer in 2026. **Three — suite fatigue is real.** TaxDome's annual lock-in plus 10–15h setup is causing measurable churn. The market is begging for a layer.

---

## Q5 — "What's your unfair advantage? What can you do that a well-funded competitor can't replicate in 12 months?"

> Three layers, ranked by durability:
>
> **Most durable — strategic posture.** Integrate, don't replace. TaxDome's whole product is structurally incompatible with this customer; we are structurally aligned. Anyone who copies our features still has to re-architect their P&L.
>
> **Long-term durable — client intelligence flywheel.** A firm with 3 years of imported returns + connected QBO + 6 months of email watching has a personalized intelligence layer no competitor can give them on day one. Switching costs grow with usage.
>
> **Medium durable — state announcement corpus.** 50-state corpus, parsed and historically backfilled to 2 years. A well-funded competitor could close this gap in 18 months. We don't bet the company on it.

---

## Q6 — "Traction. What do you actually have?"

> Pre-revenue. What we have:
>
> 1. **Shipped product.** The dashboard is in production. Action queue, four alert surfaces (bell, banner, blocking modal, `/alerts` page), state-announcement pipeline with sub-24h SLA, two-tier AI confidence chips on every match (parse + match). 19+ shipped pages including Today, Clients, ClientDetail, TaskDetail, Mail, Calendar, Settings, Onboarding, Insights. Demo-ready cold.
> 2. **Live design partner.** Yan Jing — 10-person firm, 600 clients across 20 states. His standing quote: *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* That commitment shaped §5.3 architecture; the architecture is now built. He becomes our first paying customer when the chase-loop body (Modes A+C+D) ships in full.
> 3. **Production-grade specs.** PRD v0.8 (2,007 lines), IA v0.7 (1,171 lines), architecture v0.7 (1,806 lines). Build sequence is concrete; velocity demonstrable through git log.

---

## Q7 — "Why is the team the right team to build this?"

> The team is internal context for this narrative — bio detail is known and not surfaced in this artifact. What matters externally:
>
> 1. **The team is shipping product weekly** with a 10-person design-partner firm running it. The dashboard exists. The state-announcement pipeline runs. The PRD/IA/arch are at v0.8/v0.7/v0.7 and synced. Velocity is verifiable through git log + PRD change log.
> 2. **Yan Jing is a load-bearing design partner**, not a team member. His 600-client / 20-state / 40-software-tool firm gives the product its hardest test cases; his 15 years of edge-case judgment shaped the §5.3 architecture, the Mode B per-client timing model, the Tier 0 integration cut, the forever-no list.
> 3. **The painpoint is locked.** Yuqi locked the 2-sentence Chinese painpoint on 2026-04-30 after multi-round refinement. Founder-locked product framing at this stage is signal; most pre-launch products drift.
>
> Anti-patterns to avoid when the founder *does* fill external bios: titles without accomplishments, "X years of combined experience," vague "deep tech background." Specific accomplishments only.

---

## Q8 — "What's your business model? Pricing, margins, payback?"

> **Pricing.** Solo $29 / Pro $49 / Team $99 monthly. Monthly billing default — no annual lock-in. 30-day no-credit-card trial. [Source: PRD v0.8 §13]
>
> **Variable cost per customer.** ~$3–5/month in LLM spend (Claude Sonnet 4.5 primary, GPT-4 Turbo failover) [Source: tech_stack.md]. Email infra (SES + Postmark) ~$1–2/month. Hosting (Fly.io + Vercel + Postgres) marginal at low volumes.
>
> **Gross margin at scale.** ~80% gross margin at the Pro tier ($49 - ~$8 variable). Solid for vertical SaaS.
>
> **Payback period.** Acquisition is the unknown. Sales-led won't work at $49/seat; we are CAC-constrained to ~$200/customer to maintain <12-month payback. That demands product-led growth — content marketing on `/changes` (state announcement archive as SEO surface) + LinkedIn-CPA word-of-mouth + Yan Jing-style design-partner referrals.

---

## Q9 — "What about regulatory / liability risk? You're touching tax deadlines."

[Source: PRD §14 risks]

> Three carve-outs we hold the line on:
>
> 1. **AI never auto-promotes a checklist item to `received_confirmed`.** This is a §5.3 invariant in our PRD. The CPA always confirms. AI is yellow-zone (proposes, CPA approves) on anything that touches state with meaning.
> 2. **Forever-no list** — audit-risk prediction, legal interpretation, tax preparation, client financial advice. These are red zones. The CPA's professional liability covers these; AI must not opine.
> 3. **24h SLA** on state announcements. We're working through legal on the SLA wording — soft commitment with documented carve-outs is the most we'll promise. The accuracy SLA matters because if we match 2 of 3 truly-affected clients and the third misses a deadline, we need to know what we owe them.
>
> The honest framing: we're not the system of record. We surface intelligence; the CPA acts on it. Their professional judgment carries the legal weight.

---

## Q10 — "What's your biggest risk?"

[Source: PRD §14.1]

> **The wedge alone is not enough.** State alerts are demoable but a "once a quarter" feature for the average CPA. If the body — document chasing, Modes A through D — doesn't ship close to launch, the wedge alone won't retain. We've sequenced our build around this: body before wedge-deepening. But it remains the single most important thing we have to get right.
>
> Secondary: **integration ecosystem changes.** TaxDome could enable two-way QBO sync next year, narrowing differentiation. Defense is the body and engine — Modes B and E are *much* harder to ship than QBO sync.

---

## Q11 — "What happens if Intuit ships this in QuickBooks Online next year?"

> Intuit will not ship state-DOR monitoring with portfolio matching. The QBO product surface is wrong for it — they don't have the firm-as-tenant model that supports per-firm client portfolios with affected-client matching. Their AI investment is in QuickBooks Live (bookkeeper-replacement), which is a *different* market from CPA workflow.
>
> If Intuit *did* ship it: we welcome the validation. The market would be 10× the current size, and our layer-not-suite posture means we still win on the small-firm CPA who doesn't want everything to come from Intuit. Yan Jing's "40 software tools that don't talk to each other" customer is structurally repulsed by a single-vendor solution.

---

## Q12 — "What's your user research methodology? How did you produce the insight?"

This is the question that surfaces the depth of the work. Answer specifically.

> **One deep design partner + bilingual interview synthesis is the spine.** Yan Jing — 15-year partner at a 10-person firm, ~600 clients, ~20 states, ~40 software tools. Multi-session interview spanning four question threads: prior-year history, email/audit-trail flow, two-way sync architecture, AI use-case taxonomy. Plus a closing synthesis on AI decision boundaries.
>
> **Output: a 660-line synthesis doc** organized in five parts: macro CPA journey, stage-by-stage micro deep-dives, cross-cutting principles (trust + integration + compliance), refined product framing, open threads.
>
> **Then: PRD §0.5 traceability table — 57 rows.** Every change from PRD v0.6 → v0.7 traces to a specific interview insight, with PRD section + change description. The point is operational: any future contributor can look at any decision in v0.7 and see *which interview line prompted it.*
>
> **What the interview re-shaped (the four-question reorganization that came out of synthesis):**
> - *"How does prior-year history help?"* → AI value comes from **multi-year** history, not "read this year's emails"
> - *"How do CPAs review/track AI emails?"* → Trust is staged (Stage 1 review → Stage 2 opt-in auto-send with 3 eligibility conditions). Timeline is compliance-grade, not nice-to-have.
> - *"Two-way sync or import/export?"* → DueDateHQ as task/deadline source of truth + connection layer. Per-integration source-of-truth rules.
> - *"What AI use cases?"* → 5 (now 6) AI use modes, each scored against AI authority gradient (green/yellow/red).
>
> **And:** customer-journey synthesis covering 8 stages × 3 personas (Sarah Mitchell primary, Jennifer Wu compliance-driven, David Park onboarding-gauntlet). Each persona has distinct conversion lanes; onboarding designed against David's patience, not Sarah's.
>
> **What we deliberately avoided.** No "panel of 50 CPAs" focus-group research. No survey-based persona derivation. Depth-of-one over breadth-of-many at this stage — Yan Jing is a high-information customer, his bilingual verbatim is loud signal, and we hold ourselves to writing every product decision against the synthesis. PRD §14.1 is honest about the n=1 risk.

---

## Q13 — "What's your roadmap from here?"

> **Year 1 — granularity replication.** State alerts wedge already shipping; Modes A+C+D as a coordinated chase-loop release; Method A forwarding + reply-intent classification (≤3% false-positive on `timeline_pushback`); onboarding Layers 1 + 2.
>
> **Year 2 — engine activation.** Modes B + E come online when import Tier 3 lands. Customer goes from *"AI helps me chase"* to *"AI knows my clients better than I remember."*
>
> **Year 3 — advisory awakening.** Layer B Opportunities sidebar surface; advisory triggers, churn risk, pricing intelligence. Senior-partner Pattern 4 retention story activates. Pricing power → $200–500/seat for firms running Opportunities.
>
> **Year 5 — firm brain.** Layer C institutional intelligence; mid-tier firm market opens at $1K–5K/seat.
>
> Each year compounds on the previous year's data. The flywheel is the moat.

---

## Honest weaknesses (volunteer these)

These are flaws a careful listener will find anyway. Better you bring them up.

1. **Bottom-up SAM is small.** ~$22M wedge ARR. Defense: expansion path is concrete (Layer B/C/D + adjacent verticals).
2. **No paying customers yet.** Defense: shipped product + design-partner deeply embedded.
3. **Yan Jing's voice is loud, n=1.** PRD §14.1 calls this out explicitly. Defense: validating with 1–3 person firms before treating his insights as gospel; Sarah Mitchell composite reflects multiple secondary inputs; customer-journey doc covers three personas with different conversion lanes.
4. **State-announcement scraping is operationally fiddly.** State DOR websites change formats. ~10% of monthly engineering time on pipeline maintenance. Defense: manual review queue is the safety valve; we've budgeted for it from Day 1.
5. **Cold-start AI.** Mode B and E require multi-year history; Day 1 they fall back to substrates (Entity / Industry / State / Cohort). Defense: substrates *do* carry useful signal. We'll never say *"the AI will get smarter as it learns"* in product copy — that's a sales-failure narrative we explicitly banned (PRD §1.6).
6. **The wedge alone is not enough.** State alerts are demoable but a "once a quarter" feature for the average CPA. If the body — Modes A through D — doesn't ship close to launch, the wedge alone won't retain. PRD §10.3 sequencing: body before wedge-deepening.

## Sources

- **Interview synthesis:** `~/Downloads/duedatehq-PRD/Interview Notes — 15-Year CPA Founder, 10-Person Firm .rtf` (660 lines)
- **Interview→decision traceability:** PRD v0.8 §0.5 (57 rows)
- **Strategy + risks:** PRD v0.8 §1, §4, §13, §14
- **Forever-no list:** `forever_no.md` memory + PRD §1.7
- **Tech stack + pricing:** `tech_stack.md` memory + PRD §13
- **Competitive matrix:** `/Users/yuqi/Desktop/DueDateHQ_dashboard/files/competitive-matrix.md`
- **Customer journey 3 personas:** `strategy-03-customer-journey.md`
- **Painpoint (Yuqi-locked):** `painpoint_summary.md` memory
