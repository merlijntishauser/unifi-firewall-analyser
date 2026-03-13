import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { createTestQueryClient } from "../test-utils";
import { useAuthFlow } from "./useAuth";
import { api } from "../api/client";

vi.mock("../api/client", () => ({
  api: {
    getAppAuthStatus: vi.fn(),
    getAuthStatus: vi.fn(),
  },
}));

const mockGetAppAuthStatus = vi.mocked(api.getAppAuthStatus);
const mockGetAuthStatus = vi.mocked(api.getAuthStatus);

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuthFlow", () => {
  it("returns loading state initially", () => {
    mockGetAppAuthStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuthFlow(), { wrapper });
    expect(result.current.authLoading).toBe(true);
    expect(result.current.authed).toBe(false);
  });

  it("skips unifi check when app auth is required and not authenticated", async () => {
    mockGetAppAuthStatus.mockResolvedValue({ required: true, authenticated: false });
    const { result } = renderHook(() => useAuthFlow(), { wrapper });

    await waitFor(() => {
      expect(result.current.authLoading).toBe(false);
    });

    expect(result.current.appAuthRequired).toBe(true);
    expect(result.current.appAuthenticated).toBe(false);
    expect(result.current.authed).toBe(false);
    expect(mockGetAuthStatus).not.toHaveBeenCalled();
  });

  it("checks unifi auth when app auth is not required", async () => {
    mockGetAppAuthStatus.mockResolvedValue({ required: false, authenticated: false });
    mockGetAuthStatus.mockResolvedValue({ configured: true, source: "env", url: "https://unifi.local", username: "admin" });

    const { result } = renderHook(() => useAuthFlow(), { wrapper });

    await waitFor(() => {
      expect(result.current.authed).toBe(true);
    });

    expect(result.current.connectionInfo).toEqual({
      url: "https://unifi.local",
      username: "admin",
      source: "env",
    });
  });

  it("checks unifi auth when app auth is required and authenticated", async () => {
    mockGetAppAuthStatus.mockResolvedValue({ required: true, authenticated: true });
    mockGetAuthStatus.mockResolvedValue({ configured: false, source: "none", url: "", username: "" });

    const { result } = renderHook(() => useAuthFlow(), { wrapper });

    await waitFor(() => {
      expect(result.current.authLoading).toBe(false);
    });

    expect(result.current.appAuthRequired).toBe(true);
    expect(result.current.appAuthenticated).toBe(true);
    expect(result.current.authed).toBe(false);
    expect(result.current.connectionInfo).toBeNull();
  });

  it("returns null connectionInfo when not authed", async () => {
    mockGetAppAuthStatus.mockResolvedValue({ required: false, authenticated: false });
    mockGetAuthStatus.mockResolvedValue({ configured: false, source: "none", url: "", username: "" });

    const { result } = renderHook(() => useAuthFlow(), { wrapper });

    await waitFor(() => {
      expect(result.current.authLoading).toBe(false);
    });

    expect(result.current.connectionInfo).toBeNull();
  });
});
