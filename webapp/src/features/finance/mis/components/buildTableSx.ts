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
// offset passes just as happily with the rule deleted. Hand-rolling leaves three
// mechanisms this table has to own forever and none of them is decorative, so
// each one is a value a test can hold still — and `BuildTable.test.tsx` also
// checks that the component uses them, because a constant nothing reads is
// worth nothing.
//
// ---- why any of this is hand-rolled at all --------------------------------
//
// The community `@mui/x-data-grid` this app ships cannot express a
// Build — no column pinning, no row grouping, `pageSize` throws above 100. So
// the table is Oxygen's `ListingTable` — the same component as the rest of the
// app's tables, which is where its text size, weights, cell padding and head
// fill come from — and these are the pieces that component declines to
// provide: the frozen pane, the two-row header's offset, the opaque composites
// under anything sticky, and the per-cell row highlight.

import type { Theme } from "@mui/material/styles";
import { cssVar } from "./misLookTokens";

/** How wide the pinned row-label column is. Long customer names ellipsis inside it. */
export const ROW_LABEL_WIDTH = 288;

/**
 * How tall the body grows before it scrolls under the header. Tall enough for
 * a full Subscription Build to fit one screenshot.
 */
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
 * One or more tints, composited OPAQUELY.
 *
 * A translucent `backgroundColor` is fine on an ordinary cell and wrong on a
 * sticky one: the columns scrolling behind a pinned cell show straight through
 * it, and the frozen pane reads as a smear over the data rather than as a pane.
 * Painting each tint as a one-colour gradient over an opaque base composites it
 * inside the cell instead. The same trick, for the same reason, as
 * `AttendeeGrid`'s `tinted`.
 *
 * It takes several because they LAYER. A balance row already rests at one tint,
 * so highlighting it with that same tint again would repaint the identical
 * colour and change nothing — see `rowSx`.
 */
export const opaqueTint = (...tints: readonly string[]) => ({
  // Oxygen's `background.paper` is translucent, so a sticky cell painted with
  // it lets whatever scrolls behind it show through. `background-color` does
  // not save it: a sticky cell is composited from its background image, and a
  // translucent image over an opaque colour still reads as translucent there.
  // The opaque page colour is therefore the BOTTOM image layer, with paper and
  // any tint composited over it, so the stack itself has no transparency.
  backgroundColor: "background.default",
  backgroundImage: [
    ...tints,
    "var(--oxygen-palette-background-paper)",
    // Last, so it sits at the bottom: an opaque layer, not another tint.
    "var(--oxygen-palette-background-default)",
  ]
    .map((tint) => `linear-gradient(${tint}, ${tint})`)
    .join(", "),
});

/** The theme's row highlight, the one every other table in the app uses. */
const HOVER_TINT = cssVar("action-hover");

/**
 * The selector a row's resting treatment is painted through.
 *
 * Per cell, not on the `<tr>`, for the same reason as the hover below: neither
 * a weight nor a fill set on the row reaches through the pinned cell's own
 * opaque background.
 */
export const EMPHASIS_CELLS = "& > th, & > td";

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

/**
 * Everything one row's cells wear: its resting treatment and its highlight.
 *
 * ONE function rather than three objects the caller spreads together, because
 * spreading them cannot work. `EMPHASIS_CELLS` is a computed key, so two
 * objects that both carry it do not merge — the later one replaces the earlier
 * wholesale. A Closing balance is `emphasis` AND `ruleAbove`, so the rule
 * silently took the weight and the tint away from the one row a Build exists to
 * land on, and left it looking like any other line with a stroke above it.
 *
 * The highlight LAYERS over the resting tint rather than replacing it. A single
 * tint would be a no-op on a balance row, which already rests at exactly that
 * colour: the pointer would cross the row a reader most wants to track and
 * nothing would happen — and on a table two dozen columns wide that is not
 * fine.
 */
export const rowSx = ({
  emphasis,
  ruleAbove,
  tint = HOVER_TINT,
  emphasisFill = true,
  emphasisWeight = 600,
}: {
  emphasis?: boolean;
  ruleAbove?: boolean;
  /**
   * The hover fill. Also the resting fill of a balance row. Default: the
   * theme's `action.hover`, which is what every other table in the app
   * highlights with.
   */
  tint?: string;
  /**
   * Whether a balance row RESTS on the tint. The ARR Dashboard's bold rows are
   * weight alone — no fill — so `BuildTable` turns this off and keeps the
   * hover layer.
   */
  emphasisFill?: boolean;
  /**
   * The weight a balance row carries: a Build's bold rows are 600; the
   * Customers `Total` row and a Region Summary total are 700. The size is the
   * table's own, as it is in every other table in the app.
   */
  emphasisWeight?: number;
}) => {
  const resting = {
    ...(emphasis
      ? {
          fontWeight: emphasisWeight,
          ...(emphasisFill ? opaqueTint(tint) : {}),
        }
      : {}),
    /** The rule an accountant draws above a total. */
    ...(ruleAbove ? { borderTop: "2px solid", borderTopColor: "text.secondary" } : {}),
  };
  return {
    ...(Object.keys(resting).length > 0 ? { [EMPHASIS_CELLS]: resting } : {}),
    // Two layers on a row that already wears one, so the pointer always
    // deepens the row rather than repainting it. `:hover` outranks the resting
    // rule on specificity, so order here is not what decides it.
    [HOVER_CELLS]: emphasis && emphasisFill ? opaqueTint(tint, tint) : opaqueTint(tint),
  };
};

/**
 * Shared by every cell in the table.
 *
 * Text size, weight and padding are NOT here: they are the ListingTable's, at
 * its compact density, so the Build reads like every other table in the app.
 * What is here is what that component cannot know this table needs.
 *
 * `stickyHeader` forces `border-collapse: separate`, under which the collapsed
 * border shorthand does nothing at all — so every border in this table is
 * placed on a cell, deliberately, and the ones that look like they should be on
 * the table or the row are not available.
 */
const cellBase = {
  // A row is measured once and every other is assumed to match it, so no cell
  // may wrap.
  whiteSpace: "nowrap",
  borderBottom: 1,
  borderColor: "divider",
  // Opaque, not translucent: rows scroll underneath the header and the Period
  // columns scroll behind the row labels. See `opaqueTint` for why this is no
  // longer a bare `background.paper`.
  ...opaqueTint(),
} as const;

/**
 * The header fill, as one OPAQUE colour.
 *
 * Light is `grey.50`. Dark is a 6% white over the page colour, mixed into a
 * single colour so it has no alpha of its own. A translucent layer here is
 * what lets the rows scrolling underneath show through the sticky header.
 */
const HEAD_FILL = {
  light: cssVar("grey-50"),
  dark: "color-mix(in srgb, #fff 6%, var(--oxygen-palette-background-default))",
} as const;

/**
 * A fill a sticky cell cannot drop.
 *
 * The colour alone is not enough: once the cell sticks, its background is
 * composited without it and the rows scrolling underneath show through. Its
 * own layer (`translateZ`) keeps the background, and the cover behind the
 * label repaints the same colour inside that layer.
 */
const solidHead = (fill: string) => ({
  backgroundColor: fill,
  backgroundImage: "none",
  transform: "translateZ(0)",
  "&::before": {
    content: '""',
    position: "absolute",
    zIndex: -1,
    inset: 0,
    backgroundColor: fill,
  },
});

/**
 * A header cell, in either of the two header rows.
 *
 * Weight and padding are the ListingTable head's. Its own head rule paints a
 * translucent colour, so the fill here is a solid colour instead, on a
 * selector that outranks that rule. The borders ride on the same rule: a
 * ListingTable row strips the borders off the cells of a `last-child` row,
 * which is right under the body's final row and wrong under a header that
 * happens to be the only one — the drill-down's — and the frozen pane's rule
 * must not vanish with it.
 */
const headCell = (theme: Theme, edges: object = {}) => ({
  ...cellBase,
  position: "sticky" as const,
  zIndex: Z.header,
  "&&.MuiTableCell-head": {
    borderBottom: 1,
    borderColor: "divider",
    ...edges,
    ...solidHead(HEAD_FILL.light),
    ...theme.applyStyles("dark", solidHead(HEAD_FILL.dark)),
  },
});

export const headCellSx = (theme: Theme) => headCell(theme);

/** A figure. Tabular numerals so digits line up down a column. */
export const NUMERIC_CELL_SX = {
  ...cellBase,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
} as const;

/** The pinned row-label column. Sticky on the horizontal axis only. */
export const ROW_LABEL_CELL_SX = {
  ...cellBase,
  position: "sticky",
  left: 0,
  zIndex: Z.rowLabel,
  textAlign: "left",
  overflow: "hidden",
  textOverflow: "ellipsis",
  borderRight: 1,
  // The `borderRight` shorthand resets the side's colour to currentColor, so
  // without this the frozen column's rule paints white in dark.
  borderRightColor: "divider",
} as const;

/**
 * A section row — the band naming the metric group under it (ARR movement,
 * Customers, …).
 *
 * A label, not a fold: no chevron, no indent, and every row beneath it is
 * always on screen. It rests on `grey.50` in light and `action.hover` in dark,
 * composited opaquely because its first cell is the pinned one, and it does
 * not react to the pointer — the highlight is written again under `:hover` so
 * `rowSx`'s does not reach it. The band's height is the compact row's own; the
 * label sits centred in it.
 */
export const sectionRowSx = (theme: Theme) => {
  const band = {
    ...opaqueTint(cssVar("action-hover")),
    ...theme.applyStyles("light", opaqueTint(cssVar("grey-50"))),
  };
  return { [EMPHASIS_CELLS]: band, [HOVER_CELLS]: band };
};

/** The section row's label: small caps in the secondary tone, weight 600. */
export const SECTION_LABEL_SX = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.4px",
  textTransform: "uppercase",
  color: "text.secondary",
} as const;

/**
 * Where one identity cell sits horizontally.
 *
 * The hand-rolled frozen pane, widened from one column to a run of them: the
 * Subscription Build names a row with a movement, and the Software/Cloud
 * Customers table needs seventeen columns to say which account a row is. A
 * frozen cell must also be OPAQUE — a translucent one lets the figures moving
 * behind it show through, and the pane reads as a smear rather than as a pane —
 * which `cellBase` and `headCellSx` already supply.
 *
 * `undefined` means the column scrolls, and the two callers disagree about what
 * that implies, which is why the fallback is passed in rather than assumed: a
 * BODY cell goes back into the flow, while a HEADER cell must STAY
 * `position: sticky` or it loses the `top: 0` holding it under the vertical
 * scroll. Neither is `left: 0`, which would freeze the column on top of the one
 * that belongs at the left edge.
 */
const frozenAt = (offset: number | undefined, zIndex: number, whenScrolling: object) =>
  offset === undefined ? whenScrolling : { position: "sticky" as const, left: offset, zIndex };

/** One identity cell in the body. */
export const leadCellSx = (offset: number | undefined) => ({
  ...ROW_LABEL_CELL_SX,
  ...frozenAt(offset, Z.rowLabel, {
    position: "static" as const,
    left: "auto" as const,
    zIndex: "auto" as const,
  }),
});

/**
 * One identity cell's header.
 *
 * A frozen one is sticky on BOTH axes, so it has to outrank the Period headers
 * it scrolls under AND the identity cells it scrolls over.
 */
export const leadHeadCellSx = (offset: number | undefined) => (theme: Theme) => ({
  ...headCell(theme, { borderRight: 1, borderRightColor: "divider" }),
  top: 0,
  textAlign: "left" as const,
  ...frozenAt(offset, Z.headerCorner, { left: "auto" as const, zIndex: Z.header }),
});
