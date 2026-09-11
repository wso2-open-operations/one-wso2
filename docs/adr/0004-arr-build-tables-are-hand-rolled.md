# The ARR Build tables are hand-rolled on MUI Table, not a data grid

The community `@mui/x-data-grid` this app ships through Oxygen cannot express the ARR Build:
`pageSize` throws above 100, column pinning is absent, `GridPinnedRows` returns `null`, and row
grouping, tree data and aggregation are not in the package at all. A three-variant prototype
(`/finance/mis-prototype`) tested the ways out and confirmed that a plain `<Table>` **can** carry all
four required capabilities at once — sticky first column, sticky two-row grouped header, three-level
collapsible row sections, and horizontal scroll at 24 columns — with no new dependency and no licence.
So the Build and the Flash P&L are hand-rolled; ARR Analysis's flat account table still takes the
DataGrid, per the policy in `LeaveReportsPage.tsx:315-318`.

## Consequences — these are required scope, not caveats

1. **Row windowing has to be written.** There is no virtualization. The prototype rendered ~2,500 live
   DOM cells from *seven* fake customers; the real Build is hundreds of customers per business unit
   across six units and four movements. `AttendeeGrid.tsx:46-64` already designates this as the escape
   hatch — *"If one ever arrives with several thousand, render windowing goes HERE — not another
   library."* This port is that case.
2. **An export path has to be built.** A hand-rolled table gets no CSV, and Finance's existing workflow
   is to select the grid and paste it into a spreadsheet. The ExcelJS work already required for Flash
   should be generalised to cover the Build rather than written twice.

And these bespoke mechanisms become ours to maintain, none of which has a precedent in this repo:

- **MUI's `stickyHeader` is single-row only** (verified in `@mui/material` 7.3.4,
  `TableCell.js:145-151`: every header cell gets `top: 0`). A second header row must have its offset
  measured at runtime, or the Period labels are covered by the sub-header.
- **`<TableRow hover>` and `selected` do not work with a pinned column** — the tint paints on the
  `<tr>`, behind the pinned cell's mandatory opaque background, so the highlight stops at the frozen
  column. Both must be hand-rolled per cell.
- **`stickyHeader` forces `borderCollapse: separate`**, so every border is placed by hand, per cell.
- The two-row header needs explicit `id`/`headers` wiring for screen readers. With 24 numeric columns
  that is not a cosmetic gap.

## Considered options

- **MUI X Pro.** Delivers column pinning, tree data and aggregation in one component and deletes every
  bespoke mechanism above. Rejected on procurement cost, not on merit — revisit if row windowing
  proves harder than expected, since that is the item most likely to invalidate this decision. Note
  that the repo's existing objection to grid libraries (`AttendeeGrid.tsx:46-64`) was written about
  `react-datasheet-grid` and does not transfer cleanly: Pro is the same component already rendering in
  this app, upgraded.
- **Ship both a hand-rolled read view and a flattened DataGrid "Analyse" tab.** Rejected: two surfaces
  to maintain, and two places for the same figures to disagree.
- **One period at a time, rendered vertically.** Rejected as the primary screen — it makes
  period-over-period comparison structurally impossible, which is what the Build is for. Retained as
  the candidate answer for the sub-1024px question in `docs/ported-apps/mis.md` §11.7, where it
  performed well at 400px.
