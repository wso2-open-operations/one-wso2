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

// The upload offers only the lead types in use and refuses a wrong file on pick; the
// mapping screen shows how each template column got its source, what was left out and
// the rows as they will download; a person's pick replaces the suggestion and can be
// reset; creating the submission moves on to step 3, and the steps go back and forth.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { FieldDef, MemberStatus } from "../eventsTypes";
import type { SuggestRequest, SuggestResponse } from "../leadImportTypes";

const suggest = vi.fn<(request: SuggestRequest) => Promise<SuggestResponse>>();
vi.mock("../../api/useLeadImport", () => ({
  useSuggestLeadMapping: () => ({ mutateAsync: suggest }),
  leadImportError: (e: Error) => e.message,
}));

const statuses: MemberStatus[] = [
  { name: "Booth", score: 5, enabled: true },
  { name: "Retired", score: 0, enabled: false },
];
function def(field_name: string, header_label = field_name, extra: Partial<FieldDef> = {}): FieldDef {
  return { field_name, header_label, data_type: "text", picklist: [], mandatory: false, ...extra };
}
const fields: Record<string, FieldDef[]> = {
  Booth: [
    def("First Name"),
    def("Last Name", "Last Name", { mandatory: true }),
    def("Email", "Email Address"),
    def("Company", "Company", { mandatory: true }),
    def("score", "Add to Score (Hasina will fill this)", { computed: true }),
  ],
};
const createSubmission = vi.fn();
const saveSubmission = vi.fn();
vi.mock("../../api/useEvents", () => ({
  useMemberStatuses: () => ({ data: statuses, isError: false }),
  useFieldDefs: () => ({ data: fields, isError: false }),
  useEventNames: () => ({ data: [] }),
  useCampaignCheck: () => ({ data: undefined, isFetching: false }),
  useCreateSubmission: () => ({ mutateAsync: createSubmission }),
  useSaveSubmission: () => ({ mutateAsync: saveSubmission }),
}));

// Step 3 is the My Submissions grid, tested on its own; here it only has to be reached.
vi.mock("./SubmissionWorkspace", () => ({
  default: ({ id, onBack, backLabel }: { id: string; onBack: () => void; backLabel: string }) => (
    <div>
      Workspace for {id}
      <button onClick={onBack}>{backLabel}</button>
    </div>
  ),
}));

const saveBlob = vi.fn();
vi.mock("../lib/download", () => ({ saveBlob: (...args: unknown[]) => saveBlob(...args) }));

const SHEET = [
  ["Nombre", "Correo", "Badge"],
  ["Ana Silva", "ana@acme.io", "B1"],
  ["Ludwig van Beethoven", "lvb@x.de", "B2"],
];
let sheetRows = SHEET;

// jsdom's File cannot be read; the reading itself is covered by leadFile.test.ts.
vi.mock("../lib/leadFile", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/leadFile")>()),
  readLeadFile: async () => [{ name: "Leads", rows: sheetRows }],
}));

const { default: LeadImport } = await import("./LeadImport");
const { MAX_HEADING_CHARS } = await import("../lib/leadFile");

function chooseFile(container: HTMLElement, name: string) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], name)] } });
}

async function openFile() {
  const view = render(
    <MemoryRouter>
      <LeadImport />
    </MemoryRouter>,
  );
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Lead type" }));
  expect(screen.queryByRole("option", { name: "Retired" })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: "Booth" }));
  expect(screen.getByText(/4 columns, 2 required: First Name, Last Name, Email, Company\./)).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText(/Exito BFSI Summit/), { target: { value: "Apidays Paris" } });
  chooseFile(view.container, "Apidays.xlsx");
  fireEvent.click(screen.getByRole("button", { name: "Next: map columns" }));
  await screen.findByRole("table", { name: "Column mapping" });
  await screen.findByText("Exact match", {}, { timeout: 2000 }).catch(() => undefined);
  return view;
}

function mappingRow(column: string): HTMLElement {
  const table = screen.getByRole("table", { name: "Column mapping" });
  return within(table).getByText(column).closest("tr") as HTMLElement;
}

function stat(label: string): string {
  const summary = screen.getByRole("group", { name: "Mapping summary" });
  return within(summary).getByText(label).nextElementSibling?.textContent ?? "";
}

// Each test drives the whole page through three screens: 2–4s alone, over the 5s default
// when the suite runs in parallel. Same allowance as the other full-page tests.
describe("Lead import", { timeout: 20000 }, () => {
  beforeEach(() => {
    suggest.mockReset();
    saveBlob.mockReset();
    createSubmission.mockReset().mockResolvedValue({ id: "sub-1" });
    saveSubmission.mockReset().mockResolvedValue({});
    sheetRows = SHEET;
    suggest.mockResolvedValue({
      claude: "used",
      mapping: [
        {
          field_name: "First Name",
          source_index: 0,
          split: "first",
          how: "claude",
          confidence: "high",
          reason: "Only a full-name column",
        },
        {
          field_name: "Last Name",
          source_index: 0,
          split: "last",
          how: "claude",
          confidence: "high",
          reason: "Only a full-name column",
        },
        {
          field_name: "Email",
          source_index: 1,
          split: null,
          how: "claude",
          confidence: "low",
          reason: "Spanish for email",
        },
        { field_name: "Company", source_index: null, split: null, how: "none", confidence: null, reason: null },
      ],
    });
  });

  it("refuses a file it can't read as soon as it is picked", () => {
    const view = render(
      <MemoryRouter>
        <LeadImport />
      </MemoryRouter>,
    );
    chooseFile(view.container, "scan.pdf");
    expect(screen.getByText(/Upload an \.xlsx or \.csv file/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next: map columns" })).toHaveProperty("disabled", true);
  });

  it("sends only headings and samples, and shows what was mapped and how", async () => {
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    expect(suggest).toHaveBeenCalledWith({
      status: "Booth",
      columns: [
        { index: 0, heading: "Nombre", samples: ["Ana Silva", "Ludwig van Beethoven"] },
        { index: 1, heading: "Correo", samples: ["ana@acme.io", "lvb@x.de"] },
        { index: 2, heading: "Badge", samples: ["B1", "B2"] },
      ],
    });
    expect(stat("Rows")).toBe("2");
    expect(stat("Needs a look")).toBe("2"); // Email (low confidence), Company (required)
    expect(within(mappingRow("Email")).getByText("Claude · low confidence")).toBeTruthy();
    expect(within(mappingRow("Email")).getByText("Spanish for email")).toBeTruthy();
    expect(within(mappingRow("First Name")).getByText(/Splits a full name/)).toBeTruthy();
    expect(within(mappingRow("Company")).getByText(/Required\. My Submissions will flag every row/)).toBeTruthy();
    expect(screen.getByText(/MOP fills Add to Score when the list is submitted/)).toBeTruthy();
    expect(screen.getByText("Columns of the file not used (1)")).toBeTruthy();

    const preview = screen.getByRole("table", { name: "Preview" });
    expect(within(preview).getByText("van Beethoven")).toBeTruthy();
    expect(within(preview).getByText("lvb@x.de")).toBeTruthy();
  });

  it("filters to the columns that need a look", async () => {
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.click(screen.getByRole("button", { name: /Needs a look/ }));
    const table = screen.getByRole("table", { name: "Column mapping" });
    expect(within(table).queryByText("First Name")).toBeNull();
    expect(within(table).getByText("Email")).toBeTruthy();
    expect(within(table).getByText("Company")).toBeTruthy();
  });

  it("a pick replaces the suggestion, and Reset brings the suggestion back", async () => {
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.mouseDown(within(mappingRow("Company")).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /^C · Badge/ }));
    await waitFor(() => expect(stat("Columns mapped")).toBe("4 of 4"));
    expect(within(mappingRow("Company")).getByText("Chosen by you")).toBeTruthy();
    expect(screen.queryByText(/Columns of the file not used/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset to suggestion" }));
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    expect(screen.queryByRole("button", { name: "Reset to suggestion" })).toBeNull();
  });

  it("download saves the workbook", async () => {
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.click(screen.getByRole("button", { name: "Download workbook" }));
    // Building the workbook can outlast findBy's 1s default when the suite runs in parallel.
    await screen.findByText(/Apidays - Booth\.xlsx/, {}, { timeout: 5000 });
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), "Apidays - Booth.xlsx");
  });

  it("create submission saves the rows under the grid's keys and opens step 3", async () => {
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.click(screen.getByRole("button", { name: "Create submission" }));
    await screen.findByText("Workspace for sub-1", {}, { timeout: 5000 });
    expect(createSubmission).toHaveBeenCalledWith(expect.objectContaining({ event_name: "Apidays Paris" }));
    expect(saveSubmission).toHaveBeenCalledWith({
      id: "sub-1",
      payload: {
        tabs: {
          Booth: [
            { first_name: "Ana", last_name: "Silva", email: "ana@acme.io", company: "" },
            { first_name: "Ludwig", last_name: "van Beethoven", email: "lvb@x.de", company: "" },
          ],
        },
      },
      rowCount: 2,
      sourceFilename: "Apidays.xlsx",
    });
    expect(screen.getByText("Fix & review").closest("[aria-current]")?.getAttribute("aria-current")).toBe("step");
  });

  it("goes back and forth without losing the mapping, and only replaces the rows when asked", async () => {
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.click(screen.getByRole("button", { name: "Create submission" }));
    await screen.findByText("Workspace for sub-1");

    // Back to step 2: the mapping is as it was, and unchanged it just moves on.
    fireEvent.click(screen.getByRole("button", { name: "Back: map columns" }));
    expect(stat("Columns mapped")).toBe("3 of 4");
    fireEvent.click(screen.getByRole("button", { name: "Next: fix & review" }));
    await screen.findByText("Workspace for sub-1");
    expect(saveSubmission).toHaveBeenCalledTimes(1);

    // Changed, it offers to replace the rows — in the same submission, after a warning.
    fireEvent.click(screen.getByRole("button", { name: /Map columns/ }));
    fireEvent.mouseDown(within(mappingRow("Company")).getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /^C · Badge/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Replace the rows" }));
    expect(screen.getByText(/including any fixes made in step 3/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Replace the rows" }));
    await screen.findByText("Workspace for sub-1");
    expect(createSubmission).toHaveBeenCalledTimes(1);
    expect(saveSubmission).toHaveBeenCalledTimes(2);
    expect(saveSubmission.mock.calls[1][0].id).toBe("sub-1");

    // Step 1 is read-only once the submission exists.
    fireEvent.click(await screen.findByRole("button", { name: /Set up/ }));
    expect(screen.getByText(/is created, so these are fixed here/)).toBeTruthy();
    expect(screen.getByPlaceholderText(/Exito BFSI Summit/)).toHaveProperty("disabled", true);
  });

  it("a failed save keeps the new submission, and trying again saves into it", async () => {
    saveSubmission.mockRejectedValueOnce(new Error("Network down."));
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.click(screen.getByRole("button", { name: "Create submission" }));
    expect(await screen.findByText(/Network down\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create submission" }));
    await screen.findByText("Workspace for sub-1", {}, { timeout: 5000 });
    expect(createSubmission).toHaveBeenCalledTimes(1);
    expect(saveSubmission.mock.calls.map((c) => c[0].id)).toEqual(["sub-1", "sub-1"]);
  });

  it("after choosing another file, the old file's mapping can't be reopened", async () => {
    const view = await openFile();
    fireEvent.click(screen.getByRole("button", { name: /Set up/ }));
    expect(screen.getByRole("button", { name: /Map columns/ })).toBeTruthy();
    chooseFile(view.container, "Other.xlsx");
    expect(screen.queryByRole("button", { name: /Map columns/ })).toBeNull();
  });

  it("a failed download keeps the mapping and retries the download, not the suggestion", async () => {
    saveBlob.mockImplementationOnce(() => {
      throw new Error("Disk full.");
    });
    await openFile();
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
    fireEvent.click(screen.getByRole("button", { name: "Download workbook" }));
    expect(await screen.findByText(/The workbook could not be written\. Disk full\./)).toBeTruthy();
    expect(screen.queryByText(/Couldn't get a suggestion/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText(/Apidays - Booth\.xlsx/);
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(saveBlob).toHaveBeenCalledTimes(2);
  });

  it("cuts a very long heading to what the server accepts", async () => {
    const long = "How likely are you to recommend us? ".repeat(20);
    sheetRows = [
      ["Correo", long],
      ["ana@acme.io", "9"],
    ];
    await openFile();
    const sent = suggest.mock.calls[0][0].columns;
    expect(sent[1].heading).toHaveLength(MAX_HEADING_CHARS);
    expect(sent[1].heading).toBe(long.slice(0, MAX_HEADING_CHARS));
  });

  it("says when Claude isn't set up, and still allows mapping by hand", async () => {
    suggest.mockResolvedValue({
      claude: "not_configured",
      mapping: fields.Booth.filter((d) => !d.computed).map((d) => ({
        field_name: d.field_name,
        source_index: null,
        split: null,
        how: "none" as const,
        confidence: null,
        reason: null,
      })),
    });
    await openFile();
    expect(await screen.findByText(/Claude isn't set up on this server/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download workbook" })).toHaveProperty("disabled", true);
  });

  it("a failed suggestion leaves every column unmapped, with a retry", async () => {
    suggest.mockRejectedValueOnce(new Error("Network down."));
    await openFile();
    expect(await screen.findByText(/Couldn't get a suggestion: Network down\./)).toBeTruthy();
    expect(stat("Columns mapped")).toBe("0 of 4");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(stat("Columns mapped")).toBe("3 of 4"));
  });
});
