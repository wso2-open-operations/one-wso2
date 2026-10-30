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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HISTORY_STATUSES } from "../util/franceLeave";

const state = { leaves: [] as Record<string, unknown>[] };
const filters: Record<string, unknown>[] = [];
const showError = vi.fn();
const downloadSickNote = vi.fn();

vi.mock("../api/useLeaveData", () => ({
  useLeaveUserInfo: () => ({
    data: { workEmail: "me@wso2.com", employmentStartDate: "2020-01-01" },
    isLoading: false,
  }),
  useLeaves: (filter: Record<string, unknown>) => {
    filters.push(filter);
    return {
      data: { leaves: state.leaves },
      isLoading: false,
      isError: false,
      error: null,
    };
  },
}));
vi.mock("../api/useLeaveMutations", () => ({
  useCancelLeave: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess: vi.fn() }),
}));
vi.mock("@hooks/useAccessToken", () => ({
  useAccessToken: () => () => Promise.resolve("tok"),
}));
vi.mock("../util/sickNoteDownload", () => ({
  downloadSickNote: (...args: unknown[]) => downloadSickNote(...args),
}));

import GeneralHistoryTab, { SabbaticalHistoryTab } from "./LeaveHistoryPage";

const today = new Date();
const iso = (offsetDays: number) => {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

let nextId = 1;
const leave = (over: Record<string, unknown>) => ({
  id: nextId++,
  leaveType: "casual",
  status: "APPROVED",
  startDate: iso(-2),
  endDate: iso(-2),
  numberOfDays: 1,
  ...over,
});

beforeEach(() => {
  state.leaves = [];
  filters.length = 0;
  showError.mockReset();
  downloadSickNote.mockReset();
});

describe("My history", () => {
  it("asks for every history status on both tabs", () => {
    render(<GeneralHistoryTab />);
    render(<SabbaticalHistoryTab />);
    expect(filters).toHaveLength(2);
    for (const f of filters) expect(f.statuses).toEqual(HISTORY_STATUSES);
  });

  it("shows the reason on a rejected card only, and no Cancel on rejected or cancelled", () => {
    state.leaves = [
      leave({ status: "REJECTED", rejectionReason: "Too many people out" }),
      leave({ status: "CANCELLED", rejectionReason: "should not show" }),
      leave({ status: "APPROVED" }),
    ];
    render(<GeneralHistoryTab />);
    expect(screen.getByText("Reason: Too many people out")).toBeTruthy();
    expect(screen.queryByText(/should not show/)).toBeNull();
    expect(screen.getAllByLabelText("Cancel leave")).toHaveLength(1);
  });

  it("offers the download for a live sick note and surfaces a failure", async () => {
    state.leaves = [leave({ id: 77, leaveType: "sick", hasSickNote: true })];
    downloadSickNote.mockRejectedValue(new Error("Note is gone"));
    render(<GeneralHistoryTab />);
    fireEvent.click(screen.getByRole("button", { name: "Download sick note" }));
    await waitFor(() => expect(showError).toHaveBeenCalledWith("Note is gone"));
    expect(downloadSickNote).toHaveBeenCalledWith(77, "tok");
  });

  it("says when the sick note was deleted and offers no download", () => {
    state.leaves = [
      leave({
        leaveType: "sick",
        hasSickNote: true,
        sickNoteDeletedOn: "2026-09-01T10:00:00Z",
      }),
    ];
    render(<GeneralHistoryTab />);
    expect(screen.getByText("Sick note deleted on Sep 1, 2026")).toBeTruthy();
    expect(screen.queryByText("Download sick note")).toBeNull();
  });

  it("totals ignore cancelled and rejected leave", () => {
    state.leaves = [
      leave({ numberOfDays: 2 }),
      leave({ status: "PENDING", numberOfDays: 1 }),
      leave({ status: "CANCELLED", numberOfDays: 3 }),
      leave({ leaveType: "annual", numberOfDays: 4 }),
      leave({ leaveType: "annual", status: "REJECTED", numberOfDays: 5 }),
    ];
    render(<GeneralHistoryTab />);
    // Per type: casual 2 approved + 1 pending, annual 4 (the rejected 5 and the
    // cancelled 3 add nowhere). Total renders as there are two groups.
    expect(screen.getByText("Casual 3 days")).toBeTruthy();
    expect(screen.getByText("Annual 4 days")).toBeTruthy();
    expect(screen.getByText("Total: 7 days")).toBeTruthy();
  });

  it("groups sabbatical history by status with rejected and cancelled last", () => {
    state.leaves = [
      leave({ leaveType: "sabbatical", status: "CANCELLED", numberOfDays: 5 }),
      leave({ leaveType: "sabbatical", status: "REJECTED", numberOfDays: 4 }),
      leave({ leaveType: "sabbatical", status: "PENDING", numberOfDays: 3 }),
      leave({ leaveType: "sabbatical", status: "APPROVED", numberOfDays: 2 }),
    ];
    render(<SabbaticalHistoryTab />);
    const chips = screen
      .getAllByText(/ \d+ days?$/)
      .map((e) => e.textContent);
    expect(chips).toEqual([
      "Approved 2 days",
      "Pending 3 days",
      "Rejected 4 days",
      "Cancelled 5 days",
      "Total: 5 days",
    ]);
  });
});
