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
  type MisWindow,
} from "./misViewVocabulary";
import {
  appliedFromPending,
  confidenceLabel,
  filterResetNotice,
  filtersAfterSwitch,
  misFilterBarControls,
  normalisePending,
  pendingFromApplied,
  samePending,
  typeLabel,
  usesConfidence,
  usesYearsBack,
  yearsBackToRemember,
  type MisPendingFilters,
} from "./misFilterBarModel";

// The filter bar as arithmetic: what the controls hold before APPLY, what a
// change to one of them does to the others, and whether the grid on screen is
// still the one the controls describe.
//
// None of this touches the DOM. The bar's own tests are then about what a
// reader sees and does; these are about what the rules say.

const { ANNUALLY, QUARTERLY } = MIS_PERIODS;
const { SUBSCRIPTION, SOFTWARE_CLOUD_CUSTOMERS, EXIT_ARR_BY_REGION } = MIS_TABLES;
const { CALENDAR, TTM } = MIS_WINDOWS;

/** An Applied set for the ARR Build, narrowed however the test needs. */
const appliedFor = (over: Partial<MisAppliedFilters> = {}): MisAppliedFilters => ({
  ...defaultAppliedFilters(ANNUALLY, SUBSCRIPTION),
  ...over,
});
const pendingFor = (over: Partial<MisAppliedFilters> = {}): MisPendingFilters =>
  pendingFromApplied(appliedFor(over), ANNUALLY);

describe("seeding the controls from the Applied set", () => {
  it("puts the Period's own type under one key, whichever Period it is", () => {
    expect(pendingFor({ arrType: "Renewal ARR" }).typeValue).toBe("Renewal ARR");
    const quarterly = defaultAppliedFilters(QUARTERLY, SUBSCRIPTION);
    expect(pendingFromApplied({ ...quarterly, qrrType: "Delayed QRR" }, QUARTERLY).typeValue)
      .toBe("Delayed QRR");
  });

  it("carries the Period's cumulative flag under one key too", () => {
    const quarterly = defaultAppliedFilters(QUARTERLY, SUBSCRIPTION);
    expect(pendingFromApplied({ ...quarterly, cumulativeQuarterly: true }, QUARTERLY).cumulative)
      .toBe(true);
    // Annually has no cumulative flag at all, so the control has nothing to hold.
    expect(pendingFor().cumulative).toBe(false);
  });

  it("takes every list filter as it stands", () => {
    const seeded = pendingFor({ salesRegion: ["EMEA"], accountOwner: ["Ada Ames"] });
    expect(seeded.salesRegion).toEqual(["EMEA"]);
    expect(seeded.accountOwner).toEqual(["Ada Ames"]);
    expect(seeded.industry).toEqual([]);
  });

  it("leaves the unit selection alone: the bar does not own it", () => {
    expect(pendingFor()).not.toHaveProperty("buProductSelection");
    expect(pendingFor()).not.toHaveProperty("customBusinessUnits");
  });
});

describe("applying the controls back over the Applied set", () => {
  it("keeps the unit selection the unit tabs committed", () => {
    const applied = appliedFor({ buProductSelection: "CUSTOM", customBusinessUnits: ["APIM_BU"] });
    const next = appliedFromPending(pendingFor({ salesRegion: ["EMEA"] }), applied, ANNUALLY);
    expect(next.buProductSelection).toBe("CUSTOM");
    expect(next.customBusinessUnits).toEqual(["APIM_BU"]);
  });

  it("writes the type back under the Period's own key", () => {
    const pending = { ...pendingFor(), typeValue: "Renewal ARR" };
    expect(appliedFromPending(pending, appliedFor(), ANNUALLY).arrType).toBe("Renewal ARR");
    const quarterly = defaultAppliedFilters(QUARTERLY, SUBSCRIPTION);
    const qPending = { ...pendingFromApplied(quarterly, QUARTERLY), typeValue: "Renewal QRR", cumulative: true };
    const next = appliedFromPending(qPending, quarterly, QUARTERLY);
    expect(next.qrrType).toBe("Renewal QRR");
    expect(next.cumulativeQuarterly).toBe(true);
    // The Period the reader is not on has no type. Carrying all three is how the
    // source let a Quarterly choice reach an Annually grid.
    expect(next.arrType).toBeUndefined();
  });

  it("does not derive forecast mode or recompute the column ranges", () => {
    // Both are hydrateAppliedFilters', on the way back out of the URL — so
    // there is one place that decides them rather than two that can disagree.
    // A Forecasted type here therefore does NOT turn forecast mode on; it turns
    // on when this set is serialised and read back.
    const ranges = [{ start: "2026/01/01", end: "2026/12/31" }];
    const pending = { ...pendingFor(), typeValue: "Forecasted ARR" };
    const next = appliedFromPending(pending, appliedFor({ annuallyDateRanges: ranges }), ANNUALLY);
    expect(next.forecast).toBe("Disable");
    expect(next.annuallyDateRanges).toBe(ranges);
  });
});

describe("the coercions a change to one control forces on another", () => {
  it("keeps only the region list the chosen View actually uses", () => {
    const both = { ...pendingFor(), salesRegion: ["EMEA"], subRegion: ["ANZ"] };
    const at = (viewType: MisPendingFilters["viewType"]) =>
      normalisePending({ ...both, viewType }, { period: ANNUALLY, table: SUBSCRIPTION });
    expect(at("Global")).toMatchObject({ salesRegion: [], subRegion: [] });
    expect(at("Sales Region")).toMatchObject({ salesRegion: ["EMEA"], subRegion: [] });
    expect(at("Sub Region")).toMatchObject({ salesRegion: [], subRegion: ["ANZ"] });
  });

  it("drops a Confidence that no longer steers anything", () => {
    const withConfidence = { ...pendingFor(), confidenceLevel: "GM" as const };
    const at = (typeValue: string) =>
      normalisePending({ ...withConfidence, typeValue }, { period: ANNUALLY, table: SUBSCRIPTION });
    expect(at("Forecasted ARR").confidenceLevel).toBe("GM");
    // Renewal turns forecast COLUMNS on without carrying a confidence, so it
    // does not keep one either.
    expect(at("Renewal ARR").confidenceLevel).toBe("Commit");
    expect(at("Total ARR").confidenceLevel).toBe("Commit");
  });

  it("coerces a type the Table does not offer back to Total", () => {
    const renewal = { ...pendingFor(), typeValue: "Renewal ARR" };
    expect(normalisePending(renewal, { period: ANNUALLY, table: EXIT_ARR_BY_REGION }).typeValue)
      .toBe("Total ARR");
    expect(normalisePending(renewal, { period: ANNUALLY, table: SOFTWARE_CLOUD_CUSTOMERS }).typeValue)
      .toBe("Total ARR");
    expect(normalisePending(renewal, { period: ANNUALLY, table: SUBSCRIPTION }).typeValue)
      .toBe("Renewal ARR");
  });

  it("coerces a forecast type away on a trailing window, and lets Delayed in", () => {
    const context = { period: ANNUALLY, table: SUBSCRIPTION, viewWindow: TTM };
    expect(normalisePending({ ...pendingFor(), typeValue: "Forecasted ARR" }, context).typeValue)
      .toBe("Total ARR");
    expect(normalisePending({ ...pendingFor(), typeValue: "Delayed ARR" }, context).typeValue)
      .toBe("Delayed ARR");
    // …and back on a Calendar window the Build has no Delayed again.
    expect(normalisePending({ ...pendingFor(), typeValue: "Delayed ARR" }, {
      period: ANNUALLY,
      table: SUBSCRIPTION,
      viewWindow: CALENDAR,
    }).typeValue).toBe("Total ARR");
  });

  it("leaves a set that needs no coercion exactly as it was", () => {
    const clean = pendingFor();
    expect(normalisePending(clean, { period: ANNUALLY, table: SUBSCRIPTION })).toEqual(clean);
  });
});

describe("whether the grid still matches the controls", () => {
  it("says no as soon as a control differs", () => {
    const applied = appliedFor();
    const pending = pendingFromApplied(applied, ANNUALLY);
    expect(samePending(pending, pendingFromApplied(applied, ANNUALLY))).toBe(true);
    expect(samePending({ ...pending, yearsBack: 3 }, pendingFromApplied(applied, ANNUALLY))).toBe(false);
  });

  it("compares list filters by content, not by identity", () => {
    const applied = appliedFor({ salesRegion: ["EMEA", "APAC"] });
    const pending = pendingFromApplied(applied, ANNUALLY);
    expect(samePending({ ...pending, salesRegion: ["EMEA", "APAC"] }, pending)).toBe(true);
    expect(samePending({ ...pending, salesRegion: ["APAC", "EMEA"] }, pending)).toBe(false);
    expect(samePending({ ...pending, salesRegion: ["EMEA"] }, pending)).toBe(false);
  });
});

describe("which controls a view shows", () => {
  const controlsFor = (over: Partial<MisAppliedFilters> = {}, viewWindow: MisWindow = CALENDAR) =>
    misFilterBarControls(pendingFor(over), { period: ANNUALLY, table: SUBSCRIPTION, viewWindow });

  it("offers a region list only for the View that uses it", () => {
    expect(controlsFor().has("salesRegion")).toBe(false);
    expect(controlsFor({ viewType: "Sales Region" }).has("salesRegion")).toBe(true);
    expect(controlsFor({ viewType: "Sales Region" }).has("subRegion")).toBe(false);
    expect(controlsFor({ viewType: "Sub Region" }).has("subRegion")).toBe(true);
  });

  it("offers Confidence only while a Forecasted type is steering something", () => {
    expect(controlsFor().has("confidenceLevel")).toBe(false);
    expect(controlsFor({ arrType: "Forecasted ARR" }).has("confidenceLevel")).toBe(true);
    expect(controlsFor({ arrType: "Renewal ARR" }).has("confidenceLevel")).toBe(false);
  });

  it("takes Years Back away from a forecast, which does not have years to go back over", () => {
    expect(controlsFor().has("yearsBack")).toBe(true);
    expect(controlsFor({ arrType: "Forecasted ARR" }).has("yearsBack")).toBe(false);
  });

  it("takes YTD away on a trailing window, which is not a year to a date", () => {
    expect(controlsFor().has("isYtd")).toBe(true);
    expect(controlsFor({}, TTM).has("isYtd")).toBe(false);
  });

  it("has no cumulative control on Annually, which has no cumulative flag", () => {
    expect(controlsFor().has("cumulative")).toBe(false);
    const quarterly = defaultAppliedFilters(QUARTERLY, SUBSCRIPTION);
    expect(
      misFilterBarControls(pendingFromApplied(quarterly, QUARTERLY), {
        period: QUARTERLY,
        table: SUBSCRIPTION,
        viewWindow: CALENDAR,
      }).has("cumulative"),
    ).toBe(true);
  });

  it("agrees with the chips about whether a view uses Years Back", () => {
    // One rule, asked twice. The source asks it in two places that disagree:
    // the Build's control hides on Forecasted while its chip hides on Delayed
    // too, so a Delayed Build shows a Years Back whose value has no chip.
    expect(usesYearsBack("Forecasted ARR", SUBSCRIPTION)).toBe(false);
    expect(usesYearsBack("Delayed ARR", SUBSCRIPTION)).toBe(true);
    expect(usesYearsBack("Delayed ARR", SOFTWARE_CLOUD_CUSTOMERS)).toBe(false);
    expect(usesConfidence("Forecasted ARR")).toBe(true);
    expect(usesConfidence("Renewal ARR")).toBe(false);
  });
});

describe("the words on the controls", () => {
  it("names a type the way Finance reads it, not the way the wire carries it", () => {
    expect(typeLabel("Total ARR")).toBe("ARR");
    expect(typeLabel("Closed Won ARR")).toBe("Only Closed Won ARR");
    expect(typeLabel("Delayed ARR")).toBe("Only Delayed ARR");
    expect(typeLabel("Total QRR")).toBe("QRR");
    expect(typeLabel("Closed Won MRR")).toBe("Only Closed Won MRR");
    // These two are already what the wire carries.
    expect(typeLabel("Forecasted ARR")).toBe("Forecasted ARR");
    expect(typeLabel("Renewal ARR")).toBe("Renewal ARR");
  });

  it("expands the one confidence level whose wire value is an abbreviation", () => {
    expect(confidenceLabel("GM")).toBe("GM's Commit");
    expect(confidenceLabel("Commit")).toBe("Commit");
    expect(confidenceLabel("Commit + Best Case")).toBe("Commit + Best Case");
  });
});

describe("the Years Back a session carries", () => {
  it("remembers a Years Back the reader chose", () => {
    expect(yearsBackToRemember(3, { period: ANNUALLY, table: SUBSCRIPTION })).toBe(3);
  });

  it("forgets one that is only the Table's own default", () => {
    // Otherwise the next Table would start from 5 because the reader looked at
    // a Build, rather than because they asked for five years.
    expect(yearsBackToRemember(5, { period: ANNUALLY, table: SUBSCRIPTION })).toBeNull();
    expect(yearsBackToRemember(2, { period: ANNUALLY, table: EXIT_ARR_BY_REGION })).toBeNull();
    expect(yearsBackToRemember(5, { period: ANNUALLY, table: EXIT_ARR_BY_REGION })).toBe(5);
  });

});

describe("what a Table switch does to the filters", () => {
  const subscription = { period: ANNUALLY, table: SUBSCRIPTION };
  const region = { period: ANNUALLY, table: EXIT_ARR_BY_REGION };
  const customers = { period: ANNUALLY, table: SOFTWARE_CLOUD_CUSTOMERS };

  it("drops the filters the reader had chosen for the Table they have left", () => {
    const before = appliedFor({ salesRegion: ["EMEA"], viewType: "Sales Region", channelDirect: "Channel" });
    const after = filtersAfterSwitch(before, region, null);
    expect(after.salesRegion).toEqual([]);
    expect(after.viewType).toBe("Global");
    expect(after.channelDirect).toBe("All");
  });

  it("arrives on the new Table's own Years Back when the reader never set one", () => {
    expect(filtersAfterSwitch(appliedFor(), region, null).yearsBack).toBe(2);
    expect(filtersAfterSwitch(appliedFor(), { period: QUARTERLY, table: SUBSCRIPTION }, null).yearsBack)
      .toBe(1);
  });

  it("carries a Years Back the reader set across the switch", () => {
    // The one filter a switch does not drop — it is the shape of the question,
    // not a narrowing of one Table's answer.
    expect(filtersAfterSwitch(appliedFor({ yearsBack: 3 }), region, 3).yearsBack).toBe(3);
  });

  it("leaves the unit selection to the tabs that own it", () => {
    const before = appliedFor({ buProductSelection: "CUSTOM", customBusinessUnits: ["APIM_BU"] });
    const after = filtersAfterSwitch(before, region, null);
    expect(after.buProductSelection).toBe("CUSTOM");
    expect(after.customBusinessUnits).toEqual(["APIM_BU"]);
  });

  it("resets the unit selection on the way into Customers, as the source does", () => {
    // `FilterBar.js:606` — the one Table whose switch also clears the units.
    // Reproduced under ADR 0003: a custom book here would put different figures
    // on screen from the app Finance is reconciling against.
    const before = appliedFor({ buProductSelection: "CUSTOM", customBusinessUnits: ["APIM_BU"] });
    const after = filtersAfterSwitch(before, customers, null);
    expect(after.buProductSelection).toBe("BU_ALL");
    expect(after.customBusinessUnits).toEqual([]);
  });

  it("puts the new Table's own type on, not the one the old Table was showing", () => {
    const before = appliedFor({ arrType: "Renewal ARR" });
    expect(filtersAfterSwitch(before, region, null).arrType).toBe("Total ARR");
  });

  it("does not reach into the set it was given", () => {
    const before = appliedFor({ customBusinessUnits: ["APIM_BU"] });
    filtersAfterSwitch(before, subscription, null).customBusinessUnits.push("IAM_BU");
    expect(before.customBusinessUnits).toEqual(["APIM_BU"]);
  });
});

describe("what the bar says about a switch that dropped filters", () => {
  const subscription = { period: ANNUALLY, table: SUBSCRIPTION };
  const region = { period: ANNUALLY, table: EXIT_ARR_BY_REGION };

  it("names the Table it reset to", () => {
    const before = pendingFor({ salesRegion: ["EMEA"], viewType: "Sales Region" });
    expect(filterResetNotice(before, subscription, region)).toBe(
      "Filters reset to the Region Summary defaults",
    );
  });

  it("counts an edit the reader had not applied yet, because that goes too", () => {
    // It reads the CONTROLS, not the Applied set. The source's own suite pins
    // this: it picks a type without applying and still expects the notice.
    const before = { ...pendingFor(), typeValue: "Forecasted ARR" };
    expect(filterResetNotice(before, subscription, region)).toBe(
      "Filters reset to the Region Summary defaults",
    );
  });

  it("says nothing when the reader had chosen nothing to lose", () => {
    expect(filterResetNotice(pendingFor(), subscription, region)).toBe("");
  });

  it("counts a Years Back as nothing lost, because it carries over", () => {
    expect(filterResetNotice(pendingFor({ yearsBack: 3 }), subscription, region)).toBe("");
  });

  it("names the Period instead when that is what changed", () => {
    const before = pendingFor({ channelDirect: "Channel" });
    expect(filterResetNotice(before, subscription, { period: QUARTERLY, table: SUBSCRIPTION })).toBe(
      "Filters reset to the Quarterly defaults",
    );
  });

  it("says nothing when neither the Table nor the Period moved", () => {
    // A Window switch is not a reset: `applyWindow` carries the reader's
    // filters across it deliberately.
    const before = pendingFor({ channelDirect: "Channel" });
    expect(filterResetNotice(before, subscription, subscription)).toBe("");
  });
});

describe("a Customers type that drags Years Back with it", () => {
  // Spec §8.3 from the control's side. `hydrateAppliedFilters` applies the same
  // rule to a link; without this one the two disagree and APPLY never goes quiet.
  const customers = { period: ANNUALLY, table: SOFTWARE_CLOUD_CUSTOMERS };

  it("drops to one year on Delayed, and back to five on a plain type", () => {
    const from = (typeValue: string) =>
      normalisePending({ ...pendingFor({ yearsBack: 3 }), typeValue }, customers, {
        typeChanged: true,
      }).yearsBack;
    expect(from("Delayed ARR")).toBe(1);
    expect(from("Total ARR")).toBe(5);
    expect(from("Closed Won ARR")).toBe(5);
  });

  it("leaves it alone on a type that hides the control", () => {
    expect(
      normalisePending({ ...pendingFor({ yearsBack: 3 }), typeValue: "Forecasted ARR" }, customers, {
        typeChanged: true,
      }).yearsBack,
    ).toBe(3);
  });

  it("leaves alone a Years Back the reader arrived with", () => {
    // Only on a CHANGE. A value restored from a link is theirs to keep, and
    // snapping it to five would quietly widen a view they shared.
    expect(
      normalisePending({ ...pendingFor({ yearsBack: 3 }), typeValue: "Delayed ARR" }, customers)
        .yearsBack,
    ).toBe(3);
  });

  it("is the Build's business never", () => {
    expect(
      normalisePending({ ...pendingFor({ yearsBack: 3 }), typeValue: "Renewal ARR" }, {
        period: ANNUALLY,
        table: SUBSCRIPTION,
      }, { typeChanged: true }).yearsBack,
    ).toBe(3);
  });
});
