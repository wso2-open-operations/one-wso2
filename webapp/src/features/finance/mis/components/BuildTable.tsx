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

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@wso2/oxygen-ui";
import { ChevronDown, ChevronRight } from "@wso2/oxygen-ui-icons-react";
import {
  ROW_WINDOW_THRESHOLD,
  buildTableIds,
  rowWindow,
  tableMinWidth,
  visibleRows,
  type BuildColumnGroup,
  type BuildRow,
  type BuildSubColumn,
} from "./buildTableModel";
import {
  groupEdgeSx,
  rowSx,
  HEAD_CELL_SX,
  MAX_BODY_HEIGHT,
  NUMERIC_CELL_SX,
  ROW_LABEL_CELL_SX,
  ROW_LABEL_WIDTH,
  Z,
} from "./buildTableSx";

// The table every Build screen and the Flash P&L render through.
//
// A Build reads down — an Opening balance, the movements that change it, a
// Closing balance — and across, one column group per Period. Four things have
// to be true at once, and it is the combination rather than any one of them
// that decided this is hand-rolled rather than a data grid (ADR 0004):
//
//   1. the row-label column stays put while two dozen numeric columns scroll
//   2. the header stays put while the rows scroll under it
//   3. the header is TWO rows — a Period above its Amount / % Open pair
//   4. sections collapse, three levels deep
//
// (3) is the one with no precedent anywhere in this repo and no help from MUI.
// See `useHeaderRowHeight` below.
//
// What this component does NOT do, deliberately: no formatting (injected, so
// the Scale rule stays in one place — ticket 05), no fetching, no drill-down
// (ticket 10).
//
// It DOES window its rows above `ROW_WINDOW_THRESHOLD` — see `useRowWindow`.

/** One figure, as the caller wants it read. */
export interface BuildCell {
  /**
   * Already formatted. The Build shows currency, counts and percentages in the
   * same column, and only currency is scaled — so the row's own formatter
   * decides, not this table. See spec §3.
   */
  text: string;
  /** Shown in the negative tone: a Reduction, a Lost, a fall. */
  negative?: boolean;
  /** A subordinate figure, such as the percentage beside its amount. */
  muted?: boolean;
}

export type BuildCellFor = (
  row: BuildRow,
  group: BuildColumnGroup,
  subColumn: BuildSubColumn,
) => BuildCell;

export interface BuildTableProps {
  /** The table's accessible name. */
  label: string;
  /** Header over the pinned row-label column. */
  rowLabelHeader: string;
  /** One per Period, in display order. */
  columnGroups: readonly BuildColumnGroup[];
  /** Repeated under every Period — Amount, % of Opening. */
  subColumns: readonly BuildSubColumn[];
  rows: readonly BuildRow[];
  cell: BuildCellFor;
  /**
   * Sections open on first render. Everything else starts closed, so a Build
   * opens as the summary it is meant to be rather than as every customer line
   * at once.
   */
  defaultExpandedIds?: readonly string[];
  rowLabelWidth?: number;
  maxBodyHeight?: number;
}

export default function BuildTable({
  label,
  rowLabelHeader,
  columnGroups,
  subColumns,
  rows,
  cell,
  defaultExpandedIds,
  rowLabelWidth = ROW_LABEL_WIDTH,
  maxBodyHeight = MAX_BODY_HEIGHT,
}: BuildTableProps) {
  const theme = useTheme();
  const ids = buildTableIds(useId());
  const [periodRowRef, periodRowHeight] = useHeaderRowHeight();

  // Seeded once. The reader's open sections must survive a refetch and a change
  // of Period — flipping Annually to Quarterly must not silently reopen a tree
  // they had closed, and ids are stable across both because they are keyed by
  // what the row IS rather than by where it sits.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(defaultExpandedIds ?? []),
  );
  const visible = useMemo(() => visibleRows(rows, expandedIds), [rows, expandedIds]);
  const { scrollRef, firstRowRef, onScroll, rowsInView } = useRowWindow(
    visible.length,
    maxBodyHeight,
  );
  const onScreen = visible.slice(rowsInView.first, rowsInView.last);
  /** Every column, for a spacer row to span. */
  const columnCount = 1 + columnGroups.length * subColumns.length;

  const toggle = (id: string) =>
    setExpandedIds((open) => {
      const next = new Set(open);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const tint = theme.palette.action.hover;
  const minWidth = tableMinWidth(columnGroups.length, subColumns, rowLabelWidth);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "hidden",
        backgroundColor: "background.paper",
      }}
    >
      <Box
        ref={scrollRef}
        onScroll={onScroll}
        sx={{ overflow: "auto", position: "relative" }}
        style={{ maxHeight: maxBodyHeight }}
      >
        <Table
          size="small"
          stickyHeader
          aria-label={label}
          // `minWidth` is computed from the Periods on screen, so it is an
          // inline style rather than an sx value: a style that changes with the
          // data would otherwise mint an emotion class per column count. The
          // same rule holds for every measured or derived value below.
          style={{ minWidth }}
          sx={{
            // stickyHeader forces this anyway. Stated so that the per-cell
            // borders throughout read as deliberate rather than as inherited
            // luck — under `separate` the collapsed shorthand does nothing.
            borderCollapse: "separate",
            borderSpacing: 0,
          }}
        >
          <TableHead>
            {/* ROW 1 — the row-label column, then one cell per Period. */}
            <TableRow ref={periodRowRef}>
              <TableCell
                id={ids.rowLabelHeader}
                rowSpan={2}
                scope="col"
                style={{ width: rowLabelWidth, minWidth: rowLabelWidth }}
                sx={{
                  ...HEAD_CELL_SX,
                  top: 0,
                  left: 0,
                  // Sticky on both axes, so it has to outrank the Period
                  // headers it scrolls under AND the row labels it scrolls over.
                  zIndex: Z.headerCorner,
                  textAlign: "left",
                  color: "text.primary",
                  borderRight: 1,
                }}
              >
                {rowLabelHeader}
              </TableCell>
              {columnGroups.map((group, groupIndex) => (
                <TableCell
                  key={group.key}
                  id={ids.groupHeader(group.key)}
                  colSpan={subColumns.length}
                  scope="colgroup"
                  sx={{
                    ...HEAD_CELL_SX,
                    top: 0,
                    zIndex: Z.header,
                    textAlign: "center",
                    color: "text.primary",
                    ...groupEdgeSx(groupIndex),
                  }}
                >
                  {group.label}
                </TableCell>
              ))}
            </TableRow>

            {/* ROW 2 — held below row 1 by the measured offset, not by MUI. */}
            <TableRow>
              {columnGroups.map((group, groupIndex) =>
                subColumns.map((subColumn, subIndex) => (
                  <TableCell
                    key={`${group.key}:${subColumn.key}`}
                    id={ids.subHeader(group.key, subColumn.key)}
                    scope="col"
                    style={{
                      top: periodRowHeight,
                      width: subColumn.width,
                      minWidth: subColumn.width,
                    }}
                    sx={{
                      ...HEAD_CELL_SX,
                      zIndex: Z.header,
                      textAlign: "right",
                      fontSize: 10,
                      ...(subIndex === 0 ? groupEdgeSx(groupIndex) : {}),
                    }}
                  >
                    {subColumn.label}
                  </TableCell>
                )),
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {/* The rows above the window, as height rather than as rows, so the
                scrollbar still describes the whole table. `aria-hidden` because
                it holds space and says nothing: a screen reader counting rows
                should count the ones carrying figures. */}
            <RowSpacer height={rowsInView.topPad} columnCount={columnCount} />
            {onScreen.map(({ row, depth, expandable, expanded }, index) => (
              <TableRow
                key={row.id}
                // One row is measured, and every other is assumed to match it.
                // They do: the label cannot wrap (`nowrap`) and every figure is
                // one line, so the only variation is the 2px rule above a total.
                ref={index === 0 ? firstRowRef : undefined}
                sx={rowSx({ emphasis: row.emphasis, ruleAbove: row.ruleAbove, tint })}
              >
                <TableCell
                  component="th"
                  scope="row"
                  id={ids.rowHeader(row.id)}
                  style={{ width: rowLabelWidth, minWidth: rowLabelWidth, maxWidth: rowLabelWidth }}
                  sx={ROW_LABEL_CELL_SX}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} style={{ paddingLeft: depth * 18 }}>
                    {expandable ? (
                      <IconButton
                        size="small"
                        onClick={() => toggle(row.id)}
                        aria-expanded={expanded}
                        aria-label={row.label}
                        sx={{ p: 0.2, color: "text.secondary" }}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </IconButton>
                    ) : (
                      // Keeps a leaf's label on the same left edge as its siblings'.
                      <Box aria-hidden sx={{ width: 19, flexShrink: 0 }} />
                    )}
                    <Typography
                      component="span"
                      sx={{
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: depth >= 2 ? "text.secondary" : "text.primary",
                      }}
                    >
                      {row.label}
                    </Typography>
                  </Box>
                </TableCell>

                {columnGroups.map((group, groupIndex) =>
                  subColumns.map((subColumn, subIndex) => {
                    const figure = cell(row, group, subColumn);
                    return (
                      <TableCell
                        key={`${group.key}:${subColumn.key}`}
                        headers={ids.cellHeaders(row.id, group.key, subColumn.key)}
                        style={{ width: subColumn.width, minWidth: subColumn.width }}
                        sx={{
                          ...NUMERIC_CELL_SX,
                          ...(subIndex === 0 ? groupEdgeSx(groupIndex) : {}),
                          ...(figure.negative
                            ? { color: "error.main" }
                            : figure.muted
                              ? { color: "text.secondary" }
                              : {}),
                        }}
                      >
                        {figure.text}
                      </TableCell>
                    );
                  }),
                )}
              </TableRow>
            ))}
            <RowSpacer height={rowsInView.bottomPad} columnCount={columnCount} />
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

/** The space rows outside the window would have taken, as one empty row. */
function RowSpacer({ height, columnCount }: { height: number; columnCount: number }) {
  if (height <= 0) return null;
  return (
    <TableRow aria-hidden>
      {/* Inline, not sx: the height is derived from the data, and every cell in
          this table otherwise carries a bottom border that would draw a line
          across the padding. */}
      <TableCell colSpan={columnCount} style={{ height, padding: 0, border: "none" }} />
    </TableRow>
  );
}

/** A row's height before anything has been laid out. Replaced by the measurement. */
const ESTIMATED_ROW_HEIGHT = 25;

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
 * ADR 0004 named this as required scope rather than a caveat: a hand-rolled
 * `<table>` has no virtualization, and the per-customer Builds are hundreds of
 * customers per business unit. Rendering all of them is not slow in the way a
 * long list is slow — every row is `columnGroups × subColumns` cells, and every
 * cell is a call into the caller's formatter, so a 3,000-row Build at five
 * Periods asks 30,000 questions to show twenty lines. It does that again on
 * every hover, every toggle, and every time the measured header settles.
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
 * `react-window` is a dependency here and cannot do this — see `rowWindow` for
 * the primary source. Ticket 07 asked for it to be tried first; it was.
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
  const [firstRowRef, measuredRowHeight] = useMeasuredValue<HTMLTableRowElement>(
    (element) => element.getBoundingClientRect().height,
    { enabled: windowed, watch: total },
  );
  // Zero is jsdom, or a paint that has not happened yet. The estimate is a far
  // better answer than rendering every row once and windowing on the next
  // pass — and it means `rowHeight` is never zero, whatever the DOM says.
  const rowHeight = measuredRowHeight || ESTIMATED_ROW_HEIGHT;

  const onScroll = (event: { currentTarget: HTMLElement }) => {
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
 * `ResizeObserver` is the right instrument and is absent under jsdom, so it is
 * optional here exactly as in `useFillHeight`: the mount measurement and the
 * resize listener still give the right answer without it.
 *
 * The height is state, so settling it re-renders the table — once on mount, and
 * again whenever the header row genuinely changes size. That is bounded and
 * cheap today, and it is worth knowing before ticket 07: every such render asks
 * the `cell` function for every figure on screen again, which at 12 Periods and
 * several thousand rows is the cost windowing exists to remove.
 */
const useHeaderRowHeight = () =>
  useMeasuredValue<HTMLTableRowElement>((element) => element.getBoundingClientRect().height);

// The prop types, re-exported: a screen describing a Build should not have to
// reach past this component into the module behind it.
export type { BuildColumnGroup, BuildRow, BuildSubColumn };
