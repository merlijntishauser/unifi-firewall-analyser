import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useFirewallData } from "./useFirewallData";

vi.mock("../api/client", () => ({
  api: {
    getZones: vi.fn(),
    getZonePairs: vi.fn(),
  },
}));

import { api } from "../api/client";

const mockGetZones = vi.mocked(api.getZones);
const mockGetZonePairs = vi.mocked(api.getZonePairs);

describe("useFirewallData", () => {
  const mockZones = [
    { id: "z1", name: "External", networks: [] },
    { id: "z2", name: "Internal", networks: [] },
  ];

  const mockZonePairs = [
    {
      source_zone_id: "z1",
      destination_zone_id: "z2",
      rules: [],
      allow_count: 1,
      block_count: 0,
      analysis: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when enabled is false", () => {
    renderHook(() => useFirewallData(false));
    expect(mockGetZones).not.toHaveBeenCalled();
    expect(mockGetZonePairs).not.toHaveBeenCalled();
  });

  it("returns initial state when not enabled", () => {
    const { result } = renderHook(() => useFirewallData(false));
    expect(result.current.zones).toEqual([]);
    expect(result.current.zonePairs).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches data when enabled is true", async () => {
    mockGetZones.mockResolvedValue(mockZones);
    mockGetZonePairs.mockResolvedValue(mockZonePairs);

    const { result } = renderHook(() => useFirewallData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.zones).toEqual(mockZones);
    expect(result.current.zonePairs).toEqual(mockZonePairs);
    expect(result.current.error).toBeNull();
  });

  it("sets loading to true while fetching", async () => {
    let resolveZones!: (value: unknown) => void;
    let resolveZonePairs!: (value: unknown) => void;
    mockGetZones.mockReturnValue(new Promise((r) => { resolveZones = r; }));
    mockGetZonePairs.mockReturnValue(new Promise((r) => { resolveZonePairs = r; }));

    const { result } = renderHook(() => useFirewallData(true));

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveZones(mockZones);
      resolveZonePairs(mockZonePairs);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("sets error when fetch fails with an Error", async () => {
    mockGetZones.mockRejectedValue(new Error("Network error"));
    mockGetZonePairs.mockResolvedValue([]);

    const { result } = renderHook(() => useFirewallData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.zones).toEqual([]);
    expect(result.current.zonePairs).toEqual([]);
  });

  it("sets fallback error when fetch fails with non-Error", async () => {
    mockGetZones.mockRejectedValue("something weird");
    mockGetZonePairs.mockResolvedValue([]);

    const { result } = renderHook(() => useFirewallData(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Failed to fetch data");
  });

  it("refresh can be called manually", async () => {
    mockGetZones.mockResolvedValue(mockZones);
    mockGetZonePairs.mockResolvedValue(mockZonePairs);

    const { result } = renderHook(() => useFirewallData(false));

    expect(mockGetZones).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockGetZones).toHaveBeenCalledTimes(1);
    expect(result.current.zones).toEqual(mockZones);
    expect(result.current.zonePairs).toEqual(mockZonePairs);
  });

  it("fetches data when enabled changes from false to true", async () => {
    mockGetZones.mockResolvedValue(mockZones);
    mockGetZonePairs.mockResolvedValue(mockZonePairs);

    const { result, rerender } = renderHook(
      ({ enabled }) => useFirewallData(enabled),
      { initialProps: { enabled: false } },
    );

    expect(mockGetZones).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetZones).toHaveBeenCalledTimes(1);
    expect(result.current.zones).toEqual(mockZones);
  });

  it("clears error on successful refresh", async () => {
    mockGetZones.mockRejectedValueOnce(new Error("fail"));
    mockGetZonePairs.mockResolvedValue([]);

    const { result } = renderHook(() => useFirewallData(true));

    await waitFor(() => {
      expect(result.current.error).toBe("fail");
    });

    mockGetZones.mockResolvedValueOnce(mockZones);
    mockGetZonePairs.mockResolvedValueOnce(mockZonePairs);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.zones).toEqual(mockZones);
  });
});
