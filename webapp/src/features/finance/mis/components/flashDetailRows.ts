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

// One business unit's P&L, month by month — the detail view behind a column of
// the Flash.
//
// The same statement as `flashPnlRows`, turned ninety degrees: there the
// columns are business units over one date range, here the business unit is
// fixed and the columns are months. Two builders rather than one parameterised
// over both, because the responses are genuinely different records — a P&L line
// carries six named fields, a detail line carries a `summary` ARRAY — and the
// section lists are not the same list either (see `FLASH_DETAIL_SECTIONS`).
//
// Ported from the assembly in `flashConsole/tableView.js/MonthlyViewDialog.js`,
// which is 350 lines of `forEach` with an `Object.assign` per section, a
// hand-incremented `id`, and a four-branch `if (obj.id === "1") … "2" … "3" …
// "4"` chain per sub-level to attach a category name. All of that exists to
// flatten a tree into the one list a DataGrid can take; the port has a tree
// component, so it keeps the tree.

import { MIS_VALUE_TYPES, type MisValueType } from "../util/misMoney";
import { monthInputValue, type MisMonth } from "../util/misFlashPeriods";
import {
  flashAmount,
  flashRowsIn,
  type FlashAccountsQuery,
  type FlashFinancialAccountStatistics,
  type FlashRangeRow,
  type FlashRangeSummary,
  type FlashSalesStatistics,
} from "../api/misFlashTypes";
import type { BuildRow } from "./buildTableModel";
import type { FlashUnitColumn } from "./flashPnlRows";
import { flashRowId } from "./flashRowIds";

/** Which of the two reads a section's lines come from. */
export type FlashDetailSource = "sales" | "accounts";

interface FlashSectionOf<TSource extends FlashDetailSource, TResponse> {
  id: string;
  label: string;
  source: TSource;
  /**
   * The field on that read's response.
   *
   * A `keyof`, and discriminated on `source`, so a mistyped `"grossMargn"` is a
   * compile error. As a bare `string` it would compile, read `undefined`, and
   * draw an empty section under a correct heading — which looks exactly like a
   * backend with nothing to say.
   */
  field: keyof TResponse & string;
  valueType: MisValueType;
}

export type FlashDetailSection =
  | FlashSectionOf<"sales", FlashSalesStatistics>
  | FlashSectionOf<"accounts", FlashFinancialAccountStatistics>;

/**
 * The fourteen sections of a detail view, in the source's order.
 *
 * Two things differ from `FLASH_PNL_SECTIONS` and both are the source's:
 *
 *   * ARR and Booking come from `POST /customer-summary` and everything else
 *     from `POST /account-summary`, because the backend splits sales statistics
 *     from financial-account statistics (`StatisticType`). Two calls, one table.
 *   * **Other Expenses is drawn BEFORE Other Income here, and after it on the
 *     P&L.** `MonthlyViewDialog.js` pushes `otherExpenses` then `otherIncome`;
 *     `FlashConsole.js` concatenates `otherIncome` then `otherExpenses`. The
 *     two screens of the source disagree, so the port reproduces each where it
 *     belongs (ADR 0003) rather than picking one and making both agree.
 */
export const FLASH_DETAIL_SECTIONS: readonly FlashDetailSection[] = [
  { id: "arr", label: "ARR", source: "sales", field: "arr", valueType: MIS_VALUE_TYPES.CURRENCY },
  {
    id: "booking",
    label: "Booking",
    source: "sales",
    field: "booking",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "revenue",
    label: "Revenue",
    source: "accounts",
    field: "revenue",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "cost-of-sales",
    label: "Cost of Sales",
    source: "accounts",
    field: "costOfSales",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "gross-profit",
    label: "Gross Profit",
    source: "accounts",
    field: "grossProfit",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "gross-margin",
    label: "Gross Margin",
    source: "accounts",
    field: "grossMargin",
    valueType: MIS_VALUE_TYPES.PERCENTAGE,
  },
  {
    id: "expense",
    label: "Expense",
    source: "accounts",
    field: "expense",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "ebitdas",
    label: "EBITDAS",
    source: "accounts",
    field: "ebitdas",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "stock-compensation-gratuity",
    label: "Stock Compensation/Gratuity",
    source: "accounts",
    field: "stockCompensationGratuity",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "ebitda",
    label: "EBITDA",
    source: "accounts",
    field: "ebitda",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "other-expenses",
    label: "Other Expenses",
    source: "accounts",
    field: "otherExpenses",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "other-income",
    label: "Other Income",
    source: "accounts",
    field: "otherIncome",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "net-other-income",
    label: "Net Other Income",
    source: "accounts",
    field: "netOtherIncome",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
  {
    id: "net-profit-loss",
    label: "Net Profit/Loss",
    source: "accounts",
    field: "netProfitLoss",
    valueType: MIS_VALUE_TYPES.CURRENCY,
  },
];

/** One line's figures across the months, by the index the response holds them at. */
export interface FlashDetailFigures {
  valueType: MisValueType;
  /**
   * Indexed the way the response is, NOT the way the columns are. A detail view
   * draws the last twelve of the thirteen months it asks for
   * (`flashDetailColumns`), so a column carries the index it came from and
   * reads it here.
   */
  values: readonly (number | null)[];
  /**
   * The GL accounts this figure sums, when Finance may write forecasts against
   * them — ticket 16's account view. Absent for every other line. See
   * `accountsBehind`.
   */
  accounts?: FlashAccountsBehind;
}

/** Which accounts sit behind a figure: an account view's question, less its unit and month. */
export type FlashAccountsBehind = Pick<
  FlashAccountsQuery,
  "book" | "accountCategory" | "accountSubCategory"
>;

export interface FlashDetail {
  rows: BuildRow[];
  figures: ReadonlyMap<string, FlashDetailFigures>;
}

/**
 * The two responses as one table.
 *
 * `sales` answers the first two sections and `accounts` the other twelve. A
 * read that failed passes `{}` and its sections come through empty, which is
 * the source's behaviour too — it renders whichever of the two resolved.
 */
export function flashDetailRows(
  sales: FlashSalesStatistics,
  accounts: FlashFinancialAccountStatistics,
): FlashDetail {
  const figures = new Map<string, FlashDetailFigures>();
  /** The lines of one section, from whichever of the two responses holds them. */
  const linesIn = (section: FlashDetailSection): readonly FlashRangeRow[] =>
    flashRowsIn<FlashRangeRow>(
      section.source === "sales" ? sales[section.field] : accounts[section.field],
    );

  const lineRows = (
    lines: readonly FlashRangeRow[],
    section: FlashDetailSection,
    prefix: string,
    parent: FlashRangeRow | null,
  ): BuildRow[] => {
    const taken = new Set<string>();
    return lines.map((line, index) => {
      const label = line.title ?? "";
      const id = flashRowId(prefix, label, index, taken);
      const accounts = accountsBehind(section, parent, line);
      figures.set(id, {
        valueType: section.valueType,
        values: valuesOf(line.summary),
        ...(accounts ? { accounts } : {}),
      });
      const children = flashRowsIn<FlashRangeRow>(line.subLevel);
      return {
        id,
        label,
        ...(children.length ? { children: lineRows(children, section, id, line) } : {}),
      };
    });
  };

  const rows = FLASH_DETAIL_SECTIONS.map((section) => {
    const lines = linesIn(section);
    return {
      id: section.id,
      label: section.label,
      emphasis: true,
      ...(lines.length ? { children: lineRows(lines, section, section.id, null) } : {}),
    } satisfies BuildRow;
  });

  return { rows, figures };
}

/**
 * One line's month figures, positionally.
 *
 * The `period` on each entry is not read: the columns already know their own
 * months, and reading a month back out of a figure would be the source's own
 * habit of recovering data from what it just rendered. Position is the contract
 * — the backend fills `summary` in the order the `dateRange` was sent.
 */
function valuesOf(summary: FlashRangeSummary[] | null | undefined): (number | null)[] {
  return flashRowsIn<FlashRangeSummary>(summary).map((entry) => flashAmount(entry?.value));
}

// ---- which figures open an account view (ticket 16) ------------------------
//
// A figure here is a SUM of GL accounts, and the flash backend's only writes
// are a forecast against one of those accounts, by its id. So the edit is never
// on a figure: a figure opens the list of accounts behind it — the source's
// Account View (`MonthlyViewTable.js`'s `viewAccountsDialog`) — and an account
// in that list is what gets written.
//
// Two books, and in each the source opens a different depth:
//
//   * Revenue's LINES — Recurring, Non-Recurring/PSO, Cloud — each on its own
//     account category. Not the Revenue heading, which is all three.
//   * Cost of Sales' SUB-LEVELS — Bonus, Infra/IT, … — within the category of
//     the line above them. Not the lines themselves, not anything under the
//     Cost of Sales total (every category at once — the source's `category:
//     ""`), and not a sub-level's own heading.
//
// Both by NAME, which is a deliberate departure from the source's reading by
// position (`obj.id === "2"` means Recurring). A backend that renamed or
// reordered a line would make a positional rule open some OTHER category's
// accounts under this one's figure; by name, the line just stops opening
// anything. The one exception is the sub-level heading, which the source marks
// by `id === "1"` and which has to be read that way: under Public Cloud the
// heading and a sub-category are both called "Public Cloud".
//
// Expense sub-levels are editable in the source and are NOT here. It sends
// them to `/cost-of-sales-accounts` with an Expense category, which searches
// the cost-of-sales table for accounts that are not in it; ticket 16 covers
// the two books the backend actually writes. Spec §7.

/** Revenue's lines, by title, and the category each sums. `constants.bal`'s `REVENUE_*`. */
const REVENUE_CATEGORIES: ReadonlyMap<string, string> = new Map([
  ["Recurring", "Recurring Revenue"],
  // No hyphen at the backend, where the line's own title has one.
  ["Non-Recurring/PSO", "Non Recurring Revenue"],
  ["Cloud", "Cloud"],
]);

/** Cost of Sales' lines, by title, and the category their sub-levels sum within. `COS_*`. */
const COST_OF_SALES_CATEGORIES: ReadonlyMap<string, string> = new Map([
  ["Recurring", "Recurring Revenue COS"],
  ["Non-Recurring/PSO", "Non-Recurring Revenue COS"],
  ["Public Cloud", "Cloud"],
]);

/** The backend's id for the first line of a list, which is that list's heading. */
const HEADING_LINE_ID = "1";

function accountsBehind(
  section: FlashDetailSection,
  parent: FlashRangeRow | null,
  line: FlashRangeRow,
): FlashAccountsBehind | undefined {
  const title = line.title ?? "";
  if (section.id === "revenue" && !parent) {
    const accountCategory = REVENUE_CATEGORIES.get(title);
    return accountCategory ? { book: "income", accountCategory } : undefined;
  }
  if (section.id === "cost-of-sales" && parent && line.id !== HEADING_LINE_ID && title) {
    const accountCategory = COST_OF_SALES_CATEGORIES.get(parent.title ?? "");
    return accountCategory
      ? { book: "cost-of-sales", accountCategory, accountSubCategory: title }
      : undefined;
  }
  return undefined;
}

/**
 * The account view a figure opens, or none.
 *
 * None for a column that opens no accounts — the WSO2 column, whose figure is
 * every unit's accounts at once. See `FlashUnitColumn.opensAccounts`.
 */
export function flashAccountsQuery(
  behind: FlashAccountsBehind | undefined,
  unit: Pick<FlashUnitColumn, "businessUnit" | "opensAccounts">,
  month: MisMonth,
): FlashAccountsQuery | null {
  if (!behind || !unit.opensAccounts) return null;
  return { ...behind, businessUnit: unit.businessUnit, month: monthInputValue(month) };
}
