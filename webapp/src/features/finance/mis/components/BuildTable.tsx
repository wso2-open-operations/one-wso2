// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useId, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Box, ButtonBase, ListingTable, Typography } from "@wso2/oxygen-ui";
import WideTableNotice from "@components/wide-table-notice/WideTableNotice";
import {
  ROW_WINDOW_THRESHOLD,
  allExpandableIds,
  buildTableIds,
  leadColumnOffsets,
  rowWindow,
  tableMinWidth,
  visibleRows,
  type BuildColumnGroup,
  type BuildLeadColumn,
  type BuildRow,
  type BuildSubColumn,
} from "./buildTableModel";
import {
  rowSx,
  MAX_BODY_HEIGHT,
  NUMERIC_CELL_SX,
  ROW_LABEL_WIDTH,
  SECTION_LABEL_SX,
  Z,
  headCellSx,
  leadCellSx,
  leadHeadCellSx,
  sectionRowSx,
} from "./buildTableSx";
import { gridFrameSx } from "./misLookTokens";

// The grid's visual rules, in one place (the values are `buildTableSx.ts`):
//
//   - an Oxygen `ListingTable` at compact density, so text size, weights, cell
//     padding and the head's fill are the same as every other table in the
//     app; row and header heights follow from that, and nothing here sets one
//   - ONE header row when each Period has a single figure column (the
//     sub-header row only exists with several)
//   - no vertical rules between figures — only the pinned column's and the
//     header's
//   - a section row is a band on `grey.50` (light) / `action.hover` (dark)
//     with a small-caps label, and it is a label, not a fold: no chevron, no
//     toggle, no indent, and every row of every section is always on screen
//   - bold rows at weight 600, no fill under them and no rule above Ending ARR
//   - a drill-down figure shows its underline only to a pointer or the keyboard
//   - negatives carry their sign and nothing else — no colour

// The table every Build screen renders through.
//
// A Build reads down — an Opening balance, the movements that change it, a
// Closing balance — and across, one column group per Period. Four things have
// to be true at once, and it is the combination rather than any one of them
// that decided this is hand-rolled over Oxygen's table primitives rather than
// a data grid:
//
//   1. the row-label column stays put while two dozen numeric columns scroll
//   2. the header stays put while the rows scroll under it
//   3. the header is TWO rows — a Period above its Amount / % Open pair
//   4. section rows are bands labelling the rows beneath them, drawn in the
//      same table as the figures they head
//
// (3) is the one with no precedent anywhere in this repo and no help from MUI.
// See `useHeaderRowHeight` below.
//
// What this component does NOT do, deliberately: no formatting (injected, so
// the Scale rule stays in one place) and no fetching.
//
// It DOES window its rows above `ROW_WINDOW_THRESHOLD` (see `useRowWindow`), and
// it DOES render a figure as an activatable control when the caller's `cell`
// returns an `onActivate` — which is how the customer drill-down opens. What
// stays out is any knowledge of WHICH figures have something behind them; that
// is per-row and the caller's alone.

/** One figure, as the caller wants it read. */
export interface BuildCell {
  /**
   * Already formatted. The Build shows currency, counts and percentages in the
   * same column, and only currency is scaled — so the row's own formatter
   * decides, not this table.
   */
  text: string;
  /** Shown in the negative tone: a Reduction, a Lost, a fall. */
  negative?: boolean;
  /** A subordinate figure, such as the percentage beside its amount. */
  muted?: boolean;
  /**
   * Opens whatever sits behind this figure — the customer drill-down.
   *
   * Per CELL, and per cell deliberately. Most of a Build has nothing behind it:
   * a y/y growth, a retention ratio and a percentage are arithmetic over other
   * rows, not sets of customers, so only some figures may be opened and the
   * caller is the only one who knows which. Omitted, the figure is plain text —
   * which is what two thirds of the Build renders as.
   */
  onActivate?: () => void;
}

export type BuildCellFor = (
  row: BuildRow,
  group: BuildColumnGroup,
  subColumn: BuildSubColumn,
) => BuildCell;

export interface BuildTableProps<L extends BuildLeadColumn = BuildLeadColumn> {
  /** The table's accessible name. */
  label: string;
  /**
   * Header over the pinned row-label column — the first identity column, and
   * the only one a table with nothing else to say about its rows needs.
   */
  rowLabelHeader: string;
  /**
   * The identity columns, left of the figures, when a row needs more than a
   * name. The FIRST is the row label — it carries `row.label` and a section's
   * band styling, and it stays the cell a screen reader names the row by.
   * Omitted, the table has exactly one, built from `rowLabelHeader` and
   * `rowLabelWidth`, which is the Subscription Build.
   */
  leadColumns?: readonly L[];
  /**
   * The text in an identity column after the first.
   *
   * The column handed back is the caller's OWN object, not a copy — the type
   * parameter exists for exactly that, so a caller whose columns know how to
   * read themselves can just ask, instead of looking the column up again by key
   * on every cell of a table built for thousands of rows.
   */
  leadCell?: (row: BuildRow, column: L) => string;
  /** One per Period, in display order. */
  columnGroups: readonly BuildColumnGroup[];
  /** Repeated under every Period — Amount, % of Opening. */
  subColumns: readonly BuildSubColumn[];
  rows: readonly BuildRow[];
  cell: BuildCellFor;
  rowLabelWidth?: number;
  maxBodyHeight?: number;
  /**
   * Sub-column keys that are a GRAND TOTAL — the Customers table's "Total" —
   * set in weight 600 under either header row.
   */
  grandTotalKeys?: ReadonlySet<string>;
  /**
   * What an `emphasis` row weighs. The tables are not uniform — a Build's bold
   * rows are 600, the Customers `Total` row and a Region Summary total are
   * 700 — so the table that knows which it is says so. Default: the Build's.
   * The size is never the row's to change: every row is the table's own.
   */
  emphasisStyle?: { fontWeight?: number };
  /**
   * Show ONE header row when each Period has a single sub-column. True on the
   * Subscription Build, where the lone sub-column is the ARR type and the
   * Period label stands alone; false on the Customers table, where the lone
   * "Total" under Totals only is a real column that keeps its header row.
   */
  collapseLoneSubHeader?: boolean;
  /**
   * The body fills whatever height its parent gives it and is the scroller.
   * The page uses this so the chrome above the grid stays put. A dialog leaves
   * it off and keeps `maxBodyHeight`.
   */
  fill?: boolean;
}

export default function BuildTable<L extends BuildLeadColumn = BuildLeadColumn>({
  label,
  rowLabelHeader,
  leadColumns,
  leadCell,
  columnGroups,
  subColumns,
  rows,
  cell,
  rowLabelWidth = ROW_LABEL_WIDTH,
  maxBodyHeight = MAX_BODY_HEIGHT,
  grandTotalKeys,
  emphasisStyle,
  collapseLoneSubHeader = false,
  fill = false,
}: BuildTableProps<L>) {
  // The Period label stands alone when it has one sub-column under it (a Build
  // with one ARR type); the sub-header row only exists with several. Kept in
  // the DOM but hidden so every figure's `headers` still resolves.
  const singleHeaderRow =
    collapseLoneSubHeader && subColumns.length === 1 && columnGroups.length > 0;
  // The Customers table's Total column is weight 600 and nothing more.
  const grandTotalSx = (key: string) => (grandTotalKeys?.has(key) ? { fontWeight: 600 } : {});
  const ids = buildTableIds(useId());
  const [periodRowRef, periodRowHeight] = useHeaderRowHeight();

  // One identity column unless the caller named more. The Subscription Build
  // takes this path and is therefore the same code as the eighteen-column
  // customers table rather than a branch beside it.
  const lead: readonly L[] = useMemo(
    () =>
      leadColumns?.length
        ? leadColumns
        : ([{ key: "__label", label: rowLabelHeader, width: rowLabelWidth, pinned: true }] as
            unknown as readonly L[]),
    [leadColumns, rowLabelHeader, rowLabelWidth],
  );
  const leadOffsets = useMemo(() => leadColumnOffsets(lead), [lead]);
  const leadWidth = lead.reduce((total, column) => total + column.width, 0);

  // The Period columns flex to fill the viewport, so a Totals-only Customers
  // table scrolled to its end shows five wide Totals, not a sliver of Employee
  // Count beside them. The frame is measured and each sub-column widened to its
  // share of what the pinned columns leave. The notice above still compares the
  // viewport against the UNWIDENED model width, so filling can never call a
  // table "wider than your screen". Measured width is 0 until laid out; the
  // defaults hold then.
  const [frameRef, frameWidth] = useMeasuredValue<HTMLDivElement>(
    (element) => element.clientWidth,
  );
  const pinnedWidth = lead.reduce(
    (total, column) => total + (column.pinned ? column.width : 0),
    0,
  );
  const periodCells = columnGroups.length * subColumns.length;
  const fillWidth =
    frameWidth > 0 && periodCells > 0 ? Math.floor((frameWidth - pinnedWidth) / periodCells) : 0;
  const sized = useMemo(
    () => subColumns.map((column) => ({ ...column, width: Math.max(column.width, fillWidth) })),
    [subColumns, fillWidth],
  );
  /** The id heading one identity column. The first keeps the name it shipped with. */
  const leadHeaderId = (index: number) =>
    index === 0 ? ids.rowLabelHeader : ids.leadHeader(lead[index].key);

  // Every row of every section, always. A section row is a label over the rows
  // beneath it, so there is nothing for the reader to open or close.
  const visible = useMemo(() => visibleRows(rows, allExpandableIds(rows)), [rows]);
  const { scrollRef, firstRowRef, onScroll, rowsInView } = useRowWindow(
    visible.length,
    maxBodyHeight,
  );
  const onScreen = visible.slice(rowsInView.first, rowsInView.last);
  /** Every column, for a spacer row to span. */
  const columnCount = lead.length + columnGroups.length * subColumns.length;

  // The width this table NEEDS — computed from the column model, never
  // measured. It sizes the table below and it is what the narrow-viewport
  // notice compares the viewport against, which is why that notice lives here
  // rather than on the page: this is the only place the number exists.
  const minWidth = tableMinWidth(columnGroups.length, subColumns, leadWidth);
  /** The width the table is DRAWN at: the model width, plus the fill. */
  const drawnMinWidth = tableMinWidth(columnGroups.length, sized, leadWidth);

  return (
    <Box sx={fill ? { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" } : undefined}>
      {/* Above the table it describes, and only ever beside a real one — a page
          that mounted this itself would show it over a loading skeleton, an
          error and an empty state too, none of which is a table wider than the
          screen. */}
      {/* Inside the grid card, between its head and its body, so the card reads
          as one piece. Square corners, no gap. */}
      <WideTableNotice
        tableMinWidth={minWidth}
        sx={{ mb: 0, borderRadius: 0, borderLeft: 1, borderRight: 1, borderColor: "divider" }}
      />
      <Box
        ref={frameRef}
        sx={[
          gridFrameSx,
          fill ? { flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" } : {},
        ]}
      >
        <Box
          ref={scrollRef}
          onScroll={onScroll}
          // A wide table scrolls inside this box. Keyboard users can only
          // scroll a region they can focus, so it is in the tab order and named.
          tabIndex={0}
          role="region"
          aria-label={label}
          sx={{ overflow: "auto", position: "relative", ...(fill ? { flex: 1, minWidth: 0, minHeight: 0 } : {}) }}
          style={fill ? undefined : { maxHeight: maxBodyHeight }}
        >
          <ListingTable
            density="compact"
            stickyHeader
            aria-label={label}
            // `minWidth` is computed from the Periods on screen, so it is an
            // inline style rather than an sx value: a style that changes with the
            // data would otherwise mint an emotion class per column count. The
            // same rule holds for every measured or derived value below.
            style={{ minWidth: drawnMinWidth }}
            sx={{
              // stickyHeader forces this anyway. Stated so that the per-cell
              // borders throughout read as deliberate rather than as inherited
              // luck — under `separate` the collapsed shorthand does nothing.
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <ListingTable.Head>
              {/* ROW 1 — the row-label column, then one cell per Period. */}
              <ListingTable.Row ref={periodRowRef}>
                {lead.map((column, index) => (
                  <ListingTable.Cell
                    key={column.key}
                    id={leadHeaderId(index)}
                    // Spans both header rows when there IS a second one. The
                    // drill-down dialog is all identity columns and no Periods,
                    // and a rowSpan over a row that does not exist is a lie the
                    // table algorithm has to resolve on its own.
                    rowSpan={columnGroups.length && subColumns.length && !singleHeaderRow ? 2 : 1}
                    scope="col"
                    style={{ width: column.width, minWidth: column.width }}
                    sx={[leadHeadCellSx(leadOffsets[index])]}
                  >
                    {column.label}
                  </ListingTable.Cell>
                ))}
                {columnGroups.map((group) => (
                  <ListingTable.Cell
                    key={group.key}
                    id={ids.groupHeader(group.key)}
                    colSpan={subColumns.length}
                    scope="colgroup"
                    sx={[
                      headCellSx,
                      {
                        top: 0,
                        zIndex: Z.header,
                        // A lone Period label sits right-aligned over its one
                        // figure; a label over several sub-columns is centred.
                        textAlign: subColumns.length > 1 ? "center" : "right",
                      },
                    ]}
                  >
                    {group.label}
                  </ListingTable.Cell>
                ))}
              </ListingTable.Row>

              {/* ROW 2 — held below row 1 by the measured offset, not by MUI.
                  Absent entirely when there are no figure cells to head, which is
                  the drill-down dialog's flat list of identity columns: an empty
                  header row is a row a screen reader still counts. Both lists are
                  tested, not just `subColumns` — row 2's cells are the product of
                  the two, so either being empty leaves it blank. */}
              {columnGroups.length > 0 && subColumns.length > 0 && (
              <ListingTable.Row sx={singleHeaderRow ? { display: "none" } : undefined}>
                {columnGroups.map((group) =>
                  sized.map((subColumn) => (
                    <ListingTable.Cell
                      key={`${group.key}:${subColumn.key}`}
                      id={ids.subHeader(group.key, subColumn.key)}
                      scope="col"
                      style={{
                        top: periodRowHeight,
                        width: subColumn.width,
                        minWidth: subColumn.width,
                      }}
                      sx={[
                        headCellSx,
                        // A sub-column header ("Total", "API Platform BU") is
                        // centred under its Period, in the same text as the
                        // Period itself.
                        { zIndex: Z.header, textAlign: "center" },
                        grandTotalSx(subColumn.key),
                      ]}
                    >
                      {subColumn.label}
                    </ListingTable.Cell>
                  )),
                )}
              </ListingTable.Row>
              )}
            </ListingTable.Head>

            <ListingTable.Body>
              {/* The rows above the window, as height rather than as rows, so the
                  scrollbar still describes the whole table. `aria-hidden` because
                  it holds space and says nothing: a screen reader counting rows
                  should count the ones carrying figures. */}
              <RowSpacer height={rowsInView.topPad} columnCount={columnCount} />
              {onScreen.map(({ row, depth, expandable }, index) => (
                <ListingTable.Row
                  key={row.id}
                  // One row is measured, and every other is assumed to match it.
                  // They do: the label cannot wrap (`nowrap`), every figure is
                  // one line and every row is the same text at the same padding.
                  ref={index === 0 ? firstRowRef : undefined}
                  sx={[
                    rowSx({
                      emphasis: row.emphasis,
                      // A bold row is weight alone: no fill under it, and no
                      // rule above Ending ARR — `row.ruleAbove` is not drawn.
                      emphasisFill: false,
                      emphasisWeight: emphasisStyle?.fontWeight ?? 600,
                    }),
                    // A section band naming the metric group under it (ARR
                    // movement, Customers, …). It does not react to the pointer.
                    depth === 0 && expandable ? sectionRowSx : {},
                  ]}
                >
                  <ListingTable.Cell
                    component="th"
                    scope="row"
                    id={ids.rowHeader(row.id)}
                    style={{
                      width: lead[0].width,
                      minWidth: lead[0].width,
                      maxWidth: lead[0].width,
                    }}
                    sx={[leadCellSx(leadOffsets[0])]}
                  >
                    {/* No indent under a section and no control on a section
                        row: every label, band or line, shares the column's left
                        inset. */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Typography
                        component="span"
                        sx={[
                          {
                            fontSize: "inherit",
                            fontWeight: "inherit",
                            lineHeight: "inherit",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "inherit",
                          },
                          depth === 0 && expandable ? SECTION_LABEL_SX : {},
                        ]}
                      >
                        {row.label}
                      </Typography>
                    </Box>
                  </ListingTable.Cell>

                  {/* The identity columns after the name. Ordinary cells, not row
                      headers: an Account ID is a fact ABOUT the row, not a second
                      name for it, so a screen reader should hear it as a value
                      under its own column and not as part of the row's name. */}
                  {lead.slice(1).map((column, offsetIndex) => {
                    const index = offsetIndex + 1;
                    // Asked once: the title and the text are the same value.
                    const text = leadCell?.(row, column) ?? "";
                    return (
                      <ListingTable.Cell
                        key={column.key}
                        headers={`${ids.rowHeader(row.id)} ${ids.leadHeader(column.key)}`}
                        style={{
                          width: column.width,
                          minWidth: column.width,
                          maxWidth: column.width,
                        }}
                        sx={[leadCellSx(leadOffsets[index])]}
                      >
                        {/* The full value on the cell itself. Identity columns
                            truncate — every row is one line, because the row
                            window measures one and assumes the rest match — so a
                            long value would otherwise be readable only as the
                            fragment that happens to fit. */}
                        <Typography
                          component="span"
                          title={text}
                          sx={{
                            fontSize: "inherit",
                            fontWeight: "inherit",
                            lineHeight: "inherit",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "block",
                          }}
                        >
                          {text}
                        </Typography>
                      </ListingTable.Cell>
                    );
                  })}

                  {columnGroups.map((group) =>
                    sized.map((subColumn) => {
                      const figure = cell(row, group, subColumn);
                      return (
                        <ListingTable.Cell
                          key={`${group.key}:${subColumn.key}`}
                          headers={ids.cellHeaders(row.id, group.key, subColumn.key)}
                          style={{ width: subColumn.width, minWidth: subColumn.width }}
                          // No rule between figures — only the pinned column's
                          // and the header's. A negative carries its sign and
                          // nothing else: no `error.main`.
                          sx={[
                            NUMERIC_CELL_SX,
                            figure.muted ? { color: "grey.500" } : {},
                            grandTotalSx(subColumn.key),
                          ]}
                        >
                          {figure.onActivate ? (
                            // A real button inside the cell, not a click handler
                            // on the cell. A `<td onClick>` is invisible to the
                            // keyboard and announces nothing, and a drill-down
                            // only a mouse can reach is one half the readers of a
                            // finance report cannot use. Inside rather than
                            // instead, so the cell keeps its `headers` wiring.
                            <ButtonBase
                              onClick={figure.onActivate}
                              // A blank figure is still a control when it opens
                              // something. With no text, the button has no name.
                              aria-label={
                                figure.text.trim()
                                  ? undefined
                                  : `View details for ${row.label}, ${group.label}, ${subColumn.label}`
                              }
                              sx={{
                                font: "inherit",
                                color: "inherit",
                                // Nothing at rest: a figure that opens shows its
                                // underline only to a pointer or the keyboard, so
                                // a column of numbers still reads as a column.
                                textDecoration: "none",
                                textDecorationStyle: "dotted",
                                textUnderlineOffset: 3,
                                borderRadius: 0.5,
                                px: 0.25,
                                // The figure stays where an unopenable one sits,
                                // so a column of numbers still reads as a column.
                                justifyContent: "flex-end",
                                width: "100%",
                                "&:hover, &.Mui-focusVisible": { textDecoration: "underline" },
                              }}
                            >
                              {figure.text}
                            </ButtonBase>
                          ) : (
                            figure.text
                          )}
                        </ListingTable.Cell>
                      );
                    }),
                  )}
                </ListingTable.Row>
              ))}
              <RowSpacer height={rowsInView.bottomPad} columnCount={columnCount} />
            </ListingTable.Body>
          </ListingTable>
        </Box>
      </Box>
    </Box>
  );
}

/** The space rows outside the window would have taken, as one empty row. */
function RowSpacer({ height, columnCount }: { height: number; columnCount: number }) {
  if (height <= 0) return null;
  return (
    <ListingTable.Row aria-hidden>
      {/* Inline, not sx: the height is derived from the data, and every cell in
          this table otherwise carries a bottom border that would draw a line
          across the padding. The table's density pads every cell through a
          rule that outranks a cell's own sx, so the padding is zeroed inline
          as well — the height must be the spacer's whole height. */}
      <ListingTable.Cell colSpan={columnCount} style={{ height, padding: 0, border: "none" }} />
    </ListingTable.Row>
  );
}

/** A row's height before anything has been laid out. Replaced by the measurement. */
const ESTIMATED_ROW_HEIGHT = 25;

/**
 * An element's laid-out height, fractions kept.
 *
 * `getBoundingClientRect` rather than `offsetHeight` because both callers care
 * about the fraction: the header offset is a `top` a hairline gap or an overlap
 * either side of correct, and a row height rounded down accumulates across
 * thousands of rows into a scrollbar that disagrees with the content.
 */
const measuredHeight = (element: HTMLElement) => element.getBoundingClientRect().height;

/**
 * A number measured off an element, kept current as the page moves.
 *
 * Both things this table has to measure — the first header row's height and the
 * body's own — were being measured by the same twelve lines, and
 * `useFillHeight.ts` has a third copy. They are gathered here rather than there
 * because that hook measures a DIFFERENT element from the one it is given (the
 * nearest scrolling ancestor), so folding it in would change a shipped hook to
 * remove a repetition it is not really part of. Worth doing; not worth doing
 * inside this ticket.
 *
 * `ResizeObserver` is the right instrument and is absent under jsdom, so it is
 * optional: the mount measurement, the resize listener and `watch` still give
 * the right answer without it.
 *
 * Returns 0 until something has actually been laid out, which is what jsdom
 * reports forever. Callers decide what to do about that; none of them should
 * divide by it.
 */
function useMeasuredValue<T extends HTMLElement>(
  measure: (element: T) => number,
  { enabled = true, watch }: { enabled?: boolean; watch?: unknown } = {},
) {
  const ref = useRef<T>(null);
  const [value, setValue] = useState(0);
  // The caller's closure is rebuilt every render; the listeners are not. Held
  // in a ref so the effect depends on what actually decides it — and kept
  // current by an effect of its own rather than by an assignment during render,
  // which is not a render's job to do. `useMisScale` keeps the same shape for
  // the same reason. Declared first, so it has already run when the effect
  // below reads it on mount.
  const latest = useRef(measure);
  useLayoutEffect(() => {
    latest.current = measure;
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const run = () => setValue(latest.current(element));
    run();
    window.addEventListener("resize", run);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(run);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", run);
      observer?.disconnect();
    };
  }, [enabled, watch]);

  return [ref, value] as const;
}

/**
 * Which rows to put in the document.
 *
 * Required scope of hand-rolling, not a caveat: a hand-rolled
 * `<table>` has no virtualization, and the per-customer Builds are hundreds of
 * customers per business unit. Rendering all of them is not slow in the way a
 * long list is slow — every row is `columnGroups × subColumns` cells, and every
 * cell is a call into the caller's formatter, so a 3,000-row Build at five
 * Periods asks 30,000 questions to show twenty lines. It does that again on
 * every hover, every refetch, and every time the measured header settles.
 *
 * ---- what is windowed, and what is not -------------------------------------
 *
 * Only the rows. The table, the two header rows and the pinned column are
 * untouched, and that is the whole design: the rows stay real `<tr>`s in a real
 * `<tbody>`, so the table algorithm still sizes the columns across header and
 * body, `position: sticky` still works on the label column, and the
 * `id`/`headers` wiring still resolves. What replaces the rows outside the
 * window is two empty rows carrying their height.
 *
 * `react-window` is a dependency here and cannot do this — see `rowWindow`.
 * It was tried first.
 *
 * Below `ROW_WINDOW_THRESHOLD` none of this runs and the table renders exactly
 * what it rendered before. The Subscription Build is 34 rows and takes that
 * path.
 */
function useRowWindow(total: number, maxBodyHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const windowed = total > ROW_WINDOW_THRESHOLD;

  // Neither measurement runs below the threshold: a 34-row Build should not pay
  // a layout read, two listeners and a re-render for a mechanism it will never
  // use. `watch: total` re-measures when the rows change, because the row the
  // height was taken from may no longer be there.
  const [scrollRef, viewportHeight] = useMeasuredValue<HTMLDivElement>(
    (element) => element.clientHeight,
    { enabled: windowed, watch: total },
  );
  const [firstRowRef, measuredRowHeight] = useMeasuredValue<HTMLTableRowElement>(measuredHeight, {
    enabled: windowed,
    watch: total,
  });
  // Zero is jsdom, or a paint that has not happened yet. The estimate is a far
  // better answer than rendering every row once and windowing on the next
  // pass — and it means `rowHeight` is never zero, whatever the DOM says.
  const rowHeight = measuredRowHeight || ESTIMATED_ROW_HEIGHT;

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop;
    // Only when the window would actually move. A scroll event fires per frame;
    // re-rendering for a change of three pixels re-asks the caller for every
    // figure on screen to produce identical markup.
    setScrollTop((previous) =>
      Math.floor(previous / rowHeight) === Math.floor(next / rowHeight) ? previous : next,
    );
  };

  if (!windowed) {
    return {
      scrollRef,
      firstRowRef,
      onScroll: undefined,
      rowsInView: { first: 0, last: total, topPad: 0, bottomPad: 0 },
    };
  }

  return {
    scrollRef,
    firstRowRef,
    onScroll,
    rowsInView: rowWindow({
      total,
      scrollTop,
      // The container has no laid-out height on the first paint, and none at
      // all under jsdom. `maxBodyHeight` is what it will settle at, so it is
      // the right guess rather than a fallback — and it errs long, which costs
      // a few extra rows rather than leaving a gap at the bottom of the view.
      viewportHeight: viewportHeight || maxBodyHeight,
      rowHeight,
    }),
  };
}

/**
 * How tall the first header row is, measured.
 *
 * THE two-row-header problem, in one hook. `stickyHeader` pins every header
 * cell to `top: 0` — verified in @mui/material 7.3.4, `TableCell.js:145-151`,
 * where the offset is not configurable — so with two header rows the second
 * lands on top of the first and the Period labels disappear behind the Amount /
 * % Open pair that belongs to them. Row 2 needs `top: <height of row 1>`, MUI
 * offers no API for it, and there is no column-group primitive in the package
 * either.
 *
 * A constant would be wrong the first time anything moved: the density, the
 * font, a Period label long enough to wrap, or a reader at anything other than
 * 100% zoom, where the true height is fractional and rounding it leaves either
 * a hairline gap or an overlap. So it is measured, and used as measured.
 *
 * The measuring itself is `useMeasuredValue`'s, which is where the
 * `ResizeObserver`-under-jsdom reasoning now lives; this hook is the question
 * asked of it, and the paragraphs above are why the question has to be asked at
 * all rather than answered with a constant.
 *
 * The height is state, so settling it re-renders the table — once on mount, and
 * again whenever the header row genuinely changes size. That is bounded, and it
 * is why the windowing below is measured in RENDERS rather than in rows: every
 * such render asks the `cell` function for every figure on screen again, and
 * before windowing existed that meant every figure in the Build.
 */
const useHeaderRowHeight = () => useMeasuredValue<HTMLTableRowElement>(measuredHeight);

// The prop types, re-exported: a screen describing a Build should not have to
// reach past this component into the module behind it.
export type { BuildColumnGroup, BuildRow, BuildSubColumn };
