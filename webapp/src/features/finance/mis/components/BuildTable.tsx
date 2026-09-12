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
  buildTableIds,
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
// the Scale rule stays in one place — ticket 05), no fetching, no windowing
// (ticket 07), no drill-down (ticket 10).

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
      <Box sx={{ overflow: "auto", position: "relative" }} style={{ maxHeight: maxBodyHeight }}>
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
            {visible.map(({ row, depth, expandable, expanded }) => (
              <TableRow
                key={row.id}
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
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
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
function useHeaderRowHeight() {
  const ref = useRef<HTMLTableRowElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    window.addEventListener("resize", measure);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  return [ref, height] as const;
}

// The prop types, re-exported: a screen describing a Build should not have to
// reach past this component into the module behind it.
export type { BuildColumnGroup, BuildRow, BuildSubColumn };
