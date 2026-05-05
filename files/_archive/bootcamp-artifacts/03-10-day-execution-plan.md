# DueDateHQ — 10-Day Execution Plan

> Round 1 delivery: full working demo (UX + frontend + backend) in 10 days.
> Today is Day 1 (April 21, 2026 · Monday). Presentation is Day 10 (April 30).

---

## Shape of the 10 days

```
Days 1–3  │ Research & Narrow    │ 30% effort
Days 4–7  │ Build Core           │ 50% effort
Days 8–10 │ Polish & Present     │ 20% effort
```

**The research phase is the most compressed** — normally you'd spend 5 days here. In 10 days you have 3. That means you can't iterate on users; you interview once, learn fast, decide, move.

**The build phase is tighter than it looks** — 4 days for frontend + backend + one AI feature. This forces ruthless scope: one story executed deeply, not three executed shallowly.

---

## Daily breakdown

### Day 1 — Monday · Today · Outreach & Context

**Goal:** Outreach sent, calls booked, brain warmed on the domain.

| Time | Task |
|------|------|
| Morning (2h) | **Outreach blitz.** Run the 2-hour checklist from `02-user-research-playbook.md`. All 5 channels, all templates sent. |
| Mid-morning (1h) | **Vocabulary + context.** Read vocab cheat sheet, Google PTE + Nexus + disaster extension. 15 min each. |
| Afternoon (2h) | **Competitor UI study.** Screenshots of File In Time, Karbon, TaxDome, Canopy. What do they do visually? What do they miss? One-page notes. |
| Afternoon (1h) | **Reframing doc.** Write a one-page "here's how I'd reframe the brief." Includes: one-sentence thesis, which story is the spine (Story 1 vs Story 3), one surprising decision you'd make. This is your presentation seed. |
| Late day (30m) | **Reply to early responders.** Schedule calls aggressively for Day 2 afternoon and Day 3. |
| End of day (30m) | **Day 1 reflection.** 3 things you learned today. 3 things you still don't understand. 1 thing that surprised you. |

**Checkpoint:** At least 2 calls on the calendar for Day 2 or 3. If you end Day 1 with zero calls booked, send 10 more LinkedIn messages tonight.

---

### Day 2 — Tuesday · First Interviews

**Goal:** 1–2 real conversations. Specific quotes captured.

| Time | Task |
|------|------|
| Morning | **Interview prep.** 30 min: re-read question bank, personalize for the first interviewee (look up their LinkedIn, firm website, note anything specific you can reference) |
| Morning | **Interview #1** (20 min call) |
| Post-call (30m) | **Immediate synthesis.** 5 exact quotes, 3 things you didn't know, 1 thing that contradicts the brief. |
| Afternoon | **Interview #2** (20 min call) |
| Post-call (30m) | **Immediate synthesis.** Same ritual. |
| Late afternoon (1h) | **Start wireframing Story 1.** Just pencil sketches. The 5 screens you think you need. |
| End of day (1h) | **Day 2 synthesis.** One page: patterns, contradictions to brief, surprising specifics, open questions, implications for product. |

**Checkpoint:** If you've spoken to 2 real CPAs, you're ahead of everyone else in the bootcamp. If you've spoken to 0, the research plan has failed — don't continue to Day 3 build; send 20 more LinkedIn messages and push a day. This is the most important unlock.

---

### Day 3 — Wednesday · Decide & Design

**Goal:** The slice is chosen. Screens are designed. Environment is ready to build.

| Time | Task |
|------|------|
| Morning | **Interview #3 if scheduled.** Otherwise skip. |
| Morning (1h) | **Decision doc.** Write 1 page: Which story am I building? (Recommend: Story 1, weekly triage dashboard.) Which 3–5 screens? What am I cutting? What's the one surprising design decision? |
| Mid-morning (2h) | **Wireframes → mid-fidelity mockups.** In Figma. The 3–5 screens for Story 1. Don't get lost in visual polish yet — structure + hierarchy + key interactions. |
| Afternoon (2h) | **Data model design.** What entities do you have? (Client, Deadline, State, TaxType, Extension.) What are the relationships? Write it down before coding. |
| Afternoon (2h) | **Dev environment.** Next.js / React / your stack of choice. Repo initialized. Basic routing. Tailwind or your preferred styling. Deploy to Vercel or similar so you can share a URL when ready. |
| End of day (30m) | **Scope lock.** Write down: these are the 5 things I will build. Everything else is out of scope. This list becomes your guardrail. |

**Checkpoint:** If you don't have a clear scope by end of Day 3, tomorrow's build will drift. A fuzzy spec is the #1 reason bootcamp demos feel unfinished.

---

### Day 4 — Thursday · Frontend Scaffold + Dashboard Skeleton

**Goal:** The main dashboard renders. Navigation works. Static data.

| Time | Task |
|------|------|
| Morning (3h) | **Layout + navigation.** App shell, sidebar, top bar, main content area. Empty state for each route. |
| Afternoon (3h) | **Dashboard grid.** The three-tier grouping (Due this week / This month / Long term). Hardcoded mock data for now. Real typography, real spacing, real visual hierarchy. |
| Late (2h) | **Design-quality pass.** Make it look good. This is where your designer background is a superpower — most engineers will ship gray rectangles. You should ship something that looks like a real product. |

**Checkpoint:** By end of Day 4, opening your localhost shows a dashboard that already feels like a product. If it looks like a todo app or a generic admin template, back up and treat Day 5 as a design day.

---

### Day 5 — Friday · Core Interactions

**Goal:** The triage experience works. Filter, status toggle, countdown.

| Time | Task |
|------|------|
| Morning (3h) | **Filter panel.** By client, by state, by form type. Under 1-second response. Visual feedback on filter state. |
| Afternoon (3h) | **Status management.** One-click completed/deferred/in-progress. Visual state change is crisp. Persists across reload (for now, use localStorage). |
| Late (2h) | **Countdown logic + visual urgency.** Day-level countdown. Visual treatment for "this week" vs "this month." A deadline 2 days out should *feel* urgent. |

**Checkpoint:** By end of Day 5, you should be able to do a 30-second weekly triage demo using only the frontend. No backend yet, but the experience is real.

---

### Day 6 — Saturday · Backend + Data

**Goal:** Real data flowing. Persistence works.

| Time | Task |
|------|------|
| Morning (3h) | **Database + schema.** Postgres via Supabase or Neon (fastest setup). Seed with realistic deadlines: all federal IRS dates for 2026, plus 2–3 states (pick CA, TX, NY for diversity). Don't try to build 50 states — fake the depth, show the pattern. |
| Afternoon (3h) | **API routes.** CRUD for clients, deadlines, statuses. Filter endpoints. Auth (use Clerk or Supabase Auth — don't hand-roll). |
| Late (2h) | **Wire frontend to backend.** Replace mock data with real queries. Loading states. Error states. |

**Checkpoint:** End of Day 6, you have a real app. Not a prototype — a real working app where you can log in, see your clients, update statuses, and have changes persist.

---

### Day 7 — Sunday · The AI Feature

**Goal:** One AI feature that makes the demo land.

**Pick ONE:**

| Option | Difficulty | Demo impact |
|--------|------------|-------------|
| **Smart priority ranking** (Story 1) | Low | Medium |
| **Announcement semantic parsing** (Story 3) | Medium | High |
| **CSV import with entity-type recognition** (Story 2) | Medium | Medium |

**Recommendation: Announcement semantic parsing on a canned CA extension notice.** Paste a real IRS disaster-relief announcement into the app, have Claude/Gemini parse it, identify affected client criteria (state, county, tax type), and match against your client list. This is the sharpest differentiator demo and it's the *business* of the product.

| Time | Task |
|------|------|
| Morning (3h) | **API integration.** Claude or Gemini API. Simple prompt first — give it an announcement, extract state/county/dates/tax types as JSON. |
| Afternoon (3h) | **Matching logic.** Given parsed announcement, query your client database for matches. Return a list. |
| Late (2h) | **UI integration.** Add a banner at the top of the dashboard: "California just announced an extension. 3 of your clients are affected." One-click to see the list. |

**Checkpoint:** End of Day 7, you have a magic moment — paste an announcement, see your affected clients. This IS the product.

---

### Day 8 — Monday · User Test & Iterate

**Goal:** 1 CPA tries it. You fix the top 2–3 issues.

| Time | Task |
|------|------|
| Morning | **Call 1 of your earlier interviewees.** 20 min. Share screen, let them click around. Shut up. Watch what confuses them. |
| Post-call (1h) | **Triage feedback.** Categorize into: must-fix, should-fix, nice-to-fix. Pick only 2–3 must-fix for today. |
| Afternoon (4h) | **Fix the must-fixes only.** Resist the urge to polish everything. |
| Late (2h) | **Second user test if available.** Or: give it to a teammate for fresh eyes. |

**Checkpoint:** End of Day 8, the demo handles the actions a real user would take without breaking. Not perfect, but functional.

---

### Day 9 — Tuesday · Polish & Rehearse

**Goal:** Visual polish done. Presentation drafted and rehearsed.

| Time | Task |
|------|------|
| Morning (3h) | **Visual polish pass.** Spacing, typography, icons, empty states, loading states. This is your superpower — lean in. Target: when someone sees it, they think "this was made by someone with taste." |
| Afternoon (2h) | **Presentation deck or narrative script.** 5 slides or 5 beats: (1) real user quote that opens, (2) the reframing argument, (3) live demo of triage, (4) the AI moment, (5) what I cut and why. |
| Afternoon (2h) | **Rehearse 3× out loud.** Time yourself. Cut anything that doesn't earn its place. Your thesis in one sentence without looking. |
| Late (1h) | **Pre-demo check.** Does the app work on your presentation laptop? Deployed version loads fast? Backup plan if live demo fails? Screenshots ready? |

**Checkpoint:** End of Day 9, you could present tomorrow if asked. Day 10 is buffer + final touches, not the first time you practice.

---

### Day 10 — Wednesday · Present

**Goal:** Present. Land tier 1.

| Time | Task |
|------|------|
| Morning (2h) | **Final polish.** Typos, icon alignment, one last pass of the demo flow. |
| Morning (1h) | **One final rehearsal.** Full presentation, out loud, timed. |
| Before the presentation (30m) | **Reset.** Walk. Coffee. Don't change anything in the last hour. |
| Presentation | **Lead with the quote.** "Sarah from [state] told me [specific thing]. That changed how I designed this." |

---

## Critical checkpoints (the "stop and fix" moments)

### End of Day 1: Do I have 2 calls booked?
If no → send 10 more LinkedIn messages tonight. If still nothing by end of Day 2 morning → push the build start by one day and double outreach.

### End of Day 2: Have I spoken to at least 1 real CPA?
If no → don't start designing. Keep pushing outreach. Use the Discord. The whole tier-1 strategy depends on having real voice.

### End of Day 3: Is my scope locked?
If scope is still fuzzy → spend Day 4 morning narrowing. A clear narrow scope beats an ambitious unclear one.

### End of Day 6: Does my app actually work end-to-end?
If core CRUD + auth isn't working → cut the AI feature from Day 7. A solid core without AI beats a broken app with AI.

### End of Day 8: Did user testing reveal something broken?
If someone couldn't complete the triage in the test → Day 9 is rescue, not polish. Fix the flow first.

---

## Scope cuts if you fall behind

Ordered from least painful to most painful. Cut from the top down.

1. **Cut Story 3 differentiator UI entirely.** Just show the triage dashboard. Mention the 24h AI announcement capability as "what's next" in the presentation.
2. **Cut the AI feature.** Demo without it. Explain the architecture instead. Loses impact but saves face.
3. **Cut multi-user (small-firm persona) from the build.** Single-user only. Mention small-firm as Phase 2.
4. **Cut CSV import.** Just seed with fake clients. Talk about import in the presentation.
5. **Cut filter panel.** Single grouped view only.
6. **Cut backend.** Mock data in localStorage only. Honest in the presentation: "I built the UX layer completely, backend is Phase 1 of build."

**What you never cut:** the weekly triage core experience. That's the spine of the demo.

---

## Presentation guidance (Day 10)

### The 5-beat structure

1. **Real user moment (30 sec).** "I talked with [name], a solo CPA in [state]. She told me [specific quote]. That's where this product starts."
2. **The reframing (60 sec).** "The brief's headline is 'never miss a deadline.' But that's table-stakes. What DueDateHQ actually is: [your sharper thesis]."
3. **Live demo — weekly triage (2 min).** Show the 30-second triage moment. Narrate judgment, not features. "I grouped deadlines like this because [real CPA quote]."
4. **The AI moment (1 min).** "Here's what's structurally impossible without LLMs." Paste an announcement, show client matches. The magic beat.
5. **What I cut and why (30 sec).** Three things you decided against, each with reasoning. This is the tier-1 signal.

### Phrases that separate tier 1 from tier 2

- ✅ "I decided to [X] because [real user] told me [specific thing]."
- ✅ "I considered [Y], but I cut it because [reason]."
- ✅ "The assumption in the brief I ended up disagreeing with was [Z]."
- ❌ "I built [feature], [feature], and [feature]."
- ❌ "The main thing I wanted to do was make it look good."
- ❌ "I didn't have time to [X]." (Say what you built, not what you didn't.)

---

## One rule for every day

**Close the laptop at a reasonable hour.** Decision quality drops off a cliff after 10pm. Better to have 8 focused hours than 12 tired ones. This especially matters during research (Days 1–3) — tired outreach reads as desperate; tired interviews miss the gold quotes.

---

*Last updated: April 21, 2026 · v1*
