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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = {
  leaves: [] as Record<string, unknown>[],
  // What the decision call does: succeed, or call onError.
  fail: false,
};

const leaveFilters: Record<string, unknown>[] = [];
const approveMutate = vi.fn();
const showError = vi.fn();
const showSuccess = vi.fn();

vi.mock("../api/useLeaveData", () => ({
  useLeaves: (filter: Record<string, unknown>) => {
    leaveFilters.push(filter);
    return {
      data: { leaves: state.leaves },
      isLoading: false,
      isError: false,
      error: null,
    };
  },
}));

vi.mock("../api/useLeaveMutations", () => ({
  useApproveLeave: () => ({
    isPending: false,
    mutate: (
      vars: unknown,
      opts: { onSuccess?: () => void; onError?: (e: Error) => void },
    ) => {
      approveMutate(vars);
      if (state.fail) opts.onError?.(new Error("This request is no longer pending."));
      else opts.onSuccess?.();
    },
  }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess }),
}));

const { default: OtherAuthorizedApproveTab } = await import("./OtherAuthorizedApproveTab");
const { default: OtherAuthorizedApprovalHistoryTab } = await import(
  "./OtherAuthorizedApprovalHistoryTab"
);

const qc = new QueryClient();
const invalidate = vi.spyOn(qc, "invalidateQueries");

function show(ui: ReactNode) {
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const row = {
  id: 7,
  email: "anna@wso2.com",
  startDate: "2026-11-02",
  endDate: "2026-11-03",
  numberOfDays: 2,
  submitComment: "Moving house",
  createdDate: "2026-10-27T08:00:00Z",
  status: "PENDING",
};

beforeEach(() => {
  state.leaves = [row];
  state.fail = false;
  leaveFilters.length = 0;
  approveMutate.mockClear();
  showError.mockClear();
  showSuccess.mockClear();
  invalidate.mockClear();
});

describe("OtherAuthorizedApproveTab", () => {
  it("asks for the lead's pending Other Authorized requests", () => {
    show(<OtherAuthorizedApproveTab />);
    expect(leaveFilters[0]).toEqual({
      subordinatesLeaves: true,
      leaveCategory: ["other_authorized"],
      statuses: ["PENDING"],
      orderBy: "DESC",
    });
  });

  it("shows the employee, comment and how long it has waited", () => {
    show(<OtherAuthorizedApproveTab />);
    expect(screen.getByText("anna@wso2.com")).toBeInTheDocument();
    expect(screen.getByText("Moving house")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText(/day/i, { selector: "td" })).toBeInTheDocument();
  });

  it("asks before approving, naming the employee and dates, then posts no reason", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/anna@wso2\.com/)).toBeInTheDocument();
    expect(within(dialog).getByText(/2026-11-02 – 2026-11-03/)).toBeInTheDocument();
    expect(approveMutate).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Yes, Approve" }));
    expect(approveMutate).toHaveBeenCalledWith({ id: 7, action: "approve" });
  });

  it("posts nothing when the approval is cancelled", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it("keeps the reject dialog and the typed reason when the decision is refused", async () => {
    state.fail = true;
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "Not covered");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(showError).toHaveBeenCalledWith("This request is no longer pending.");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leaves"] });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("textbox")).toHaveValue("Not covered");
  });

  it("closes the reject dialog once the decision succeeds", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.type(within(screen.getByRole("dialog")).getByRole("textbox"), "Not covered");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reject" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("labels the reject dialog by its title and ties the counter to the field", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog", { name: "Reject this request?" });
    const field = within(dialog).getByRole("textbox");
    expect(field).toHaveAccessibleDescription(/0 \/ 500/);
  });

  it("refuses a blank reason inline and sends nothing", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "   ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(within(dialog).getByText("Enter a reason for rejecting this request.")).toBeInTheDocument();
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it("refuses a 501-character reason inline", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("textbox"));
    await userEvent.paste("a".repeat(501));
    expect(within(dialog).getByText("The reason can be at most 500 characters.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(approveMutate).not.toHaveBeenCalled();
  });

  it("rejects with the trimmed reason", async () => {
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox"), "  Not covered  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reject" }));
    expect(approveMutate).toHaveBeenCalledWith({ id: 7, action: "reject", reason: "Not covered" });
  });

  it("refetches the list after a refused decision and tells the lead why", async () => {
    state.fail = true;
    show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, Approve" }));
    expect(showError).toHaveBeenCalledWith("This request is no longer pending.");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leaves"] });
  });
});

describe("a refused decision followed by an emptied list", () => {
  it("does not bring the old dialog back when new requests arrive", async () => {
    state.fail = true;
    const view = show(<OtherAuthorizedApproveTab />);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Yes, Approve" }));
    // The refusal keeps the dialog open; the refetch then finds nothing pending.
    state.leaves = [];
    view.rerender(
      <QueryClientProvider client={qc}>
        <OtherAuthorizedApproveTab />
      </QueryClientProvider>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // A new request arrives, even one with the same id: no dialog.
    state.leaves = [row];
    view.rerender(
      <QueryClientProvider client={qc}>
        <OtherAuthorizedApproveTab />
      </QueryClientProvider>,
    );
    expect(screen.getByText("anna@wso2.com")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("OtherAuthorizedApprovalHistoryTab", () => {
  it("asks for decided requests and shows the reason on a rejected row", () => {
    state.leaves = [
      { ...row, status: "REJECTED", rejectionReason: "Not covered" },
      { ...row, id: 8, status: "APPROVED" },
    ];
    show(<OtherAuthorizedApprovalHistoryTab />);
    expect(leaveFilters[0]).toEqual({
      subordinatesLeaves: true,
      leaveCategory: ["other_authorized"],
      statuses: ["APPROVED", "REJECTED"],
      orderBy: "DESC",
    });
    expect(screen.getByText("Reason")).toBeInTheDocument();
    expect(screen.getByText("Not covered")).toBeInTheDocument();
  });
});
