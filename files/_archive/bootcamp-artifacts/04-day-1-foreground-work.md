# Day 1 — Foreground Work

> What to do with the rest of today while user research outreach runs in the background.
> Assumes the 2-hour outreach blitz from `02-user-research-playbook.md` is done or underway.

---

## Priority order (5 blocks · ~5.5 hours total)

1. Competitor UI reconnaissance · 90 min
2. Reframing one-pager · 60 min
3. Weekly triage wireframes · 90 min
4. Technical scaffold decisions · 45 min
5. Seed data reconnaissance · 30 min (optional, tonight)

Do them in this order. The sequence matters: you want to have seen the competition *before* you wireframe, and you want the reframing written *before* the wireframes so you're designing toward an argument.

---

## Block 1 — Competitor UI reconnaissance (90 min)

**Goal:** A folder of annotated screenshots to reference while you design.

### What to look at

| Competitor | How to access |
|------------|---------------|
| **File In Time** | YouTube demos · G2 review screenshots · vendor website marketing shots |
| **Karbon** | Public product tour · YouTube demos · G2 screenshots |
| **TaxDome** | Public product tour · case study screenshots |
| **Canopy** | Public product tour · YouTube onboarding videos |

Also look at adjacent reference tools that solve *similar* problems in other verticals — Linear (task triage), Superhuman (priority inbox), Height (project views). You want to see "good triage UX" from outside your category.

### What to capture

10–15 screenshots total. For each, write **one sentence** on:
- What they do well (what would I steal?)
- What they do badly (what am I not going to do?)

### Specific questions to answer while looking

- How do they visualize a list of deadlines? (Table? Cards? Timeline?)
- Where do they fail at hierarchy — what drowns in noise?
- What does their "Monday morning" view look like? Is there even one?
- Where do they rely on the user to do mental sorting?
- How do they handle "due this week" vs "long term"?
- What visual cues signal urgency? (Color? Size? Position?)

### Deliverable

One doc (Notion / Google Doc / folder of images) with 10–15 annotated shots. This becomes your "not-that" reference when you start designing.

> **Why this is not optional:** a designer who hasn't looked at the competition ends up reinventing the same patterns without knowing it. This is 90 minutes that saves 3 days of redesign.

---

## Block 2 — Reframing one-pager (60 min)

**Goal:** Half a page of written argument that becomes the seed of your presentation.

### Answer three questions in your own words

1. **What is DueDateHQ's one-sentence thesis?** Not the brief's phrasing. Yours. If you can't write it without checking the brief, you haven't internalized it yet.

2. **Story 1 or Story 3 — which is the spine of the product, and why?** The brief marks Story 1 as P0/Core and Story 3 as P1/Differentiator. A tier-1 move is to argue the opposite — Story 3 *is* the business, Story 1 is the shell around it. Pick a side, defend it.

3. **What's one decision in the brief you'd push back on if the CEO were in the room?** Could be persona scope, could be pricing structure, could be prioritization, could be the competitor framing. The specific answer matters less than demonstrating that you have one.

### Format

Half a page. Prose, not bullets. Written as if you're explaining to a teammate over coffee, not drafting a document.

> **Why this is not optional:** tier-1 submissions open with reframing, not with "here's what I built." Writing this now means you'll build *toward* an argument rather than stumbling into one on Day 9.

---

## Block 3 — Weekly triage wireframes (90 min)

**Goal:** Directional commitment on what the Monday-morning-30-second screen looks like.

### Not in Figma yet

Pencil, paper, whiteboard, or Excalidraw. Resist Figma until Day 3 — jumping to high-fidelity tools too early locks you into details that don't matter yet.

### The question the wireframes must answer

**What does a solo CPA see in the first 30 seconds after logging in Monday morning?**

### Sketch 3 alternative versions

| Version | Visual model |
|---------|--------------|
| **A** | Calendar-style view — month grid, deadlines as pins |
| **B** | Kanban-style — three vertical lanes: Due this week / This month / Long term |
| **C** | List with urgency bands — single scrollable list, color-banded by proximity |

### The choice criterion

Which one best serves *"decide priorities in 30 seconds"*? Not "which looks nicest" — which would a 50-year-old CPA with 80 clients scan fastest? The answer is probably B or C, but sketch A anyway to validate the rejection.

Pick one. You can refine later. Right now you just need a directional commitment.

---

## Block 4 — Technical scaffold decisions (45 min)

**Goal:** Stack chosen. "Hello World" deployed. No debates on Day 4.

### Decisions to make today

| Layer | Default recommendation | Why |
|-------|------------------------|-----|
| Framework | **Next.js** | Full-stack, Vercel-native, fastest to deploy |
| Database | **Supabase** or **Neon** | Postgres, hosted, auth bundled (Supabase) |
| Auth | **Supabase Auth** or **Clerk** | Don't hand-roll |
| Hosting | **Vercel** | Next.js-native, instant deploys |
| AI API | **Claude Sonnet 4** | Fastest for structured JSON output |
| Styling | **Tailwind** | Speed over opinion |

### Rule

Don't over-optimize. The default stack above is the fastest path from zero to deployed. Deviate only if you have a specific reason. Picking Svelte because you "like it better" is a cost you can't afford in a 10-day round.

### Today's deliverable

Repo initialized. Basic Next.js app deployed to Vercel. Login page stub. "Hello World" visible at a public URL. That's it — no features tonight. You're just proving the pipeline works.

---

## Block 5 — Seed data reconnaissance (30 min, optional tonight)

**Goal:** Know *where* realistic tax deadline data lives, so Day 6 isn't spent hunting.

### Sources worth bookmarking

- **Federal:** IRS official publications — Pub 509 (Tax Calendars) has all major federal dates
- **California:** Franchise Tax Board calendar
- **Texas:** Comptroller's office tax calendar
- **New York:** Dept. of Taxation & Finance calendar
- **Leaked via marketing:** File In Time's own website lists many of the deadlines they support — use as a sanity check for what to seed

### You don't need to collect the data tonight

You need to know it exists and where. Day 6 is when you pull it into the database. Tonight is just: open each source, confirm it's accessible, bookmark.

---

## What NOT to do today

- ❌ **Don't start Figma mockups.** Too early — you don't know enough yet. Paper first.
- ❌ **Don't write real application code.** Scaffold only, no features.
- ❌ **Don't read more about the market.** The brief is enough. Every extra hour of "research" not involving a real CPA is procrastination dressed up as diligence.
- ❌ **Don't redesign the logo / pick fonts / spec colors.** Visual identity comes on Day 9, not Day 1.
- ❌ **Don't wait for interviews before doing Blocks 1–4.** Your interview calls are async; your foreground work is not. Run both tracks in parallel.

---

## End-of-day checklist

By tonight you should have:

- [ ] 10–15 annotated competitor screenshots in one doc
- [ ] Half-page reframing one-pager written in your own words
- [ ] 3 paper wireframes for the weekly triage screen · 1 picked
- [ ] Stack chosen · repo initialized · "Hello World" deployed to a public URL
- [ ] Outreach replies monitored · calls booked where possible
- [ ] Seed data sources bookmarked (optional)

If outreach is slow and you finish all of this with time left, spend it sending 10 more LinkedIn messages — not more "research."

---

*Last updated: April 21, 2026 · v1*
