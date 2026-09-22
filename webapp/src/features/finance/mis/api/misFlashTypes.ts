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

// What the MIS FLASH backend says, as it declares it.
//
// Its own records are in `flash-backend/modules/types/types.bal`; these are
// those records at the client boundary, which is why every field here is
// optional where Ballerina makes most of them required. A gateway error page, a
// truncated body or a service that has moved on all arrive as a 200 whose shape
// nobody checked, and a missing section has to leave a blank line rather than
// take the P&L down.
//
// Kept apart from `misTypes.ts` — the ARR backend's — on purpose. The two
// services share a gateway and nothing else: the ARR one answers /user-info for
// both, and every other endpoint, record and date format belongs to one of them
// alone. A single types file would be the first place the two got mixed up.
//
// ⚠ This backend is Production Active but was last deployed from a 407-day-old
// commit. ADR 0001: its responses are a fixed contract, not something that will
// be adjusted to suit the port.

/**
 * One line of the P&L, across the six business-unit columns.
 *
 * `BusinessUnitSummary` (`types.bal:149-168`). `integrationCloud` is NOT here:
 * the record has no such field, and the source's column for it is commented out
 * (`DataTable.js:183-207`).
 */
export interface FlashBusinessUnitSummary {
  id?: string | null;
  title?: string | null;
  integrationSoftware?: number | null;
  iam?: number | null;
  apim?: number | null;
  choreo?: number | null;
  corporate?: number | null;
  wso2?: number | null;
  /** Cost of Sales and Expense carry these; every other section sends none. */
  subLevel?: FlashBusinessUnitSummary[] | null;
}

/**
 * `GET /balance-statement` — the whole P&L for one date range.
 *
 * Fourteen sections, each a list of lines. `BalanceStatement`
 * (`types.bal:117-146`), whose every field is already optional there.
 */
export interface FlashBalanceStatement {
  arr?: FlashBusinessUnitSummary[] | null;
  booking?: FlashBusinessUnitSummary[] | null;
  revenue?: FlashBusinessUnitSummary[] | null;
  costOfSales?: FlashBusinessUnitSummary[] | null;
  grossProfit?: FlashBusinessUnitSummary[] | null;
  grossMargin?: FlashBusinessUnitSummary[] | null;
  expense?: FlashBusinessUnitSummary[] | null;
  ebitdas?: FlashBusinessUnitSummary[] | null;
  stockCompensationGratuity?: FlashBusinessUnitSummary[] | null;
  ebitda?: FlashBusinessUnitSummary[] | null;
  otherIncome?: FlashBusinessUnitSummary[] | null;
  otherExpenses?: FlashBusinessUnitSummary[] | null;
  netOtherIncome?: FlashBusinessUnitSummary[] | null;
  netProfitLoss?: FlashBusinessUnitSummary[] | null;
}

/** One month's figure inside a detail view's row. `RangeSummary`. */
export interface FlashRangeSummary {
  period?: { startDate?: string | null; endDate?: string | null } | null;
  value?: number | null;
}

/**
 * One line of a detail view, across the months asked for.
 *
 * `BusinessUnitRangeSummary` (`types.bal:187-196`). The same shape as
 * `FlashBusinessUnitSummary` with the business-unit columns replaced by a
 * `summary` array — because a detail view has already fixed the business unit
 * and is reading months instead.
 */
export interface FlashRangeRow {
  id?: string | null;
  title?: string | null;
  summary?: FlashRangeSummary[] | null;
  subLevel?: FlashRangeRow[] | null;
}

/** `POST /customer-summary` — ARR and Booking for one business unit. */
export interface FlashSalesStatistics {
  arr?: FlashRangeRow[] | null;
  booking?: FlashRangeRow[] | null;
}

/**
 * `POST /account-summary` — the financial accounts for one business unit.
 *
 * Twelve sections rather than the balance statement's fourteen: ARR and Booking
 * come from `/customer-summary` beside it, which is why the detail view makes
 * both calls and stitches the answers together.
 */
export interface FlashFinancialAccountStatistics {
  revenue?: FlashRangeRow[] | null;
  costOfSales?: FlashRangeRow[] | null;
  grossProfit?: FlashRangeRow[] | null;
  grossMargin?: FlashRangeRow[] | null;
  expense?: FlashRangeRow[] | null;
  ebitdas?: FlashRangeRow[] | null;
  stockCompensationGratuity?: FlashRangeRow[] | null;
  ebitda?: FlashRangeRow[] | null;
  otherExpenses?: FlashRangeRow[] | null;
  otherIncome?: FlashRangeRow[] | null;
  netOtherIncome?: FlashRangeRow[] | null;
  netProfitLoss?: FlashRangeRow[] | null;
}

/**
 * The body both detail-view reads take. `CustomerSummaryFilter`
 * (`types.bal:293-302`).
 *
 * A READ that takes a body, so it is a POST and the body is its React Query
 * key — spec §6.
 */
export interface FlashSummaryRequest {
  businessUnit: string;
  /** Asks the backend to break Cost of Sales and Expense down a level. */
  isSubLevel: boolean;
  dateRange: readonly { startDate: string; endDate: string }[];
  subRegions: readonly string[];
}

/**
 * Which of the two account books a figure's accounts are in — and so which pair
 * of endpoints reads and writes them: `/income-accounts` for Revenue,
 * `/cost-of-sales-accounts` for Cost of Sales. No other section has a book: the
 * flash backend writes forecasts into these two tables and no others
 * (`flash-backend/service.bal:136-160`, the two PATCH resources).
 */
export type FlashAccountBook = "income" | "cost-of-sales";

/**
 * What an account view asks for: the GL accounts behind one figure, for one
 * business unit and one month.
 *
 * `IncomeAccountsFilter` and `CostOfSalesAccountsFilter` (`types.bal:260-281`),
 * both sent as query parameters on a GET.
 */
export interface FlashAccountsQuery {
  book: FlashAccountBook;
  /** A GL account category — "Recurring Revenue", "Non-Recurring Revenue COS". */
  accountCategory: string;
  /**
   * Cost of Sales only: the sub-category line's own title — "Bonus", "Infra/IT".
   * Required by the backend there, and absent from the income endpoint.
   */
  accountSubCategory?: string;
  /** `BU_LIST`'s name for the unit, as `FlashDetailRequest.businessUnit`. */
  businessUnit: string;
  /** `yyyy-MM`. */
  month: string;
}

/**
 * One GL account behind a figure, as an account view lists it.
 *
 * `FinancialAccount` (`types.bal:25-38`), where `id`, `accountName`, `month`
 * and `amount` are required and `comment` and `budgetedValue` are not. Optional
 * throughout here for the reason this file's header gives.
 */
export interface FlashFinancialAccount {
  /** The id a forecast is written against — `ForecastValueInput.id`. */
  id?: number | null;
  accountName?: string | null;
  /** The comment written with the forecast. */
  comment?: string | null;
  /**
   * The forecast written through this screen — the source heads it "Updated
   * Amount". Null until someone writes one; the P&L reads it only in place of a
   * missing `amount`, and only for last month before the cutoff.
   */
  budgetedValue?: number | null;
  /** `yyyy-MM`. */
  month?: string | null;
  /** What the ledger says. */
  amount?: number | null;
}

/**
 * `PATCH /income-accounts` and `PATCH /cost-of-sales-accounts` — the only
 * write in MIS's Build and analysis half. `ForecastValueInput`
 * (`types.bal:283-290`): `value` is a required decimal, so a forecast can be
 * changed and never cleared, and `comment` is `string?`.
 */
export interface FlashForecastInput {
  id: number;
  value: number;
  comment: string | null;
}

/** A number the backend sent, or nothing. Anything else is nothing. */
export function flashAmount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** The rows of one section, or none — a body that is not a list says nothing. */
export function flashRowsIn<T>(section: unknown): readonly T[] {
  return Array.isArray(section) ? (section as T[]) : [];
}
