# AI Analysis Reliability and Site Profile Design

Status: Proposed
Date: 2026-03-12

## Goal

Make AI analysis more trustworthy, more explainable, and easier to evolve without breaking cache correctness or user expectations.

This design does not implement anything yet. It defines the target shape for:

- separating provider transport settings from analysis behavior
- introducing site-aware AI guidance
- making cache reuse safe
- returning explicit AI failure states
- improving the structure and auditability of AI findings

## Current Problems

The current implementation in `backend/app/services/ai_analyzer.py` is functional but too thin for a security-facing feature:

- the prompt is generic and does not express site intent or UniFi-specific assumptions
- the cache key is based only on the rule payload, so prompt/config/context changes can reuse stale AI output
- provider failures are flattened into an empty findings list, which is indistinguishable from "AI found nothing"
- AI findings are minimally structured, which limits traceability and actionability
- provider configuration and analysis behavior are implicitly mixed together

## Decision Summary

### 1. Split provider config from analysis settings

Keep provider transport config focused on connectivity:

- `base_url`
- `api_key`
- `model`
- `provider_type`

Add a separate AI analysis settings object for behavior:

- `site_profile`
- `prompt_version`

This keeps "how to reach the model" separate from "how the app wants the model to reason".

## Site Profile

Add `site_profile` as an analysis setting, not a provider role.

Allowed values:

- `homelab`
- `smb`
- `enterprise`

### Why this should exist

Different environments tolerate different operational tradeoffs:

- a homelab may intentionally accept broad east-west access for convenience
- a small or medium business may care more about simple segmentation and auditability
- an enterprise site will usually care more about least privilege, blast radius, logging, and change control

### How it should be used

`site_profile` should tune:

- prioritization
- remediation language
- operational context
- how strongly convenience-driven exceptions are called out

It should not materially change hard factual conclusions. A broad external allow remains risky in every profile.

## Prompt Contract

The current one-string prompt should be replaced by a versioned prompt contract.

### System prompt responsibilities

The system prompt should tell the model:

- it is acting as a reviewer, not a policy authorizer
- static analysis is the primary baseline
- it should focus on risks and interactions static analysis might miss
- it must avoid inventing facts that are not present in the payload
- it must return strictly structured JSON

### User payload contents

The user payload should include:

- `source_zone_name`
- `destination_zone_name`
- `site_profile`
- normalized rules
- a compact summary of static findings already produced by the deterministic analyzer
- prompt metadata such as `prompt_version`

### Prompt versioning

Introduce a constant such as:

- `AI_PROMPT_VERSION = "2026-03-12-v1"`

Changing prompt semantics should require a version bump.

## Output Schema

The current `severity/title/description` schema is too weak.

Target AI finding shape:

- `severity`
- `title`
- `description`
- `rule_ids`
- `confidence`
- `rationale`
- `recommended_action`
- `source`

Notes:

- `rule_ids` may be empty if the finding is pair-level rather than rule-level
- `confidence` should be constrained to a small enum such as `low | medium | high`
- `source` remains `ai`

The API can still map this into the existing frontend shape initially, but the stored and validated model should be richer.

## Cache Design

The cache key must include every input that can change the output.

### Include in cache key

- normalized rules
- `source_zone_name`
- `destination_zone_name`
- `provider_type`
- `model`
- `site_profile`
- `prompt_version`
- any static-finding summary included in the prompt

### Exclude from cache key

- secrets such as API keys
- transient metadata like timestamps

### Cache policy

- cached results should record `created_at`
- add an optional TTL so stale AI advice can be refreshed over time
- prompt-version changes should invalidate old cache entries naturally via the new key

## Failure Model

The analyzer should stop treating failure as "empty findings".

### New response shape

`POST /api/analyze` should return explicit status metadata, for example:

- `status: "ok" | "error"`
- `findings: [...]`
- `cached: boolean`
- `message: string | null`

### Error behavior

- provider errors should return a clear error state
- parse failures should return a clear error state
- the frontend should show "AI analysis failed" separately from "AI analysis completed with no findings"

This is important for user trust.

## Settings and UI Design

### Provider settings

Keep provider settings where they are today:

- model preset/custom provider
- base URL
- API key
- provider type

### Analysis settings

Add a separate AI analysis settings section with:

- `site_profile`

This can live:

- in the same modal as a separate section, or
- in a second settings panel if the AI configuration grows further

The UI should show the active site profile near the "Analyze with AI" action or in the result metadata so users know what context produced the output.

## API and Persistence Changes

### New persistence shape

Add a new table rather than overloading `ai_config`:

- `ai_analysis_settings`

Suggested fields:

- `id INTEGER PRIMARY KEY CHECK (id = 1)`
- `site_profile TEXT NOT NULL DEFAULT 'homelab'`

Do not store `prompt_version` in the database unless you explicitly want it user-configurable. It is better treated as an application constant.

### New routes

Add:

- `GET /api/settings/ai-analysis`
- `PUT /api/settings/ai-analysis`

Keep:

- `GET /api/settings/ai`
- `PUT /api/settings/ai`

This avoids conflating runtime transport with analysis policy.

## Security Constraints

This design should also tighten the AI path:

- validate or constrain custom `base_url` values
- never include controller credentials in AI payloads
- redact sensitive values from logs and error surfaces
- use explicit timeout handling and connection reuse

## Rollout Plan

### Phase 1

- add `site_profile`
- add `prompt_version`
- fix cache key inputs
- return explicit AI failure status

### Phase 2

- strengthen the finding schema
- pass static findings into the prompt
- improve frontend display of AI metadata

### Phase 3

- add TTL or refresh controls
- evaluate custom base URL restrictions
- build a regression harness with sanitized real-world rule sets

## Acceptance Criteria

This design is successful when:

- changing `site_profile`, model, or prompt version cannot reuse stale cache entries
- users can distinguish "AI failed" from "AI found nothing"
- the chosen site profile is visible and understandable in the UI
- AI findings are more actionable and traceable than the current free-text form
- the provider config remains simple and separate from analysis policy

## Relationship to the Roadmap

This design directly supports roadmap item 1 in [docs/roadmap.md](../roadmap.md):

- raise analysis fidelity and explainability

It also supports roadmap item 2 indirectly through safer AI configuration boundaries.
