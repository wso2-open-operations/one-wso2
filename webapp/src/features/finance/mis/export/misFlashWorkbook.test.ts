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
import ExcelJS from "exceljs";
import { flashPnlRows, FLASH_UNIT_COLUMNS } from "../components/flashPnlRows";
import { flashDetailRows } from "../components/flashDetailRows";
import { flashMonthlyRanges } from "../util/misFlashPeriods";
import type { FlashBalanceStatement, FlashRangeRow } from "../api/misFlashTypes";
import { writeMisWorkbook, type MisWorkbookSheet } from "./misWorkbook";
import {
  misFlashAnnualSheet,
  misFlashMonthlyFilename,
  misFlashMonthlySheet,
  misFlashReportFilename,
  type MisFlashReportContext,
} from "./misFlashWorkbook";

// Spec §10.17 for the Flash's workbook, asserted on the FILE for ticket 11's
// reason: the sheet spec is these builders' own vocabulary, so a test over it
// agrees with them by construction. The bytes are what Finance opens.
//
// The fixtures go through the SAME `flashPnlRows` and `flashDetailRows` the
// screens call, rather than hand-built rows, because the promise being tested
// is that the file is the screen, as numbers — a hand-built tree would test a
// table nobody draws.

/** One sheet, written and read back the way Excel would. */
async function roundTrip(sheet: MisWorkbookSheet): Promise<ExcelJS.Worksheet> {
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await writeMisWorkbook({ sheets: [sheet] }));
  return loaded.worksheets[0];
}

/** The first row whose label, less its indent, is `label`. */
function rowLabelled(sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? "").trim() === label) found ??= row;
  });
  expect(found, `no row "${label}"`).toBeDefined();
  return found!;
}

const argbOf = (cell: ExcelJS.Cell): string | undefined =>
  (cell.fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;

const STATEMENT: FlashBalanceStatement = {
  revenue: [
    {
      id: "1",
      title: "Recurring Revenue",
      integrationSoftware: 1_234_567.5,
      iam: 1_000,
      corporate: 7,
      wso2: 2_234_567.5,
    },
  ],
  costOfSales: [
    {
      id: "1",
      title: "Recurring Revenue COS",
      wso2: 500_000,
      subLevel: [{ id: "1", title: "Cloud Hosting", wso2: 300_000 }],
    },
  ],
  grossMargin: [{ id: "1", title: "Recurring Margin", integrationSoftware: 77.5, wso2: 62.25 }],
};

/** 8pm on 23 September in California — already the 24th in UTC. */
const PACIFIC_EVENING = new Date("2026-09-24T03:00:00Z");

const CONTEXT: MisFlashReportContext = {
  subRegions: ["EU : EU 1", "NA - WEST"],
  rangeLabel: "2025-09-01 to 2026-09-01",
  instant: PACIFIC_EVENING,
};

describe("the Flash P&L, as the Annual Summary sheet", () => {
  const sheet = () => roundTrip(misFlashAnnualSheet(flashPnlRows(STATEMENT), "full", CONTEXT));

  it("is titled in the source's words, with what the figures were asked under", async () => {
    const annual = await sheet();
    expect(annual.name).toBe("Annual Summary");
    expect(annual.getCell("A1").value).toBe(
      "Finance MIS Flash Report – Full Overview | EU : EU 1, NA - WEST " +
        "(2025-09-01 to 2026-09-01)",
    );
    expect(annual.getCell("A1").font).toMatchObject({ bold: true, size: 16 });
    // Across the label column and all six units.
    expect(annual.getCell("G1").master.address).toBe("A1");
    // In Pacific Time: the source's `toLocaleDateString()` would say the 24th
    // from UTC and the 24th from Colombo.
    expect(annual.getCell("A2").value).toBe("Generated on: 2026-09-23");
    // And the source's one section heading, bold and merged across.
    expect(annual.getCell("A3").value).toBe("ANNUAL DATA SUMMARY");
    expect(annual.getCell("A3").font?.bold).toBe(true);
    expect(annual.getCell("G3").master.address).toBe("A3");
  });

  it("says Annual Overview for the one-sheet report, and no clause for no sub-region", async () => {
    const annual = await roundTrip(
      misFlashAnnualSheet(flashPnlRows(STATEMENT), "annual", { ...CONTEXT, subRegions: [] }),
    );
    expect(annual.getCell("A1").value).toBe(
      "Finance MIS Flash Report – Annual Overview (2025-09-01 to 2026-09-01)",
    );
  });

  it("says its figures are in dollars, and orders business units as on screen", async () => {
    const annual = await sheet();
    // Spec §10.18, taken both ways as ticket 11 takes it for the Build.
    expect(annual.getCell("A4").value).toBe("All amounts in USD");
    // The SCREEN's order, where the source's sheet puts Corporate in its fourth
    // column — the file is the table the reader was looking at.
    expect(annual.getRow(6).values).toEqual([
      undefined,
      "Line",
      "Integration",
      "IAM",
      "APIM",
      "Choreo",
      "Corporate",
      "WSO2",
    ]);
  });

  it("colours each unit's heading with that unit's colour from the source", async () => {
    const header = (await sheet()).getRow(6);
    // By UNIT, not by position: the source's Corporate is `#D7CCC8` in its
    // fourth column, and it keeps that colour in the port's sixth.
    expect(argbOf(header.getCell(1))).toBe("FFBBDEFB");
    expect(argbOf(header.getCell(2))).toBe("FFC8E6C9");
    expect(argbOf(header.getCell(6))).toBe("FFD7CCC8");
    expect(argbOf(header.getCell(7))).toBe("FFB2DFDB");
  });

  it("writes every figure as a number, where the source writes formatted text", async () => {
    const recurring = rowLabelled(await sheet(), "Recurring Revenue");
    expect(recurring.getCell(2).value).toBe(1_234_567.5);
    expect(recurring.getCell(2).numFmt).toBe("#,##0.00");
    // Corporate's figure lands under Corporate.
    expect(recurring.getCell(6).value).toBe(7);
    // A unit the backend said nothing about is empty, not nought.
    expect(recurring.getCell(4).value).toBeNull();
  });

  it("writes Gross Margin as a percentage, not a bare decimal", async () => {
    // Ticket 18's own criterion. The backend's 77.5 means 77.5%; the source's
    // file carried the text "77.50", and the cell here shows "77.50%".
    const margin = rowLabelled(await sheet(), "Recurring Margin");
    expect(margin.getCell(2).value).toBe(0.775);
    expect(margin.getCell(2).numFmt).toBe("0.00%");
    expect(margin.getCell(7).value).toBe(0.6225);
  });

  it("keeps the statement's tree, sub-levels included", async () => {
    const annual = await sheet();
    expect(rowLabelled(annual, "Cost of Sales").font?.bold).toBe(true);
    const hosting = rowLabelled(annual, "Cloud Hosting");
    expect(hosting.getCell(1).value).toBe("    Cloud Hosting");
    expect(hosting.outlineLevel).toBe(2);
    expect(hosting.getCell(7).value).toBe(300_000);
    // Every section, drawn or folded on screen: the last is still there.
    expect(rowLabelled(annual, "Net Profit/Loss")).toBeDefined();
  });
});

/** One line across thirteen months, month N holding N. */
const monthly = (title: string, scale = 1): FlashRangeRow => ({
  id: "1",
  title,
  summary: Array.from({ length: 13 }, (_, index) => ({ value: index * scale })),
});

const RANGES = flashMonthlyRanges({ year: 2025, month: 9 }, { year: 2026, month: 9 });
const IAM = FLASH_UNIT_COLUMNS.find((unit) => unit.key === "iam")!;
const DETAIL = flashDetailRows(
  { arr: [monthly("Opening ARR", 1_000)] },
  {
    revenue: [monthly("Recurring", 100)],
    grossMargin: [monthly("Recurring Margin", 10)],
    otherExpenses: [monthly("Interest paid")],
    otherIncome: [monthly("Interest earned")],
  },
);

describe("one business unit, month by month, as a sheet", () => {
  const sheet = () =>
    roundTrip(misFlashMonthlySheet(IAM, DETAIL, RANGES, []));

  it("is named as the screen names the unit, and titled in the source's words", async () => {
    const iam = await sheet();
    expect(iam.name).toBe("IAM");
    // The span the dialog heads itself with — the months it DRAWS.
    expect(iam.getCell("A1").value).toBe(
      "Finance MIS Flash Report Monthly Details - IAM (2025-09-30 to 2026-09-30)",
    );
    expect(iam.getCell("A1").font).toMatchObject({ bold: true, size: 14 });
    expect(iam.getCell("A2").value).toBe("All amounts in USD");
  });

  it("heads the twelve months the dialog draws, not the thirteen it fetched", async () => {
    const header = (await sheet()).getRow(4);
    const months = (header.values as unknown[]).slice(2);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("Oct 2025");
    expect(months[11]).toBe("Sep 2026");
    // The source's green on the months, and nothing on the label.
    expect(argbOf(header.getCell(2))).toBe("FFD0F0C0");
    expect(argbOf(header.getCell(1))).toBeUndefined();
  });

  it("reads each month by the index it came from, so the oldest never lands", async () => {
    const arr = rowLabelled(await sheet(), "Opening ARR");
    // Oct 2025 is response index 1: summary[0], September, is fetched and not drawn.
    expect(arr.getCell(2).value).toBe(1_000);
    expect(arr.getCell(13).value).toBe(12_000);
  });

  it("writes Revenue, which the source's monthly sheet has never contained", async () => {
    // `generateMonthlySheet.js` reads `bu.financialAccountStatistics?.revenue`
    // and both of its callers pass `financialStatistics`, so the section is
    // always skipped. Here the sheet is built from the dialog's own rows.
    expect(rowLabelled(await sheet(), "Recurring").getCell(2).value).toBe(100);
  });

  it("puts each section under its own heading, in the dialog's order", async () => {
    const iam = await sheet();
    // The source reads Other Income from `netProfit`, which the backend does
    // not send, so has no Other Income section; and it heads Other Income's
    // figures "Other Expenses", so never writes the real ones. Here each line
    // is under its own heading, the two in the order the dialog draws them.
    const otherIncome = rowLabelled(iam, "Other Income").number;
    expect(rowLabelled(iam, "Other Expenses").number).toBeLessThan(otherIncome);
    expect(rowLabelled(iam, "Interest paid").number).toBeLessThan(otherIncome);
    expect(rowLabelled(iam, "Interest earned").number).toBeGreaterThan(otherIncome);
  });

  it("writes Gross Margin as a percentage here too", async () => {
    const margin = rowLabelled(await sheet(), "Recurring Margin");
    expect(margin.getCell(2).value).toBe(0.1);
    expect(margin.getCell(2).numFmt).toBe("0.00%");
  });

  it("names the sub-regions its figures were asked under", async () => {
    const narrowed = await roundTrip(
      misFlashMonthlySheet(IAM, DETAIL, RANGES, ["EU : EU 1", "NA - WEST"]),
    );
    expect(narrowed.getCell("A1").value).toBe(
      "Finance MIS Flash Report Monthly Details - IAM | EU : EU 1, NA - WEST " +
        "(2025-09-30 to 2026-09-30)",
    );
  });
});

describe("what a Flash export is called", () => {
  it("names the report and the Pacific day it was taken", () => {
    expect(misFlashReportFilename("full", PACIFIC_EVENING)).toBe(
      "flash_full_report_2026-09-23.xlsx",
    );
    expect(misFlashReportFilename("annual", PACIFIC_EVENING)).toBe(
      "flash_annual_report_2026-09-23.xlsx",
    );
  });

  it("names the unit for a monthly view", () => {
    expect(misFlashMonthlyFilename(IAM, PACIFIC_EVENING)).toBe(
      "flash_monthly_iam_2026-09-23.xlsx",
    );
  });
});
