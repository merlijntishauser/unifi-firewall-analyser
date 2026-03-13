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
