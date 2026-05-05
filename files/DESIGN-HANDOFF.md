# DueDateHQ — Design Handoff

> **⚠️ SUPERSEDED — see [`DESIGN.md`](../DESIGN.md) at the repo root.**
>
> This document was the v1 handoff (2026-04-24) used to execute the first design pass. It served its purpose. As of **2026-05-03**, every still-relevant rule has been folded into the canonical [`DESIGN.md`](../DESIGN.md), and the visual pass it described has shipped.
>
> **Do not author new design rules here.** Add them to `DESIGN.md` so there is one source of truth.

---

## Where the original sections went

| Original section | Now lives in |
|:-----------------|:-------------|
| §0 TL;DR success checklist | Historical — the R1 visual pass shipped; checklist no longer load-bearing. |
| §1 Product context | `files/01-product-brief.md` + `files/strategy-*.md` (already canonical) |
| §2 Design principles (ranked 1–7) | Reframed as `DESIGN.md` §Taste principles (T1–T8). Principle 5 ("Escape hatches visible") added explicitly to §Do's during the 2026-05-03 consolidation. |
| §3 Tone | `DESIGN.md` §Voice & Microcopy + §Casing |
| §4 Tokens (`tailwind.config.js` block) | `DESIGN.md` frontmatter (`colors:` / `typography:` / `rounded:` / `spacing:` / `components:`) is the source; `tailwind.config.js` is generated from it |
| §4 Lucide icon mapping table | One-time migration aid; `DESIGN.md` §Implementation foundation says "Icons come from Lucide" — that's enough |
| §5 Current-state audit (D1–D8 / S1–S5 / T1–T5 / AB1–AB3 / DR1–DR5 / I1–I5 / AD1–AD4 / M1–M4) | Historical fixes — applied. The forward-looking rules they encoded live in `DESIGN.md` §Do's / §Don'ts. |
| §5.9 Empty-state copy table | `DESIGN.md` §Voice & Microcopy reference table + `<EmptyState>` primitive contract |
| §5.10 Reference component (`DeadlineRow`) | The actual code at `src/components/DeadlineRow.tsx` is now the reference; the patterns it demonstrates (focus-within action reveal, SVG dots over Unicode, fixed-width tabular columns, height in 4px multiples, no Tailwind default colors) are in `DESIGN.md` §Component anatomy rules |
| §6 Layout rules | `DESIGN.md` §Layout & Spacing + §Responsive behavior. **Note:** `max-w-5xl` in the original is **superseded** — current rule is `max-w-[840px]` (default) / `max-w-[1080px]` (wide tables) / full-viewport (workshop). See `<PageContainer>` primitive. |
| §6.1 Pattern sheet (button / chip / card / modal markup) | Replaced by shadcn primitives (`@/components/ui/*`) + `DESIGN.md` §Shared primitives reference |
| §7 Prioritized task list (T1–T11) | Historical — work shipped. |
| §8 Verification workflow | Project convention now lives in CLAUDE.md / README; not design-system content. |
| §9 Explicit non-goals | Memory: see `forever_no.md` |
| §10 Out-of-scope handling | Project workflow, not design |
| §11 Reference docs | See `files/strategy-00-INDEX.md` |

For the addendum's overrides + new patterns, see [`DESIGN-HANDOFF-ADDENDUM.md`](./DESIGN-HANDOFF-ADDENDUM.md) — also tombstoned, with the same "where it went" map.

---

*Tombstoned 2026-05-03. Original v1 content preserved in git history (`git log -p files/DESIGN-HANDOFF.md`). Don't restore — fold any missing rule into [`DESIGN.md`](../DESIGN.md) instead.*
