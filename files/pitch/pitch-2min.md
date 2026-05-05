# Pitch — 2 Minutes: DueDateHQ

*Skill: startup-pitch | Generated: 2026-05-05 (v2 — internal narrative, no ask)*

Word-for-word verbal script. ~330 words, ~2:00 spoken at 150 wpm. Internal-rehearsal version — surface the research depth, not a funding ask.

---

## Script

> A solo CPA can give 10 clients fine-grained service. She physically can't replicate that across 100. **DueDateHQ** is the client intelligence layer that runs the parts of that service a machine can do — *remembering each client's history, predicting their timing, confirming their materials, monitoring 50-state rule changes, drafting their emails* — across her entire book.
>
> [*Pause. Beat.*]
>
> Last Tuesday Louisiana announced a hurricane filing extension. Within four hours, Sarah's dashboard showed her six affected clients, eight deadlines to extend, and six emails drafted in her tone. She approved them in 90 seconds. **Her competitors using TaxDome or Karbon found out from a client complaint.** No incumbent has this.
>
> Here's our insight. Every CPA software vendor assumes the CPA *chooses* which clients get fine-grained service. They don't. They run out of hours. The bottleneck is supply-side capacity, not strategic segmentation. **Every client deserves the granularity that today only the top 10 receive.**
>
> That insight isn't a hunch. It came from a 660-line interview synthesis with our design partner Yan Jing — 15-year partner, 10-person firm, 600 clients. He told us, indirectly, that he remembers about 50 clients clearly, fuzzy on 100, the other 450 only via records. He told us the test for the wedge: *"Solve this one pain — confirming the client gave 100% of what's needed — and I'm definitely your first customer."* So we built it. The §5.3 invariant — *AI never auto-promotes a checklist item to received_confirmed* — is enforced at the database layer with a CHECK constraint. **The customer named the price of trust; we paid it.**
>
> Pricing: $29 to $99 a month per firm, monthly billing, no annual lock-in. Status: dashboard shipped, design partner running it, PRD v0.8 + IA v0.7 + architecture v0.7 synced. Yan Jing has standing-quote committed to be our first paying customer once §5 ships in full.
>
> **What do you want to dig into first — the research, the wedge, or the architecture?**

---

## Delivery notes

- **Pace:** 150 wpm — measured. Slow down on "every client deserves the granularity that today only the top 10 receive" — that's the line they'll remember.
- **Emphasis (bold in script):**
  - "Her competitors found out from a client complaint" — wedge moment
  - "supply-side capacity, not strategic segmentation" — insight moment
  - "The customer named the price of trust; we paid it" — research depth moment
- **Four pauses:**
  1. After the 2-sentence opener — let "across her entire book" land
  2. After the Louisiana example — let "client complaint" sit
  3. After the Yan Jing quote *"...I'm definitely your first customer"* — let the customer's voice fill the room, not yours
  4. After the question at the end — *do not* fill the silence

---

## Variations

**Cut to ~90 seconds:** drop the pricing line and the architectural detail (§5.3 + CHECK constraint). Land insight + research quote + wedge.

**Stretch to ~2:30:** add one more Yan Jing quote — *"你不能 1 月 1 号开始就问了"* — between the insight and the wedge example. Bilingual quotes signal authenticity.

## Sources

Interview Notes RTF (660 lines), PRD v0.8 §0.5 traceability, `painpoint_summary.md` memory, `feedback_gap_over_fill.md` memory.
