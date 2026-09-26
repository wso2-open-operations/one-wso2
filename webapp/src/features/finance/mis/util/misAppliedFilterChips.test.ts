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
import { defaultAppliedFilters } from "./misViewState";
import {
  MIS_PERIODS,
  MIS_TABLES,
  MIS_WINDOWS,
  type MisAppliedFilters,
  type MisPeriod,
  type MisTable,
  type MisWindow,
} from "./misViewVocabulary";
import { describeAppliedFilters } from "./misAppliedFilterChips";

// What the reader is looking at, said in words under the controls — so a view
// restored from somebody's link explains itself without opening every menu.

const { ANNUALLY, QUARTERLY } = MIS_PERIODS;
const { SUBSCRIPTION, SOFTWARE_CLOUD_CUSTOMERS } = MIS_TABLES;

const chipsFor = (
  over: Partial<MisAppliedFilters> = {},
  {
    table = SUBSCRIPTION,
    period = ANNUALLY,
    viewWindow = MIS_WINDOWS.CALENDAR,
  }: { table?: MisTable; period?: MisPeriod; viewWindow?: MisWindow } = {},
) =>
  describeAppliedFilters({ ...defaultAppliedFilters(period, table), ...over }, {
    period,
    table,
    viewWindow,
  });

const labels = (...args: Parameters<typeof chipsFor>) => chipsFor(...args).map((chip) => chip.label);

describe("a view nobody has narrowed", () => {
  it("says only how many years it covers", () => {
    expect(labels()).toEqual(["Years Back: 5"]);
  });

  it("does not offer to remove the years, because there is no view without them", () => {
    expect(chipsFor()[0]).toMatchObject({ key: "yearsBack", removable: false });
  });
});

describe("a view somebody has narrowed", () => {
  it("describes each filter that differs from the default, in a fixed order", () => {
    expect(
      labels({
        arrType: "Forecasted ARR",
        confidenceLevel: "GM",
        viewType: "Sales Region",
        salesRegion: ["EMEA", "APAC"],
        channelDirect: "Channel",
        industry: ["Utilities"],
      }),
    ).toEqual([
      // Years Back is absent: a forecast has no years to go back over, and its
      // control is hidden for the same reason.
      "Type: Forecasted ARR",
      "Forecast Type: GM's Commit",
      "View: Sales Region",
      "Sales Region: EMEA, APAC",
      "Channel/Direct: Channel",
      "Industry: Utilities",
    ]);
  });

  it("names a type the way the control does", () => {
    expect(labels({ arrType: "Delayed ARR" }, { table: SOFTWARE_CLOUD_CUSTOMERS }))
      .toContain("Type: Only Delayed ARR");
    expect(labels({ arrType: "Closed Won ARR" })).toContain("Type: Only Closed Won ARR");
  });

  it("writes a switch as On or Off rather than as true", () => {
    expect(labels({ isYtd: false })).toContain("YTD: Off");
    const quarterly = { period: QUARTERLY, table: SUBSCRIPTION };
    expect(labels({ cumulativeQuarterly: true }, quarterly)).toContain("Cumulative Quarterly: On");
  });

  it("offers every one of them for removal", () => {
    const chips = chipsFor({ viewType: "Sub Region", subRegion: ["ANZ"] });
    expect(chips.filter((chip) => chip.key !== "yearsBack").every((chip) => chip.removable)).toBe(true);
  });

  it("shows the Years Back the reader chose, not the Table's default", () => {
    expect(labels({ yearsBack: 3 })[0]).toBe("Years Back: 3");
  });
});

describe("filters the view has no control for", () => {
  // The chip strip and the controls answer to the same rules, so a reader never
  // sees a chip for a filter they cannot find, nor a hidden control quietly
  // narrowing their figures.
  it("says nothing about Confidence outside a Forecasted type", () => {
    expect(labels({ arrType: "Renewal ARR", confidenceLevel: "GM" }))
      .not.toContain("Forecast Type: GM's Commit");
  });

  it("says nothing about YTD on a trailing window", () => {
    expect(labels({ isYtd: false }, { viewWindow: MIS_WINDOWS.TTM }))
      .not.toContain("YTD: Off");
  });

  it("says nothing about a cumulative flag on Annually, which has none", () => {
    expect(labels().some((label) => label.startsWith("Cumulative"))).toBe(false);
  });

  it("keeps Years Back on a Delayed Build, where the control is still offered", () => {
    // The source drops this chip on any Delayed type while leaving the Build's
    // control on screen — so the reader sees a Years Back of 3 and no chip
    // saying so. One rule now answers both.
    expect(labels({ arrType: "Delayed ARR", yearsBack: 3 }, { viewWindow: MIS_WINDOWS.TTM })[0])
      .toBe("Years Back: 3");
    expect(labels({ arrType: "Delayed ARR", yearsBack: 3 }, { table: SOFTWARE_CLOUD_CUSTOMERS }))
      .not.toContain("Years Back: 3");
  });
});

describe("what is never a chip", () => {
  it("says nothing about the unit selection, which the tabs above already show", () => {
    const chips = chipsFor({ buProductSelection: "SW_APIM", customBusinessUnits: ["APIM_BU"] });
    expect(chips.map((chip) => chip.key)).toEqual(["yearsBack"]);
  });

  it("says nothing about the derived fields, which nobody chose", () => {
    const chips = chipsFor({ forecast: "Enable", columnDateRanges: [] });
    expect(chips.map((chip) => chip.key)).toEqual(["yearsBack"]);
  });
});
