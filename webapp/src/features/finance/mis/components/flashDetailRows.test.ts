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
  FlashSalesStatistics,
} from "../api/misFlashTypes";
import { FLASH_DETAIL_SECTIONS, flashDetailRows } from "./flashDetailRows";
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
