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

// @vitest-environment node
// (jsdom's File and Blob have no text() or arrayBuffer(); Node's do.)

// Applying a mapping: values copied unchanged, the full-name split, the person's choices,
// and a workbook that My Submissions reads back without skipping anything.

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { FieldDef } from "../eventsTypes";
import type { MappingEntry } from "../leadImportTypes";
import { parseWorkbook } from "../rules/workbook";
import type { EventsConfig } from "../rules/schema";
import { applyMapping, buildPayload, buildWorkbook, choose, namePair, outputFileName, splitFullName } from "./leadMapping";

function def(field_name: string, header_label = field_name, extra: Partial<FieldDef> = {}): FieldDef {
  return { field_name, header_label, data_type: "text", picklist: [], mandatory: false, ...extra };
}

const DEFS: FieldDef[] = [
  def("First Name"),
  def("Last Name", "Last Name", { mandatory: true }),
  def("Email", "Email Address"),
  def("Company"),
  def("score", "Add to Score (Hasina will fill this)", { computed: true }),
];

function entry(field_name: string, source_index: number | null, split: MappingEntry["split"] = null): MappingEntry {
  return {
    field_name,
    source_index,
    split,
    how: source_index === null ? "none" : "claude",
    confidence: null,
    reason: null,
  };
}

const PAIR = { first: "First Name", last: "Last Name" };

describe("splitFullName", () => {
  it.each([
    ["Ana Silva", "Ana", "Silva"],
    ["Ludwig van Beethoven", "Ludwig", "van Beethoven"],
    ["Juan Antonio de la Casa", "Juan Antonio", "de la Casa"],
    ["Liliana Graterol Ramirez", "Liliana Graterol", "Ramirez"],
    ["Silva, Ana", "Ana", "Silva"],
    ["Madonna", "", "Madonna"],
    ["  ana   SILVA  ", "ana", "SILVA"],
    ["De Souza", "De", "Souza"],
  ])("%s → %s / %s", (full, first, last) => {
    expect(splitFullName(full)).toEqual({ first, last });
  });
});

describe("applyMapping", () => {
  const rows = [
    ["Lead report"],
    ["Nombre", "Correo", "Empresa", "Badge"],
    ["Ana Silva", "ana@acme.io", "  ACME ", "B1"],
    [],
    ["", "", "", "B2"],
    ["Ludwig van Beethoven", "lvb@x.de", "00123", ""],
  ];

  it("copies mapped values unchanged into every column of the status, in order", () => {
    const out = applyMapping(rows, 1, DEFS, [
      entry("First Name", 0, "first"),
      entry("Last Name", 0, "last"),
      entry("Email", 1),
      entry("Company", 2),
    ]);
    expect(out.header).toEqual([
      "First Name",
      "Last Name",
      "Email Address",
      "Company",
      "Add to Score (Hasina will fill this)",
    ]);
    expect(out.rows).toEqual([
      ["Ana", "Silva", "ana@acme.io", "  ACME ", ""],
      ["Ludwig", "van Beethoven", "lvb@x.de", "00123", ""],
    ]);
    expect(out.skipped).toBe(1); // the row with only a badge id
  });

  it("leaves unmapped and computed columns empty, even when the mapping names a computed one", () => {
    const out = applyMapping(rows, 1, DEFS, [entry("Email", 1), entry("score", 3)]);
    expect(out.rows[0]).toEqual(["", "", "ana@acme.io", "", ""]);
  });
});

describe("choose", () => {
  const start = [
    entry("First Name", 0, "first"),
    entry("Last Name", 0, "last"),
    entry("Email", 1),
    entry("Company", null),
  ];

  it("a split pick sets both name columns", () => {
    const next = choose(
      [entry("First Name", null), entry("Last Name", null)],
      "Last Name",
      { source: 4, split: "last" },
      PAIR,
    );
    expect(next.map((e) => [e.source_index, e.split, e.how])).toEqual([
      [4, "first", "you"],
      [4, "last", "you"],
    ]);
  });

  it("a plain pick on one half of a split clears the other half", () => {
    const next = choose(start, "First Name", { source: 2, split: null }, PAIR);
    expect(next.slice(0, 2).map((e) => [e.source_index, e.split, e.how])).toEqual([
      [2, null, "you"],
      [null, null, "none"],
    ]);
  });

  it("unmapping leaves the other columns alone", () => {
    const next = choose(start, "Email", null, PAIR);
    expect(next[2]).toMatchObject({ source_index: null, how: "none" });
    expect(next[0]).toBe(start[0]);
  });

  it("keeps a pick for a column the suggestion didn't include", () => {
    const next = choose([entry("Email", 1)], "Company", { source: 2, split: null }, PAIR);
    expect(next.find((e) => e.field_name === "Company")).toMatchObject({ source_index: 2, how: "you" });
    const split = choose([entry("Email", 1)], "First Name", { source: 0, split: "first" }, PAIR);
    expect(split.filter((e) => e.split).map((e) => [e.field_name, e.split])).toEqual([
      ["First Name", "first"],
      ["Last Name", "last"],
    ]);
  });

  it("finds the name pair by key, not by wording", () => {
    expect(namePair([def(" first  name "), def("LAST_NAME")])).toEqual({ first: " first  name ", last: "LAST_NAME" });
    expect(namePair([def("First Name")])).toBeNull();
  });
});

describe("the output workbook", () => {
  it("is named after the source and the status", () => {
    expect(outputFileName("API Addicts: leads.xlsx", "Booth")).toBe("API Addicts_ leads - Booth.xlsx");
  });

  it("writes text, one sheet named the status, and My Submissions reads every row back", async () => {
    const output = applyMapping(
      [
        ["Nombre", "Correo", "Empresa"],
        ["Ana Silva", "ana@acme.io", "00123"],
        ["Ludwig van Beethoven", "lvb@x.de", "ACME"],
      ],
      0,
      DEFS,
      [entry("First Name", 0, "first"), entry("Last Name", 0, "last"), entry("Email", 1), entry("Company", 2)],
    );
    const blob = await buildWorkbook("Booth", output);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await blob.arrayBuffer());
    expect(workbook.worksheets.map((w) => w.name)).toEqual(["Booth"]);
    expect(workbook.worksheets[0].getCell("D2").value).toBe("00123");

    const config: EventsConfig = {
      statuses: [{ name: "Booth", score: 5, enabled: true }],
      fields: { Booth: DEFS },
    };
    const parsed = await parseWorkbook(new File([blob], "x.xlsx"), config);
    expect(parsed.skipped).toEqual([]);
    expect(parsed.totalRows).toBe(2);
    expect(parsed.tabs[0].undefinedHeaders).toEqual([]);
    expect(parsed.tabs[0].missingHeaders).toEqual([]);
  });
});

describe("buildPayload", () => {
  it("stores rows under the same keys as uploading the workbook would", async () => {
    const output = applyMapping(
      [
        ["Nombre", "Correo", "Empresa"],
        ["Ana Silva", "ana@acme.io", "00123"],
      ],
      0,
      DEFS,
      [entry("First Name", 0, "first"), entry("Last Name", 0, "last"), entry("Email", 1), entry("Company", 2)],
    );
    const payload = buildPayload(DEFS, output, "Booth");
    expect(payload.tabs.Booth).toEqual([
      { first_name: "Ana", last_name: "Silva", email: "ana@acme.io", company: "00123" },
    ]);

    const config: EventsConfig = {
      statuses: [{ name: "Booth", score: 5, enabled: true }],
      fields: { Booth: DEFS },
    };
    const parsed = await parseWorkbook(new File([await buildWorkbook("Booth", output)], "x.xlsx"), config);
    expect(payload.tabs.Booth).toEqual(parsed.tabs[0].rows);
  });
});
