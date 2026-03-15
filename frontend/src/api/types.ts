export interface Network {
  id: string;
  name: string;
  vlan_id: number | null;
  subnet: string | null;
}

export interface Zone {
  id: string;
  name: string;
  networks: Network[];
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: "ALLOW" | "BLOCK" | "REJECT";
  source_zone_id: string;
  destination_zone_id: string;
  protocol: string;
  port_ranges: string[];
  ip_ranges: string[];
  index: number;
  predefined: boolean;
  // Source-side filtering
  source_ip_ranges: string[];
  source_mac_addresses: string[];
  source_port_ranges: string[];
  source_network_id: string;
  // Destination-side filtering
  destination_mac_addresses: string[];
  destination_network_id: string;
  // Firewall group references (resolved)
  source_port_group: string;
  source_port_group_members: string[];
  destination_port_group: string;
  destination_port_group_members: string[];
  source_address_group: string;
  source_address_group_members: string[];
  destination_address_group: string;
  destination_address_group_members: string[];
  // Connection state / metadata
  connection_state_type: string;
  connection_logging: boolean;
  schedule: string;
  match_ip_sec: string;
}

export interface Finding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  rationale?: string;
  rule_id: string | null;
  rule_ids?: string[];
  confidence?: "low" | "medium" | "high" | "";
  recommended_action?: string;
  source: "static" | "ai";
}

export interface ZonePairAnalysis {
  score: number;
  grade: string;
  findings: Finding[];
}

export interface ZonePair {
  source_zone_id: string;
  destination_zone_id: string;
  rules: Rule[];
  allow_count: number;
  block_count: number;
  analysis: ZonePairAnalysis | null;
}

export interface AiPreset {
  id: string;
  name: string;
  base_url: string;
  provider_type: string;
  default_model: string;
  models: string[];
}

export interface AiConfig {
  base_url: string;
  model: string;
  provider_type: string;
  has_key: boolean;
  key_source: "db" | "env" | "none";
  source: "db" | "env" | "none";
}

export interface AiConfigInput {
  base_url: string;
  api_key: string;
  model: string;
  provider_type: string;
}

export interface AiAnalyzeRequest {
  source_zone_name: string;
  destination_zone_name: string;
  rules: Rule[];
}

export interface AiAnalyzeResponse {
  status: "ok" | "error";
  findings: Finding[];
  cached: boolean;
  message: string | null;
}

export interface AiAnalysisSettings {
  site_profile: "homelab" | "smb" | "enterprise";
}

export interface SimulateRequest {
  src_ip: string;
  dst_ip: string;
  protocol: string;
  port: number | null;
  source_port?: number | null;
}

export interface RuleEvaluation {
  rule_id: string;
  rule_name: string;
  matched: boolean;
  reason: string;
  skipped_disabled: boolean;
  unresolvable_constraints?: string[];
}

export interface SimulateResponse {
  source_zone_id: string | null;
  source_zone_name: string | null;
  destination_zone_id: string | null;
  destination_zone_name: string | null;
  verdict: string | null;
  matched_rule_id: string | null;
  matched_rule_name: string | null;
  default_policy_used: boolean;
  evaluations: RuleEvaluation[];
  assumptions?: string[];
}

export interface AuthStatus {
  configured: boolean;
  source: "env" | "runtime" | "none";
  url: string;
  username: string;
}

export interface ZoneFilter {
  hidden_zone_ids: string[];
}

export interface AppAuthStatus {
  required: boolean;
  authenticated: boolean;
}

export interface TopologySvgResponse {
  svg: string;
  projection: string;
}

export interface TopologyPort {
  idx: number;
  name: string;
  speed: number | null;
  up: boolean;
  poe: boolean;
  poe_power: number | null;
  connected_device: string | null;
  connected_mac: string | null;
  native_vlan: number | null;
}

export interface TopologyDevice {
  mac: string;
  name: string;
  model: string;
  model_name: string;
  type: string;
  ip: string;
  version: string;
  uptime: number;
  status: string;
  client_count: number;
  ports: TopologyPort[];
}

export interface TopologyEdge {
  from_mac: string;
  to_mac: string;
  local_port: number | null;
  remote_port: number | null;
  speed: number | null;
  poe: boolean;
  wireless: boolean;
}

export interface TopologyDevicesResponse {
  devices: TopologyDevice[];
  edges: TopologyEdge[];
}

export interface MetricsSnapshot {
  mac: string;
  name: string;
  model: string;
  type: string;
  cpu: number;
  mem: number;
  temperature: number | null;
  uptime: number;
  tx_bytes: number;
  rx_bytes: number;
  num_sta: number;
  version: string;
  poe_consumption: number | null;
  status: string;
}

export interface MetricsHistoryPoint {
  timestamp: string;
  cpu: number;
  mem: number;
  temperature: number | null;
  uptime: number;
  tx_bytes: number;
  rx_bytes: number;
  num_sta: number;
  poe_consumption: number | null;
}

export interface MetricsDevicesResponse {
  devices: MetricsSnapshot[];
}

export interface MetricsHistoryResponse {
  mac: string;
  history: MetricsHistoryPoint[];
}

export interface AppNotification {
  id: number;
  device_mac: string;
  check_id: string;
  severity: string;
  title: string;
  message: string;
  created_at: string;
  resolved_at: string | null;
  dismissed: boolean;
}

export interface HealthFinding {
  severity: string;
  title: string;
  description: string;
  affected_module: string;
  affected_entity_id: string;
  recommended_action: string;
  confidence: string;
}

export interface HealthAnalysisResult {
  status: "ok" | "error";
  findings: HealthFinding[];
  cached: boolean;
  analyzed_at: string | null;
  message: string | null;
}

export interface FirewallSummary {
  zone_pair_count: number;
  grade_distribution: Record<string, number>;
  finding_count_by_severity: Record<string, number>;
  uncovered_pairs: number;
}

export interface TopologySummary {
  device_count_by_type: Record<string, number>;
  offline_count: number;
  firmware_mismatches: number;
}

export interface MetricsSummary {
  active_notifications_by_severity: Record<string, number>;
  high_resource_devices: number;
  recent_reboots: number;
}

export interface HealthSummaryResponse {
  firewall: FirewallSummary;
  topology: TopologySummary;
  metrics: MetricsSummary;
}
