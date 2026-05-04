import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { OnboardingShell } from "../../components/OnboardingShell";
import { PrimaryButton } from "../auth/AuthShell";
import { actions } from "../../data/store";

/**
 * Demo data path. The store already seeds 8+ realistic clients with
 * deadlines, alerts, and prior-year facts — so "Try demo data" just
 * resets to seeds and forwards to packages.
 */
export function OnboardingDemo() {
  const navigate = useNavigate();

  const tryIt = () => {
    actions.resetToSeeds();
    navigate("/onboarding/packages");
  };

  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      estimate="instant"
      title="Try the demo data"
      subtitle="We'll load 49 fake clients with realistic deadlines, alerts, and prior-year history. Wipeable from Settings → Data anytime."
      brandLine="The demo workspace is the wedge. Yan Jing said 'no more SaaS pivots' — let prospects kick the tires without commitment."
    >
      <div className="bg-canvas border border-line rounded-md p-6">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-indigo-soft text-indigo flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" aria-hidden />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-ink-900">What's included</p>
            <ul className="mt-2 text-sm text-ink-700 space-y-1.5 list-disc pl-5 leading-relaxed">
              <li>49 active clients across CA, NY, TX, LA, FL.</li>
              <li>~150 deadlines spread across overdue / week / month / long-term.</li>
              <li>A live state-extension alert affecting 6 clients (Pattern 3 demo).</li>
              <li>3 years of prior facts for Mode B / E demonstrations.</li>
              <li>Mode E flagship insight: "Schedule E disappeared after 5 years" on Mark Sullivan.</li>
            </ul>
            <p className="text-xs text-ink-500 mt-4">
              You can wipe demo data anytime from Settings → Data → Reset.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <PrimaryButton onClick={tryIt}>
          Load demo data and continue
        </PrimaryButton>
      </div>
    </OnboardingShell>
  );
}
