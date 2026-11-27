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
import { FRAMEWORK_CONTROL_CSV_TEMPLATE, MAX_CSV_CONTROLS, parseCsv, parseFrameworkControlsCsv } from "./controlCsv";

describe("parseCsv", () => {
  it("keeps commas, doubled quotes and newlines inside quoted fields", () => {
    expect(parseCsv('a,"b, c","say ""hi""","l1\nl2"\n')).toEqual([["a", "b, c", 'say "hi"', "l1\nl2"]]);
  });

  it("handles CRLF, a BOM and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("keeps empty cells in place", () => {
    expect(parseCsv("a,,c\n,,\nx,y,")).toEqual([["a", "", "c"], ["x", "y", ""]]);
  });
});

describe("parseFrameworkControlsCsv", () => {
  const header = "control_number,description,evidence_requirement,requirement_type,control_type,scope";

  it("parses rows and applies defaults for omitted optional columns", () => {
    const res = parseFrameworkControlsCsv("Control Number,Description\nC-1,\"Asset, ownership\"\n");
    expect(res).toEqual({
      ok: true,
      rows: [{
        controlNumber: "C-1", description: "Asset, ownership", evidenceRequirement: null,
        requirementType: "DESIGN", controlType: "NON_CONFIG", scope: "COMMON",
      }],
    });
  });

  it("upper-cases enum values", () => {
    const res = parseFrameworkControlsCsv(`${header}\nC-1,d,e,oe,config,product_specific`);
    expect(res.ok && res.rows[0]).toMatchObject({ requirementType: "OE", controlType: "CONFIG", scope: "PRODUCT_SPECIFIC" });
  });

  it("rejects a file with no data rows or a missing required column", () => {
    expect(parseFrameworkControlsCsv(header).ok).toBe(false);
    const res = parseFrameworkControlsCsv("control_number\nC-1");
    expect(res).toEqual({ ok: false, errors: ["Missing required column(s): description"] });
  });

  it("fails the whole file on a bad value, naming the row", () => {
    const res = parseFrameworkControlsCsv(`${header}\nC-1,d,e,DESIGN,CONFIG,COMMON\nC-2,d,e,WRONG,CONFIG,COMMON`);
    expect(res).toEqual({ ok: false, errors: ['Row 3: requirement_type must be DESIGN or OE, got "WRONG"'] });
  });

  it("flags empty cells and repeated control numbers (case-insensitive)", () => {
    const res = parseFrameworkControlsCsv(`${header}\nC-1,d,,,,\n,d,,,,\nC-2,,,,,\nc-1,d,,,,`);
    expect(res).toEqual({
      ok: false,
      errors: ["Row 3: control_number is empty", "Row 4: description is empty", 'Row 5: control_number "c-1" repeats row 2'],
    });
  });

  it("caps the number of reported errors", () => {
    const rows = Array.from({ length: 15 }, (_, i) => `C-${i},d,,BAD,,`).join("\n");
    const res = parseFrameworkControlsCsv(`${header}\n${rows}`);
    expect(!res.ok && res.errors).toHaveLength(11);
    expect(!res.ok && res.errors[10]).toBe("…and 5 more");
  });

  it("sends null, not an empty string, for blank evidence, and keeps real evidence", () => {
    const res = parseFrameworkControlsCsv(`${header}\nC-1,d,,,,\nC-2,d,  ,,,\nC-3,d,Screenshot,,,`);
    expect(res.ok && res.rows.map((r) => r.evidenceRequirement)).toEqual([null, null, "Screenshot"]);
  });

  it("refuses more than 200 rows before checking them", () => {
    const rows = Array.from({ length: MAX_CSV_CONTROLS + 1 }, (_, i) => `C-${i},d`).join("\n");
    const res = parseFrameworkControlsCsv(`control_number,description\n${rows}`);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.errors[0]).toContain("at most 200");
    const atCap = Array.from({ length: MAX_CSV_CONTROLS }, (_, i) => `C-${i},d`).join("\n");
    expect(parseFrameworkControlsCsv(`control_number,description\n${atCap}`).ok).toBe(true);
  });

  it("limits control_number to 60 characters, counting characters not bytes", () => {
    const fits = "é".repeat(60);
    expect(parseFrameworkControlsCsv(`control_number,description\n${fits},d`).ok).toBe(true);
    const res = parseFrameworkControlsCsv(`control_number,description\n${"a".repeat(61)},d`);
    expect(res).toEqual({ ok: false, errors: ["Row 2: control_number is longer than 60 characters"] });
  });

  it("accepts its own download template", () => {
    expect(parseFrameworkControlsCsv(FRAMEWORK_CONTROL_CSV_TEMPLATE).ok).toBe(true);
  });
});
