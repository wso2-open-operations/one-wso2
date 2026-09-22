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
import { MIS_VALUE_TYPES } from "../util/misMoney";
import type {
  FlashFinancialAccountStatistics,
  FlashRangeRow,
  FlashSalesStatistics,
} from "../api/misFlashTypes";
import { FLASH_DETAIL_SECTIONS, flashAccountsQuery, flashDetailRows } from "./flashDetailRows";
import { FLASH_PNL_SECTIONS } from "./flashPnlRows";

// One business unit's P&L month by month — the same statement as the Flash
// table, turned ninety degrees.

const month = (start: string, end: string, value: number | null) => ({
  period: { startDate: start, endDate: end },
  value,
});

const SALES: FlashSalesStatistics = {
  arr: [
    {
      id: "1",
      title: "Opening ARR",
      summary: [
        month("2025-09-01", "2025-10-01", 100),
        month("2025-10-01", "2025-11-01", 150),
      ],
    },
  ],
  booking: [{ id: "1", title: "Recurring", summary: [month("2025-09-01", "2025-10-01", 5)] }],
};

const ACCOUNTS: FlashFinancialAccountStatistics = {
  revenue: [{ id: "1", title: "Recurring", summary: [month("2025-09-01", "2025-10-01", 40)] }],
  costOfSales: [
    {
      id: "1",
      title: "Cost of Sales",
      summary: [month("2025-09-01", "2025-10-01", 12)],
      subLevel: [
        { id: "1", title: "Cloud Hosting", summary: [month("2025-09-01", "2025-10-01", 7)] },
      ],
    },
  ],
  grossMargin: [{ id: "1", title: "Gross Margin", summary: [month("2025-09-01", "2025-10-01", 70)] }],
};

const detail = (
  sales: FlashSalesStatistics = SALES,
  accounts: FlashFinancialAccountStatistics = ACCOUNTS,
) => flashDetailRows(sales, accounts);

const sectionNamed = (label: string) => detail().rows.find((row) => row.label === label)!;

describe("the sections of a detail view", () => {
  // Written out rather than compared against `FLASH_DETAIL_SECTIONS`, which is
  // what the builder reads: the two would agree by construction, so neither the
  // count nor the order would be pinned by anything.
  it("draws all fourteen, whichever call each came from", () => {
    expect(detail().rows.map((row) => row.label)).toEqual([
      "ARR",
      "Booking",
      "Revenue",
      "Cost of Sales",
      "Gross Profit",
      "Gross Margin",
      "Expense",
      "EBITDAS",
      "Stock Compensation/Gratuity",
      "EBITDA",
      "Other Expenses",
      "Other Income",
      "Net Other Income",
      "Net Profit/Loss",
    ]);
  });

  it("takes ARR and Booking from the customer summary, and the rest from the account one", () => {
    const bySource = new Map(
      FLASH_DETAIL_SECTIONS.map((section) => [section.label, section.source]),
    );
    expect(bySource.get("ARR")).toBe("sales");
    expect(bySource.get("Booking")).toBe("sales");
    expect(bySource.get("Revenue")).toBe("accounts");
    expect(bySource.get("Net Profit/Loss")).toBe("accounts");
  });

  // ADR 0003. The source's two screens disagree about where Other Income goes,
  // so the port reproduces each disagreement where it belongs rather than
  // harmonising them — which is a decision for after the parallel period.
  it("puts Other Expenses before Other Income, which is the opposite of the P&L", () => {
    const detailOrder = FLASH_DETAIL_SECTIONS.map((section) => section.label);
    const pnlOrder = FLASH_PNL_SECTIONS.map((section) => section.label);
    expect(detailOrder.indexOf("Other Expenses")).toBeLessThan(detailOrder.indexOf("Other Income"));
    expect(pnlOrder.indexOf("Other Income")).toBeLessThan(pnlOrder.indexOf("Other Expenses"));
  });
});

describe("a line's figures across the months", () => {
  it("reads the value of each month, in the order they were asked for", () => {
    const { figures } = detail();
    const opening = sectionNamed("ARR").children![0];
    expect(figures.get(opening.id)!.values).toEqual([100, 150]);
  });

  // The COLUMN carries the index, because the view draws the last twelve of the
  // thirteen months it fetched. Figures indexed by anything but the response's
  // own position would silently shift the whole row by a month.
  it("is indexed the way the response is, not the way the columns are", () => {
    const { figures } = detail();
    const opening = sectionNamed("ARR").children![0];
    expect(figures.get(opening.id)!.values[1]).toBe(150);
  });

  it("leaves a month the backend had no figure for empty, not nought", () => {
    const { rows, figures } = flashDetailRows(
      { arr: [{ id: "1", title: "Opening ARR", summary: [month("2025-09-01", "2025-10-01", null)] }] },
      {},
    );
    expect(figures.get(rows[0].children![0].id)!.values).toEqual([null]);
  });

  it("gives a line with no summary at all no figures", () => {
    const { rows, figures } = flashDetailRows({ arr: [{ id: "1", title: "Opening ARR" }] }, {});
    expect(figures.get(rows[0].children![0].id)!.values).toEqual([]);
  });
});

describe("the sub-levels the detail view asks for", () => {
  it("hangs them under the line they break down", () => {
    const line = sectionNamed("Cost of Sales").children![0];
    expect(line.children!.map((row) => row.label)).toEqual(["Cloud Hosting"]);
  });

  it("gives a sub-level its own months", () => {
    const { figures } = detail();
    const line = sectionNamed("Cost of Sales").children![0];
    expect(figures.get(line.children![0].id)!.values).toEqual([7]);
  });
});

describe("which figures Scale may touch", () => {
  it("calls Gross Margin a percentage here too", () => {
    const { figures } = detail();
    const line = sectionNamed("Gross Margin").children![0];
    expect(figures.get(line.id)!.valueType).toBe(MIS_VALUE_TYPES.PERCENTAGE);
  });

  it("calls a revenue line currency", () => {
    const { figures } = detail();
    const line = sectionNamed("Revenue").children![0];
    expect(figures.get(line.id)!.valueType).toBe(MIS_VALUE_TYPES.CURRENCY);
  });
});

describe("when one of the two calls has nothing to say", () => {
  // The source renders whichever of its two promises resolved. A detail view
  // missing its financial accounts is still a detail view with an ARR in it.
  it("still draws the sections of the call that answered", () => {
    const { rows, figures } = flashDetailRows(SALES, {});
    expect(rows.find((row) => row.label === "ARR")!.children).toHaveLength(1);
    expect(rows.find((row) => row.label === "Revenue")!.children).toBeUndefined();
    expect(figures.size).toBe(2);
  });

  it("draws every heading and no lines when neither answered", () => {
    const { rows, figures } = flashDetailRows({}, {});
    expect(rows).toHaveLength(FLASH_DETAIL_SECTIONS.length);
    expect(figures.size).toBe(0);
  });

  it("ignores a section that arrived as something other than a list", () => {
    const { rows } = flashDetailRows({ arr: "nothing" as never }, {});
    expect(rows[0].children).toBeUndefined();
  });
});

describe("the ids the table tracks open sections by", () => {
  it("are unique across the whole view", () => {
    const ids: string[] = [];
    const walk = (list: readonly { id: string; children?: readonly never[] }[]) => {
      for (const row of list) {
        ids.push(row.id);
        walk((row.children ?? []) as never[]);
      }
    };
    walk(detail().rows as never[]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stay unique when two lines in a section share a title", () => {
    const { rows } = flashDetailRows(
      {
        arr: [
          { id: "1", title: "Recurring", summary: [] },
          { id: "2", title: "Recurring", summary: [] },
        ],
      },
      {},
    );
    expect(rows[0].children![0].id).not.toBe(rows[0].children![1].id);
  });
});

// Ticket 16. A figure in the detail view is a sum of GL accounts, and the ones
// Finance may write forecasts against open the list of those accounts — the
// source's Account View. Which ones, and what each asks the backend, is decided
// here, BY NAME: a line whose title the backend renames stops opening anything,
// rather than opening some other category's accounts.
describe("which figures have accounts behind them", () => {
  const line = (id: string, title: string, subLevel?: FlashRangeRow[]): FlashRangeRow => ({
    id,
    title,
    summary: [month("2026-08-31", "2026-09-30", 1)],
    ...(subLevel ? { subLevel } : {}),
  });
  // The backend's own shapes: a heading line first (id "1"), then its parts;
  // every Cost of Sales line repeats its own name as its first sub-level.
  const BOOKS: FlashFinancialAccountStatistics = {
    revenue: [
      line("1", "Revenue"),
      line("2", "Recurring"),
      line("3", "Non-Recurring/PSO"),
      line("4", "Cloud"),
    ],
    costOfSales: [
      line("1", "Cost of Sales", [line("1", "Cost of Sales"), line("2", "Bonus")]),
      line("2", "Recurring", [line("1", "Recurring"), line("2", "Bonus"), line("3", "Infra/IT")]),
      line("3", "Non-Recurring/PSO", [line("1", "Non-Recurring/PSO"), line("2", "Consultancy")]),
      // "Public Cloud" is both this line's name and one of its sub-categories.
      line("4", "Public Cloud", [line("1", "Public Cloud"), line("2", "Public Cloud")]),
    ],
    // The same titles, in sections nobody writes to.
    grossProfit: [line("1", "Gross Profit"), line("2", "Recurring")],
    expense: [line("1", "Expenses"), line("2", "Sales", [line("1", "Sales"), line("2", "Travel")])],
  };
  const { rows, figures } = flashDetailRows({}, BOOKS);
  const section = (label: string) => rows.find((row) => row.label === label)!;
  const behind = (row: { id: string }) => figures.get(row.id)?.accounts;
  const revenue = section("Revenue").children!;
  const costOfSales = section("Cost of Sales").children!;

  // `constants.bal`'s REVENUE_* — note "Non Recurring" has no hyphen at the
  // backend, where the line's own title does.
  it("opens each revenue line on its own account category", () => {
    expect(revenue.slice(1).map(behind)).toEqual([
      { book: "income", accountCategory: "Recurring Revenue" },
      { book: "income", accountCategory: "Non Recurring Revenue" },
      { book: "income", accountCategory: "Cloud" },
    ]);
  });

  it("does not open the Revenue heading, which is every category at once", () => {
    expect(behind(revenue[0])).toBeUndefined();
  });

  // The category comes from the LINE ABOVE, the sub-category from the line.
  it("opens a cost-of-sales sub-category within the category its line sums", () => {
    expect(behind(costOfSales[1].children![2])).toEqual({
      book: "cost-of-sales",
      accountCategory: "Recurring Revenue COS",
      accountSubCategory: "Infra/IT",
    });
    expect(behind(costOfSales[2].children![1])).toEqual({
      book: "cost-of-sales",
      accountCategory: "Non-Recurring Revenue COS",
      accountSubCategory: "Consultancy",
    });
    expect(behind(costOfSales[3].children![1])).toEqual({
      book: "cost-of-sales",
      accountCategory: "Cloud",
      accountSubCategory: "Public Cloud",
    });
  });

  // `MonthlyViewDialog.js` marks `subObj.id === "1"` as a title. Asserted on
  // Public Cloud, the one line where the heading and a sub-category share a
  // name, so a rule by title could not pass it.
  it("does not open a sub-level's own heading, even beside its namesake", () => {
    const [heading, namesake] = costOfSales[3].children!;
    expect(heading.label).toBe(namesake.label);
    expect(behind(heading)).toBeUndefined();
    expect(behind(namesake)).toBeDefined();
  });

  it("does not open anything under the Cost of Sales total", () => {
    expect(costOfSales[0].children!.map(behind)).toEqual([undefined, undefined]);
  });

  it("does not open a cost-of-sales line itself, only its sub-categories", () => {
    expect(costOfSales.map(behind)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("opens nothing in any other section, whatever its lines are called", () => {
    expect(section("Gross Profit").children!.map(behind)).toEqual([undefined, undefined]);
    const sales = section("Expense").children![1];
    expect([sales, ...sales.children!].map(behind)).toEqual([undefined, undefined, undefined]);
  });
});

describe("what an account view asks for", () => {
  const RECURRING = { book: "income", accountCategory: "Recurring Revenue" } as const;

  it("asks for one business unit and one month", () => {
    expect(flashAccountsQuery(RECURRING, "IAM", { year: 2026, month: 9 })).toEqual({
      book: "income",
      accountCategory: "Recurring Revenue",
      businessUnit: "IAM",
      month: "2026-09",
    });
  });

  // `MonthlyViewTable.js` opens nothing when `bu === BU_LIST.WSO2`, whose value
  // is "All" — the whole company, which no single account belongs to.
  it("asks nothing of the WSO2 column", () => {
    expect(flashAccountsQuery(RECURRING, "All", { year: 2026, month: 9 })).toBeNull();
  });

  it("asks nothing for a figure with no accounts behind it", () => {
    expect(flashAccountsQuery(undefined, "IAM", { year: 2026, month: 9 })).toBeNull();
  });
});
