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
      estimate="~2 minutes"
      title="Upload your client roster"
      subtitle="Drag a CSV from File In Time, TaxDome, Drake, ProConnect, QuickBooks, or plain Excel. AI maps the columns; you confirm. AI handles ambiguous rows by surfacing them inline."
      brandLine="Import Tier 1 — the only mandatory upload. Tiers 2-4 are optional capability unlocks later."
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
      <div className="bg-canvas border border-line rounded-md p-3">
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
