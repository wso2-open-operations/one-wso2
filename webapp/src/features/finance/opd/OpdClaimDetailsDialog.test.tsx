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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { OpdClaim } from "./opdTypes";

vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("./useOpdMutations", () => ({
  useOpdClaimStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

const { NotificationsProvider } = await import("@context/notifications/NotificationsContext");
const { OpdClaimDetailsDialog } = await import("./OpdClaimDetailsDialog");

const pendingClaim = (id: string): OpdClaim => ({
  id,
  transactions: [],
  employeeEmail: "someone@wso2.com",
  statusDetails: {
    status: "PENDING",
    financeApproverEmail: null,
    financeApprovedDate: null,
    financeRejectedDate: null,
  },
  createdDate: "2026-10-01T00:00:00Z",
  totalAmount: 100,
});

const dialog = (claim: OpdClaim) => (
  <NotificationsProvider>
    <OpdClaimDetailsDialog claim={claim} onClose={() => {}} review />
  </NotificationsProvider>
);

describe("OpdClaimDetailsDialog", () => {
  it("drops a half-typed rejection when another claim is opened", async () => {
    const { rerender } = render(dialog(pendingClaim("A")));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    await userEvent.type(screen.getByPlaceholderText("Reason for rejection…"), "Missing bill");

    rerender(dialog(pendingClaim("B")));

    expect(screen.queryByPlaceholderText("Reason for rejection…")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByPlaceholderText("Reason for rejection…")).toHaveValue("");
  });
});
