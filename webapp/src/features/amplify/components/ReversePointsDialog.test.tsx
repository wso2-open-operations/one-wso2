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
import { fireEvent, render, screen } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { LedgerEntry } from "../api/amplifyTypes";

const mutate = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useReversePoints: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess }),
}));

import ReversePointsDialog from "./ReversePointsDialog";

const entry: LedgerEntry = {
  reference: "ENG-1",
  employeeId: "e-9",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points: 2,
  createdAt: "2026-11-10T00:00:00Z",
};
const reverseButton = () => screen.getByRole("button", { name: "Reverse" }) as HTMLButtonElement;
const reason = () => screen.getByLabelText(/Reason/);

describe("ReversePointsDialog", () => {
  beforeEach(() => {
    mutate.mockReset();
    showError.mockClear();
    showSuccess.mockClear();
  });

  it("shows the effect on the person's total before confirming", () => {
    render(<ReversePointsDialog entry={entry} personName="Jane" total={1040} onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("1,040 → 1,038");
    expect(screen.getByText(/Your reason is shown in the person's history/)).toBeTruthy();
  });

  it("adds back the points of a negative row", () => {
    render(
      <ReversePointsDialog
        entry={{ ...entry, sourceType: "ADJUSTMENT", action: null, points: -5 }}
        personName="Jane"
        total={95}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("95 → 100");
  });

  it("shows only the change when the total isn't known", () => {
    render(<ReversePointsDialog entry={entry} personName="Jane" total={null} onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("−2 points");
  });

  it("needs a reason", () => {
    render(<ReversePointsDialog entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    expect(reverseButton().disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: "   " } });
    expect(reverseButton().disabled).toBe(true);
    fireEvent.click(reverseButton());
    expect(mutate).not.toHaveBeenCalled();
    expect(reason().getAttribute("maxlength")).toBe("1000");
  });

  it("reverses the row by reference with the trimmed reason", () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<ReversePointsDialog entry={entry} personName="Jane" total={10} onClose={onClose} />);
    fireEvent.change(reason(), { target: { value: "  Counted twice " } });
    fireEvent.click(reverseButton());
    expect(mutate.mock.calls[0][0]).toEqual({ reference: "ENG-1", employeeId: "e-9", reason: "Counted twice" });
    expect(showSuccess).toHaveBeenCalledWith("Reversed: −2 points for Jane.");
    expect(onClose).toHaveBeenCalled();
  });

  it("explains a refused correction to the caller's own points", () => {
    mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("u", 403, JSON.stringify({ status: 403, code: "SELF_REVIEW" }))),
    );
    render(<ReversePointsDialog entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    fireEvent.change(reason(), { target: { value: "x" } });
    fireEvent.click(reverseButton());
    expect(showError).toHaveBeenCalledWith("You can't correct your own points.");
  });
});
