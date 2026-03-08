import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Zone, ZonePair } from "../api/types";

export function useFirewallData() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zonePairs, setZonePairs] = useState<ZonePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, zp] = await Promise.all([api.getZones(), api.getZonePairs()]);
      setZones(z);
      setZonePairs(zp);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { zones, zonePairs, loading, error, refresh };
}
