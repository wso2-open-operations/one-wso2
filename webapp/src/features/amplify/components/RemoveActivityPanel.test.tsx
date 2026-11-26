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
vi.mock("../api/useAmplifyMutations", () => ({ useRemoveActivity: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess }),
}));

import RemoveActivityPanel, { REMOVAL_HELP } from "./RemoveActivityPanel";

const entry: LedgerEntry = {
  reference: "AMP-1",
  employeeId: "e-9",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points: 2,
  createdAt: "2026-11-10T00:00:00Z",
  campaignTitle: "KubeCon",
};
const removeButton = () => screen.getByRole("button", { name: /^Remove · / }) as HTMLButtonElement;
const reason = () => screen.getByLabelText(/^Reason/);
const note = () => screen.getByLabelText(/^Note/);

describe("RemoveActivityPanel", () => {
  beforeEach(() => {
    mutate.mockReset();
    showError.mockClear();
    showSuccess.mockClear();
  });

  it("shows the activity, the four reason codes, what the person sees, and the effect", () => {
    render(<RemoveActivityPanel entry={entry} personName="Jane" total={1040} onClose={() => {}} />);
    expect(screen.getByRole("region", { name: "Remove invalid activity" })).toBeTruthy();
    expect(screen.getByText("Reposted · +2")).toBeTruthy();
    const options = Array.from((reason() as HTMLSelectElement).options).map((o) => o.textContent);
    expect(options).toEqual(["Choose a reason", "Duplicate", "Not a real repost", "Spam", "Other"]);
    expect(screen.getByText(REMOVAL_HELP)).toBeTruthy();
    expect(REMOVAL_HELP).toContain("Removed after review by the PO team");
    expect(screen.getByRole("status").textContent).toContain("1,040 → 1,038");
    expect(removeButton().textContent).toBe("Remove · −2");
  });

  it("waits for a reason before it can be confirmed", () => {
    render(<RemoveActivityPanel entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    expect(removeButton().disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: "SPAM" } });
    expect(removeButton().disabled).toBe(false);
  });

  it("asks for a note when the reason is Other", () => {
    render(<RemoveActivityPanel entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    fireEvent.change(reason(), { target: { value: "OTHER" } });
    expect(removeButton().disabled).toBe(true);
    expect(screen.getByText("(required for Other; PO team only)")).toBeTruthy();
    fireEvent.change(note(), { target: { value: "  Posted from a test account " } });
    fireEvent.click(removeButton());
    expect(mutate.mock.calls[0][0]).toEqual({
      reference: "AMP-1",
      employeeId: "e-9",
      reasonCode: "OTHER",
      note: "Posted from a test account",
    });
  });

  it("sends a code without a note when none is given, then closes and says so", () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<RemoveActivityPanel entry={entry} personName="Jane Doe" total={10} onClose={onClose} />);
    fireEvent.change(reason(), { target: { value: "DUPLICATE" } });
    fireEvent.click(removeButton());
    expect(mutate.mock.calls[0][0]).toEqual({ reference: "AMP-1", employeeId: "e-9", reasonCode: "DUPLICATE" });
    expect(showSuccess).toHaveBeenCalledWith("Removed: −2 points for Jane Doe.");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("explains a refused removal", () => {
    const fail = (code: string, status = 409) =>
      mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
        opts.onError(new HttpError("/x", status, JSON.stringify({ status, code }))),
      );
    render(<RemoveActivityPanel entry={entry} personName="Jane" total={10} onClose={() => {}} />);
    fireEvent.change(reason(), { target: { value: "SPAM" } });
    for (const [code, status, message] of [
      ["ALREADY_REVERSED", 409, "This activity has already been reversed or removed. Reload to see where it is now."],
      ["NOT_REMOVABLE", 409, "Only a LinkedIn activity can be removed. Reverse or adjust this one instead."],
      ["SELF_REVIEW", 403, "You can't remove your own activity."],
      ["REASON_REQUIRED", 422, "Pick a reason, and add a note when it's Other."],
    ] as const) {
      fail(code, status);
      fireEvent.click(removeButton());
      expect(showError).toHaveBeenLastCalledWith(message);
    }
  });
});
