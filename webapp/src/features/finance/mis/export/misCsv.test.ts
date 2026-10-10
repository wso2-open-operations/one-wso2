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
import { MIS_NUMBER_FORMATS, type MisWorkbookSpec } from "./misWorkbook";
import { misWorkbookCsv } from "./misCsv";
import { misPdfTable } from "./misPdf";
import { MIS_SCALES } from "../util/misViewVocabulary";

const spec: MisWorkbookSpec = {
  sheets: [
    {
      name: "Subscription",
      columns: [{ width: 20 }, { width: 14 }],
      rows: [
        { cells: [{ value: "All amounts in USD" }] },
        { cells: [] },
        { bold: true, cells: [{ value: null }, { value: "2024" }] },
        { bold: true, cells: [{ value: "Summary" }, { value: "ARR" }] },
        { cells: [{ value: "Opening ARR" }, { value: 1500, numFmt: MIS_NUMBER_FORMATS.CURRENCY }] },
        { cells: [{ value: "Acme, Inc." }, { value: 0.9825, numFmt: MIS_NUMBER_FORMATS.PERCENTAGE }] },
      ],
    },
  ],
};

describe("the ARR Dashboard export", () => {
  it("writes CSV as the raw numbers, without the units caption", () => {
    expect(misWorkbookCsv(spec)).toBe(
      [",2024", "Summary,ARR", "Opening ARR,1500", '"Acme, Inc.",0.9825'].join("\r\n"),
    );
  });

  it("keeps a text cell that opens like a formula as text, and a negative number as a number", () => {
    const hostile: MisWorkbookSpec = {
      sheets: [
        {
          name: "Customers",
          columns: [{ width: 20 }, { width: 14 }],
          rows: [
            { bold: true, cells: [{ value: "Account Name" }, { value: "ARR" }] },
            { cells: [{ value: "=HYPERLINK(\"https://example.test\")" }, { value: -1500, numFmt: MIS_NUMBER_FORMATS.CURRENCY }] },
            { cells: [{ value: "-Acme" }, { value: 20, numFmt: MIS_NUMBER_FORMATS.CURRENCY }] },
            { cells: [{ value: "+Plus Co" }, { value: "@mention" }] },
            { cells: [{ value: "\tTabbed" }, { value: "Plain" }] },
          ],
        },
      ],
    };
    expect(misWorkbookCsv(hostile)).toBe(
      [
        "Account Name,ARR",
        // The quote goes on BEFORE the RFC 4180 quoting, and the number beside
        // it keeps its sign.
        '"\'=HYPERLINK(""https://example.test"")",-1500',
        "'-Acme,20",
        "'+Plus Co,'@mention",
        "'\tTabbed,Plain",
      ].join("\r\n"),
    );
  });

  it("writes the PDF as the table was seen, with Scale applied to currency only", () => {
    const table = misPdfTable(spec, MIS_SCALES.THOUSANDS);
    expect(table.head).toEqual([
      ["", "2024"],
      ["Summary", "ARR"],
    ]);
    expect(table.body).toEqual([
      ["Opening ARR", "1.50"],
      ["Acme, Inc.", "98.25%"],
    ]);
  });
});
