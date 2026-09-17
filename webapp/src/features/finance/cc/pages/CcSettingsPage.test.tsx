/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

import type { CcNewTransaction } from "../ccTypes";

const row: CcNewTransaction = {
  uploadFileId: 1,
  bankCode: "svb",
  ccNumber: "4444",
  txnReferenceNo: "REF-1",
  txnDescription: "Hotel",
  txnDate: "2026-08-20",
  postDate: "2026-08-21",
  txnCurrency: "USD",
  txnAmount: 500,
  ccCurrency: "USD",
  ccAmount: 500,
  status: "new",
  employeeEmail: "me@wso2.com",
  leadEmail: "lead@wso2.com",
};

const state = {
  access: ["finance"] as string[],
  group: null as unknown,
  /**
   * When set, the NEXT parse fails with this message instead of succeeding.
   *
   * Distinct from the mutation's own error state, which the mock holds in
   * React state below. Conflating the two — one flag meaning both "the next
   * call will fail" and "an error is on screen now" — made the Alert appear
   * the moment the dialog opened, before Upload had been pressed, so the
   * failure tests passed without a failure ever happening.
   */
  failWith: null as string | null,
};

vi.mock("../useCc", () => ({
  useCcUserInfo: () => ({
    data: { workEmail: "me@wso2.com", accessLevels: state.access },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("../ccTypes", async () => {
  const actual = await vi.importActual<typeof import("../ccTypes")>("../ccTypes");
  return { ...actual, ccHasAccess: (_u: unknown, lvl: string) => state.access.includes(lvl) };
});

const processed: unknown[] = [];
const saved: unknown[] = [];
// The process mutation keeps its error in React state, the way the real one
// does: it appears only once a call has failed, `reset()` clears it, and both
// re-render. A plain spy for `reset` would let a component that never resets
// still pass, since nothing on screen would change either way.
vi.mock("../useCcMutations", async () => {
  const { useState } = await vi.importActual<typeof import("react")>("react");
  return {
    useCcProcessStatement: () => {
      const [error, setError] = useState<string | null>(null);
      return {
        mutate: (vars: unknown, opts: { onSuccess: (g: unknown) => void }) => {
          processed.push(vars);
          if (state.failWith) {
            setError(state.failWith);
            return;
          }
          setError(null);
          opts.onSuccess(state.group);
        },
        reset: () => setError(null),
        isPending: false,
        isError: Boolean(error),
        error: error ? new Error(error) : null,
      };
    },
    useCcUploadTransactions: () => ({
      mutate: (vars: unknown, opts: { onSuccess: () => void }) => {
        saved.push(vars);
        opts.onSuccess();
      },
      isPending: false,
    }),
  };
});

// The real shell adds the eyebrow, the not-configured gate and the title
// block; the page's own actions go through it, so the stub has to render
// them or the page would look actionless here and nowhere else.
vi.mock("../../components/FinanceShell", () => ({
  default: ({ actions, children }: { actions?: React.ReactNode; children: React.ReactNode }) => (
    <>
      {actions}
      {children}
    </>
  ),
}));

const { default: CcSettingsPage } = await import("./CcSettingsPage");
const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");

beforeEach(() => {
  state.access = ["finance"];
  state.group = { newItems: [row], duplicateItems: [], invalidItems: [] };
  state.failWith = null;
  processed.length = 0;
  saved.length = 0;
});

function show() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotificationsProvider>
        <CcSettingsPage />
      </NotificationsProvider>
    </QueryClientProvider>,
  );
}

const openDialog = () =>
  fireEvent.click(screen.getByRole("button", { name: /Upload Statement/ }));

// fireEvent, not userEvent.upload: the latter respects the input's `accept`
// attribute and would drop a non-CSV before the component ever saw it, which
// is exactly the guard being tested. A real browser's "All files" option does
// the same as this.
const pick = (name: string, type = "text/csv") => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["a,b"], name, { type })] } });
};

const clickUpload = () => fireEvent.click(screen.getByRole("button", { name: "Upload" }));

/** Open the dialog, choose a CSV, and send it. */
const uploadCsv = (name = "statement.csv") => {
  openDialog();
  pick(name);
  clickUpload();
};

// index.tsx:232-236 — before anything is uploaded the screen says what to do.
describe("before a statement is uploaded", () => {
  it("says what to do rather than showing an empty frame", async () => {
    show();
    expect(await screen.findByText("Upload a bank statement")).toBeInTheDocument();
    expect(screen.getByText("Upload a statement to view transactions")).toBeInTheDocument();
  });

  // :157-164 — the way in is one button opposite the title, not a form spread
  // across the page.
  it("offers Upload Statement, and nothing to save yet", async () => {
    show();
    expect(await screen.findByRole("button", { name: /Upload Statement/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });

  it("keeps the picker in a dialog until that button is pressed", async () => {
    show();
    expect(screen.queryByText("Drag & drop your CSV file here or click")).not.toBeInTheDocument();
    openDialog();
    expect(await screen.findByText("Upload Bank Statement")).toBeInTheDocument();
    expect(screen.getByText("Drag & drop your CSV file here or click")).toBeInTheDocument();
  });
});

// :57-70 — the file is sent by Upload, not by being chosen. The port parsed on
// pick, which left the bank select as a setting nobody could revise after the
// fact and gave no point at which to change your mind.
describe("the upload dialog", () => {
  it("does not send the file merely for being chosen", async () => {
    show();
    openDialog();
    pick("statement.csv");
    await screen.findByText("statement.csv");
    expect(processed).toHaveLength(0);
  });

  it("keeps Upload disabled until there is a file", async () => {
    show();
    openDialog();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    pick("statement.csv");
    await waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toBeEnabled());
  });

  it("sends the file, and the bank chosen beside it", async () => {
    show();
    openDialog();
    await userEvent.setup().click(screen.getByRole("combobox", { name: "Select a Bank" }));
    await userEvent.setup().click(await screen.findByRole("option", { name: "Amex" }));
    pick("statement.csv");
    clickUpload();
    await waitFor(() => expect(processed).toHaveLength(1));
    expect(processed[0]).toMatchObject({ bankCode: "amex", fileName: "statement.csv" });
  });

  it("closes once the statement has parsed", async () => {
    show();
    uploadCsv();
    await waitFor(() =>
      expect(screen.queryByText("Upload Bank Statement")).not.toBeInTheDocument(),
    );
  });

  // :262-266 — a parse failure is reported beside the file that caused it, so
  // it can be swapped for another one without reopening anything.
  it("reports a parse failure in the dialog, and stays open", async () => {
    state.failWith = "Unrecognised column layout";
    show();
    uploadCsv();
    expect(await screen.findByText(/Unrecognised column layout/)).toBeInTheDocument();
    expect(screen.getByText("Upload Bank Statement")).toBeInTheDocument();
  });

  // A parse failure describes one file parsed as one bank. Left standing, the
  // Alert reports an attempt that no longer matches what is on screen — the
  // previous file's error sitting beside the file just chosen to replace it.
  describe("a parse failure, once the inputs move", () => {
    // Swapping the file means clearing first — the drop zone shows the chosen
    // file's name rather than an input while one is held — so this is the
    // whole path, not just the clear half of it.
    it("does not come back when the replacement file is chosen", async () => {
      state.failWith = "Unrecognised column layout";
      show();
      uploadCsv();
      await screen.findByText(/Unrecognised column layout/);

      fireEvent.click(screen.getByRole("button", { name: "Clear file" }));
      await screen.findByText("Drag & drop your CSV file here or click");
      pick("other.csv");

      expect(await screen.findByText("other.csv")).toBeInTheDocument();
      expect(screen.queryByText(/Unrecognised column layout/)).not.toBeInTheDocument();
    });

    it("is dropped when the file is cleared", async () => {
      state.failWith = "Unrecognised column layout";
      show();
      uploadCsv();
      await screen.findByText(/Unrecognised column layout/);

      fireEvent.click(screen.getByRole("button", { name: "Clear file" }));
      await waitFor(() =>
        expect(screen.queryByText(/Unrecognised column layout/)).not.toBeInTheDocument(),
      );
    });

    it("is dropped when the bank is changed", async () => {
      state.failWith = "Unrecognised column layout";
      show();
      uploadCsv();
      await screen.findByText(/Unrecognised column layout/);

      const user = userEvent.setup();
      await user.click(screen.getByRole("combobox", { name: "Select a Bank" }));
      await user.click(await screen.findByRole("option", { name: "Amex" }));
      await waitFor(() =>
        expect(screen.queryByText(/Unrecognised column layout/)).not.toBeInTheDocument(),
      );
    });
  });

  it("can be abandoned with Cancel", async () => {
    show();
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByText("Upload Bank Statement")).not.toBeInTheDocument(),
    );
    expect(processed).toHaveLength(0);
  });
});

// FileUpload.tsx:89-94 checks the extension. `accept` on the input only filters
// the picker's default view, so without this a non-CSV reached the backend and
// failed with whatever it happened to say.
describe("choosing a file that is not a CSV", () => {
  it("is refused by name, with the source's message", async () => {
    show();
    openDialog();
    pick("statement.xlsx", "application/vnd.ms-excel");
    expect(
      await screen.findByText("Invalid file type. Please upload a CSV file."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();
    expect(processed).toHaveLength(0);
  });

  it("lets a CSV through", async () => {
    show();
    uploadCsv();
    await waitFor(() => expect(processed).toHaveLength(1));
  });
});

// StatementDataGrid.tsx:38-67 — the source's columns, in its wording. Lead
// Email is the one that says who a row will go to for approval.
describe("the parsed statement table", () => {
  it("names its columns the way the source does", async () => {
    show();
    uploadCsv();
    for (const header of [
      "Reference No",
      "Card Owner",
      "Card Number",
      "Lead Email",
      "Transaction Date",
      "Description",
      "Amount",
    ]) {
      expect(await screen.findByText(header)).toBeInTheDocument();
    }
  });

  it("shows who will approve each row", async () => {
    show();
    uploadCsv();
    expect(await screen.findByText("lead@wso2.com")).toBeInTheDocument();
  });

  // index.tsx:190-210 — one tab per group, each counted.
  it("counts each group in its tab", async () => {
    state.group = { newItems: [row], duplicateItems: [row, row], invalidItems: [] };
    show();
    uploadCsv();
    expect(await screen.findByRole("tab", { name: /New \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Duplicate \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Invalid \(0\)/ })).toBeInTheDocument();
  });

  it("shows an empty group as empty rather than as the last one", async () => {
    state.group = { newItems: [row], duplicateItems: [], invalidItems: [] };
    show();
    uploadCsv();
    fireEvent.click(await screen.findByRole("tab", { name: /Invalid \(0\)/ }));
    expect(await screen.findByText("None in this group.")).toBeInTheDocument();
  });
});

// :112-165 — once a statement is parsed the header offers the two ways out of
// it, and no longer the way in.
describe("once a statement is parsed", () => {
  it("swaps Upload Statement for Cancel and Save", async () => {
    show();
    uploadCsv();
    expect(await screen.findByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload Statement/ })).not.toBeInTheDocument();
  });

  it("saves the group under the bank it was parsed with", async () => {
    show();
    uploadCsv();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({ bankCode: "svb", fileName: "statement.csv" });
  });

  // Changing the select after a parse must not re-label what is on screen:
  // the group was parsed as SVB and has to be saved as SVB.
  it("is not re-banked by reopening the dialog and changing the select", async () => {
    show();
    uploadCsv();
    await screen.findByRole("button", { name: "Save" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // Back to the empty state, so the statement is gone rather than silently
    // re-banked.
    expect(await screen.findByText("Upload a bank statement")).toBeInTheDocument();
    expect(saved).toHaveLength(0);
  });

  it("returns to the empty state after a successful save", async () => {
    show();
    uploadCsv();
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));
    expect(await screen.findByText("Upload a bank statement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Upload Statement/ })).toBeInTheDocument();
  });
});

describe("a statement with nothing new in it", () => {
  it("says why Save is disabled", async () => {
    state.group = { newItems: [], duplicateItems: [row], invalidItems: [] };
    show();
    uploadCsv();
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    // index.tsx:143-163 — the reason lives in a tooltip, which MUI only
    // renders once hovered; the span wrapper is what receives the pointer,
    // since a disabled button does not.
    await userEvent.setup().hover(save.parentElement as HTMLElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("No new items to save");
  });
});

// StatementDataGrid.tsx:81 uses the all-in-one GridToolbar, so this screen
// does get export — unlike the three transaction grids, whose toolbars hold
// only a quick filter. Finance is reconciling a statement it uploaded itself.
describe("the statement grid's toolbar", () => {
  it("offers export, which the transaction grids withhold", async () => {
    show();
    uploadCsv();
    expect(await screen.findByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("offers search and column control too", async () => {
    show();
    uploadCsv();
    // findByRole, not getByRole: the dialog is still unmounting its closing
    // transition, and while it is there the grid behind it is aria-hidden —
    // so a role query has to be given the tick it takes to go away.
    for (const name of ["Columns", "Search"]) {
      expect(await screen.findByRole("button", { name })).toBeInTheDocument();
    }
  });
});

// FileUpload.tsx — the source drops a file on a target, or clicks it. The port
// had only a button, so a drop did nothing and a chosen file could not be
// taken back.
describe("the drop zone", () => {
  const zone = () => screen.getByRole("button", { name: /Drag & drop/ });

  const drop = (name: string) =>
    fireEvent.drop(zone(), {
      dataTransfer: { files: [new File(["a,b"], name, { type: "text/csv" })] },
    });

  it("invites a drop or a click", async () => {
    show();
    openDialog();
    expect(await screen.findByText("Drag & drop your CSV file here or click")).toBeInTheDocument();
  });

  it("says so while a file is over it", async () => {
    show();
    openDialog();
    fireEvent.dragEnter(zone());
    expect(await screen.findByText("Drop your file here")).toBeInTheDocument();
  });

  it("takes a dropped CSV", async () => {
    show();
    openDialog();
    drop("statement.csv");
    clickUpload();
    await waitFor(() => expect(processed).toHaveLength(1));
  });

  it("refuses a dropped non-CSV — accept cannot filter a drop", async () => {
    show();
    openDialog();
    fireEvent.drop(zone(), {
      dataTransfer: { files: [new File(["x"], "statement.xlsx", { type: "text/csv" })] },
    });
    expect(
      await screen.findByText("Invalid file type. Please upload a CSV file."),
    ).toBeInTheDocument();
    expect(processed).toHaveLength(0);
  });

  it("shows the chosen file's name and size, and lets it be cleared", async () => {
    show();
    openDialog();
    drop("statement.csv");
    expect(await screen.findByText("statement.csv")).toBeInTheDocument();
    expect(screen.getByText("3 Bytes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear file" }));
    expect(await screen.findByText("Drag & drop your CSV file here or click")).toBeInTheDocument();
  });
});

// The page is finance-only, and says so rather than showing a picker that
// would be refused by the backend.
describe("someone who is not a finance approver", () => {
  it("is told, and is offered no way to upload", async () => {
    state.access = [];
    show();
    expect(
      await screen.findByText("Statement ingestion is limited to finance approvers."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload Statement/ })).not.toBeInTheDocument();
  });
});
