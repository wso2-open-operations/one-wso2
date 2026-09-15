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

// The Region Summary's `All ARR Metrics` view: what its rows are, what its
// columns are, and which field each figure is read from.
//
// Ported from digiops-finance `arrDashboard/hooks/useArrSummaryRegionMetrics.js`
// (`mapResponseToRows`) and `arrDashboard/components/RegionMetricsTable.js`
// (`getRegionMetricsColumnDefs`).
//
// ---- it is the Exit ARR summary's opposite, and that explains the rest ------
//
// Exit ARR by Region is a BALANCE: one figure per region, split seven ways by
// business unit. This is the MOVEMENT of that balance: seven figures per
// region — Opening, First Sale, Expansion, Reduction, Loss, Net New, Closing —
// cut by ONE business unit at a time. So:
//
//   * the columns are the Build's `{opening} - {end}` spans and not
//     `As of {end}`, because a movement covers a period rather than closing one;
//   * the business unit NARROWS the question rather than breaking it out, which
//     is why this is the one summary whose body carries the reader's unit
//     selection instead of hard-coding `ALL_BU`;
//   * and the seven columns are the same under every Period, exactly as the
//     Exit ARR summary's seven units are.
//
// The rows are the two tables' one shared problem, and they are solved in one
// place: see `util/misRegions.ts`.

import type { BuildRow, BuildSubColumn } from "./buildTableModel";
import { REGION_LABELS, regionId, regionLabel } from "../util/misRegions";

/** One region's movement over one column, as `/arr-summary/region-metrics` sends it. */
export interface RegionMetrics {
  /** The balance the column opens on. */
  opening?: number;
  /** New business — the source's own word for it on this table. */
  firstSale?: number;
  expansions?: number;
  reductions?: number;
  lost?: number;
  netNew?: number;
  /** The balance the column closes on. */
  ending?: number;
}

/** `POST /arr-summary/region-metrics` — one movement per region, keyed by region name. */
export type RegionMetricsResponse = Readonly<Record<string, RegionMetrics | undefined>>;

/** One All ARR Metrics column and whatever came back for it. */
export interface RegionMetricsColumn {
  /** The column header, and its identity — `{opening} - {end}`. */
  label: string;
  /** Absent while loading, and absent for good if this column failed. */
  response?: RegionMetricsResponse;
}

/** The row the port computes rather than reads, and the id it carries. */
export const REGION_METRICS_TOTAL_ROW_ID = "total";
const TOTAL_ROW_LABEL = "Total";

/**
 * Response keys that are a total rather than a region.
 *
 * Dropped rather than shown, because the Total row below is computed from the
 * regions and showing the backend's alongside it would put two rows called the
 * same thing in one table. `mapResponseToRows` filters exactly this one.
 */
const TOTAL_KEYS: ReadonlySet<string> = new Set([REGION_METRICS_TOTAL_ROW_ID]);

/** An All ARR Metrics table, ready for `BuildTable`. */
export interface RegionMetricsTable {
  /** One per region in first-appearance order, then the total. */
  rows: BuildRow[];
  /**
   * Column label → row id → that region's seven figures.
   *
   * Two levels rather than one flat key, for the reason `regionExitTable` gives:
   * an absent column map is "we could not ask", and an absent row inside a
   * present one is "that region was not in the book yet".
   */
  figures: ReadonlyMap<string, ReadonlyMap<string, Required<RegionMetrics>>>;
}

/**
 * The rows of an All ARR Metrics table, and every figure in it.
 *
 * ---- where this deviates from the source, and why --------------------------
 *
 * The source appends its Total row while mapping whichever column it is on and
 * pushes later columns' new regions in below it, so a region that only appears
 * in a newer column lands under the total that counts it. The arithmetic is
 * unaffected — the total is recomputed over every region on every column — but
 * a region under its own total reads as a broken table. The total is last here,
 * which is the same deviation `regionExitTable` takes. `docs/ported-apps/mis.md`
 * §7 records it for both views, and names the two source mechanisms it covers.
 */
export function regionMetricsTable(
  columns: readonly RegionMetricsColumn[],
): RegionMetricsTable {
  const labelById = new Map<string, string>();
  const figures = new Map<string, ReadonlyMap<string, Required<RegionMetrics>>>();

  for (const { label, response } of columns) {
    // A column that has not answered is left out entirely rather than filled
    // with zeroes. `undefined` reaches the cell as blank, which says "we could
    // not ask"; a zero would say the region moved by nothing.
    if (!response) continue;

    const byRow = new Map<string, Required<RegionMetrics>>();
    for (const [key, movement] of Object.entries(response)) {
      const id = regionId(key);
      if (!id || TOTAL_KEYS.has(id)) continue;
      // First appearance wins the spelling, oldest column first — so a region
      // does not rename itself under the reader when a later column spells it
      // differently.
      if (!labelById.has(id)) labelById.set(id, regionMetricsLabel(key));
      byRow.set(id, metricsOf(movement));
    }
    byRow.set(REGION_METRICS_TOTAL_ROW_ID, totalOf(byRow.values()));
    figures.set(label, byRow);
  }

  const rows: BuildRow[] = [...labelById].map(([id, label]) => ({ id, label }));
  // Unconditional, over an empty book too, which is what the source does
  // (`useArrSummaryRegionMetrics.js:245-249` — its own guard asks whether a
  // total row already exists, not whether any region does) and what
  // `regionExitTable` does beside it. The grid reads a lone total as "no
  // regions came back" and shows its empty state, so the row never reaches a
  // reader; suppressing it here would only make the two views of one screen
  // disagree about what an empty book builds.
  rows.push({
    id: REGION_METRICS_TOTAL_ROW_ID,
    label: TOTAL_ROW_LABEL,
    emphasis: true,
    ruleAbove: true,
  });
  return { rows, figures };
}

/**
 * One region's seven figures, with the missing ones read as zero.
 *
 * Zero rather than blank because every cell here is a figure the backend
 * computed — `safeNum` in `mapResponseToRows` does the same. The blank is
 * reserved for the column that never answered.
 */
function metricsOf(movement: RegionMetrics | undefined): Required<RegionMetrics> {
  return {
    opening: numberOf(movement?.opening),
    firstSale: numberOf(movement?.firstSale),
    expansions: numberOf(movement?.expansions),
    reductions: numberOf(movement?.reductions),
    lost: numberOf(movement?.lost),
    netNew: numberOf(movement?.netNew),
    ending: numberOf(movement?.ending),
  };
}

/**
 * The Total row for one column: each metric added down the regions.
 *
 * Every one of the seven, including Closing — unlike the Exit ARR summary,
 * whose Total row leaves Moesif out of its own Total and therefore does not
 * foot. There is no such carve-out here: the source sums all seven the same
 * way, so this column adds up to exactly what its rows say.
 */
function totalOf(regions: Iterable<Required<RegionMetrics>>): Required<RegionMetrics> {
  const total = metricsOf(undefined);
  for (const region of regions) {
    total.opening += region.opening;
    total.firstSale += region.firstSale;
    total.expansions += region.expansions;
    total.reductions += region.reductions;
    total.lost += region.lost;
    total.netNew += region.netNew;
    total.ending += region.ending;
  }
  return total;
}

/**
 * The shared region labels plus this view's own, which the Exit ARR view does
 * not have: `mapResponseToRows`'s copy of `formatRegionLabel` maps two `wso2
 * exit` spellings (`useArrSummaryRegionMetrics.js:153-154`) that the Exit ARR
 * copy does not. Without them the key renders "Wso2 Exit Arr".
 */
const REGION_METRICS_LABELS: Readonly<Record<string, string>> = {
  ...REGION_LABELS,
  "wso2 exit arr": "WSO2 Exit ARR",
  "wso2 exit": "WSO2 Exit",
};

/** A region key as this view's row header. See `regionLabel` in `misRegions`. */
const regionMetricsLabel = (key: string): string => regionLabel(key, REGION_METRICS_LABELS);

/** A figure, or zero for anything that is not one. `safeNum` in the source. */
const numberOf = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

/** One figure column of an All ARR Metrics table, repeated under every Period. */
export interface RegionMetricsSubColumn extends BuildSubColumn {
  /** The `RegionMetrics` field this column reads. */
  field: keyof RegionMetrics;
}

/**
 * The seven metrics, in the source's reading order.
 *
 * ---- five of the seven headers disagree with the Build's ------------------
 *
 * The Subscription Build writes these movements "Expansions", "Reductions",
 * "Lost", "New" and "Ending ARR"; this table writes them "Expansion",
 * "Reduction", "Loss", "First Sale" and "Closing ARR". That inconsistency is the
 * source's, between two of its own screens, and it is reproduced rather than
 * harmonised: finance reconciles the port against the live app column by column
 * for a full reporting cycle (ADR 0003), and a renamed column is a disagreement
 * somebody has to investigate before the figures can be trusted.
 *
 * Two of the five are words `CONTEXT.md` does not use — the glossary's terms are
 * **Lost** and **New** — so "Loss" and "First Sale" here are headers this repo's
 * own vocabulary would otherwise forbid. The glossary carries the carve-out and
 * `docs/ported-apps/mis.md` §8 the reasoning; harmonising the two screens is a
 * decision for after the parallel period rather than a rename in one file.
 *
 * Widths are the source's `minWidth`s, which is what these columns settle at
 * once the table is wider than the page and stops flexing.
 */
export const REGION_METRICS_SUB_COLUMNS: readonly RegionMetricsSubColumn[] = [
  { key: "opening", label: "Opening ARR", field: "opening", width: 140 },
  { key: "first-sale", label: "First Sale", field: "firstSale", width: 140 },
  { key: "expansion", label: "Expansion", field: "expansions", width: 140 },
  { key: "reduction", label: "Reduction", field: "reductions", width: 140 },
  { key: "loss", label: "Loss", field: "lost", width: 140 },
  { key: "net-new", label: "Net New", field: "netNew", width: 140 },
  { key: "closing", label: "Closing ARR", field: "ending", width: 140 },
];

/** By key, so a cell looks its column up once rather than scanning seven. */
export const REGION_METRICS_SUB_COLUMN_BY_KEY: ReadonlyMap<string, RegionMetricsSubColumn> =
  new Map(REGION_METRICS_SUB_COLUMNS.map((column) => [column.key, column]));
