# Topology Module Redesign

Date: 2026-03-14

## Problem

The initial topology module implementation has two issues:

1. The diagram view exposes too many options (6 themes, 2 projections) when it should auto-select based on color mode.
2. The interactive view reuses the firewall zone graph (ZoneGraph), which shows firewall zones and rule edges -- not physical network devices. The topology module should show an interactive map of UniFi infrastructure devices.

## Design

The topology module has two views: **Map** (default, interactive device graph) and **Diagram** (static SVG for export/documentation).

### Map view

ReactFlow-based interactive graph showing infrastructure devices (gateways, switches, APs) as nodes. All devices the controller knows about are shown, regardless of vendor. Clients are not shown as nodes -- client counts appear as badges on device nodes.

Clicking a device opens a detail panel (right side, same pattern as RulePanel) with:

- **Header**: device name, model name, online/offline status
- **Summary**: IP, MAC, firmware version, uptime, client count
- **Port table**: port number, link speed, connected device name (from LLDP), PoE draw, VLAN. Sorted by port index. Unused ports dimmed. PoE budget summary below the table for switches.

Edges show physical connections with link speed and PoE indicators.

### Diagram view

Server-rendered SVG via unifi-topology library. Theme locked to `unifi` (light) or `unifi-dark` (dark), auto-selected from `colorMode`. Default projection is isometric. Includes UniFi clients and only UniFi devices (`only_unifi=True`). User controls: orthogonal/isometric toggle, Export SVG, Export PNG. Pan/zoom via SvgViewer.

### Toolbar

Map/Diagram toggle. Diagram-only controls: projection toggle, export buttons. No theme selector, no refresh button.

## Backend

### New endpoint

`GET /api/topology/devices` -- returns device topology as structured JSON.

Response:
```json
{
  "devices": [{
    "mac": "aa:bb:cc:dd:ee:01",
    "name": "Gateway",
    "model": "UDM-Pro",
    "model_name": "UniFi Dream Machine Pro",
    "type": "gateway",
    "ip": "192.168.1.1",
    "version": "4.0.6",
    "uptime": 1234567,
    "status": "online",
    "client_count": 12,
    "port_count": 8,
    "ports": [{
      "idx": 1,
      "name": "LAN 1",
      "speed": 1000,
      "is_uplink": false,
      "poe_mode": "auto",
      "poe_power": 4.2,
      "connected_device": "Switch-24",
      "connected_mac": "aa:bb:cc:dd:ee:02",
      "vlan": null
    }]
  }],
  "edges": [{
    "from_mac": "aa:bb:cc:dd:ee:01",
    "to_mac": "aa:bb:cc:dd:ee:02",
    "local_port": 1,
    "remote_port": 1,
    "speed": 1000,
    "poe": true,
    "wireless": false
  }]
}
```

### Modified endpoint

`GET /api/topology/svg` -- remove `theme` parameter. Theme derived server-side from new `color_mode` parameter (default `"dark"`). Pass `only_unifi=True` to topology builder. Include clients. Default projection changed to `isometric`.

### Removed endpoint

`GET /api/topology/themes` -- no longer needed.

## Frontend

### Remove
- Theme selector, `TopologyTheme` type, `useTopologyThemes` hook, `getTopologyThemes` client method
- ZoneGraph and RulePanel imports from TopologyModule
- Theme auto-switch logic (replaced by `colorMode === "dark" ? "unifi-dark" : "unifi"`)

### Add
- `TopologyDevice`, `TopologyPort`, `TopologyEdge`, `TopologyDevicesResponse` types
- `getTopologyDevices()` API client method
- `useTopologyDevices()` query hook
- `DeviceMap` component (ReactFlow with device nodes and connection edges)
- `DeviceNode` custom ReactFlow node (device icon, name, client count badge)
- `DevicePanel` side panel (device summary + port table)

### Modify
- `TopologyModule` toolbar: rename "Interactive" to "Map", make Map default, simplify controls
- `getTopologySvg` -- replace `theme` param with `colorMode`, remove projection default change
- Diagram view: remove theme dropdown, default to isometric

## Implementation order

1. Backend: modify SVG endpoint, add devices endpoint, remove themes endpoint
2. Frontend: add types, client methods, hooks
3. Frontend: DeviceNode, DeviceMap, DevicePanel components
4. Frontend: rewire TopologyModule, remove unused code
5. Tests for all new/changed code
