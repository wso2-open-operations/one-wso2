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
import ReferenceOptionsSettings from "./ReferenceOptionsSettings";

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  add: { mutate: vi.fn(), isPending: false, error: null as unknown },
  change: { mutate: vi.fn(), isPending: false, isError: false, error: null as unknown },
}));
const showSuccess = vi.hoisted(() => vi.fn());
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess }) }));
vi.mock("../../api/useProcurement", () => ({
  useReferenceSettings: () => state.settings,
  useAddReferenceOption: () => state.add,
  useChangeReferenceOption: () => state.change,
}));

const option = (patch = {}) => ({ id: "1", kind: "BUDGET_CATEGORY", code: "CAT-1", label: "Software", isActive: true, ...patch });
const succeed = (_v: unknown, o?: { onSuccess?: () => void }) => o?.onSuccess?.();

beforeEach(() => {
  state.settings = {
    data: [option(), option({ id: "2", code: "CAT-2", label: "Hardware", isActive: false }), option({ id: "3", kind: "REGION", code: "REG-1", label: "Global" })],
    isError: false,
    refetch: vi.fn(),
  };
  state.add.mutate.mockReset().mockImplementation(succeed);
  state.change.mutate.mockReset().mockImplementation(succeed);
  state.add.error = null;
  state.change.isError = false;
  state.change.error = null;
  showSuccess.mockReset();
});

describe("ReferenceOptionsSettings", () => {
  it("lists the form's lists with how many options each has, and shows the options of one at a time with their code", async () => {
    const user = userEvent.setup();
    render(<ReferenceOptionsSettings />);
    const lists = within(screen.getByRole("navigation", { name: "Lists" }));
    expect(lists.getByRole("button", { name: /^Budget categories\s*2$/ })).toBeInTheDocument();
    expect(lists.getByRole("button", { name: /^Regions\s*1$/ })).toBeInTheDocument();
    expect(screen.getByText("Software")).toBeInTheDocument();
    expect(screen.getByText("CAT-1")).toBeInTheDocument();
    expect(screen.queryByText("Global")).toBeNull();
    await user.click(lists.getByRole("button", { name: /^Regions/ }));
    expect(screen.getByText("Global")).toBeInTheDocument();
    expect(screen.queryByText("Software")).toBeNull();
  });

  it("shows whether each option is offered as a switch on its row", () => {
    render(<ReferenceOptionsSettings />);
    expect(screen.getByRole("switch", { name: "Offered on the form, Software" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Offered on the form, Hardware" })).not.toBeChecked();
  });

  it("switches an option on or off from the row, keeping its label", async () => {
    const user = userEvent.setup();
    render(<ReferenceOptionsSettings />);
    await user.click(screen.getByRole("switch", { name: "Offered on the form, Software" }));
    expect(state.change.mutate).toHaveBeenCalledWith({ id: "1", change: { label: "Software", isActive: false } }, expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("Software is no longer offered on the form.");
    await user.click(screen.getByRole("switch", { name: "Offered on the form, Hardware" }));
    expect(showSuccess).toHaveBeenCalledWith("Hardware is now offered on the form.");
  });

  it("shows what the backend refused when a switch could not be saved", () => {
    state.change.isError = true;
    state.change.error = new Error("The option was not found.");
    render(<ReferenceOptionsSettings />);
    expect(screen.getByText("The option was not found.")).toBeInTheDocument();
  });

  it("searches the list that is shown by label or code, and starts over when another list is opened", async () => {
    const user = userEvent.setup();
    render(<ReferenceOptionsSettings />);
    const search = screen.getByRole("textbox", { name: "Search options" });
    await user.type(search, "cat-2");
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.queryByText("Software")).toBeNull();
    await user.type(search, "9");
    expect(screen.getByText("No option matches.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Regions/ }));
    expect(screen.getByRole("textbox", { name: "Search options" })).toHaveValue("");
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("adds an option to the list that is shown, with its code and label", async () => {
    const user = userEvent.setup();
    render(<ReferenceOptionsSettings />);
    await user.click(screen.getByRole("button", { name: /^Regions/ }));
    await user.click(screen.getByRole("button", { name: "Add option" }));
    const dialog = screen.getByRole("dialog", { name: "Add an option" });
    const save = within(dialog).getByRole("button", { name: "Add option" });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox", { name: "Code" }), " REG-9 ");
    await user.type(within(dialog).getByRole("textbox", { name: "Label" }), "Oceania");
    await user.click(save);
    expect(state.add.mutate).toHaveBeenCalledWith({ kind: "REGION", code: "REG-9", label: "Oceania" }, expect.anything());
    expect(showSuccess).toHaveBeenCalledWith("Oceania was added.");
  });

  it("changes the label and whether an option is offered, and leaves its code as it is", async () => {
    const user = userEvent.setup();
    render(<ReferenceOptionsSettings />);
    await user.click(screen.getByRole("button", { name: "Change Hardware" }));
    const dialog = screen.getByRole("dialog", { name: "Change Hardware" });
    expect(within(dialog).getByRole("textbox", { name: "Code" })).toBeDisabled();
    const label = within(dialog).getByRole("textbox", { name: "Label" });
    await user.clear(label);
    await user.type(label, "Equipment");
    await user.click(within(dialog).getByRole("switch", { name: "Offered to requesters" }));
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    expect(state.change.mutate).toHaveBeenCalledWith({ id: "2", change: { label: "Equipment", isActive: true } }, expect.anything());
  });

  it("shows what the backend refused in the add pop-up", async () => {
    const user = userEvent.setup();
    state.add.error = new Error("That code is in the list already.");
    render(<ReferenceOptionsSettings />);
    await user.click(screen.getByRole("button", { name: "Add option" }));
    expect(within(screen.getByRole("dialog")).getByText("That code is in the list already.")).toBeInTheDocument();
  });

  it("says so when the options could not be read, and offers a Retry", async () => {
    const refetch = vi.fn();
    state.settings = { data: undefined, isError: true, error: new Error("Forbidden."), refetch };
    const user = userEvent.setup();
    render(<ReferenceOptionsSettings />);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
