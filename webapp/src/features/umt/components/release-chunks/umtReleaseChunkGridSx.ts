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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The line height every cell in the release-chunk grids is built from.
//
// A pending-chunk row is really a little table of its own: Update Levels,
// Build Status, Build Action, TG Build Status and TG Build Action each render
// one entry per update level, and the grid is only readable if entry N of one
// column sits exactly level with entry N of the next. Left to their intrinsic
// heights those entries never line up — a line of body2 text is ~20px, a small
// Chip is 24px and a small IconButton is ~30px — so ChunkLine pins every entry
// to this one height instead.
export const CHUNK_LINE_HEIGHT = 32;

// The grids' horizontal cell padding, set explicitly below rather than left to
// MUI's identical default, because ChunkLine has to cancel it out with a
// negative margin to bleed its divider across the full width of the cell.
export const CHUNK_CELL_PADDING_X = 10;

// The card a grid with a frosted header sits in.
//
// The theme gives every Paper its own backdrop blur. A backdrop blur on an
// ancestor stops the header's blur from covering the rows beneath it: the rows
// stay sharp under the header with only a faint halo. The card's blur is
// removed so that the header's blur takes effect.
export const UMT_CHUNK_GRID_PAPER_SX = {
  backdropFilter: "none",
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minHeight: 0,
  minWidth: 0,
  overflow: "hidden",
  position: "relative",
  WebkitBackdropFilter: "none",
} as const;

const HEADER_BLUR = "blur(10px)";

// The frosted header for any UMT grid: rows that scroll under the sticky
// header show through a translucent paper tint and a blur. The blur is set
// here for every theme, because only some of the themes put one on the
// header. The header cells, filler and scrollbar filler are cleared to
// transparent, because the grid paints them with its solid header colour,
// which hides the blur. The grid's card must also drop its own backdrop blur
// (see UMT_CHUNK_GRID_PAPER_SX), or this blur has no effect.
export const UMT_FROSTED_HEADER_SX = {
  "& .MuiDataGrid-columnHeaders": {
    backgroundColor: "color-mix(in srgb, var(--oxygen-palette-background-paper) 70%, transparent)",
    // The header shade, laid over the tint across the header's full width.
    backgroundImage:
      "linear-gradient(var(--oxygen-palette-action-hover), var(--oxygen-palette-action-hover))",
    backdropFilter: HEADER_BLUR,
    WebkitBackdropFilter: HEADER_BLUR,
  },
  "& .MuiDataGrid-columnHeader": {
    backgroundColor: "transparent",
  },
  "& .MuiDataGrid-columnHeaders .MuiDataGrid-filler, & .MuiDataGrid-columnHeaders .MuiDataGrid-scrollbarFiller":
    {
      backgroundColor: "transparent",
    },
} as const;

export const UMT_CHUNK_GRID_SX = {
  border: 0,
  ...UMT_FROSTED_HEADER_SX,
  "& .MuiDataGrid-cell": {
    alignItems: "flex-start",
    display: "flex",
    overflowWrap: "anywhere",
    px: `${CHUNK_CELL_PADDING_X}px`,
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  "& .MuiDataGrid-columnHeaderTitle": {
    fontWeight: 600,
    lineHeight: 1.2,
    textOverflow: "clip",
    whiteSpace: "normal",
  },
  "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": { outline: "none" },
  "& .MuiDataGrid-cell:focus-visible": { outline: "auto 1px" },
} as const;

/**
 * The pending grid's look: the base above plus gridlines.
 *
 * A pending row is a little table of its own — up to eight columns, six of
 * which render one entry per update level — and without a rule between the
 * columns it reads as an undifferentiated wall of chips and icons. The shaded,
 * ruled header does the same job for the two-tier header, separating the
 * column-group titles from the column titles beneath them.
 *
 * The borders are written longhand rather than with the `borderRight: 1`
 * shorthand. The DataGrid sets its own `border-*` shorthands from CSS
 * variables, and jsdom's CSS parser throws when a shorthand it has already
 * stored as a string is re-expanded, which takes these grids out of the tests
 * entirely. The longhands compose with the grid's own rules instead.
 */
// A column that is its own group carries its title in the upper header row
// with nothing beneath it. The grid draws a rule under every group title, but
// on these three that rule splits a single header in half rather than
// separating a group from its members, so it is dropped for them and kept
// under "Build Details", where it does separate a title from the six columns
// it covers.
//
// `data-fields` is how the grid labels a group header with the fields it
// spans, wrapped in |- -| so a group over "id" cannot match one over "id2".
// The rule itself sits on the title container inside the header, not the
// header, which is what has to be overridden.
const UNGROUPED_GROUP_HEADER_TITLES = ["id", "updateIds", "actions"]
  .map(
    (field) =>
      `& .MuiDataGrid-columnHeader--filledGroup[data-fields="|-${field}-|"] .MuiDataGrid-columnHeaderTitleContainer`,
  )
  .join(", ");

export const UMT_CHUNK_GRID_BORDERED_SX = {
  ...UMT_CHUNK_GRID_SX,
  "& .MuiDataGrid-cell": {
    ...UMT_CHUNK_GRID_SX["& .MuiDataGrid-cell"],
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: "divider",
  },
  "& .MuiDataGrid-columnHeader": {
    ...UMT_CHUNK_GRID_SX["& .MuiDataGrid-columnHeader"],
    borderRightWidth: "1px",
    borderRightStyle: "solid",
    borderRightColor: "divider",
  },
  [UNGROUPED_GROUP_HEADER_TITLES]: {
    borderBottomWidth: 0,
  },
} as const;
