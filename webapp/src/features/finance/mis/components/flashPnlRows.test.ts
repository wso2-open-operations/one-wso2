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
import type { FlashBalanceStatement } from "../api/misFlashTypes";
import {
  FLASH_PNL_SECTIONS,
  FLASH_UNIT_COLUMNS,
  flashPnlRows,
} from "./flashPnlRows";
import { flashSectionIds } from "./flashRowIds";

// The monthly P&L, as `GET /balance-statement` answers it and as the table
// draws it.
//
// The source assembles the same thing by mutating the response in place —
// fourteen `unshift`es of a synthetic title row, an `Object.assign` marking
// Gross Margin a percentage, and a renumbering pass that overwrites every
// backend `id` with its position (`FlashConsole.js`'s `fetchData`). This is the
// same assembly as a pure function over an untouched response, which is what
// makes it testable at all.

const unit = (values: Partial<Record<string, number | null>>) => values;

const STATEMENT: FlashBalanceStatement = {
  arr: [{ id: "1", title: "Total ARR", integrationSoftware: 1000, iam: 2000, wso2: 3000 }],
  booking: [{ id: "1", title: "Total Booking", integrationSoftware: 10, iam: 20, wso2: 30 }],
  revenue: [{ id: "1", title: "Recurring", integrationSoftware: 500, iam: 600, wso2: 1100 }],
  costOfSales: [
    {
      id: "1",
      title: "Recurring Revenue COS",
      integrationSoftware: 100,
      wso2: 250,
      subLevel: [
        { id: "1", title: "Cloud Hosting", integrationSoftware: 60, wso2: 150 },
        { id: "2", title: "Support", integrationSoftware: 40, wso2: 100 },
      ],
    },
  ],
  grossProfit: [{ id: "1", title: "Gross Profit", integrationSoftware: 400, wso2: 850 }],
  grossMargin: [{ id: "1", title: "Gross Margin", integrationSoftware: 80, wso2: 77.27 }],
  expense: [{ id: "1", title: "Marketing", wso2: 90, subLevel: [{ id: "1", title: "Events", wso2: 90 }] }],
  ebitdas: [{ id: "1", title: "EBITDAS", wso2: 760 }],
  stockCompensationGratuity: [{ id: "1", title: "Stock Compensation", wso2: 10 }],
  ebitda: [{ id: "1", title: "EBITDA", wso2: 750 }],
  otherIncome: [{ id: "1", title: "Interest", wso2: 5 }],
  otherExpenses: [{ id: "1", title: "Bank Charges", wso2: 2 }],
  netOtherIncome: [{ id: "1", title: "Net Other Income", wso2: 3 }],
  netProfitLoss: [{ id: "1", title: "Net Profit/Loss", wso2: 753 }],
};

const pnl = (statement: FlashBalanceStatement = STATEMENT) => flashPnlRows(statement);
const labelsOf = (rows: readonly { label: string }[]) => rows.map((row) => row.label);

describe("the columns of a P&L", () => {
  // The source's grid, minus the one column commented out in it —
  // `integrationCloud`, whose whole definition is dead (`DataTable.js:183-207`).
  it("is the six business units the source draws, in its order", () => {
    expect(FLASH_UNIT_COLUMNS.map((column) => column.label)).toEqual([
      "Integration",
      "IAM",
      "APIM",
      "Choreo",
      "Corporate",
      "WSO2",
    ]);
  });

  it("reads each column off the field the backend actually sends", () => {
    expect(FLASH_UNIT_COLUMNS.map((column) => column.key)).toEqual([
      "integrationSoftware",
      "iam",
      "apim",
      "choreo",
      "corporate",
      "wso2",
    ]);
  });

  // ADR 0003, and the least obvious of the reproductions: the source hands the
  // Integration column's monthly dialog `subRegions={subRegions}`
  // (`DataTable.js:175`) and hands the other five `subregions=` with a
  // lower-case r (`:226`, `:251`, `:276`, `:301`, `:326`), which
  // `MonthlyViewDialog` defaults to `[]`. So five of the six monthly views
  // ignore the reader's sub-regions, in both apps.
  it("tells only the Integration column's detail view about the sub-regions", () => {
    const sending = FLASH_UNIT_COLUMNS.filter((column) => column.sendsSubRegions);
    expect(sending.map((column) => column.key)).toEqual(["integrationSoftware"]);
  });

  // The detail views ask per business unit, and the name they ask by is NOT the
  // column header: `BU_LIST` calls the WSO2 column "All" and the Integration
  // one "Integration-Software" (`Config.js:95-103`).
  it("carries the name the detail views ask the backend by", () => {
    const byKey = new Map(FLASH_UNIT_COLUMNS.map((column) => [column.key, column.businessUnit]));
    expect(byKey.get("integrationSoftware")).toBe("Integration-Software");
    expect(byKey.get("apim")).toBe("APIM-Software");
    expect(byKey.get("wso2")).toBe("All");
    expect(byKey.get("iam")).toBe("IAM");
  });
});

describe("the sections, and the order they read in", () => {
  it("is the order the source concatenates them in", () => {
    expect(FLASH_PNL_SECTIONS.map((section) => section.label)).toEqual([
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
      "Other Income",
      "Other Expenses",
      "Net Other Income",
      "Net Profit/Loss",
    ]);
  });

  it("puts one row on screen per section, each holding its own lines", () => {
    const { rows } = pnl();
    expect(labelsOf(rows)).toEqual(FLASH_PNL_SECTIONS.map((section) => section.label));
  });

  it("opens with every section showing, and every sub-level folded away", () => {
    const { rows } = pnl();
    // Against the section ids written out, not against another pass over the
    // same rows — `flashSectionIds` IS `rows.map(row => row.id)`, so comparing
    // the two could never disagree.
    expect(flashSectionIds(rows)).toEqual(FLASH_PNL_SECTIONS.map((section) => section.id));
    // The sub-levels are a level below, so they are NOT in the opening set.
    const costOfSales = rows.find((row) => row.label === "Cost of Sales")!;
    expect(flashSectionIds(rows)).not.toContain(costOfSales.children![0].id);
  });

  it("emphasises the section line, which carries no figures of its own", () => {
    const { rows, figures } = pnl();
    expect(rows.every((row) => row.emphasis)).toBe(true);
    expect(figures.has(rows[0].id)).toBe(false);
  });
});

describe("the lines inside a section", () => {
  it("are the rows the backend sent, under the section they came in", () => {
    const { rows } = pnl();
    const revenue = rows.find((row) => row.label === "Revenue")!;
    expect(labelsOf(revenue.children!)).toEqual(["Recurring"]);
  });

  it("reads each business unit off its own field", () => {
    const { rows, figures } = pnl();
    const line = rows.find((row) => row.label === "ARR")!.children![0];
    expect(figures.get(line.id)!.amounts).toMatchObject(
      unit({ integrationSoftware: 1000, iam: 2000, wso2: 3000 }),
    );
  });

  // A business unit the backend said nothing about is absent, not nought. The
  // two are different claims and only one of them is true.
  it("leaves a unit the backend did not mention empty", () => {
    const { rows, figures } = pnl();
    const line = rows.find((row) => row.label === "ARR")!.children![0];
    expect(figures.get(line.id)!.amounts.apim).toBeNull();
  });
});

describe("a section with sub-levels", () => {
  // Ticket 15: the sub-levels are the collapsible sections the table already
  // provides. The source opens a separate dialog for them instead
  // (`MultiLevelViewDialog`), which is what this replaces.
  it("hangs a line's sub-level under the line itself", () => {
    const { rows } = pnl();
    const line = rows.find((row) => row.label === "Cost of Sales")!.children![0];
    expect(labelsOf(line.children!)).toEqual(["Cloud Hosting", "Support"]);
  });

  it("gives a sub-level line its own figures", () => {
    const { rows, figures } = pnl();
    const line = rows.find((row) => row.label === "Cost of Sales")!.children![0];
    expect(figures.get(line.children![0].id)!.amounts).toMatchObject(
      unit({ integrationSoftware: 60, wso2: 150 }),
    );
  });

  it("leaves a line with no sub-level a leaf", () => {
    const { rows } = pnl();
    const line = rows.find((row) => row.label === "Revenue")!.children![0];
    expect(line.children).toBeUndefined();
  });
});

// Ticket 15's named criterion, and spec §3's rule. Gross Margin is a rate, so
// the units/thousands control must not touch it — and the decision is made HERE,
// by the section a row came in, rather than by looking its label up: these
// labels are account categories the backend names at runtime, so a lookup would
// answer "currency" for every one of them.
describe("which figures Scale may touch", () => {
  it("calls every Gross Margin line a percentage", () => {
    const { rows, figures } = pnl();
    const section = rows.find((row) => row.label === "Gross Margin")!;
    for (const line of section.children!) {
      expect(figures.get(line.id)!.valueType).toBe(MIS_VALUE_TYPES.PERCENTAGE);
    }
  });

  it("calls every other line currency", () => {
    const { rows, figures } = pnl();
    for (const section of rows) {
      if (section.label === "Gross Margin") continue;
      for (const line of section.children ?? []) {
        expect(figures.get(line.id)!.valueType).toBe(MIS_VALUE_TYPES.CURRENCY);
      }
    }
  });

  it("calls a Gross Margin sub-level a percentage too", () => {
    const { rows, figures } = pnl({
      ...STATEMENT,
      grossMargin: [
        { id: "1", title: "Gross Margin", wso2: 77, subLevel: [{ id: "1", title: "Cloud", wso2: 61 }] },
      ],
    });
    const line = rows.find((row) => row.label === "Gross Margin")!.children![0];
    expect(figures.get(line.children![0].id)!.valueType).toBe(MIS_VALUE_TYPES.PERCENTAGE);
  });
});

describe("a response that is not the one the backend documents", () => {
  it("draws every section even when the statement is empty", () => {
    const { rows, figures } = flashPnlRows({});
    expect(labelsOf(rows)).toEqual(FLASH_PNL_SECTIONS.map((section) => section.label));
    expect(rows.every((row) => row.children === undefined)).toBe(true);
    expect(figures.size).toBe(0);
  });

  it("ignores a section that arrived as something other than a list", () => {
    const { rows } = flashPnlRows({ arr: "nothing" as never });
    expect(rows.find((row) => row.label === "ARR")!.children).toBeUndefined();
  });

  it("names a line the backend left untitled", () => {
    const { rows } = flashPnlRows({ arr: [{ id: "1", wso2: 5 }] });
    expect(labelsOf(rows.find((row) => row.label === "ARR")!.children!)).toEqual([""]);
  });

  it("keeps a line whose figures are all absent, because a blank line is an answer", () => {
    const { rows, figures } = flashPnlRows({ arr: [{ id: "1", title: "Total ARR" }] });
    const line = rows.find((row) => row.label === "ARR")!.children![0];
    expect(figures.get(line.id)!.amounts.wso2).toBeNull();
  });
});

describe("the ids the table tracks open sections by", () => {
  it("are unique across the whole statement", () => {
    const { rows } = pnl();
    const ids: string[] = [];
    const walk = (list: readonly { id: string; children?: readonly never[] }[]) => {
      for (const row of list) {
        ids.push(row.id);
        walk((row.children ?? []) as never[]);
      }
    };
    walk(rows as never[]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The reader's open sections survive a refetch, which is what BuildTable's
  // expansion set needs: it is seeded once and keyed by what a row IS.
  it("do not move when a figure changes", () => {
    const before = pnl().rows;
    const after = pnl({ ...STATEMENT, arr: [{ id: "1", title: "Total ARR", wso2: 999 }] }).rows;
    expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
  });

  it("stay unique when two lines in a section share a title", () => {
    const { rows } = flashPnlRows({
      arr: [
        { id: "1", title: "Recurring", wso2: 1 },
        { id: "2", title: "Recurring", wso2: 2 },
      ],
    });
    const lines = rows.find((row) => row.label === "ARR")!.children!;
    expect(lines[0].id).not.toBe(lines[1].id);
  });
});
