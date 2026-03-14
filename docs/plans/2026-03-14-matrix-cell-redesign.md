# Matrix Cell Redesign

Date: 2026-03-14

## Goal

Redesign the ZoneMatrix cells to match the UniFi native matrix layout style -- wider cells with action summary text, horizontal headers, and axis labels -- while preserving our unique grade/analysis overlay as a colored dot indicator.

## Design decisions

- Cell background colors follow action type (allow=green, allow-return=blue, block=pink, mixed=amber), not analysis grade.
- Grade is shown as a small colored dot in the top-right corner of each cell.
- Column headers switch from vertical rotated text to horizontal text.
- Axis labels ("Source", "Destination") added for orientation.
- User-created rule count shown as "(N)" in the cell. Omitted when only predefined rules exist.
- Tooltip on hover shows full breakdown: "N user rules, M built-in rules".
- Self-pair cells show a centered dash, gray background, not clickable.
- "Allow Return" derived from predefined ALLOW rules with `connection_state_type` containing "established".

## Cell content and layout

Each matrix cell is a wide rectangle (~180-220px wide, ~52-72px tall) containing:

- **Action label** centered: "Allow All", "Allow Return", "Block All", or "Mixed".
- **User rule count** to the right of the label: "(3)" when user-created rules exist, omitted otherwise.
- **Grade dot** in the top-right corner: 8px colored circle. Green for A/B, amber for C, red for D/F. No dot when analysis is absent.
- **Tooltip on hover**: full rule breakdown, e.g. "3 user rules, 2 built-in rules".

### Derivation logic

All frontend-side, from existing `ZonePair` data:

1. Find predefined rules in `pair.rules` where `rule.predefined === true`.
2. If a predefined ALLOW rule has `connection_state_type` containing "established", label is "Allow Return". Otherwise ALLOW yields "Allow All", BLOCK/REJECT yields "Block All".
3. If no predefined rule exists, derive from `allow_count` vs `block_count`: all allow -> "Allow All", all block -> "Block All", mixed -> "Mixed".
4. User rule count = `pair.rules.filter(r => !r.predefined).length`.

### Self-pair cells

Gray background, centered dash, no hover effect, not clickable.

## Headers and axis labels

Column headers switch from vertical rotated text to horizontal text. Clickable (existing `onZoneClick`), centered, truncated with ellipsis.

Row headers remain horizontal and right-aligned (unchanged).

Axis labels:
- "Destination" above the column headers, spanning the full column range, centered.
- "Source" to the left of the row headers, rotated 90deg (reading bottom-to-top), vertically centered.

Corner cell (top-left): empty, `z-30` for sticky layering.

Grid template:
- Columns: `auto auto repeat(N, minmax(180px, 220px))` -- first auto for "Source" label gutter, second for row headers.
- Rows: `auto auto repeat(N, minmax(52px, 72px))` -- first auto for "Destination" label, second for column headers.

## Color scheme

| Action       | Light mode                    | Dark mode                              |
|--------------|-------------------------------|----------------------------------------|
| Allow All    | Light green bg, green border  | `status-success/10`, `status-success/25` border |
| Allow Return | Light blue bg, blue border    | `ub-blue/10`, `ub-blue/25` border      |
| Block All    | Light pink bg, red border     | `status-danger/10`, `status-danger/25` border |
| Mixed        | Light amber bg, amber border  | `status-warning/10`, `status-warning/25` border |
| No rules     | Gray bg, gray border          | `noc-raised/50`, `noc-border`          |
| Self-pair    | Neutral gray, no border       | `noc-raised/30`                        |

Grade dot colors: A/B green (`status-success`), C amber (`status-warning`), D/F red (`status-danger`).

Hover: `ring-2 ring-ub-blue/40` (unchanged). Self-pair cells get no hover.

Action label text: `text-gray-700 dark:text-noc-text`. User rule count: `text-ub-blue`.

## Component changes

### `MatrixCell.tsx` -- rewrite

New props:

```typescript
interface MatrixCellProps {
  actionLabel: "Allow All" | "Allow Return" | "Block All" | "Mixed" | null;
  userRuleCount: number;
  predefinedRuleCount: number;
  grade: string | null;
  onClick: () => void;
  isSelfPair: boolean;
}
```

Pure display component. Renders action label, user rule count, grade dot, tooltip.

### `utils/matrixUtils.ts` -- new

Pure function `deriveCellSummary(pair: ZonePair)` returns `{ actionLabel, userRuleCount, predefinedRuleCount }`. Independently testable.

### `ZoneMatrix.tsx` -- update

- Grid template adds columns/rows for axis labels.
- Calls `deriveCellSummary()` per pair, spreads into MatrixCell.
- Column headers horizontal (remove `writingMode` and `rotate`).
- Adds "Destination" and "Source" labels.
- Self-pair cells: `isSelfPair=true`, no `onClick`.

### Tests

- `matrixUtils.test.ts`: derivation logic for all action types, edge cases.
- `MatrixCell.test.tsx`: updated for new props, tooltip, self-pair.
- `ZoneMatrix.test.tsx`: updated for axis labels, horizontal headers, self-pair inertness.

### No backend changes

All required data (`rules[]` with `predefined`, `connection_state_type`, `action`) is already in the `ZonePair` API response.
