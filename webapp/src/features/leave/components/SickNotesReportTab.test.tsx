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
import userEvent from "@testing-library/user-event";

const state = {
  notes: [] as Record<string, unknown>[],
  isError: false,
  error: null as Error | null,
  canRead: true,
};

const calls: { start: string; end: string; enabled?: boolean }[] = [];
const showError = vi.fn();
const download = vi.fn();

vi.mock("../api/useLeaveData", () => ({
  useSickNotes: (start: string, end: string, enabled?: boolean) => {
    calls.push({ start, end, enabled });
    return {
      data: state.isError ? undefined : state.notes,
      isLoading: false,
      isFetching: false,
      isError: state.isError,
      error: state.error,
    };
  },
}));
vi.mock("../api/useLeaveGate", () => ({
  useLeaveGate: () => ({ canReadSickNotes: state.canRead }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "tok" }));
vi.mock("../util/sickNoteDownload", () => ({
  downloadSickNote: (...a: unknown[]) => download(...a),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError }),
}));

const { default: SickNotesReportTab } = await import("./SickNotesReportTab");

const DOWNLOAD_ANNA = "Download sick note for anna@wso2.com, 2026-10-05\u20132026-10-06";

const live = {
  leaveId: 11,
  email: "anna@wso2.com",
  startDate: "2026-10-05",
  endDate: "2026-10-06",
  numberOfDays: 2,
  status: "APPROVED",
  uploadedAt: "2026-10-06T08:00:00Z",
  deletedAt: null,
  sizeBytes: 1000,
  contentType: "application/pdf",
};
const deleted = {
  ...live,
  leaveId: 12,
  email: "ben@wso2.com",
  deletedAt: "2026-10-20T09:00:00Z",
};

beforeEach(() => {
  state.notes = [live, deleted];
  state.isError = false;
  state.error = null;
  state.canRead = true;
  calls.length = 0;
  showError.mockReset();
  download.mockReset();
  download.mockResolvedValue(undefined);
});

describe("SickNotesReportTab", () => {
  it("lists the notes, defaulting to the current month", () => {
    render(<SickNotesReportTab />);
    expect(screen.getByText("anna@wso2.com")).toBeInTheDocument();
    expect(screen.getByText("ben@wso2.com")).toBeInTheDocument();
    const last = calls[calls.length - 1];
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(last.start).toBe(`${ym}-01`);
    expect(last.end.startsWith(ym)).toBe(true);
    expect(last.enabled).toBe(true);
  });

  it("does not fetch when the gate says no", () => {
    state.canRead = false;
    render(<SickNotesReportTab />);
    expect(calls.every((c) => c.enabled === false)).toBe(true);
  });

  it("filters by employee email in the browser", async () => {
    render(<SickNotesReportTab />);
    await userEvent.type(screen.getByRole("textbox", { name: "Employee email" }), "ben");
    expect(screen.queryByText("anna@wso2.com")).not.toBeInTheDocument();
    expect(screen.getByText("ben@wso2.com")).toBeInTheDocument();
  });

  it("offers Download for a live note and Deleted on for a deleted one", async () => {
    render(<SickNotesReportTab />);
    expect(screen.getAllByRole("button", { name: /^Download sick note for/ })).toHaveLength(1);
    expect(screen.getByText(/Deleted on 2026-10-20/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_ANNA }));
    expect(download).toHaveBeenCalledWith(11, "tok");
  });

  it("names each Download for the employee and dates", () => {
    render(<SickNotesReportTab />);
    expect(screen.getByRole("button", { name: DOWNLOAD_ANNA })).toBeInTheDocument();
  });

  it("downloads once however fast it is clicked, and re-enables afterwards", async () => {
    let finish!: () => void;
    download.mockReturnValue(new Promise<void>((r) => (finish = r)));
    render(<SickNotesReportTab />);
    const btn = screen.getByRole("button", { name: DOWNLOAD_ANNA });
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(btn).toBeDisabled();
    finish();
    await waitFor(() => expect(btn).toBeEnabled());
  });

  it("shows the backend's message when a download fails", async () => {
    download.mockRejectedValue(new Error("Note was deleted."));
    render(<SickNotesReportTab />);
    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_ANNA }));
    expect(showError).toHaveBeenCalledWith("Note was deleted.");
  });

  it("shows an Alert on a 403", () => {
    state.isError = true;
    state.error = new Error("Forbidden");
    render(<SickNotesReportTab />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("explains an end date before the start rather than showing an empty table", () => {
    render(<SickNotesReportTab />);
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2099-01-01" } });
    expect(screen.getByText("End date must be after start date")).toBeInTheDocument();
    expect(calls[calls.length - 1].enabled).toBe(false);
  });
});
