import { useNavigate } from "react-router-dom";
import { OnboardingShell } from "../../components/OnboardingShell";
import { PrimaryButton } from "../auth/AuthShell";
import { Import } from "../Import";
import { useStore } from "../../data/store";

/**
 * Wraps the existing Import page inside the wizard chrome. The Import page
 * already has CSV detect / map / preview / commit; we just provide a back-link
 * and a continue affordance via the existing flow.
 */
export function OnboardingImport() {
  return (
    <OnboardingShell
      step={3}
      totalSteps={3}
      title="Upload your client roster"
      subtitle="Drop a CSV. AI maps the columns; you confirm."
      brandLine="Tier 1 covers the roster (clients + entity + state). Tiers 2-4 ship with prior-year returns, K-1 packets, and Gmail history later — they're capability unlocks, not gates."
      wide
    >
      <ImportWithContinue />
    </OnboardingShell>
  );
}

function ImportWithContinue() {
  const navigate = useNavigate();
  const { clients } = useStore();
  const hasClients = clients.length > 0;
  return (
    <>
      {/* Render Import inline — it has its own card chrome on the preview
          region. Wrapping it in another card was double-bordering and
          squeezing the preview-table width unnecessarily. */}
      <div className="-mt-4">
        <Import />
      </div>
      {hasClients && (
        <div className="mt-5 bg-indigo-soft/50 border border-indigo/30 rounded-md px-5 py-4 flex items-center gap-4 flex-wrap">
          <p className="text-sm text-indigo-ink flex-1 min-w-0 leading-relaxed">
            <span className="font-semibold">{clients.length} clients in.</span>{" "}
            Next: confirm AI-suggested service packages so deadlines auto-generate.
          </p>
          <PrimaryButton onClick={() => navigate("/onboarding/packages")}>
            Continue
          </PrimaryButton>
        </div>
      )}
    </>
  );
}
