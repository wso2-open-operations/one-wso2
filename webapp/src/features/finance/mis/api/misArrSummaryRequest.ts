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

// The bodies of the `POST /arr-summary` calls one Build needs — one per column.
//
// Ported from the fetch loop in digiops-finance
// `arrDashboard/hooks/useArrTableSummary.js`. Pulled out as a pure function
// because it is where the port's arithmetic actually lives: which dates a
// column covers, which column it is compared against, and which of the Applied
// filters the backend is told about. The hook around it (`useArrSummary`) is
// then only plumbing, and this is testable without a backend.
//
// Dates cross over here. A Period range is written `yyyy/MM/dd`, because that is
// what the grids and the Excel export show; the wire wants `yyyy-MM-dd`. The
// source converts at the same boundary and so does this.

import { addYears, formatCivilDate } from "../util/misPacificTime";
import { typeValueOf, type MisAppliedFilters, type MisDateRange } from "../util/misViewVocabulary";
import {
  businessUnitsFor,
  narrowedFilters,
  openingDateFor,
  toWireDate,
} from "./misRequestParts";

/** One column's `POST /arr-summary` body. */
export interface ArrSummaryRequest {
  /** The Period's type value — `Total ARR` unless the reader narrowed it. */
  arrType: string;
  /** Backend unit codes. One entry unless the reader built a custom selection. */
  businessUnits: string[];
  /** `yyyy-MM-dd`. The date the column's OPENING balance is read at. */
  startDate: string;
  /** `yyyy-MM-dd`. The date the column closes on. */
  endDate: string;
  /** The range the y/y rows are measured against. */
  prevColDateRange: { startDate: string; endDate: string };
  /** Only on the leftmost column, and only ever `true`. */
  isFirstColumn?: true;
  /** Present only when the reader narrowed the filter each one names. */
  salesRegions?: string[];
  subRegions?: string[];
  industries?: string[];
  subIndustries?: string[];
  shippingCountries?: string[];
  billingCountries?: string[];
  accountOwners?: string[];
  technicalOwners?: string[];
  channelManagers?: string[];
  /** `Channel` or `Direct`. Absent while the reader is looking at both. */
  partnerType?: string;
  /** The confidence level, on a Forecasted type only. */
  forecastType?: string;
}

/**
 * One request per column, oldest first, in the order the columns read.
 *
 * `startDate` is deliberately NOT the range's own start. It is the date the
 * opening balance is read at — the close of the period before this one — while
 * `endDate` closes the column. A Build rolls a balance forward, so the pair the
 * backend needs is two balance dates, not the span between them.
 */
export function arrSummaryRequests(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
): ArrSummaryRequest[] {
  const businessUnits = businessUnitsFor(filters);
  // A custom selection that names nothing is a reader part-way through
  // choosing. The source asks for nothing and shows an empty table, which is
  // the right answer: falling back to every unit would put the whole company's
  // revenue on screen under a filter chip that says otherwise.
  if (!businessUnits) return [];
  const shared = { arrType: typeValueOf(filters), businessUnits, ...narrowedFilters(filters) };

  return ranges.map((range, index) => {
    const endDate = toWireDate(range.end);
    const startDate = openingDateFor(range);
    const previous = index === 0 ? undefined : ranges[index - 1];
    return {
      ...shared,
      startDate,
      endDate,
      prevColDateRange: previous
        ? { startDate: openingDateFor(previous), endDate: toWireDate(previous.end) }
        : // Nothing to the left, so the same window a year earlier. The y/y rows
          // need a comparison in the leftmost column too, and this is the only
          // one available.
          { startDate: aYearEarlier(startDate), endDate: aYearEarlier(endDate) },
      ...(index === 0 ? { isFirstColumn: true as const } : {}),
    };
  });
}

/** `2026-09-12` → `2025-09-12`, clamping a leap day rather than rolling it. */
function aYearEarlier(wireDate: string): string {
  const [year, month, day] = wireDate.split("-").map(Number);
  return toWireDate(formatCivilDate(addYears({ year, month, day }, -1)));
}
