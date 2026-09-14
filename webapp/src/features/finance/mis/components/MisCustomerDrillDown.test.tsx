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

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MisCustomerDrillDown from "./MisCustomerDrillDown";
import type { DrillDownCustomer } from "./drillDownColumns";
import type { DrillDownState } from "../api/useDrillDownCustomers";

// The dialog behind a figure: who is inside this number.
//
// The fetch is stubbed at the hook's own shape — it has its own tests — so this
// file is about what a reader sees.

const NORTHWIND: DrillDownCustomer = {
  accountId: "0018000001abcXYZ",
  name: "Northwind Bank",
  salesRegion: "EMEA",
  subRegion: "Northern Europe",
  amount: 750000,
  accountOwner: "John Doe",
};

const loaded = (customers: DrillDownCustomer[]): DrillDownState => ({
  customers,
  isLoading: false,
  isError: false,
  errorMessage: "",
  retry: () => {},
});

function renderDialog(over: Partial<Parameters<typeof MisCustomerDrillDown>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <MisCustomerDrillDown
      open
      onClose={onClose}
      rowId="new-arr"
      rowLabel="New"
      periodColumn="2024/12/31 - 2025/12/31"
      chips={[]}
      state={loaded([NORTHWIND])}
      {...over}
    />,
  );
  return { onClose };
}

describe("what the dialog says it is showing", () => {
  it("names the figure that was opened — the row and the Period", () => {
    // The source's title is `${rowLabel} · ${periodColumn}` with a middle dot.
    // It is the only thing on screen tying the list back to the cell the reader
    // clicked, and a customer list with no such tie is unreadable.
    renderDialog();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/New · 2024\/12\/31 - 2025\/12\/31/);
  });

  it("shows the filters the figure was computed under, and lets nobody change them", () => {
    // Read-only on purpose: these are the Build's Applied filters, and a filter
    // changed from inside the dialog would leave the list describing a
    // different figure from the one it was opened from. The port's chip strip
    // becomes undismissable by omitting onRemove.
    renderDialog({
      chips: [{ key: "salesRegion", label: "Region: EMEA", removable: true }],
    });
    // Scoped to the strip: the customer row below happens to be in EMEA too,
    // which is exactly the sort of collision a dialog like this will hit.
    const strip = screen.getByRole("list");
    expect(within(strip).getByText("Region: EMEA")).toBeInTheDocument();
    expect(within(strip).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("the customers themselves", () => {
  it("lists one row per customer, under the source's column headings", () => {
    renderDialog();
    const table = screen.getByRole("table");
    expect(within(table).getByText("0018000001abcXYZ")).toBeInTheDocument();
    expect(within(table).getByText("Northwind Bank")).toBeInTheDocument();
    expect(within(table).getByText("750,000.00")).toBeInTheDocument();
  });

  it("shows eleven columns on an ordinary movement", () => {
    renderDialog();
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")).toHaveLength(11);
  });

  it("shows thirteen on a Lost row, because those customers have a reason", () => {
    renderDialog({ rowId: "lost", rowLabel: "Lost" });
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader");
    expect(headers).toHaveLength(13);
    expect(headers.map((h) => h.textContent)).toContain("Lost Reason");
  });

  it("writes the amount at units even though the Build behind it may be in thousands", () => {
    renderDialog({ state: loaded([{ ...NORTHWIND, amount: 1234567.5 }]) });
    expect(screen.getByText("1,234,567.50")).toBeInTheDocument();
  });
});

describe("when there is nothing to show", () => {
  it("holds the space while it loads rather than flashing an empty list", () => {
    renderDialog({ state: { ...loaded([]), isLoading: true } });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("says plainly when the figure has no customers behind it", () => {
    renderDialog({ state: loaded([]) });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText(/no customers/i)).toBeInTheDocument();
  });

  it("says the request FAILED rather than showing an empty list", () => {
    // The divergence worth having. In the source the error is discarded three
    // times over and a failed drill-down renders an empty grid — on a screen
    // whose entire purpose is to explain a figure, that reads as "this number
    // is made of nobody".
    const retry = vi.fn();
    renderDialog({
      state: { customers: [], isLoading: false, isError: true, errorMessage: "Gateway said no.", retry },
    });
    expect(screen.getByText(/Gateway said no/)).toBeInTheDocument();
    expect(screen.queryByText(/no customers/i)).not.toBeInTheDocument();
  });
});

describe("closing it", () => {
  it("closes on the close button", async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape, because a modal over a report must be dismissable", async () => {
    const { onClose } = renderDialog();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing at all while shut", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
