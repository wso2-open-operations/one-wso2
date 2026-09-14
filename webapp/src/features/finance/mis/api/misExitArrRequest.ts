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

// The bodies of the `POST /arr-summary/region-exit` and `POST /arr-summary/bu-exit`
// calls the two Exit ARR summaries need — one per column.
//
// Ported from `buildPayload` in digiops-finance
// `arrDashboard/hooks/useExitArrByRegion.js` and `useExitArrByBU.js`. The two
// are identical but for `isSalesRegionSummary`, which is why they are one
// module here and two functions rather than one function with a flag that could
// be forgotten.
//
// ---- why this body is the narrowest of the four ----------------------------
//
// `/arr-summary` sends eighteen fields, `/accounts` three; these send four or
// five. `businessUnits` is hard-coded to every unit and the nine account and
// geography lists are not forwarded at all.
//
// That is the shape of the question rather than an omission. A summary reports
// what every business unit was worth across every region, so the per-unit
// breakdown IS the table's columns and the per-region breakdown IS its rows.
// Narrowing to one unit would leave six of seven figures empty under a heading
// still promising all of them.
//
// ---- a summary is a BALANCE, and a Build is a MOVEMENT ----------------------
//
// Both still send two dates, and the pair means the same thing it does for a
// Build: `endDate` closes the column and `startDate` is the balance it is read
// forward from. What is absent is `prevColDateRange` — there are no y/y rows in
// a summary to compare against — and `isFirstColumn`, which only a forecast
// roll-forward needs.

import { openingDateFor, toWireDate } from "./misRequestParts";
import {
  carriesConfidence,
  isOnePartnerBook,
  typeValueOf,
  type MisAppliedFilters,
  type MisDateRange,
} from "../util/misViewVocabulary";

/** The fields both summaries send. */
export interface ExitArrRequest {
  /** The Period's type value — `Total ARR` unless the reader narrowed it. */
  arrType: string;
  /** Always every unit. See the note above. */
  businessUnits: readonly ["ALL_BU"];
  /** `yyyy-MM-dd`. The date the column's opening balance is read at. */
  startDate: string;
  /** `yyyy-MM-dd`. The date the column closes on. */
  endDate: string;
  /** `Channel` or `Direct`. Absent while the reader is looking at both. */
  partnerType?: string;
  /** The confidence level, on a Forecasted type only. */
  forecastType?: string;
}

/** Exit ARR by Region also says which geography to cut by. */
export interface RegionExitRequest extends ExitArrRequest {
  /** `true` for Sales Region, `false` for Sub Region. */
  isSalesRegionSummary: boolean;
}

/**
 * Every business unit, whatever the reader's Unit selection says.
 *
 * Verbatim from both source hooks, which write the literal in the payload. It
 * is the same wire code `misRequestParts` falls back to, but it is not reached
 * through `businessUnitsFor`: that function answers "which units did the reader
 * ask for", and the honest answer here is that nobody asked.
 */
const EVERY_UNIT = ["ALL_BU"] as const;

/**
 * One request per column, oldest first, in the order the columns read.
 *
 * `isSalesRegionSummary` is a parameter rather than a filter because it is not
 * one: the source keeps the Region Type toggle in the Region Summary's own
 * component state (`RegionSummaryTabs.js`), so it never reaches the Applied set
 * and never reaches a link. See `docs/ported-apps/mis.md` §11.
 */
export function regionExitRequests(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
  isSalesRegionSummary: boolean,
): RegionExitRequest[] {
  return ranges.map((range) => ({ ...exitArrBody(range, filters), isSalesRegionSummary }));
}

/** One request per column, oldest first, in the order the columns read. */
export function buExitRequests(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
): ExitArrRequest[] {
  return ranges.map((range) => exitArrBody(range, filters));
}

function exitArrBody(range: MisDateRange, filters: MisAppliedFilters): ExitArrRequest {
  return {
    // The source normalises through an alias map — `ARR` to `Total ARR`,
    // `Only Closed Won ARR` to `Closed Won ARR`. Not ported, because those
    // aliases are values the source's own older filter bar produced and this
    // port's type lists never contain: `TYPE_VALUES_BY_PERIOD` holds the
    // canonical strings only, and `typeValueOf` supplies the same `Total ARR`
    // default the map's falsy branch does.
    arrType: typeValueOf(filters),
    businessUnits: EVERY_UNIT,
    startDate: openingDateFor(range),
    endDate: toWireDate(range.end),
    // The same two rules `/arr-summary` and `/accounts` apply, asked of the
    // same two shared questions so the four endpoints cannot disagree about
    // what the reader narrowed. What is NOT reached for is `narrowedFilters`,
    // which would forward the nine lists as well.
    ...(isOnePartnerBook(filters.channelDirect) ? { partnerType: filters.channelDirect } : {}),
    ...(carriesConfidence(filters) && filters.confidenceLevel
      ? { forecastType: filters.confidenceLevel }
      : {}),
  };
}
