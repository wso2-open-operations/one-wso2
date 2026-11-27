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

import type { ControlScope, ControlType, RequirementType } from "@features/security/grc/modules/audit/types/audit";

/**
 * Splits CSV text into rows of cells. Handles quoted fields containing commas,
 * doubled quotes ("") and newlines, CRLF line endings and a leading BOM.
 * Fully blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      endCell();
    } else if (ch === "\n") {
      endRow();
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

/** Normalises a header cell: "Control Number" becomes "control_number". */
export const normaliseHeader = (h: string): string => h.trim().toLowerCase().replace(/\s+/g, "_");

export interface FrameworkControlCsvRow {
  controlNumber: string;
  description: string;
  /** null when the cell is blank, matching the single-add form (stored as NULL, not ""). */
  evidenceRequirement: string | null;
  requirementType: RequirementType;
  controlType: ControlType;
  scope: ControlScope;
}

export type FrameworkControlCsvResult =
  | { ok: true; rows: FrameworkControlCsvRow[] }
  | { ok: false; errors: string[] };

const REQUIRED = ["control_number", "description"];
const MAX_ERRORS = 10;
/** Mirror the server: one request holds at most 200 controls; control_number is VARCHAR(60). */
export const MAX_CSV_CONTROLS = 200;
const MAX_CONTROL_NUMBER_LENGTH = 60;

export const FRAMEWORK_CONTROL_CSV_TEMPLATE =
  "control_number,description,evidence_requirement,requirement_type,control_type,scope\n" +
  '2026-XX-001,"Example control description, with a comma",Screenshot of the setting,DESIGN,NON_CONFIG,COMMON\n';

/**
 * Parses a framework-catalog CSV. Required columns: control_number, description.
 * Optional: evidence_requirement, requirement_type (DESIGN|OE, default DESIGN),
 * control_type (CONFIG|NON_CONFIG, default NON_CONFIG), scope (COMMON|PRODUCT_SPECIFIC,
 * default COMMON). Never partial: any bad row fails the whole file, matching the
 * server, which rejects the whole request.
 */
export function parseFrameworkControlsCsv(text: string): FrameworkControlCsvResult {
  const table = parseCsv(text);
  if (table.length < 2) return { ok: false, errors: ["The file needs a header row and at least one data row."] };

  const headers = table[0].map(normaliseHeader);
  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length > 0) return { ok: false, errors: [`Missing required column(s): ${missing.join(", ")}`] };

  if (table.length - 1 > MAX_CSV_CONTROLS) {
    return {
      ok: false,
      errors: [`The file has ${table.length - 1} rows; at most ${MAX_CSV_CONTROLS} controls can be uploaded at once. Split it into smaller files.`],
    };
  }

  const col = (name: string) => headers.indexOf(name);
  const errors: string[] = [];
  const rows: FrameworkControlCsvRow[] = [];
  const seen = new Map<string, number>();

  table.slice(1).forEach((cells, i) => {
    const line = i + 2; // 1-based, counting the header
    const get = (name: string) => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
    const controlNumber = get("control_number");
    const description = get("description");
    if (!controlNumber) return void errors.push(`Row ${line}: control_number is empty`);
    if ([...controlNumber].length > MAX_CONTROL_NUMBER_LENGTH) return void errors.push(`Row ${line}: control_number is longer than ${MAX_CONTROL_NUMBER_LENGTH} characters`);
    if (!description) return void errors.push(`Row ${line}: description is empty`);

    const req = (get("requirement_type") || "DESIGN").toUpperCase();
    const ctl = (get("control_type") || "NON_CONFIG").toUpperCase();
    const scope = (get("scope") || "COMMON").toUpperCase();
    if (req !== "DESIGN" && req !== "OE") return void errors.push(`Row ${line}: requirement_type must be DESIGN or OE, got "${req}"`);
    if (ctl !== "CONFIG" && ctl !== "NON_CONFIG") return void errors.push(`Row ${line}: control_type must be CONFIG or NON_CONFIG, got "${ctl}"`);
    if (scope !== "COMMON" && scope !== "PRODUCT_SPECIFIC") return void errors.push(`Row ${line}: scope must be COMMON or PRODUCT_SPECIFIC, got "${scope}"`);

    const key = controlNumber.toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) return void errors.push(`Row ${line}: control_number "${controlNumber}" repeats row ${first}`);
    seen.set(key, line);

    rows.push({
      controlNumber,
      description,
      evidenceRequirement: get("evidence_requirement") || null,
      requirementType: req,
      controlType: ctl,
      scope,
    });
  });

  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_ERRORS);
    if (errors.length > MAX_ERRORS) shown.push(`…and ${errors.length - MAX_ERRORS} more`);
    return { ok: false, errors: shown };
  }
  return { ok: true, rows };
}
