import { useMemo } from "react";
import { useZones, useZonePairs } from "./queries";

export function useFirewallQueries(enabled: boolean) {
  const zonesQuery = useZones(enabled);
  const zonePairsQuery = useZonePairs(enabled);
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);
  const zonePairs = useMemo(() => zonePairsQuery.data ?? [], [zonePairsQuery.data]);
  return { zones, zonePairs, dataLoading: zonesQuery.isLoading || zonePairsQuery.isLoading, dataError: zonesQuery.error ?? zonePairsQuery.error };
}
