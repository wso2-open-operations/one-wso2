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
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProcurementMe, PurchaseRequest } from "../../types";
import OverrideReview from "./OverrideReview";

const override = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false, isError: false, error: null as unknown }));
const showSuccess = vi.hoisted(() => vi.fn());
vi.mock("@context/notifications/NotificationsContext", () => ({ useNotifications: () => ({ showSuccess }) }));
vi.mock("../../api/useProcurement", () => ({ useOverrideRequest: () => override }));

const lead = { id: "lead@example.com", name: "Lead", email: "lead@example.com" };
const admin: ProcurementMe = { id: "pat@example.com", name: "Pat Kim", email: "pat@example.com", roles: ["procurement_user", "procurement_admin"], teamLead: lead, approvalExempt: false };
const request = (patch: Partial<PurchaseRequest> = {}): PurchaseRequest =>
  ({
    id: "7",
    status: "approved",
    requester: { id: "alex@example.com", name: "Alex Morgan", email: "alex@example.com" },
    teamLead: lead,
    teamLeadDecision: { decision: "approved", notes: "", decidedAt: "2026-11-01T00:00:00Z", decidedBy: "lead@example.com", isOverride: false },
    ...patch,
  }) as PurchaseRequest;

beforeEach(() => {
  override.mutate.mockReset().mockImplementation((_input: unknown, options?: { onSuccess?: () => void }) => options?.onSuccess?.());
  showSuccess.mockReset();
  override.isPending = false;
  override.isError = false;
  override.error = null;
});

describe("OverrideReview", () => {
  it("is offered to a Procurement admin for a request its team lead approved", () => {
    render(<OverrideReview request={request()} me={admin} />);
    expect(screen.getByRole("heading", { name: "Procurement admin review" })).toBeInTheDocument();
  });

  it.each([
    ["someone who is not an admin", { me: { ...admin, roles: ["procurement_user"] }, patch: {} }],
    ["a request that is assigned", { me: admin, patch: { status: "assigned" as const } }],
    ["a request that is rejected", { me: admin, patch: { status: "rejected" as const } }],
    ["the admin's own request", { me: admin, patch: { requester: { id: "pat@example.com", name: "Pat Kim", email: "Pat@example.com" } } }],
    ["an approval an admin already confirmed", { me: admin, patch: { teamLeadDecision: { decision: "approved" as const, notes: "", decidedAt: "2026-11-02T00:00:00Z", decidedBy: "pat@example.com", isOverride: true } } }],
  ])("is not offered for %s", (_what, { me, patch }) => {
    render(<OverrideReview request={request(patch)} me={me} />);
    expect(screen.queryByRole("heading", { name: "Procurement admin review" })).toBeNull();
  });

  it("needs a justification before either decision can be sent", async () => {
    const user = userEvent.setup();
    render(<OverrideReview request={request()} me={admin} />);
    expect(screen.getByRole("button", { name: "Confirm approval" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject request" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Justification/ }), "   ");
    expect(screen.getByRole("button", { name: "Confirm approval" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /Justification/ }), "Within budget");
    expect(screen.getByRole("button", { name: "Confirm approval" })).toBeEnabled();
    expect(override.mutate).not.toHaveBeenCalled();
  });

  it("confirms the approval with the justification and says so", async () => {
    const user = userEvent.setup();
    render(<OverrideReview request={request()} me={admin} />);
    await user.type(screen.getByRole("textbox", { name: /Justification/ }), "Within budget");
    await user.click(screen.getByRole("button", { name: "Confirm approval" }));
    expect(override.mutate).toHaveBeenCalledWith({ decision: "approved", justification: "Within budget", comment: "" }, expect.any(Object));
    expect(showSuccess).toHaveBeenCalledWith("The approval has been confirmed.");
  });

  it("rejects the request with the justification and the note, and says the requester is emailed", async () => {
    const user = userEvent.setup();
    render(<OverrideReview request={request()} me={admin} />);
    await user.type(screen.getByRole("textbox", { name: /Justification/ }), "Over budget");
    await user.type(screen.getByRole("textbox", { name: /Note for the requester/ }), "Please resubmit");
    await user.click(screen.getByRole("button", { name: "Reject request" }));
    expect(override.mutate).toHaveBeenCalledWith({ decision: "rejected", justification: "Over budget", comment: "Please resubmit" }, expect.any(Object));
    expect(showSuccess).toHaveBeenCalledWith("The request has been rejected. An email notification has been sent to the requester.");
  });

  it("shows why a decision failed and keeps what was typed", async () => {
    const user = userEvent.setup();
    override.isError = true;
    override.error = new Error("This approval was already confirmed.");
    render(<OverrideReview request={request()} me={admin} />);
    await user.type(screen.getByRole("textbox", { name: /Justification/ }), "Within budget");
    expect(screen.getByText("This approval was already confirmed.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Justification/ })).toHaveValue("Within budget");
  });

  it("locks the form while a decision is being sent", () => {
    override.isPending = true;
    render(<OverrideReview request={request()} me={admin} />);
    expect(screen.getByRole("textbox", { name: /Justification/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject request" })).toBeDisabled();
  });
});
