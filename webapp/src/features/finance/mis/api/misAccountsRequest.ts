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

// The bodies of the `POST /accounts` calls the Software/Cloud Customers table
// needs — one per column.
//
// Ported from digiops-finance `arrDashboard/hooks/useCustomerAccounts.js`,
// `fetchAccountsForDateRange`. Pure, and separate from the hook, for the same
// reason `misArrSummaryRequest` is: this is where the port's decisions about
// what the backend is told actually live, and they are testable without one.
//
// ---- why this body is three fields and `/arr-summary`'s is eighteen ---------
//
// `/accounts` ACCEPTS the whole ArrFilter shape. The backend README documents
// regions, sub-regions, both country lists, industries, owners, business units,
// a customer lifetime and an ARR range. The source sends none of them: the
// closing date, the type, and a confidence on a forecast, and nothing else.
//
// That is not an oversight to be corrected in the port. The Software/Cloud
// Customers table does not OFFER those filters — ticket 10 has the filter bar
// grey them out with a tooltip naming the Table — so there is no reader
// intention to send. A port that helpfully forwarded them would narrow a
// customer list while the bar above it showed no such filter, which is the
// worst kind of wrong: quietly, and only for readers who had set a filter on
// some other table first.
//
// A Build column is a SPAN and an account balance is a MOMENT, which is the
// other half of why these bodies look nothing alike. `/arr-summary` rolls a
// balance forward and needs two dates; this asks what the book looked like on
// one, so there is no `startDate` here and no `prevColDateRange` either.

import {
  carriesConfidence,
  typeValueOf,
  type MisAppliedFilters,
  type MisDateRange,
} from "../util/misViewVocabulary";

/** One column's `POST /accounts` body. */
export interface AccountsRequest {
  /** `yyyy-MM-dd`. The date the customer book is read at. */
  endDate: string;
  /** The Period's type value — `Total ARR` unless the reader narrowed it. */
  arrType: string;
  /** The confidence level, on a Forecasted type only. */
  forecastType?: string;
}

/**
 * One request per column, oldest first, in the order the columns read.
 *
 * Deliberately takes the same `MisDateRange[]` the Build columns are cut from,
 * rather than re-deriving its own dates as the source does. The source keeps a
 * second 200-line date generator inside `useCustomerAccounts` for this table
 * alone; the port already cuts these ranges in Pacific Time once, in
 * `misPeriods`, and two generators are two places for the customers table and
 * the Build beside it to disagree about when a year ended.
 */
export function accountsRequests(
  ranges: readonly MisDateRange[],
  filters: MisAppliedFilters,
): AccountsRequest[] {
  const arrType = typeValueOf(filters);
  const forecastType = carriesConfidence(filters) ? filters.confidenceLevel : undefined;

  return ranges.map((range) => ({
    endDate: toWireDate(range.end),
    arrType,
    // Omitted rather than sent empty, so a forecast with no confidence chosen
    // asks for the forecast rather than for one filtered by nothing.
    ...(forecastType ? { forecastType } : {}),
  }));
}

/** `2026/09/12` → `2026-09-12`. */
const toWireDate = (date: string): string => date.replace(/\//g, "-");
