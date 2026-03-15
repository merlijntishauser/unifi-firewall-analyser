import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import {
  useTopologySvg,
  useTopologyDevices,
  useMetricsDevices,
  useMetricsHistory,
  useNotifications,
  useHealthSummary,
  useHealthAnalysis,
  useDismissNotification,
} from "./queries";

vi.mock("../api/client", () => ({
  api: {
    getTopologySvg: vi.fn(),
    getTopologyDevices: vi.fn(),
    getMetricsDevices: vi.fn(),
    getMetricsHistory: vi.fn(),
    getNotifications: vi.fn(),
    getHealthSummary: vi.fn(),
    analyzeHealth: vi.fn(),
    dismissNotification: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

describe("topology query hooks", () => {
  it("useTopologySvg does not fetch when disabled", () => {
    const { result } = renderHook(() => useTopologySvg("dark", "isometric", false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useTopologyDevices does not fetch when disabled", () => {
    const { result } = renderHook(() => useTopologyDevices(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("metrics query hooks", () => {
  it("useMetricsDevices does not fetch when disabled", () => {
    const { result } = renderHook(() => useMetricsDevices(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useMetricsHistory does not fetch when disabled", () => {
    const { result } = renderHook(() => useMetricsHistory(null, false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useNotifications does not fetch when disabled", () => {
    const { result } = renderHook(() => useNotifications(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe("health query hooks", () => {
  it("useHealthSummary does not fetch when disabled", () => {
    const { result } = renderHook(() => useHealthSummary(false), { wrapper });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("useHealthAnalysis returns mutation", () => {
    const { result } = renderHook(() => useHealthAnalysis(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });

  it("useDismissNotification returns mutation", () => {
    const { result } = renderHook(() => useDismissNotification(), { wrapper });
    expect(result.current.mutate).toBeDefined();
    expect(result.current.isPending).toBe(false);
  });
});
