from pydantic import BaseModel


class Network(BaseModel):
    id: str
    name: str
    vlan_id: int | None = None
    subnet: str | None = None


class Zone(BaseModel):
    id: str
    name: str
    networks: list[Network] = []


class Rule(BaseModel):
    id: str
    name: str
    description: str = ""
    enabled: bool
    action: str  # "ALLOW", "BLOCK", "REJECT"
    source_zone_id: str
    destination_zone_id: str
    protocol: str = "all"
    port_ranges: list[str] = []
    ip_ranges: list[str] = []
    index: int = 0
    predefined: bool = False
    # Source-side filtering
    source_ip_ranges: list[str] = []
    source_mac_addresses: list[str] = []
    source_port_ranges: list[str] = []
    source_network_id: str = ""
    # Destination-side filtering
    destination_mac_addresses: list[str] = []
    destination_network_id: str = ""
    # Firewall group references (resolved to members)
    source_port_group: str = ""
    source_port_group_members: list[str] = []
    destination_port_group: str = ""
    destination_port_group_members: list[str] = []
    source_address_group: str = ""
    source_address_group_members: list[str] = []
    destination_address_group: str = ""
    destination_address_group_members: list[str] = []
    # Connection state / metadata
    connection_state_type: str = ""
    connection_logging: bool = False
    schedule: str = ""
    match_ip_sec: str = ""


class FindingModel(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    rationale: str = ""
    rule_id: str | None = None
    rule_ids: list[str] = []
    confidence: str = ""
    recommended_action: str = ""
    source: str = "static"


class AiAnalysisResult(BaseModel):
    status: str  # "ok" or "error"
    findings: list[FindingModel] = []
    cached: bool = False
    message: str | None = None


class ZonePairAnalysis(BaseModel):
    score: int
    grade: str
    findings: list[FindingModel]


class ZonePair(BaseModel):
    source_zone_id: str
    destination_zone_id: str
    rules: list[Rule]
    allow_count: int
    block_count: int
    analysis: ZonePairAnalysis | None = None


class TopologySvgResponse(BaseModel):
    svg: str
    projection: str


class TopologyPort(BaseModel):
    idx: int
    name: str
    speed: int | None = None
    up: bool = False
    poe: bool = False
    poe_power: float | None = None
    connected_device: str | None = None
    connected_mac: str | None = None
    native_vlan: int | None = None


class TopologyDevice(BaseModel):
    mac: str
    name: str
    model: str
    model_name: str
    type: str
    ip: str
    version: str
    uptime: int = 0
    status: str = "unknown"
    client_count: int = 0
    ports: list[TopologyPort] = []


class TopologyEdge(BaseModel):
    from_mac: str
    to_mac: str
    local_port: int | None = None
    remote_port: int | None = None
    speed: int | None = None
    poe: bool = False
    wireless: bool = False


class TopologyDevicesResponse(BaseModel):
    devices: list[TopologyDevice]
    edges: list[TopologyEdge]


class MetricsSnapshot(BaseModel):
    mac: str
    name: str
    model: str
    type: str
    cpu: float
    mem: float
    temperature: float | None = None
    uptime: int = 0
    tx_bytes: int = 0
    rx_bytes: int = 0
    num_sta: int = 0
    version: str = ""
    poe_consumption: float | None = None
    status: str = "online"


class MetricsHistoryPoint(BaseModel):
    timestamp: str
    cpu: float
    mem: float
    temperature: float | None = None
    uptime: int = 0
    tx_bytes: int = 0
    rx_bytes: int = 0
    num_sta: int = 0
    poe_consumption: float | None = None


class MetricsDevicesResponse(BaseModel):
    devices: list[MetricsSnapshot]


class MetricsHistoryResponse(BaseModel):
    mac: str
    history: list[MetricsHistoryPoint]


class Notification(BaseModel):
    id: int
    device_mac: str
    check_id: str
    severity: str
    title: str
    message: str
    created_at: str
    resolved_at: str | None = None
    dismissed: bool = False


class HealthFinding(BaseModel):
    severity: str  # "critical", "high", "medium", "low"
    title: str
    description: str
    affected_module: str = ""  # "firewall", "topology", "metrics"
    affected_entity_id: str = ""
    recommended_action: str = ""
    confidence: str = ""  # "high", "medium", "low"


class HealthAnalysisResult(BaseModel):
    status: str  # "ok" or "error"
    findings: list[HealthFinding] = []
    cached: bool = False
    analyzed_at: str | None = None
    message: str | None = None


class FirewallSummary(BaseModel):
    zone_pair_count: int
    grade_distribution: dict[str, int]
    finding_count_by_severity: dict[str, int]
    uncovered_pairs: int


class TopologySummary(BaseModel):
    device_count_by_type: dict[str, int]
    offline_count: int
    firmware_mismatches: int


class MetricsSummary(BaseModel):
    active_notifications_by_severity: dict[str, int]
    high_resource_devices: int
    recent_reboots: int


class HealthSummaryResponse(BaseModel):
    firewall: FirewallSummary
    topology: TopologySummary
    metrics: MetricsSummary


class AppLoginInput(BaseModel):
    password: str


class AppAuthStatus(BaseModel):
    required: bool
    authenticated: bool
