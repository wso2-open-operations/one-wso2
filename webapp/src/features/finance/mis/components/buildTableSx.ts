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

// The Build table's style decisions, as data.
//
// They live here rather than inline for the reason `financeGridSx.ts` already
// records: jsdom does not resolve an emotion-injected rule through
// `getComputedStyle`, so a rendered assertion about a `:hover` or a sticky
// offset passes just as happily with the rule deleted. ADR 0004 lists three
// mechanisms this table has to own forever and none of them is decorative, so
// each one is a value a test can hold still — and `BuildTable.test.tsx` also
// checks that the component uses them, because a constant nothing reads is
// worth nothing.
//
// ---- why any of this is hand-rolled at all --------------------------------
//
// ADR 0004: the community `@mui/x-data-grid` this app ships cannot express a
// Build — no column pinning, no row grouping, `pageSize` throws above 100. So
// the table is a plain `<Table>`, and these are the pieces MUI then declines to
// provide.

/** How wide the pinned row-label column is. Long customer names ellipsis inside it. */
export const ROW_LABEL_WIDTH = 288;

/** How tall the body grows before it scrolls under the header. */
export const MAX_BODY_HEIGHT = 560;

/**
 * The stacking order, top to bottom.
 *
 * Two sticky axes cross in this table, and the cell where they meet — the
 * row-label column's header — has to outrank both of them or it is painted over
 * by whichever it loses to.
 */
export const Z = {
  /** The row-label header: sticky on both axes, so above everything. */
  headerCorner: 5,
  /** The Period and sub-column headers: above the body scrolling under them. */
  header: 3,
  /** Body row labels: above the Period columns scrolling past, below the header. */
  rowLabel: 2,
} as const;

/**
 * An opaque tint.
 *
 * A translucent `backgroundColor` is fine on an ordinary cell and wrong on a
 * sticky one: the columns scrolling behind a pinned cell show straight through
 * it, and the frozen pane reads as a smear over the data rather than as a pane.
 * Painting the tint as a one-colour gradient over an opaque base composites it
 * inside the cell instead. The same trick, for the same reason, as
 * `AttendeeGrid`'s `tinted`.
 */
export const opaqueTint = (tint: string) => ({
  backgroundColor: "background.paper",
  backgroundImage: `linear-gradient(${tint}, ${tint})`,
});

/**
 * The selector the row highlight is painted through.
 *
 * `<TableRow hover>` cannot be used here, and this is the whole reason: it
 * tints the `<tr>`, which sits BEHIND the pinned cell's own opaque background,
 * so the highlight runs across the scrolling columns and then stops dead at the
 * frozen column — precisely at the row label that says which row is being
 * highlighted.
 *
 * So the tint is painted per cell. `th` as well as `td`, because the row label
 * is a `<th scope="row">`: a selector of `> td` alone would leave out the one
 * cell the reader is looking at.
 */
export const HOVER_CELLS = "&:hover > th, &:hover > td";

/** Every cell of the row under the pointer, pinned label included. */
export const hoverSx = (tint: string) => ({
  [HOVER_CELLS]: opaqueTint(tint),
});

/**
 * A balance line — Opening, Closing, a Gross Profit.
 *
 * Emphasised on every cell rather than on the row, for the same reason as the
 * hover: a weight or a fill set on the `<tr>` does not reach through the pinned
 * cell's opaque background.
 */
export const EMPHASIS_CELLS = "& > th, & > td";

export const emphasisSx = (tint: string) => ({
  [EMPHASIS_CELLS]: { fontWeight: 700, ...opaqueTint(tint) },
});

/** The rule an accountant draws above a total. */
export const RULE_ABOVE_SX = {
  [EMPHASIS_CELLS]: { borderTop: "2px solid", borderTopColor: "text.secondary" },
} as const;

/**
 * Shared by every cell in the table.
 *
 * `stickyHeader` forces `border-collapse: separate`, under which the collapsed
 * border shorthand does nothing at all — so every border in this table is
 * placed on a cell, deliberately, and the ones that look like they should be on
 * the table or the row are not available.
 */
const cellBase = {
  whiteSpace: "nowrap",
  borderBottom: 1,
  borderColor: "divider",
  // Opaque, not translucent: rows scroll underneath the header and the Period
  // columns scroll behind the row labels.
  backgroundColor: "background.paper",
} as const;

/** A header cell, in either of the two header rows. */
export const HEAD_CELL_SX = {
  ...cellBase,
  position: "sticky",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  lineHeight: 1.3,
  py: 0.5,
  px: 1.25,
  color: "text.secondary",
} as const;

/** A figure. Tabular numerals so digits line up down a column. */
export const NUMERIC_CELL_SX = {
  ...cellBase,
  fontSize: 12.5,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
  py: 0.3,
  px: 1.25,
} as const;

/** The pinned row-label column. Sticky on the horizontal axis only. */
export const ROW_LABEL_CELL_SX = {
  ...cellBase,
  position: "sticky",
  left: 0,
  zIndex: Z.rowLabel,
  fontSize: 12.5,
  fontWeight: 400,
  textAlign: "left",
  py: 0.15,
  px: 1,
  borderRight: 1,
} as const;

/**
 * The hairline between two Periods, on the first sub-column of each.
 *
 * Skipped on the first Period so it does not double against the pinned
 * column's own right edge — under `border-collapse: separate` two adjacent
 * borders are drawn twice rather than merged.
 */
export const groupEdgeSx = (groupIndex: number) =>
  groupIndex > 0 ? { borderLeft: 1, borderLeftColor: "divider" } : {};
