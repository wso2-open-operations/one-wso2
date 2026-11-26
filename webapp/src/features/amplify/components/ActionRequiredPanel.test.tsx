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
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { ActionRequiredItem } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  list: undefined as unknown as Record<string, unknown>,
  pages: [] as number[],
  clear: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock("../api/useAmplifyData", () => ({
  ACTION_REQUIRED_PAGE_SIZE: 10,
  useActionRequired: (page: number) => {
    h.pages.push(page);
    return h.list;
  },
  useAmplifyMe: () => ({ data: { employee: { employeeId: "po-1" } } }),
}));
vi.mock("../api/useAmplifyMutations", () => ({
  useClearActionRequired: () => ({ mutateAsync: h.clear, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: h.showError, showSuccess: h.showSuccess }),
}));

import ActionRequiredPanel, { ACTION_REQUIRED_HELP, CLEARED_MESSAGE } from "./ActionRequiredPanel";

const row = (reference: string, over: Partial<ActionRequiredItem> = {}): ActionRequiredItem => ({
  reference,
  employeeId: "e-1",
  employeeName: "Nimal Silva",
  employeeEmail: "nimal@example.test",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points: 2,
  createdAt: "2026-11-19T10:00:00Z",
  campaignTitle: "Choreo Labs at KubeCon North America",
  settlement: "ACTION_REQUIRED",
  verification: "UNVERIFIABLE",
  verificationReason: "TOKEN_EXPIRED",
  ...over,
});
const loaded = (items: ActionRequiredItem[], total = items.length) => ({
  data: { items, page: 0, size: 10, total },
  isPending: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
});

beforeEach(() => {
  h.clear.mockReset();
  h.showError.mockReset();
  h.showSuccess.mockReset();
  h.pages = [];
});

describe("ActionRequiredPanel", () => {
  it("shows nothing while loading or when no row waits", () => {
    h.list = { data: undefined, isPending: true, isError: false };
    const { container, rerender } = render(<ActionRequiredPanel />);
    expect(container.textContent).toBe("");
    h.list = loaded([]);
    rerender(<ActionRequiredPanel />);
    expect(container.textContent).toBe("");
  });

  it("lists each waiting row with whose it is, the post, the points and why", () => {
    h.list = loaded([row("r-1"), row("r-2", { verification: null, verificationReason: null, employeeName: null })]);
    render(<ActionRequiredPanel />);
    const region = screen.getByRole("region", { name: "Action required" });
    expect(within(region).getByText(ACTION_REQUIRED_HELP)).toBeTruthy();
    const rows = within(region).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Nimal Silva");
    expect(rows[0].textContent).toContain("Choreo Labs at KubeCon North America");
    expect(rows[0].textContent).toContain("+2");
    expect(rows[0].textContent).toContain("Couldn't check: their LinkedIn link expired");
    expect(rows[1].textContent).toContain("nimal@example.test");
    expect(rows[1].textContent).toContain("Held back by the PO team");
  });

  it("clears a row, and says it converts at the next conversion", async () => {
    h.list = loaded([row("r-1")]);
    h.clear.mockResolvedValue({});
    render(<ActionRequiredPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Clear / }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith(CLEARED_MESSAGE));
    expect(h.clear).toHaveBeenCalledWith({ reference: "r-1", employeeId: "e-1" });
  });

  it("explains a refused clear", async () => {
    h.list = loaded([row("r-1")]);
    h.clear.mockRejectedValue(new HttpError("/x", 409, JSON.stringify({ status: 409, code: "ALREADY_PAID" })));
    render(<ActionRequiredPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Clear / }));
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith("These points have already become Coins. Reload to see where they are now."),
    );
  });

  it("offers no Clear on the caller's own points", () => {
    h.list = loaded([row("r-1", { employeeId: "po-1" })]);
    render(<ActionRequiredPanel />);
    expect(screen.queryByRole("button", { name: /^Clear / })).toBeNull();
  });

  it("pages through a long list", () => {
    h.list = loaded([row("r-1")], 25);
    render(<ActionRequiredPanel />);
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(h.pages.at(-1)).toBe(1);
  });

  it("offers a retry when the list fails to load", () => {
    h.list = { data: undefined, isPending: false, isError: true, isFetching: false, error: new Error("down"), refetch: vi.fn() };
    render(<ActionRequiredPanel />);
    expect(screen.getByText(/Couldn't load the points waiting for action/)).toBeTruthy();
  });
});
