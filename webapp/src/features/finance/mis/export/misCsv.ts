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

import type { MisCellValue, MisWorkbookSpec } from "./misWorkbook";

/**
 * The workbook as CSV.
 *
 * The same cells Excel writes, as text a spreadsheet can sum: a number is the
 * number, never the screen's formatted string, and the units caption the sheet
 * opens with is dropped — a caption row breaks a CSV. The blank row under that
 * caption goes with it. Both are the rows that precede the first row carrying
 * more than one value, which is the header.
 */
export function misWorkbookCsv(spec: MisWorkbookSpec): string {
  const rows = rowsAfterCaption(spec.sheets[0]?.rows ?? []);
  return rows.map((row) => row.cells.map((cell) => csvField(cell.value)).join(",")).join("\r\n");
}

/**
 * The sheet opens with the units caption and a blank row. Both go: a caption
 * breaks a CSV, and the blank row under it is only there to separate the
 * caption from the header in Excel.
 */
export function rowsAfterCaption<T extends { cells: readonly { value: MisCellValue }[] }>(rows: readonly T[]): T[] {
  const filledCount = (row: T) => row.cells.filter((cell) => cell.value != null && cell.value !== "").length;
  if (rows.length >= 2 && filledCount(rows[0]) <= 1 && filledCount(rows[1]) === 0) return rows.slice(2);
  return [...rows];
}

/** The first characters a spreadsheet takes as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * One field. RFC 4180: quote it when it contains a comma, a quote or a line
 * break.
 *
 * A TEXT field that opens with `=`, `+`, `-`, `@`, a tab or a carriage return
 * is prefixed with a single quote first, so a spreadsheet opening the file
 * reads a customer called `=HYPERLINK(...)` as the words and not as a formula.
 * A number is written as the number, so a negative keeps its minus sign.
 */
const csvField = (value: MisCellValue): string => {
  if (value == null) return "";
  if (typeof value === "number") return String(value);
  const text = FORMULA_LEAD.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};
