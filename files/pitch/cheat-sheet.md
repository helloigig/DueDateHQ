# DueDateHQ — One-Page Cheat Sheet

*Skill: startup-pitch | Generated: 2026-05-05*
*The artifact for "someone just asked me what I'm building." Memorize. Don't read.*

---

## The 2-sentence opener (memorize verbatim)

> A solo CPA can give 10 clients fine-grained service. She physically can't replicate that across 100. **DueDateHQ runs the parts of that service a machine can do — Memory, Predictions, Confirmation, Monitoring, Drafting — across her entire book.**

> 中文 (Yuqi-locked, 2026-04-30): *"CPA 的时间精力有限，没法把对 10 个客户的精细服务复制到 100 个客户，无法 scale up. DueDateHQ 把服务拆成可被机器接管的事情，保持服务颗粒度的同时可以扩展业务."*

---

## The insight (one sentence)

> Every CPA software vendor assumes the CPA *picks* which clients get fine-grained service. They don't. They run out of hours. The bottleneck is **supply-side capacity, not strategic segmentation.**

## The test (one question)

> **"Would Lacerte's organizer give this same answer?"** If yes, we haven't built anything new. Mechanical rollover is the floor. Pattern recognition is the product.

---

## The six load-bearing customer quotes (each tied to a build decision)

| Quote | Build payoff |
|---|---|
| *"600 个客户如果每个人都去问一下的话，那好多时间花在."* | The supply-side ceiling. Behavioral evidence: ~50 clients clearly, fuzzy on 100, 450 only via records. |
| *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* | §5.3 invariant: AI never auto-promotes to `received_confirmed`. **Enforced at the DB with a CHECK constraint.** |
| *"你不能 1 月 1 号开始就问了."* | Mode B per-client timing prediction. P1 — needs multi-year history. The Year-2 retention thesis. |
| *"我有 40 个软件工具，新东西最大的担心是它跟其他工具不说话."* | Tier 0 integrations are Day-1 threshold, not Phase 2. Karbon route, not TaxDome route. |
| *"内核可能 50 年了."* (CCH Axcess) | CCH on forever-no list. |
| *"600 个客户都得到他对前 50 个客户那样的关注."* | Granularity replication = the headline framing in PRD §1.3. |

---

## The wedge (one moment)

> Last Tuesday Louisiana announced a hurricane filing extension. Within 4 hours, the dashboard showed 6 affected clients, 8 deadlines to extend, 6 emails drafted in tone. **Karbon and TaxDome customers found out from a client complaint.** No incumbent has this.

## The moat (three layers, ranked by durability)

1. **Strategic posture** (most durable) — integrate, don't replace. Incumbents structurally can't ship a layer.
2. **Client intelligence flywheel** (long-term durable) — 3 years of imports + 6 months of email watching = no competitor matches on Day 1.
3. **State announcement corpus** (medium durable) — 50-state, 2-year backfill. Closeable in 18 months by a well-funded competitor — don't bet the company on this one.

---

## Trajectory (one line per year)

- **Year 1** — granularity replication. Wedge ships; Modes A+C+D ship; Pattern 2 chase-loop lands.
- **Year 2** — engine activation. Modes B + E ship behind import Tier 3. *"AI helps me chase"* → *"AI knows my clients better than I remember."*
- **Year 3** — advisory awakening. Layer B Opportunities sidebar; pricing power → $200–500/seat.
- **Year 5** — firm brain. Layer C; mid-tier firms at $1K–5K/seat.

---

## The proof (when someone asks "show me")

- **660-line interview synthesis** with our design partner Yan Jing (15-year CPA, 10-person firm, 600 clients, 20 states, 40 software tools).
- **57-row interview→decision traceability table** in PRD §0.5. Every v0.6→v0.7 product decision traces to a specific interview line.
- **Customer journey doc** covers 8 stages × 3 personas (Sarah Mitchell primary, Jennifer Wu compliance-driven, David Park onboarding-gauntlet).
- **Shipped product.** Action queue, four alert surfaces, state-announcement pipeline with sub-24h SLA, two-tier AI confidence chips. Demo-ready cold.

---

## The closing line (memorize)

> **The product is the customer's words made into software.**

Use it as the last thing they hear. Don't follow it with anything.

---

## Three things to remember about delivery

1. **Bilingual quotes are sticky.** The Chinese cadence — *"你不能 1 月 1 号开始就问了"* — is memorable even to English-only listeners. Use it once, slowly.
2. **Pause after the customer's voice, not yours.** When you finish a Yan Jing quote, do not fill the silence. Let it sit. The room is doing the work for you.
3. **End with a question.** *"What do you want to dig into first — the research, the wedge, or the architecture?"* > "Thanks for listening."

---

## What NOT to say

- ❌ "AI for accountants" (every pitch says this; invisible)
- ❌ "Your AI will get smarter as it learns" (banned product copy — PRD §1.6)
- ❌ "We're disrupting the $40B accounting software market" (top-down TAM is a tell)
- ❌ "We're like X for Y" (only works if listener immediately gets X — CPA market is too niche)
- ❌ "X years of combined experience" (filler)

---

*Source: distilled from `pitch-full.md`, `intake.md`, Interview Notes RTF (660 lines), PRD §0.5 traceability table.*
