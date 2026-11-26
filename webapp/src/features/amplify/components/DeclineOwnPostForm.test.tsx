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
import type { ExternalShare } from "../api/amplifyTypes";

const mutate = vi.fn();
const showSuccess = vi.fn();
const showError = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useDeclineExternalShare: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError, showSuccess }),
}));

import DeclineOwnPostForm from "./DeclineOwnPostForm";

const share = { id: "x-1", employeeId: "e-1", status: "PENDING" } as ExternalShare;
const declineButton = () => screen.getByRole("button", { name: "Decline with reason" }) as HTMLButtonElement;
const message = () => screen.getByLabelText(/Message/);

describe("DeclineOwnPostForm", () => {
  beforeEach(() => {
    mutate.mockReset();
    showSuccess.mockClear();
  });

  it("offers the four reasons and needs one before declining", () => {
    render(<DeclineOwnPostForm share={share} firstName="Jane" onClose={() => {}} />);
    expect(screen.getByRole("group", { name: "Decline this post" })).toBeTruthy();
    for (const r of ["Not about Choreo Labs", "Not their own post", "Already rewarded", "Other"]) {
      expect(screen.getByRole("radio", { name: r })).toBeTruthy();
    }
    expect(declineButton().disabled).toBe(true);
    fireEvent.click(declineButton());
    expect(mutate).not.toHaveBeenCalled();
  });

  it("addresses the message to the person by first name", () => {
    render(<DeclineOwnPostForm share={share} firstName="Ayesha" onClose={() => {}} />);
    expect(screen.getByLabelText("Message to Ayesha (optional)")).toBeTruthy();
  });

  it("sends the chosen reason alone when there is no message", () => {
    render(<DeclineOwnPostForm share={share} firstName="Jane" onClose={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Not their own post" }));
    expect((screen.getByRole("radio", { name: "Not their own post" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(declineButton());
    expect(mutate.mock.calls[0][0]).toEqual({ id: "x-1", reason: "Not their own post" });
  });

  it("adds the message after a dash", () => {
    render(<DeclineOwnPostForm share={share} firstName="Jane" onClose={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Already rewarded" }));
    fireEvent.change(message(), { target: { value: " Paid in October. " } });
    fireEvent.click(declineButton());
    expect(mutate.mock.calls[0][0]).toEqual({ id: "x-1", reason: "Already rewarded — Paid in October." });
  });

  it("caps the message so reason and message stay within 1000 characters", () => {
    render(<DeclineOwnPostForm share={share} firstName={null} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    expect(message().getAttribute("maxlength")).toBe(String(1000 - "Other".length - 3));
  });

  it("tells the list and closes once declined", () => {
    const onClose = vi.fn();
    const onDeclined = vi.fn();
    mutate.mockImplementation((_v, opts: { onSuccess: () => void }) => opts.onSuccess());
    render(<DeclineOwnPostForm share={share} firstName="Jane" onClose={onClose} onDeclined={onDeclined} />);
    fireEvent.click(screen.getByRole("radio", { name: "Other" }));
    fireEvent.click(declineButton());
    expect(showSuccess).toHaveBeenCalledWith("Post declined.");
    expect(onDeclined).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("Cancel closes without declining", () => {
    const onClose = vi.fn();
    render(<DeclineOwnPostForm share={share} firstName="Jane" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });
});
