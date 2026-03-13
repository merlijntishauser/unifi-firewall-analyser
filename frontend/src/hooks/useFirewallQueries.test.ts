import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import { useFirewallQueries } from "./useFirewallQueries";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getZones: vi.fn(),
    getZonePairs: vi.fn(),
  },
}));

const mockGetZones = vi.mocked(api.getZones);
const mockGetZonePairs = vi.mocked(api.getZonePairs);

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFirewallQueries", () => {
  it("returns empty arrays when disabled", () => {
    const { result } = renderHook(() => useFirewallQueries(false), { wrapper });
    expect(result.current.zones).toEqual([]);
    expect(result.current.zonePairs).toEqual([]);
    expect(result.current.dataLoading).toBe(false);
    expect(result.current.dataError).toBeNull();
    expect(mockGetZones).not.toHaveBeenCalled();
  });

  it("fetches zones and zone pairs when enabled", async () => {
    const zones = [{ id: "z1", name: "LAN", networks: [] }];
    const pairs = [{ source_zone_id: "z1", destination_zone_id: "z1", rules: [], grade: "A", score: 95, findings: [] }];
    mockGetZones.mockResolvedValue(zones);
    mockGetZonePairs.mockResolvedValue(pairs);

    const { result } = renderHook(() => useFirewallQueries(true), { wrapper });

    await waitFor(() => {
      expect(result.current.dataLoading).toBe(false);
    });

    expect(result.current.zones).toEqual(zones);
    expect(result.current.zonePairs).toEqual(pairs);
    expect(result.current.dataError).toBeNull();
  });

  it("returns error when fetch fails", async () => {
    mockGetZones.mockRejectedValue(new Error("Network error"));
    mockGetZonePairs.mockResolvedValue([]);

    const { result } = renderHook(() => useFirewallQueries(true), { wrapper });

    await waitFor(() => {
      expect(result.current.dataError).not.toBeNull();
    });

    expect(result.current.dataError!.message).toBe("Network error");
  });
});
