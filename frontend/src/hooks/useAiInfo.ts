import { useMemo } from "react";
import { useAiConfig } from "./queries";

interface AiInfo {
  configured: boolean;
  provider: string;
  model: string;
}

export function useAiInfo(enabled: boolean): { aiConfigured: boolean; aiInfo: AiInfo } {
  const aiConfigQuery = useAiConfig(enabled);
  const aiConfigured = aiConfigQuery.data?.has_key ?? false;
  const aiInfo: AiInfo = useMemo(() => ({
    configured: aiConfigQuery.data?.has_key ?? false,
    provider: aiConfigQuery.data?.provider_type ?? "",
    model: aiConfigQuery.data?.model ?? "",
  }), [aiConfigQuery.data]);
  return { aiConfigured, aiInfo };
}
