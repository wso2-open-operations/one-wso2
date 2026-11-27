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

// Lead import: applying a column mapping and writing the output workbook.
//
// Values are copied exactly as the cell reader gives them. The one transform is the
// full-name split, which only divides a value in two. Everything else (casing, countries,
// duplicates, missing last names) is left for the RMM and for My Submissions, which
// validates the uploaded workbook.
//
// The output is the shape My Submissions accepts: one sheet named exactly the member
// status, and row 1 holding the heading of every column of that status, in order. So every
// row imports there and no heading is reported as undeclared.

import type { FieldDef } from "../eventsTypes";
import type { MappingEntry, SourceColumn, Split } from "../leadImportTypes";
import type { Payload } from "../rules/model";
import { columnLetter } from "./leadFile";
import { keyOf, slug } from "../rules/schema";

/** The first-name and last-name columns of a status, when it has both. Only they can
 *  take a full-name split. Keyed as rules/schema.ts SPECIAL keys them. */
export function namePair(defs: FieldDef[]): { first: string; last: string } | null {
  const bySlug = new Map(defs.filter((d) => !d.computed).map((d) => [slug(d.field_name), d.field_name]));
  const first = bySlug.get("first_name");
  const last = bySlug.get("last_name");
  return first && last ? { first, last } : null;
}

// A surname particle is part of the family name ("van Beethoven", "de la Cruz").
const PARTICLES = new Set([
  "van",
  "von",
  "de",
  "del",
  "della",
  "der",
  "den",
  "da",
  "di",
  "du",
  "la",
  "le",
  "bin",
  "binti",
  "ibn",
  "al",
  "ter",
  "ten",
  "dos",
  "das",
  "st",
  "st.",
  "mac",
  "mc",
  "abu",
]);

/** Divide a full name. The words are never changed, only divided:
 *  - "Last, First" when there is a comma;
 *  - otherwise the last word, with the particles right before it, is the last name, and
 *    the first word always stays in the first name;
 *  - one word is a last name (Salesforce requires one). */
export function splitFullName(value: string): { first: string; last: string } {
  const text = value.trim();
  const comma = text.indexOf(",");
  if (comma >= 0) {
    const last = text.slice(0, comma).trim();
    const first = text.slice(comma + 1).trim();
    if (last && first) return { first, last };
  }
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { first: "", last: words[0] ?? "" };
  let cut = words.length - 1;
  while (cut > 1 && PARTICLES.has(words[cut - 1].toLowerCase())) cut--;
  return { first: words.slice(0, cut).join(" "), last: words.slice(cut).join(" ") };
}

function valueOf(row: string[], entry: MappingEntry | undefined): string {
  if (!entry || entry.source_index === null) return "";
  const value = row[entry.source_index] ?? "";
  if (!entry.split || !value) return value;
  return splitFullName(value)[entry.split];
}

export interface Output {
  /** The heading of every column of the status, in order. */
  header: string[];
  rows: string[][];
  /** Source rows with values, but none in a mapped column: left out. */
  skipped: number;
}

/** Copy the mapped values of every row under the heading row into the status's columns. A
 *  computed column (MOP fills it) and an unmapped one stay empty. A fully empty source row
 *  is ignored; a row with values only in unmapped columns is counted as skipped. */
export function applyMapping(rows: string[][], headerRow: number, defs: FieldDef[], mapping: MappingEntry[]): Output {
  const byField = new Map(mapping.map((entry) => [entry.field_name, entry]));
  const entries = defs.map((def) => (def.computed ? undefined : byField.get(def.field_name)));
  const out: Output = { header: defs.map((def) => def.header_label), rows: [], skipped: 0 };
  for (const row of rows.slice(headerRow + 1)) {
    if (!row.some(Boolean)) continue;
    const cells = entries.map((entry) => valueOf(row, entry));
    if (cells.some(Boolean)) out.rows.push(cells);
    else out.skipped++;
  }
  return out;
}

/** The mapping after the person picks `choice` for the column `field`. A split pick sets
 *  both name columns to the two halves of that source; a plain pick on one half of a split
 *  clears the other half, which no longer has a whole name to come from. Picking any source
 *  also clears that source from every other target, so each source column maps to at most
 *  one template column. */
export function choose(
  mapping: MappingEntry[],
  field: string,
  choice: { source: number; split: Split | null } | null,
  pair: { first: string; last: string } | null,
): MappingEntry[] {
  const mine = (field_name: string, source: number | null, split: Split | null): MappingEntry => ({
    field_name,
    source_index: source,
    split,
    how: source === null ? "none" : "you",
    confidence: null,
    reason: null,
  });
  const partner = pair && (field === pair.first ? pair.last : field === pair.last ? pair.first : null);
  // The settings can gain a column after the suggestion came back; give it an entry so
  // the pick is not lost.
  const withEntry = (list: MappingEntry[], name: string) =>
    list.some((entry) => entry.field_name === name) ? list : [...list, mine(name, null, null)];
  const current = mapping.find((entry) => entry.field_name === field);

  let result: MappingEntry[];

  if (choice?.split && pair && partner) {
    result = withEntry(withEntry(mapping, pair.first), pair.last).map((entry) =>
      entry.field_name === pair.first
        ? mine(pair.first, choice.source, "first")
        : entry.field_name === pair.last
          ? mine(pair.last, choice.source, "last")
          : entry,
    );
  } else {
    result = withEntry(mapping, field).map((entry) => {
      if (entry.field_name === field) return mine(field, choice?.source ?? null, null);
      if (current?.split && entry.field_name === partner && entry.split) {
        return mine(entry.field_name, null, null);
      }
      return entry;
    });
  }

  // One source column → one template column. Clear any entry that now shares the
  // chosen source_index with a field that was just assigned it.
  if (choice !== null) {
    const justAssigned =
      choice.split && pair && partner ? new Set([pair.first, pair.last]) : new Set([field]);
    return result.map((entry) =>
      !justAssigned.has(entry.field_name) && entry.source_index === choice.source
        ? mine(entry.field_name, null, null)
        : entry,
    );
  }

  return result;
}

/** Why a template column wants a second look: a required column with no source, or a
 *  source Claude was unsure of. Null when it is fine as it is. */
export type Attention = "required_unmapped" | "low_confidence" | null;

export function attentionOf(def: FieldDef, entry: MappingEntry | undefined): Attention {
  if (def.computed) return null;
  if (!entry || entry.source_index === null) return def.mandatory ? "required_unmapped" : null;
  return entry.how === "claude" && entry.confidence === "low" ? "low_confidence" : null;
}

/** How a sheet row reads in the heading-row picker: its first few values, or "(empty)". */
export function rowLabel(row: string[] | undefined, values = 4): string {
  const filled = (row ?? []).filter(Boolean);
  if (!filled.length) return "(empty)";
  const shown = filled.slice(0, values).join(" · ");
  return filled.length > values ? `${shown} …` : shown;
}

/** The mapping select's value for an entry: "" (not mapped), "3", or "3:first" / "3:last". */
export function encodeChoice(entry: MappingEntry | undefined): string {
  if (!entry || entry.source_index === null) return "";
  return entry.split ? `${entry.source_index}:${entry.split}` : String(entry.source_index);
}

/** The choice a select value stands for; null for "not mapped". */
export function decodeChoice(value: string): { source: number; split: Split | null } | null {
  if (!value) return null;
  const [source, split] = value.split(":");
  return { source: Number(source), split: (split as Split | undefined) ?? null };
}

/** "C · Badge", or "C · (no heading)". */
export function sourceLabel(source: SourceColumn): string {
  return `${columnLetter(source.index)} · ${source.heading || "(no heading)"}`;
}

/** Convert the applyMapping() result into the submission payload. Each value is stored
 *  under `keyOf(def)` (the slugged name, e.g. "first_name") — the key My Submissions and
 *  the workbook upload use. Computed columns are left out; MOP derives them. */
export function buildPayload(defs: FieldDef[], output: Output, status: string): Payload {
  return {
    tabs: {
      [status]: output.rows.map((row) =>
        Object.fromEntries(
          defs.flatMap((def, i) => (def.computed ? [] : [[keyOf(def), row[i] ?? ""]])),
        ),
      ),
    },
  };
}

/** "<source file name> - <Status>.xlsx", without characters a file name can't carry. */
export function outputFileName(sourceName: string, status: string): string {
  const stem = sourceName.replace(/\.[^.]+$/, "");
  return `${stem} - ${status}.xlsx`.replace(/[\\/:*?"<>|]+/g, "_");
}

/** The output workbook: one sheet named the member status, the headings in row 1, then the
 *  rows. Every value is written as text, so the writer changes nothing either ("00123"
 *  stays "00123"). */
export async function buildWorkbook(status: string, output: Output): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(status);
  sheet.addRow(output.header).font = { bold: true };
  for (const cells of output.rows) sheet.addRow(cells);
  output.header.forEach((heading, i) => {
    const column = sheet.getColumn(i + 1);
    column.numFmt = "@";
    column.width = Math.min(40, Math.max(12, heading.trim().length + 2));
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
