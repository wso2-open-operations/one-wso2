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

/** Region → country drill-down helpers, shared by every geo filter.
 *
 * The map itself comes from the API (`useRegionCountryMap`) so the UI narrows by
 * exactly the country list the server filters a region by. The rule everywhere is
 * "narrow, don't block": with no region picked the full country list stays
 * available; once a region is picked only that region's countries are offered.
 */

export type RegionCountryMap = Record<string, string[]>;

/** Case-insensitive membership set for the given regions ([] regions = everything). */
function countrySet(map: RegionCountryMap | undefined, regions: string[]): Set<string> | null {
  if (!map || regions.length === 0) return null;
  const set = new Set<string>();
  for (const r of regions) {
    const key = Object.keys(map).find((k) => k.toLowerCase() === r.trim().toLowerCase());
    for (const c of (key ? map[key] : [])) set.add(c.toLowerCase());
  }
  // An unknown region (e.g. a legacy "EMEA" value) has no member list — leave the
  // country options untouched rather than emptying the dropdown.
  return set.size ? set : null;
}

/** Countries belonging to the selected regions; the full list when none is selected. */
export function countriesForRegions(
  map: RegionCountryMap | undefined,
  regions: string[],
  allCountries: string[],
): string[] {
  const set = countrySet(map, regions);
  if (!set) return allCountries;
  const inRegion = allCountries.filter((c) => set.has(c.trim().toLowerCase()));
  if (inRegion.length) return inRegion;
  // Our data has no country in that region yet — offer the region's own member
  // list so the dropdown still drills down instead of going blank.
  return regionMembers(map, regions);
}

/** Every canonical country in the map, deduped and sorted. */
export function allCountries(map: RegionCountryMap | undefined): string[] {
  return regionMembers(map, Object.keys(map ?? {}));
}

/** Every member country of the selected regions, deduped and sorted. */
export function regionMembers(map: RegionCountryMap | undefined, regions: string[]): string[] {
  if (!map) return [];
  const out = new Set<string>();
  for (const r of regions) {
    const key = Object.keys(map).find((k) => k.toLowerCase() === r.trim().toLowerCase());
    for (const c of (key ? map[key] : [])) out.add(c);
  }
  return Array.from(out).sort();
}

/** True when the country belongs to (one of) the selected regions, or no region is set. */
export function countryInRegions(
  map: RegionCountryMap | undefined,
  regions: string[],
  country: string,
): boolean {
  const set = countrySet(map, regions);
  return !set || set.has(country.trim().toLowerCase());
}

/** Drops the selected countries that fall outside the selected regions. */
export function pruneCountries(
  map: RegionCountryMap | undefined,
  regions: string[],
  countries: string[],
): string[] {
  const set = countrySet(map, regions);
  if (!set) return countries;
  return countries.filter((c) => set.has(c.trim().toLowerCase()));
}

/** Split a mixed region/country selection into its two parts. */
export function splitRegions(
  map: RegionCountryMap | undefined,
  values: string[],
): { regions: string[]; countries: string[] } {
  const keys = new Set(Object.keys(map ?? {}).map((k) => k.toLowerCase()));
  const regions: string[] = [];
  const countries: string[] = [];
  for (const v of values) (keys.has(v.trim().toLowerCase()) ? regions : countries).push(v);
  return { regions, countries };
}

/** States/provinces of the picked countries ([] when none of them has a state list).
 * Drives the State filter: it appears only once a country with states is picked. */
export function statesForCountries(map: Record<string, string[]> | undefined, countries: string[]): string[] {
  if (!map) return [];
  const out = new Set<string>();
  for (const c of countries) {
    const key = Object.keys(map).find((k) => k.toLowerCase() === c.trim().toLowerCase());
    for (const s of (key ? map[key] : [])) out.add(s);
  }
  return Array.from(out).sort();
}

/** Drops picked states that no longer belong to the picked countries. */
export function pruneStates(map: Record<string, string[]> | undefined, countries: string[], states: string[]): string[] {
  if (!map) return states;
  const allowed = new Set(statesForCountries(map, countries).map((s) => s.toLowerCase()));
  return states.filter((s) => allowed.has(s.trim().toLowerCase()));
}

/** State options for a single-select Region + Country filter bar (Leads, Companies):
 * the picked country's states, else the states of every country in the picked
 * region (North America → US states + Canadian provinces), else none. */
export function stateOptionsFor(
  subdivisions: Record<string, string[]> | undefined,
  regionMap: RegionCountryMap | undefined,
  region: string,
  country: string,
): string[] {
  const countries = country ? [country] : region ? regionMembers(regionMap, [region]) : [];
  return statesForCountries(subdivisions, countries);
}
