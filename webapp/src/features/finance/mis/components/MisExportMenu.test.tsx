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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { bytesOf, captureDownloads } from "@/test/downloads";
import MisExportMenu from "./MisExportMenu";
import { MIS_NUMBER_FORMATS, type MisWorkbookSpec } from "../export/misWorkbook";

// The one Export menu every table and dialog on the ARR Dashboard renders.
//
// Excel is covered where the tables are — the page and dialog tests load the
// workbook back through ExcelJS. This file is about the menu itself: the CSV
// item, and that a failure in any of the three items is said in the same note.

const SPEC: MisWorkbookSpec = {
  sheets: [
    {
      name: "Subscription",
      columns: [{ width: 20 }, { width: 14 }],
      rows: [
        { cells: [{ value: "All amounts in USD" }] },
        { cells: [] },
        { bold: true, cells: [{ value: "Summary" }, { value: "2024" }] },
        { cells: [{ value: "Opening ARR" }, { value: 1500, numFmt: MIS_NUMBER_FORMATS.CURRENCY }] },
      ],
    },
  ],
};

const FILENAME = "arr_dashboard_subscription_2026-10-08.xlsx";

async function choose(item: RegExp) {
  await userEvent.click(screen.getByRole("button", { name: /^export$/i }));
  await userEvent.click(await screen.findByRole("menuitem", { name: item }));
}

describe("the CSV item", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the workbook's cells as CSV, under the .xlsx name with its extension swapped", async () => {
    const { blobs, filenames } = captureDownloads();
    render(<MisExportMenu workbook={() => SPEC} filename={() => FILENAME} />);

    await choose(/^csv/i);
    await waitFor(() => expect(blobs).toHaveLength(1));

    expect(blobs[0].type).toBe("text/csv;charset=utf-8");
    expect(filenames[0]).toBe("arr_dashboard_subscription_2026-10-08.csv");
    const text = new TextDecoder().decode(await bytesOf(blobs[0]));
    // The units caption is dropped, and the figure is the raw number.
    expect(text).toBe(["Summary,2024", "Opening ARR,1500"].join("\r\n"));
  });
});

describe("when a file cannot be written", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const broken = () => {
    throw new Error("the figures are not here yet");
  };

  it.each([
    ["CSV", /^csv/i],
    ["Excel", /^excel/i],
    ["PDF", /^pdf/i],
  ])("says so for %s, in the same words, and downloads nothing", async (_item, name) => {
    const { blobs } = captureDownloads();
    render(<MisExportMenu workbook={broken} filename={() => FILENAME} />);

    await choose(name);

    expect(await screen.findByRole("status")).toHaveTextContent("Couldn't write the file.");
    expect(blobs).toHaveLength(0);
    // The button comes back, so the reader can try again.
    expect(screen.getByRole("button", { name: /^export$/i })).toBeEnabled();
  });

  it("clears the note once an export succeeds", async () => {
    const { blobs } = captureDownloads();
    let workbook: () => MisWorkbookSpec = broken;
    render(<MisExportMenu workbook={() => workbook()} filename={() => FILENAME} />);

    await choose(/^csv/i);
    expect(await screen.findByRole("status")).toBeInTheDocument();

    workbook = () => SPEC;
    await choose(/^csv/i);
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
