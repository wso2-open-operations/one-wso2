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

// The body behind the customer drill-down: click a figure in the Build, and ask
// which customers are inside it.
//
// Ported from digiops-finance `arrDashboard/components/DataGrid.js`, the
// `onCellClicked` else-branch (:604-792), which builds the body inline.
//
// ---- this is not `/arr-summary` with a row attached -------------------------
//
// It shares the filter block and the unit translation (`misRequestParts`), and
// then differs in four ways that each matter:
//
//   + `customerArrType` — the question being asked, and the only field naming
//     the row that was clicked.
//   − no `prevColDateRange`. A Build column reports y/y movement and needs a
//     previous column to measure against; a list of customers has nothing to
//     compare against.
//   ~ `startDate` is OMITTED on an opening balance rather than sent. An opening
//     balance is a moment, not a period.
//   ~ `isFirstColumn` is narrower — see `flagsFirstColumn` below.
//
// ---- it keys on row IDS, where the source keys on row LABELS -----------------
//
// The source tests `params.data.rowHeader` — the literal header text — against
// a Set of fourteen strings (`DataGrid.js:630-645`). That works there only by
// luck: the Build has FOUR rows labelled "y/y growth", so a label is not an
// identity. The port gives every row a stable id (`arrBuildRows`), so this keys
// on those and the ambiguity cannot come back.

import type { MisAppliedFilters, MisDateRange } from "../util/misViewVocabulary";
import { typeValueOf } from "../util/misViewVocabulary";
import {
  businessUnitsFor,
  narrowedFilters,
  openingDateFor,
  toWireDate,
} from "./misRequestParts";

/** One drill-down's `POST /arr-summary/customers` body. */
export interface DrillDownRequest {
  /** The Period's type value — `Total ARR` unless the reader narrowed it. */
  arrType: string;
  /** Backend unit codes. One entry unless the reader built a custom selection. */
  businessUnits: string[];
  /** `yyyy-MM-dd`. The date the customer list is read at. */
  endDate: string;
  /** Which movement is being opened — see `CUSTOMER_ARR_TYPE_BY_ROW`. */
  customerArrType: string;
  /** `yyyy-MM-dd`. Absent on an opening balance, which is read at a moment. */
  startDate?: string;
  /** Only on the leftmost column, and never on a closing balance. */
  isFirstColumn?: true;
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
 * Which movement each drillable row asks the backend for.
 *
 * Fourteen rows collapse onto seven answers, for two reasons. A Build states
 * most movements TWICE — once in money and once in logos — and both mean the
 * same set of customers. And both BALANCES ask for `Closing`: an opening
 * balance and a closing balance are the same question, who was in the book,
 * asked at two different dates, so the difference lives in the date rather than
 * in the type. Verbatim from `DataGrid.js:719-735`.
 */
const CUSTOMER_ARR_TYPE_BY_ROW: Readonly<Record<string, string>> = {
  "opening-arr": "Closing",
  "opening-customers": "Closing",
  "ending-arr": "Closing",
  "closing-customers": "Closing",
  "new-arr": "New",
  "new-customers": "New",
  "lost": "Lost",
  "lost-customers": "Lost",
  "transferred-in": "Transferred In",
  "transferred-in-customers": "Transferred In",
  "transferred-out": "Transferred Out",
  "transferred-out-customers": "Transferred Out",
  "expansions": "Expansions",
  "reductions": "Reductions",
};

/**
 * The rows a reader can open, by id.
 *
 * Fourteen of them; every other row in the Build is inert. That is about two
 * thirds of it — the four y/y growth rows, Net New, the totals, the six
 * retention ratios, the six percentages and every section heading — because
 * none of those IS a set of customers. A ratio has no customer list behind it.
 */
export const DRILLABLE_ROW_IDS: ReadonlySet<string> = new Set(
  Object.keys(CUSTOMER_ARR_TYPE_BY_ROW),
);

/** What the backend calls the movement this row shows, or undefined if it has none. */
export const customerArrTypeFor = (rowId: string): string | undefined =>
  CUSTOMER_ARR_TYPE_BY_ROW[rowId];

/** Balances read at the START of a column rather than at its close. */
const OPENING_ROWS: ReadonlySet<string> = new Set(["opening-arr", "opening-customers"]);

/** Balances at the END of a column — the two the first-column flag skips. */
const CLOSING_ROWS: ReadonlySet<string> = new Set(["ending-arr", "closing-customers"]);

/**
 * The body for one drilled-into figure, or `null` when there is nothing to ask.
 *
 * `null` is the source's silence, reproduced. It returns early — no dialog, no
 * message, no cursor change — in two cases, and both reach a reader as a click
 * that does nothing:
 *
 *   - the row is not one of the fourteen. Two thirds of the Build.
 *   - the reader has chosen a Custom unit selection and ticked nothing. That
 *     one is a dead click driven by FILTER state rather than by the cell, so
 *     every figure in the Build stops responding at once. Reproduced rather
 *     than softened, because the alternative — falling back to every unit —
 *     would put the whole company's customers behind a filter chip saying
 *     otherwise.
 */
export function drillDownRequest(
  rowId: string,
  range: MisDateRange,
  filters: MisAppliedFilters,
  { isFirstColumn }: { isFirstColumn: boolean },
): DrillDownRequest | null {
  const customerArrType = customerArrTypeFor(rowId);
  if (!customerArrType) return null;

  const businessUnits = businessUnitsFor(filters);
  if (!businessUnits) return null;

  const opensAtStart = OPENING_ROWS.has(rowId);
  // The whole difference between the two balances. An opening row is read at
  // the opening date and says nothing about a span; every other row closes on
  // the column's own end and opens at the balance before it.
  const endDate = opensAtStart ? openingDateFor(range) : toWireDate(range.end);

  return {
    arrType: typeValueOf(filters),
    businessUnits,
    endDate,
    customerArrType,
    ...(opensAtStart ? {} : { startDate: openingDateFor(range) }),
    ...narrowedFilters(filters),
    ...(isFirstColumn && !CLOSING_ROWS.has(rowId) ? { isFirstColumn: true as const } : {}),
  };
}
