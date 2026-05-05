# DueDateHQ — Pitch Deck

*Skill: startup-pitch | Generated: 2026-05-05 | 18 slides · ~10 minutes*

This is the deck spec. Each slide has: **on-slide copy** (sparse — what the audience reads), **visual direction** (what to render), **speaker notes** (what you say), and **source** (where the content came from). Port to Pitch / Keynote / Slides / Reveal.js / Figma — the spec is tool-agnostic.

**Design language:**
- **Type:** Inter for UI text, Source Serif 4 for pull-quotes (matches the dashboard's design tokens — see `DESIGN.md`)
- **Color:** dark-on-warm-cream backgrounds for data slides (calm); state-alert chip palette only when showing a real alert (escalation tiers from `escalationTier()` helper)
- **Quote slides:** cream background, large serif quote, attribution chip below in lowercase ink-tone
- **Density rule:** every slide ≤ 30 words on screen unless it's a quote. Words live in your mouth, not the slide.
- **Bilingual signal:** Yan Jing's three load-bearing quotes appear in Chinese first, English subtitle below. The cadence is the point.

---

## Slide 1 — Title

**On slide:**
> # DueDateHQ
> *The client intelligence layer for CPA firms.*
>
> duedatehq.space · May 2026

**Visual:**
- Logo lockup top-left
- The tagline in serif, ~48pt, generous whitespace
- Subtle background: a faint contour of a state map or a clean grid, 8% opacity max
- No metrics, no images of people, no AI iconography

**Speaker notes (15 sec):**
> Hi. This is DueDateHQ. We're building the client intelligence layer for solo and small CPA firms. Before I tell you what we do, let me tell you what just happened to one of our users last Tuesday.

**Source:** `painpoint_summary.md`, positioning doc §1, `project_duedatehq.md`

---

## Slide 2 — Opening moment

**On slide:**
> ## Last Tuesday, 3:14 PM CT
>
> Louisiana DOR posted a hurricane filing extension.
>
> **By 7:08 PM the same day:**
> 6 affected clients identified.
> 8 deadlines extended.
> 6 emails drafted.
>
> Her competitors found out from a client.

**Visual:**
- Render the actual `AnnouncementBanner` from the dashboard — Louisiana state chip, "Hurricane Delta extension · 2h ago," AI confidence pills
- Screenshot the affected-client list on the right at 60% scale
- Time on the slide animates in if the deck supports it: 3:14 → 7:08

**Speaker notes (40 sec):**
> Louisiana DOR posted a hurricane filing extension at 3:14 PM Central. By 7:08 the same day, our user had six affected clients identified, eight deadlines extended, and six client emails drafted in her tone. She approved them in 90 seconds. Her peers using TaxDome and Karbon — they found out from a client complaint. **No incumbent has this. We've checked.**

**Source:** `feedback_state_notif_plus_actions.md` memory, customer journey Stage 6, `AnnouncementBanner.tsx`

---

## Slide 3 — What we do (the 2-sentence opener)

**On slide:**
> A solo CPA can give 10 clients fine-grained service.
> She physically can't replicate that across 100.
>
> **DueDateHQ runs the parts a machine can do — across her entire book.**
>
> *Memory · Predictions · Confirmation · Monitoring · Drafting*

**Visual:**
- Two-column ratio: left — outline of one human icon serving 10 client icons (clean, geometric); right — same human serving 100 client icons but with five small machine glyphs in the middle handling the multiplier
- Avoid AI/robot aesthetic. Geometric, not ornamental.

**Speaker notes (30 sec):**
> Here's what we do, in two sentences. A solo CPA can give 10 clients fine-grained service. She physically cannot replicate that across 100. We run the parts of that service a machine can do — Memory, Predictions, Confirmation, Monitoring, Drafting — across her entire book. **Every client gets the granularity that today only her top 10 receive.**

**Source:** PRD v0.8 §1.3, `vocabulary.md`, `painpoint_summary.md`

---

## Slide 4 — The insight

**On slide:**
> ## The bottleneck is supply-side.
> Not strategic segmentation.
>
> Every incumbent assumes the CPA *picks* which clients get fine-grained service.
> They don't. They run out of hours.

**Visual:**
- A simple bar chart, hand-drawn aesthetic: x-axis "client #1 → #100", y-axis "service granularity"
- Red dotted line at "client #50" labeled *"the ceiling"* — left of it the bars are tall, right of it short
- Annotation arrow: *"AI lifts this ceiling"*

**Speaker notes (45 sec):**
> Here's the insight. Every CPA software vendor — TaxDome, Karbon, Canopy, File In Time — implicitly assumes the CPA *picks* which clients get fine-grained service. Top clients get attention; the bottom of the book gets standardized everything. **That assumption is wrong.** CPAs don't pick. They run out of hours. The constraint is supply-side capacity, not strategic segmentation. AI's job isn't to replace the CPA. It's to lift the ceiling.

**Source:** PRD v0.8 §1.3, the locked Chinese painpoint

---

## Slide 5 — The test

**On slide:**
> ## "Would Lacerte's organizer give this same answer?"
>
> If yes, we haven't built anything new.
>
> Mechanical rollover is the floor.
> **Pattern recognition is the product.**

**Visual:**
- Two-column compare table:
  - Left: *Lacerte rollover* — "copy last year's W-2 placeholder" / "re-use last year's checklist" / "carry forward dependents"
  - Right: *DueDateHQ* — "this client's W-2 historically arrives Feb 5; this year Feb 12 with no email — should we ask?" / "Schedule E on the checklist 5 years, gone this year — did the client sell the rental?" / "K-1 from Apex Fund hasn't arrived by April 8 — flag for early extension"
- Left column: pale gray. Right column: full ink contrast.

**Speaker notes (40 sec):**
> Here's the test we run on every feature. *"Would Lacerte's organizer give this same answer?"* If yes, we haven't built anything new. Lacerte's rollover is mechanical — copy last year's W-2 placeholder. Pattern recognition is what we ship: *"This client's W-2 historically arrives Feb 5; this year it's Feb 12 with no email — should we ask?"* That's the product.

**Source:** PRD v0.8 §1.4

---

## Slide 6 — Where the insight came from

**On slide:**
> ## This isn't speculation.
>
> 660-line interview synthesis.
> One 15-year design partner.
> 600 clients across 20 states.
>
> **57 product decisions traceable to the source.**

**Visual:**
- Three stacked counter cards: `660` lines · `57` rows · `1` design partner — minimalist, ink-on-cream
- Below the counters, a thin rendering of the actual PRD §0.5 traceability table at low fidelity (just enough to read "Interview insight | Decision in v0.7 | PRD section" headers)

**Speaker notes (40 sec):**
> That insight isn't a hunch. It came from a 660-line synthesis with one 15-year CPA partner running a 10-person firm and 600 clients. PRD section 0.5 is a 57-row table mapping every interview insight to a specific product decision. Most pre-launch companies cannot show that table. We can.

**Source:** PRD v0.8 §0.5, Interview Notes RTF (660 lines)

---

## Slide 7 — Yan Jing quote 1: the ceiling

**On slide:**
> *"600 个客户如果每个人都去问一下的话，那好多时间花在."*
>
> — Yan Jing, 15-year CPA partner
>
> *"If I asked every one of 600 clients individually, that's a lot of time."*

**Visual:**
- Cream background, single large pull-quote in serif, Chinese first
- Below the attribution: a tiny inline annotation chip — `→ supply-side ceiling, PRD §1.3`
- No image. The quote is the visual.

**Speaker notes (25 sec):**
> Three quotes are load-bearing. First — on the bottleneck. *"If I asked every one of 600 clients individually, that's a lot of time."* He admitted, indirectly, that he can't. He keeps about 50 clients in his head clearly, fuzzy on 100, the other 450 only via records. **That's the ceiling we're lifting.**

**Source:** Interview Notes RTF, PRD §1.3

---

## Slide 8 — Yan Jing quote 2: the wedge

**On slide:**
> *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."*
>
> — Yan Jing
>
> → §5.3 invariant
> → AI never auto-promotes to `received_confirmed`
> → DB-level CHECK constraint enforces it

**Visual:**
- Same cream pull-quote layout
- Below the quote, a code-fragment tile in mono-type:
  ```
  CHECK (
    state != 'received_confirmed'
    OR confirmed_by_user_id IS NOT NULL
  )
  ```
- A small chip linking to `architecture-v0.7 §5`

**Speaker notes (35 sec):**
> Second quote — on the wedge. *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* So we built the architecture around it. The §5.3 invariant — *"AI never auto-promotes a checklist item to received_confirmed"* — is enforced at the database with a CHECK constraint. **The customer named the price of trust. We paid it.**

**Source:** Interview Notes RTF, PRD v0.8 §5.3

---

## Slide 9 — Yan Jing quote 3: per-client timing

**On slide:**
> *"你不能 1 月 1 号开始就问了."*
>
> — Yan Jing
>
> *"You can't start asking on January 1st."*
>
> → Mode B: per-client arrival timing prediction
> → Activates when import Tier 3 lands (multi-year history)

**Visual:**
- Pull-quote layout matches slides 7 + 8 (consistency = stickiness)
- Bottom strip: a tiny render of an actual TodoItem from the dashboard — *"Emily Chen — W-2 7 days past her pattern. Suggested action: soft check-in (draft ready)."*

**Speaker notes (30 sec):**
> Third quote — on timing. *"You can't start asking for materials on January 1st."* Each client has their own arrival pattern. His K-1 from one fund historically arrives in August; another client always drags to early April. So Mode B is per-client timing prediction based on multi-year history. It's the second-year retention thesis: the customer goes from *"AI helps me chase"* to *"AI knows my clients better than I remember."*

**Source:** Interview Notes RTF, PRD v0.8 §4.3 Mode B

---

## Slide 10 — The 5 machine-replicated activities

**On slide:**
> ## What machines can do
>
> **Memory** — multi-year client history
> **Predictions** — per-client expected timing
> **Confirmation** — material 100% verification
> **Monitoring** — 50-state regulatory changes
> **Drafting** — outbound communications
>
> ## What stays human
>
> Judgment · Signature · Relationships

**Visual:**
- Two-column slide. Left column larger (5 items, weighted ink). Right column smaller, italicized.
- Each item on the left has a tiny iconograph (geometric, not anthropomorphic): a stack for Memory, a curve for Predictions, a check for Confirmation, a wave for Monitoring, an envelope for Drafting

**Speaker notes (30 sec):**
> The five things a machine can replicate: Memory, Predictions, Confirmation, Monitoring, Drafting. The CPA keeps the three things a machine cannot: judgment, signature, relationships. This is the operational decomposition of the painpoint. Every feature in the product traces to one of these five.

**Source:** PRD v0.8 §1.5 + §4.0, `vocabulary.md`

---

## Slide 11 — The problem (Sarah Mitchell)

**On slide:**
> ## Sarah Mitchell · solo CPA · 49 clients · 6 states
>
> **Monday-morning anxiety**
> Reconstructs urgent items from short-term memory each Monday.
>
> **The chase loop**
> Hand-types 12 reminders, 3 weeks before any deadline.
>
> **The state-change miss**
> Finds out from a client complaint, not from her tools.

**Visual:**
- A clean three-card layout — each failure mode in its own card, ink-on-cream, weighted equally
- Tiny illustration per card: a calendar (Monday), an envelope stack (chase loop), a bell with a slash (state-change miss)
- No stock photo of "stressed accountant"

**Speaker notes (35 sec):**
> Sarah Mitchell. Solo CPA. 49 active clients across 6 states. She has three failure modes every week. Monday-morning anxiety — every Monday reconstructed from short-term memory. The chase loop — twelve reminder emails hand-typed before any deadline. The state-change miss — she finds out from a client complaint, not from her tools. She'll pay $49 a month to fix all three. She will *not* switch to TaxDome and re-learn her stack.

**Source:** `personas.md`, customer journey, PRD v0.8 §2.2

---

## Slide 12 — The solution (the dashboard, live)

**On slide:**
> ## What Sarah sees on Monday morning
>
> *(live screenshot)*

**Visual:**
- Full-bleed screenshot of the actual `Today` dashboard from the shipped React app
- Annotation overlays:
  - Top callout (state-alert band): *"Surfaces only when actionable"*
  - Action queue callout: *"Sorted by urgency_score · 9 sources collapsed to 4 verbs"*
  - Bottom callout: *"`waiting_multiplier` · gap-over-fill"*
- Subtle "Live in production" stamp top-right corner

**Speaker notes (50 sec):**
> This is what she actually sees. Top of the screen — a state-alert band, conditional, gone when nothing's actionable. Below it the action queue, sorted by urgency, nine sources of work collapsed into four verbs the user reads: Send. Confirm. Apply. Discuss. Click any row, you get a focused review surface — never a fire-and-forget button. The whole experience privileges the *gap*, not the fill. Loudest visual on every screen: *"what hasn't the client sent yet?"* Confirmed items collapse by default. **The painpoint is the gap; everything else is decoration.**

**Source:** Shipped `Dashboard.tsx`, `ActionQueue.tsx`, `feedback_gap_over_fill.md`, IA v0.7 §3.1

---

## Slide 13 — The architecture (the trust layer)

**On slide:**
> ## The architecture pays for the trust model
>
> **Six document states.** One non-negotiable:
> *AI never auto-promotes to `received_confirmed`.*
>
> Enforced at: DB CHECK constraint · application layer · AI authority gradient.
>
> Three zones:
> 🟢 AI acts · 🟡 AI proposes, CPA approves · 🔴 AI must not opine.

**Visual:**
- A 6-state machine diagram (left): `not_requested → requested_waiting → received_unreviewed → received_confirmed`, plus side branches `received_issue` and `not_applicable`
- The arrow into `received_confirmed` has a small lock icon labeled "human only"
- Right column: green/yellow/red zone column with one example each

**Speaker notes (40 sec):**
> Trust is architectural, not aspirational. Six document states; one invariant: AI never auto-promotes a checklist item to "received confirmed." Enforced at the database, the application layer, and the AI authority gradient. Three zones — green where AI acts, yellow where it proposes and the CPA approves, red where it never opines. Tax owed, audit risk, legal interpretation — red zones. We will never touch them.

**Source:** PRD v0.8 §5, §4.5, architecture v0.7

---

## Slide 14 — Why now

**On slide:**
> ## Three things changed
>
> **LLM economics**
> State-DOR scraping + per-firm matching: $3–5/firm/mo.
> 5 years ago: thousands per year as a Bloomberg feed.
>
> **Desktop incumbents bleeding**
> File In Time still ships a Windows installer in 2026.
>
> **Suite fatigue**
> TaxDome locks customers in for a year. 10–15h setup. Churn is real.

**Visual:**
- Three-column layout, each with a single tile + one number
- Column 1: `$3–5/mo` with subscript "vs Bloomberg's $thousands/yr"
- Column 2: a tiny screenshot of File In Time's Windows installer dialog
- Column 3: pull-quote sample from CPA Discord — *"被 TaxDome 锁了一年，再也不想被锁了"*

**Speaker notes (40 sec):**
> Why now. Three things changed. One — LLM economics. State-DOR scraping plus per-firm matching costs us three to five dollars per firm per month. Five years ago that was a Bloomberg-data-feed business. Two — desktop incumbents are bleeding. File In Time, the closest direct competitor, still ships a Windows installer in 2026. Three — suite fatigue is real. TaxDome locks customers in for a year and takes 10–15 hours to set up. The market is begging for a layer.

**Source:** `tech_stack.md`, competitive matrix, positioning doc §3

---

## Slide 15 — Market sizing (bottom-up)

**On slide:**
> ## The wedge — bottom-up SAM
>
> US accounting firms ≈ 46K
> ICP (solo–10 person) ≈ 45K
> Blended ARPU ≈ $60/mo
>
> **= ~$22M ARR fully penetrated.**
>
> *Small. We know.*

**Visual:**
- Single horizontal stacked bar: 28K Solo + 12K Pro + 5K Team firms, color-coded by tier
- ARPU label below each segment ($348 / $588 / $1,188)
- Right side: $22M number in large weight
- Footnote: `[Knowledge-Based — AICPA / IBISWorld; source before external use]`

**Speaker notes (35 sec):**
> Market sizing. Bottom-up. The US has roughly forty-six thousand accounting firms. Our ICP — solo, one-to-three person, four-to-ten — is about forty-five thousand. Blended ARPU at our pricing is sixty dollars a month. That's a twenty-two million dollar fully-penetrated SAM in the launch wedge. **It's small. We know.**

**Source:** `intake.md` market sizing, PRD §13 pricing

---

## Slide 16 — Why it's still a category bet

**On slide:**
> ## The wedge → the platform
>
> **Year 1** · Granularity replication. ~$22M wedge.
> **Year 3** · Layer B advisory triggers. $200–500/seat.
> **Year 5** · Firm brain. Mid-tier at $1K–5K/seat.
>
> + adjacent verticals — bookkeepers, EAs, fractional CFOs, international tax.
>
> *Wedge is small. Intelligence layer for vertical professional services is not.*

**Visual:**
- A staircase / step-chart climbing left-to-right with each year's pricing tier as a step height
- Dotted line above the staircase labeled "adjacent verticals · 5× firm count"
- Single Yan Jing pull-quote at the bottom — *"$1,500 charged for work the market prices at $2,400"* (the pricing-leakage example)

**Speaker notes (45 sec):**
> Year three we ship Layer B — advisory triggers, churn risk, pricing intelligence — and pricing power moves from forty-nine dollars a seat to two-to-five hundred a seat. Yan Jing's pricing-leakage example sits behind this — *"fifteen hundred charged for work the market prices at twenty-four hundred."* Year five, firm brain, opens mid-tier firms at a thousand to five thousand a seat. Adjacent verticals — bookkeepers, EAs, fractional CFOs, international tax — same architecture, five-times the firm count. Wedge is small. The platform is not.

**Source:** PRD v0.8 §1.3 timescales, Interview Notes §8.1 pricing

---

## Slide 17 — Where we are + what's next

**On slide:**
> ## Shipped
> Action queue · 4 alert surfaces · state pipeline (sub-24h SLA)
> 19+ pages in production · two-tier AI confidence chips
>
> ## Next on the body
> Modes A + C + D shipped together → chase-loop body lands
>
> ## Next on the engine
> Mode B + Mode E behind import Tier 3 → Year-2 retention thesis
>
> ## Next on the wedge
> State-monitoring health goes customer-facing

**Visual:**
- Four-quadrant layout, each quadrant a small status card
- The "Shipped" quadrant has a pale-green ✓ stamp; the next-three quadrants have countdown indicators (no specific dates — "in flight")
- Below: a thin status strip showing "PRD v0.8 · IA v0.7 · architecture v0.7 — synced 2026-04-30"

**Speaker notes (40 sec):**
> Where we are. Dashboard shipped. Action queue, four alert surfaces — bell, banner, blocking modal, full alerts page — state-announcement pipeline with sub-twenty-four-hour SLA. Two-tier AI confidence chips on every match. Nineteen pages in production. PRD, IA, architecture all at sync as of April thirtieth. Next on the body — Modes A, C, D shipping together so the chase-loop lands as one experience. Next on the engine — Mode B and E behind multi-year history imports. Next on the wedge — state-monitoring health goes from internal SLO to customer-facing trust signal.

**Source:** `build_priorities.md`, IA v0.7, shipped product

---

## Slide 18 — Close

**On slide:**
> *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."*
>
> — Yan Jing
>
> ## We built the architecture around his words.
>
> ## The product is the customer's words made into software.

**Visual:**
- The Yan Jing quote takes ⅔ of the slide in serif
- Below it, the closing line in slightly smaller weight but still serif
- Bottom-right corner: small `duedatehq.space` wordmark
- That's it. No logo. No bullet points. No arrows.

**Speaker notes (25 sec):**
> One closing thought. Yan Jing told us the test: *"Solve this one pain and I'm definitely your first customer."* We built the architecture around his words. The §5.3 invariant is the price of his trust, and we paid it at the database layer. **The product is the customer's words made into software.** That's the line. Take whatever you want to dig into next.

**Source:** Interview Notes RTF, PRD v0.8 §5.3

---

## Pacing budget

| Slides | Cumulative time |
|---|---|
| 1–2 (open + Louisiana hook) | 0:55 |
| 3–5 (what + insight + test) | 2:50 |
| 6–9 (research backbone, 3 quotes) | 5:00 |
| 10–13 (5 activities, problem, solution, architecture) | 7:30 |
| 14–16 (why now, market, expansion) | 9:30 |
| 17–18 (status, close) | 10:35 |

Plan for ~10:30 with one demo pause at slide 12. If you have to cut, drop slides 9 and 13 — slide 8 carries the trust-architecture thesis already, and slide 13 deepens it but isn't load-bearing.

---

## Build instructions (when you port to a real tool)

**Recommended target order:**

1. **Pitch.com or Keynote first** — fastest to a working artifact, exports to PDF + video. Drop the on-slide copy from each section here verbatim; build the visuals using the design language at the top of this file.
2. **Reveal.js** if you want a browser-presentable version that lives in the repo. The dashboard's design tokens (Tailwind config + CSS variables) are already there; reveal.js can consume them.
3. **Figma** if the deck is also a sales asset for the design partner conversation. Use Auto Layout; one frame per slide; export to PDF.

**What the visuals must NOT look like:**
- No "AI" iconography (no neural nets, no glowing brains, no robot illustrations). The product is *the customer's words made into software*; the visual identity should reflect calm professionalism, not techno-aspiration.
- No stock photos of "stressed CPA" or "diverse team." Use real product screenshots, real quotes, real numbers.
- No gradient backgrounds. Cream, ink, one accent color (the same orange as the alert-banner escalation tier in the dashboard).

**Typography pairing the deck inherits from the product:**
- Inter (UI text) + Source Serif 4 (pull-quotes + headings)
- Quote slides ALL use serif; data slides use sans
- Consistent baseline grid; generous line-height for the Chinese pull-quotes

---

## Sources

- All on-slide content distilled from `pitch-full.md` (10-min narrative)
- Customer quotes from Interview Notes RTF (660 lines) at `~/Downloads/duedatehq-PRD/`
- Yuqi-locked painpoint from `painpoint_summary.md` memory
- Visual cues from shipped `Dashboard.tsx` + `AnnouncementBanner.tsx` + `ActionQueue.tsx`
- Design language from `DESIGN.md` + `feedback_design_system_shadcn.md`
- Pacing budget calibrated against the 10-min `pitch-full.md` arc

## Red flags

- The architecture slide (13) names a CHECK constraint shape — verify against the actual schema before showing externally; the spec form here is illustrative.
- Market-size figures are knowledge-based; replace with sourced AICPA/IBISWorld before any external use.
- The "live in production" stamp on slide 12 is true today (dashboard shipped) — keep verifying before each external use.
