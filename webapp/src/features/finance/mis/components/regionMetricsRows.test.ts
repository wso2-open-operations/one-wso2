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

import { describe, expect, it } from "vitest";
import {
  REGION_METRICS_SUB_COLUMNS,
  REGION_METRICS_SUB_COLUMN_BY_KEY,
  REGION_METRICS_TOTAL_ROW_ID,
  regionMetricsTable,
  type RegionMetricsResponse,
} from "./regionMetricsRows";

// The Region Summary's second view — `All ARR Metrics`, from
// `arrDashboard/hooks/useArrSummaryRegionMetrics.js` and
// `arrDashboard/components/RegionMetricsTable.js`.
//
// It is the Exit ARR summary's opposite in one way that decides everything
// else: Exit ARR is a BALANCE per region (one figure, split seven ways by
// business unit) and this is the MOVEMENT of that balance (seven figures, from
// an Opening to a Closing, cut by ONE business unit at a time). So the columns
// here are the Build's `{opening} - {end}` spans rather than `As of {end}`, and
// the unit is a narrowing rather than a breakdown.

const metrics = (over: Partial<Record<string, number>> = {}) => ({
  opening: 0,
  firstSale: 0,
  expansions: 0,
  reductions: 0,
  lost: 0,
  netNew: 0,
  ending: 0,
  ...over,
});

const answered = (response: RegionMetricsResponse) => [{ label: "2025 - 2026", response }];

describe("which regions the table has rows for", () => {
  it("takes its rows from the response, because the region list is the answer", () => {
    const { rows } = regionMetricsTable(answered({ apac: metrics(), eu: metrics() }));
    expect(rows.map((row) => row.label)).toEqual(["APAC", "EU", "Total"]);
  });

  it("unions the regions across every column", () => {
    const { rows } = regionMetricsTable([
      { label: "2024 - 2025", response: { apac: metrics() } },
      { label: "2025 - 2026", response: { eu: metrics() } },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["apac", "eu", REGION_METRICS_TOTAL_ROW_ID]);
  });

  it("orders by first appearance, oldest column first", () => {
    const { rows } = regionMetricsTable([
      { label: "2024 - 2025", response: { eu: metrics() } },
      { label: "2025 - 2026", response: { apac: metrics(), latam: metrics() } },
    ]);
    expect(rows.map((row) => row.label)).toEqual(["EU", "APAC", "LatAm", "Total"]);
  });

  it("drops the backend's own total, having one of its own", () => {
    const { rows } = regionMetricsTable(answered({ apac: metrics(), total: metrics() }));
    expect(rows.filter((row) => row.label === "Total")).toHaveLength(1);
    expect(rows.map((row) => row.id)).toEqual(["apac", REGION_METRICS_TOTAL_ROW_ID]);
  });

  it("skips a column that never answered rather than filling it with zeroes", () => {
    const { rows, figures } = regionMetricsTable([
      { label: "2024 - 2025" },
      { label: "2025 - 2026", response: { apac: metrics({ ending: 10 }) } },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["apac", REGION_METRICS_TOTAL_ROW_ID]);
    expect(figures.get("2024 - 2025")).toBeUndefined();
  });

  it("still builds its Total row when no column answered, as the source does", () => {
    // A lone total with no regions under it is how the grid recognises an
    // empty book — `isEmpty` reads `rows.length <= 1` — and it is what
    // `regionExitTable` builds in the same case, so the Region Summary's two
    // views agree about what an empty book looks like.
    expect(regionMetricsTable([]).rows.map((row) => row.id)).toEqual([
      REGION_METRICS_TOTAL_ROW_ID,
    ]);
  });
});

describe("the seven metric columns", () => {
  it("runs from an Opening balance to a Closing one, the way a Build reads", () => {
    expect(REGION_METRICS_SUB_COLUMNS.map((column) => column.label)).toEqual([
      "Opening ARR",
      "First Sale",
      "Expansion",
      "Reduction",
      "Loss",
      "Net New",
      "Closing ARR",
    ]);
  });

  it("reads each metric off the field the backend sends it under", () => {
    const fieldByKey = Object.fromEntries(
      REGION_METRICS_SUB_COLUMNS.map((column) => [column.key, column.field]),
    );
    expect(fieldByKey).toEqual({
      opening: "opening",
      "first-sale": "firstSale",
      expansion: "expansions",
      reduction: "reductions",
      loss: "lost",
      "net-new": "netNew",
      closing: "ending",
    });
  });
});

describe("the figure in a cell", () => {
  const book = answered({
    apac: metrics({ opening: 100, firstSale: 20, expansions: 30, reductions: 5, lost: 10, netNew: 35, ending: 135 }),
  });

  it("reads each metric off its own field", () => {
    const apac = regionMetricsTable(book).figures.get("2025 - 2026")!.get("apac")!;
    expect(apac).toEqual({
      opening: 100,
      firstSale: 20,
      expansions: 30,
      reductions: 5,
      lost: 10,
      netNew: 35,
      ending: 135,
    });
  });

  it("is zero for a metric the backend left out, because every cell here is computed", () => {
    const apac = regionMetricsTable(answered({ apac: {} })).figures.get("2025 - 2026")!.get("apac")!;
    expect(apac.opening).toBe(0);
    expect(apac.ending).toBe(0);
  });

  it("is zero for a figure that is not a number", () => {
    const odd = { apac: { opening: "1,000", ending: null } } as unknown as RegionMetricsResponse;
    const apac = regionMetricsTable(answered(odd)).figures.get("2025 - 2026")!.get("apac")!;
    expect(apac.opening).toBe(0);
    expect(apac.ending).toBe(0);
  });
});

describe("the Total row", () => {
  const twoRegions = answered({
    apac: metrics({ opening: 100, expansions: 30, ending: 135 }),
    eu: metrics({ opening: 50, expansions: 5, ending: 60 }),
  });

  it("is last, under the regions it adds up", () => {
    const { rows } = regionMetricsTable(twoRegions);
    expect(rows[rows.length - 1].id).toBe(REGION_METRICS_TOTAL_ROW_ID);
  });

  it("is emphasised and ruled, the way an accountant draws a total", () => {
    const { rows } = regionMetricsTable(twoRegions);
    const total = rows[rows.length - 1];
    expect(total.emphasis).toBe(true);
    expect(total.ruleAbove).toBe(true);
  });

  it("adds each metric down the regions", () => {
    const total = regionMetricsTable(twoRegions).figures.get("2025 - 2026")!.get(REGION_METRICS_TOTAL_ROW_ID)!;
    expect(total.opening).toBe(150);
    expect(total.expansions).toBe(35);
    expect(total.ending).toBe(195);
  });

  it("counts every region the port shows and not the backend's own total", () => {
    const withBackendTotal = answered({
      apac: metrics({ ending: 135 }),
      eu: metrics({ ending: 60 }),
      total: metrics({ ending: 999 }),
    });
    const total = regionMetricsTable(withBackendTotal).figures.get("2025 - 2026")!.get(REGION_METRICS_TOTAL_ROW_ID)!;
    expect(total.ending).toBe(195);
  });

  it("is computed per column, so a column that failed has none", () => {
    const table = regionMetricsTable([
      { label: "2024 - 2025" },
      { label: "2025 - 2026", response: { apac: metrics({ ending: 10 }) } },
    ]);
    expect(table.figures.get("2024 - 2025")).toBeUndefined();
    expect(table.figures.get("2025 - 2026")!.get(REGION_METRICS_TOTAL_ROW_ID)!.ending).toBe(10);
  });
});

describe("how a region is written", () => {
  it("uses the same spellings the Exit ARR summary uses", () => {
    const { rows } = regionMetricsTable(answered({ apac: metrics(), latam: metrics(), na: metrics() }));
    expect(rows.map((row) => row.label)).toEqual(["APAC", "LatAm", "NA", "Total"]);
  });

  it("does not shout a short word inside a multi-word region", () => {
    const { rows } = regionMetricsTable(answered({ middle_east: metrics() }));
    expect(rows[0].label).toBe("Middle East");
  });

  it("writes WSO2 Exit ARR the way this view's own map does", () => {
    // `mapResponseToRows`' copy of `formatRegionLabel` carries two keys the Exit
    // ARR copy does not. Without them this renders "Wso2 Exit Arr".
    const { rows } = regionMetricsTable(
      answered({ wso2_exit_arr: metrics(), wso2_exit: metrics() }),
    );
    expect(rows.map((row) => row.label)).toEqual(["WSO2 Exit ARR", "WSO2 Exit", "Total"]);
  });

  it("keeps one spelling for a region two columns spell differently", () => {
    const { rows } = regionMetricsTable([
      { label: "2024 - 2025", response: { apac: metrics() } },
      { label: "2025 - 2026", response: { APAC: metrics() } },
    ]);
    expect(rows.map((row) => row.id)).toEqual(["apac", REGION_METRICS_TOTAL_ROW_ID]);
  });
});

describe("the sub-column lookup", () => {
  it("finds every column by its key", () => {
    for (const column of REGION_METRICS_SUB_COLUMNS) {
      expect(REGION_METRICS_SUB_COLUMN_BY_KEY.get(column.key)).toBe(column);
    }
  });
});
