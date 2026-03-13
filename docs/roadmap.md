# Product Roadmap

Last updated: 2026-03-13

## Current Assessment

The application already has a solid base:

- The product shape is clear: matrix view, graph view, rule inspection, traffic simulation, static analysis, and optional AI analysis.
- The delivery story is stronger than the typical homelab tool: production Docker images, smoke tests, Trivy scans, and strict quality gates are already in place.
- The codebase is mostly well-separated by concern, with backend routers/services and frontend components/hooks laid out sensibly.

The biggest gaps are not basic functionality. They are trust, safety, and scale:

- The core value of the product is whether users can trust the conclusions made from static analysis.
- The app handles sensitive controller and AI credentials, but the current storage and auth model is still lightweight.
- CI is strong on unit and static checks, but critical end-to-end user journeys are not yet guarded.
- Large sites will put pressure on both the frontend architecture and the graph/matrix interaction model.
- The app is still strongest at inspection, not remediation.

## Prioritized Roadmap

### 1. Raise analysis fidelity and explainability

Priority: P0

Why this is first:

- Static analysis and simulation are the product's core promise.
- Recent analyzer improvements reduced obvious false positives, but the model still does not fully cover the full UniFi rule surface.
- AI analysis only adds value if the deterministic baseline is trusted first.

#### Phase 1: Static analysis, simulator parity, and golden tests -- DONE

Shipped:

- Extended the simulator to match against all resolvable Rule constraints (IP ranges, address groups, source ports, port groups). Constraints it cannot evaluate (MAC addresses, schedules, IPSec, connection state) are reported as unresolvable in the evaluation trace.
- Added five new static analyzer checks: no connection state tracking (high), overlapping allow/block interactions (medium), broad address group resolution (medium), missing logging on block rules (low), and schedule-dependent allows (low).
- Added structured `rationale` to all findings explaining why each issue is flagged.
- Polished the RulePanel UI: collapsible rationale, severity-grouped findings, visual pass/fail/unknown evaluation traces, assumption banners on simulation results.
- Built 6 hand-crafted golden test fixtures covering clean, permissive, exposed, complex-interaction, constrained, and large-ruleset scenarios as regression anchors.

Related design:

- [Analysis Fidelity and Explainability Design](plans/2026-03-12-analysis-fidelity-design.md)

#### Phase 2: AI analysis reliability -- DONE

Shipped:

- Split AI provider transport settings from AI analysis settings with separate `ai_analysis_settings` SQLite table and API endpoints.
- Added `site_profile` as analysis context (`homelab`, `smb`, `enterprise`) with tailored AI prompt guidance.
- Versioned the AI prompt (`AI_PROMPT_VERSION`) and expanded the cache key to include model, site_profile, prompt_version, and static_summary.
- Explicit AI failure states via `AiAnalysisResult` model with `status`, `cached`, and `message` fields instead of collapsing failures into empty findings.
- Enriched findings with `rule_ids`, `confidence`, and `recommended_action` fields for traceability and actionability.

Related design:

- [AI Analysis Reliability and Site Profile Design](plans/2026-03-12-ai-analysis-design.md)

#### Future: Template-based fixture generation

- Define site archetypes as parameterized templates and generate fixture sets programmatically for broader regression coverage. Follows after hand-crafted fixtures prove the golden test pattern.

Done looks like:

- The app can explain its conclusions on realistic rule sets, and false-positive/false-negative drift is measurably lower on fixture-based regression tests.

### 2. Harden secrets, auth, and deployment boundaries

Priority: P0

Why this is next:

- UniFi credentials are shared through runtime process state, and AI keys are currently stored in SQLite.
- The app now has a simple single-container deployment path, which increases the importance of secure defaults.
- Any future write operations should not be built on top of the current trust boundary unchanged.

What to ship:

- Move production secrets toward env or secret-file providers, and avoid plaintext secret storage as the default production path.
- Add an explicit application auth/session model for non-local deployments before enabling mutation features.
- Tighten deployment controls: trusted origins/CORS configuration, outbound AI URL validation or allowlists, and secret redaction in logs and errors.

Done looks like:

- Production deployments have a clear, documented security model, and the app no longer relies on plaintext stored secrets for its default hardened path.

### 3. Add end-to-end confidence and upgrade safety

Priority: P1

Why this comes before major expansion:

- The repo has excellent unit coverage and strong lint/type/complexity checks, but it still lacks protection for the real user journeys that matter most.
- SQLite is used for persistent state, but there is no migration/versioning story yet.
- Production image smoke tests are useful, but they do not cover login, fetch, graph, simulation, or AI configuration flows.

What to ship:

- Add Playwright coverage in CI for the critical product paths: login, load rules, matrix, graph, rule panel, traffic simulation, and settings.
- Introduce database schema versioning and migrations for persistent settings and caches.
- Improve observability around startup, UniFi fetch failures, AI timeouts, cache behavior, and upgrade state.

Done looks like:

- A release is validated against the production image through end-to-end tests, and persisted data can evolve safely across versions.

### 4. Scale the frontend architecture and large-site UX

Priority: P1

Why this matters now:

- The frontend still concentrates a lot of orchestration in `frontend/src/App.tsx`, and `frontend/src/components/RulePanel.tsx` is carrying a lot of UI and workflow state.
- Data loading is all-or-nothing, and the graph view still does more work than necessary for larger installations.
- Larger UniFi sites are likely to stress interaction quality before they run out of core features.

What to ship:

- Break the app shell into smaller feature hooks/components with clearer state ownership.
- Introduce a query/cache layer, cancellation, and more targeted refresh behavior instead of refetching everything eagerly.
- Improve large-site usability with graph clustering, search/focus tools, virtualization where appropriate, and matrix ergonomics for many zones.

Done looks like:

- Large rule sets remain responsive, and routine interactions do not require full remounts or full-data refreshes.

### 5. Turn the app from analyzer into operator workflow

Priority: P2

Why this is fifth:

- This is the clearest product expansion area, but it should follow trust, security, and upgrade safety work.
- The existing app is good at diagnosis, but it still stops short of helping users close the loop.

Already shipped:

- Rule enable/disable toggle with confirmation dialog.
- Rule reorder (move up/down) with confirmation dialog.
- Backend write operations via unifi-topology library.

What remains:

- Add remediation-oriented flows: suggested next actions, rule diffs, and before/after validation via simulation.
- Add export/share paths for findings and posture reports so the tool can support review and change management workflows.

Done looks like:

- Users can go from understanding a problem to making and validating a guarded change without leaving the application.

## Ordering Rationale

This ordering is deliberate:

1. Trust the conclusions.
2. Secure the trust boundary.
3. Protect releases and upgrades end-to-end.
4. Make the app hold up on larger, messier sites.
5. Only then extend into change execution workflows.
