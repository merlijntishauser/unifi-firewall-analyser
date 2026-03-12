/**
 * Shared mock data and API route helpers for e2e tests.
 *
 * All /api/* calls are intercepted at the browser level so no backend is needed.
 */
import type { Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mock data (mirrors backend test fixtures)
// ---------------------------------------------------------------------------

const ZONES = [
  { id: "zone-external", name: "External", networks: [] },
  {
    id: "zone-internal",
    name: "Internal",
    networks: [{ id: "net-lan", name: "LAN", vlan_id: 1, subnet: "192.168.1.0/24" }],
  },
  {
    id: "zone-guest",
    name: "Guest",
    networks: [{ id: "net-guest", name: "Guest WiFi", vlan_id: 100, subnet: "10.0.100.0/24" }],
  },
  {
    id: "zone-iot",
    name: "IoT",
    networks: [{ id: "net-iot", name: "IoT Devices", vlan_id: 200, subnet: "10.0.200.0/24" }],
  },
];

const RULE_DEFAULTS = {
  description: "",
  enabled: true,
  protocol: "",
  port_ranges: [] as string[],
  ip_ranges: [] as string[],
  predefined: false,
  source_ip_ranges: [] as string[],
  source_mac_addresses: [] as string[],
  source_port_ranges: [] as string[],
  source_network_id: "",
  destination_mac_addresses: [] as string[],
  destination_network_id: "",
  source_port_group: "",
  source_port_group_members: [] as string[],
  destination_port_group: "",
  destination_port_group_members: [] as string[],
  source_address_group: "",
  source_address_group_members: [] as string[],
  destination_address_group: "",
  destination_address_group_members: [] as string[],
  connection_state_type: "",
  connection_logging: false,
  schedule: "",
  match_ip_sec: "",
};

function rule(id: string, name: string, action: string, src: string, dst: string, index: number, extra = {}) {
  return { ...RULE_DEFAULTS, id, name, action, source_zone_id: src, destination_zone_id: dst, index, ...extra };
}

const RULES = {
  internalToExternal: [
    rule("r1", "Allow LAN to Internet", "ALLOW", "zone-internal", "zone-external", 100, {
      description: "Allow all traffic from LAN to WAN",
    }),
  ],
  guestToExternal: [
    rule("r2", "Allow Guest Web Access", "ALLOW", "zone-guest", "zone-external", 200, {
      protocol: "tcp",
      port_ranges: ["80", "443"],
      description: "Allow Guest zone to access web on WAN",
    }),
    rule("r3", "Allow Guest DNS", "ALLOW", "zone-guest", "zone-external", 210, {
      protocol: "udp",
      port_ranges: ["53"],
    }),
    rule("r4", "Block Guest Other Traffic", "BLOCK", "zone-guest", "zone-external", 290),
  ],
  iotToInternal: [
    rule("r5", "Block IoT to LAN", "BLOCK", "zone-iot", "zone-internal", 300, {
      description: "Prevent IoT devices from reaching LAN",
    }),
  ],
  guestToInternal: [
    rule("r7", "Block Guest to LAN", "BLOCK", "zone-guest", "zone-internal", 400),
  ],
};

function pair(src: string, dst: string, rules: Record<string, unknown>[]) {
  const allow = rules.filter((r) => r.action === "ALLOW" && r.enabled).length;
  const block = rules.filter((r) => r.action !== "ALLOW" && r.enabled).length;
  const score = block > 0 && allow === 0 ? 95 : allow > 0 && block > 0 ? 70 : 50;
  const grade = score >= 90 ? "A" : score >= 70 ? "C" : "D";
  return {
    source_zone_id: src,
    destination_zone_id: dst,
    rules,
    allow_count: allow,
    block_count: block,
    analysis: { score, grade, findings: [] },
  };
}

const ZONE_PAIRS = [
  pair("zone-internal", "zone-external", RULES.internalToExternal),
  pair("zone-guest", "zone-external", RULES.guestToExternal),
  pair("zone-iot", "zone-internal", RULES.iotToInternal),
  pair("zone-guest", "zone-internal", RULES.guestToInternal),
];

const SIMULATE_RESPONSE = {
  source_zone_id: "zone-guest",
  source_zone_name: "Guest",
  destination_zone_id: "zone-external",
  destination_zone_name: "External",
  verdict: "ALLOW",
  matched_rule_id: "r2",
  matched_rule_name: "Allow Guest Web Access",
  default_policy_used: false,
  evaluations: [
    { rule_id: "r2", rule_name: "Allow Guest Web Access", matched: true, reason: "all conditions met", skipped_disabled: false },
  ],
};

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

export interface MockApiOptions {
  authenticated?: boolean;
}

export async function mockApi(page: Page, options: MockApiOptions = {}): Promise<void> {
  const { authenticated = true } = options;

  await page.route("**/api/auth/status", (route) =>
    route.fulfill({
      json: {
        configured: authenticated,
        source: authenticated ? "runtime" : "none",
        url: authenticated ? "https://unifi.local" : "",
      },
    }),
  );

  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ json: { status: "ok" } }),
  );

  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ json: { status: "ok" } }),
  );

  await page.route("**/api/zones", (route) =>
    route.fulfill({ json: ZONES }),
  );

  await page.route("**/api/zone-pairs", (route) =>
    route.fulfill({ json: ZONE_PAIRS }),
  );

  await page.route("**/api/simulate", (route) =>
    route.fulfill({ json: SIMULATE_RESPONSE }),
  );

  await page.route("**/api/settings/ai", (route) =>
    route.fulfill({
      json: { base_url: "", model: "", provider_type: "", has_key: false, source: "none" },
    }),
  );

  await page.route("**/api/settings/zone-filter", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { hidden_zone_ids: [] } });
    }
    return route.fulfill({ json: { status: "ok" } });
  });
}
