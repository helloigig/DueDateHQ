import { Link } from "react-router-dom";
import { Sparkles, ArrowUpRight } from "lucide-react";
import type { FirmTier } from "../types";

const TIER_LABEL: Record<FirmTier, string> = {
  solo: "Solo",
  pro: "Pro",
  team: "Team",
};

export function UpgradePrompt({
  feature,
  requiredTier,
  inline = false,
}: {
  feature: string;
  requiredTier: FirmTier;
  inline?: boolean;
}) {
  const label = TIER_LABEL[requiredTier];

  if (inline) {
    return (
      <div className="text-xs bg-info-bg border border-info-border text-info-ink rounded px-3 py-2 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="flex-1">
          {feature} is on the {label} plan.
        </span>
        <Link
          to="/settings"
          className="font-medium underline whitespace-nowrap"
        >
          Upgrade
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-line rounded-md px-6 py-8 text-center">
      <Sparkles
        className="w-5 h-5 mx-auto text-info-ink"
        aria-hidden
      />
      <p className="mt-3 text-sm text-ink-900 font-medium">
        {feature} is part of {label}.
      </p>
      <p className="text-xs text-ink-500 mt-1">
        Upgrade your plan to unlock this for your firm.
      </p>
      <Link
        to="/settings"
        className="mt-4 inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover"
      >
        Upgrade to {label}
        <ArrowUpRight className="w-3.5 h-3.5" aria-hidden />
      </Link>
    </div>
  );
}
