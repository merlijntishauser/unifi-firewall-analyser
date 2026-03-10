# Firewall Rule Analysis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add security posture scoring (A-F grades) and risk detection to firewall zone pairs, with static heuristics as baseline and optional AI-powered deep analysis.

**Architecture:** Static analyzer as a pure Python module with heuristic checks. SQLite for AI config persistence and analysis caching. AI analyzer calls user-configured OpenAI/Anthropic APIs. Grades visible in matrix cells, findings in RulePanel.

**Tech Stack:** Python (static analyzer, SQLite, httpx), React + Tailwind (UI), Vitest + Testing Library (frontend tests), pytest (backend tests).

---

### Task 1: Static analyzer module

**Files:**
- Create: `backend/app/services/analyzer.py`
- Create: `backend/tests/test_analyzer.py`

**Step 1: Write the tests**

Create `backend/tests/test_analyzer.py`:

```python
"""Tests for static firewall rule analyzer."""

import pytest

from app.models import Rule
from app.services.analyzer import Finding, analyze_zone_pair, compute_grade


def _rule(
    *,
    id: str = "r1",
    name: str = "Test Rule",
    enabled: bool = True,
    action: str = "ALLOW",
    source_zone_id: str = "zone-src",
    destination_zone_id: str = "zone-dst",
    protocol: str = "all",
    port_ranges: list[str] | None = None,
    ip_ranges: list[str] | None = None,
    index: int = 100,
    predefined: bool = False,
) -> Rule:
    return Rule(
        id=id,
        name=name,
        enabled=enabled,
        action=action,
        source_zone_id=source_zone_id,
        destination_zone_id=destination_zone_id,
        protocol=protocol,
        port_ranges=port_ranges or [],
        ip_ranges=ip_ranges or [],
        index=index,
        predefined=predefined,
    )


class TestComputeGrade:
    def test_perfect_score(self) -> None:
        assert compute_grade(100) == "A"

    def test_a_grade(self) -> None:
        assert compute_grade(90) == "A"

    def test_b_grade(self) -> None:
        assert compute_grade(80) == "B"
        assert compute_grade(89) == "B"

    def test_c_grade(self) -> None:
        assert compute_grade(65) == "C"
        assert compute_grade(79) == "C"

    def test_d_grade(self) -> None:
        assert compute_grade(50) == "D"
        assert compute_grade(64) == "D"

    def test_f_grade(self) -> None:
        assert compute_grade(49) == "F"
        assert compute_grade(0) == "F"


class TestAnalyzeZonePair:
    def test_no_rules_returns_low_finding(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert any(f.id == "no-explicit-rules" for f in result.findings)
        assert result.score <= 100

    def test_allow_all_protocols_ports_high(self) -> None:
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "allow-all-protocols-ports" for f in result.findings)
        assert any(f.severity == "high" for f in result.findings)

    def test_allow_with_port_restriction_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-protocols-ports" for f in result.findings)

    def test_allow_all_from_external(self) -> None:
        rules = [_rule(source_zone_id="zone-ext", protocol="all")]
        result = analyze_zone_pair(rules, "External", "LAN")
        assert any(f.id == "allow-all-external" for f in result.findings)

    def test_allow_from_external_not_triggered_for_non_external(self) -> None:
        rules = [_rule(protocol="all")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "allow-all-external" for f in result.findings)

    def test_allow_external_to_internal(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80"], ip_ranges=[])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_allow_external_to_internal_not_triggered_with_ip_restriction(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80"], ip_ranges=["10.0.0.5"])]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert not any(f.id == "allow-external-to-internal" for f in result.findings)

    def test_disabled_block_rule(self) -> None:
        rules = [_rule(enabled=False, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "disabled-block-rule" for f in result.findings)

    def test_enabled_block_rule_no_finding(self) -> None:
        rules = [_rule(enabled=True, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "disabled-block-rule" for f in result.findings)

    def test_shadowed_rule(self) -> None:
        rules = [
            _rule(id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(id="r2", action="ALLOW", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        shadowed = [f for f in result.findings if f.id == "shadowed-rule"]
        assert len(shadowed) == 1
        assert shadowed[0].rule_id == "r2"

    def test_no_shadow_when_different_actions(self) -> None:
        rules = [
            _rule(id="r1", action="ALLOW", protocol="all", port_ranges=[], index=100),
            _rule(id="r2", action="BLOCK", protocol="tcp", port_ranges=["80"], index=200),
        ]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "shadowed-rule" for f in result.findings)

    def test_wide_port_range(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["1-65535"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "wide-port-range" for f in result.findings)

    def test_narrow_port_range_no_finding(self) -> None:
        rules = [_rule(protocol="tcp", port_ranges=["80-443"])]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert not any(f.id == "wide-port-range" for f in result.findings)

    def test_predefined_rule(self) -> None:
        rules = [_rule(predefined=True, action="BLOCK")]
        result = analyze_zone_pair(rules, "LAN", "WAN")
        assert any(f.id == "predefined-unreviewed" for f in result.findings)

    def test_score_deductions(self) -> None:
        # One high finding = -15
        rules = [_rule(protocol="all", port_ranges=[])]
        result = analyze_zone_pair(rules, "External", "WAN")
        assert result.score < 100

    def test_score_clamped_to_zero(self) -> None:
        # Many high findings should not go below 0
        rules = [
            _rule(id=f"r{i}", protocol="all", port_ranges=[], index=i)
            for i in range(20)
        ]
        result = analyze_zone_pair(rules, "External", "Internal")
        assert result.score >= 0

    def test_grade_returned(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert result.grade in ("A", "B", "C", "D", "F")

    def test_finding_has_source_static(self) -> None:
        result = analyze_zone_pair([], "LAN", "WAN")
        assert all(f.source == "static" for f in result.findings)
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_analyzer.py -v`
Expected: FAIL - cannot import `analyzer`

**Step 3: Write implementation**

Create `backend/app/services/analyzer.py`:

```python
"""Static firewall rule analyzer.

Analyzes zone pair rules for security risks and computes a posture score.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models import Rule

DEDUCTIONS = {"high": 15, "medium": 8, "low": 2}

_EXTERNAL_NAMES = {"external", "wan", "internet"}
_INTERNAL_NAMES = {"internal", "lan", "default"}


@dataclass
class Finding:
    id: str
    severity: str  # "high", "medium", "low"
    title: str
    description: str
    rule_id: str | None = None
    source: str = "static"


@dataclass
class AnalysisResult:
    score: int
    grade: str
    findings: list[Finding] = field(default_factory=list)


def compute_grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 65:
        return "C"
    if score >= 50:
        return "D"
    return "F"


def _is_external(zone_name: str) -> bool:
    return zone_name.lower() in _EXTERNAL_NAMES


def _is_internal(zone_name: str) -> bool:
    return zone_name.lower() in _INTERNAL_NAMES


def _has_port_restriction(rule: Rule) -> bool:
    return len(rule.port_ranges) > 0 and rule.protocol.lower() != "all"


def _port_range_width(port_range: str) -> int:
    if "-" in port_range:
        parts = port_range.split("-", 1)
        try:
            return int(parts[1]) - int(parts[0]) + 1
        except (ValueError, IndexError):
            return 0
    return 1


def _check_allow_all_external(rule: Rule, src_name: str) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_external(src_name)
        and rule.protocol.lower() == "all"
        and not rule.port_ranges
    ):
        return Finding(
            id="allow-all-external",
            severity="high",
            title="Unrestricted allow from external zone",
            description=f"Rule '{rule.name}' allows all traffic from {src_name} with no port or protocol restriction.",
            rule_id=rule.id,
        )
    return None


def _check_allow_all_protocols_ports(rule: Rule) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and rule.protocol.lower() == "all"
        and not rule.port_ranges
    ):
        return Finding(
            id="allow-all-protocols-ports",
            severity="high",
            title="Allow rule with no port or protocol restriction",
            description=f"Rule '{rule.name}' allows all protocols and ports.",
            rule_id=rule.id,
        )
    return None


def _check_allow_external_to_internal(rule: Rule, src_name: str, dst_name: str) -> Finding | None:
    if (
        rule.enabled
        and rule.action == "ALLOW"
        and _is_external(src_name)
        and _is_internal(dst_name)
        and not rule.ip_ranges
    ):
        return Finding(
            id="allow-external-to-internal",
            severity="high",
            title="Allow from external to internal zone",
            description=f"Rule '{rule.name}' allows traffic from {src_name} to {dst_name} with no IP restriction.",
            rule_id=rule.id,
        )
    return None


def _check_disabled_block(rule: Rule) -> Finding | None:
    if not rule.enabled and rule.action in ("BLOCK", "REJECT"):
        return Finding(
            id="disabled-block-rule",
            severity="medium",
            title="Disabled block rule",
            description=f"Rule '{rule.name}' blocks traffic but is disabled. Enable it or remove it.",
            rule_id=rule.id,
        )
    return None


def _check_wide_port_range(rule: Rule) -> Finding | None:
    if rule.enabled and rule.action == "ALLOW":
        for pr in rule.port_ranges:
            if _port_range_width(pr) >= 1000:
                return Finding(
                    id="wide-port-range",
                    severity="medium",
                    title="Allow rule with wide port range",
                    description=f"Rule '{rule.name}' allows a wide port range ({pr}).",
                    rule_id=rule.id,
                )
    return None


def _check_predefined(rule: Rule) -> Finding | None:
    if rule.predefined:
        return Finding(
            id="predefined-unreviewed",
            severity="low",
            title="Predefined rule",
            description=f"Rule '{rule.name}' is a built-in predefined rule.",
            rule_id=rule.id,
        )
    return None


def _check_shadowed(rules: list[Rule]) -> list[Finding]:
    findings: list[Finding] = []
    enabled_rules = [r for r in rules if r.enabled]
    sorted_rules = sorted(enabled_rules, key=lambda r: r.index)

    for i, later in enumerate(sorted_rules):
        for earlier in sorted_rules[:i]:
            if earlier.action != later.action:
                continue
            if earlier.protocol.lower() != "all" and earlier.protocol.lower() != later.protocol.lower():
                continue
            if earlier.port_ranges and later.port_ranges and set(earlier.port_ranges) != set(later.port_ranges):
                continue
            if not earlier.port_ranges and not earlier.ip_ranges:
                findings.append(
                    Finding(
                        id="shadowed-rule",
                        severity="medium",
                        title="Shadowed rule",
                        description=f"Rule '{later.name}' is shadowed by '{earlier.name}' and will never match.",
                        rule_id=later.id,
                    )
                )
                break
    return findings


def analyze_zone_pair(rules: list[Rule], src_zone_name: str, dst_zone_name: str) -> AnalysisResult:
    """Analyze a zone pair's rules and return findings with a score."""
    findings: list[Finding] = []

    if not rules:
        findings.append(
            Finding(
                id="no-explicit-rules",
                severity="low",
                title="No explicit rules",
                description="This zone pair has no explicit firewall rules.",
            )
        )
    else:
        for rule in rules:
            for check in (
                lambda r: _check_allow_all_external(r, src_zone_name),
                _check_allow_all_protocols_ports,
                lambda r: _check_allow_external_to_internal(r, src_zone_name, dst_zone_name),
                _check_disabled_block,
                _check_wide_port_range,
                _check_predefined,
            ):
                finding = check(rule)
                if finding is not None:
                    findings.append(finding)

        findings.extend(_check_shadowed(rules))

    score = 100
    for f in findings:
        score -= DEDUCTIONS.get(f.severity, 0)
    score = max(score, 0)

    return AnalysisResult(score=score, grade=compute_grade(score), findings=findings)
```

**Step 4: Run tests**

Run: `cd backend && uv run pytest tests/test_analyzer.py -v`
Expected: ALL PASS

**Step 5: Run full backend tests + coverage**

Run: `cd backend && uv run pytest`
Expected: ALL PASS, coverage >= 98%

**Step 6: Commit**

```bash
git add backend/app/services/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: add static firewall rule analyzer with heuristic scoring"
```

---

### Task 2: Add analysis to ZonePair model and API response

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/services/firewall.py`
- Modify: `backend/app/routers/rules.py`
- Modify: `backend/tests/test_rules.py`

**Step 1: Add models**

Add to `backend/app/models.py`:

```python
class Finding(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    rule_id: str | None = None
    source: str = "static"


class ZonePairAnalysis(BaseModel):
    score: int
    grade: str
    findings: list[Finding]
```

Add `analysis` field to `ZonePair`:

```python
class ZonePair(BaseModel):
    source_zone_id: str
    destination_zone_id: str
    rules: list[Rule]
    allow_count: int
    block_count: int
    analysis: ZonePairAnalysis | None = None
```

**Step 2: Update firewall service**

Modify `get_zone_pairs()` in `backend/app/services/firewall.py` to accept an optional `zones` parameter for zone name lookup, run the analyzer, and attach analysis to each ZonePair.

The function signature changes to:

```python
def get_zone_pairs(credentials: UnifiCredentials) -> list[ZonePair]:
```

Inside, after building the pairs, fetch zones for the name lookup, then call `analyze_zone_pair()` for each pair and attach the result.

**Step 3: Update router**

The router at `backend/app/routers/rules.py` needs no changes -- it already returns `list[ZonePair]` and the new `analysis` field will be serialized automatically.

**Step 4: Update tests**

In `backend/tests/test_rules.py`, update existing tests to verify the `analysis` field is present:

```python
# In the test that checks zone-pairs response:
assert "analysis" in pair
assert "score" in pair["analysis"]
assert "grade" in pair["analysis"]
assert "findings" in pair["analysis"]
```

**Step 5: Run full backend tests**

Run: `cd backend && uv run pytest`
Expected: ALL PASS, coverage >= 98%

**Step 6: Commit**

```bash
git add backend/app/models.py backend/app/services/firewall.py backend/app/routers/rules.py backend/tests/test_rules.py
git commit -m "feat: integrate static analysis into zone-pairs API response"
```

---

### Task 3: SQLite database setup

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/tests/test_database.py`

**Step 1: Write tests**

```python
"""Tests for database setup and migrations."""

import sqlite3
from pathlib import Path

import pytest

from app.database import get_connection, init_db


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.db"


class TestInitDb:
    def test_creates_tables(self, db_path: Path) -> None:
        init_db(db_path)
        conn = sqlite3.connect(db_path)
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {row[0] for row in cursor.fetchall()}
        conn.close()
        assert "ai_config" in tables
        assert "ai_analysis_cache" in tables

    def test_idempotent(self, db_path: Path) -> None:
        init_db(db_path)
        init_db(db_path)  # Should not raise

    def test_creates_parent_directory(self, tmp_path: Path) -> None:
        db_path = tmp_path / "subdir" / "test.db"
        init_db(db_path)
        assert db_path.exists()


class TestGetConnection:
    def test_returns_connection(self, db_path: Path) -> None:
        init_db(db_path)
        conn = get_connection(db_path)
        assert isinstance(conn, sqlite3.Connection)
        conn.close()
```

**Step 2: Write implementation**

Create `backend/app/database.py`:

```python
"""SQLite database setup for AI configuration and analysis caching."""

import sqlite3
from pathlib import Path

DEFAULT_DB_PATH = Path("data/analyser.db")

_SCHEMA = """
CREATE TABLE IF NOT EXISTS ai_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT 'openai'
);

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    cache_key TEXT PRIMARY KEY,
    zone_pair_key TEXT NOT NULL,
    findings TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def init_db(db_path: Path = DEFAULT_DB_PATH) -> None:
    """Initialize the database with required tables."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.executescript(_SCHEMA)
    conn.close()


def get_connection(db_path: Path = DEFAULT_DB_PATH) -> sqlite3.Connection:
    """Get a database connection."""
    return sqlite3.connect(db_path)
```

**Step 3: Run tests**

Run: `cd backend && uv run pytest tests/test_database.py -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/app/database.py backend/tests/test_database.py
git commit -m "feat: add SQLite database setup for AI config and caching"
```

---

### Task 4: AI settings storage and API endpoints

**Files:**
- Create: `backend/app/services/ai_settings.py`
- Create: `backend/app/routers/settings.py`
- Create: `backend/tests/test_ai_settings.py`
- Create: `backend/tests/test_settings_router.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Write ai_settings service**

`backend/app/services/ai_settings.py` -- Functions for CRUD operations on the `ai_config` table:

- `get_ai_config(db_path) -> dict | None` -- Returns config dict (with `has_key: bool` instead of actual key) or None
- `save_ai_config(db_path, base_url, api_key, model, provider_type)` -- Upsert config
- `delete_ai_config(db_path)` -- Delete config
- `get_ai_api_key(db_path) -> str | None` -- Returns actual API key (for internal use)
- `get_full_ai_config(db_path) -> dict | None` -- Returns full config including key (internal)

Also check env vars `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER_TYPE` as fallback.

**Step 2: Write settings router**

`backend/app/routers/settings.py` with prefix `/api/settings`:

- `GET /ai` -- Get AI config (safe, no key)
- `PUT /ai` -- Save AI config
- `DELETE /ai` -- Delete AI config
- `POST /ai/test` -- Test connection (sends a small prompt)
- `GET /ai/presets` -- Return available presets with models

Presets data:

```python
PRESETS = [
    {
        "id": "anthropic",
        "name": "Anthropic Claude",
        "base_url": "https://api.anthropic.com/v1",
        "provider_type": "anthropic",
        "default_model": "claude-sonnet-4-6",
        "models": ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-6"],
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "provider_type": "openai",
        "default_model": "gpt-4.1-mini",
        "models": ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-4.1", "gpt-4o-mini", "gpt-4o"],
    },
]
```

**Step 3: Register router in main.py**

Add `from app.routers.settings import router as settings_router` and `app.include_router(settings_router)`.

Also call `init_db()` on startup.

**Step 4: Write tests**

Unit tests for `ai_settings` service (using `tmp_path` for DB). Integration tests for settings router endpoints.

**Step 5: Run full backend tests**

Run: `cd backend && uv run pytest`
Expected: ALL PASS, coverage >= 98%

**Step 6: Commit**

```bash
git add backend/app/services/ai_settings.py backend/app/routers/settings.py backend/tests/test_ai_settings.py backend/tests/test_settings_router.py backend/app/main.py
git commit -m "feat: add AI settings CRUD endpoints with provider presets"
```

---

### Task 5: AI analyzer service with caching

**Files:**
- Create: `backend/app/services/ai_analyzer.py`
- Create: `backend/tests/test_ai_analyzer.py`

**Step 1: Write the AI analyzer service**

`backend/app/services/ai_analyzer.py`:

- `_build_cache_key(rules) -> str` -- Hash of sorted rule data
- `_get_cached(db_path, cache_key) -> list[dict] | None` -- Check cache
- `_save_cache(db_path, cache_key, zone_pair_key, findings)` -- Save to cache
- `_call_openai(base_url, api_key, model, prompt) -> str` -- httpx POST to OpenAI-compatible API
- `_call_anthropic(base_url, api_key, model, prompt) -> str` -- httpx POST to Anthropic API
- `analyze_with_ai(db_path, rules, src_zone_name, dst_zone_name) -> list[Finding]` -- Main function: check cache, load config, call provider, parse response, cache result

The system prompt asks the LLM to return JSON array of findings with `severity`, `title`, `description` fields.

**Step 2: Write tests**

Mock httpx calls. Test:
- Cache hit returns cached findings
- Cache miss calls the provider
- OpenAI format request/response
- Anthropic format request/response
- Invalid JSON response from LLM handled gracefully
- No config returns empty list
- Results cached after successful call

**Step 3: Run tests**

Run: `cd backend && uv run pytest tests/test_ai_analyzer.py -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/app/services/ai_analyzer.py backend/tests/test_ai_analyzer.py
git commit -m "feat: add AI analyzer service with provider support and caching"
```

---

### Task 6: AI analyze API endpoint

**Files:**
- Create: `backend/app/routers/analyze.py`
- Create: `backend/tests/test_analyze_router.py`
- Modify: `backend/app/main.py` (register router)

**Step 1: Write router**

`backend/app/routers/analyze.py`:

```python
POST /api/analyze
Body: { "source_zone_name": str, "destination_zone_name": str, "rules": list[Rule] }
Response: { "findings": list[Finding] }
```

Calls `analyze_with_ai()` from the AI analyzer service.

**Step 2: Write tests**

Test endpoint with mocked AI analyzer. Test 401 when no AI config. Test successful response.

**Step 3: Register router in main.py**

**Step 4: Run full backend tests + coverage + mypy + ruff**

Run: `cd backend && uv run pytest && uv run mypy app/ && uv run ruff check .`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/app/routers/analyze.py backend/tests/test_analyze_router.py backend/app/main.py
git commit -m "feat: add AI analyze endpoint"
```

---

### Task 7: Update frontend types and API client

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/client.test.ts`

**Step 1: Add new types to `types.ts`**

```typescript
export interface Finding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  rule_id: string | null;
  source: "static" | "ai";
}

export interface ZonePairAnalysis {
  score: number;
  grade: string;
  findings: Finding[];
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
  source: "db" | "env" | "none";
}

export interface AiAnalyzeRequest {
  source_zone_name: string;
  destination_zone_name: string;
  rules: Rule[];
}

export interface AiAnalyzeResponse {
  findings: Finding[];
}
```

Add `analysis` field to `ZonePair`:

```typescript
export interface ZonePair {
  source_zone_id: string;
  destination_zone_id: string;
  rules: Rule[];
  allow_count: number;
  block_count: number;
  analysis: ZonePairAnalysis | null;
}
```

**Step 2: Add API methods to `client.ts`**

```typescript
getAiConfig: () => fetchJson<AiConfig>("/settings/ai"),
saveAiConfig: (config: { base_url: string; api_key: string; model: string; provider_type: string }) =>
  fetchJson("/settings/ai", { method: "PUT", body: JSON.stringify(config) }),
deleteAiConfig: () => fetchJson("/settings/ai", { method: "DELETE" }),
testAiConnection: () => fetchJson<{ status: string }>("/settings/ai/test", { method: "POST" }),
getAiPresets: () => fetchJson<AiPreset[]>("/settings/ai/presets"),
analyzeWithAi: (req: AiAnalyzeRequest) =>
  fetchJson<AiAnalyzeResponse>("/analyze", { method: "POST", body: JSON.stringify(req) }),
```

**Step 3: Add tests for new API methods in `client.test.ts`**

**Step 4: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/api/client.ts frontend/src/api/client.test.ts
git commit -m "feat: add analysis types and AI API client methods"
```

---

### Task 8: Update MatrixCell with grade display

**Files:**
- Modify: `frontend/src/components/MatrixCell.tsx`
- Modify: `frontend/src/components/MatrixCell.test.tsx`

**Step 1: Update MatrixCell props**

Add `grade: string | null` prop. Display the grade next to the rule count. Change cell color to grade-based: green (A/B), amber (C), red (D/F), gray (no rules / null grade).

**Step 2: Update tests**

Add tests for grade display and grade-based coloring. Update existing tests to pass `grade={null}`.

**Step 3: Update ZoneMatrix** to pass `analysis.grade` to MatrixCell.

**Step 4: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add frontend/src/components/MatrixCell.tsx frontend/src/components/MatrixCell.test.tsx frontend/src/components/ZoneMatrix.tsx frontend/src/components/ZoneMatrix.test.tsx
git commit -m "feat: show security grade in matrix cells with grade-based coloring"
```

---

### Task 9: Update RulePanel with score and findings

**Files:**
- Modify: `frontend/src/components/RulePanel.tsx`
- Modify: `frontend/src/components/RulePanel.test.tsx`

**Step 1: Add analysis section to RulePanel**

Add a new section at the top of the panel (above rules list):
- Score badge: colored circle with grade letter + "82/100" text
- Findings list: each finding has a severity badge (red=high, amber=medium, blue=low), title, and description
- If `finding.rule_id` is set, highlight the matching rule in the list

Accept `analysis: ZonePairAnalysis | null` as a new prop (passed from the `ZonePair.analysis` field).

**Step 2: Update tests**

Add tests for score badge rendering, findings list, severity badge colors. Update existing tests to pass `analysis={null}`.

**Step 3: Update App.tsx** to pass `analysis` prop from `selectedPair.analysis`.

**Step 4: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add frontend/src/components/RulePanel.tsx frontend/src/components/RulePanel.test.tsx frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: show security score and findings in rule panel"
```

---

### Task 10: AI settings modal

**Files:**
- Create: `frontend/src/components/SettingsModal.tsx`
- Create: `frontend/src/components/SettingsModal.test.tsx`
- Modify: `frontend/src/components/Toolbar.tsx`
- Modify: `frontend/src/components/Toolbar.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Step 1: Create SettingsModal component**

A modal/dialog with:
- Provider picker: radio buttons or dropdown (Anthropic Claude / OpenAI / Custom)
- On preset selection: auto-fill base URL, show model dropdown with preset models, select default model
- On custom: show base URL text input, model text input, provider_type dropdown
- API key input (password field)
- "Test connection" button
- "Save" and "Cancel" buttons
- Loading and error states

**Step 2: Add settings button to Toolbar**

Add a gear icon button that opens the SettingsModal. Pass `onOpenSettings` callback.

**Step 3: Wire up in App.tsx**

Add `settingsOpen` state. Pass to Toolbar and render SettingsModal when open.

**Step 4: Write tests**

Test modal rendering, preset selection auto-fills fields, save calls API, test connection, cancel closes modal.

**Step 5: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/components/SettingsModal.test.tsx frontend/src/components/Toolbar.tsx frontend/src/components/Toolbar.test.tsx frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: add AI provider settings modal with presets"
```

---

### Task 11: Analyze with AI button in RulePanel

**Files:**
- Modify: `frontend/src/components/RulePanel.tsx`
- Modify: `frontend/src/components/RulePanel.test.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Add AI analyze button to RulePanel**

At the bottom of the findings section:
- "Analyze with AI" button (only shown when `aiConfigured` prop is true)
- Loading spinner while analyzing
- Error message on failure
- On success: merge AI findings into findings list (with `source: "ai"` badge)

New props: `aiConfigured: boolean`, `onAnalyzeWithAi: () => Promise<Finding[]>`, or handle the API call inside RulePanel.

**Step 2: Wire up in App.tsx**

Fetch AI config status on auth. Pass `aiConfigured` to RulePanel. Handle the analyze call.

**Step 3: Write tests**

Test button visibility based on aiConfigured. Test loading state. Test findings merge. Test error state.

**Step 4: Run frontend tests**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add frontend/src/components/RulePanel.tsx frontend/src/components/RulePanel.test.tsx frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat: add Analyze with AI button in rule panel"
```

---

### Task 12: Full integration verification

**Step 1: Run full CI**

Run: `make ci`
Expected: ALL PASS

**Step 2: Update docker-compose.yml**

Add data volume for SQLite persistence:

```yaml
services:
  api:
    volumes:
      - ./data:/app/data
```

**Step 3: Final commit if needed**

```bash
git commit -m "chore: add data volume for SQLite persistence"
```
