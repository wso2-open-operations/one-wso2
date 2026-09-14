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
  BU_EXIT_ROWS,
  REGION_EXIT_SUB_COLUMNS,
  buExitFigure,
  regionExitTable,
  type BuFigures,
  type RegionExitResponse,
} from "./exitArrRows";

// The two Exit ARR summaries: what their rows are, and which figure each cell
// reads.
//
// Ported from `mapResponseToRows` in digiops-finance
// `arrDashboard/hooks/useExitArrByRegion.js` and `useExitArrByBU.js`. Both
// endpoints answer with the backend's `BuType` record — five business units,
// Moesif, and a total — so the two tables read the same seven numbers and
// differ only in what a ROW is: a region in one, a business unit in the other.

/** One region's split. The backend's `BuType` always sends all seven. */
const split = (over: Partial<BuFigures> = {}): BuFigures => ({
  apim: 0,
  iam: 0,
  integration: 0,
  choreo: 0,
  agentPlatform: 0,
  moesif: 0,
  all: 0,
  ...over,
});

/** The id the computed total row carries — see `exitArrRows`. */
const TOTAL_ROW_ID = "total exit arr";

const AS_OF_2025 = "As of 2025/12/31";
const AS_OF_2026 = "As of 2026/09/12";

const columnsOf = (...entries: [string, RegionExitResponse | undefined][]) =>
  entries.map(([label, response]) => ({ label, response }));

describe("what the rows of a Region Summary are", () => {
  it("is one row per region the backend named, then the total", () => {
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: split(), APAC: split() }]),
    );
    expect(table.rows.map((row) => row.label)).toEqual(["NA", "APAC", "Total Exit ARR"]);
  });

  it("unions the regions across columns, oldest column first", () => {
    // Each column is its own read at its own date, so a region that only
    // started reporting in the newest one is missing from the oldest. Taking
    // any single column's keys would drop it.
    const table = regionExitTable(
      columnsOf([AS_OF_2025, { NA: split() }], [AS_OF_2026, { NA: split(), EU: split() }]),
    );
    expect(table.rows.map((row) => row.label)).toEqual(["NA", "EU", "Total Exit ARR"]);
  });

  it("keeps the total last even when a later column brings a new region", () => {
    // The source appends the Total Exit ARR row on the FIRST column and pushes
    // later columns' new regions after it, so a region can land BELOW the total
    // it is counted in. Deviation, recorded in mis.md §7.
    const table = regionExitTable(
      columnsOf([AS_OF_2025, { NA: split() }], [AS_OF_2026, { Africa: split() }]),
    );
    expect(table.rows.at(-1)?.label).toBe("Total Exit ARR");
  });

  it("drops the backend's own total key rather than showing it twice", () => {
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: split(), "Total Exit ARR": split(), Total: split() }]),
    );
    expect(table.rows.map((row) => row.label)).toEqual(["NA", "Total Exit ARR"]);
  });

  it("emphasises the total and rules a line above it", () => {
    const table = regionExitTable(columnsOf([AS_OF_2026, { NA: split() }]));
    expect(table.rows.at(-1)).toMatchObject({ emphasis: true, ruleAbove: true });
  });

  it("has only the total row when no column has answered yet", () => {
    const table = regionExitTable(columnsOf([AS_OF_2026, undefined]));
    expect(table.rows.map((row) => row.label)).toEqual(["Total Exit ARR"]);
  });
});

describe("how a region is named", () => {
  const labelOf = (key: string) =>
    regionExitTable(columnsOf([AS_OF_2026, { [key]: split() }])).rows[0].label;

  it("writes the known acronyms the way finance writes them", () => {
    expect(labelOf("apac")).toBe("APAC");
    expect(labelOf("latam")).toBe("LatAm");
    expect(labelOf("roe")).toBe("ROE");
  });

  it("uppercases a short key the map does not know, because it is an acronym", () => {
    expect(labelOf("mea")).toBe("MEA");
  });

  it("leaves a name that already carries its own capitals alone", () => {
    expect(labelOf("Africa")).toBe("Africa");
    expect(labelOf("Middle East")).toBe("Middle East");
  });

  it("capitalises a lower-case name without shouting its short words", () => {
    // The source uppercases EVERY word of two to four letters, so its own
    // documented "Middle East" renders "Middle EAST". Deviation, mis.md §7.
    expect(labelOf("middle east")).toBe("Middle East");
    expect(labelOf("rest_of_europe")).toBe("Rest Of Europe");
  });

  it("keeps a combined region readable", () => {
    expect(labelOf("eu + roe")).toBe("EU + ROE");
  });

  it("treats two spellings of one region as one row", () => {
    // The row id is the normalised key, so `NA` and `na` are the same region
    // arriving in two columns rather than two regions.
    const table = regionExitTable(
      columnsOf([AS_OF_2025, { NA: split({ apim: 1 }) }], [AS_OF_2026, { na: split({ apim: 2 }) }]),
    );
    expect(table.rows.map((row) => row.label)).toEqual(["NA", "Total Exit ARR"]);
  });
});

describe("the figures in a Region Summary", () => {
  it("reads each business unit straight off that region's split", () => {
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: split({ apim: 10, iam: 20, moesif: 3 }) }]),
    );
    const cells = table.figures.get(AS_OF_2026)?.get("na");
    expect(cells).toMatchObject({ apim: 10, iam: 20, moesif: 3 });
  });

  it("takes a region's Total from the backend's own, not from adding the units up", () => {
    // `all` is what the source reads when the response carries it, and the
    // backend's `BuType` always does. Whether it includes Moesif is the
    // backend's business; recomputing here would be the port disagreeing with
    // the figure the source shows.
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: split({ apim: 10, iam: 20, moesif: 3, all: 99 }) }]),
    );
    expect(table.figures.get(AS_OF_2026)?.get("na")?.all).toBe(99);
  });

  it("adds the five units up when a response arrives without a total", () => {
    // Unreachable against the Ballerina service, whose record defaults `all` to
    // 0 — reachable behind a gateway that reshapes the body, which is the case
    // the source's `'all' in data` branch is there for.
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: { apim: 10, iam: 20, moesif: 3 } }]),
    );
    // Moesif is not in it: the source's comment says the region total excludes it.
    expect(table.figures.get(AS_OF_2026)?.get("na")?.all).toBe(30);
  });

  it("reads a missing unit as nothing, not as a gap", () => {
    // Every cell of a summary is a real figure, so a unit the backend left out
    // is zero rather than blank — `safeNum` in both source hooks.
    const table = regionExitTable(columnsOf([AS_OF_2026, { NA: { apim: 10 } }]));
    expect(table.figures.get(AS_OF_2026)?.get("na")?.choreo).toBe(0);
  });

  it("leaves a column that never answered out of the figures entirely", () => {
    const table = regionExitTable(
      columnsOf([AS_OF_2025, undefined], [AS_OF_2026, { NA: split({ apim: 5 }) }]),
    );
    expect(table.figures.get(AS_OF_2025)).toBeUndefined();
    expect(table.figures.get(AS_OF_2026)?.get("na")?.apim).toBe(5);
  });
});

describe("the Total Exit ARR row", () => {
  it("adds each business unit down the regions, column by column", () => {
    const table = regionExitTable(
      columnsOf([
        AS_OF_2026,
        { NA: split({ apim: 10, iam: 1 }), EU: split({ apim: 5, iam: 2 }) },
      ]),
    );
    const total = table.figures.get(AS_OF_2026)?.get(TOTAL_ROW_ID);
    expect(total).toMatchObject({ apim: 15, iam: 3 });
  });

  it("adds Moesif down the regions too, so its own column still reads", () => {
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: split({ moesif: 4 }), EU: split({ moesif: 6 }) }]),
    );
    expect(table.figures.get(AS_OF_2026)?.get(TOTAL_ROW_ID)?.moesif).toBe(10);
  });

  it("leaves Moesif out of its Total, though the region rows above may include it", () => {
    // Reproduced from `useExitArrByRegion.js`, which sums the five units for
    // the total row while taking each region's own total from `all`. The two
    // can therefore disagree by Moesif, and finance reconciles against the
    // source during the parallel period — see mis.md §8.
    const table = regionExitTable(
      columnsOf([AS_OF_2026, { NA: split({ apim: 10, moesif: 4, all: 14 }) }]),
    );
    expect(table.figures.get(AS_OF_2026)?.get("na")?.all).toBe(14);
    expect(table.figures.get(AS_OF_2026)?.get(TOTAL_ROW_ID)?.all).toBe(10);
  });

  it("is zero across the board when no region answered", () => {
    const table = regionExitTable(columnsOf([AS_OF_2026, {}]));
    expect(table.figures.get(AS_OF_2026)?.get(TOTAL_ROW_ID)).toMatchObject({ apim: 0, all: 0 });
  });
});

describe("the columns a Region Summary repeats under every period", () => {
  it("is the five business units, then Moesif, then the total", () => {
    expect(REGION_EXIT_SUB_COLUMNS.map((column) => column.label)).toEqual([
      "API Platform BU",
      "IAM BU",
      "Integration BU",
      "Choreo BU",
      "Agent Platform BU",
      "Moesif (Already included in API Platform BU)",
      "Total",
    ]);
  });

  it("names the field each one reads, because the header and the wire disagree", () => {
    expect(REGION_EXIT_SUB_COLUMNS.map((column) => column.field)).toEqual([
      "apim",
      "iam",
      "integration",
      "choreo",
      "agentPlatform",
      "moesif",
      "all",
    ]);
  });
});

describe("what the rows of a BU Summary are", () => {
  it("is the five business units, Moesif, and the total, in that order", () => {
    expect(BU_EXIT_ROWS.map((row) => row.label)).toEqual([
      "API Platform",
      "IAM",
      "Integration",
      "Choreo",
      "Agent Platform",
      "Moesif (Already included in API Platform BU)",
      "Total",
    ]);
  });

  it("emphasises the total and rules a line above it", () => {
    expect(BU_EXIT_ROWS.at(-1)).toMatchObject({ id: "all", emphasis: true, ruleAbove: true });
  });

  it("says the same thing whatever the backend returned, because the rows are the code", () => {
    // The opposite of the Region Summary, whose rows come from the response.
    expect(BU_EXIT_ROWS).toHaveLength(7);
  });
});

describe("the figures in a BU Summary", () => {
  it("reads each row off its own field", () => {
    const answer = split({ apim: 1, iam: 2, integration: 3, choreo: 4, agentPlatform: 5, moesif: 6 });
    expect(BU_EXIT_ROWS.map((row) => buExitFigure(answer, row.id))).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("takes the Total from the backend's own total", () => {
    expect(buExitFigure(split({ apim: 1, all: 7 }), "all")).toBe(7);
  });

  it("reads a missing figure as nothing, not as a gap", () => {
    expect(buExitFigure({ apim: 1 }, "choreo")).toBe(0);
  });

  it("is blank rather than zero for a column that never answered", () => {
    // A column that failed has NO figure; a column that answered with nothing
    // has zero. Rendering the first as `0` would report a region as worth
    // nothing when the truth is that we could not ask.
    expect(buExitFigure(undefined, "apim")).toBeUndefined();
  });
});
