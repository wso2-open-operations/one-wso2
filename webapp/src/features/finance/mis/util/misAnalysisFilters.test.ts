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
  ANALYSIS_FIRST_SALE,
  analysisBusinessUnitsConflict,
  analysisFilterTags,
  analysisProductCountOptions,
  analysisYearsLabel,
  defaultAnalysisFilters,
  minimumProductCount,
  withBusinessUnits,
  type MisAnalysisFilters,
} from "./misAnalysisFilters";

// The rules ARR Analysis's ten controls obey, away from any component.

const ON = { year: 2026, month: 9, day: 21 };
const narrowed = (over: Partial<MisAnalysisFilters> = {}): MisAnalysisFilters => ({
  ...defaultAnalysisFilters(ON),
  ...over,
});

describe("the view it opens on", () => {
  it("narrows nothing, and reads the book as at today", () => {
    const filters = defaultAnalysisFilters(ON);
    expect(filters.businessUnits).toEqual([]);
    expect(filters.salesRegions).toEqual([]);
    expect(filters.arrRange).toEqual({ lower: null, upper: null });
    expect(filters.asOf).toEqual(ON);
  });

  // The source's default is a module-level `new Date()`, frozen when the bundle
  // loads — so a tab left open overnight still opens on yesterday, and the
  // "TODAY" label it computes against the real today then disagrees with it.
  it("takes today as an argument rather than freezing it at import", () => {
    const tomorrow = { year: 2026, month: 9, day: 22 };
    expect(defaultAnalysisFilters(tomorrow).asOf).toEqual(tomorrow);
  });
});

describe("Business Units and the product counts that depend on them", () => {
  // An account cannot run fewer distinct products than the number of Business
  // Units it has been narrowed to, so those counts would return nothing.
  it("raises the lowest offered count as more Business Units are chosen", () => {
    expect(minimumProductCount([])).toBe(1);
    expect(minimumProductCount(["IAM"])).toBe(1);
    expect(minimumProductCount(["IAM", "Choreo"])).toBe(2);
    expect(minimumProductCount(["IAM", "Choreo", "Integration"])).toBe(3);
  });

  // 4 means "4 or more", so it is the ceiling as well as an option — there is
  // no 6 for five Business Units to demand.
  it("stops raising it at 4, which is the open-ended option", () => {
    expect(minimumProductCount(["a", "b", "c", "d", "e"])).toBe(4);
    expect(analysisProductCountOptions(["a", "b", "c", "d", "e"])).toEqual([4, 5]);
  });

  it("offers every count when nothing narrows them", () => {
    expect(analysisProductCountOptions([])).toEqual([1, 2, 3, 4, 5]);
  });

  // The half that is easy to leave out. Choosing a second Business Unit while
  // "1 product in use" is pressed leaves a filter pair that can match nothing —
  // and the control has just stopped offering the option that would clear it.
  it("drops a chosen count the new Business Units have made impossible", () => {
    const filters = narrowed({ productCounts: [1, 3] });
    expect(withBusinessUnits(filters, ["IAM", "Choreo"]).productCounts).toEqual([3]);
  });

  it("leaves the counts alone when they all still stand", () => {
    const filters = narrowed({ productCounts: [3, 4] });
    const next = withBusinessUnits(filters, ["IAM", "Choreo"]);
    expect(next.productCounts).toEqual([3, 4]);
    expect(next.productCounts).toBe(filters.productCounts);
  });

  // Moesif's ARR is already counted inside the API Platform BU, so asking for
  // both double-counts it.
  it("knows the one pair that cannot be asked for together", () => {
    expect(analysisBusinessUnitsConflict(["API Platform", "Moesif"])).toBe(true);
    expect(analysisBusinessUnitsConflict(["API Platform", "IAM"])).toBe(false);
    expect(analysisBusinessUnitsConflict(["Moesif"])).toBe(false);
  });
});

describe("the tags above the table", () => {
  // A DEVIATION, and the reason is arithmetic. The source pushes a Partner Type
  // tag UNCONDITIONALLY and an As of Date tag whenever a date is set — which it
  // is by default — so a screen narrowing nothing at all reads "2 active" and
  // offers Clear all. A count that can never reach zero cannot tell a reader
  // whether anything is narrowed, which is the only question it is there to
  // answer. Spec §7.
  it("is empty on the view the screen opens on", () => {
    expect(analysisFilterTags(defaultAnalysisFilters(ON), ON)).toEqual([]);
  });

  it("names a partner model once one is chosen", () => {
    const tags = analysisFilterTags(narrowed({ partnerType: "Channel" }), ON);
    expect(tags.map((tag) => tag.label)).toEqual(["Partner Type: Channel"]);
  });

  it("names a date only once it is not today", () => {
    expect(analysisFilterTags(narrowed({ asOf: ON }), ON)).toEqual([]);
    const tags = analysisFilterTags(narrowed({ asOf: { year: 2026, month: 3, day: 1 } }), ON);
    expect(tags.map((tag) => tag.label)).toEqual(["As Of: 2026-03-01"]);
  });

  it("names one tag per value in a list, so any one of them can be dropped", () => {
    const tags = analysisFilterTags(narrowed({ salesRegions: ["EMEA", "APAC"] }), ON);
    expect(tags.map((tag) => tag.label)).toEqual(["Sales Region: EMEA", "Sales Region: APAC"]);
  });

  it("writes a lifetime the way the control does", () => {
    const tags = analysisFilterTags(narrowed({ lifetimeYears: [1, 4] }), ON);
    expect(tags.map((tag) => tag.label)).toEqual(["Lifetime: 1 yr", "Lifetime: 4 yrs"]);
  });

  it("writes the open-ended product count as 4+", () => {
    const tags = analysisFilterTags(narrowed({ productCounts: [4] }), ON);
    expect(tags.map((tag) => tag.label)).toEqual(["# Products In Use: 4+"]);
  });

  it("names each end of the ARR range separately, so one can be lifted", () => {
    const tags = analysisFilterTags(narrowed({ arrRange: { lower: 50_000, upper: 1_000_000 } }), ON);
    expect(tags.map((tag) => tag.label)).toEqual(["ARR from $50K", "ARR to $1M"]);
  });

  it("names both First Sale states", () => {
    expect(
      analysisFilterTags(narrowed({ firstSale: ANALYSIS_FIRST_SALE.ONLY }), ON)[0].label,
    ).toBe("First Sale: Only");
    expect(
      analysisFilterTags(narrowed({ firstSale: ANALYSIS_FIRST_SALE.EXCLUDE }), ON)[0].label,
    ).toBe("First Sale: Exclude");
  });

  // Each tag carries what dismissing it does, so the panel never has to work
  // out which control a label came from.
  it("carries the change that dismissing it makes", () => {
    const filters = narrowed({ salesRegions: ["EMEA", "APAC"], partnerType: "Direct" });
    const tags = analysisFilterTags(filters, ON);

    const emea = tags.find((tag) => tag.label === "Sales Region: EMEA")!;
    expect({ ...filters, ...emea.patch }.salesRegions).toEqual(["APAC"]);

    const partner = tags.find((tag) => tag.label.startsWith("Partner Type"))!;
    expect({ ...filters, ...partner.patch }.partnerType).toBe("all");
  });

  it("gives every tag its own key, so two values of one filter do not collide", () => {
    const tags = analysisFilterTags(
      narrowed({ salesRegions: ["EMEA", "APAC"], subRegions: ["EMEA"] }),
      ON,
    );
    expect(new Set(tags.map((tag) => tag.id)).size).toBe(tags.length);
  });
});

describe("analysisYearsLabel", () => {
  it("pluralises", () => {
    expect(analysisYearsLabel(0)).toBe("0 yrs");
    expect(analysisYearsLabel(1)).toBe("1 yr");
    expect(analysisYearsLabel(2)).toBe("2 yrs");
  });
});
