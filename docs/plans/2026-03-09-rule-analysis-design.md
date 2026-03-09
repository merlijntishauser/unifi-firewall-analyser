# Firewall Rule Analysis Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add security posture scoring and risk detection for firewall zone pairs, with static heuristics as a baseline and optional AI-powered deep analysis.

**Architecture:** Static analyzer runs on every zone pair request, returning findings and a score. Optional AI analyzer calls a user-configured OpenAI-compatible or Anthropic API for deeper analysis, with results cached in SQLite. Grades visible in the matrix cells, detailed findings in the RulePanel.

**Tech Stack:** Python (static analyzer, SQLite, httpx for AI calls), React + Tailwind (UI), existing backend unchanged except for new modules.

---

## Overview

The analysis system has three layers:

1. **Static Analyzer** -- Pure Python module with heuristic checks. Runs automatically, no external dependencies.
2. **AI Analyzer** -- Optional endpoint calling a user-configured LLM. Cached in SQLite.
3. **UI Integration** -- Grade in MatrixCell, findings list in RulePanel, settings modal for AI config.

## Static Analyzer

### Findings Model

```python
class Finding:
    id: str              # e.g., "allow-all-from-external"
    severity: str        # "high", "medium", "low"
    title: str           # "Unrestricted allow from External"
    description: str     # "Rule #5 allows all protocols..."
    rule_id: str | None  # Which rule triggered this, if applicable
```

### Heuristics

| ID | Severity | Trigger |
|----|----------|---------|
| `allow-all-external` | high | Allow rule from External zone, no port/IP restriction |
| `allow-all-protocols-ports` | high | Allow rule with protocol=all and no port restriction |
| `allow-external-to-internal` | high | Allow from External to Internal with no IP restriction |
| `disabled-block-rule` | medium | Disabled rule with BLOCK/REJECT action |
| `shadowed-rule` | medium | Rule that can never match (broader rule with same action above it) |
| `wide-port-range` | medium | Allow rule with port range spanning 1000+ ports |
| `predefined-unreviewed` | low | Predefined/built-in rule (informational) |
| `no-explicit-rules` | low | Zone pair has zero rules |
| `redundant-rule` | low | Rule duplicates another rule's effect |

### Scoring

- Start at 100
- Deduct per finding: high = -15, medium = -8, low = -2
- Clamp to 0-100
- Grade mapping: A (90-100), B (80-89), C (65-79), D (50-64), F (0-49)

The static analyzer runs inside `get_zone_pairs()`, so findings and score are included in every zone pair response.

## AI Analyzer

### Provider Configuration

Stored in SQLite `ai_config` table. Configured via settings UI or env vars (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`).

Two provider types supported: `openai` (OpenAI chat completions format) and `anthropic` (Anthropic messages format). Selected automatically based on preset or manually for custom providers.

### Provider Presets

| Preset | Base URL | Default Model | Other Models |
|--------|----------|---------------|--------------|
| Anthropic Claude | `https://api.anthropic.com/v1` | `claude-sonnet-4-6` | `claude-haiku-4-5-20251001`, `claude-opus-4-6` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4.1-mini` | `gpt-4.1-nano`, `gpt-4.1`, `gpt-4o`, `gpt-4o-mini` |
| Custom | user-provided | user-provided | free text input |

Presets are a frontend convenience. The backend stores resolved values (base_url, api_key, model, provider_type).

### Settings UI Flow

1. Pick a provider: Anthropic Claude / OpenAI / Custom
2. Enter API key (base URL and model auto-fill for presets)
3. Optionally change the model via dropdown of known models
4. "Test connection" button
5. Save

### API Endpoint

`POST /api/analyze` accepts zone pair source/destination zone names and rules. Sends to the configured LLM with a system prompt:

> "You are a network security analyst. Analyze these firewall rules between zone X and zone Y. Return a JSON array of findings, each with: severity (high/medium/low), title, and description. Focus on security risks, misconfigurations, and rule interactions that static analysis might miss."

### Caching

SQLite `ai_analysis_cache` table:

```sql
CREATE TABLE ai_analysis_cache (
    cache_key TEXT PRIMARY KEY,
    zone_pair_key TEXT NOT NULL,
    findings TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

Cache key is a hash of the rules content (sorted, normalized). If rules change, the hash changes and old cache misses. No TTL needed.

### Error Handling

If the AI provider is down or returns an error, the UI shows an error message but static analysis still works. The AI layer never blocks the core experience.

## Database

### Storage

- SQLite, single file at configurable path (default `data/analyser.db`)
- Created on first startup via migration function (no ORM, `sqlite3` stdlib)
- Docker volume mount: `./data:/app/data`

### Schema

```sql
CREATE TABLE ai_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    model TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT 'openai'
);

CREATE TABLE ai_analysis_cache (
    cache_key TEXT PRIMARY KEY,
    zone_pair_key TEXT NOT NULL,
    findings TEXT NOT NULL,
    created_at TEXT NOT NULL
);
```

### Settings API

- `GET /api/settings/ai` -- Returns config (base_url, model, provider_type; never returns api_key, just whether one is set)
- `PUT /api/settings/ai` -- Save config
- `DELETE /api/settings/ai` -- Remove config
- `POST /api/settings/ai/test` -- Test connection
- `GET /api/settings/ai/presets` -- Returns available presets with models

Env var fallback: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_PROVIDER_TYPE` take precedence when set.

## UI Integration

### MatrixCell

- Show letter grade next to rule count (e.g., "3 B+")
- Cell color based on grade: green (A/B), amber (C), red (D/F), gray (no rules)

### RulePanel

- New section at top: score badge (e.g., "B+ 82/100") with colored background
- Findings list below with severity badges (red/amber/blue), title, description
- Clicking a finding that references a rule highlights that rule in the list
- "Analyze with AI" button at bottom of findings (when AI configured)
- AI findings appear in same list with "AI" badge

### Toolbar

- Settings gear icon opens modal for AI provider configuration

### New Types

```typescript
interface Finding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  rule_id: string | null;
  source: "static" | "ai";
}

interface ZonePairAnalysis {
  score: number;
  grade: string;
  findings: Finding[];
}
```

`ZonePair` response gains a nested `analysis` field. AI findings fetched separately via analyze endpoint and merged client-side.

## What Stays Unchanged

- ZoneGraph, ZoneNode, RuleEdge (unchanged)
- Backend auth, simulator, zone/rules services (unchanged)
- unifi-topology library (unchanged)
- LoginScreen (unchanged)
