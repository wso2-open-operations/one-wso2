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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BudgetApproversSettings from "./BudgetApproversSettings";

const state = vi.hoisted(() => ({
  approvers: {} as Record<string, unknown>,
  add: { mutate: vi.fn(), isPending: false, error: null as unknown },
  change: { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown },
}));
const showSuccess = vi.hoisted(() => vi.fn());
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess }) }));
vi.mock("../../api/useProcurement", () => ({
  useBudgetApproverSettings: () => state.approvers,
  useAddBudgetApprover: () => state.add,
  useChangeBudgetApprover: () => state.change,
  useProcurementLookups: () => ({
    data: {
      budgetCategories: [],
      businessUnits: [{ value: "BU-1", label: "Sales" }, { value: "BU-2", label: "Engineering" }],
      products: [],
      regions: [{ value: "REG-1", label: "Global" }],
    },
    isError: false,
    refetch: vi.fn(),
  }),
  useDirectorySearch: (query: string) => ({
    data: query.trim().length >= 3 ? [{ id: "drew.parker@example.com", name: "Drew Parker", email: "drew.parker@example.com" }] : [],
    isFetching: false,
    isError: false,
  }),
}));

const approver = (patch = {}) => ({ id: "10", name: "Budget Owner", email: "budget.owner@example.com", isActive: true, businessUnits: ["BU-1"], regions: ["REG-1"], ...patch });
const loaded = (data: unknown[]) => ({ data, isError: false, refetch: vi.fn() });
const succeed = (_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.();

beforeEach(() => {
  state.approvers = loaded([approver(), approver({ id: "11", name: "Regional Owner", email: "regional.owner@example.com", isActive: false, businessUnits: ["BU-X"], regions: [] })]);
  state.add.mutate.mockReset().mockImplementation(succeed);
  state.change.mutate.mockReset().mockImplementation(succeed);
  state.add.isPending = false;
  state.add.error = null;
  state.change.isPending = false;
  state.change.isError = false;
  state.change.error = null;
  showSuccess.mockReset();
});

describe("BudgetApproversSettings", () => {
  it("lists each approver with initials and what they cover by name, a saved code the lists no longer offer by its code, and whether they are offered", () => {
    render(<BudgetApproversSettings />);
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("BO")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Sales")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Global")).toBeInTheDocument();
    expect(within(rows[1]).getByRole("switch", { name: "Offered to requesters, Budget Owner" })).toBeChecked();
    expect(within(rows[2]).getByText("BU-X")).toBeInTheDocument();
    expect(within(rows[2]).getByText("None")).toBeInTheDocument();
    expect(within(rows[2]).getByRole("switch", { name: "Offered to requesters, Regional Owner" })).not.toBeChecked();
  });

  it("shows the first two business units and counts the rest", () => {
    state.approvers = loaded([approver({ businessUnits: ["BU-1", "BU-2", "BU-3", "BU-4"] })]);
    render(<BudgetApproversSettings />);
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("Sales")).toBeInTheDocument();
    expect(within(row).getByText("Engineering")).toBeInTheDocument();
    expect(within(row).queryByText("BU-3")).toBeNull();
    expect(within(row).getByText("+2")).toBeInTheDocument();
  });

  it("switches whether an approver is offered from the row, keeping what they cover", async () => {
    const user = userEvent.setup();
    render(<BudgetApproversSettings />);
    await user.click(screen.getByRole("switch", { name: "Offered to requesters, Budget Owner" }));
    expect(state.change.mutate).toHaveBeenCalledWith({ id: "10", change: { isActive: false, businessUnits: ["BU-1"], regions: ["REG-1"] } }, expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("Budget Owner is no longer offered to requesters.");
    await user.click(screen.getByRole("switch", { name: "Offered to requesters, Regional Owner" }));
    expect(showSuccess).toHaveBeenCalledWith("Regional Owner is now offered to requesters.");
  });

  it("shows what the backend refused when a switch could not be saved", () => {
    state.change.isError = true;
    state.change.error = new Error("The budget approver was not found.");
    render(<BudgetApproversSettings />);
    expect(screen.getByText("The budget approver was not found.")).toBeInTheDocument();
  });

  it("narrows the rows by a search of the name or email and by whether they are offered, with the counts on the filters", async () => {
    const user = userEvent.setup();
    render(<BudgetApproversSettings />);
    expect(screen.getByRole("button", { name: "All 2" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Not offered 1" }));
    expect(screen.queryByText("Budget Owner")).toBeNull();
    expect(screen.getByText("Regional Owner")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "All 2" }));
    await user.type(screen.getByRole("textbox", { name: "Search approvers" }), "BUDGET.owner");
    expect(screen.getByText("Budget Owner")).toBeInTheDocument();
    expect(screen.queryByText("Regional Owner")).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Search approvers" }), "zzz");
    expect(screen.getByText("No budget approver matches.")).toBeInTheDocument();
  });

  it("adds an employee as an approver only once an employee and at least one business unit or region are chosen, and says who will be offered them", async () => {
    const user = userEvent.setup();
    render(<BudgetApproversSettings />);
    await user.click(screen.getByRole("button", { name: "Add budget approver" }));
    const dialog = screen.getByRole("dialog", { name: "Add a budget approver" });
    const save = within(dialog).getByRole("button", { name: "Add approver" });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText(/Choose at least one business unit or region/)).toBeInTheDocument();
    await user.type(within(dialog).getByRole("combobox", { name: "Employee" }), "dre");
    await user.click(await screen.findByRole("option", { name: "Drew Parker (drew.parker@example.com)" }));
    expect(within(dialog).getByText("drew.parker@example.com")).toBeInTheDocument();
    expect(save).toBeDisabled();
    await user.click(within(within(dialog).getByRole("group", { name: "Business units" })).getByRole("checkbox", { name: "Sales" }));
    expect(within(dialog).getByText("Requesters in Sales will be offered Drew Parker as a budget approver.")).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole("button", { name: "Select all" })[1]);
    expect(within(dialog).getByText("Requesters in Sales or Global will be offered Drew Parker as a budget approver.")).toBeInTheDocument();
    await user.click(save);
    expect(state.add.mutate).toHaveBeenCalledWith({ email: "drew.parker@example.com", scopes: { businessUnits: ["BU-1"], regions: ["REG-1"] } }, expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("Drew Parker is now a budget approver.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lets the chosen employee be swapped for another before saving", async () => {
    const user = userEvent.setup();
    render(<BudgetApproversSettings />);
    await user.click(screen.getByRole("button", { name: "Add budget approver" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByRole("combobox", { name: "Employee" }), "dre");
    await user.click(await screen.findByRole("option", { name: "Drew Parker (drew.parker@example.com)" }));
    await user.click(within(dialog).getByRole("button", { name: "Change" }));
    expect(within(dialog).getByRole("combobox", { name: "Employee" })).toBeInTheDocument();
  });

  it("changes whether an approver is offered from the dialog, keeping what they cover", async () => {
    const user = userEvent.setup();
    render(<BudgetApproversSettings />);
    await user.click(screen.getByRole("button", { name: "Change Budget Owner" }));
    const dialog = screen.getByRole("dialog", { name: "Change Budget Owner" });
    await user.click(within(dialog).getByRole("switch", { name: "Offered to requesters" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(state.change.mutate).toHaveBeenCalledWith({ id: "10", change: { isActive: false, businessUnits: ["BU-1"], regions: ["REG-1"] } }, expect.anything());
  });

  it("will not save an approver who covers nothing, and shows what the backend refused", async () => {
    const user = userEvent.setup();
    state.change.error = new Error("A business unit or region cannot be used.");
    render(<BudgetApproversSettings />);
    await user.click(screen.getByRole("button", { name: "Change Regional Owner" }));
    const dialog = screen.getByRole("dialog", { name: "Change Regional Owner" });
    expect(within(dialog).getByText("A business unit or region cannot be used.")).toBeInTheDocument();
    await user.click(within(within(dialog).getByRole("group", { name: "Business units" })).getByRole("checkbox", { name: "BU-X" }));
    expect(within(dialog).getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(within(dialog).getByText(/Choose at least one business unit or region/)).toBeInTheDocument();
  });

  it("says so when the approvers could not be read, and offers a Retry", async () => {
    const refetch = vi.fn();
    state.approvers = { data: undefined, isError: true, error: new Error("Forbidden."), refetch };
    const user = userEvent.setup();
    render(<BudgetApproversSettings />);
    expect(screen.getByText("Forbidden.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
