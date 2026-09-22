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

// The Flash screen's Sub Region filter: what `GET /sub-regions` sends back, and
// what a reader actually picks from.
//
// They are not the same list. The endpoint answers with the sub-region names in
// the data — `"EU : EU 1"`, `"NA - WEST"`, `"- None -"` — and the control offers
// the four REGIONS those roll up into. Picking one sends every sub-region under
// it. Ported from `flashConsole/filters/SubRegionFilter.js`.
//
// ---- this is not `misRegions.ts` -------------------------------------------
//
// That file is the ARR backend's region vocabulary, where a region arrives as a
// key on a response and the question is how finance spells it. This is the
// FLASH backend's, where sub-regions arrive as free-text names and the question
// is which region each belongs to. Two backends, two lists, no overlap in
// spelling — `misRegions` knows `apac` and `latam`, and neither appears here.
//
// ---- one deviation, and it is a control that does not work -----------------
//
// The source holds the EXPANDED list as its state and derives the selection
// from it: a group counts as picked when every one of its sub-regions is in the
// list (`SubRegionFilter.js`'s `value` prop). Its chip delete then removes ONE
// STRING from that list — the group's own name — so deleting the "EU" chip
// removes a sub-region literally called `"EU"` and leaves `"EU : EU 1"`,
// `"EU : EU 2"` and `"EU : EU 3"` behind. The chip stays on screen, because the
// group is no longer fully selected but its members are still filtering.
//
// Here the GROUPS are the state and the expansion happens on the way to the
// request. Every selection a reader can reach sends exactly what the source
// sends; the states its broken delete could reach are simply not reachable.
// Recorded in spec §7 rather than reproduced: ADR 0003 protects the FIGURES a
// reconciler compares, and this is a filter that cannot be cleared.

/**
 * Which region each known sub-region rolls up into, verbatim from
 * `SubRegionFilter.js`'s `REGION_MAPPING`.
 *
 * Anything absent is its own group, which is what the source's
 * `REGION_MAPPING[region] || region` does — so a sub-region the backend adds
 * tomorrow appears under its own name rather than vanishing from the menu.
 *
 * `"- None -"` and `"NO POD"` both roll into `NONE`: they are the same absence
 * spelled two ways by two upstream systems.
 */
const FLASH_REGION_BY_SUB_REGION: Readonly<Record<string, string>> = {
  "EU : EU 1": "EU",
  "EU : EU 2": "EU",
  "EU : EU 3": "EU",
  EU: "EU",
  "NA - CENTRAL": "NA",
  "NA - SOUTH": "NA",
  "NA - WEST": "NA",
  "NA - EAST": "NA",
  NA: "NA",
  "NO POD": "NONE",
  "- None -": "NONE",
  ME: "ME",
  MEA: "ME",
};

/** One option on the Sub Region menu, and the sub-regions it stands for. */
export interface FlashSubRegionGroup {
  /** What the menu and the chip say. */
  region: string;
  /** What is actually sent to the backend when this option is picked. */
  subRegions: readonly string[];
}

/**
 * The menu, built from whatever the endpoint answered with.
 *
 * In first-seen order, which is the endpoint's own: it returns a **sorted**
 * list (`service.bal`, "a sorted list of unique sub region names"), so the
 * groups come out in a stable order without this file asserting one of its own.
 */
export function flashSubRegionGroups(subRegions: readonly string[]): FlashSubRegionGroup[] {
  const byRegion = new Map<string, string[]>();
  for (const subRegion of subRegions) {
    if (typeof subRegion !== "string" || !subRegion) continue;
    const region = FLASH_REGION_BY_SUB_REGION[subRegion] ?? subRegion;
    const held = byRegion.get(region);
    if (held) held.push(subRegion);
    else byRegion.set(region, [subRegion]);
  }
  return [...byRegion].map(([region, members]) => ({ region, subRegions: members }));
}

/**
 * What the chosen regions send: every sub-region beneath them.
 *
 * A region the menu no longer offers is dropped rather than sent as itself. The
 * menu narrows with the date range — it is the sub-regions present in that
 * range — so a reader who picks a region and then moves the range back can be
 * holding one that is no longer there, and sending its NAME would filter the
 * P&L by a sub-region that does not exist.
 */
export function flashSubRegionsFor(
  regions: readonly string[],
  groups: readonly FlashSubRegionGroup[],
): string[] {
  const byRegion = new Map(groups.map((group) => [group.region, group.subRegions]));
  return regions.flatMap((region) => [...(byRegion.get(region) ?? [])]);
}
