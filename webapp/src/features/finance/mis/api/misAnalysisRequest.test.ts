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
  analysisAccountsRequest,
  analysisExitArrRequest,
} from "./misAnalysisRequest";
import {
  ANALYSIS_FIRST_SALE,
  defaultAnalysisFilters,
  type MisAnalysisFilters,
} from "../util/misAnalysisFilters";

// What ARR Analysis tells the backend. Ported from
// digiops-finance `arrAnalysis/api/arrAnalysisApi.js` — `buildBasePayload`,
// `resolveProducts` and `buildOptionalFilters`.
//
// The two bodies are NOT the same body, which is the thing most worth pinning:
// `/accounts` is asked what the customer book looks like on one day, and
// `/exit-arr/search` is asked for a figure over a span. So the first carries no
// `startDate` and drops `businessUnits` at its default, and the second carries
// both. Nothing says so in the source but the two functions' shapes.

const ON = { year: 2026, month: 9, day: 21 };

/** The default view, as at a named day, with whatever the case narrows. */
const narrowed = (over: Partial<MisAnalysisFilters> = {}): MisAnalysisFilters => ({
  ...defaultAnalysisFilters(ON),
  ...over,
});

describe("POST /accounts", () => {
  it("asks for the whole book as at the chosen day", () => {
    expect(analysisAccountsRequest(narrowed(), ON)).toEqual({
      arrType: "Total ARR",
      endDate: "2026-09-21",
    });
  });

  // A MOMENT, not a span. `/arr-summary` rolls a balance forward and needs two
  // dates; this asks what the book held on one. The source's own
  // `fetchAccounts` builds its payload from scratch for exactly this reason
  // rather than reusing `buildBasePayload`.
  it("carries no startDate", () => {
    expect(analysisAccountsRequest(narrowed(), ON)).not.toHaveProperty("startDate");
  });

  // `ALL_BU` is what the backend assumes; sending it is a narrowing that
  // narrows nothing, and the source omits it. Kept because a body that differs
  // between "all units" and "every unit listed" is a body Finance could compare
  // against the other app and find different.
  it("omits businessUnits entirely when no Business Unit is chosen", () => {
    expect(analysisAccountsRequest(narrowed(), ON)).not.toHaveProperty("businessUnits");
  });

  it("sends the wire codes for the Business Units that were chosen", () => {
    const body = analysisAccountsRequest(
      narrowed({ businessUnits: ["IAM", "Choreo"] }),
      ON,
    );
    expect(body.businessUnits).toEqual(["IAM_BU", "CHOREO_BU"]);
  });

  // The one that is not a `_BU` code. Moesif is a cloud product rather than a
  // business unit of its own, which is also why it cannot be asked for beside
  // API Platform — see analysisBusinessUnitsConflict.
  it("sends Moesif as MOESIF_CLOUD, not MOESIF_BU", () => {
    const body = analysisAccountsRequest(narrowed({ businessUnits: ["Moesif"] }), ON);
    expect(body.businessUnits).toEqual(["MOESIF_CLOUD"]);
  });

  // The source's `resolveProducts` falls back to ALL_BU when nothing maps,
  // rather than sending an empty list. An empty `businessUnits` would be a
  // filter matching no unit at all, so the whole table would empty itself
  // because of a name the port failed to recognise.
  it("falls back to the whole book rather than an empty unit list", () => {
    const body = analysisAccountsRequest(
      narrowed({ businessUnits: ["Something The Backend Renamed"] }),
      ON,
    );
    expect(body).not.toHaveProperty("businessUnits");
  });

  it("sends nothing for a control the reader left alone", () => {
    expect(Object.keys(analysisAccountsRequest(narrowed(), ON)).sort()).toEqual([
      "arrType",
      "endDate",
    ]);
  });

  it("resolves a dismissed As Of Date to today rather than dropping the date", () => {
    // `endDate` is required by the backend — it answers 400 without one
    // (arr-backend/service.bal:103-112) — so "no date" has to mean today.
    const body = analysisAccountsRequest(narrowed({ asOf: null }), ON);
    expect(body.endDate).toBe("2026-09-21");
  });

  it("zero-pads a single-digit month and day", () => {
    const early = { year: 2026, month: 1, day: 3 };
    expect(analysisAccountsRequest(narrowed({ asOf: early }), ON).endDate).toBe("2026-01-03");
  });
});

describe("the optional filters, which both bodies share", () => {
  it("names each list the way the backend does", () => {
    const body = analysisAccountsRequest(
      narrowed({
        salesRegions: ["EMEA"],
        subRegions: ["UK & Ireland"],
        countries: ["Sri Lanka"],
      }),
      ON,
    );
    expect(body.salesRegions).toEqual(["EMEA"]);
    expect(body.subRegions).toEqual(["UK & Ireland"]);
    // `billingCountries`, not `shippingCountries` — ARR Analysis filters on
    // where an account is BILLED, where the Build's region cut filters on where
    // it ships. Two different questions that read alike.
    expect(body.billingCountries).toEqual(["Sri Lanka"]);
  });

  it("sends a partner model only once one has been chosen", () => {
    expect(analysisAccountsRequest(narrowed(), ON)).not.toHaveProperty("partnerType");
    expect(analysisAccountsRequest(narrowed({ partnerType: "Channel" }), ON).partnerType).toBe(
      "Channel",
    );
  });

  // Two count-ish filters, sent in two different types — lifetimes as strings
  // and product counts as numbers. That is the backend's own schema
  // (`customerLifetime` is `string[]`, `numberOfProductsInUse` is `int[]`), not
  // an inconsistency to tidy: swapping either loses the filter server-side.
  it("sends lifetimes as strings and product counts as numbers", () => {
    const body = analysisAccountsRequest(
      narrowed({ lifetimeYears: [0, 3], productCounts: [2, 4] }),
      ON,
    );
    expect(body.customerLifetime).toEqual(["0", "3"]);
    expect(body.numberOfProductsInUse).toEqual([2, 4]);
  });

  it("turns the three First Sale states into two wire values and an absence", () => {
    expect(analysisAccountsRequest(narrowed(), ON)).not.toHaveProperty("isFirstSale");
    expect(
      analysisAccountsRequest(narrowed({ firstSale: ANALYSIS_FIRST_SALE.ONLY }), ON).isFirstSale,
    ).toBe(true);
    expect(
      analysisAccountsRequest(narrowed({ firstSale: ANALYSIS_FIRST_SALE.EXCLUDE }), ON).isFirstSale,
    ).toBe(false);
  });

  it("sends an ARR range with only the end the reader actually set", () => {
    const lowerOnly = analysisAccountsRequest(
      narrowed({ arrRange: { lower: 50_000, upper: null } }),
      ON,
    );
    expect(lowerOnly.arrRange).toEqual({ lowerBoundary: 50_000 });

    const both = analysisAccountsRequest(
      narrowed({ arrRange: { lower: 50_000, upper: 100_000 } }),
      ON,
    );
    expect(both.arrRange).toEqual({ lowerBoundary: 50_000, upperBoundary: 100_000 });
  });

  // An open range is not a range. Sending `{}` would be a filter object the
  // backend has to decide what to do with, for a control the reader cleared.
  it("omits the ARR range once both ends are cleared", () => {
    expect(
      analysisAccountsRequest(narrowed({ arrRange: { lower: null, upper: null } }), ON),
    ).not.toHaveProperty("arrRange");
  });

  // Zero is a boundary someone might genuinely want, and `!value` would drop
  // it. The source guards on `!== null && !== undefined` for this reason.
  it("keeps a zero boundary, which a truthiness check would lose", () => {
    const body = analysisAccountsRequest(narrowed({ arrRange: { lower: 0, upper: null } }), ON);
    expect(body.arrRange).toEqual({ lowerBoundary: 0 });
  });

  it("omits a list the reader emptied rather than sending []", () => {
    const body = analysisAccountsRequest(narrowed({ salesRegions: [], lifetimeYears: [] }), ON);
    expect(body).not.toHaveProperty("salesRegions");
    expect(body).not.toHaveProperty("customerLifetime");
  });
});

describe("POST /exit-arr/search", () => {
  // The summary figure above the table. A SPAN, so it carries both dates —
  // and the span the source asks for is "since the end of last calendar year",
  // which is what makes the figure a year-to-date reading rather than a
  // balance. `arrAnalysisApi.js:41-46`.
  it("asks from the end of the previous calendar year to the chosen day", () => {
    const body = analysisExitArrRequest(narrowed(), ON);
    expect(body.startDate).toBe("2025-12-31");
    expect(body.endDate).toBe("2026-09-21");
  });

  // Where `/accounts` omits it. Not a tidiness difference: this body is also
  // the base ticket 14's per-industry and per-partner-model calls spread over,
  // and they compare against each other, so every one of them has to carry the
  // same unit list or the comparison is between differently-filtered figures.
  it("always names the unit list, including the whole-book default", () => {
    expect(analysisExitArrRequest(narrowed(), ON).businessUnits).toEqual(["ALL_BU"]);
    expect(
      analysisExitArrRequest(narrowed({ businessUnits: ["Integration"] }), ON).businessUnits,
    ).toEqual(["INTEGRATION_BU"]);
  });

  it("narrows by exactly what the table is narrowed by", () => {
    const filters = narrowed({
      partnerType: "Direct",
      salesRegions: ["Americas"],
      arrRange: { lower: 1_000, upper: null },
    });
    const accounts = analysisAccountsRequest(filters, ON);
    const exitArr = analysisExitArrRequest(filters, ON);
    expect(exitArr.partnerType).toBe(accounts.partnerType);
    expect(exitArr.salesRegions).toEqual(accounts.salesRegions);
    expect(exitArr.arrRange).toEqual(accounts.arrRange);
  });

  it("reads a January day back to the previous year's close", () => {
    const newYear = { year: 2027, month: 1, day: 2 };
    expect(analysisExitArrRequest(narrowed({ asOf: newYear }), ON).startDate).toBe("2026-12-31");
  });
});
