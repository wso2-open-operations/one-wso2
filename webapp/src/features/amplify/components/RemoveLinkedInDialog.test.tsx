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

const mutate = vi.fn();
const showSuccess = vi.fn();
vi.mock("../api/useAmplifyMutations", () => ({ useRemoveLinkedInConnection: () => ({ mutate, isPending: false }) }));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: vi.fn(), showSuccess }),
}));

import RemoveLinkedInDialog from "./RemoveLinkedInDialog";

describe("RemoveLinkedInDialog", () => {
  const onClose = vi.fn();
  beforeEach(() => {
    mutate.mockReset();
    showSuccess.mockClear();
    onClose.mockClear();
  });

  it("explains what is deleted and removes nothing until confirmed", () => {
    render(<RemoveLinkedInDialog open onClose={onClose} />);
    expect(screen.getByText("Remove LinkedIn connection")).toBeTruthy();
    expect(screen.getByText(/end its access to your LinkedIn account/)).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("removes the connection and closes on confirm", () => {
    mutate.mockImplementation((_v, opts) => opts.onSuccess());
    render(<RemoveLinkedInDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove connection" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(showSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Cancel closes without removing", () => {
    render(<RemoveLinkedInDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mutate).not.toHaveBeenCalled();
  });
});
