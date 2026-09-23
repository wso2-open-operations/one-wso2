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

// The Flash's workbook — the one Finance already uses, built on ticket 11's
// shared builders rather than beside them.
//
// Ported from `flashConsole/excel/downloadExcel.js`, `generateAnnualSheet.js`
// and `generateMonthlySheet.js`. The source's is where MIS's ExcelJS work began;
// ticket 11 wrote the builders first only because the Build needed an export
// earlier, and this file is where they are proven general enough. Two sheets'
// worth of layout, each a `misBuildSheet` with a heading and filled headers:
//
//   * **Annual Summary** — the P&L, one column per business unit.
//   * **one sheet per business unit** — that unit's monthly view.
//
// A Full Report is the first plus all six of the second; an Annual Report is
// the first alone; a monthly view's Export is one of the second. Composing them
// is the call site's one line, so it is not done here.
//
// ---- what is kept, and what is not -----------------------------------------
//
// KEPT: the sheets — "Annual Summary" and one per unit — the titles in the
// source's words, sub-regions included, "Generated on", the "ANNUAL DATA
// SUMMARY" line, the title sizes and merges, and the header colours: the
// workbook a Finance reader recognises.
//
// NOT kept, all spec §7:
//
//   * **Every figure is a NUMBER.** The source writes `formatNumber(value)`,
//     text, into every cell — so no column of the file can be summed.
//   * **The rows and names are the screen's.** Each sheet is built from the
//     same tree the screen draws (`flashPnlRows`, `flashDetailRows`), in its
//     order and under its labels, and a unit is called what its column is
//     called — "Integration", "APIM", "WSO2", where the source's sheets and
//     titles use the names the backend is asked by (`Integration-Software`,
//     `APIM-Software`, `All`). The source's sheets were written from a third
//     list of their own, and it had drifted: its monthly sheet reads Revenue
//     from a field neither caller sets, so has never contained Revenue; reads
//     Other Income from `netProfit`, which the backend does not send; and heads
//     Other Income's figures "Other Expenses", so the real Other Expenses are
//     never written either.
//   * **A title's range is the screen's**, the dates its status line or span
//     shows, where the source writes the picker months ("Sep 2025 - Sep 2026").
//   * **Gross Margin is a percentage** in Excel's own format — see
//     `MIS_NUMBER_FORMATS.PERCENTAGE`.
//   * **A monthly sheet has the dialog's twelve months**, not the thirteen
//     fetched; the oldest lies outside the P&L's range, and the dialog does not
//     draw it either.
//   * **Dates are Pacific**: "Generated on" and the filename share
//     `misExportDate`, where the source mixes a local date with none at all.

import {
  FLASH_UNIT_COLUMNS,
  flashPnlFigure,
  type FlashPnl,
  type FlashUnitColumn,
  type FlashUnitKey,
} from "../components/flashPnlRows";
import {
  FLASH_DETAIL_ROW_LABEL_WIDTH,
  flashDetailColumnGroups,
  flashDetailFigure,
  type FlashDetail,
} from "../components/flashDetailRows";
import type { BuildRow } from "../components/buildTableModel";
import { flashRangeLabel, type FlashMonthlyRange } from "../util/misFlashPeriods";
import { MIS_VALUE_TYPES, type MisValueType } from "../util/misMoney";
import { misBuildSheet } from "./misBuildWorkbook";
import { misExportDate, misExportFilename, misFilenameWord } from "./misExportFilename";
import type { MisWorkbookSheet } from "./misWorkbook";

/**
 * What a P&L report's figures were asked under — said in its title, because
 * the file outlives the screen that knew.
 */
export interface MisFlashReportContext {
  /** The sub-regions the request SENT, which is not always what was chosen — spec §8. */
  subRegions: readonly string[];
  /** The span, in the words the P&L's status line uses for it. */
  rangeLabel: string;
  /**
   * When the export was taken — the ONE instant `MisExportButton` hands both
   * this and the filename, so a Full Report whose reads straddle Pacific
   * midnight is not named for one day and generated on another.
   */
  instant: Date;
}

/** Which of the source's two P&L exports — its menu's "Full Report" and "Annual Report". */
export type MisFlashOverview = "full" | "annual";

/** What each report is called: in its title, and in its filename. */
const OVERVIEWS: Readonly<Record<MisFlashOverview, { title: string; file: string }>> = {
  full: { title: "Full Overview", file: "full_report" },
  annual: { title: "Annual Overview", file: "annual_report" },
};

/**
 * Each unit's header colour, from `generateAnnualSheet.js`'s `columnColors`.
 *
 * By UNIT rather than by position. The source colours columns in order and
 * orders them differently from its screen (Corporate fourth); here the sheet
 * takes the screen's order, and a colour stays with the unit it was on.
 * ARGB where the source writes `"#C8E6C9"` — see `MisWorkbookCell.fill`.
 */
// Partial because `FlashUnitKey` is any field of the backend's record, `title`
// and `subLevel` included; the six below are the ones a column reads.
const UNIT_FILLS: Readonly<Partial<Record<FlashUnitKey, string>>> = {
  integrationSoftware: "FFC8E6C9",
  iam: "FFFFE0B2",
  corporate: "FFD7CCC8",
  apim: "FFE1BEE7",
  choreo: "FFC5CAE9",
  wso2: "FFB2DFDB",
};
/** The label column's, the source's first. */
const LABEL_FILL = "FFBBDEFB";
/** `generateMonthlySheet.js`'s one colour, on every month heading. */
const MONTH_FILL = "FFD0F0C0";

/** The source's ` | a, b` — nothing when the request was not narrowed. */
const subRegionClause = (subRegions: readonly string[]): string =>
  subRegions.length ? ` | ${subRegions.join(", ")}` : "";

/**
 * What kind of number a row holds, by the SECTION it came in — not by its
 * label: Gross Margin's lines are named by the backend at runtime. A heading
 * has no figures and so no kind.
 */
const valueTypeIn =
  (figures: ReadonlyMap<string, { valueType: MisValueType }>) =>
  (row: Pick<BuildRow, "id">): MisValueType =>
    figures.get(row.id)?.valueType ?? MIS_VALUE_TYPES.CURRENCY;

/**
 * The P&L as the "Annual Summary" sheet.
 *
 * The same `rows` the screen draws and the same `flashPnlFigure` its cells
 * read, so the file and the screen cannot disagree about a line or a unit —
 * and `misBuildSheet` takes no Scale, so the figures are at units whatever
 * the reader has the screen set to.
 */
export function misFlashAnnualSheet(
  { rows, figures }: FlashPnl,
  overview: MisFlashOverview,
  { subRegions, rangeLabel, instant }: MisFlashReportContext,
): MisWorkbookSheet {
  return misBuildSheet({
    name: "Annual Summary",
    heading: [
      {
        text:
          `Finance MIS Flash Report – ${OVERVIEWS[overview].title}` +
          `${subRegionClause(subRegions)} (${rangeLabel})`,
        bold: true,
        fontSize: 16,
      },
      { text: `Generated on: ${misExportDate(instant)}` },
      // The source's one section heading (`addAnnualSection`), merged and bold.
      { text: "ANNUAL DATA SUMMARY", bold: true },
    ],
    // Named, as the screen names it, where the source's sheet says "Title".
    rowLabelHeader: "Line",
    // The screen's order. The source's file puts Corporate fourth; under ADR
    // 0002 that move awaits Finance's sign-off (spec §11.19), and undoing it is
    // this one argument.
    columnGroups: FLASH_UNIT_COLUMNS,
    // One figure column per unit — the undivided case, as the screen draws it.
    subColumns: [],
    rows,
    value: (row, group) => flashPnlFigure(figures, row, group),
    valueType: valueTypeIn(figures),
    headerFill: (group) => (group ? UNIT_FILLS[group.key as FlashUnitKey] : LABEL_FILL),
  });
}

/**
 * One business unit's monthly view as a sheet of its own, named after the unit.
 *
 * `detail` is what the dialog draws for that unit — `flashDetailRows` over its
 * two reads — the months are the dialog's own columns, and the span in the
 * title is the dialog's own (`flashRangeLabel`), so none of the three can be
 * handed in disagreeing with the others. `subRegions` are the ones its reads
 * were SENT. No "Generated on": the source's monthly sheet has none.
 */
export function misFlashMonthlySheet(
  unit: Pick<FlashUnitColumn, "label">,
  { rows, figures }: FlashDetail,
  ranges: readonly FlashMonthlyRange[],
  subRegions: readonly string[],
): MisWorkbookSheet {
  return misBuildSheet({
    // The column's label, where the source uses the name the backend is asked
    // by — `Integration-Software`, `APIM-Software`, and `All` for WSO2.
    name: unit.label,
    heading: [
      {
        text:
          `Finance MIS Flash Report Monthly Details - ${unit.label}` +
          `${subRegionClause(subRegions)} (${flashRangeLabel(ranges)})`,
        bold: true,
        fontSize: 14,
      },
    ],
    rowLabelHeader: "Line",
    rowLabelWidth: FLASH_DETAIL_ROW_LABEL_WIDTH,
    columnGroups: flashDetailColumnGroups(ranges),
    subColumns: [],
    rows,
    value: (row, group) => flashDetailFigure(figures, row, group),
    valueType: valueTypeIn(figures),
    headerFill: (group) => (group ? MONTH_FILL : undefined),
  });
}

/**
 * `flash_full_report_2026-09-23.xlsx` or `flash_annual_report_…`.
 *
 * The port's naming, as the Build's exports have it, rather than the source's,
 * which is its report title with the punctuation stripped. That rule names a
 * Full Report after whichever unit's sheet happened to be written LAST — the
 * title variable is overwritten per sheet, in the order the reads resolved —
 * and dates it by nothing but the range. Here the name is the report and the
 * Pacific day; what it was asked under is in its first row.
 */
export function misFlashReportFilename(overview: MisFlashOverview, instant: Date): string {
  return misExportFilename(["flash", OVERVIEWS[overview].file], instant);
}

/** `flash_monthly_iam_2026-09-23.xlsx` — a monthly view's own Export. */
export function misFlashMonthlyFilename(
  unit: Pick<FlashUnitColumn, "label">,
  instant: Date,
): string {
  return misExportFilename(["flash", "monthly", misFilenameWord(unit.label)], instant);
}
