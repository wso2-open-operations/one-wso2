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
  MIS_UNITS_BY_CATEGORY,
  defaultUnitCode,
  formatUnitLabel,
  unitCategoryOf,
} from "./misUnits";

// Which Build a reader is looking at: a business unit, a software line, a cloud
// line, or a set of units they picked themselves.

describe("the unit a code belongs to", () => {
  it("reads the category off the code's prefix", () => {
    expect(unitCategoryOf("BU_APIM")).toBe("BU");
    expect(unitCategoryOf("SW_ALL")).toBe("Software");
    expect(unitCategoryOf("CL_MOESIF")).toBe("Cloud");
    expect(unitCategoryOf("CUSTOM")).toBe("Custom");
  });

  it("falls back to BU for a code from a future the app has not seen", () => {
    // The codes come from `/app-configs` at runtime, so a unit added tomorrow
    // reaches a release from today. Landing on the BU tab is wrong in a small
    // way; throwing would be wrong in a large one.
    expect(unitCategoryOf("BU_SOMETHING_NEW")).toBe("BU");
    expect(unitCategoryOf("")).toBe("BU");
  });

  it("names the whole-category code each tab opens on", () => {
    expect(defaultUnitCode("BU")).toBe("BU_ALL");
    expect(defaultUnitCode("Software")).toBe("SW_ALL");
    expect(defaultUnitCode("Cloud")).toBe("CL_ALL");
    expect(defaultUnitCode("Custom")).toBe("CUSTOM");
  });
});

describe("the units each category offers", () => {
  it("ends every list with the whole category, not begins it", () => {
    for (const category of ["BU", "Software", "Cloud"] as const) {
      const codes = MIS_UNITS_BY_CATEGORY[category].map((unit) => unit.code);
      expect(codes.at(-1)).toBe(defaultUnitCode(category));
    }
  });

  it("offers the codes the URL contract accepts", () => {
    const every = Object.values(MIS_UNITS_BY_CATEGORY).flat();
    for (const { code } of every) expect(code).toMatch(/^(BU|SW|CL)_[A-Z_]+$/);
  });

  it("names a cloud line by what it actually covers", () => {
    // Not a suffix on the product name: these say which products are in the
    // line, and Finance reads them that way.
    const cloud = MIS_UNITS_BY_CATEGORY.Cloud;
    expect(cloud.find((unit) => unit.code === "CL_IAM")?.label)
      .toBe("IAM Private Cloud + Asgardeo");
    expect(cloud.find((unit) => unit.code === "CL_CHOREO")?.label).toBe("Choreo");
  });
});

describe("naming a unit the backend sent", () => {
  // The two custom lists arrive from `/app-configs` as wire codes, and go back
  // out on the wire unchanged — so this is a label and never a value.
  it("uses the name Finance knows where the code does not carry it", () => {
    expect(formatUnitLabel("APIM_CLOUD")).toBe("API Platform Private Cloud + Bjira");
    expect(formatUnitLabel("CHOREO_CLOUD")).toBe("Choreo");
    expect(formatUnitLabel("MOESIF_CLOUD")).toBe("Moesif");
    expect(formatUnitLabel("APIM_BU")).toBe("API Platform BU");
  });

  it("title-cases anything else, keeping the acronyms shouting", () => {
    expect(formatUnitLabel("INTEGRATION_SOFTWARE")).toBe("Integration Software");
    expect(formatUnitLabel("IAM_SOFTWARE")).toBe("IAM Software");
    expect(formatUnitLabel("SOMETHING_NEW_BU")).toBe("Something New BU");
  });

  it("tolerates whitespace and case the backend did not tidy", () => {
    expect(formatUnitLabel("  apim_bu  ")).toBe("API Platform BU");
    expect(formatUnitLabel("integration software")).toBe("Integration Software");
  });

  it("answers with an empty string for nothing at all", () => {
    expect(formatUnitLabel("")).toBe("");
  });
});
