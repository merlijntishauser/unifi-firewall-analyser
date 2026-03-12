# Product Roadmap

Date: 2026-03-12

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

What to ship:

- Expand analyzer and simulator parity for schedules, address groups, network objects, state handling, `DROP` semantics, and more default-rule interactions.
- Build a sanitized fixture corpus from real UniFi exports and use it for golden tests on findings, scores, grades, and simulation outcomes.
- Surface clearer reasoning in the UI and API: why a rule matched, why a finding fired, and what assumptions were made.

AI analysis design summary:

- Split AI provider transport settings from AI analysis settings instead of overloading one config object.
- Add `site_profile` as analysis context with `homelab`, `smb`, and `enterprise`, but use it to tune prioritization and remediation rather than hard facts.
- Version the AI prompt and include prompt/context inputs in the cache key so model, profile, and prompt changes cannot reuse stale findings.
- Return explicit AI failure states instead of collapsing provider or parse failures into an empty findings list.
- Strengthen AI findings so they can become more traceable and actionable over time.

Related design:

- [AI Analysis Reliability and Site Profile Design](plans/2026-03-12-ai-analysis-design.md)

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
- The repo already has a write-operations plan, which makes this a credible next-step once the safety prerequisites are in place.

What to ship:

- Add safe write operations incrementally, starting with enable/disable and reorder under explicit confirmation and audit-friendly logging.
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
