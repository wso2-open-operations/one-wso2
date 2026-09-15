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

// The two Exit ARR summaries: what their rows are, and which figure each cell
// reads.
//
// Ported from `mapResponseToRows` in digiops-finance
// `arrDashboard/hooks/useExitArrByRegion.js` and `useExitArrByBU.js`, and from
// `generateBuOnlyColumns` in `arrDashboard/utils/tableConstants.js`.
//
// ---- one record, read two ways ---------------------------------------------
//
// Both endpoints answer with the ARR backend's `BuType` — five business units,
// Moesif, and a total (`arr-backend/modules/types/types.bal:372`). What differs
// is the shape around it: `/bu-exit` answers with ONE, and `/region-exit`
// answers with a MAP of them keyed by region. So the two tables read the same
// seven numbers and disagree only about what a row is.
//
// That also settles which table's rows come from the code and which from the
// data. A business unit is a thing this repo knows the name of, so BU Summary's
// seven rows are a constant. A region is not — the backend cuts by Sales Region
// or Sub Region depending on what it was asked, and the list of either is a
// property of the customer book — so Region Summary's rows are whatever the
// responses named.
//
// ---- the source's defensive reader is NOT ported ---------------------------
//
// `useExitArrByRegion.js`'s `pickBuNumbers` tries four key spellings in turn
// (`apim`, `apimBuTotal`, `APIM`, then nested under `bu` or `businessUnit`) and
// accepts the response as an array, or under `data`, `result` or `payload`.
// None of those shapes is what the service returns, and a reader that accepts
// five shapes cannot tell a changed contract from an empty one: every wrong
// guess lands on the same silent zeroes. This reads the contract, and a body
// that is not it shows nothing rather than nothing-shaped-like-figures.

import type { BuildRow, BuildSubColumn } from "./buildTableModel";
import { REGION_LABELS, regionId, regionLabel } from "../util/misRegions";

/**
 * One business-unit split, as both endpoints send it.
 *
 * Every field is optional here and none is on the wire: the Ballerina record is
 * closed with a default of 0 for all seven, so the optionality describes a
 * gateway or a future field rather than the service.
 */
export interface BuFigures {
  apim?: number;
  iam?: number;
  integration?: number;
  choreo?: number;
  agentPlatform?: number;
  moesif?: number;
  /** The backend's own total for this row. */
  all?: number;
}

/** `POST /arr-summary/region-exit` — one split per region, keyed by region name. */
export type RegionExitResponse = Readonly<Record<string, BuFigures | undefined>>;

/** One Region Summary column and whatever came back for it. */
export interface RegionExitColumn {
  /** The column header, and its identity — `As of {end}`. */
  label: string;
  /** Absent while loading, and absent for good if this column failed. */
  response?: RegionExitResponse;
}

/** The row the port computes rather than reads, and the id it carries. */
const TOTAL_ROW_ID = "total exit arr";
const TOTAL_ROW_LABEL = "Total Exit ARR";

/**
 * Moesif's caveat, which both tables carry — as a column header on the Region
 * Summary and as a row label on the BU Summary.
 *
 * Written once because the two must agree: the figure is already inside API
 * Platform BU beside it, so a reader adding the column up has to be told where,
 * and a caveat that said two different things in two tables would be worse than
 * one that said nothing. The source spells it out twice, in
 * `tableConstants.js` and as `BU_SUMMARY_MOESIF_LABEL` in `useExitArrByBU.js`;
 * they happen to agree there.
 */
const MOESIF_LABEL = "Moesif (Already included in API Platform BU)";

/**
 * Response keys that are a total rather than a region.
 *
 * Dropped rather than shown, because the Total Exit ARR row below is computed
 * from the regions and showing the backend's alongside it would put two rows
 * called the same thing in one table. The source filters exactly these two.
 */
const TOTAL_KEYS: ReadonlySet<string> = new Set([TOTAL_ROW_ID, "total"]);

/** A Region Summary, ready for `BuildTable`. */
export interface RegionExitTable {
  /** One per region in first-appearance order, then the total. */
  rows: BuildRow[];
  /**
   * Column label → row id → that cell's seven figures.
   *
   * Two levels rather than one flat key because the table is read by cell and
   * the outer level is exactly what a failed column is missing: an absent
   * column map is "we could not ask", and an absent row inside a present one is
   * "that region was not in the book yet".
   */
  figures: ReadonlyMap<string, ReadonlyMap<string, BuFigures>>;
}

/**
 * The rows of a Region Summary, and every figure in it.
 *
 * The union across columns is the point, and it is the same argument the
 * customers table makes: each column is its own read at its own closing date,
 * so a region that only began reporting in the newest one is missing from the
 * oldest. Taking any single column's keys would drop it.
 *
 * ---- where this deviates from the source, and why --------------------------
 *
 * The source appends its Total Exit ARR row while mapping the FIRST column, so
 * a region that appears only in a later one is pushed in BELOW the total that
 * counts it. The arithmetic is unaffected — the total is recomputed over every
 * region row on every column — but a region under its own total reads as a
 * broken table. The total is last here. Recorded in `docs/ported-apps/mis.md` §7.
 */
export function regionExitTable(columns: readonly RegionExitColumn[]): RegionExitTable {
  const labelById = new Map<string, string>();
  const figures = new Map<string, ReadonlyMap<string, BuFigures>>();

  for (const { label, response } of columns) {
    // A column that has not answered is left out entirely rather than filled
    // with zeroes. `undefined` reaches the cell as blank, which says "we could
    // not ask"; a zero would say the region was worth nothing.
    if (!response) continue;

    const byRow = new Map<string, BuFigures>();
    for (const [key, split] of Object.entries(response)) {
      const id = regionId(key);
      if (!id || TOTAL_KEYS.has(id)) continue;
      // First appearance wins the spelling, oldest column first — so a region
      // does not rename itself under the reader when a later column spells it
      // differently.
      if (!labelById.has(id)) labelById.set(id, exitArrRegionLabel(key));
      byRow.set(id, regionFigures(split));
    }
    byRow.set(TOTAL_ROW_ID, totalOf(byRow.values()));
    figures.set(label, byRow);
  }

  const rows: BuildRow[] = [...labelById].map(([id, label]) => ({ id, label }));
  // Emphasised and ruled, like every balance line in this app — `BuildTable`
  // draws the rule an accountant draws above a total, and the source bolds
  // exactly this row (`getRowHeaderCellClass`, `tableUtils.js:1877`).
  rows.push({ id: TOTAL_ROW_ID, label: TOTAL_ROW_LABEL, emphasis: true, ruleAbove: true });
  return { rows, figures };
}

/**
 * One region's seven figures, with the missing ones read as zero.
 *
 * Zero rather than blank because every cell of a summary is a figure the
 * backend computed: `safeNum` in both source hooks does the same, and a
 * business unit a region does not sell is genuinely worth nothing there. The
 * blank is reserved for the column that never answered.
 */
function regionFigures(split: BuFigures | undefined): BuFigures {
  const apim = numberOf(split?.apim);
  const iam = numberOf(split?.iam);
  const integration = numberOf(split?.integration);
  const choreo = numberOf(split?.choreo);
  const agentPlatform = numberOf(split?.agentPlatform);
  return {
    apim,
    iam,
    integration,
    choreo,
    agentPlatform,
    moesif: numberOf(split?.moesif),
    // The backend's own total when it sent one, which it always does. The
    // fallback adds the five units and leaves Moesif out, which is what the
    // source's comment says a region total is — so on the one path where the
    // port computes the number, it computes the documented one.
    all: split?.all ?? apim + iam + integration + choreo + agentPlatform,
  };
}

/**
 * The Total Exit ARR row for one column: each unit added down the regions.
 *
 * ---- its Total is not the sum of the region Totals above it ----------------
 *
 * A region's Total is whatever the backend sent as `all`; this row's Total is
 * the five units added up, WITHOUT Moesif. If the backend's `all` includes
 * Moesif, the column does not foot — the total reads lower than its own rows
 * add to.
 *
 * Reproduced rather than reconciled. It is `useExitArrByRegion.js`'s own
 * arithmetic, finance reconciles the port against the source for a full
 * reporting cycle (ADR 0003), and "the port's total differs from the live
 * app's" is the one disagreement that would stop the port being trusted.
 * Recorded in `docs/ported-apps/mis.md` §8.
 */
function totalOf(regions: Iterable<BuFigures>): BuFigures {
  let apim = 0;
  let iam = 0;
  let integration = 0;
  let choreo = 0;
  let agentPlatform = 0;
  let moesif = 0;
  for (const region of regions) {
    apim += numberOf(region.apim);
    iam += numberOf(region.iam);
    integration += numberOf(region.integration);
    choreo += numberOf(region.choreo);
    agentPlatform += numberOf(region.agentPlatform);
    moesif += numberOf(region.moesif);
  }
  return {
    apim,
    iam,
    integration,
    choreo,
    agentPlatform,
    moesif,
    // Moesif is summed for its own column and then left OUT of this one. See above.
    all: apim + iam + integration + choreo + agentPlatform,
  };
}

/** A figure, or zero for anything that is not one. `safeNum` in both hooks. */
const numberOf = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/**
 * The shared region labels plus this table's own total aliases.
 *
 * `TOTAL_KEYS` filters `total exit arr` and `total` out before anything is
 * labelled, so what these actually catch is a backend that spells the total
 * row a third way. Kept as the source keeps them.
 */
const EXIT_ARR_REGION_LABELS: Readonly<Record<string, string>> = {
  ...REGION_LABELS,
  [TOTAL_ROW_ID]: TOTAL_ROW_LABEL,
  "total exit": TOTAL_ROW_LABEL,
};

/** A region key as this table's row header. See `regionLabel` in `misRegions`. */
const exitArrRegionLabel = (key: string): string => regionLabel(key, EXIT_ARR_REGION_LABELS);

/** One figure column of a Region Summary, repeated under every Period. */
export interface RegionExitSubColumn extends BuildSubColumn {
  /** The `BuFigures` field this column reads. */
  field: keyof BuFigures;
}

/**
 * The five business units, Moesif, then the total — the source's reading order.
 *
 * The header and the wire disagree on three of the seven (`apim` is headed
 * "API Platform BU", `agentPlatform` is "Agent Platform BU", `all` is "Total"),
 * so the mapping is data here and pinned field by field in the tests rather
 * than left implicit in a lookup by label.
 *
 * Moesif's header carries its own caveat because the figure is already inside
 * API Platform BU beside it — a column that is not additive with its neighbours
 * has to say so where it is read, not in a footnote. Verbatim from the source.
 *
 * Widths are the source's `minWidth`s, which is what these columns settle at
 * once the table is wider than the page and stops flexing.
 */
export const REGION_EXIT_SUB_COLUMNS: readonly RegionExitSubColumn[] = [
  { key: "apim", label: "API Platform BU", field: "apim", width: 150 },
  { key: "iam", label: "IAM BU", field: "iam", width: 150 },
  { key: "integration", label: "Integration BU", field: "integration", width: 180 },
  { key: "choreo", label: "Choreo BU", field: "choreo", width: 150 },
  { key: "agent-platform", label: "Agent Platform BU", field: "agentPlatform", width: 170 },
  { key: "moesif", label: MOESIF_LABEL, field: "moesif", width: 150 },
  { key: "total", label: "Total", field: "all", width: 180 },
];

/** By key, so a cell looks its column up once rather than scanning seven. */
export const REGION_EXIT_SUB_COLUMN_BY_KEY: ReadonlyMap<string, RegionExitSubColumn> = new Map(
  REGION_EXIT_SUB_COLUMNS.map((column) => [column.key, column]),
);

/**
 * The seven rows of a BU Summary — the five units, Moesif, and the total.
 *
 * A constant, where the Region Summary's rows come from the response, because
 * this list IS the `BuType` record and the port has the record. The row id is
 * the wire field, so a cell is one lookup and there is no second mapping to
 * keep in step with the labels.
 *
 * "Moesif (Already included in API Platform BU)" is the source's own label,
 * spelled out in `useExitArrByBU.js` rather than taken from `PRODUCT_NAMES` —
 * the caveat belongs on the row for the same reason it belongs on the Region
 * Summary's column: the row is not additive with the ones above it, and a
 * reader adding the column up has to be told where.
 */
export const BU_EXIT_ROWS: readonly BuildRow[] = [
  { id: "apim", label: "API Platform" },
  { id: "iam", label: "IAM" },
  { id: "integration", label: "Integration" },
  { id: "choreo", label: "Choreo" },
  { id: "agentPlatform", label: "Agent Platform" },
  { id: "moesif", label: MOESIF_LABEL },
  { id: "all", label: "Total", emphasis: true, ruleAbove: true },
];

/**
 * One BU Summary figure, or `undefined` when that column never answered.
 *
 * The undefined is the distinction the zero cannot make: a column that failed
 * has no figure, and a unit the backend left out of an answer it did give is
 * worth nothing. Rendering the first as `0` would report a quarter's revenue as
 * nil when the truth is that we could not ask.
 */
export function buExitFigure(
  response: BuFigures | undefined,
  rowId: string,
): number | undefined {
  if (!response) return undefined;
  return numberOf(response[rowId as keyof BuFigures]);
}
