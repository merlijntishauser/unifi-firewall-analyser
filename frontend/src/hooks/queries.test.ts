import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import { useHealthSummary, useHealthAnalysis, useDismissNotification } from "./queries";

vi.mock("../api/client", () => ({
  api: {
    getHealthSummary: vi.fn(),
    analyzeHealth: vi.fn(),
    dismissNotification: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

describe("health query hooks", () => {
  it("useHealthSummary returns query when disabled", () => {
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
