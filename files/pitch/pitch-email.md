# Pitch — External Email Template: DueDateHQ

*Skill: startup-pitch | Generated: 2026-05-05 (v2 — internal narrative; this artifact is "if you ever need it")*

Internal-narrative session does not need cold-investor outreach, but the artifact is kept here for reuse: a peer-CPA intro email, a design-partner recruitment email, or a future external partner email all share the same structure. **No funding ask.** Lead with research depth and shipped product; close with a question, not a meeting request.

---

## Subject line candidates

1. **`AI for CPA firms — but not the way you think`** *(curiosity-led; works for cold recipients)*
2. **`Lifting CPA capacity, not replacing CPAs`** *(thesis-led; works when recipient has seen "AI for accountants" before)*
3. **`A Louisiana hurricane extension, six clients, four hours`** *(narrative-led; specific, not vague — highest reply rate when recipient reads past subjects)*
4. **`660-line interview synthesis with a 600-client CPA`** *(research-led; signals depth in the subject, useful for design-partner / peer-CPA outreach)*

**Recommendation:** #4 for design-partner recruitment, #3 for warm intros, #2 for known-cold recipients.

---

## Body

> Hi [Name],
>
> [Personalization line — 1 sentence, see below]
>
> **DueDateHQ** is the client intelligence layer for solo and small-firm CPAs. We replicate the parts of fine-grained client service that a machine can do — Memory, Predictions, Confirmation, Monitoring, Drafting — across a CPA's entire book. The wedge is real-time 50-state tax-authority monitoring with affected-client matching. The platform is the supply-side capacity lift.
>
> **The insight.** Every incumbent — TaxDome, Karbon, Canopy, File In Time — assumes the CPA *chooses* which clients get fine-grained service. They don't. They run out of hours. The bottleneck is supply-side capacity, not strategic segmentation. AI's job is to lift the ceiling, not to "replace the CPA."
>
> **The research that produced it.** A 660-line interview synthesis with a 15-year CPA partner running a 10-person, 600-client firm. PRD §0.5 documents 57 product decisions traceable line-by-line to specific things he said. His standing quote — *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer"* — shaped the §5.3 architecture. The architecture is built. He's our design partner; he becomes paying customer #1 when the chase-loop body ships in full.
>
> **What's shipped.** The dashboard is in production. Action queue, four alert surfaces (bell / banner / blocking modal / `/alerts` page), state-announcement pipeline with sub-24h SLA, two-tier AI confidence chips (parse + match). Backend on Hono + tRPC + Drizzle + Supabase; AI on Claude Sonnet 4.5. PRD v0.8, IA v0.7, architecture v0.7 — happy to share.
>
> **Why this fits [Recipient].** [1 sentence — see below.]
>
> **What's the question I should answer first — the wedge, the research, or the architecture?**
>
> [Name]
> duedatehq.space

---

## Personalization templates

| Recipient type | Personalization line | Why-this-fits line |
|---|---|---|
| **Vertical SaaS / AI-applied peer** | *"I read your post on [recent piece] — the framing on 'specialist layers vs. suites' is exactly what we're doing in the CPA market."* | *"This sits in the layer-not-suite category and the user-research depth is unusual for stage."* |
| **Peer CPA / design partner candidate** | *"[Mutual / industry referrer] mentioned you'd worked through the same chase-loop pain."* | *"The architecture exists because a 15-year CPA partner told us what to build. I'd value your read on whether the same pain shows up in your firm."* |
| **B2B AI / vertical AI specialist** | *"Your work on [portfolio / writing] — using AI to lift human capacity, not replace it — is the bet we're making in tax."* | *"This is AI-as-supply-side-capacity in a regulated vertical, with the architecture documented down to the DB CHECK constraint that holds the trust model."* |
| **Accounting-tech operator** | *"You worked on [X]. That experience reading the CPA market is rare."* | *"The bottleneck most fintech-folks miss is supply-side, not workflow. We think you'll see it the same way."* |

---

## Follow-up email (D+5 if no reply)

> Subject: **`Re: [original subject]`** *(reply-to original)*
>
> Hi [Name] — short ping.
>
> Last week I sent over the DueDateHQ summary. One update worth flagging: [specific recent thing — new shipped feature, new design-partner conversation, new architectural decision, new piece of research].
>
> If the timing is wrong, no worries — let me know and I'll loop back. If 15 min would be useful, here's [link].
>
> [Name]

**Anti-pattern:** don't re-pitch in the follow-up. Either flag a new data point or step out gracefully. The follow-up is calibration, not amplification.

---

## Email anti-patterns to avoid

- ❌ "We're using AI to disrupt the $40B accounting software market." Every cold email says this; auto-archive.
- ❌ Attaching a 30-slide deck. Send the PRD only if asked. First email is read on a phone in 20 seconds.
- ❌ Mentioning all five competitors. Pick one (TaxDome — most-known) and let the rest come up in conversation.
- ❌ Quoting more than one customer line. One verbatim quote is signal; three is rambling.
- ❌ Generic "would love to chat" closing. Always close with a specific question.

## Sources

See `intake.md` for source mapping. Email body target ~500 words.
