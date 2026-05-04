# DueDateHQ — Design-Ready Pack

> Single-entry index. **Design styles + interaction patterns** live in [`DESIGN.md`](../DESIGN.md) at the repo root — that is the canonical source. Everything below is product / engineering / research context.

---

## ⭐ Primary — execute from these

| File | What it is | Use when |
|------|------------|----------|
| **[`../DESIGN.md`](../DESIGN.md)** | Canonical design system: tokens, primitives, taste principles (T1–T8), do/don'ts, alert surfaces, modal taxonomy, export pattern, voice, motion, a11y. Single source for visual + interaction design. | Anything design-related |
| ~~DESIGN-HANDOFF.md~~ | **Superseded 2026-05-03 → see [`DESIGN.md`](../DESIGN.md).** Tombstone preserves a "where each section went" map. | Historical reference only |
| ~~DESIGN-HANDOFF-ADDENDUM.md~~ | **Superseded 2026-05-03 → see [`DESIGN.md`](../DESIGN.md).** Tombstone maps every A* / B* item to its new home. | Historical reference only |
| **[USER-INTERVIEW-GUIDE.md](./USER-INTERVIEW-GUIDE.md)** | Runbook for CPA discovery calls: outreach, 20-min script, question bank, synthesis template, decision gates | Conducting user interviews |
| **[STATE-NOTIFICATION-IMPLEMENTATION.md](./STATE-NOTIFICATION-IMPLEMENTATION.md)** | Engineering plan for Story 3 spine: scraper → LLM parser → matcher → notifier → escalation. Data model, prompts, phased rollout, tech stack | Building the state announcement pipeline |
| **[BACKEND-IMPLEMENTATION.md](./BACKEND-IMPLEMENTATION.md)** | Full backend: stack, architecture diagram, complete Postgres schema, tRPC + REST API, RLS multi-tenancy, background jobs, auth/security, deployment, 5-phase implementation plan | Building the server side |
| **[FRONTEND-INTEGRATION-PREP.md](./FRONTEND-INTEGRATION-PREP.md)** | Frontend interface-prep instructions: data-layer refactor (tRPC + React Query + hooks), shared types, auth surfaces, loading/error/empty states, realtime polling stub, file upload, feature flags, env config | Giving to the frontend session before backend lands |

---

## Supporting docs (referenced by the handoff)

Read these when the handoff references them. Don't re-read from scratch.

| Type | File | Why it's here |
|---|------|--------------|
| Strategy | [strategy-01-positioning.md](./strategy-01-positioning.md) | Category + messaging · answers "how are we different" |
| Strategy | [strategy-02-problem-statement.md](./strategy-02-problem-statement.md) | 5 HMW questions for design |
| Strategy | [strategy-03-customer-journey.md](./strategy-03-customer-journey.md) | Where emotional low points sit → where to invest design effort |
| Strategy | [strategy-04-user-story-map.md](./strategy-04-user-story-map.md) | Screen inventory · Release 1 scope |
| Source | [01-product-brief.md](./01-product-brief.md) | Personas, thesis, pain points |
| Source | [duedatehq-prd.md](./duedatehq-prd.md) | Scope decisions, data model, NFRs |
| Spec | [duedatehq-ia-flows.md](./duedatehq-ia-flows.md) | Navigation + key flows |
| Spec | [duedatehq-dashboard-spec.md](./duedatehq-dashboard-spec.md) | Dashboard screen spec |
| Spec | [duedatehq-wireframes.md](./duedatehq-wireframes.md) | Announcement, Client, Import wireframes |
| Market | [competitive-matrix.md](./competitive-matrix.md) | Competitive visual positioning |

---

## Archive

Anything not design-critical was moved to `_archive/` so it doesn't clutter the working set. Contents:

- `_archive/chinese-docs/` — Chinese business plan + bootcamp HTML
- `_archive/bootcamp-artifacts/` — user-research playbook, 10-day plan, day-1 work
- `_archive/competitor-per-file/` — individual competitor files (use `competitive-matrix.md` instead)
- `_archive/duplicate-lofi/` — copy of forLoFi docs
- `_archive/pm-strategy-reference/` — epic hypotheses + roadmap (PM strategy, not design)
- `_archive/misc/` — reference HTML, pricing landscape, verification report, old README

Restore any file by moving it out of `_archive/`.

---

*For design work, open [`DESIGN.md`](../DESIGN.md). For product / engineering / research work, use the table above.*
