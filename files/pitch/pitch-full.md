# Pitch — Full Narrative (~10 minutes): DueDateHQ

*Skill: startup-pitch | Generated: 2026-05-05 (v2 — internal narrative)*

**Use context:** internal narrative doc for founder rehearsal + story discipline. Not a fundraising deck. No funding ask.
**Format:** ~10 minutes spoken, ~1,800 words. Designed to invite conversation, not monologue.

**Pitch ordering rationale:** The strongest opener after "what we do" is **the insight** — and the strongest backing for the insight is **the user research that produced it**. We have a 660-line interview synthesis with a 15-year CPA partner running a 600-client firm, plus 50+ traceable product decisions documented in PRD §0.5. Lead with the insight; defend it with the research; show the product; close with the trajectory. Order:

```
What We Do → Insight → User Research Backbone → Problem → Solution (with live wedge demo)
  → Why Now → Market → Business Model → Where We Are + What's Next → Close
```

---

## 1 · What we do (45 sec)

> A solo CPA can give 10 clients fine-grained service. She physically can't replicate that across 100. **DueDateHQ runs the parts of that service a machine can do — remembering each client's multi-year history, predicting per-client timing, confirming materials are 100% complete, monitoring 50-state rule changes, and drafting client emails — across her entire book.** Every client gets the granularity that today only her top 10 receive.

**Specific example, in the room:**

> "Last Tuesday Louisiana announced a hurricane filing extension. Within four hours, Sarah's dashboard showed her six affected clients, the eight deadlines to extend, and six client emails already drafted in her tone. She approved them in 90 seconds. Her peers using Karbon or File In Time found out from a client complaint."

**[Speaker note]** Pause here. Let it land. If they ask "wait — how does it know which clients are affected?" you've already won the room. *Don't lecture. Let them pull the next sentence out of you.*

---

## 2 · The insight (75 sec)

> Every CPA software vendor — TaxDome, Karbon, Canopy, even File In Time — implicitly assumes the CPA *chooses* which clients get fine-grained service. Top clients get attention. The bottom of the book gets standardized everything. **That assumption is wrong.**
>
> CPAs don't choose. They run out of hours. The constraint is supply-side capacity, not strategic segmentation. Every client deserves the same granularity; the partner physically cannot deliver it.
>
> So we don't sell "AI for CPAs." We don't sell "another tool." We **lift the supply-side ceiling** by taking the five things a machine can replicate — Memory, Predictions, Confirmation, Monitoring, Drafting — and running them across the entire book. The CPA keeps the three things a machine *cannot* replicate: judgment, signature, relationships.
>
> Here's the test we run on every feature we build: **Would Lacerte's organizer give this same answer?** If yes, we haven't built anything new. Mechanical rollover — copy last year's W-2 placeholder to this year — is the floor. Pattern recognition — *"This client's W-2 historically arrives Feb 5, this year it's Feb 12 with no email — should we ask?"* — is the product.

**[Speaker note]** Pause here. The "would Lacerte give this answer" line is a portable test they can repeat to their partners after the meeting. **Make them ask the next question.** If they ask "where did this insight come from?" you're set up perfectly for §3.

---

## 3 · User research backbone (90 sec) — *the evidence*

> That insight isn't speculation. It came from a 660-line synthesis with a 15-year CPA partner running a 10-person firm, ~600 clients across 20 states. He's our design partner — Yan Jing. We have 50+ documented product decisions traceable line-by-line to specific things he said. PRD section 0.5 is literally a 57-row table mapping interview insight → product decision → PRD section.
>
> Three quotes are load-bearing. They show up in the architecture, in the IA, in the build sequence:
>
> **One — on the bottleneck.** *"600 个客户如果每个人都去问一下的话，那好多时间花在."* He admitted, indirectly, that he can't ask every client every question. He keeps about 50 in his head clearly, ~100 fuzzily, the other 450 only via records. **That's the supply-side ceiling we're lifting.**
>
> **Two — on the wedge.** *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* That's why our entire ChecklistItem state machine is non-negotiable architecture. The §5.3 invariant — *"AI never auto-promotes a checklist item to received_confirmed"* — is enforced at the database with a CHECK constraint. The customer told us this was the price of trust; we built it in.
>
> **Three — on timing.** *"你不能 1 月 1 号开始就问了."* You can't start asking for materials on January 1st. Each client has their own arrival pattern. His K-1 from one fund historically arrives in August; another client always drags to early April. AI's job isn't a generic deadline reminder — it's **per-client timing prediction** based on multi-year history. That's Mode B. It only ships in P1 because it requires multi-year imports — but it's the second-year retention thesis.
>
> The deeper takeaway from the interview was a meta-thesis the team didn't see until we did the synthesis: **the AI value of this product isn't "AI helps you do this year's tax." It's "AI learns how you served clients for 5 years, and makes you 5× more efficient this year."** Multi-year history is the engine. State alerts are the wedge that gets the meeting; multi-year client intelligence is the moat that holds the customer.
>
> One more piece of evidence — the customer journey work [`strategy-03-customer-journey.md`] surfaced **three distinct personas with different conversion lanes:** Sarah Mitchell (the typical solo CPA, our primary buyer), Jennifer Wu (compliance-risk-driven, arrives via a missed-extension incident — Stage 6 is her hook), and David Park (the gauntlet — has trialed 4+ competitors, will quit at the third client if onboarding has friction). Every onboarding flow is built to survive *David's* patience, not Sarah's.

**[Speaker note]** This is the part where the depth gets felt. Drop the line *"57 rows of interview-traceable decisions"* slowly. If they ask to see it, the table is real and you can show it. Most "AI for X" pitches can't show that table.

---

## 4 · The problem (60 sec)

Sarah Mitchell is real — she's a composite of every solo CPA we've talked to. 49 active clients across 6 states, 4 years independent, $250K/year revenue. She has three failure modes, every week:

> **Monday-morning anxiety.** She reopens her Excel sheet and tries to remember what was urgent before the weekend. Every Monday, reconstructed from short-term memory.
>
> **The chase loop.** Three weeks before any deadline, she hand-types the same reminder email twelve times. Some clients respond. Many don't. One inevitably surprises her with a 1099 she didn't ask for.
>
> **The state-change miss.** When Louisiana changes an estimated payment rule mid-year, she finds out from a client's complaint, not from her tools.

That last one is the wedge. The first two are the daily body. **Sarah is willing to pay $49 a month to make all three go away.** She is not willing to switch to TaxDome and re-learn her stack, lose her billing setup, and lock in for a year.

---

## 5 · The solution (90 sec) — *show, don't tell*

Sarah opens DueDateHQ on Monday morning. She does **not** see a deadline list. She sees an action queue.

> Top of the screen: a **state-alert band** — only when something is actionable. *"Louisiana DOR · Hurricane Delta extension · 2h ago. Six of your clients affected. Eight deadlines to extend. Six client emails drafted, in your voice. Review →"*
>
> She clicks. The next screen shows the announcement, the affected client list with confidence chips (`AI parse: high · AI match: high`), and **four pre-drafted action chips** — not buttons, *suggestions* she can review and execute one-click: Draft client emails. Batch-extend deadlines. Forward LA DOR bulletin. Mark Service Package extended.
>
> Below the alert band: the **action queue.** Twelve TodoItems sorted by urgency. The example we test against is right out of the interview: *"Emily Chen — W-2 not yet arrived. Last year arrived Feb 5; we're 7 days past her pattern. Suggested action: send a soft check-in (draft ready)."* That's per-client timing prediction in the wild — Mode B, the answer to *"你不能 1 月 1 号开始就问了."* Sarah clicks. Reviews the draft. Sends. 30 seconds.
>
> The whole experience privileges **the gap**, not the fill. The loudest visual is *"what hasn't the client sent yet?"* — never *"what's confirmed."* Confirmed items collapse by default. The product's painpoint is the gap; everything else is decoration. *"最重要的就是客户还没发过来的"* — Yuqi 2026-04-30, the design rule that runs through every screen.

**[Speaker note]** This is the demo moment. If you have the dashboard up, switch to it here. 60 seconds is enough. **Do not show three demos.** One. Then back to narrative.

---

## 6 · Why now (60 sec)

This product could not have existed five years ago. Three things changed:

> **One — LLM economics.** State-DOR scraping plus LLM-driven parsing plus per-firm portfolio matching costs us about $3–5 per active firm per month. Five years ago that was a Bloomberg-data-feed business; price tag was thousands per year. The *layer* could not exist below $200/month before LLMs.
>
> **Two — desktop incumbents are bleeding.** File In Time, the closest direct competitor on deadline tracking, is still a Windows installer in 2026. Their architecture can't deliver a 24-hour cloud SLA on state announcements. They are not closing this gap.
>
> **Three — suite fatigue is real.** TaxDome locks customers in for a year and takes 10–15 hours to set up. Karbon prices for 10-person firms. The market is begging for a *layer*, not another suite — and incumbents are structurally unable to ship it because their P&L depends on owning the whole workflow.

**[Speaker note]** "Layer, not suite" is the line that frames everything that follows. If they latch onto it, the rest of the narrative is downhill. The Yan Jing quote backs it: *"我有 40 个软件工具，新东西最大的担心是它跟其他工具不说话."* That's the customer telling us the integrate-don't-replace posture is a deal-maker, not a roadmap detail.

---

## 7 · Market size (60 sec) — bottom-up, no $50B fluff

> The US has roughly 46,000 accounting firms. Our ICP — solo, 1–3 person, and 4–10 person firms — is about 45,000 of them. Blended ARPU at our pricing is $60/month. That's a **~$22M ARR fully-penetrated SAM in our launch wedge.** Capturing 10% is $2.2M ARR.

That's small. We know. **Here is why we still think this is venture-scale:**

> The $22M is the wedge. Year three, we ship Layer B — advisory triggers, churn risk, pricing intelligence — and pricing power moves from $49 a seat to $200–500 a seat. Year five, "firm brain" — captured partner knowledge that survives staff turnover and retirement — opens the mid-tier firm market at $1K–5K a seat. **And every CPA-adjacent vertical** — bookkeepers, EAs, fractional CFOs, international tax — uses the same intelligence-layer architecture with a 5× firm-count multiplier.

The wedge is small. The platform — *intelligence layer for vertical professional services* — is not.

**[Speaker note]** Be ready for this question: *"Why not start with the bigger market?"* Answer: because the wedge is the only place we can win against incumbents in 12 months, and the wedge generates the data that makes the platform plausible. Wedge-first is not a market-size limitation; it's a sequencing decision. The interview anticipates this — the Year 1 / Year 3 / Year 5 trajectory came directly from the closing synthesis.

---

## 8 · Business model (30 sec)

> Three tiers. **Solo** at $29/month for one-user firms with up to 50 clients. **Pro** at $49/month — our primary tier — one to three users, unlimited clients. **Team** at $99/month for up to ten users, with API access in Phase 4.
>
> Monthly billing by default. **No annual lock-in.** That's a deliberate countermove against TaxDome's annual-upfront posture, and it shows up in customer interviews as the single biggest trust signal — *"我之前被 TaxDome 锁了一年，再也不想被锁了"* is the recurring sentiment in CPA Discord and Capterra reviews.
>
> 30-day no-credit-card trial. Customer activation target: **first triage in 5 minutes**, full setup in 30 minutes, ongoing deepening over weeks as they connect QBO, Gmail, and import prior-year data. The 5/30/ongoing structure isn't an arbitrary onboarding pattern — it came out of the interview's *"don't make Day-1 import everything"* discussion. Three onboarding layers, each shipping value without the next.

---

## 9 · Where we are + what's next (60 sec)

This is an internal narrative. So this section is about the trajectory, not the ask.

> **What's shipped.** The dashboard is in production. Action queue, four alert surfaces (bell, banner, blocking modal, `/alerts` page), state-announcement pipeline with sub-24h SLA, two-tier AI confidence on every match (parse + match), live design-partner usage. PRD v0.8 + IA v0.7 + architecture v0.7 are concrete and synced. Backend on Hono + tRPC + Drizzle + Supabase; AI service on Claude Sonnet 4.5.
>
> **What's next on the body.** The flagship daily flow — Pattern 2, the chase loop — needs Mode A (auto-checklist), Mode C (sanity-check on incoming docs), Mode D (drafted reminder emails) to ship together so the CPA experiences the full *"recall → confirm → draft → send"* loop on day one. Method A per-task forwarding addresses are infrastructure for that.
>
> **What's next on the engine.** Mode B (per-client timing) and Mode E (cross-year anomalies) come online when import Tier 3 lands — prior-year material checklists from tax-software exports. That's the moment the Year-2 retention thesis activates: the customer goes from "AI helps me chase" to *"AI knows my clients better than I remember."*
>
> **What's next on the wedge.** Mode F state-monitoring health goes from internal SLO to a customer-facing trust surface — *"50 of 50 states monitored, last scrape 14m ago"* visible everywhere a state alert can appear. The corpus is currently 2 years backfilled; we extend to 5 years through P1.
>
> **The trajectory we're underwriting.** Year 1 — *granularity replication* (the painpoint half-1: 保持服务颗粒度). Year 3 — *advisory awakening* via Layer B and the Opportunities sidebar (painpoint half-2: 扩展业务). Year 5 — *firm brain*, captured partner judgment that survives turnover. Each year's value compounds on the previous year's data — that's the moat.

---

## 10 · Close (20 sec)

> The CPA bottleneck is supply-side. AI doesn't replace the CPA — it lifts the ceiling. Every client gets the granularity that today only the top 10 receive. Yan Jing told us the test: *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* We built the architecture around that promise. The §5.3 invariant — *AI never auto-promotes to received_confirmed* — is the price of his trust, and we paid it at the database layer.
>
> The product is **the customer's words made into software.** That's the line.

**[Speaker note]** End on the customer's voice, not yours. *"The product is the customer's words made into software."* — that's the takeaway you want them to repeat.

---

## Transitions (between sections, for reference)

- §1 → §2: *"That demo is possible because of one assumption no incumbent has made."*
- §2 → §3: *"And that insight isn't a hunch — it's the conclusion of one of the longest user-research synthesis docs you'll see at this stage."*
- §3 → §4: *"Let me show you what that supply-side bottleneck looks like at the bench."*
- §4 → §5: *"Here's what Sarah sees instead, on Monday morning."*
- §5 → §6: *"This is a product you couldn't build five years ago."*
- §6 → §7: *"And the timing maps to a market we can frame honestly."*
- §7 → §8: *"Pricing reflects layer-not-suite explicitly."*
- §8 → §9: *"Here's where we are, and here's what compounds next."*
- §9 → §10: *"And here's why we think this is a category, not a feature."*

---

## What's strong about this narrative

1. **The user research is unusually deep for a pre-launch product.** 660 lines of synthesis with one 15-year partner running a 600-client firm. PRD §0.5 has a 57-row interview→decision traceability table. Most pitches at this stage cannot point to that table.
2. **The shipped product is real.** The dashboard is in production. Action queue, four alert surfaces, state-announcement pipeline with sub-24h SLA, two-tier AI confidence chips, four shipped onboarding routes. We can demo it from cold-open, on a phone if needed.
3. **The painpoint is founder-locked in two languages.** *"CPA 时间精力有限，没法把对 10 个客户的精细服务复制到 100 个客户."* Yuqi locked this 2026-04-30 after multi-round refinement. The framing is supply-side capacity, not service-quality segmentation. The discipline of holding this one frame is itself a signal.
4. **Three architectural anti-patterns rejected.** Document vault (forever-no, PRD §1.7). 4-layer architecture (collapsed to 3 in v0.8 after Yuqi pushback). Top-vs-bottom client segmentation (rejected — every client deserves the same granularity).
5. **The architecture pays for the trust model.** §5.3 invariant — AI never auto-promotes to `received_confirmed` — is enforced at the DB layer with a CHECK constraint. The customer told us the price; we paid it.

## Open questions to keep honest about

1. **The wedge alone is not enough.** State alerts are demoable but a "once a quarter" feature for the average CPA. If the body — Modes A through D — doesn't ship close to launch, the wedge alone won't retain. Body before wedge-deepening is the sequencing rule.
2. **Yan Jing's voice is loud, n=1.** PRD §14.1 calls this out. The depth of the design-partner relationship is the asset; the n=1 is the qualifier. Validating with 1–3 person firms before treating insights as gospel.
3. **Market-size numbers are knowledge-based.** Bottom-up math holds, but firm-count assumptions need sourced AICPA / IBISWorld replacement before any external use.
4. **State-announcement corpus is the medium-durable moat** (PRD §1.6). The flywheel and the integrate-don't-replace posture are the durable ones. Lean on those, not the corpus alone.

## Sources

- **Interview synthesis:** `~/Downloads/duedatehq-PRD/Interview Notes — 15-Year CPA Founder, 10-Person Firm .rtf` (660 lines)
- **Interview→decision traceability:** PRD v0.8 §0.5 (57 rows)
- **Painpoint (Yuqi-locked, 2026-04-30):** `~/.claude/projects/.../memory/painpoint_summary.md`
- **Product strategy:** PRD v0.8 §1–§4 at `~/Downloads/duedatehq-PRD/duedatehq-prd-v0.8.md`
- **Personas + Sarah's three failure modes:** `personas.md` memory
- **Customer journey 8 stages × 3 personas:** `/Users/yuqi/Desktop/DueDateHQ_dashboard/files/strategy-03-customer-journey.md`
- **Wedge framing:** `feedback_state_notif_plus_actions.md` memory + PRD §8.5
- **Gap-over-fill design rule:** `feedback_gap_over_fill.md` memory
- **Competitive matrix:** `/Users/yuqi/Desktop/DueDateHQ_dashboard/files/competitive-matrix.md`
- **Positioning (Moore + Dunford + Onliness):** `files/strategy-01-positioning.md`
- **Pricing + risks:** PRD v0.8 §13, §14
- **Forever-no list:** `forever_no.md` memory + PRD §1.7
- **Shipped product:** React app at `/Users/yuqi/Desktop/DueDateHQ_dashboard`
