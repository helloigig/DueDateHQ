# Inbound classifier eval — v1

Per PRD §4.7. Measures the inbound 7-class top-level + 5-intent sub-classifier
against a hand-labeled ground truth set.

## Run

```bash
cd backend
npm run eval:inbound
```

Without `ANTHROPIC_API_KEY` set, the runner falls back to the heuristic
classifier (regex/keyword domain match) and reports those numbers — useful for
catching heuristic regressions but not measuring the production LLM path.

With `ANTHROPIC_API_KEY` set, the runner calls Haiku 4.5 per example and
measures the actual LLM classifier.

## Targets (PRD §4.7)

| Metric | Target | Why |
|---|---|---|
| Top-level (7-class) precision | ≥ 92% | Wrong class routes the email to the wrong queue → CPA confusion |
| Sub-intent (5-class) precision | ≥ 90% | Within client_reply_intent — picks the right action card |
| `timeline_pushback` false-positive rate | ≤ 3% | Highest-stakes — FP triggers an automatic propose-extension surface, undermines CPA trust |

Exit code is `0` when all three targets are met, `1` when any target is missed.
Use as a CI gate on PRs touching the classifier prompt or heuristic.

## Adding examples

Each line in `inbound-classifier-v1.jsonl` is one example:

```json
{"id":"NNN","note":"<short rationale>","input":{...InboundEmail...},"expected":{"topLevelClass":"...","replyIntent":"..."}}
```

`replyIntent` is only set when `topLevelClass === "client_reply_intent"`. The
runner treats examples without `replyIntent` as not contributing to the
sub-intent metric.

**When to add examples:**
- A real production misclassification → add the example with the correct label
  so future regressions surface
- A new edge case (new agency domain, new vendor) → add at least one positive
  + one near-miss negative
- A prompt-tuning attempt → add 5+ examples from the failure mode you're
  targeting before changing the prompt; otherwise you can't tell if the change
  helped

**Eval set health rules:**
- Distribution should roughly mirror real production traffic (per PRD §4.7,
  most inbound is `client_document` + `client_reply_intent`; agency / payment /
  vendor are tail)
- Hard examples (mismatched_attachment, timeline_pushback near-misses, vacation
  autoresponders) should be over-represented vs. their natural rate — they're
  where the classifier earns its keep
- Aim for 200+ examples before treating numbers as production-grade. v1 ships
  with ~30 to bootstrap; this is a measurement floor, not a quality ceiling.

## Output shape

```
Inbound classifier eval v1 — 30 examples — mode: LLM (Haiku 4.5)

  ✓ [001] client_document → client_document  (clean W-2 from client)
  ✗ [005] client_reply_intent → client_document · timeline_pushback → document_provided  (timeline pushback false-positive trap)
  ...

Top-level confusion (rows = expected, cols = predicted):
  ...

Reply-intent confusion (5-sub-class subset only):
  ...

Targets vs actuals (PRD §4.7):
  ✓  top-level precision              target ≥ 92%   actual 96.7%
  ✓  sub-intent precision             target ≥ 90%   actual 91.7%
  ✓  timeline_pushback FPR            target ≤ 3%    actual 0.0%

All §4.7 targets met.
```

## What's missing (P1 follow-ups)

- **Cost / latency tracking per example** — adds visibility on Haiku cost-per-eval
- **Per-prompt-version tags** — tag each run with the system prompt's git hash
  so prompt A/B comparisons are explicit
- **Per-example latency histogram** — early warning when a prompt change
  doubles tail latency
- **CI integration** — wire `npm run eval:inbound` into the PR workflow with a
  cost cap (don't burn $X per PR; sample down to 50 examples for CI)
