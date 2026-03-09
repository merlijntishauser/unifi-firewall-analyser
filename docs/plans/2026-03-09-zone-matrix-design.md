# Zone Matrix Visualization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the unreadable full-mesh node graph with a two-level navigation: matrix overview + filtered graph detail.

**Architecture:** Matrix view as the home screen showing all zone pairs in a grid. Clicking a zone header drills into a React Flow graph filtered to that zone's connections. Clicking a matrix cell or graph edge opens the existing RulePanel.

**Tech Stack:** React, Tailwind CSS (matrix), React Flow + dagre (detail graph), existing backend unchanged.

---

## Overview

The current node graph is unreadable with real data (9 zones, 80 zone pairs -- nearly full mesh). The solution is two-level navigation:

1. **Matrix view** (home) -- source zones as rows, destination zones as columns
2. **Graph view** (detail) -- React Flow graph filtered to a single zone's connections

## Matrix View

- CSS grid: rows = source zones, columns = destination zones
- Each cell color-coded by security posture:
  - **Green** -- all enabled rules are ALLOW (or default allow_all)
  - **Red** -- all enabled rules are BLOCK/REJECT (or default block_all)
  - **Amber** -- mixed (both ALLOW and BLOCK rules exist)
  - **Gray** -- no rules, no default action
- Cell content: rule count, allow/block split pill
- Click a **cell** -> opens RulePanel for that zone pair
- Click a **zone header** (row or column) -> navigates to graph view for that zone
- Diagonal (self-zone pairs) shown dimmed
- Column headers rotated 45 degrees

## Graph View

- React Flow showing only the selected zone and its directly connected zones
- At most ~16 edges (in + out for each connected zone) instead of 80
- Existing ZoneNode and RuleEdge components reused
- Back button returns to matrix view
- Click an edge -> opens RulePanel (existing behavior)

## Component Structure

- **ZoneMatrix** (new) -- renders the grid, handles cell clicks and zone header clicks
- **MatrixCell** (new) -- individual cell, color logic, hover state
- **ZoneGraph** (modified) -- accepts optional `focusZoneId` prop to filter edges
- **ZoneNode** (unchanged)
- **RuleEdge** (unchanged)
- **RulePanel** (unchanged)
- **Toolbar** (unchanged)
- `layout.ts` (unchanged)

## App Navigation Flow

```
App
  |-- auth check
  |-- load zones + zonePairs
  |-- if no focusZone:
  |     render ZoneMatrix + optional RulePanel
  |-- if focusZone:
  |     render ZoneGraph (filtered) + optional RulePanel + back button
```

State in App.tsx:
- `focusZoneId: string | null` -- null = matrix view, set = graph view
- `selectedPair: ZonePair | null` -- drives RulePanel (works in both views)

## Interaction Summary

| Action | Result |
|--------|--------|
| Click matrix cell | Open RulePanel for that pair |
| Click zone header in matrix | Navigate to graph view for that zone |
| Click edge in graph view | Open RulePanel for that pair |
| Click back button in graph view | Return to matrix view |
| Close RulePanel | Close panel (stay in current view) |
