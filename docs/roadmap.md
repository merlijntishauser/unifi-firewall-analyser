# Product Roadmap

Last updated: 2026-03-15

## Completed

Items shipped across all phases. Kept for historical context.

- **Analysis fidelity** -- static analyzer checks, simulator parity, golden test fixtures, AI analysis reliability with site profiles and caching
- **Secrets and auth hardening** -- env/secret-file credential sources, app auth gate with HMAC cookies, CORS lockdown, deployment docs
- **E2E confidence** -- production Playwright suite, Alembic migrations, structured logging, CI e2e-production job
- **Frontend scaling** -- TanStack Query data layer, component extraction, sticky matrix headers, healthcheck startup race fix
- **Multi-module platform** -- rebrand to UniFi Homelab Ops, sidebar navigation, module routing, settings modal with tabbed panes
- **Topology module** -- device map (ReactFlow), SVG diagram with pan/zoom/export, device detail panel with port table
- **Metrics module** -- background poller, 24h SQLite retention, anomaly detection, notification drawer, device grid with sparklines
- **Site Health AI** -- unified health dashboard with deterministic summary cards (firewall grades, topology status, metrics notifications) and AI-powered cross-domain analysis with severity-grouped finding cards, entity-level prompt context, caching, and deep-link navigation to affected modules

---

## General / Sitewide

### Prometheus metrics endpoint

Add a `/metrics` endpoint exposing Prometheus counters and histograms for controller fetches, AI calls, cache hit/miss, and request latency. Optional -- zero-config if not scraped.

### Outbound URL validation and log redaction

Add HTTPS enforcement and domain allowlist for AI `base_url` to prevent credential leakage to unintended hosts. Audit and redact sensitive data (API keys, response bodies) from server-side log output.

### Responsive layout

On narrow viewports (<768px), sidebar collapses to bottom tab bar. Primary target is desktop and NOC screen use.

### Enterprise-scale sites (100+ zones)

Virtualized matrix rendering (TanStack Virtual or similar) for grids beyond 50 zones. Graph viewport culling and lazy edge rendering for large topologies. Zone search/filter input for both matrix and graph views. Graph clustering for dense zone groups.

---

## Firewall Module

### Template-based fixture generation

Define site archetypes as parameterized templates and generate fixture sets programmatically for broader regression coverage. Follows after hand-crafted fixtures prove the golden test pattern.

### RulePanel hook extraction

Split the two reducers in RulePanel into `useSimulation()`, `useAiAnalysis()`, `useRuleWrite()` hooks. Follow-up to the file extraction once it settles.

### Operator workflow: remediation flows

Add remediation-oriented flows: suggested next actions, rule diffs, and before/after validation via simulation. Add export/share paths for findings and posture reports to support review and change management workflows. Rule enable/disable and reorder already shipped.

---

## Topology Module

### Upstream: add `model_name` to `DeviceStats`

Add `model_name` field to `DeviceStats` in [unifi-topology](https://github.com/merlijntishauser/unifi-topology/issues/19) so device cards and panels show the friendly name (e.g. "UniFi Cloud Gateway Fiber") instead of the model code (e.g. "UCGFIBER"). Currently worked around by using the model code.

---

## Metrics Module

### Customizable card metrics

Allow users to select which metrics/information are shown in the device cards overview. Store preference in User Settings. Possible options: CPU, memory, temperature, client count, uptime, traffic, PoE consumption.

### Configurable anomaly thresholds

Anomaly check thresholds are hardcoded (CPU >80%, memory >85%, temperature >80/95C, PoE >90%). A User Settings pane could expose per-check threshold configuration stored in SQLite.

### Extended retention

24-hour rolling history is sufficient for real-time monitoring. A future option could extend to 7-day or 30-day retention with downsampled data points. Users wanting longer retention should use UnPoller + Grafana.

### Sparkline chart library upgrade

Current sparklines are custom inline SVG. If richer interactivity is needed:

- **Recharts** (~150KB): full-featured React charting with tooltips, axes, responsive sizing
- **@visx/shape + @visx/scale** (~40KB): D3-based React primitives, middle ground for axes and tooltips
