# DueDateHQ — Problem Statement

> The internal framing. Used to open PRDs, kick off epics, and justify investment. Follows the user-centered format: *Who is blocked, what they're trying to do, why it matters, how it feels.*

---

## Primary problem statement

**Solo and small-firm CPAs** — with 20–300 clients distributed across 2–10 states and decision-making authority over their own tooling —
**are blocked from** reliably tracking every federal + state + local tax deadline across their full portfolio and responding in time to state authority rule changes,
**while they are trying to** run their Monday-morning triage and keep every client penalty-free during January–April filing season,
**which matters because** a single missed deadline exposes them to professional liability (the penalty lands on the CPA, not the client) and their current stack — Excel sheets with 200+ rows + manual browsing of 50 state websites — cannot scale, leaving them to discover extensions from clients' group chats *after* the filing window has closed.
**It feels like** decision fatigue, chronic low-grade dread during filing season, and the specific sinking feeling of learning about a rule change too late.

---

## Secondary problem statements (by loop)

### A. Weekly triage loop (Story 1, daily)

> Solo CPAs are blocked from starting a focused work week because the first 45 minutes of Monday are consumed switching between Excel, Outlook, and handwritten notes to answer the single question *"what do I owe which client this week?"* — which matters because decision fatigue accumulates across 13+ weeks of filing season, and feels like losing the race before it starts.

### B. State announcement loop (Story 3, rare-but-defining)

> Multi-state CPAs are blocked from proactively notifying affected clients when a state tax authority issues an extension because scanning 50 state authority websites daily is not something any solo practitioner actually does — which matters because when the IRS granted LA County an extension to October, one CPA found out from a client's group chat and discovered 6 clients qualified *after the original deadline*. It feels like having the liability of a compliance team with the tooling of a spreadsheet.

### C. Onboarding / migration loop (Story 2, one-time)

> CPAs evaluating new tools are blocked from finishing the trial because migrating 80 clients from TaxDome / Drake / Karbon requires days of manual re-entry — which matters because the decision window for switching is narrow (the weeks between filing seasons) and feels like signing up for homework, so the trial is abandoned before the actual product is seen.

---

## Problem severity framing

| Loop | Frequency | Severity if it fails | Current workaround | Gap that justifies building |
|---|---|---|---|---|
| A. Weekly triage | 52×/yr (13 heavy) | Decision fatigue, minor misses | Excel + Outlook | Can't group across clients/states; no time-based view |
| B. State announcements | 50–200×/yr across 50 states | Catastrophic (penalty, malpractice exposure) | Manual browsing + luck | Nothing on the market monitors all 50 DORs and matches affected clients |
| C. Migration | 1×/customer | Conversion blocker | Trial abandonment | No competitor offers AI-powered field mapping + auto-generated calendar |

**Loop B is the spine.** It's rare but it's where the penalty liability lives — which is where the willingness-to-pay lives. Loop A is the shell (what users experience daily). Loop C is the front door.

---

## How-Might-We questions (for design)

Framed from the problem statements, ready for a design sprint:

1. **HMW** collapse a 200-row Excel sheet × 80 clients × 5 states into an actionable 8-item "this week" list that a CPA can scan in 30 seconds?
2. **HMW** deliver the list of clients affected by a state announcement within 24 hours of the announcement being posted, without requiring the CPA to configure anything?
3. **HMW** let a CPA paste a CSV from any of 6 competitor tools and see a full-year deadline calendar generated automatically, without hand-mapping fields?
4. **HMW** make the "I'll leave if this doesn't work" escape hatch (export) visible enough to neutralize the TaxDome lock-in trauma, without actively advertising churn?
5. **HMW** reduce client-chasing for document preparation without building a full client portal?

---

## Non-problems (we will not solve these)

Explicitly out of scope, to protect positioning:

- ❌ Tax return preparation (that's Drake / ProConnect)
- ❌ Time tracking / billing (that's QuickBooks + TaxDome's trap)
- ❌ Document management / storage
- ❌ Client portals
- ❌ E-signature
- ❌ Bookkeeping
- ❌ IRS representation / tax resolution

---

*Source inputs: pain points §3 of [01-product-brief.md](./01-product-brief.md), Jennifer persona quote (LA County extension), [duedatehq-prd.md](./duedatehq-prd.md) §1–3.*
