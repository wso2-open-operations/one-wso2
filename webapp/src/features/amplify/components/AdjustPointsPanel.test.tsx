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

const mutate = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useAdjustPoints: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess }),
}));

import AdjustPointsPanel from "./AdjustPointsPanel";

const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
const points = () => screen.getByLabelText(/^Points/);
const reason = () => screen.getByLabelText(/^Reason/);
const note = () => screen.getByLabelText(/^Note for Jane/);

function renderDialog(total: number | null = 1040, onClose = () => {}) {
  render(<AdjustPointsPanel employeeId="e-9" personName="Jane" firstName="Jane" total={total} onClose={onClose} />);
}

describe("AdjustPointsPanel", () => {
  beforeEach(() => {
    mutate.mockReset();
    showError.mockClear();
    showSuccess.mockClear();
  });

  it("previews a removal on the total", () => {
    renderDialog(1040);
    fireEvent.change(points(), { target: { value: "-2" } });
    expect(screen.getByRole("status").textContent).toContain("1,040 → 1,038");
  });

  it("previews an addition on the total", () => {
    renderDialog(990);
    fireEvent.change(points(), { target: { value: "25" } });
    expect(screen.getByRole("status").textContent).toContain("990 → 1,015");
  });

  it("shows only the change when the total isn't known", () => {
    renderDialog(null);
    fireEvent.change(points(), { target: { value: "5" } });
    expect(screen.getByRole("status").textContent).toContain("+5 points");
  });

  it.each(["0", "1.5", "10001", "-10001"])("refuses %j points", (value) => {
    renderDialog();
    fireEvent.change(points(), { target: { value } });
    fireEvent.change(reason(), { target: { value: "Other" } });
    expect(save().disabled).toBe(true);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(save());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("needs a reason as well as the points", () => {
    renderDialog();
    fireEvent.change(points(), { target: { value: "5" } });
    expect(save().disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: "Missed activity" } });
    expect(save().disabled).toBe(false);
  });

  it("sends the signed points and the trimmed reason for the person", () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    renderDialog(1040, onClose);
    fireEvent.change(points(), { target: { value: "-10000" } });
    fireEvent.change(reason(), { target: { value: "Duplicate of another activity" } });
    fireEvent.change(note(), { target: { value: " Same repost twice. " } });
    fireEvent.click(save());
    expect(mutate.mock.calls[0][0]).toEqual({
      employeeId: "e-9",
      points: -10000,
      reason: "Duplicate of another activity — Same repost twice.",
    });
    expect(showSuccess).toHaveBeenCalledWith("Saved: −10,000 points for Jane.");
    expect(onClose).toHaveBeenCalled();
  });

  it("explains a refused correction to the caller's own points", () => {
    mutate.mockImplementation((_v, opts: { onError: (e: unknown) => void }) =>
      opts.onError(new HttpError("u", 403, JSON.stringify({ status: 403, code: "SELF_REVIEW" }))),
    );
    renderDialog();
    fireEvent.change(points(), { target: { value: "5" } });
    fireEvent.change(reason(), { target: { value: "Other" } });
    fireEvent.click(save());
    expect(showError).toHaveBeenCalledWith("You can't correct your own points.");
  });
});
