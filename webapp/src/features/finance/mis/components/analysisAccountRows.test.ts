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
  analysisAccountRows,
  analysisScrapedOptions,
  mergeScrapedOptions,
  parseProductsInUse,
  type AnalysisAccountsResponse,
} from "./analysisAccountRows";

// `POST /accounts` as ARR Analysis reads it. Ported from
// digiops-finance `arrAnalysis/ArrAnalysisDashboard.js:345-368`
// (`toDashboardRows`) and `:283-300` (`parseProductsInUse`).

const account = (over: Partial<AnalysisAccountsResponse> = {}): AnalysisAccountsResponse => ({
  id: "001",
  name: "Northwind",
  productsInUse: "IAM,Choreo",
  partnerType: "Direct",
  salesRegions: "EMEA",
  subRegion: "UK & Ireland",
  billingCountry: "United Kingdom",
  customerLifetime: "3",
  apimBuTotal: 10,
  iamBuTotal: 20,
  integrationBuTotal: 30,
  choreoBuTotal: 40,
  agentPlatformBuTotal: 50,
  moesifBuTotal: 60,
  arrGrandTotal: 210,
  ...over,
});

describe("parseProductsInUse", () => {
  it("splits the backend's comma string", () => {
    expect(parseProductsInUse("IAM,Choreo")).toEqual(["IAM", "Choreo"]);
  });

  it("trims the spacing around each name", () => {
    expect(parseProductsInUse(" IAM , Choreo ")).toEqual(["IAM", "Choreo"]);
  });

  it("drops the empties a trailing or doubled comma leaves behind", () => {
    expect(parseProductsInUse("IAM,,Choreo,")).toEqual(["IAM", "Choreo"]);
  });

  it("keeps each product once", () => {
    expect(parseProductsInUse("IAM,Choreo,IAM")).toEqual(["IAM", "Choreo"]);
  });

  // The field is `string?` on the wire, so absent is the ordinary case for an
  // account running nothing the field tracks — not an error.
  it("reads an absent or empty field as no products", () => {
    expect(parseProductsInUse(undefined)).toEqual([]);
    expect(parseProductsInUse(null)).toEqual([]);
    expect(parseProductsInUse("")).toEqual([]);
  });

  // The source accepts an array here too, though the backend declares a
  // string. Kept: a gateway that helpfully JSON-decodes a list would otherwise
  // blank the chips on every row with no error anywhere.
  it("accepts a list, in case something between here and the service made one", () => {
    expect(parseProductsInUse(["IAM", " Choreo ", "", "IAM"])).toEqual(["IAM", "Choreo"]);
  });
});

describe("analysisAccountRows", () => {
  it("reads each account's figures off the fields the backend sends", () => {
    const [row] = analysisAccountRows([account()]);
    expect(row.accountName).toBe("Northwind");
    expect(row.apimBu).toBe(10);
    expect(row.iamBu).toBe(20);
    expect(row.integrationBu).toBe(30);
    expect(row.choreoBu).toBe(40);
    expect(row.agentPlatformBu).toBe(50);
    expect(row.moesifBu).toBe(60);
    expect(row.totalArr).toBe(210);
  });

  it("carries both readings of the products field", () => {
    const [row] = analysisAccountRows([account({ productsInUse: "IAM, Choreo" })]);
    // The parsed list is what the chips render…
    expect(row.products).toEqual(["IAM", "Choreo"]);
    // …and the string is what the CSV carries, because a column exporting
    // "[object Object]" is the failure this pair exists to prevent. Normalised
    // spacing, because it is built from the list above rather than taken raw.
    expect(row.productsInUse).toBe("IAM,Choreo");
  });

  // The two readings are built from one parse, so a response shape that reaches
  // only one of them cannot exist. An account whose products arrived as an
  // array used to show chips on screen and export an empty cell.
  it("keeps the chips and the CSV agreeing however the field arrived", () => {
    for (const arrived of ["IAM, Choreo", ["IAM", "Choreo"], "IAM,,Choreo,"]) {
      const [row] = analysisAccountRows([account({ productsInUse: arrived })]);
      expect(row.productsInUse, String(arrived)).toBe(row.products.join(","));
    }
  });

  // The grid needs a unique `id` per row and the backend's account id is not
  // reliably one — the source suffixes the index for exactly this reason. Two
  // rows sharing an id makes the grid render one and silently drop the other.
  it("gives every row its own id, even when two accounts share one", () => {
    const rows = analysisAccountRows([account({ id: "dup" }), account({ id: "dup" })]);
    expect(rows[0].id).not.toBe(rows[1].id);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it("still gives a row an id when the account has none", () => {
    const [row] = analysisAccountRows([account({ id: undefined })]);
    expect(row.id).toBeTruthy();
  });

  // A DEVIATION from the source, and a deliberate one. `customerLifetime` is
  // `string` on the wire and the source's column takes the default string type,
  // so its Lifetime sorts lexicographically: "10 yrs" lands above "2 yrs". A
  // sort order is not a figure Finance reconciles, so ADR 0003 does not protect
  // it — this is a defect, and the port coerces the value and types the column
  // as a number. Spec §7.
  it("reads the lifetime as a number, so the column can sort as one", () => {
    const rows = analysisAccountRows([
      account({ customerLifetime: "10" }),
      account({ customerLifetime: "2" }),
    ]);
    expect(rows.map((row) => row.lifetimeYears)).toEqual([10, 2]);
  });

  it("reads a missing or unparseable lifetime as zero rather than NaN", () => {
    const rows = analysisAccountRows([
      account({ customerLifetime: undefined }),
      account({ customerLifetime: "unknown" }),
    ]);
    expect(rows.map((row) => row.lifetimeYears)).toEqual([0, 0]);
  });

  // A `decimal` arriving as a JSON string is what a Ballerina service does when
  // precision matters, and a grid column typed `number` handed a string sorts
  // it as text. Coerced once here so no column has to think about it.
  it("reads a figure that arrived as a string, and a missing one as zero", () => {
    const [row] = analysisAccountRows([
      account({ apimBuTotal: "1234.50" as unknown as number, iamBuTotal: undefined }),
    ]);
    expect(row.apimBu).toBe(1234.5);
    expect(row.iamBu).toBe(0);
  });

  it("reads a body that is not a list as no rows", () => {
    expect(analysisAccountRows(undefined)).toEqual([]);
    expect(analysisAccountRows(null as unknown as AnalysisAccountsResponse[])).toEqual([]);
  });
});

describe("the menus scraped from the loaded accounts", () => {
  // The fallback half of every list menu: used when `GET /app-configs` has not
  // answered, or has no list for that control. Partner Type is the one control
  // the backend sends NO list for, so this is its only source beyond the two
  // models written down.
  it("offers each distinct value the loaded accounts report, sorted", () => {
    const rows = analysisAccountRows([
      account({ salesRegions: "EMEA", partnerType: "Direct", billingCountry: "Sri Lanka" }),
      account({ salesRegions: "APAC", partnerType: "Channel", billingCountry: "Japan" }),
      account({ salesRegions: "EMEA", partnerType: "Direct", billingCountry: "Japan" }),
    ]);
    const options = analysisScrapedOptions(rows);
    expect(options.salesRegions).toEqual(["APAC", "EMEA"]);
    expect(options.partnerTypes).toEqual(["Channel", "Direct"]);
    expect(options.countries).toEqual(["Japan", "Sri Lanka"]);
  });

  it("leaves out the accounts that report nothing for a field", () => {
    const rows = analysisAccountRows([
      account({ salesRegions: "EMEA" }),
      account({ salesRegions: "" }),
      account({ salesRegions: undefined }),
    ]);
    expect(analysisScrapedOptions(rows).salesRegions).toEqual(["EMEA"]);
  });

  // The menus ACCUMULATE across fetches and never shrink, which is the source's
  // behaviour (`mergeUniqueOptions` over the previous set) and load-bearing in
  // the degraded case: without it, narrowing to EMEA leaves a Sales Region menu
  // offering EMEA alone, so the reader cannot switch to APAC without first
  // clearing the filter they want to change.
  it("keeps what earlier fetches showed, so a menu never narrows itself shut", () => {
    const merged = mergeScrapedOptions(
      { partnerTypes: ["Direct"], salesRegions: ["EMEA"], subRegions: [], countries: [] },
      { partnerTypes: ["Channel"], salesRegions: ["APAC"], subRegions: ["Japan"], countries: [] },
    );
    expect(merged.salesRegions).toEqual(["APAC", "EMEA"]);
    expect(merged.partnerTypes).toEqual(["Channel", "Direct"]);
    expect(merged.subRegions).toEqual(["Japan"]);
  });

  it("returns the set it was given when nothing new arrived, so React can skip the render", () => {
    const held = { partnerTypes: ["Direct"], salesRegions: ["EMEA"], subRegions: [], countries: [] };
    expect(mergeScrapedOptions(held, { ...held })).toBe(held);
  });
});
