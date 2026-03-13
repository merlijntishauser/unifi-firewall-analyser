import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "./client";

describe("api client", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
  });

  function mockOkResponse(body: unknown) {
    return {
      ok: true,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    };
  }

  function mockErrorResponse(status: number, body: string) {
    return {
      ok: false,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(body),
    };
  }

  describe("fetchJson", () => {
    it("sends request with Content-Type header", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ ok: true }));
      await api.getAuthStatus();
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/status", {
        headers: { "Content-Type": "application/json" },
      });
    });

    it("throws an error when response is not ok", async () => {
      mockFetch.mockResolvedValue(mockErrorResponse(401, "Unauthorized"));
      await expect(api.getAuthStatus()).rejects.toThrow("401: Unauthorized");
    });

    it("merges custom headers with default Content-Type", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({}));
      await api.login("https://unifi.local", "admin", "pass", "default", true);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/auth/login");
      expect(init.headers).toEqual({ "Content-Type": "application/json" });
      expect(init.method).toBe("POST");
    });
  });

  describe("getAuthStatus", () => {
    it("calls the correct endpoint", async () => {
      const data = { configured: true, source: "env", url: "https://example.com" };
      mockFetch.mockResolvedValue(mockOkResponse(data));
      const result = await api.getAuthStatus();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/status", expect.objectContaining({}));
    });
  });

  describe("login", () => {
    it("sends POST with credentials", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ success: true }));
      await api.login("https://unifi.local", "admin", "pass", "default", false);
      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body).toEqual({
        url: "https://unifi.local",
        username: "admin",
        password: "pass",
        site: "default",
        verify_ssl: false,
      });
    });

    it("sends verify_ssl as true when verifySsl is true", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ success: true }));
      await api.login("https://unifi.local", "admin", "pass", "default", true);
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.verify_ssl).toBe(true);
    });
  });

  describe("logout", () => {
    it("sends POST to logout endpoint", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ success: true }));
      await api.logout();
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("getZones", () => {
    it("fetches zones from the correct endpoint", async () => {
      const zones = [{ id: "z1", name: "External", networks: [] }];
      mockFetch.mockResolvedValue(mockOkResponse(zones));
      const result = await api.getZones();
      expect(result).toEqual(zones);
      expect(mockFetch).toHaveBeenCalledWith("/api/zones", expect.objectContaining({}));
    });
  });

  describe("getRules", () => {
    it("fetches rules from the correct endpoint", async () => {
      const rules = [{ id: "r1", name: "Block all", action: "BLOCK" }];
      mockFetch.mockResolvedValue(mockOkResponse(rules));
      const result = await api.getRules();
      expect(result).toEqual(rules);
      expect(mockFetch).toHaveBeenCalledWith("/api/rules", expect.objectContaining({}));
    });
  });

  describe("getZonePairs", () => {
    it("fetches zone pairs from the correct endpoint", async () => {
      const pairs = [{ source_zone_id: "z1", destination_zone_id: "z2", rules: [] }];
      mockFetch.mockResolvedValue(mockOkResponse(pairs));
      const result = await api.getZonePairs();
      expect(result).toEqual(pairs);
      expect(mockFetch).toHaveBeenCalledWith("/api/zone-pairs", expect.objectContaining({}));
    });
  });

  describe("simulate", () => {
    it("sends POST with simulation request body", async () => {
      const req = { src_ip: "10.0.0.1", dst_ip: "10.0.1.1", protocol: "tcp", port: 443 };
      const response = { verdict: "ALLOW", evaluations: [] };
      mockFetch.mockResolvedValue(mockOkResponse(response));
      const result = await api.simulate(req);
      expect(result).toEqual(response);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/simulate");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual(req);
    });

    it("sends simulation request with null port", async () => {
      const req = { src_ip: "10.0.0.1", dst_ip: "10.0.1.1", protocol: "icmp", port: null };
      mockFetch.mockResolvedValue(mockOkResponse({ verdict: "BLOCK" }));
      await api.simulate(req);
      const [, init] = mockFetch.mock.calls[0];
      expect(JSON.parse(init.body).port).toBeNull();
    });
  });

  describe("getAiConfig", () => {
    it("fetches AI config from the correct endpoint", async () => {
      const config = { base_url: "http://test.com", model: "gpt-4", provider_type: "openai", has_key: true, source: "db" };
      mockFetch.mockResolvedValue(mockOkResponse(config));
      const result = await api.getAiConfig();
      expect(result).toEqual(config);
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/ai", expect.objectContaining({}));
    });
  });

  describe("saveAiConfig", () => {
    it("sends PUT with config body", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ status: "ok" }));
      await api.saveAiConfig({ base_url: "http://test.com", api_key: "key", model: "gpt-4", provider_type: "openai" });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/settings/ai");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ base_url: "http://test.com", api_key: "key", model: "gpt-4", provider_type: "openai" });
    });
  });

  describe("deleteAiConfig", () => {
    it("sends DELETE to correct endpoint", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ status: "ok" }));
      await api.deleteAiConfig();
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/ai", expect.objectContaining({ method: "DELETE" }));
    });
  });

  describe("testAiConnection", () => {
    it("sends POST to test endpoint", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ status: "ok" }));
      const result = await api.testAiConnection();
      expect(result).toEqual({ status: "ok" });
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/ai/test", expect.objectContaining({ method: "POST" }));
    });
  });

  describe("getAiPresets", () => {
    it("fetches presets from correct endpoint", async () => {
      const presets = [{ id: "openai", name: "OpenAI" }];
      mockFetch.mockResolvedValue(mockOkResponse(presets));
      const result = await api.getAiPresets();
      expect(result).toEqual(presets);
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/ai/presets", expect.objectContaining({}));
    });
  });

  describe("getAiAnalysisSettings", () => {
    it("fetches analysis settings from correct endpoint", async () => {
      const data = { site_profile: "homelab" };
      mockFetch.mockResolvedValue(mockOkResponse(data));
      const result = await api.getAiAnalysisSettings();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/ai-analysis", expect.objectContaining({}));
    });
  });

  describe("saveAiAnalysisSettings", () => {
    it("sends PUT with analysis settings body", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ site_profile: "enterprise" }));
      await api.saveAiAnalysisSettings({ site_profile: "enterprise" });
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/settings/ai-analysis");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ site_profile: "enterprise" });
    });
  });

  describe("analyzeWithAi", () => {
    it("sends POST with analysis request", async () => {
      const req = { source_zone_name: "LAN", destination_zone_name: "WAN", rules: [] };
      const response = { findings: [] };
      mockFetch.mockResolvedValue(mockOkResponse(response));
      const result = await api.analyzeWithAi(req);
      expect(result).toEqual(response);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/analyze");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual(req);
    });
  });

  describe("getZoneFilter", () => {
    it("fetches zone filter from correct endpoint", async () => {
      const data = { hidden_zone_ids: ["z1", "z2"] };
      mockFetch.mockResolvedValue(mockOkResponse(data));
      const result = await api.getZoneFilter();
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith("/api/settings/zone-filter", expect.objectContaining({}));
    });
  });

  describe("saveZoneFilter", () => {
    it("sends PUT with hidden zone IDs", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ status: "ok" }));
      await api.saveZoneFilter(["z1", "z2"]);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/settings/zone-filter");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ hidden_zone_ids: ["z1", "z2"] });
    });
  });

  describe("toggleRule", () => {
    it("sends PATCH to toggle endpoint with enabled flag", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ status: "ok" }));
      await api.toggleRule("r1", false);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/rules/r1/toggle");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toEqual({ enabled: false });
    });
  });

  describe("swapRuleOrder", () => {
    it("sends PUT to reorder endpoint with both policy IDs", async () => {
      mockFetch.mockResolvedValue(mockOkResponse({ status: "ok" }));
      await api.swapRuleOrder("r1", "r2");
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("/api/rules/reorder");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ policy_id_a: "r1", policy_id_b: "r2" });
    });
  });
});
