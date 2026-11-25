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

import ReversePointsPanel from "./ReversePointsPanel";

const entry: LedgerEntry = {
  reference: "ENG-1",
  employeeId: "e-9",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points: 2,
  createdAt: "2026-11-10T00:00:00Z",
};
const reverseButton = () => screen.getByRole("button", { name: /^Reverse · / }) as HTMLButtonElement;
const reason = () => screen.getByLabelText(/^Reason/);
const note = () => screen.getByLabelText(/^Note for Jane/);

describe("ReversePointsPanel", () => {
  beforeEach(() => {
    mutate.mockReset();
    showError.mockClear();
    showSuccess.mockClear();
  });

  it("shows the effect on the person's total before confirming", () => {
    render(<ReversePointsPanel firstName="Jane" entry={entry} personName="Jane" total={1040} onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("1,040 → 1,038");
    expect(screen.getByText(/Coins are never taken back/)).toBeTruthy();
  });

  it("shows the activity and its points, and the reversal on the button", () => {
    render(
      <ReversePointsPanel firstName="Nimal" entry={{ ...entry, campaignTitle: "KubeCon" }} personName="Nimal" total={10} onClose={() => {}} />,
    );
    expect(screen.getByRole("region", { name: "Reverse this activity" }).textContent).toContain("Reposted · +2");
    expect(screen.getByText("KubeCon · Nov 10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reverse · −2" })).toBeTruthy();
    expect(screen.getByLabelText("Note for Nimal (shown in their history)")).toBeTruthy();
  });

  it("adds back the points of a negative row", () => {
    render(
      <ReversePointsPanel firstName="Jane"
        entry={{ ...entry, sourceType: "ADJUSTMENT", action: null, points: -5 }}
        personName="Jane"
        total={95}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole("status").textContent).toContain("95 → 100");
  });

  it("shows only the change when the total isn't known", () => {
    render(<ReversePointsPanel firstName="Jane" entry={entry} personName="Jane" total={null} onClose={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("−2 points");
  });

  it("needs a reason", () => {
    render(<ReversePointsPanel firstName="Jane" entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    expect(reverseButton().disabled).toBe(true);
    fireEvent.click(reverseButton());
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.change(reason(), { target: { value: "No longer on LinkedIn" } });
    expect(reverseButton().disabled).toBe(false);
    expect(note().getAttribute("maxlength")).toBe(String(1000 - "No longer on LinkedIn".length - 3));
  });

  it("reverses the row by reference with the reason and the note", () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<ReversePointsPanel firstName="Jane" entry={entry} personName="Jane" total={10} onClose={onClose} />);
    fireEvent.change(reason(), { target: { value: "Duplicate of another activity" } });
    fireEvent.change(note(), { target: { value: "  You reposted this post twice; we kept the first one. " } });
    fireEvent.click(reverseButton());
    expect(mutate.mock.calls[0][0]).toEqual({
      reference: "ENG-1",
      employeeId: "e-9",
      reason: "Duplicate of another activity — You reposted this post twice; we kept the first one.",
    });
    expect(showSuccess).toHaveBeenCalledWith("Reversed: −2 points for Jane.");
    expect(onClose).toHaveBeenCalled();
  });

  it("explains a refused correction to the caller's own points", () => {
    mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("u", 403, JSON.stringify({ status: 403, code: "SELF_REVIEW" }))),
    );
    render(<ReversePointsPanel firstName="Jane" entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    fireEvent.change(reason(), { target: { value: "Other" } });
    fireEvent.click(reverseButton());
    expect(showError).toHaveBeenCalledWith("You can't correct your own points.");
  });
});
