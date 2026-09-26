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
import { getMonthlyPeriods, getQuarterlyPeriods } from "../util/misPeriods";
import { arrSummaryRequests } from "./misArrSummaryRequest";

// One POST per Build column. Ported from digiops-finance
// `arrDashboard/hooks/useArrTableSummary.js`, where the same bodies are built
// inside the fetch loop.
//
// Dates go over the wire DASH-separated, while a Period range is written with
// slashes — the source converts at exactly this boundary and so does this.

const DEFAULTS = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SUBSCRIPTION);

/** Two calendar years, the second of them to date. */
const RANGES = [
  { start: "2025/01/01", end: "2025/12/31" },
  { start: "2026/01/01", end: "2026/09/12" },
];

describe("the column a request covers", () => {
  it("closes on the column's end and opens on the balance before it", () => {
    // startDate is not the range's start: it is the date the OPENING balance is
    // read at, which on a Calendar year is the previous 31 December. The source
    // computes it the same way (`computePrevDateFor`, ANNUALLY branch).
    const [first, second] = arrSummaryRequests(RANGES, DEFAULTS);
    expect(first).toMatchObject({ startDate: "2024-12-31", endDate: "2025-12-31" });
    expect(second).toMatchObject({ startDate: "2025-12-31", endDate: "2026-09-12" });
  });

  it("gives one request per column", () => {
    expect(arrSummaryRequests(RANGES, DEFAULTS)).toHaveLength(2);
  });
});

describe("the column a request is compared against", () => {
  it("is the column before it", () => {
    const [, second] = arrSummaryRequests(RANGES, DEFAULTS);
    expect(second.prevColDateRange).toEqual({ startDate: "2024-12-31", endDate: "2025-12-31" });
  });

  it("is the same column a year earlier for the first, which has none before it", () => {
    // The y/y growth rows need a comparison even in the leftmost column, and
    // there is no column to its left — so the backend is asked for the same
    // window shifted back a year.
    const [first] = arrSummaryRequests(RANGES, DEFAULTS);
    expect(first.prevColDateRange).toEqual({ startDate: "2023-12-31", endDate: "2024-12-31" });
    expect(first.isFirstColumn).toBe(true);
  });

  it("is the previous QUARTER for the first column of a Quarterly Build", () => {
    // Not the same window a year earlier — that rule is Annually's alone
    // (`useArrTableSummary.js:476-487`). Quarterly compares against the quarter
    // immediately before, as two balance dates: the column's own opening, and
    // three months before it (`:487-499`).
    const quarters = getQuarterlyPeriods({ yearsBack: 1, asOf: { year: 2026, month: 9, day: 12 } });
    const [first] = arrSummaryRequests(quarters, DEFAULTS, MIS_PERIODS.QUARTERLY);
    expect(first.startDate).toBe("2024-12-31");
    expect(first.prevColDateRange).toEqual({ startDate: "2024-09-30", endDate: "2024-12-31" });
  });

  it("is the previous MONTH for the first column of a Monthly Build", () => {
    // `endDate` is the column's own opening; `startDate` is the FIRST day of
    // the month that opening falls in, which is the source's own asymmetry
    // (`:499-507`) — every other range in this port is two balance dates.
    const months = getMonthlyPeriods({ yearsBack: 1, asOf: { year: 2026, month: 9, day: 12 } });
    const [first] = arrSummaryRequests(months, DEFAULTS, MIS_PERIODS.MONTHLY);
    expect(first.startDate).toBe("2025-08-31");
    expect(first.prevColDateRange).toEqual({ startDate: "2025-08-01", endDate: "2025-08-31" });
  });

  it("marks no other column as the first", () => {
    const [, second] = arrSummaryRequests(RANGES, DEFAULTS);
    expect(second.isFirstColumn).toBeUndefined();
  });
});

describe("which unit the figures are for", () => {
  const unitsFor = (buProductSelection: string, extra: Partial<MisAppliedFilters> = {}) =>
    arrSummaryRequests(RANGES, { ...DEFAULTS, buProductSelection, ...extra })[0]?.businessUnits;

  it("asks for every business unit at the default", () => {
    expect(unitsFor("BU_ALL")).toEqual(["ALL_BU"]);
  });

  it("translates a unit code into the backend's own spelling", () => {
    // The two vocabularies are reversed — BU_APIM here, APIM_BU on the wire —
    // so this is a translation rather than a pass-through.
    expect(unitsFor("BU_APIM")).toEqual(["APIM_BU"]);
    expect(unitsFor("SW_IAM")).toEqual(["IAM_SOFTWARE"]);
    expect(unitsFor("CL_CHOREO")).toEqual(["CHOREO_CLOUD"]);
  });

  it("sends a custom selection as the list itself", () => {
    expect(unitsFor(CUSTOM_UNIT, { customBusinessUnits: ["APIM_BU", "IAM_BU"] })).toEqual([
      "APIM_BU",
      "IAM_BU",
    ]);
  });

  it("prefers the custom business units over the custom products when both are set", () => {
    expect(
      unitsFor(CUSTOM_UNIT, {
        customBusinessUnits: ["APIM_BU"],
        customProductUnits: ["APIM_CLOUD"],
      }),
    ).toEqual(["APIM_BU"]);
  });

  it("falls back to the custom products when no business units are chosen", () => {
    expect(unitsFor(CUSTOM_UNIT, { customProductUnits: ["APIM_CLOUD"] })).toEqual(["APIM_CLOUD"]);
  });

  it("asks for nothing at all when a custom selection names nothing", () => {
    // Not "everything". A custom selection with an empty list is a reader
    // part-way through choosing, and answering it with the whole company's revenue
    // would be a wrong number rather than a missing one.
    expect(arrSummaryRequests(RANGES, { ...DEFAULTS, buProductSelection: CUSTOM_UNIT })).toEqual(
      [],
    );
  });
});

describe("which Applied filters the backend is told about", () => {
  const bodyWith = (extra: Partial<MisAppliedFilters>) =>
    arrSummaryRequests(RANGES, { ...DEFAULTS, ...extra })[0];

  it("says nothing about a filter nobody set", () => {
    // An empty list is not a filter for nothing; it is the absence of a filter,
    // and sending it as [] invites a backend to read it as "match none".
    const body = bodyWith({});
    expect(body).not.toHaveProperty("salesRegions");
    expect(body).not.toHaveProperty("partnerType");
    expect(body).not.toHaveProperty("forecastType");
  });

  it("renames each list filter to the plural the backend uses", () => {
    expect(bodyWith({ salesRegion: ["EMEA"] })).toMatchObject({ salesRegions: ["EMEA"] });
    expect(bodyWith({ accountOwner: ["a@wso2.com"] })).toMatchObject({
      accountOwners: ["a@wso2.com"],
    });
    expect(bodyWith({ subIndustry: ["Banking"] })).toMatchObject({ subIndustries: ["Banking"] });
  });

  it("sends the partner model only once it is narrowed", () => {
    expect(bodyWith({ channelDirect: "All" })).not.toHaveProperty("partnerType");
    expect(bodyWith({ channelDirect: "Channel" })).toMatchObject({ partnerType: "Channel" });
  });

  it("sends the confidence level only on a Forecasted type", () => {
    // Renewal turns forecast COLUMNS on but carries no confidence — conflating
    // the two would send a pipeline filter on a renewals figure.
    expect(bodyWith({ arrType: "Total ARR", confidenceLevel: "Commit" })).not.toHaveProperty(
      "forecastType",
    );
    expect(bodyWith({ arrType: "Renewal ARR", confidenceLevel: "Commit" })).not.toHaveProperty(
      "forecastType",
    );
    expect(bodyWith({ arrType: "Forecasted ARR", confidenceLevel: "Commit" })).toMatchObject({
      forecastType: "Commit",
    });
  });

  it("finds a Forecasted type on its own Period's key, not on whichever is set", () => {
    // On Quarterly and Monthly the summary tables MIRROR the Period's type into
    // `arrType` (spec §3), so a filter set legitimately carries both keys.
    // Reading "whichever is set first" would find the mirror, decide it is not
    // a forecast, and silently drop the confidence level off a Forecasted QRR.
    expect(
      bodyWith({
        arrType: "Total QRR",
        qrrType: "Forecasted QRR",
        confidenceLevel: "Commit + Best Case",
      }),
    ).toMatchObject({ forecastType: "Commit + Best Case" });
  });

  it("carries the Period's own type, defaulting to Total", () => {
    expect(bodyWith({}).arrType).toBe("Total ARR");
    expect(bodyWith({ arrType: "Closed Won ARR" }).arrType).toBe("Closed Won ARR");
  });
});
