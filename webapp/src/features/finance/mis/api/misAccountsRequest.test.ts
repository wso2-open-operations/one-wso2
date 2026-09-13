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
import { MIS_PERIODS, MIS_TABLES, type MisAppliedFilters } from "../util/misViewVocabulary";
import { accountsRequests } from "./misAccountsRequest";

// One `POST /accounts` per column, behind the Software/Cloud Customers table.
// Ported from digiops-finance `arrDashboard/hooks/useCustomerAccounts.js`,
// `fetchAccountsForDateRange`.
//
// THE BODY IS THREE FIELDS, AND THE SMALLNESS IS THE POINT. `/accounts` accepts
// the whole ArrFilter shape — the backend README documents regions, industries,
// owners, business units and an ARR range — and the source sends NONE of it. It
// sends the closing date, the type, and a confidence on a forecast. Anything
// else this file grew would be a filter the reader has no control over on this
// table, quietly narrowing a customer list that says it is unnarrowed. That is
// why these tests assert the exact body and not a subset of it.

const CUSTOMERS = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS);

/** Two calendar years, the second of them to date. */
const RANGES = [
  { start: "2025/01/01", end: "2025/12/31" },
  { start: "2026/01/01", end: "2026/09/12" },
];

const withType = (type: string, over: Partial<MisAppliedFilters> = {}): MisAppliedFilters => ({
  ...CUSTOMERS,
  arrType: type,
  ...over,
});

describe("which columns get asked for", () => {
  it("asks once per column, closing on that column's end date", () => {
    // A Build column is a span; an account balance is a moment. The customers
    // table asks what the book looked like on the closing date and never for
    // the range, which is why there is no `startDate` here and there is one in
    // every `/arr-summary` body.
    expect(accountsRequests(RANGES, CUSTOMERS)).toEqual([
      { endDate: "2025-12-31", arrType: "Total ARR" },
      { endDate: "2026-09-12", arrType: "Total ARR" },
    ]);
  });

  it("writes the date the way the wire wants it, not the way the grid shows it", () => {
    // Ranges are slash-separated because that is what the grids and the Excel
    // export show. The wire wants dashes. The source converts at this same
    // boundary (`normalizeToSqlDate`).
    for (const request of accountsRequests(RANGES, CUSTOMERS)) {
      expect(request.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("asks for nothing when there are no columns", () => {
    expect(accountsRequests([], CUSTOMERS)).toEqual([]);
  });
});

describe("the type the customer list is read at", () => {
  it("carries the Period's own type value", () => {
    expect(accountsRequests(RANGES, withType("Closed Won ARR"))[0].arrType).toBe("Closed Won ARR");
  });

  it("falls back to Total rather than omitting the type", () => {
    // The source defaults it in the payload rather than leaving it out, with
    // the reason written on the line: the first batch of requests fires before
    // the reader has set anything, and a body with no type asks a different
    // question than a body asking for the total.
    const { arrType, ...noType } = withType("Total ARR");
    void arrType;
    expect(accountsRequests(RANGES, noType as MisAppliedFilters)[0].arrType).toBe("Total ARR");
  });
});

describe("the confidence level, which only a forecast carries", () => {
  it("goes with a Forecasted type", () => {
    const forecast = withType("Forecasted ARR", { confidenceLevel: "Commit" });
    expect(accountsRequests(RANGES, forecast)[0]).toEqual({
      endDate: "2025-12-31",
      arrType: "Forecasted ARR",
      forecastType: "Commit",
    });
  });

  it("stays behind on any other type, Renewal included", () => {
    // Renewal turns forecast COLUMNS on without carrying a confidence — the
    // same rule `/arr-summary` follows. Sending one here would filter a
    // renewals figure by a pipeline stage it has nothing to do with.
    for (const type of ["Total ARR", "Closed Won ARR", "Renewal ARR", "Delayed ARR"]) {
      const filters = withType(type, { confidenceLevel: "Commit" });
      expect(accountsRequests(RANGES, filters)[0]).not.toHaveProperty("forecastType");
    }
  });

  it("stays behind on a forecast that has no confidence set", () => {
    const forecast = withType("Forecasted ARR", { confidenceLevel: "" as MisAppliedFilters["confidenceLevel"] });
    expect(accountsRequests(RANGES, forecast)[0]).not.toHaveProperty("forecastType");
  });
});

describe("the filters this table does NOT send", () => {
  // The Software/Cloud Customers table offers neither Channel/Direct nor any of
  // the six account and geography lists — ticket 10 has the filter bar grey
  // them out and name the Table in a tooltip. So there is nothing to send, and
  // this pins that the request builder does not invent it: a body that narrowed
  // by region here would show a filtered customer list under a bar showing no
  // region filter at all.
  it("ignores every list filter and the partner book, even when they are set", () => {
    const narrowed = withType("Total ARR", {
      salesRegion: ["North America"],
      subRegion: ["Northeast"],
      billingCountry: ["USA"],
      shippingCountry: ["USA"],
      industry: ["Technology"],
      subIndustry: ["Software"],
      accountOwner: ["John Doe"],
      technicalOwner: ["alice@example.com"],
      channelManager: ["bob@example.com"],
      channelDirect: "Channel",
    });
    expect(accountsRequests(RANGES, narrowed)[0]).toEqual({
      endDate: "2025-12-31",
      arrType: "Total ARR",
    });
  });

  it("ignores the unit selection, which this table cuts client-side", () => {
    const units = withType("Total ARR", { buProductSelection: "BU_APIM" });
    expect(accountsRequests(RANGES, units)[0]).toEqual({
      endDate: "2025-12-31",
      arrType: "Total ARR",
    });
  });
});
