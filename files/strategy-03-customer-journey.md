# DueDateHQ — Customer Journey Map

> Sarah Mitchell's 12-month journey, from awareness through renewal. Shows where emotional low points sit (= design priorities) and where competitive alternatives re-enter the decision.

---

## Journey 1 — Sarah Mitchell (primary persona · solo CPA · 80 clients · multi-state)

### Stages at a glance

| Stage | Timeframe | Core question | Dominant emotion | Churn risk |
|---|---|---|---|---|
| 1. Awareness | Q4 (Oct–Dec) | *"Is there a better way?"* | Exhausted, skeptical | N/A |
| 2. Evaluation | Q4–Q1 (Nov–Jan) | *"Will this actually help me?"* | Hopeful, guarded | N/A |
| 3. Onboarding | First 7 days | *"Can I get my 80 clients in?"* | Frustrated → relieved | **High** |
| 4. First triage (activation) | Day 3–14 | *"Is this really 5 min instead of 45?"* | Suspicious → impressed | **High** |
| 5. Filing season use | Jan–Apr | *"Don't let me miss anything"* | Anxious, focused | Medium |
| 6. State announcement event | Any time | *"Am I exposed?"* | Panic → relief | **Critical** |
| 7. Off-season | May–Sep | *"Do I still need this?"* | Calm, cost-sensitive | **High** |
| 8. Renewal | Month 12 | *"Worth another $588?"* | Reflective | **High** |

---

### Stage 1 · Awareness (Q4, pre-filing-season)

**What's happening:** Sarah is cleaning up from the previous season. The memory of the grind is fresh. She sees a LinkedIn post from another CPA about missing a state extension.

| Dimension | Detail |
|---|---|
| **Doing** | Scrolling LinkedIn; Googling "tax deadline tracker"; asking in CPA Discord/Slack |
| **Thinking** | *"There must be something better than this Excel sheet."* |
| **Feeling** | Exhausted from the season, skeptical of new tools (burned by TaxDome) |
| **Touchpoints** | LinkedIn posts by other CPAs, SEO from `/changes` page, Discord/Slack mentions |
| **Pain points** | Too tired to evaluate; no trust that a new tool will be better |
| **Opportunity zones** | 🎯 Public announcement backfill at `duedatehq.com/changes` doubles as SEO; content marketing via LinkedIn posts about specific past extensions |
| **Success signal** | Sarah bookmarks DueDateHQ; doesn't sign up yet |

---

### Stage 2 · Evaluation

**What's happening:** Sarah returns in late November to actually evaluate. She's comparing against Karbon ($5k/yr, too much), File In Time ($199/mo, desktop), and "just stay in Excel."

| Dimension | Detail |
|---|---|
| **Doing** | Reading landing page; checking pricing; looking for no-credit-card trial |
| **Thinking** | *"Is this another TaxDome? Will I get locked in with an annual plan?"* |
| **Feeling** | Hopeful but guarded; scanning for deal-breakers |
| **Touchpoints** | Landing page, pricing page, trial signup |
| **Pain points** | Annual-upfront trauma from TaxDome; fear of wasted setup time |
| **Opportunity zones** | 🎯 Make "monthly billing, no annual lock-in" visible above the fold; surface "you can export everything" as a trust signal, not a deflection |
| **Success signal** | Starts a 30-day trial, no credit card |

---

### Stage 3 · Onboarding (day 0–7) — 🔴 HIGHEST LEVERAGE STAGE

**What's happening:** David Park persona lives here. 60% of CPAs abandon every tool they've ever trialed *at this step*. If Sarah doesn't get 80 clients in within 30 minutes, she's gone.

| Dimension | Detail |
|---|---|
| **Doing** | Exporting CSV from her Excel sheet / existing tool; uploading; mapping fields; assigning Service Packages |
| **Thinking** | *"If this is harder than the last three tools, I'm out."* |
| **Feeling** | Low-grade dread → relief (if AI field mapping works) OR rage (if it doesn't) |
| **Touchpoints** | Import wizard, field-mapping UI, Service Package suggestions, empty-state dashboard |
| **Pain points** | (a) Fuzzy field names in her CSV; (b) not knowing which Service Package fits an unusual client; (c) wall-of-text empty state |
| **Opportunity zones** | 🎯 **AI field-mapping confidence score visible at each row** — CPAs trust math, not magic; 🎯 "Import 5 clients to start" escape hatch for the CPA who won't do a full migration; 🎯 First-screen celebration ("your full-year calendar is ready") |
| **Success signal** | ≥ 10 clients imported in ≤ 30 min (PRD §8 activation metric) |
| **Failure signal** | Closes tab after field-mapping screen (track this; instrument heavily) |

---

### Stage 4 · First triage (activation)

**What's happening:** Sarah opens the app Monday morning. This is the moment of truth for the "45 → 5 min" promise.

| Dimension | Detail |
|---|---|
| **Doing** | Scanning "This week" panel; clicking three deadlines; marking one Complete |
| **Thinking** | *"OK, this is actually showing me what I need. But is it right?"* |
| **Feeling** | Suspicion → surprise → cautious optimism |
| **Touchpoints** | Triage dashboard, deadline detail, Complete/Defer buttons |
| **Pain points** | Trust calibration: *"did it really generate the right deadlines?"* — will cross-check against her old sheet the first two weeks |
| **Opportunity zones** | 🎯 Every deadline shows source + "Service Package X → Form 1120-S → due Mar 15" trace so she can verify; 🎯 "Compared to your old sheet" diff view as an optional sanity-check surface |
| **Success signal** | Returns to app ≥ 3× in week 1 (WAU target 85% in-season) |

---

### Stage 5 · Filing season use (Jan–Apr)

**What's happening:** Sarah lives in the app 3–5 times per week. Muscle memory forms. She might invite her virtual assistant as a Pro-tier second seat.

| Dimension | Detail |
|---|---|
| **Doing** | Weekly triage, client reminders, marking done, occasional batch-adjust |
| **Thinking** | *"Where's the next overdue? Any state news? Did Smith reply with his docs?"* |
| **Feeling** | Focused, mildly anxious, occasionally triumphant |
| **Touchpoints** | Dashboard (daily), client-prep-reminder emails (T-30/14/7), email from app for state announcements |
| **Pain points** | Client non-response to reminder emails; wanting to assign a specific deadline to her VA |
| **Opportunity zones** | 🎯 Mobile-web read-only triage when she's with a client; 🎯 Lightweight note-per-deadline for quick "waiting on docs from X" |
| **Success signal** | Weekly triage session median = 3–5 min (PRD §8) |

---

### Stage 6 · State announcement event — 🔴 DIFFERENTIATOR MOMENT

**What's happening:** Louisiana DOR posts a hurricane extension at 3pm Thursday. This is the moment the entire product exists for.

| Dimension | Detail |
|---|---|
| **Doing** | Gets email ("6 clients affected — view list"); clicks; batch-adjusts deadlines; sends reminder emails to affected clients |
| **Thinking** | *"Thank god I didn't have to find this myself."* |
| **Feeling** | Brief panic (*"did I miss something?"*) → relief → professional pride (*"I told clients before they asked"*) |
| **Touchpoints** | Email, dashboard banner, affected-clients list, batch-adjust UI, official-source link |
| **Pain points** | Wants to verify the system is right before mass-adjusting; wants to forward the official source to clients |
| **Opportunity zones** | 🎯 "Verify on official source" link prominent at top of each announcement; 🎯 Forward-to-client one-click with pre-written copy referencing the official announcement; 🎯 Announcement appears in the public `/changes` page within 24h (reinforces trust + brings SEO traffic) |
| **Success signal** | 40% click-through → adjust (PRD §8 Story 3 impact); this is the moment Sarah tells another CPA |

---

### Stage 7 · Off-season (May–Sep)

**What's happening:** Tax activity drops. Sarah opens the app weekly, then biweekly. This is when TaxDome-style annual billing wins and month-to-month tools lose.

| Dimension | Detail |
|---|---|
| **Doing** | Occasional check-in; updating client list; maybe trying a competitor on the side |
| **Thinking** | *"Am I still getting value? $49/mo × 12 = $588 — worth it?"* |
| **Feeling** | Calm, cost-sensitive, nostalgic about how bad last season was |
| **Touchpoints** | Quarterly deadline reminders (estimated taxes!), occasional state-announcement emails |
| **Pain points** | Can rationalize pausing if product feels dormant |
| **Opportunity zones** | 🎯 Quarterly-estimated-tax workflow is the off-season hook (June 15, Sep 15 — still in season for this); 🎯 "Last filing season in numbers" annual summary email (deadlines tracked, announcements caught, time saved); 🎯 Low-pressure annual-discount upsell in Q3 (prep for next season) |
| **Success signal** | Doesn't cancel in July; annual upgrade in August/September |

---

### Stage 8 · Renewal (month 12)

**What's happening:** First anniversary. Sarah asks herself if she'd feel panic if it disappeared.

| Dimension | Detail |
|---|---|
| **Doing** | Deciding month-to-month vs annual; maybe adding a second seat |
| **Thinking** | *"Can I imagine going back to Excel? No."* |
| **Feeling** | Reflective; mildly loyal if filing season went well |
| **Touchpoints** | Renewal email, annual-discount offer, optional NPS survey |
| **Pain points** | None if filing season was smooth; high if any missed deadline (even if product-caused or not) |
| **Opportunity zones** | 🎯 Renewal moment = referral moment (incentivize with 1 month free per referred CPA); 🎯 Annual summary doubles as marketing artifact she shares with peers |
| **Success signal** | 12-month retention ≥ 70% (PRD §8) |

---

## Journey 2 — Jennifer Wu (compliance-risk persona) — divergence points

Jennifer's journey tracks Sarah's, with three key differences:

| Stage | Jennifer differs by |
|---|---|
| Awareness | Arrives via a *specific incident* (the LA County extension she missed), not general curiosity — higher conversion intent |
| Evaluation | Evaluates Story 3 (state announcements) before Story 1 — she wants to see the `/changes` page *first* |
| Filing season | Heavier reliance on state-announcement flow; 10× more likely to click "view affected clients" |
| Renewal | Highest renewal probability of any persona — she's already lived the "what if I missed this" counterfactual |

**Design implication:** the public `/changes` page is Jennifer's top-of-funnel.

---

## Journey 3 — David Park (conversion persona) — the gauntlet

David never completes onboarding in any tool. He's the tripwire for the import experience:

| Stage | David's version |
|---|---|
| Evaluation | Has trialed 4+ competitors; highly skeptical |
| Onboarding | Will quit at the 3rd client if CSV mapping is manual |
| First triage | Only reached if onboarding was ≤ 30 min |

**Design implication:** every onboarding friction point needs to survive *David's* patience, not Sarah's.

---

## Cross-journey opportunity ranking (where to invest design effort)

| Rank | Opportunity | Journey stage | Why it matters |
|---|---|---|---|
| 1 | Onboarding / import flow | Stage 3 | 60% of trials die here; largest conversion lever |
| 2 | State-announcement email → affected-clients → batch-adjust | Stage 6 | This is the differentiator; every happy-path interaction here compounds into word-of-mouth |
| 3 | First-triage dashboard | Stage 4 | Product's daily identity; every other surface is downstream of this |
| 4 | Public `/changes` backfill page | Stage 1 | Dual-duty: SEO top-of-funnel + trust-building proof |
| 5 | Off-season quarterly workflow | Stage 7 | Cheapest retention intervention; without it churn spikes May–Sep |
| 6 | Annual renewal / referral moment | Stage 8 | Growth loop; each renewed Sarah can convert 1–2 peers |

---

*Inputs: personas §2 and pain points §3 of [01-product-brief.md](./01-product-brief.md), Story 1/2/3 loops from [duedatehq-prd.md](./duedatehq-prd.md) §6.*
