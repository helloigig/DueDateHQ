# Pitch — 5 Minutes: DueDateHQ

*Skill: startup-pitch | Generated: 2026-05-05 (v2 — internal narrative)*

~5 min, ~850 words. Internal-rehearsal version. No funding ask. Each section trimmed to one core claim + one supporting proof from the research record.

---

## 1 · What we do (30s)

A solo CPA can give 10 clients fine-grained service. She physically can't replicate that across 100. **DueDateHQ runs the parts of that service a machine can do — Memory, Predictions, Confirmation, Monitoring, Drafting — across the entire book.** The CPA keeps judgment, signature, relationships.

> Last Tuesday Louisiana announced a hurricane filing extension. Within four hours, Sarah's dashboard showed her six affected clients, eight deadlines to extend, and six emails drafted in her tone. Her peers using Karbon found out from a client complaint.

**[Pause. Let "client complaint" land.]**

---

## 2 · The insight (45s)

Every incumbent — TaxDome, Karbon, Canopy, File In Time — assumes the CPA *chooses* which clients get fine-grained service. Top clients get attention; the bottom gets standardized everything. **That's wrong.** CPAs don't choose; they run out of hours. The constraint is supply-side capacity.

So our test on every feature is one question: **"Would Lacerte's organizer give this same answer?"** If yes, we haven't built anything new. Mechanical rollover is the floor. Pattern recognition — *"this client's W-2 historically arrives Feb 5; this year it's Feb 12 with no email — should we ask?"* — is the product.

---

## 3 · The research that produced it (60s)

We have a 660-line synthesis with our design partner Yan Jing — 15-year CPA partner running a 10-person, 600-client firm. PRD §0.5 documents 57 product decisions traceable to specific things he said. Three quotes are load-bearing:

> *"600 个客户如果每个人都去问一下的话，那好多时间花在."* He clearly remembers ~50 clients, fuzzy on 100, the other 450 only via records. **That's the supply-side ceiling.**
>
> *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* That's why §5.3 is non-negotiable architecture: AI never auto-promotes a checklist item to `received_confirmed`. We enforce it at the database layer with a CHECK constraint. The customer named the price of trust; we paid it.
>
> *"你不能 1 月 1 号开始就问了."* You can't start chasing materials on January 1st — every client has their own arrival pattern. That's Mode B per-client timing prediction. P1 because it needs multi-year history, but it's the second-year retention thesis.

The deeper takeaway: **AI value isn't "AI helps you do this year's tax." It's "AI learns how you served clients for 5 years, and makes you 5× more efficient this year."** Multi-year history is the engine.

---

## 4 · The problem (30s)

Sarah, solo CPA, 49 clients across 6 states (composite from `personas.md` and the customer journey doc). Three failure modes every week: Monday-morning anxiety (no system view), the chase loop (12 reminders typed by hand, three weeks before deadlines), and the state-change miss (finds out from clients, not tools). She'll pay $49/month to make these go away. She will *not* switch to TaxDome and re-learn her stack — *"被 TaxDome 锁了一年"* is recurring trauma in the CPA Discord we've sampled.

---

## 5 · The solution (45s)

Open DueDateHQ Monday morning. State-alert band at the top — only when actionable: *"Louisiana DOR · Hurricane Delta · six of your clients · six emails drafted."* Below it, the action queue: *"Emily — W-2 7 days past her pattern. Suggested action: soft check-in, draft ready."* Click, review, send. 30 seconds.

Visual hierarchy privileges **the gap**, not the fill. Loudest element on every screen: *"what hasn't the client sent yet?"* Confirmed items collapse by default. **The painpoint is the gap; everything else is decoration** — Yuqi's `feedback_gap_over_fill.md` rule, applied to Task detail, Client list, Today, Timeline, Mailbox, Engagement.

---

## 6 · Why now (30s)

Three things changed: **LLMs** dropped the cost of state-DOR scraping + per-firm matching from thousands per year to $3–5 per firm per month. **Desktop incumbents** are bleeding — File In Time is still a Windows installer in 2026. **Suite fatigue** — TaxDome's annual lock-in and 10–15h setup is causing measurable churn (Capterra signal). Market is begging for a layer, not another suite. Yan Jing's quote backs it: *"我有 40 个软件工具，新东西最大的担心是它跟其他工具不说话."* Incumbents structurally can't ship a layer.

---

## 7 · Market (30s)

US has ~46K accounting firms; ICP is ~45K solo-to-10-person. Blended ARPU $60/mo. **Bottom-up SAM ~$22M ARR at full penetration in the launch wedge.** That's small.

**Year 3** we ship Layer B (advisory triggers, churn risk, pricing intelligence) → pricing moves to $200–500/seat. Yan Jing's pricing-intelligence example sits behind this: *"$1,500 charged for work the market prices at $2,400."* **Year 5 firm-brain** opens mid-tier firms at $1K–5K/seat. **Adjacent verticals** — bookkeepers, EAs, fractional CFOs, international tax — same architecture, 5× firm count. Wedge small; intelligence layer for vertical professional services large.

---

## 8 · Business model (20s)

Solo $29 · Pro $49 · Team $99 monthly. **No annual lock-in** — deliberate counter to TaxDome. 30-day no-credit-card trial. Activation: 5-min first triage, 30-min full setup, ongoing deepening as integrations connect. The 5/30/ongoing structure came directly from interview §2 — *"don't make Day-1 import everything."*

---

## 9 · Where we are + what's next (30s)

Dashboard shipped. Action queue, four alert surfaces, state-announcement pipeline with sub-24h SLA, two-tier AI confidence chips. PRD v0.8 + IA v0.7 + arch v0.7 synced. Yan Jing's 10-person, 600-client firm running it as design partner.

Next on the body: Modes A + C + D shipping together so the chase-loop (Pattern 2) lands as a complete experience. Next on the engine: Mode B + Mode E behind import Tier 3 — the moment the customer goes from *"AI helps me chase"* to *"AI knows my clients better than I remember."* Next on the wedge: state-monitoring health surfaces from internal SLO to customer-facing trust signal.

---

## 10 · Close (15s)

The CPA bottleneck is supply-side. AI lifts the ceiling. Yan Jing told us the test — *"Solve this one pain and I'm your first customer"* — and we built §5.3 into the database to keep it. **The product is the customer's words made into software.**

---

## Pacing notes

- **Total target:** 5:00. Sections 2 + 3 + 5 are the load-bearing sections; spend the time there.
- **Where to slow down:** the Lacerte test (§2), the three quotes (§3), and the demo (§5). These are where the depth gets felt.
- **Where to speed up:** §7 market math — drop the bottom-up number, name the expansion, move on.
- **Where to pause:** after the Louisiana example (§1), after each verbatim quote in §3 (let Chinese-language quotes breathe — they signal authenticity), after the SAM (§7). Five pauses across 5 minutes.

## What's strong

The depth of user research grounding is the single most credible asset. 660-line interview synthesis + 57-row traceability table + 660-line customer journey + locked Chinese painpoint = a depth of evidence most pre-launch products can't match.

## Sources

See `pitch-full.md`, `intake.md`. Key: Interview Notes RTF (660 lines), PRD v0.8 §0.5 traceability, customer journey 3-persona doc.
