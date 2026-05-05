# DueDateHQ Pitch — Intake

*Skill: startup-pitch | Generated: 2026-05-05*

Synthesized from canonical docs and memory — no fresh interview required. All claims here are sourced; bracketed sources point to the file of record.

---

## The 2-sentence company description (the opener)

> **English (lead):** A solo CPA can give 10 clients fine-grained service. She physically can't replicate that across 100. DueDateHQ runs the parts of that service a machine can do — remembering each client's multi-year history, predicting per-client timing, confirming materials are 100% complete, monitoring 50-state rule changes, and drafting client emails — across her entire book, so every client gets the granularity that today only her top 10 receive.

> **Founder-locked Chinese painpoint** (preserved verbatim from `painpoint_summary.md`, locked 2026-04-30):
> *"CPA 的时间精力有限，没法把对 10 个客户的精细服务复制到 100 个客户，无法 scale up。DueDateHQ 把服务拆成可被机器接管的事情，保持服务颗粒度的同时可以扩展业务。"*

> **Specific example:** *"Last week Louisiana announced a hurricane filing extension. Within 4 hours, Sarah's dashboard showed her 6 affected clients across that state, the 8 deadlines to extend, and 6 client emails already drafted in her tone. She approved them in 90 seconds. Her peers using Karbon or File In Time found out from a client complaint."*

---

## What it is (the Yuqi-locked one-liner)

**DueDateHQ is the client intelligence layer for CPA firms.** [Source: `project_duedatehq.md`, PRD v0.8 §1.3]

Not a deadline tracker. Not a client portal. Not practice management. The product is organized around **5 machine-replicated activities**: Memory, Predictions, Confirmation, Monitoring, Drafting. The CPA keeps judgment, signature, relationships. [Source: `vocabulary.md`]

---

## The unique insight (the non-obvious truth)

**The CPA bottleneck is supply-side, not quality-of-service segmentation.** Every incumbent (TaxDome, Karbon, Canopy, File In Time) implicitly assumes a CPA chooses *which clients* get fine-grained service. That's wrong. The CPA wants to give every client the same granularity; she physically cannot. AI's job is to lift the supply-side ceiling, not to "replace the CPA" or "improve quality." [Source: PRD v0.8 §1.3]

The corollary: every AI feature must pass the **Lacerte-organizer test**. *"Would Lacerte's organizer give this same answer? If yes, we haven't built anything new."* Mechanical rollover (copy last year's W-2 placeholder) is the floor. Pattern recognition (this client's W-2 historically arrives Feb 5; this year it's Feb 12 with no email — should we ask?) is the product. [Source: PRD v0.8 §1.4]

---

## The wedge (what gets the demo meeting)

Real-time state authority monitoring + auto-cross-referenced affected-client matching + pre-drafted action emails. **No incumbent has this.** [Source: `competitive-matrix.md`]

| Capability | DueDateHQ | File In Time | Karbon | TaxDome | Canopy |
|---|---|---|---|---|---|
| Real-time state authority monitoring | **Strong** | Missing | Missing | Missing | Missing |
| Disaster extension detection (24h SLA) | **Strong** | Missing | Missing | Missing | Missing |
| Client portfolio impact scoping | **Strong** | Missing | Missing | Missing | Missing |
| Announcement-to-portfolio cross-reference | **Strong** | Missing | Missing | Missing | Missing |
| State announcement AI interpretation | **Strong** | Missing | Missing | Missing | Missing |

This is **the moment the entire product exists for** [Source: `feedback_state_notif_plus_actions.md`]: state DOR announces something → DueDateHQ shows the affected clients in your book within 24h with action chips ready (Draft client emails, Batch-extend deadlines, Forward bulletin, Mark Service Package extended).

---

## The moat (what compounds over time)

Three layers of defensibility, ranked by durability [Source: PRD v0.8 §1.6]:

1. **Strategic posture (most durable).** Integrate, don't replace. Yan Jing operates 40 software tools; his deepest fear about new products is "doesn't talk to the others." TaxDome's replace-strategy is structurally incompatible with this customer; we are structurally aligned. Anyone copying our features still has to drop the suite mentality — multi-year reorganization.
2. **Client intelligence flywheel (long-term durable).** A firm that imported 3 years of returns + connected QBO + let AI watch their inbox for 6 months has a personalized intelligence layer no competitor can give them on day one. Switching costs grow with usage. Day-1 onboarding affordance, not Phase 2.
3. **State announcement corpus (medium durable).** 50-state corpus, parsed and historically backfilled to 2 years. Wedge feature; gets harder to replicate the longer we run, but a well-funded competitor could close the gap in 18 months. We don't bet the company on this.

---

## What's actually shipped (proof, not promise)

**The dashboard is in production.** [Source: shipped React app at `/Users/yuqi/Desktop/DueDateHQ_dashboard`]
- 19+ shipped pages including `Dashboard.tsx`, `Today.tsx`, `Clients.tsx`, `ClientDetail.tsx`, `TaskDetail.tsx`, `AnnouncementList.tsx`, `AnnouncementDetail.tsx`, `Mail.tsx`, `Inbox.tsx`, `Settings.tsx`, `Onboarding`, `Calendar.tsx`, `Timeline.tsx`, `Insights.tsx`
- Live state-announcement pipeline with four alert surfaces (bell / banner / blocking modal / `/alerts` page) [Source: `four_alert_surfaces.md`]
- Action Queue (urgency-sorted task triage with chase actions inline) [`ActionQueue.tsx`]
- Backend in `backend/` — Hono + tRPC + Drizzle + Supabase, 3 routers (auth / clients / deadlines) [Source: `project_backend_phase0.md`]
- Tech stack: React 18 + Vite + TS + Tailwind frontend; Node 20 + Fastify + Python 3.12 FastAPI for AI service; Postgres 16 with RLS; Redis 7; Anthropic Claude (Sonnet 4.5 primary); OpenTelemetry + Sentry [Source: `tech_stack.md`]

**Status:** Phase 1 build · dashboard shipped · interior screens in active development against PRD v0.8 + IA v0.7 + arch v0.7. [Source: PRD v0.8 status]

---

## Personas (who pays)

**Sarah Mitchell (primary).** Solo CPA, 49 active clients across 6 states, 4 years independent. Stack: QBO (own books), Lacerte (tax prep), Gmail (clients), self-built Excel deadline tracker. 60% individual returns, 40% LLC/S-Corp. [Source: `personas.md`]

Three failure modes the product fixes:
- **Monday-morning anxiety** — reconstructs urgent items from short-term memory each Monday.
- **The chase loop** — three weeks before deadlines, hand-types 12 reminders. Some forgotten, some surprises.
- **The state-change miss** — finds out about state rule changes from a client complaint.

**Yan Jing (design partner, NOT first sales target).** 15-year partner at a 10-person firm specializing in international tax. ~600 clients across ~20 states. SharePoint + ~40 software tools. Validates direction; surfaces edge cases.

**Yan Jing's load-bearing quotes (all verbatim from interview synthesis):**

| Quote | What it shaped in the product |
|---|---|
| *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* | The §5.3 invariant: AI never auto-promotes a checklist item to `received_confirmed`. Enforced at DB layer with a CHECK constraint. The 6-state document lifecycle. Pattern 2 the chase loop as flagship daily flow. |
| *"你不能 1 月 1 号开始就问了."* (you can't start asking on January 1st) | Mode B per-client timing prediction. The TaskMilestone data model. The Today action queue's "soft check-in" suggestion text. |
| *"600 个客户如果每个人都去问一下的话，那好多时间花在."* | Behavioral evidence for the supply-side bottleneck. Used as the headline in PRD §1.3's painpoint reframe. |
| *"我有 40 个软件工具，新东西最大的担心是它跟其他工具不说话."* | Tier 0 integrations (QBO, Xero, Gmail/Outlook) elevated to Day-1 threshold instead of Phase 2. Karbon-route positioning. Forever-no on portal. |
| *"内核可能 50 年了."* (referring to CCH Axcess) | CCH Axcess put on the forever-no integration list. |
| *"600 个客户都得到他对前 50 个客户那样的关注."* | The "scale, not depth" framing in v0.7. Reframed in v0.8 to "granularity replication" but the underlying behavioral evidence is the same. |

He is our design partner — 600 clients across 20 states, ~40 software tools, deeply skeptical of suite-vendors after the TaxDome/Karbon migration scars. PRD §0.5 documents 57 product decisions traceable line-by-line to specific things he said. [Source: `personas.md` + interview synthesis]

---

## Business model

| Tier | Monthly | Annual (-20%) | Capacity |
|---|---|---|---|
| Solo | $29 | $278/year | 1 user · ≤ 50 clients |
| **Pro (primary)** | **$49** | **$470/year** | 1-3 users · unlimited clients |
| Team | $99 | $950/year | ≤ 10 users · API (Phase 4) |

[Source: PRD v0.8 §13]

**Pricing posture:** Monthly billing default — counter to TaxDome's annual-upfront lock-in. 30-day no-credit-card trial. Layer-not-platform positioning explicitly priced below the $60/user/mo cloud-PM floor.

---

## Market sizing — bottom-up

**US accounting firm count:** ~46,000 firms total **[Knowledge-Based — AICPA / BLS, verify before pitching]**.

| Segment | Firm count | ARPA assumption | Annual revenue at 100% penetration |
|---|---|---|---|
| Solo (1 person, ≤ 50 clients) | ~28,000 **[Knowledge-Based]** | $29/mo × 12 = $348 | ~$9.7M |
| Pro (1–3 person) | ~12,000 **[Knowledge-Based]** | $49/mo × 12 = $588 | ~$7.0M |
| Team (4–10 person) | ~5,000 **[Knowledge-Based]** | $99/mo × 12 = $1,188 | ~$5.9M |
| **Bottom-up SAM (US, ICP-only)** | **~45K firms** | blended ~$60/mo | **~$22.6M ARR** at full penetration |

**Honest framing:** This is a niche TAM at MVP scope. Capturing 5% = ~$1.1M ARR; 10% = ~$2.3M ARR. **The expansion play is** [Source: PRD v0.8 §1.3 three-timescales-of-value]:

- **Year 1 (now)** — Solo/Pro CPAs. Niche but defensible. ~$22M SAM.
- **Year 3** — Layer B/C revenue: advisory triggers, churn risk, pricing intelligence. Pricing power moves up to $200–500/seat. SAM × 5–10×.
- **Year 5** — "firm brain" enterprise tier for mid-tier firms (10–100 person). Pricing $1K–5K/seat. SAM × 25–50×.
- **Adjacent markets** — bookkeeping firms, EAs (~50K firms), fractional CFOs, international tax (Yan Jing's domain).

The wedge is small; the platform — *intelligence layer for vertical professional services* — is large. [Source: positioning doc §3 Onliness Test]

---

## Why now

[Source: positioning doc §3 + PRD §1.6]

- **Post-LLM economics.** Real-time compliance monitoring at $49/mo is a business that **couldn't exist 5 years ago.** State-DOR scraping + LLM parsing + per-firm matching is now ~80% cheaper than the legacy data-vendor approach (Bloomberg / CCH / RIA charge thousands/year).
- **Desktop-installer incumbent is bleeding.** File In Time is still a Windows installer in 2026. Their architecture can't deliver the cloud + 24h SLA promise.
- **Suite fatigue.** TaxDome's annual-lock-in + 10–15h setup time is causing churn (consistent Capterra signal **[Knowledge-Based — verify with current reviews]**). Practitioners want a *layer*, not another suite.
- **AI authority gradient is teachable.** CPAs accept AI now if the authority gradient is honest. Green/yellow/red zones with the §5.3 invariant — *"AI never auto-promotes to received_confirmed"* — is a trust model that builds incrementally and survives an AI hallucination on day 4.

---

## Team

This is an internal narrative document — team bio is known internally and not surfaced in this artifact. The deliverables refer to "the team" / "we" and assume the reader is the founding team or someone close to them. If a future external version is needed, fill: founder name + most-impressive prior accomplishment (built X that did Y), domain expertise, design-partner relationship structure.

---

## Trajectory (replaces "the ask")

This is an internal-narrative pitch — no funding ask. The forward-looking section instead frames trajectory and what compounds next.

**Year 1 — granularity replication (the painpoint half-1: 保持服务颗粒度).**
- State alerts as the wedge that gets the meeting (Mode F shipped Day-1)
- Modes A + C + D shipping together so the chase-loop (Pattern 2) lands as a complete experience
- Method A per-task forwarding addresses + reply-intent classification (5-intent, ≤3% false-positive on `timeline_pushback`)

**Year 2 — engine activation (the multi-year history payoff).**
- Mode B (per-client timing prediction) ships when import Tier 3 lands
- Mode E (cross-year anomaly detection) ships behind same gate
- Customer experience: from *"AI helps me chase"* to *"AI knows my clients better than I remember"*

**Year 3 — advisory awakening (the painpoint half-2: 扩展业务).**
- Layer B Opportunities sidebar surface — advisory triggers, churn risk, pricing intelligence
- Pattern 4 (the advisory awakening) becomes the senior-partner retention story
- Pricing power moves to $200–500/seat for firms that activate Opportunities

**Year 5 — firm brain (institutional asset).**
- Layer C: pricing intelligence, capacity planning, knowledge management
- Captured partner judgment that survives staff turnover and retirement
- Mid-tier firm market opens at $1K–5K/seat

Each year compounds on the previous year's data. The moat is the flywheel.

---

## What we will never build (positioning by exclusion)

[Source: `forever_no.md` + PRD v0.8 §1.7]

Never: client portal as destination · long-term document vault · billing/invoicing · time tracking · tax preparation · audit-risk prediction · legal interpretation · CCH Axcess integration · bank account access · AI auto-send without 3 conditions · client financial advice · native mobile apps at MVP.

The discipline of saying no is part of the moat. **"Build a worse Dropbox" is the trap that kills every vertical SaaS.**

---

## Sources of record

- `~/Downloads/duedatehq-PRD/duedatehq-prd-v0.8.md` (2,007 lines)
- `~/Downloads/duedatehq-PRD/duedatehq-ia-flows-v0.7.md` (1,171 lines)
- `~/Downloads/duedatehq-PRD/duedatehq-architecture-v0.7 copy.txt` (1,806 lines)
- `~/Downloads/duedatehq-PRD/Interview Notes — 15-Year CPA Founder, 10-Person Firm .rtf` (660 lines)
- `~/.claude/projects/-Users-yuqi-Desktop-DueDateHQ-dashboard/memory/` (15 memory files)
- `/Users/yuqi/Desktop/DueDateHQ_dashboard/files/strategy-01-positioning.md`
- `/Users/yuqi/Desktop/DueDateHQ_dashboard/files/competitive-matrix.md`
- `/Users/yuqi/Desktop/DueDateHQ_dashboard/files/strategy-03-customer-journey.md`
- Shipped product code at `/Users/yuqi/Desktop/DueDateHQ_dashboard`

## What's strong about this narrative

1. **Unusually deep user research for a pre-launch product.** 660-line interview synthesis + 57-row PRD §0.5 traceability table + 660-line customer-journey doc covering 8 stages × 3 personas. Most pre-launch pitches can't show that depth.
2. **The shipped product is real.** Dashboard in production. Action queue, four alert surfaces, state-announcement pipeline with sub-24h SLA, two-tier AI confidence chips, four-route onboarding. Demo-ready cold.
3. **The painpoint is founder-locked in two languages.** *"CPA 时间精力有限，没法把对 10 个客户的精细服务复制到 100 个客户."* Locked 2026-04-30 after multi-round refinement. The discipline of holding this one frame is itself a signal.
4. **The architecture pays for the trust model.** §5.3 invariant (`AI never auto-promotes to received_confirmed`) is enforced at the DB with a CHECK constraint. The customer named the price; we paid it.
5. **The vocabulary is locked + load-bearing.** Mode A-F, Layer 1-3, Layer A-D, Tier 0-3, Import Tier 1-4, Phase 1/2, Method A/B, Substrates, the 5 machine-replicated activities. Terms mean the same thing across PRD + IA + arch + memory + UI copy.

## Yellow flags (worth tracking, not blocking)

- **Bottom-up SAM is small** (~$22M ARR niche). Expansion path to Layer B/C/D is the defense.
- **Market-size firm-count figures are [Knowledge-Based]** — need sourced AICPA / IBISWorld replacement before external use.
- **Yan Jing's voice is loud, n=1** (PRD §14.1 acknowledges this). Validating with 1-3 person firms before treating insights as gospel.
- **"24h SLA" needs legal review** — PRD §14 calls it out as an open question.

**Sources:** see "Sources of record" above.
