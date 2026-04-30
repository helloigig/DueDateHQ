/**
 * Inbound classifier eval runner — per PRD §4.7.
 *
 * Loads `inbound-classifier-v1.jsonl`, runs classifyInboundLLM (falls back to
 * heuristic when ANTHROPIC_API_KEY is missing), computes per-class precision
 * + recall + the §4.7 high-stakes timeline_pushback false-positive rate.
 *
 * Run: `npm run eval:inbound` from backend/.
 *
 * Targets per PRD §4.7:
 *   - Top-level (7-class):      precision ≥ 92%
 *   - Sub-intent (5-class):     precision ≥ 90%
 *   - timeline_pushback FPR:    ≤ 3%
 *
 * Exit code:
 *   - 0 if all targets met
 *   - 1 if any target missed (CI gate)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  classifyInboundLLM,
  classifyInboundHeuristic,
  type ClassificationResult,
  type InboundEmail,
} from "../src/lib/inbound-orchestrator.js";

type Expected = {
  topLevelClass: ClassificationResult["topLevelClass"];
  replyIntent?: ClassificationResult["replyIntent"];
};

type Example = {
  id: string;
  note?: string;
  input: InboundEmail;
  expected: Expected;
};

type RunResult = {
  id: string;
  expected: Expected;
  predicted: ClassificationResult;
  topLevelMatch: boolean;
  intentMatch: boolean;
  fellBackToHeuristic: boolean;
};

const TOP_LEVEL_TARGET = 0.92;
const INTENT_TARGET = 0.9;
const PUSHBACK_FPR_CEILING = 0.03;

const __dirname = dirname(fileURLToPath(import.meta.url));
const evalPath = join(__dirname, "inbound-classifier-v1.jsonl");

function loadExamples(): Example[] {
  const raw = readFileSync(evalPath, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, i) => {
      try {
        return JSON.parse(line) as Example;
      } catch (err) {
        throw new Error(
          `Failed to parse line ${i + 1}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
}

function bold(s: string): string {
  return `[1m${s}[0m`;
}
function green(s: string): string {
  return `[32m${s}[0m`;
}
function red(s: string): string {
  return `[31m${s}[0m`;
}
function yellow(s: string): string {
  return `[33m${s}[0m`;
}
function dim(s: string): string {
  return `[2m${s}[0m`;
}

async function main(): Promise<void> {
  const usingLLM = !!process.env.ANTHROPIC_API_KEY;
  const examples = loadExamples();
  const mode = usingLLM ? "LLM (Haiku 4.5)" : "heuristic-only (no API key)";
  console.log(
    bold(`Inbound classifier eval v1`) +
      ` — ${examples.length} examples — mode: ${mode}\n`,
  );

  const results: RunResult[] = [];
  for (const ex of examples) {
    let predicted: ClassificationResult;
    let fellBack = false;
    try {
      if (usingLLM) {
        predicted = await classifyInboundLLM(ex.input, {
          firmId: "eval-firm",
        });
      } else {
        predicted = classifyInboundHeuristic(ex.input);
        fellBack = true;
      }
    } catch (err) {
      console.error(
        `  [${ex.id}] LLM call threw: ${err instanceof Error ? err.message : String(err)} — falling back to heuristic`,
      );
      predicted = classifyInboundHeuristic(ex.input);
      fellBack = true;
    }

    const topLevelMatch = predicted.topLevelClass === ex.expected.topLevelClass;
    // Intent only counted when the example expects one (i.e., topLevelClass=client_reply_intent).
    const intentMatch =
      ex.expected.replyIntent === undefined
        ? true
        : predicted.replyIntent === ex.expected.replyIntent;
    results.push({
      id: ex.id,
      expected: ex.expected,
      predicted,
      topLevelMatch,
      intentMatch,
      fellBackToHeuristic: fellBack,
    });

    const status =
      topLevelMatch && intentMatch ? green("✓") : red("✗");
    const intentStr = ex.expected.replyIntent
      ? ` · ${ex.expected.replyIntent} → ${predicted.replyIntent ?? "—"}`
      : "";
    console.log(
      `  ${status} [${ex.id}] ${ex.expected.topLevelClass} → ${predicted.topLevelClass}${intentStr} ${dim(`(${ex.note ?? ""})`)}`,
    );
  }

  // ───────── Aggregate metrics ─────────
  console.log(bold("\nResults\n"));

  const total = results.length;
  const topLevelCorrect = results.filter((r) => r.topLevelMatch).length;
  const topLevelAccuracy = topLevelCorrect / total;
  const topLevelMet = topLevelAccuracy >= TOP_LEVEL_TARGET;

  const intentSubset = results.filter(
    (r) => r.expected.replyIntent !== undefined,
  );
  const intentCorrect = intentSubset.filter((r) => r.intentMatch).length;
  const intentAccuracy =
    intentSubset.length === 0 ? 1.0 : intentCorrect / intentSubset.length;
  const intentMet = intentAccuracy >= INTENT_TARGET;

  // timeline_pushback false-positive rate — predicted=timeline_pushback when
  // actual was something else. The most safety-sensitive metric per §4.7 because
  // an incorrect FP drives an automatic propose-extension surface to the CPA.
  const negSetForPushback = results.filter(
    (r) => r.expected.replyIntent !== "timeline_pushback",
  );
  const pushbackFP = negSetForPushback.filter(
    (r) => r.predicted.replyIntent === "timeline_pushback",
  ).length;
  const pushbackFPR =
    negSetForPushback.length === 0 ? 0 : pushbackFP / negSetForPushback.length;
  const pushbackFPRMet = pushbackFPR <= PUSHBACK_FPR_CEILING;

  // Per-class confusion (top-level only — per-intent is below).
  const classes = Array.from(
    new Set(results.flatMap((r) => [r.expected.topLevelClass, r.predicted.topLevelClass])),
  ).sort();
  console.log(bold("Top-level confusion (rows = expected, cols = predicted):"));
  const colWidth = Math.max(...classes.map((c) => c.length), 8) + 2;
  const pad = (s: string, w: number) =>
    s.length >= w ? s.slice(0, w - 1) + " " : s + " ".repeat(w - s.length);
  console.log(
    "  " + pad("", colWidth) + classes.map((c) => pad(c, colWidth)).join(""),
  );
  for (const expected of classes) {
    const row = classes.map((predicted) => {
      const count = results.filter(
        (r) =>
          r.expected.topLevelClass === expected &&
          r.predicted.topLevelClass === predicted,
      ).length;
      return pad(count === 0 ? "·" : String(count), colWidth);
    });
    console.log("  " + pad(expected, colWidth) + row.join(""));
  }

  console.log(bold("\nReply-intent confusion (5-sub-class subset only):"));
  const intentClasses = Array.from(
    new Set(
      intentSubset
        .flatMap((r) => [r.expected.replyIntent, r.predicted.replyIntent])
        .filter((x): x is NonNullable<typeof x> => !!x),
    ),
  ).sort();
  if (intentClasses.length === 0) {
    console.log("  (no intent expectations in eval set)");
  } else {
    const iColWidth = Math.max(...intentClasses.map((c) => c.length), 8) + 2;
    console.log(
      "  " + pad("", iColWidth) + intentClasses.map((c) => pad(c, iColWidth)).join(""),
    );
    for (const expected of intentClasses) {
      const row = intentClasses.map((predicted) => {
        const count = intentSubset.filter(
          (r) =>
            r.expected.replyIntent === expected &&
            r.predicted.replyIntent === predicted,
        ).length;
        return pad(count === 0 ? "·" : String(count), iColWidth);
      });
      console.log("  " + pad(expected, iColWidth) + row.join(""));
    }
  }

  console.log(bold("\nTargets vs actuals (PRD §4.7):"));
  const target = (label: string, got: number, threshold: number, le = false) => {
    const met = le ? got <= threshold : got >= threshold;
    const op = le ? "≤" : "≥";
    return `  ${met ? green("✓") : red("✗")}  ${pad(label, 32)} target ${op} ${(threshold * 100).toFixed(0)}%   actual ${(got * 100).toFixed(1)}%`;
  };
  console.log(target("top-level precision", topLevelAccuracy, TOP_LEVEL_TARGET));
  console.log(target("sub-intent precision", intentAccuracy, INTENT_TARGET));
  console.log(
    target(
      "timeline_pushback FPR",
      pushbackFPR,
      PUSHBACK_FPR_CEILING,
      true,
    ),
  );

  console.log("");
  console.log(
    `  ${dim(`top-level: ${topLevelCorrect}/${total} correct`)}`,
  );
  console.log(
    `  ${dim(`sub-intent: ${intentCorrect}/${intentSubset.length} correct (skipped ${total - intentSubset.length} non-intent examples)`)}`,
  );
  console.log(
    `  ${dim(`timeline_pushback: ${pushbackFP} FPs across ${negSetForPushback.length} negatives`)}`,
  );

  if (!usingLLM) {
    console.log(
      yellow(
        `\n  ⚠  Heuristic-only eval. Set ANTHROPIC_API_KEY in backend/.env.local for full LLM eval.`,
      ),
    );
  }

  const allMet = topLevelMet && intentMet && pushbackFPRMet;
  console.log("");
  if (allMet) {
    console.log(green(bold("All §4.7 targets met.")));
    process.exit(0);
  } else {
    console.log(red(bold("One or more §4.7 targets missed.")));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(red(`Eval runner crashed: ${err instanceof Error ? err.stack : String(err)}`));
  process.exit(2);
});
