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
import type { BuildRow } from "../components/buildTableModel";
import { MIS_ROW_LABELS } from "../util/misMoney";
import { MIS_NUMBER_FORMATS } from "./misWorkbook";
import { misBuildSheet, type MisBuildSheetInput } from "./misBuildWorkbook";

// A Subscription Build, cut down to the three rows that differ in KIND —
// money, a headcount and a ratio — because the one rule this has to get right
// is spec §3's, and those three are the only three answers it has.
const ROWS: readonly BuildRow[] = [
  {
    id: "arr-movement",
    label: "ARR movement",
    children: [
      { id: "opening-arr", label: MIS_ROW_LABELS.OPENING_ARR, emphasis: true },
      { id: "new-arr", label: MIS_ROW_LABELS.NEW },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    children: [{ id: "opening-customers", label: MIS_ROW_LABELS.OPENING_CUSTOMERS }],
  },
  {
    id: "retention",
    label: "Retention",
    children: [{ id: "ndr", label: MIS_ROW_LABELS.NET_DOLLAR_RETENTION }],
  },
];

const FIGURES: Record<string, Record<string, number>> = {
  "opening-arr": { "2024": 1_234_567.5, "2025": 2_000_000 },
  "new-arr": { "2024": 90_000, "2025": 120_000 },
  "opening-customers": { "2024": 412, "2025": 455 },
  ndr: { "2024": 98.25, "2025": 101.4 },
};

const INPUT: MisBuildSheetInput = {
  name: "Subscription",
  rowLabelHeader: "Summary",
  columnGroups: [
    { key: "2024", label: "2024" },
    { key: "2025", label: "2025" },
  ],
  subColumns: [{ key: "amount", label: "ARR", width: 170 }],
  rows: ROWS,
  value: (row, group) => FIGURES[row.id]?.[group.key],
};

/** The cell at a 1-based row and column, as the sheet describes it. */
const at = (sheet: ReturnType<typeof misBuildSheet>, row: number, column: number) =>
  sheet.rows[row - 1].cells[column - 1];

describe("a Build, as a sheet", () => {
  it("says what its figures are in, before any of them", () => {
    // Spec §10.18's answer, taken BOTH ways: the figures below are unscaled AND
    // the file says so. The caption is `amountUnitCaption`'s own words rather
    // than a retyped copy — the screen's caption and the sheet's must not be
    // able to drift, because between them they are the only two places a
    // reader is ever told.
    expect(at(misBuildSheet(INPUT), 1, 1).value).toBe("All amounts in USD");
  });

  it("puts the Periods over their sub-columns, and the identity columns beside", () => {
    const sheet = misBuildSheet(INPUT);
    // Two header rows, the same two ADR 0004 makes the table draw by hand.
    expect(sheet.rows[2].cells.map((cell) => cell.value)).toEqual([null, "2024", "2025"]);
    expect(sheet.rows[3].cells.map((cell) => cell.value)).toEqual(["Summary", "ARR", "ARR"]);
  });

  it("writes a figure as a NUMBER, at units, whatever the screen is showing", () => {
    // The foot-gun spec §10.18 exists for, and the one the source's own Flash
    // export has: `generateAnnualSheet.js` writes `formatNumber(value)` — a
    // STRING — into every figure cell, so a column of them cannot be summed.
    //
    // `misBuildSheet` takes no Scale at all. That is the enforcement: there is
    // no parameter a caller could pass the reader's thousands setting through,
    // so an export cannot be 1000x off however it is called.
    const sheet = misBuildSheet(INPUT);
    const openingArr = at(sheet, 6, 2);
    expect(openingArr.value).toBe(1_234_567.5);
    expect(openingArr.numFmt).toBe(MIS_NUMBER_FORMATS.CURRENCY);
  });

  it("formats a headcount and a ratio by what the row IS, not by what it looks like", () => {
    // Spec §3, on the sheet as on the screen: Scale never scales counts, and
    // the number format is how a spreadsheet says the same thing. Read through
    // `misValueTypeForRow`, so the sheet and the screen cannot disagree.
    const sheet = misBuildSheet(INPUT);
    expect(at(sheet, 9, 2).value).toBe(412);
    expect(at(sheet, 9, 2).numFmt).toBe(MIS_NUMBER_FORMATS.COUNT);
    expect(at(sheet, 11, 2).numFmt).toBe(MIS_NUMBER_FORMATS.PERCENTAGE);
  });

  it("writes a percentage as the fraction Excel's percent format shows as one", () => {
    // The ARR backend sends 98.25 to mean 98.25%, and Excel's "0.00%" shows a
    // cell holding 0.9825 as "98.25%". So the figure is divided on the way in,
    // here and nowhere else — and ONLY a percentage is: the Opening ARR in the
    // same column is not.
    const sheet = misBuildSheet(INPUT);
    expect(at(sheet, 11, 2).value).toBe(0.9825);
    expect(at(sheet, 11, 3).value).toBe(1.014);
    expect(at(sheet, 6, 2).value).toBe(1_234_567.5);
  });

  it("indents the tree and hands Excel its own outline to fold", () => {
    const sheet = misBuildSheet(INPUT);
    expect(at(sheet, 5, 1).value).toBe("ARR movement");
    expect(sheet.rows[4].outlineLevel).toBe(0);
    expect(sheet.rows[4].bold).toBe(true);
    // Two spaces per level, the source's own indent — and an outline level, so
    // a reader can collapse a section in Excel the way they collapse it on
    // screen. Every row is written whatever is open on screen: a spreadsheet
    // that silently omitted the sections the reader had closed would be a
    // different Build from the one they exported.
    expect(at(sheet, 6, 1).value).toBe("  Opening ARR");
    expect(sheet.rows[5].outlineLevel).toBe(1);
  });

  it("leaves a cell the backend had nothing for empty, rather than writing a zero", () => {
    const sheet = misBuildSheet({ ...INPUT, value: () => undefined });
    expect(at(sheet, 6, 2).value).toBeNull();
  });

  it("passes through the words the backend answers where it cannot compute", () => {
    // "N/A" and "%" are already the display value — spec §8. They are text, so
    // they carry no number format.
    const sheet = misBuildSheet({ ...INPUT, value: () => "N/A" });
    expect(at(sheet, 6, 2).value).toBe("N/A");
    expect(at(sheet, 6, 2).numFmt).toBeUndefined();
  });
});

// Ticket 18. The Flash P&L's columns are business units with nothing under
// them — `BuildTable`'s undivided case, which ticket 15 taught the table and
// nobody taught this. Before it, `subColumns: []` wrote a sheet with NO figure
// columns at all: every row label and not one number.
describe("a table whose columns have no sub-columns, as a sheet", () => {
  const UNDIVIDED: MisBuildSheetInput = {
    name: "Annual Summary",
    rowLabelHeader: "Line",
    columnGroups: [
      { key: "iam", label: "IAM", width: 140 },
      { key: "wso2", label: "WSO2" },
    ],
    subColumns: [],
    rows: [
      { id: "revenue", label: "Revenue", children: [{ id: "recurring", label: "Recurring" }] },
    ],
    value: (row, _group, subColumnKey) =>
      row.id === "recurring" ? { iam: 1_000, wso2: 2_500.5 }[subColumnKey] : undefined,
  };

  it("writes one figure column per group, under ONE header row", () => {
    const sheet = misBuildSheet(UNDIVIDED);
    // Caption, blank, then the header — no Period row above it, because there
    // is nothing for one to span. `BuildTable` draws one header row here too.
    expect(sheet.rows[2].cells.map((cell) => cell.value)).toEqual(["Line", "IAM", "WSO2"]);
    expect(sheet.rows[4].cells.map((cell) => cell.value)).toEqual(["  Recurring", 1_000, 2_500.5]);
  });

  it("hands the value reader the group's own key, as the table hands its cell", () => {
    // `undividedSubColumn`: with no sub-division the column IS the group. The
    // reader above keys on `subColumnKey`, so a figure lands only if the sheet
    // passes the group's key there, the way `BuildTable` does.
    const sheet = misBuildSheet(UNDIVIDED);
    expect(at(sheet, 5, 3).value).toBe(2_500.5);
  });

  it("sizes each column by its group, since there is no sub-column to ask", () => {
    const sheet = misBuildSheet(UNDIVIDED);
    // 140px is 20 of Excel's; a group stating no width gets the table's own
    // default figure column rather than nothing.
    expect(sheet.columns.map((column) => column.width)).toEqual([37, 20, 19]);
  });
});

// Ticket 18 again. Flash's workbook opens each sheet with a report title and
// fills its header cells. Both are said to `misBuildSheet` rather than done to
// its output afterwards: a caller patching rows by index would be coupled to
// how many rows the caption takes, which is this builder's business.
describe("a sheet with a heading and filled headers", () => {
  const HEADED: MisBuildSheetInput = {
    ...INPUT,
    heading: [
      { text: "Finance MIS Flash Report", bold: true, fontSize: 16 },
      { text: "Generated" },
    ],
    headerFill: (group) => (group ? `FF00${group.key}` : "FFBBDEFB"),
  };

  it("puts the heading above the caption, each line across the whole sheet", () => {
    const sheet = misBuildSheet(HEADED);
    expect(sheet.rows[0]).toMatchObject({ bold: true, fontSize: 16 });
    expect(at(sheet, 1, 1).value).toBe("Finance MIS Flash Report");
    expect(at(sheet, 2, 1).value).toBe("Generated");
    // The caption is still said, and still before any figure.
    expect(at(sheet, 3, 1).value).toBe("All amounts in USD");
    // Three columns: the label and one per Period.
    expect(sheet.merges).toEqual([
      { top: 1, left: 1, bottom: 1, right: 3 },
      { top: 2, left: 1, bottom: 2, right: 3 },
    ]);
  });

  it("merges nothing when it has no heading", () => {
    expect(misBuildSheet(INPUT).merges ?? []).toEqual([]);
  });

  it("fills each header cell by the column it heads", () => {
    const sheet = misBuildSheet(HEADED);
    // Period row, then the sub-column row, both under the two lines of heading.
    expect(sheet.rows[4].cells.map((cell) => cell.fill)).toEqual([
      "FFBBDEFB",
      "FF002024",
      "FF002025",
    ]);
    expect(sheet.rows[5].cells.map((cell) => cell.fill)).toEqual([
      "FFBBDEFB",
      "FF002024",
      "FF002025",
    ]);
    // And no figure cell.
    expect(sheet.rows[7].cells.some((cell) => cell.fill)).toBe(false);
  });
});
