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
import { flashSubRegionGroups, flashSubRegionsFor } from "./misFlashSubRegions";

// What `GET /sub-regions` answers with, and what the Sub Region control offers.
// They are not the same list, and the whole of this module is the step between.

/** A realistic answer: three EU pods, two NA ones, and the two spellings of nothing. */
const ANSWER = [
  "- None -",
  "EU : EU 1",
  "EU : EU 2",
  "MEA",
  "NA - EAST",
  "NA - WEST",
  "NO POD",
];

describe("the menu behind the answer", () => {
  it("offers the regions the sub-regions roll up into, not the sub-regions", () => {
    expect(flashSubRegionGroups(ANSWER).map((group) => group.region)).toEqual([
      "NONE",
      "EU",
      "ME",
      "NA",
    ]);
  });

  it("keeps every sub-region under the region it belongs to", () => {
    const byRegion = new Map(
      flashSubRegionGroups(ANSWER).map((group) => [group.region, group.subRegions]),
    );
    expect(byRegion.get("EU")).toEqual(["EU : EU 1", "EU : EU 2"]);
    expect(byRegion.get("NA")).toEqual(["NA - EAST", "NA - WEST"]);
  });

  // Both spellings of absence are the same absence, said by two upstream
  // systems — so they are one option, not two.
  it("folds the two spellings of nothing into one option", () => {
    const none = flashSubRegionGroups(ANSWER).find((group) => group.region === "NONE")!;
    expect(none.subRegions).toEqual(["- None -", "NO POD"]);
  });

  // The source's `REGION_MAPPING[region] || region`. A sub-region the backend
  // adds tomorrow has to reach the menu, or it becomes unfilterable in silence.
  it("gives a sub-region it has never heard of an option of its own", () => {
    expect(flashSubRegionGroups(["APAC - SOUTH"])).toEqual([
      { region: "APAC - SOUTH", subRegions: ["APAC - SOUTH"] },
    ]);
  });

  it("has nothing to offer for an empty answer", () => {
    expect(flashSubRegionGroups([])).toEqual([]);
  });

  it("ignores entries that are not names", () => {
    expect(flashSubRegionGroups(["", null as never, "ME"])).toEqual([
      { region: "ME", subRegions: ["ME"] },
    ]);
  });
});

describe("what the chosen regions actually send", () => {
  const GROUPS = flashSubRegionGroups(ANSWER);

  it("expands a region into every sub-region beneath it", () => {
    expect(flashSubRegionsFor(["EU"], GROUPS)).toEqual(["EU : EU 1", "EU : EU 2"]);
  });

  it("expands several, in the order they were chosen", () => {
    expect(flashSubRegionsFor(["NA", "ME"], GROUPS)).toEqual([
      "NA - EAST",
      "NA - WEST",
      "MEA",
    ]);
  });

  it("sends nothing at all when nothing is chosen, which is the unfiltered P&L", () => {
    expect(flashSubRegionsFor([], GROUPS)).toEqual([]);
  });

  // The menu narrows with the date range, so a reader can be holding a region
  // that is no longer offered. Sending its NAME would filter the P&L by a
  // sub-region that does not exist — a silently empty statement.
  it("drops a region the menu no longer offers rather than sending its name", () => {
    expect(flashSubRegionsFor(["EU", "LATAM"], GROUPS)).toEqual(["EU : EU 1", "EU : EU 2"]);
  });
});
