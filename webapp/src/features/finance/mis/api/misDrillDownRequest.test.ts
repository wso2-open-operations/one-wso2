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
  type MisDateRange,
} from "../util/misViewVocabulary";
import { DRILLABLE_ROW_IDS, customerArrTypeFor, drillDownRequest } from "./misDrillDownRequest";

// The body behind the customer drill-down: click a figure in the Build, ask
// which customers are inside it. Ported from digiops-finance
// `arrDashboard/components/DataGrid.js`, the `onCellClicked` else-branch
// (:604-792).
//
// THIS IS NOT `/arr-summary` WITH A ROW ATTACHED, and the differences are the
// whole reason it is its own builder. It sends no `prevColDateRange` at all; it
// OMITS `startDate` on an opening row; its `isFirstColumn` is narrower; and it
// adds `customerArrType`, which is the question being asked.

const DEFAULTS = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SUBSCRIPTION);

/** A closed calendar year, so the opening balance is the previous 31 December. */
const YEAR_2025: MisDateRange = { start: "2025/01/01", end: "2025/12/31" };

const ask = (rowId: string, over: Partial<MisAppliedFilters> = {}, isFirstColumn = false) =>
  drillDownRequest(rowId, YEAR_2025, { ...DEFAULTS, ...over }, { isFirstColumn });

describe("which figures can be drilled into", () => {
  // Fourteen rows of the Build open the dialog and every other row is inert —
  // the source keeps a Set of fourteen row-header LITERALS (DataGrid.js:630-645).
  // The port keys off row IDS instead, deliberately: the Build has FOUR rows
  // labelled "y/y growth", so a label is not an identity, and keying on one
  // would re-import an ambiguity the port already fixed.

  it("knows the fourteen rows the source lets a reader open", () => {
    expect([...DRILLABLE_ROW_IDS].sort()).toEqual(
      [
        "closing-customers",
        "ending-arr",
        "expansions",
        "lost",
        "lost-customers",
        "new-arr",
        "new-customers",
        "opening-arr",
        "opening-customers",
        "reductions",
        "transferred-in",
        "transferred-in-customers",
        "transferred-out",
        "transferred-out-customers",
      ].sort(),
    );
  });

  it("asks for nothing at all on a row that is not one of them", () => {
    // Two thirds of the Build. A y/y growth, a retention ratio, a percentage or
    // a section heading is not a set of customers, and the source answers a
    // click on one with silence — no dialog, no message. `null` is how that
    // silence reaches the caller.
    for (const rowId of ["ending-arr-yoy", "net-new", "gross-dollar-retention", "percent-new-total"]) {
      expect(ask(rowId)).toBeNull();
    }
  });
});

describe("which customers the backend is asked for", () => {
  // `customerArrType` is the whole question. Eight distinct row ids collapse
  // onto five answers, because a Build states most movements twice — once in
  // money and once in logos — and both mean the same set of customers.

  it("reads both the money row and the customer-count row as the same movement", () => {
    expect(customerArrTypeFor("new-arr")).toBe("New");
    expect(customerArrTypeFor("new-customers")).toBe("New");
    expect(customerArrTypeFor("lost")).toBe("Lost");
    expect(customerArrTypeFor("lost-customers")).toBe("Lost");
    expect(customerArrTypeFor("transferred-in")).toBe("Transferred In");
    expect(customerArrTypeFor("transferred-in-customers")).toBe("Transferred In");
    expect(customerArrTypeFor("transferred-out")).toBe("Transferred Out");
    expect(customerArrTypeFor("transferred-out-customers")).toBe("Transferred Out");
  });

  it("has no logo counterpart for Expansions or Reductions, and says so by name", () => {
    expect(customerArrTypeFor("expansions")).toBe("Expansions");
    expect(customerArrTypeFor("reductions")).toBe("Reductions");
  });

  it("asks for Closing on BOTH balances, opening and closing alike", () => {
    // The one mapping that is not obvious. An Opening balance and a Closing
    // balance are the same question — who was in the book — asked at two
    // different dates, so the source sends `Closing` for both and moves the
    // difference into the DATE. Getting this wrong would ask the backend for a
    // movement on a row that is a balance.
    expect(customerArrTypeFor("opening-arr")).toBe("Closing");
    expect(customerArrTypeFor("opening-customers")).toBe("Closing");
    expect(customerArrTypeFor("ending-arr")).toBe("Closing");
    expect(customerArrTypeFor("closing-customers")).toBe("Closing");
  });
});

describe("the dates, which are where an opening balance differs from every other row", () => {
  it("closes a movement on the column's end and opens it on the balance before", () => {
    expect(ask("new-arr")).toMatchObject({ startDate: "2024-12-31", endDate: "2025-12-31" });
  });

  it("reads an OPENING balance at the opening date, and sends no startDate at all", () => {
    // The source omits `startDate` on an opening row rather than sending a
    // zero-length span (DataGrid.js:747-749). An opening balance is a moment,
    // not a period: the question is who was in the book on that date, and a
    // start date would ask the backend for a movement instead.
    const opening = ask("opening-arr");
    expect(opening).toMatchObject({ endDate: "2024-12-31" });
    expect(opening).not.toHaveProperty("startDate");
  });

  it("reads a CLOSING balance at the column's own end, unlike an opening one", () => {
    // Both send `customerArrType: "Closing"`, so the date is the only thing
    // telling them apart — and it is the whole difference between the balance a
    // Build starts from and the one it ends at.
    expect(ask("ending-arr")).toMatchObject({ startDate: "2024-12-31", endDate: "2025-12-31" });
  });

  it("writes dates the way the wire wants them, not the way the grid shows them", () => {
    for (const rowId of ["opening-arr", "new-arr", "ending-arr"]) {
      const request = ask(rowId)!;
      expect(request.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (request.startDate) expect(request.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("the leftmost column, which the backend is told about", () => {
  it("is flagged on the leftmost column", () => {
    expect(ask("new-arr", {}, true)).toMatchObject({ isFirstColumn: true });
  });

  it("is absent everywhere else", () => {
    expect(ask("new-arr", {}, false)).not.toHaveProperty("isFirstColumn");
  });

  it("is withheld on a CLOSING balance even in the leftmost column", () => {
    // The narrower rule, and the one a port would miss: `isEndingType` excludes
    // Ending ARR and Closing Customers from the flag but NOT the opening rows
    // (DataGrid.js:779-780). `/arr-summary`'s own builder has no such exclusion
    // — it flags index 0 unconditionally — so this cannot be shared with it.
    expect(ask("ending-arr", {}, true)).not.toHaveProperty("isFirstColumn");
    expect(ask("closing-customers", {}, true)).not.toHaveProperty("isFirstColumn");
  });

  it("is still flagged on an OPENING balance in the leftmost column", () => {
    expect(ask("opening-arr", {}, true)).toMatchObject({ isFirstColumn: true });
  });
});

describe("the filters the drill-down carries", () => {
  // Unlike `/accounts`, which forwards nothing, this endpoint forwards the same
  // set `/arr-summary` does — the dialog is showing the customers behind a
  // figure that was itself computed under those filters, so a list that ignored
  // them would not add up to the figure it was opened from.

  it("forwards every list filter the reader narrowed, under its wire name", () => {
    const narrowed = ask("new-arr", {
      salesRegion: ["North America"],
      subRegion: ["Northeast"],
      billingCountry: ["USA"],
      shippingCountry: ["USA"],
      industry: ["Technology"],
      subIndustry: ["Software"],
      accountOwner: ["John Doe"],
      technicalOwner: ["alice@example.com"],
      channelManager: ["bob@example.com"],
    })!;
    expect(narrowed).toMatchObject({
      salesRegions: ["North America"],
      subRegions: ["Northeast"],
      billingCountries: ["USA"],
      shippingCountries: ["USA"],
      industries: ["Technology"],
      subIndustries: ["Software"],
      accountOwners: ["John Doe"],
      technicalOwners: ["alice@example.com"],
      channelManagers: ["bob@example.com"],
    });
  });

  it("omits a filter the reader left alone rather than sending it empty", () => {
    const request = ask("new-arr")!;
    expect(request).not.toHaveProperty("salesRegions");
    expect(request).not.toHaveProperty("partnerType");
  });

  it("carries the partner book only when it is one book", () => {
    expect(ask("new-arr", { channelDirect: "Channel" })).toMatchObject({ partnerType: "Channel" });
    expect(ask("new-arr", { channelDirect: "All" })).not.toHaveProperty("partnerType");
  });

  it("carries a confidence only on a Forecasted type", () => {
    const forecast = ask("new-arr", { arrType: "Forecasted ARR", confidenceLevel: "Commit" });
    expect(forecast).toMatchObject({ forecastType: "Commit" });
    const renewal = ask("new-arr", { arrType: "Renewal ARR", confidenceLevel: "Commit" });
    expect(renewal).not.toHaveProperty("forecastType");
  });

  it("never sends a prevColDateRange, which is the Build's question and not this one", () => {
    // `/arr-summary` sends one on every column because a Build reports y/y
    // movement. A customer list has nothing to compare against.
    expect(ask("new-arr")).not.toHaveProperty("prevColDateRange");
  });
});

describe("the business units the figure was computed over", () => {
  it("asks for every unit when the reader has not narrowed one", () => {
    expect(ask("new-arr")).toMatchObject({ businessUnits: ["ALL_BU"] });
  });

  it("translates the reader's unit into the code the backend knows", () => {
    expect(ask("new-arr", { buProductSelection: "BU_APIM" })).toMatchObject({
      businessUnits: ["APIM_BU"],
    });
  });

  it("asks for nothing at all when a custom selection names nothing", () => {
    // The source returns before opening the dialog (DataGrid.js:686). It is a
    // real dead click that depends on FILTER state rather than on the cell: with
    // Custom chosen and nothing ticked, every figure in the Build stops
    // responding. Reproduced, because the alternative — falling back to every
    // unit — would put the whole company's customers behind a filter chip
    // saying otherwise.
    const empty = ask("new-arr", {
      buProductSelection: CUSTOM_UNIT,
      customBusinessUnits: [],
      customProductUnits: [],
    });
    expect(empty).toBeNull();
  });

  it("sends a custom selection as the units themselves", () => {
    expect(
      ask("new-arr", { buProductSelection: CUSTOM_UNIT, customBusinessUnits: ["APIM_BU"] }),
    ).toMatchObject({ businessUnits: ["APIM_BU"] });
  });
});

describe("the type the figure was read at", () => {
  it("carries the Period's own type value", () => {
    expect(ask("new-arr", { arrType: "Closed Won ARR" })).toMatchObject({
      arrType: "Closed Won ARR",
    });
  });

  it("falls back to Total rather than omitting it", () => {
    expect(ask("new-arr")).toMatchObject({ arrType: "Total ARR" });
  });
});
