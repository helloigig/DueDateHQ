import { useState } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { Modal, useModalLabelId } from "./Modal";

/**
 * "How is AI used?" affordance — small info button + modal that explains
 * where AI sits in the product, what it does autonomously, and where the
 * CPA always reviews. Lives on the Dashboard header so the answer is one
 * click away from the morning glance.
 *
 * Tone: not a marketing pitch. CPAs are skeptical of AI; we lead with what
 * AI DOESN'T do (file taxes, send unreviewed email) before what it does.
 */
export function AiUsageInfo() {
  const [open, setOpen] = useState(false);
  const labelId = useModalLabelId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink hover:bg-info-bg/80"
        aria-label="How is AI used in DueDateHQ?"
        title="How is AI used?"
      >
        <Sparkles className="w-3 h-3" aria-hidden />
        <span>How is AI used?</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabelledBy={labelId}
        size="lg"
      >
        <Modal.Header id={labelId} title="How AI is used here" />
        <Modal.Body className="text-sm text-ink-700 space-y-4">
          <p className="text-ink-700">
            DueDateHQ uses AI as a junior associate, not a decision-maker.
            Every AI-generated suggestion is reviewable, sourced, and
            reversible — you stay in control of every client-facing action.
          </p>

          <Section
            title="What AI does for you"
            tone="ok"
            items={[
              [
                "Reads state-DOR announcements",
                "Parses extension notices, PTE rule changes, and disaster declarations from 50 state authorities. Flags which of your clients are affected and proposes new deadlines.",
              ],
              [
                "Drafts reminder emails",
                "Writes the chase email (\"missing K-1\", \"docs request\") grounded in the client's history and your firm's voice. You review before send.",
              ],
              [
                "Routes inbound documents",
                "Per-task forwarding addresses (e.g. emily-1040-X7fK@duedatehq.com) get parsed and attached to the right client + task automatically.",
              ],
              [
                "Surfaces what to do next",
                "The Today queue is AI-curated from nine signals (urgency, waiting time, client history). It's a recommendation — you can reorder freely.",
              ],
            ]}
          />

          <Section
            title="What AI never does"
            tone="warn"
            items={[
              [
                "File anything with the IRS or a state",
                "DueDateHQ never submits returns, extensions, or filings. Filing happens in your tax-prep tool, by you.",
              ],
              [
                "Send client emails without your review",
                "Drafts wait for your approval. There is no \"auto-send\" toggle that bypasses you for client-facing mail.",
              ],
              [
                "Decide tax positions",
                "AI summaries link to the official source. We never substitute parse-confidence for a CPA's judgment on a deduction or election.",
              ],
              [
                "Train on your data",
                "Your client roster, documents, and email drafts are not used to train shared models. Workspace data is your firm's.",
              ],
            ]}
          />

          <div className="bg-info-bg border border-info-border rounded px-3 py-2 text-xs text-info-ink flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <span>
              Every alert links to the official authority source. Every
              AI-drafted email shows the prompt + sources. Confidence levels
              (high / medium / low) are surfaced before you act.
            </span>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded bg-indigo text-white text-sm hover:bg-indigo-hover"
          >
            Got it
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function Section({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<[string, string]>;
  tone: "ok" | "warn";
}) {
  const headerClass =
    tone === "ok" ? "text-ok-ink" : "text-warn-ink";
  return (
    <div>
      <h3 className={`text-xs uppercase tracking-wider font-semibold ${headerClass}`}>
        {title}
      </h3>
      <ul className="mt-2 space-y-2.5">
        {items.map(([label, detail]) => (
          <li key={label} className="flex gap-3">
            <span
              className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                tone === "ok" ? "bg-ok-solid" : "bg-warn-solid"
              }`}
              aria-hidden
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-ink-900">{label}</p>
              <p className="text-xs text-ink-500 mt-0.5">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
