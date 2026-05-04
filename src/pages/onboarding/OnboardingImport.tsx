import { Link } from "react-router-dom";
import { OnboardingShell } from "../../components/OnboardingShell";
import { Import } from "../Import";
import { useStore } from "../../data/store";

/**
 * Wraps the existing Import page inside the wizard chrome. The Import page
 * already has CSV detect / map / preview / commit; we just provide a
 * back-link and a continue affordance via the existing flow.
 */
export function OnboardingImport() {
  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      title="Upload your client roster"
      subtitle="Drop a CSV. AI maps the columns; you confirm."
    >
      <ImportWithContinue />
    </OnboardingShell>
  );
}

/**
 * Wraps Import with a contextual "Continue" affordance that appears once the
 * roster has clients. Avoids stranding the user inside the inner Import flow.
 */
function ImportWithContinue() {
  const { clients } = useStore();
  const hasClients = clients.length > 0;
  return (
    <>
      {/* Render Import inline. The standalone Import page renders its own
          card chrome on the preview region; wrapping it again here was
          double-bordering the table and squeezing column widths. */}
      <div className="-mt-4">
        <Import />
      </div>
      {hasClients && (
        <div className="mt-4 bg-info-bg border border-info-border rounded-md px-4 py-3 flex items-center gap-3">
          <p className="text-sm text-info-ink flex-1">
            <span className="font-semibold">{clients.length} clients in.</span>{" "}
            Next: confirm AI-suggested service packages so deadlines auto-generate.
          </p>
          <Link
            to="/onboarding/packages"
            className="text-sm px-4 py-1.5 rounded bg-indigo text-white hover:bg-indigo-hover whitespace-nowrap"
          >
            Continue →
          </Link>
        </div>
      )}
    </>
  );
}
