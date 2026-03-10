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


class FindingModel(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    rule_id: str | None = None
    source: str = "static"


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
