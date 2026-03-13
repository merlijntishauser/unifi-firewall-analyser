import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import { useAiInfo } from "./useAiInfo";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getAiConfig: vi.fn(),
  },
}));

const mockGetAiConfig = vi.mocked(api.getAiConfig);

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAiInfo", () => {
  it("returns defaults when disabled", () => {
    const { result } = renderHook(() => useAiInfo(false), { wrapper });
    expect(result.current.aiConfigured).toBe(false);
    expect(result.current.aiInfo).toEqual({ configured: false, provider: "", model: "" });
    expect(mockGetAiConfig).not.toHaveBeenCalled();
  });

  it("returns ai config when enabled and configured", async () => {
    mockGetAiConfig.mockResolvedValue({
      base_url: "https://api.anthropic.com",
      model: "claude-sonnet-4-20250514",
      provider_type: "anthropic",
      has_key: true,
      key_source: "db",
      source: "db",
    });

    const { result } = renderHook(() => useAiInfo(true), { wrapper });

    await waitFor(() => {
      expect(result.current.aiConfigured).toBe(true);
    });

    expect(result.current.aiInfo).toEqual({
      configured: true,
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
    });
  });

  it("returns not configured when no key", async () => {
    mockGetAiConfig.mockResolvedValue({
      base_url: "",
      model: "",
      provider_type: "",
      has_key: false,
      key_source: "none",
      source: "none",
    });

    const { result } = renderHook(() => useAiInfo(true), { wrapper });

    await waitFor(() => {
      expect(result.current.aiInfo.configured).toBe(false);
    });

    expect(result.current.aiConfigured).toBe(false);
  });
});
