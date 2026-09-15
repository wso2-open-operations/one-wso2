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
import { defaultAppliedFilters } from "../util/misViewState";
import {
  CUSTOM_UNIT,
  MIS_PERIODS,
  MIS_TABLES,
  type MisAppliedFilters,
} from "../util/misViewVocabulary";
import { buExitRequests, regionExitRequests, regionMetricsRequests } from "./misExitArrRequest";

// One POST per Exit ARR summary column. Ported from the two hand-rolled hooks
// in digiops-finance, `arrDashboard/hooks/useExitArrByRegion.js` and
// `useExitArrByBU.js`, whose `buildPayload` functions are identical but for the
// one field the last block below covers.
//
// This is the narrowest body of the four MIS reads, and deliberately so: a
// summary asks what every business unit was worth across every region, so there
// is nothing for a unit selection or a geography list to narrow.

const REGION = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.EXIT_ARR_BY_REGION);
const BU = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.EXIT_ARR_BY_BU);

/** Two calendar years, the second of them to date. */
const RANGES = [
  { start: "2025/01/01", end: "2025/12/31" },
  { start: "2026/01/01", end: "2026/09/12" },
];

/** One trailing-twelve-month window, which carries its own opening balance. */
const TTM = [
  {
    opening: "2025/09/12",
    start: "2025/09/13",
    end: "2026/09/12",
    header: "2025/09/12 - 2026/09/12",
  },
];

describe("the moment a summary column reports", () => {
  it("closes on the column's own date and opens on the balance before it", () => {
    // The same pair of balance dates a Build column sends. The source reaches
    // the opening through `ttmOpeningSql(endDate, annuallyDateRanges)` with a
    // `${endDate year - 1}-12-31` fallback; this asks `misPeriods` for it, which
    // is where every other table already asks.
    const [first, second] = regionExitRequests(RANGES, REGION, true);
    expect(first).toMatchObject({ startDate: "2024-12-31", endDate: "2025-12-31" });
    expect(second).toMatchObject({ startDate: "2025-12-31", endDate: "2026-09-12" });
  });

  it("takes a TTM window's own opening, a year and a day back", () => {
    expect(regionExitRequests(TTM, REGION, true)[0]).toMatchObject({
      startDate: "2025-09-12",
      endDate: "2026-09-12",
    });
  });

  it("gives one request per column, oldest first", () => {
    expect(regionExitRequests(RANGES, REGION, true)).toHaveLength(2);
    expect(buExitRequests(RANGES, BU)).toHaveLength(2);
  });

  it("asks for nothing when there are no columns", () => {
    expect(regionExitRequests([], REGION, true)).toEqual([]);
    expect(buExitRequests([], BU)).toEqual([]);
  });
});

describe("which units a summary asks about", () => {
  it("asks for every one of them, whatever the reader chose", () => {
    // Both source hooks hard-code `businessUnits: ["ALL_BU"]`. It is not an
    // oversight: the per-unit breakdown IS what these tables report, so
    // narrowing to one unit would leave six of the seven figures empty.
    const narrowed = { ...BU, buProductSelection: "BU_CHOREO" };
    expect(buExitRequests(RANGES, narrowed)[0].businessUnits).toEqual(["ALL_BU"]);
  });

  it("still asks for every one of them under a custom selection that names none", () => {
    // `/arr-summary` sends no request at all in this state, because an empty
    // custom selection is a reader who has asked for nothing. A summary never
    // reads the selection, so there is nothing here to be empty.
    const empty: MisAppliedFilters = {
      ...BU,
      buProductSelection: CUSTOM_UNIT,
      customBusinessUnits: [],
      customProductUnits: [],
    };
    expect(buExitRequests(RANGES, empty)).toHaveLength(2);
    expect(buExitRequests(RANGES, empty)[0].businessUnits).toEqual(["ALL_BU"]);
  });
});

describe("the type a summary is read at", () => {
  it("is Total by default", () => {
    expect(buExitRequests(RANGES, BU)[0].arrType).toBe("Total ARR");
  });

  it("is the reader's own type once they have narrowed it", () => {
    const closedWon = { ...BU, arrType: "Closed Won ARR" };
    expect(buExitRequests(RANGES, closedWon)[0].arrType).toBe("Closed Won ARR");
  });
});

describe("the filters a summary forwards", () => {
  it("sends the partner model only once the reader has narrowed to one book", () => {
    expect(buExitRequests(RANGES, BU)[0].partnerType).toBeUndefined();
    const channel: MisAppliedFilters = { ...BU, channelDirect: "Channel" };
    expect(buExitRequests(RANGES, channel)[0].partnerType).toBe("Channel");
  });

  it("sends a confidence level on a Forecasted type and on nothing else", () => {
    const forecast: MisAppliedFilters = {
      ...BU,
      arrType: "Forecasted ARR",
      confidenceLevel: "Commit + Best Case",
    };
    expect(buExitRequests(RANGES, forecast)[0].forecastType).toBe("Commit + Best Case");
    // Renewal turns forecast COLUMNS on without carrying a confidence, so
    // sending one would filter a renewals figure by a pipeline stage it has
    // nothing to do with.
    const renewal: MisAppliedFilters = { ...BU, arrType: "Renewal ARR" };
    expect(buExitRequests(RANGES, renewal)[0].forecastType).toBeUndefined();
  });

  it("sends none of the nine account and geography lists", () => {
    // The summaries do not OFFER them — the source's filter bar greys them out
    // on these Tables — so there is no reader intention to forward, and
    // forwarding one anyway would narrow a total under a bar showing no such
    // filter.
    const narrowed: MisAppliedFilters = {
      ...BU,
      salesRegion: ["NA"],
      subRegion: ["ANZ"],
      industry: ["Banking"],
      accountOwner: ["someone@wso2.com"],
    };
    expect(Object.keys(buExitRequests(RANGES, narrowed)[0]).sort()).toEqual([
      "arrType",
      "businessUnits",
      "endDate",
      "startDate",
    ]);
  });
});

describe("which geography a Region Summary is cut by", () => {
  it("says so on every column, because the backend defaults it to Sales Region", () => {
    expect(regionExitRequests(RANGES, REGION, true)[0].isSalesRegionSummary).toBe(true);
    expect(regionExitRequests(RANGES, REGION, false)[0].isSalesRegionSummary).toBe(false);
  });

  it("changes the body, so the two cuts cannot share a cached column", () => {
    // The body IS the React Query key (`useColumnQueries`), so this field is
    // what stops a Sub Region read being served from the Sales Region answer.
    expect(regionExitRequests(RANGES, REGION, true)[0]).not.toEqual(
      regionExitRequests(RANGES, REGION, false)[0],
    );
  });

  it("is a question Exit ARR by Business Unit is never asked", () => {
    // `useExitArrByBU.js`'s payload has no such field, and the backend's
    // `ArrFilter` defaults it to `true`. Sending it there would be asking a BU
    // table to cut itself by a geography it does not report.
    expect(buExitRequests(RANGES, BU)[0]).not.toHaveProperty("isSalesRegionSummary");
  });
});

// ---- All ARR Metrics -------------------------------------------------------
//
// The third `/arr-summary/*` summary, and the one that breaks the rule the two
// above are built on. Exit ARR hard-codes `ALL_BU` because the per-unit split
// IS its columns; All ARR Metrics splits by MOVEMENT instead, so the business
// unit is free to narrow the question — and in the source it does, through a
// pill row of its own.
//
// Here it narrows through the unit tabs already above the grid, so the body
// carries whatever the reader selected in the address bar. See
// `docs/ported-apps/mis.md` §7.

describe("All ARR Metrics, which is the one summary a unit selection reaches", () => {
  it("sends every unit while the reader is looking at every unit", () => {
    expect(regionMetricsRequests(RANGES, REGION, true)[0]).toMatchObject({
      businessUnits: ["ALL_BU"],
    });
  });

  it("sends the unit the reader picked, translated to the backend's code", () => {
    const apim: MisAppliedFilters = { ...REGION, buProductSelection: "BU_APIM" };
    expect(regionMetricsRequests(RANGES, apim, true)[0]).toMatchObject({
      businessUnits: ["APIM_BU"],
    });
  });

  it("sends a custom selection as the list itself", () => {
    const custom: MisAppliedFilters = {
      ...REGION,
      buProductSelection: CUSTOM_UNIT,
      customBusinessUnits: ["APIM_BU", "IAM_BU"],
    };
    expect(regionMetricsRequests(RANGES, custom, true)[0]).toMatchObject({
      businessUnits: ["APIM_BU", "IAM_BU"],
    });
  });

  it("asks for nothing at all when a custom selection names no units", () => {
    // The source guards on `hasBusinessUnitSelection` and shows "Choose units
    // to generate region metrics". Falling back to every unit would put the
    // whole company's movement on screen under a chip saying otherwise.
    const empty: MisAppliedFilters = { ...REGION, buProductSelection: CUSTOM_UNIT };
    expect(regionMetricsRequests(RANGES, empty, true)).toEqual([]);
  });

  it("says which geography to cut by, like the Exit ARR summary beside it", () => {
    expect(regionMetricsRequests(RANGES, REGION, false)[0]).toMatchObject({
      isSalesRegionSummary: false,
    });
  });

  it("spans the column rather than closing it, which is the same pair of dates", () => {
    const [first, second] = regionMetricsRequests(RANGES, REGION, true);
    expect(first).toMatchObject({ startDate: "2024-12-31", endDate: "2025-12-31" });
    expect(second).toMatchObject({ startDate: "2025-12-31", endDate: "2026-09-12" });
  });

  it("carries the Period's type, the partner book and the confidence, as the others do", () => {
    const narrowed: MisAppliedFilters = {
      ...REGION,
      arrType: "Forecasted ARR",
      channelDirect: "Channel",
      confidenceLevel: "Commit",
    };
    expect(regionMetricsRequests(RANGES, narrowed, true)[0]).toMatchObject({
      arrType: "Forecasted ARR",
      partnerType: "Channel",
      forecastType: "Commit",
    });
  });

  it("forwards none of the nine account and geography lists, as the others do not", () => {
    const narrowed: MisAppliedFilters = { ...REGION, industry: ["SaaS"], salesRegion: ["EMEA"] };
    const [body] = regionMetricsRequests(RANGES, narrowed, true);
    expect(body).not.toHaveProperty("industries");
    expect(body).not.toHaveProperty("salesRegions");
  });
});
