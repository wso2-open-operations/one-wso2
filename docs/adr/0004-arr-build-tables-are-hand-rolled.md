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

1. **Row windowing has to be written.** *Built in ticket 07; see the revisit below.* There is no
   virtualization. The
   prototype rendered ~2,500 live DOM cells from *seven* fake customers; the real Build is hundreds of
   customers per business unit across six units and four movements. `AttendeeGrid.tsx:46-64` already
   designates this as the escape hatch — *"If one ever arrives with several thousand, render windowing
   goes HERE — not another library."* This port is that case, and the prediction held: the windowing
   went there, and not another library. See the revisit section below.
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
  this app, upgraded. **Ticket 07 built the windowing and triggered that revisit — see below.**

- **Ship both a hand-rolled read view and a flattened DataGrid "Analyse" tab.** Rejected: two surfaces
  to maintain, and two places for the same figures to disagree.
- **One period at a time, rendered vertically.** Rejected as the primary screen — it makes
  period-over-period comparison structurally impossible, which is what the Build is for. Retained as
  the candidate answer for the sub-1024px question in `docs/ported-apps/mis.md` §11.7, where it
  performed well at 400px.

## The windowing revisit (ticket 07)

This ADR made row windowing the trigger: *"revisit if row windowing proves harder than expected, since
that is the item most likely to invalidate this decision."* Ticket 07 built it. **On the question the
trigger actually asks — is this harder than expected — the answer is no, and the decision stands. On
whether the result performs at real volume, this is not yet evidence, and the distinction matters.**

**What is settled.** Windowing cost a clamped index range (`rowWindow` in `buildTableModel.ts`), a
measurement hook, and two empty rows carrying the height of what is not rendered. Every mechanism this
ADR lists as "ours to maintain forever" survives **untouched**, and each is now held to that by a test
taken with a windowed body: the measured two-row header offset, the sticky pinned column, the per-cell
borders, and the `id`/`headers` wiring. That is not luck. Windowing rows is independent of all of them
*precisely because* the table is a plain `<table>` — the rows outside the window are replaced by
height, so the table algorithm still sizes the columns across header and body and nothing else in the
markup changes shape. Nothing here is a judgement about data; it is a property of the code, and it is
the thing the trigger was pointed at.

**What is not settled, and must not be read as settled.** The measurement is a synthetic flat
3,000-row fixture under jsdom — no tree, no browser, no real formatter, no layout and no frame rate.
Ticket 07's own notes say that firing this revisit against fixtures is what "sequenced after real data"
was meant to prevent, and that objection is not answered by having built the thing. **The performance
half of this revisit is open until a browser renders a real per-customer Build — ticket 10.** If it
disappoints there, the trigger is still live and MUI X Pro is still the option to weigh.

**The tool the ticket named did not work, and that is the one firm negative result.** `react-window` is
already a dependency. `createListComponent` gives every item
`{ position: 'absolute', top, height, width: '100%' }` (`react-window@1.8.11`,
`dist/index.esm.js:1099-1106`). The style arrives as a prop the item could in principle discard — but
discarding it discards the positioning, which is the entire contribution the library makes. Applied,
it takes a `<tr>` out of the table formatting context and the column sizing, the sticky column and the
sticky header go with it. The library's own table examples avoid this by dropping `<table>` for
`display: block` divs, which is exactly the trade this ADR refused.

**Two caveats worth keeping.** Row height is measured once and assumed uniform. It is — labels cannot
wrap and every figure is one line — except for the 2px rule above a total row, so a table of many
totals drifts its scroll extent by 2px each: bounded, invisible at these counts, and the first place to
look if the scrollbar ever disagrees with the content. And windowing unmounts rows, so a section toggle
that scrolls out of view is no longer focusable and a focused one that scrolls away drops focus to the
document. That is inherent to virtualization rather than to this implementation, it is why the
threshold exists, and it is worth revisiting if the per-customer Builds turn out to nest deeply.
