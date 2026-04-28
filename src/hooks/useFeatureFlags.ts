/**
 * Tier-gated feature flags. Components check flags, never the tier directly,
 * so swapping pricing/tier rules later is a one-file change.
 */
import { useMaybeServerSession } from "../lib/session-provider";
import type { FirmTier } from "../types";

export interface FeatureFlags {
  tier: FirmTier;
  canInviteTeammates: boolean;
  maxTeammates: number;
  canAccessAPI: boolean;
  canCustomDomain: boolean;
  canCustomBranding: boolean;
  hasClientLimit: boolean;
  clientLimit: number | null;
  canAssignDeadlines: boolean;
  canBatchNotifyEmail: boolean;
  canExportPdf: boolean;
}

const SOLO_FLAGS: Omit<FeatureFlags, "tier"> = {
  canInviteTeammates: false,
  maxTeammates: 1,
  canAccessAPI: false,
  canCustomDomain: false,
  canCustomBranding: false,
  hasClientLimit: true,
  clientLimit: 80,
  canAssignDeadlines: false,
  canBatchNotifyEmail: true,
  canExportPdf: true,
};

const PRO_FLAGS: Omit<FeatureFlags, "tier"> = {
  canInviteTeammates: true,
  maxTeammates: 3,
  canAccessAPI: false,
  canCustomDomain: false,
  canCustomBranding: true,
  hasClientLimit: false,
  clientLimit: null,
  canAssignDeadlines: true,
  canBatchNotifyEmail: true,
  canExportPdf: true,
};

const TEAM_FLAGS: Omit<FeatureFlags, "tier"> = {
  canInviteTeammates: true,
  maxTeammates: 10,
  canAccessAPI: true,
  canCustomDomain: true,
  canCustomBranding: true,
  hasClientLimit: false,
  clientLimit: null,
  canAssignDeadlines: true,
  canBatchNotifyEmail: true,
  canExportPdf: true,
};

function flagsForTier(tier: FirmTier): FeatureFlags {
  if (tier === "team") return { tier, ...TEAM_FLAGS };
  if (tier === "pro") return { tier, ...PRO_FLAGS };
  return { tier, ...SOLO_FLAGS };
}

export function useFeatureFlags(): FeatureFlags {
  const session = useMaybeServerSession();
  return flagsForTier(session?.tier ?? "solo");
}
