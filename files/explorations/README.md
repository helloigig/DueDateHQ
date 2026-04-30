# Visual exploration — 30 directions

Thirty standalone HTML mockups of the **Dashboard hero state** (greeting · status line · announcement banner · Overdue · This Week). Same content across all of them — only visual treatment changes. Pick one (or remix), then `CHOSEN.md` captures the tokens for Phase 1+ of the design-system migration.

Open them in browser tabs and compare. Each has a `direction-tag` sticker bottom-right so you don't lose track.

| # | File | Direction | One-line |
|---|---|---|---|
| 0 | [v0-current.html](v0-current.html) | **Current state** | Today's slate-system-font baseline (the "do nothing" reference) |
| 1 | [v1-terminal.html](v1-terminal.html) | **Terminal** | IBM Plex, status bar, 32px rows, keyboard-first |
| 2 | [v2-editorial.html](v2-editorial.html) | **Warm Editorial** | Fraunces drop cap, Roman numerals, magazine-grade |
| 3 | [v3-wise.html](v3-wise.html) | **Wise (fintech bold)** | Forest-green hero, lime KPIs, Bricolage Grotesque |
| 4 | [v4-shadcn.html](v4-shadcn.html) | **shadcn platonic** | Tabs + DataTable + chart + sonner — the 2026 saturated norm |
| 5 | [v5-gemini.html](v5-gemini.html) | **Gemini** | Gradient AI input bar, suggestion cards, gradient FAB |
| 6 | [v6-calm.html](v6-calm.html) | **Notion** | Page cover + emoji icon, Lora italic, drag handles, slash hint |
| 7 | [v7-fluent.html](v7-fluent.html) | **Fluent (Microsoft)** | Mica acrylic blur, Inter Tight + Cascadia Code, soft elevation |
| 8 | [v8-carbon.html](v8-carbon.html) | **Carbon (IBM)** | Sharp 0px radii, IBM Plex throughout, micro-grid background |
| 9 | [v9-stripe.html](v9-stripe.html) | **Stripe** | Iconic blur-gradient hero, Sora display, pill buttons |
| 10 | [v10-arc.html](v10-arc.html) | **Arc / Browser Co** | Tinted glass sidebar, floating canvas, Instrument Serif |
| 11 | [v11-cashapp.html](v11-cashapp.html) | **Cash App** | Pure green bg, brutalist Bricolage 96px numerals, sharp corners |
| 12 | [v12-porsche.html](v12-porsche.html) | **Porsche** | Black + gold crest, Bebas Neue caps, automotive grid |
| 13 | [v13-bento.html](v13-bento.html) | **Bento grids** | Apple-style modular tiles, big-number cards, AI insight gradient |
| 14 | [v14-liquidglass.html](v14-liquidglass.html) | **Liquid glass** | Frosted backdrop-filter cards over multi-color radial bg + noise |
| 15 | [v15-ai-uncanny.html](v15-ai-uncanny.html) | **AI uncanny** | Sunset pastel gradients, Cormorant italic, "ChatGPT pastel" feel |
| 16 | [v16-newspaper.html](v16-newspaper.html) | **Newspaper** | Old Standard TT broadsheet, double-rule masthead, page folio |
| 17 | [v17-scrapbook.html](v17-scrapbook.html) | **Scrapbook** | Washi tape, polaroid frames, Caveat handwritten, "CLIPPED" stamp |
| 18 | [v18-wsj-weekend.html](v18-wsj-weekend.html) | **WSJ Weekend** | Source Serif, hedcut portrait, markets-strip KPIs, photo-block lead |
| 19 | [v19-monocle.html](v19-monocle.html) | **Monocle** | Spectral display, gold accent, numbered nav, restrained |
| 20 | [v20-old-celine.html](v20-old-celine.html) | **Old Céline** | Wide-tracked all-caps Cormorant, severe minimalism, beige + black |
| 21 | [v21-aesop.html](v21-aesop.html) | **Aesop** | Apothecary beige, EB Garamond small-caps, "specimen bottle" card |
| 22 | [v22-muji.html](v22-muji.html) | **Muji** | Kraft paper, Japanese characters, restrained Noto Sans, 無印 stamp |
| 23 | [v23-kinfolk.html](v23-kinfolk.html) | **Kinfolk** | Generous Fraunces cover, terra-cotta photo block, lifestyle pace |
| 24 | [v24-school-of-life.html](v24-school-of-life.html) | **School of Life** | Textbook chapter "18.", Lora + Caveat, A+ stamp, hand-drawn diagram |
| 25 | [v25-aplos-ghia.html](v25-aplos-ghia.html) | **Aplós / Ghia** | Peach cream, ceramic bottle illustration, soft-pastel "flavor" tiles |
| 26 | [v26-glossier.html](v26-glossier.html) | **Glossier (early era)** | Millennial pink, rounded cream cards, "free sample" promo |
| 27 | [v27-headspace.html](v27-headspace.html) | **Headspace** | Friendly orange, smiley sun illustration, "breathe" meditation card |
| 28 | [v28-oatly.html](v28-oatly.html) | **Oatly-core** | Zine treatment, Inter Black + Caveat scribbles, "AI did this" gag |
| 29 | [v29-mailchimp.html](v29-mailchimp.html) | **Mailchimp** | Mailchimp yellow + black, custom Freddy face, DM Serif Display italic |

---

## Quick groupings

**For the calm/professional read** (closest to "Bloomberg-terminal-meets-Linear" tone):
v1 Terminal · v8 Carbon · v19 Monocle · v20 Old Céline · v21 Aesop · v22 Muji

**For warm/editorial gravitas** (distinctive without playful):
v2 Warm Editorial · v16 Newspaper · v18 WSJ Weekend · v23 Kinfolk · v25 Aplós/Ghia

**For modern fintech / SaaS confidence**:
v3 Wise · v9 Stripe · v11 Cash App

**For AI-forward / generative aesthetic**:
v5 Gemini · v15 AI uncanny

**For surface/system experimentation**:
v7 Fluent · v13 Bento · v14 Liquid glass · v10 Arc

**For playful/expressive (probably too much for an accounting tool)**:
v17 Scrapbook · v24 School of Life · v26 Glossier · v27 Headspace · v28 Oatly · v29 Mailchimp

**For "what we'd ship by default if we just installed shadcn"**:
v4 shadcn platonic — useful as a baseline to see how generic that is

**For the historical reference**:
v0 current state — to see where we are now

---

## Icon library

Sticking with **Lucide React** (already installed, sister-project to shadcn/ui, 1500+ outline icons, MIT, ~13KB tree-shaken).

Direction-specific exceptions worth flagging:
- v5 Gemini → **Material Symbols** would amplify it (already used in the mockup).
- v8 Carbon → **Carbon Icons** would be stylistically pure but the difference from Lucide is small.
- v22 Muji → **Lucide** with reduced stroke weight, supplemented by Noto CJK glyphs as nav markers.
- v16/v18 newspaper-style → consider tiny inline SVG ornaments (§, ¶, ❦) over icon system.
- v17 Scrapbook · v24 School of Life · v28 Oatly · v29 Mailchimp → **emoji or hand-drawn doodles** more than an icon set.

For all professional/restrained directions (v0–v15 + v19–v23), **Lucide** is the right call.

---

## How to compare

Open each in a tab at desktop 1280×800 and look at:

1. **Greeting** — scan all 30 in turn. Which feels like *Sarah's* dashboard for Monday morning?
2. **AI-source pill** (Wilkins Plumbing row) — each direction expresses "AI did this" differently. Which says it without shouting?
3. **Banner** for the LA hurricane — appropriately serious without alarming?
4. **Density** — v1 (32px) → v22 (36px) → v0/v6/v8/v19/v21 (~44px) → v3 (60px) → v11/v17 (very tall). Sarah manages 80 clients — which scales when she has 200?
5. **Distinctiveness** — squint at five at random. Which would you recognize blind as DueDateHQ?

Anti-patterns the spec rules out (handoff §3): no playful mascots in chrome, no celebratory toasts, no emoji in chrome, no shimmer skeletons. Several mockups (v6, v17, v24, v27, v28, v29) deliberately violate these rules to show what that direction *would* look like — drop the violations if those win.

---

## After you pick

Reply with:
- A direction (e.g., "v9", "v23")
- A remix (e.g., "v2 typography on v3 KPIs", "v19 layout with v5's AI accent only")
- Or notes (e.g., "v8 but warmer", "v23 minus the photo block")

I'll write `CHOSEN.md` with the locked palette, font stack, radii, shadows, and class examples, then run **Phase 1** (shadcn install) and **Phase 2** (token migration) per the approved plan.
