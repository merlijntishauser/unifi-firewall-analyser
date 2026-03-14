import type { ZonePair } from "../api/types";

export type ActionLabel = "Allow All" | "Allow Return" | "Block All" | "Mixed";

interface CellSummary {
  actionLabel: ActionLabel | null;
  userRuleCount: number;
  predefinedRuleCount: number;
}

export function deriveCellSummary(pair: ZonePair): CellSummary {
  const userRules = pair.rules.filter((r) => !r.predefined);
  const predefinedRules = pair.rules.filter((r) => r.predefined);

  if (pair.rules.length === 0) {
    return { actionLabel: null, userRuleCount: 0, predefinedRuleCount: 0 };
  }

  const actionLabel = deriveActionLabel(pair, predefinedRules);

  return {
    actionLabel,
    userRuleCount: userRules.length,
    predefinedRuleCount: predefinedRules.length,
  };
}

function deriveActionLabel(
  pair: ZonePair,
  predefinedRules: ZonePair["rules"],
): ActionLabel {
  if (predefinedRules.length > 0) {
    return deriveLabelFromPredefined(predefinedRules);
  }
  return deriveLabelFromCounts(pair.allow_count, pair.block_count);
}

function deriveLabelFromPredefined(predefinedRules: ZonePair["rules"]): ActionLabel {
  const enabledPredefined = predefinedRules.filter((r) => r.enabled);
  if (enabledPredefined.length === 0) {
    return "Mixed";
  }

  const hasAllow = enabledPredefined.some((r) => r.action === "ALLOW");
  const hasBlock = enabledPredefined.some((r) => r.action === "BLOCK" || r.action === "REJECT");

  if (hasAllow && hasBlock) return "Mixed";
  if (hasBlock) return "Block All";

  const isReturnOnly = enabledPredefined
    .filter((r) => r.action === "ALLOW")
    .every((r) => r.connection_state_type.toLowerCase().includes("established"));

  return isReturnOnly ? "Allow Return" : "Allow All";
}

function deriveLabelFromCounts(allowCount: number, blockCount: number): ActionLabel {
  if (allowCount > 0 && blockCount === 0) return "Allow All";
  if (blockCount > 0 && allowCount === 0) return "Block All";
  return "Mixed";
}
