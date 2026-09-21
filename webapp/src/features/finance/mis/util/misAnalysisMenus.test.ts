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
import { analysisMenus, EMPTY_ANALYSIS_MENUS } from "./misAnalysisMenus";
import { EMPTY_SCRAPED_OPTIONS } from "../components/analysisAccountRows";

// What each of ARR Analysis's four list controls actually offers.
//
// ONE rule for all four — the backend's list, else what the loaded accounts
// show — where the source has four. That is the deviation this module exists
// for, and it is recorded in spec §7. The source's four:
//
//   Sales Region  a HARD-CODED list of four, or the scrape
//                 (`REGION_OPTIONS_FALLBACK`)
//   Sub Region    `appConfigs.subRegions`, else the scrape — correct
//   Country       `appConfigs.billingcountrys`, else the scrape — and that key
//                 is never on the response, so it is always the scrape
//   Partner Type  `["Channel", "Direct"]` merged with the scrape

const scraped = {
  partnerTypes: ["Reseller"],
  salesRegions: ["Oceania"],
  subRegions: ["Nordics"],
  countries: ["Sri Lanka"],
};

describe("each list menu", () => {
  it("takes the backend's list when there is one", () => {
    const menus = analysisMenus(
      {
        salesRegions: ["APAC", "EMEA"],
        subRegions: ["UK & Ireland"],
        billingCountries: ["Japan"],
      },
      scraped,
    );
    expect(menus.salesRegions).toEqual(["APAC", "EMEA"]);
    expect(menus.subRegions).toEqual(["UK & Ireland"]);
    expect(menus.countries).toEqual(["Japan"]);
  });

  // The whole point of keeping the scrape. `GET /app-configs` failing must not
  // leave every control on this screen with an empty menu — the table is still
  // there and still narrowable by what it is showing.
  it("falls back to what the loaded accounts show when the backend has none", () => {
    const menus = analysisMenus({}, scraped);
    expect(menus.salesRegions).toEqual(["Oceania"]);
    expect(menus.subRegions).toEqual(["Nordics"]);
    expect(menus.countries).toEqual(["Sri Lanka"]);
  });

  // `billingCountries`, not `countries`. The Build's `countries` is the
  // SHIPPING list under ADR 0003's reproduced substitution, and ARR Analysis's
  // Country control filters on `billingCountries` — so feeding it the Build's
  // list would make the menu and the request disagree about which country a
  // country is.
  it("takes the billing list for Country, not the Build's shipping one", () => {
    const menus = analysisMenus(
      { countries: ["Shipped To"], billingCountries: ["Billed In"] },
      EMPTY_SCRAPED_OPTIONS,
    );
    expect(menus.countries).toEqual(["Billed In"]);
  });
});

describe("Partner Type", () => {
  // The one control `GET /app-configs` sends no list for. Channel and Direct
  // are written down because they are the model itself rather than data —
  // CONTEXT.md names them — so the control offers them before any account has
  // loaded.
  it("always offers the two partner models, loaded accounts or not", () => {
    expect(analysisMenus({}, EMPTY_SCRAPED_OPTIONS).partnerTypes).toEqual(["Channel", "Direct"]);
  });

  // Merged rather than replaced: the two models are a floor, not a ceiling. An
  // account reporting something else is a fact about the book, and a menu that
  // hid it would leave rows nothing on the screen can select.
  it("adds anything else the accounts actually report", () => {
    expect(analysisMenus({}, scraped).partnerTypes).toEqual(["Channel", "Direct", "Reseller"]);
  });

  it("does not list a model twice when the accounts report one of them", () => {
    const menus = analysisMenus({}, { ...EMPTY_SCRAPED_OPTIONS, partnerTypes: ["Direct"] });
    expect(menus.partnerTypes).toEqual(["Channel", "Direct"]);
  });
});

describe("before anything has answered", () => {
  it("offers the partner models and nothing else", () => {
    const menus = analysisMenus({}, EMPTY_SCRAPED_OPTIONS);
    expect(menus).toEqual({
      ...EMPTY_ANALYSIS_MENUS,
      partnerTypes: ["Channel", "Direct"],
    });
  });
});
