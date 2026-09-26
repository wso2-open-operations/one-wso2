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
  EMPTY_MIS_FILTER_OPTIONS,
  misFilterOptions,
  sortFilterOptions,
  type MisAppConfigs,
} from "./misAppConfigs";

// What the nine list filters and the two custom unit lists offer, out of the one
// `GET /app-configs` the ARR backend answers with.

describe("sorting an option list", () => {
  it("orders alphabetically, ignoring case", () => {
    expect(sortFilterOptions(["banana", "Apple", "cherry"])).toEqual(["Apple", "banana", "cherry"]);
  });

  it("orders embedded numbers by value rather than by digit", () => {
    expect(sortFilterOptions(["Region 10", "Region 2"])).toEqual(["Region 2", "Region 10"]);
  });

  it("leaves the caller's array alone", () => {
    const original = ["b", "a"];
    expect(sortFilterOptions(original)).toEqual(["a", "b"]);
    expect(original).toEqual(["b", "a"]);
  });

  it("answers with an empty list for anything that is not one", () => {
    expect(sortFilterOptions(undefined)).toEqual([]);
    expect(sortFilterOptions("EMEA" as unknown as string[])).toEqual([]);
  });
});

describe("the option lists a response carries", () => {
  const response: MisAppConfigs = {
    billingCountries: ["Narnia"],
    shippingCountries: ["United States", "Sri Lanka"],
    salesRegions: ["EMEA", "APAC"],
    subRegions: ["ANZ"],
    industries: ["Utilities", "Retail"],
    subIndustries: ["Water"],
    technicalOwners: ["Tess Tucker"],
    channelManagers: ["Chan Mann"],
    accountOwners: [
      { name: "Zoe Zed", email: "zoe@wso2.com" },
      { name: "Ada Ames", email: "ada@wso2.com" },
    ],
    businessUnits: ["IAM_BU", "APIM_BU"],
    productUnits: ["IAM_CLOUD", "APIM_SOFTWARE"],
    helpEmail: "finance@wso2.com",
    productsUsageEnabled: true,
  };

  it("sorts every list it hands to a control", () => {
    const options = misFilterOptions(response);
    expect(options.salesRegions).toEqual(["APAC", "EMEA"]);
    expect(options.businessUnits).toEqual(["APIM_BU", "IAM_BU"]);
    expect(options.productUnits).toEqual(["APIM_SOFTWARE", "IAM_CLOUD"]);
  });

  it("reduces an account owner to the name a filter is written in terms of", () => {
    // The wire type is `Owner { name, email }` for this one list and plain
    // strings for the other eight — so the email stops here, and what goes into
    // a URL and onto the wire as `accountOwners` is the name.
    expect(misFilterOptions(response).accountOwners).toEqual(["Ada Ames", "Zoe Zed"]);
  });

  it("offers the SHIPPING countries under both country filters", () => {
    // Bug-for-bug, ADR 0003. The backend answers with `billingCountries` too and
    // the source app never reads it: `ArrDashboard.js:52` puts `shippingCountries`
    // into one `countries` list and both controls take their options from it.
    const options = misFilterOptions(response);
    expect(options.countries).toEqual(["Sri Lanka", "United States"]);
    expect(options.countries).not.toContain("Narnia");
  });

  it("adds BFSI to the industries the backend knows about", () => {
    // Also bug-for-bug: a hard-coded entry the source appends client-side
    // (`ArrDashboard.js:54`). Dropping it would take a filter Finance uses
    // today off the menu.
    expect(misFilterOptions(response).industries).toEqual(["BFSI", "Retail", "Utilities"]);
  });

  it("does not add BFSI twice once the backend starts sending it", () => {
    expect(misFilterOptions({ ...response, industries: ["BFSI", "Retail"] }).industries)
      .toEqual(["BFSI", "Retail"]);
  });
});

describe("a response with nothing in it", () => {
  it("leaves every control with an empty menu rather than throwing", () => {
    expect(misFilterOptions({})).toEqual({ ...EMPTY_MIS_FILTER_OPTIONS, industries: ["BFSI"] });
    expect(misFilterOptions(undefined)).toEqual(EMPTY_MIS_FILTER_OPTIONS);
  });

  it("skips an account owner with no name rather than offering a blank option", () => {
    const options = misFilterOptions({
      accountOwners: [{ email: "ghost@wso2.com" }, { name: "", email: "" }, { name: "Ada Ames" }],
    });
    expect(options.accountOwners).toEqual(["Ada Ames"]);
  });
});
