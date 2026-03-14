# UniFi Homelab Ops -- Multi-Module Platform Design

Date: 2026-03-14

## Overview

UniFi Homelab Ops is a self-hosted web application that extends the native UniFi dashboard with three modules: firewall analysis, network topology visualization, and device metrics monitoring. It connects to a single UniFi controller and provides operational insight that the native UI does not offer -- security scoring, physical topology diagrams, hardware health trends, and AI-powered cross-domain analysis.

The application targets homelab operators who want deeper visibility into their UniFi network without replacing the native controller UI.

## Competitive landscape

No existing open-source project combines firewall analysis, topology visualization, and device metrics in one package:

- **UnPoller**: Full device metrics but purely a data pipeline to Grafana. No UI, no topology, no firewall analysis.
- **NetworkOptimizer**: 63 security checks and RF heatmaps. BSL license (not open source), C#/.NET, no network topology graph.
- **UI Toolkit**: Partial metrics (CPU/RAM/WAN). No firewall or topology.
- **UniFi Log Insight**: Syslog-based firewall log analysis. No device metrics, no topology.

The existing `unifi-firewall-analyser` and `unifi-topology` projects already cover two of the three pillars. Adding device metrics and a unified AI layer creates a unique offering.

## Design decisions

- Single Docker container, one FastAPI backend, one React frontend.
- Modules share a common auth layer, SQLite database, and AI integration.
- Router groups per module (`/api/firewall/*`, `/api/topology/*`, `/api/metrics/*`).
- Extends the UniFi experience rather than replacing it. The native UI shows what your network looks like; this shows what it means.
- AI insights are the connective tissue. Per-module analysis plus a unified Site Health overview.
- Polling for metrics (not WebSocket). WebSocket is a future upgrade path.
- 24-hour rolling metrics history. Users who want 30-day history use UnPoller + Grafana.
- Passive anomaly checks are local and deterministic. No external alerting (email/Slack/webhook) -- users already have infrastructure for that.

## Rebrand

The existing `unifi-firewall-analyser` repository is renamed to `unifi-homelab-ops`. This covers:

- GitHub repo name (with automatic redirect from old name)
- Docker Hub image name
- Package references in `docker-compose.yml` and `Dockerfile`
- FastAPI app title
- Frontend page title, startup banners, and README
- Repository description

The firewall module remains the first and most mature module. Rebranding widens the scope without changing existing functionality.

## Module structure

### Firewall (existing)

Zone matrix, rule inspection panel, traffic simulation, static analysis with grading, AI-powered risk analysis. Write operations (enable/disable, reorder). Extracted from the current `unifi-firewall-analyser` codebase with routes moved under `/api/firewall/*`.

### Topology

Two sub-views:

- **Interactive** (ReactFlow): The existing graph view with firewall data overlay (edge colors, rule counts, zone nodes). Supports click-through to rule panel for zone pair inspection.
- **Diagram** (server-rendered SVG): Uses the `unifi-topology` library's SVG renderer. Supports orthogonal and isometric projections, 6 themes (light/dark variants of unifi, minimal, classic). Pan/zoom via a lightweight SVG viewer. Export for documentation and sharing.

Backend endpoint `/api/topology/svg` runs the renderer server-side and returns the SVG string, parameterized by theme and projection mode.

### Metrics

Device health dashboard showing:

- Uptime and reboot detection
- Temperature
- CPU and memory usage
- PoE consumption per port and budget utilization per switch
- Traffic counters (TX/RX bytes)
- Firmware version and mismatch detection

30-second polling interval. 24-hour rolling history in SQLite with daily pruning. Sparklines for trend visualization.

## Data layer

All modules share a single connection to the UniFi controller, authenticated once via the existing credential flow (environment variables or runtime login).

### unifi-topology library extension

A new `fetch_device_stats()` function is added to the library, pulling from `/api/s/{site}/stat/device` with detailed system-stats fields. Returns a new `DeviceStats` dataclass alongside the existing `Device` model. The library's role remains: fetch and normalize UniFi data. The app layer decides what to do with it.

### Backend data flow

- **Firewall**: Unchanged. Calls `fetch_firewall_zones()` and `fetch_firewall_policies()` through the existing service layer.
- **Topology**: Calls `fetch_devices()`, `fetch_clients()`, `fetch_networks()` for the interactive graph and SVG rendering.
- **Metrics**: A background polling task calls `fetch_device_stats()` on each tick and writes snapshots to a `device_metrics` SQLite table. The frontend queries `/api/metrics/devices` for latest values and `/api/metrics/devices/{id}/history` for 24h sparkline data.

### Shared caching

The unifi-topology library's JSON cache with TTL continues to serve topology and firewall queries. The metrics poller bypasses the cache (always wants fresh data).

## Passive anomaly checks

The metrics polling loop runs lightweight threshold checks on each snapshot. Local, deterministic, instant -- no AI involved.

### Built-in checks (sensible defaults, user-configurable later)

- Device offline (no response for 2 consecutive polls)
- CPU usage sustained above 80% for 5 minutes
- Memory usage above 85%
- Temperature above 80C (warning) or 95C (critical)
- PoE port budget above 90% of capacity
- Uptime reset detected (unexpected reboot)
- Firmware mismatch (device running different version than others of same model)

### Notification model

Each notification has severity (warning/critical), device reference, timestamp, message, and resolved flag. Notifications auto-resolve when the condition clears. The frontend shows an unread count badge in the navigation and a notification drawer listing active and recent (24h) alerts.

### Scope boundary

No email, Slack, or webhook push. This is a local dashboard, not an alerting platform. Users who want external notifications already have UnPoller + Alertmanager or Home Assistant automations.

## AI Site Health unified analysis

The Site Health view assembles context from all three modules and sends a single prompt to the configured AI provider.

### Context assembly

- **Firewall summary**: Zone count, total rules, grade distribution, active static findings by severity, zone pairs with no rules.
- **Topology summary**: Device count by type, single points of failure (single-uplink devices), VPN tunnel status, VLAN count and assignment gaps.
- **Metrics summary**: Active and recent anomaly notifications, 24h trend outliers for CPU/memory/temperature, PoE budget utilization, firmware mismatches, recent unexpected reboots.

### Prompt structure

System prompt establishes site profile (homelab/smb/enterprise, reusing existing `site_profile` setting). AI produces cross-domain findings with: severity, title, description, affected modules, affected device or zone pair IDs, and recommended action.

### Caching

Results cached by composite key: firewall rule hash + topology hash + latest metrics snapshot timestamp.

### UI

Dedicated `/health` view with card layout grouped by severity. Each finding links to the relevant module and entity (clicking a zone pair finding opens the firewall rule panel for that pair).

## Frontend navigation

### Layout

Narrow left sidebar (48-56px collapsed, icon-only) as module switcher:

- Firewall (shield icon)
- Topology (network icon)
- Metrics (activity icon)
- Site Health (below, separated)
- Settings and notification bell (bottom)

Sidebar expands to ~180px on hover, showing labels alongside icons.

### Module routing

Each module owns a URL prefix (`/firewall`, `/topology`, `/metrics`, `/health`). The firewall module preserves its internal navigation: matrix default, cell click opens graph with rule panel, browser back returns to matrix. Topology has Interactive and Diagram sub-views. Metrics has a single device grid view.

### State preservation

Switching modules does not reset position. TanStack Query's cache persists data across route changes. If you are inspecting a zone pair, switch to metrics, then switch back, the zone pair is still open.

### Responsive behavior

On narrow viewports (<768px), sidebar collapses to bottom tab bar. This is a future concern -- primary target is desktop and NOC screen use.

## Implementation phases

### Phase 1: Rebrand and navigation shell

Rename repo, Docker image, titles, banners, README. Add sidebar navigation with module switching. Firewall module moves under `/firewall`. Topology and Metrics modules exist as placeholder pages. No functional changes to the firewall module.

### Phase 2: Topology module

Add `/api/topology/svg` endpoint calling unifi-topology's renderer. Diagram sub-view with theme/projection selector, pan/zoom, export. Interactive sub-view reuses the existing ReactFlow graph, moved from the firewall module with firewall overlay preserved. Firewall matrix cell click still navigates to the interactive graph with rule panel.

### Phase 3: Metrics module

Extend unifi-topology with `fetch_device_stats()`. Add polling background task, `device_metrics` SQLite table with Alembic migration, prune job. Backend exposes metrics endpoints. Device grid with sparklines. Passive anomaly checks and notification system.

### Phase 4: Site Health AI

Context assembly logic, Site Health prompt, caching, and `/health` view. Requires all three modules producing data.

Each phase is independently shippable and testable. Phase 1 ships within days. Phases 2-4 are each roughly the scope of one completed roadmap item.
