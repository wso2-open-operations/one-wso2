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

import { saveBlob } from "@utils/saveFile";
import { MIS_VALUE_TYPES, amountUnitCaption, formatMisValue } from "../util/misMoney";
import type { MisScale } from "../util/misViewVocabulary";
import { rowsAfterCaption } from "./misCsv";
import { MIS_NUMBER_FORMATS, type MisWorkbookCell, type MisWorkbookSpec } from "./misWorkbook";

/**
 * What the PDF says above the table: the table as it was seen, not the raw
 * workbook. The lines are the units caption, the Period, the applied filters
 * and the Pacific date — whatever the caller can name.
 */
export interface MisPdfHeading {
  title: string;
  lines: readonly string[];
  scale: MisScale;
  /** Identity columns repeated on every horizontal page. The row label is one. */
  repeatColumns?: number;
}

export interface MisPdfTable {
  head: string[][];
  body: string[][];
}

/**
 * The workbook as the table a reader sees.
 *
 * Currency is scaled, the way the screen scales it; a percentage cell holds
 * Excel's fraction and is shown as a percent; a count is never scaled. The
 * caption and blank row the sheet opens with are dropped, same as the CSV.
 */
export function misPdfTable(spec: MisWorkbookSpec, scale: MisScale): MisPdfTable {
  const kept = rowsAfterCaption(spec.sheets[0]?.rows ?? []);
  const rows = kept.map((row) => seenRow(row, scale));
  // A Period group header leaves the row-label cell empty; the sub-header
  // under it names the columns. A flat table has one header row.
  const grouped = kept.length > 1 && (kept[0]?.cells[0]?.value == null || kept[0]?.cells[0]?.value === "");
  const headCount = grouped ? 2 : Math.min(1, rows.length);
  return { head: rows.slice(0, headCount), body: rows.slice(headCount) };
}

const seenRow = (row: { cells: readonly MisWorkbookCell[] }, scale: MisScale): string[] =>
  row.cells.map((cell) => seenCell(cell, scale));

const seenCell = (cell: MisWorkbookCell, scale: MisScale): string => {
  const { value } = cell;
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (cell.numFmt === MIS_NUMBER_FORMATS.PERCENTAGE) {
    return `${(value * 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  if (cell.numFmt === MIS_NUMBER_FORMATS.COUNT) {
    return formatMisValue(value, MIS_VALUE_TYPES.COUNT);
  }
  if (cell.numFmt === MIS_NUMBER_FORMATS.CURRENCY) {
    return formatMisValue(value, MIS_VALUE_TYPES.CURRENCY, { scale });
  }
  return String(value);
};

/**
 * The table, as a landscape A4 file.
 *
 * jsPDF is loaded here and nowhere else in Finance MIS, and only when a reader
 * asks for a PDF — the same reason ExcelJS is loaded inside `writeMisWorkbook`.
 * A table wider than the page breaks across pages, and the identity columns
 * are repeated on each one so a row can still be named.
 */
export async function saveMisPdf(spec: MisWorkbookSpec, heading: MisPdfHeading, filename: string): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const table = misPdfTable(spec, heading.scale);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const repeat = Math.max(heading.repeatColumns ?? 1, 1);

  doc.setFontSize(14);
  doc.text(heading.title, 40, 36);
  doc.setFontSize(9);
  doc.setTextColor(80);
  const lines = [amountUnitCaption(heading.scale), ...heading.lines];
  lines.forEach((line, index) => doc.text(line, 40, 54 + index * 12));

  autoTable(doc, {
    head: table.head,
    body: table.body,
    startY: 54 + lines.length * 12 + 8,
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: "bold" },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: Array.from({ length: repeat }, (_, index) => index),
  });

  // The footers go on once the table has finished, when the page count is
  // final. Drawn from inside the table's own page hook, the count is still
  // running, and every page but the last says "of" too few.
  const pages = doc.getNumberOfPages();
  // Right-aligned to the same 40pt margin the heading keeps on the left.
  const footerX = doc.internal.pageSize.getWidth() - 40;
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setTextColor(120);
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.text(`Page ${page} of ${pages}`, footerX, footerY, { align: "right" });
  }

  saveBlob(new Blob([doc.output("arraybuffer")], { type: "application/pdf" }), filename);
}
