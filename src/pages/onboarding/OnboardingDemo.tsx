import { useNavigate } from "react-router-dom";
import { OnboardingShell } from "../../components/OnboardingShell";
import { actions } from "../../data/store";

/**
 * Demo data path. The store already seeds 8+ realistic clients with
 * deadlines, alerts, and prior-year facts — so "Try demo data" just
 * resets to seeds and forwards to the dashboard.
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
      title="Try the demo data"
      subtitle="We'll load 49 fake clients with realistic deadlines, alerts, and prior-year history. Wipeable from Settings → Data anytime."
    >
      <div className="bg-surface border border-line rounded-md p-5 max-w-xl">
        <p className="text-sm text-ink-700">What's included:</p>
        <ul className="mt-2 text-sm text-ink-700 space-y-1.5 list-disc pl-5">
          <li>49 active clients across CA, NY, TX, LA, FL.</li>
          <li>~150 deadlines spread across overdue / week / month / long-term.</li>
          <li>A live state-extension alert affecting 6 clients (Pattern 3 demo).</li>
          <li>3 years of prior facts for Mode B / E demonstrations.</li>
          <li>Mode E flagship insight: "Schedule E disappeared after 5 years" on Mark Sullivan.</li>
        </ul>
        <p className="text-xs text-ink-500 mt-4">
          You can wipe demo data anytime from Settings → Data → Reset.
        </p>
        <button
          onClick={tryIt}
          className="mt-5 text-sm px-4 py-2 rounded bg-indigo text-white hover:bg-indigo-hover"
        >
          Load demo data and continue
        </button>
      </div>
    </OnboardingShell>
  );
}
