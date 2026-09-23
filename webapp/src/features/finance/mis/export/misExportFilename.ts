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

// What an exported file is called.
//
// Ported from `ArrSummaryCustomersDialog.js:191-216`, which builds the same
// name out of a prefix, the row that was opened, the Period column and the
// date. It is worth porting rather than inventing: a folder of these sorts into
// something a reader can navigate, and the name is the only thing carrying the
// filters a figure was taken under once the file has left the browser.
//
// Two of its three rules are kept and the third is not.

import { pacificCivilDate } from "../util/misPacificTime";

/**
 * A word in a filename: a row label, a table name.
 *
 * Whitespace becomes an underscore, everything outside `[a-zA-Z0-9_]` goes,
 * and the result is lower case — the source's first clean-up rule, verbatim. A
 * hyphen does NOT survive here, and that is the difference from
 * `misFilenameRange` below.
 */
export const misFilenameWord = (text: string): string =>
  text.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();

/**
 * A date range in a filename: the Period column a figure was read from.
 *
 * The same rule EXCEPT that `-` is allowed through, which is the source's
 * second clean-up rule and the reason it has two. A TTM column reads
 * `"2025/09/03 - 2026/09/03"`, and it has to survive as `20250903_-_20260903`:
 * strip the hyphen with the slashes and the two dates run together into one
 * sixteen-digit number that names nothing.
 */
export const misFilenameRange = (text: string): string =>
  text.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();

/**
 * The parts, joined, dated, and given the extension.
 *
 * ---- the one rule not ported ----------------------------------------------
 *
 * The source stamps `new Date().toISOString().split('T')[0]` — a UTC date —
 * while every other date in MIS is Pacific (CONTEXT.md: "Not the viewer's
 * timezone and not UTC"). Between 5pm and midnight in California those two are
 * different days, so an export taken on a Pacific evening is filed under
 * tomorrow. It is the quiet kind of wrong: the file is correct, its name is
 * not, and the reader who sorts a folder by name is the one who finds out.
 *
 * `instant` is a parameter so a test can hold an evening still.
 */
export function misExportFilename(parts: readonly string[], instant: Date = new Date()): string {
  // Empty parts dropped, as the source's `if (rowLabel)` guards do — a Build
  // row can be MIS_ROW_LABELS.EMPTY, and an unguarded part doubles the
  // separator.
  return [...parts.filter(Boolean), misExportDate(instant)].join("_") + ".xlsx";
}

/**
 * The day an export was taken, `yyyy-MM-dd`, in Pacific Time.
 *
 * Shared by the filename and by the "Generated on" line of Flash's workbook, so
 * a file cannot be named for one day and say inside that it was made on
 * another — which is what the source's pair would do on a Pacific evening,
 * `toISOString` outside and `toLocaleDateString` in.
 */
export function misExportDate(instant: Date = new Date()): string {
  const { year, month, day } = pacificCivilDate(instant);
  return `${year}-${pad(month)}-${pad(day)}`;
}

const pad = (value: number): string => String(value).padStart(2, "0");
