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

// Lead import: reading the raw lead file, in the browser.
//
// The file never leaves the machine. Only the headings and a few sample values of each
// column go to the server, for the mapping suggestion. Cells are read with the same
// `clean` as My Submissions (rules/workbook.ts), so a date, a formula or a rich-text cell
// reads the same in both places, and the heading row is found the same way.

import Papa from "papaparse";
import type { SourceColumn } from "../leadImportTypes";
import { clean, findHeaderRow } from "../rules/workbook";
import { nameKey } from "../rules/schema";

/** My Submissions reads at most this many sheet rows, heading included, so a longer list
 *  would lose rows there. Refused here, with the reason, rather than cut. */
export const MAX_DATA_ROWS = 5000;
/** Vendor exports can be wide (survey answers, consent flags). The server takes as many. */
export const MAX_COLUMNS = 200;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SAMPLES = 5;
export const SAMPLE_CHARS = 80;
/** The longest heading the suggestion endpoint accepts; longer ones are cut to it. */
export const MAX_HEADING_CHARS = 300;

export class LeadFileError extends Error {}

/** One sheet as a grid of trimmed strings, `[row][column]`, both 0-based. */
export interface RawSheet {
  name: string;
  rows: string[][];
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}

/** Throw when a sheet is too long or too wide to be mapped. */
function checkSize(sheet: RawSheet): void {
  if (sheet.rows.length > MAX_DATA_ROWS) {
    throw new LeadFileError(
      `The sheet "${sheet.name}" has more than ${MAX_DATA_ROWS.toLocaleString()} rows. My ` +
        "Submissions reads at most that many per sheet, so split the file and map each part.",
    );
  }
  if (sheet.rows.some((row) => row.length > MAX_COLUMNS)) {
    throw new LeadFileError(
      `The sheet "${sheet.name}" has more than ${MAX_COLUMNS} columns. Delete the columns you ` +
        "don't need and try again.",
    );
  }
}

/** Drop trailing empty cells and trailing empty rows; fill holes with empty rows. */
function tidy(rows: (string[] | undefined)[]): string[][] {
  const out = Array.from(rows, (row) => {
    const cells = row ?? [];
    let end = cells.length;
    while (end > 0 && !cells[end - 1]) end--;
    return cells.slice(0, end);
  });
  while (out.length && out[out.length - 1].length === 0) out.pop();
  return out;
}

async function readXlsx(file: File): Promise<RawSheet[]> {
  // Loaded here rather than at module scope: exceljs is large and only an upload needs it.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new LeadFileError("That file could not be opened as a spreadsheet.");
  }
  const sheets: RawSheet[] = [];
  workbook.eachSheet((worksheet) => {
    // A hidden sheet is one someone put out of sight — an old export, a lookup table.
    // Offering it for import invites picking the wrong leads.
    if (worksheet.state && worksheet.state !== "visible") return;
    const rows: (string[] | undefined)[] = [];
    // row.values is the sparse 1-based array exceljs already holds (see readTable in
    // rules/workbook.ts for why getCell per column is not used).
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = (row.values as unknown[] | undefined) ?? [];
      const cells: string[] = [];
      for (let c = 1; c < values.length; c++) cells.push(clean(values[c]));
      rows[rowNumber - 1] = cells;
    });
    sheets.push({ name: worksheet.name, rows: tidy(rows) });
  });
  return sheets;
}

/** The CSV's text. UTF-8 when the bytes are valid UTF-8; otherwise Windows-1252, which is
 *  what Excel on Windows writes for "CSV" \u2014 read as UTF-8 it turns every accent into "\uFFFD"
 *  (Ing\u00E9nieur \u2192 Ing\uFFFDnieur), silently, on exactly the French lists this tool sees most. */
export function decodeCsv(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function readCsv(file: File): Promise<RawSheet[]> {
  const text = decodeCsv(await file.arrayBuffer()).replace(/^\uFEFF/, "");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  // An unclosed quote makes Papa Parse fold every following line into one cell, so the
  // leads after it would vanish into a Notes value. Refused rather than recovered.
  const quoting = parsed.errors.find((error) => error.type === "Quotes");
  if (quoting) {
    throw new LeadFileError(
      `The CSV has a quoted value that never closes${quoting.row !== undefined ? ` (row ${quoting.row + 1})` : ""}. ` +
        "Fix the quotes, or open the file in Excel or Google Sheets and save it as .xlsx.",
    );
  }
  const rows = parsed.data.map((row) => (Array.isArray(row) ? row.map((cell) => clean(cell)) : []));
  return [{ name: file.name.replace(/\.[^.]+$/, ""), rows: tidy(rows) }];
}

/** Throw a LeadFileError for a file that can't be read at all: the wrong type, or too big.
 *  Needs no reading, so the page runs it the moment a file is picked. */
export function checkLeadFile(file: File): void {
  const ext = extension(file.name);
  if (ext === ".xls") {
    throw new LeadFileError(
      "This is an old .xls file. Open it in Excel or Google Sheets, save it as .xlsx, and " + "upload it again.",
    );
  }
  if (ext !== ".xlsx" && ext !== ".xlsm" && ext !== ".csv") {
    throw new LeadFileError("Upload an .xlsx or .csv file. PDFs and scanned images can't be read.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new LeadFileError(`The file is over ${MAX_FILE_BYTES / (1024 * 1024)} MB.`);
  }
}

/** Every sheet of the file that has any value, in workbook order. */
export async function readLeadFile(file: File): Promise<RawSheet[]> {
  checkLeadFile(file);
  const ext = extension(file.name);
  const sheets = (ext === ".csv" ? await readCsv(file) : await readXlsx(file)).filter((sheet) =>
    sheet.rows.some((row) => row.length > 0),
  );
  if (!sheets.length) throw new LeadFileError("The file has no data.");
  sheets.forEach(checkSize);
  return sheets;
}

function filledRows(sheet: RawSheet): number {
  return sheet.rows.filter((row) => row.some(Boolean)).length;
}

/** The sheet to start with: the one named after the chosen lead type when there is one —
 *  a workbook with Booth, Session and Attendees tabs means the Booth tab for Booth leads,
 *  however many rows the others have — otherwise the one with the most rows that have a
 *  value. */
export function defaultSheet(sheets: RawSheet[], status?: string): number {
  if (status) {
    const named = sheets.findIndex((sheet) => nameKey(sheet.name) === nameKey(status));
    if (named >= 0) return named;
  }
  let best = 0;
  sheets.forEach((sheet, i) => {
    if (filledRows(sheet) > filledRows(sheets[best])) best = i;
  });
  return best;
}

/** The heading row (0-based): the row with the most text among the first ten, as in My
 *  Submissions. Row 1 when no row has two values. */
export function headerRowOf(rows: string[][]): number {
  return Math.max(0, findHeaderRow(rows));
}

/** "A", "B", …, "Z", "AA" for a 0-based column index. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** The columns under the heading row: each one with a heading or with any value. */
export function sourceColumns(rows: string[][], headerRow: number): SourceColumn[] {
  const heading = rows[headerRow] ?? [];
  const body = rows.slice(headerRow + 1);
  const width = Math.max(heading.length, ...body.map((row) => row.length), 0);
  const columns: SourceColumn[] = [];
  for (let index = 0; index < width; index++) {
    const samples: string[] = [];
    let filled = 0;
    for (const row of body) {
      const value = row[index] ?? "";
      if (!value) continue;
      filled++;
      const sample = value.slice(0, SAMPLE_CHARS);
      if (samples.length < SAMPLES && !samples.includes(sample)) samples.push(sample);
    }
    const text = heading[index] ?? "";
    if (text || filled) columns.push({ index, heading: text, samples, filled });
  }
  return columns;
}
