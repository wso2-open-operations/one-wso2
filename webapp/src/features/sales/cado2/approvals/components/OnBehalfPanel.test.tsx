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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ApprovalStep } from "@features/sales/cado2/approvals/api/approvalTypes";
import OnBehalfPanel from "./OnBehalfPanel";
import ApprovalReasons from "./ApprovalReasons";

const mutate = vi.fn();
const notify = vi.fn();
vi.mock("@features/sales/cado2/approvals/api/useApprovalApi", () => ({
  useApproveOnBehalf: () => ({ mutate, reset: vi.fn(), isPending: false, error: null }),
}));
vi.mock("@features/sales/cado2/components/toast/toastContext", () => ({ useCado2Toast: () => notify }));

const step = (over: Partial<ApprovalStep>): ApprovalStep => ({
  stepId: 7, role: "AREA_GM", roleLabel: "Area GM · NA", branches: ["DISCOUNT"], dependsOn: [], triggers: [],
  status: "PENDING", requestedAt: "2026-10-27T09:00:00Z", actedAt: null, actedByEmail: null, comment: null,
  canAct: false, cantActReason: null, ...over,
});

// D120: Deal Desk approves a stuck step for its approver, with a reason.
describe("approve on behalf", () => {
  beforeEach(() => {
    mutate.mockReset();
    notify.mockReset();
  });

  it("lists only the steps Deal Desk may approve for, and asks for a reason", async () => {
    const user = userEvent.setup();
    render(
      <OnBehalfPanel
        quoteId={5}
        versionNumber={2}
        steps={[step({ canApproveOnBehalf: true }), step({ stepId: 8, role: "CFO", roleLabel: "CFO", canApproveOnBehalf: false })]}
      />,
    );
    const panel = screen.getByLabelText("Approve on behalf");
    expect(within(panel).getByText("Area GM · NA")).toBeInTheDocument();
    expect(within(panel).queryByText("CFO")).toBeNull();

    await user.click(within(panel).getByRole("button", { name: "Approve on behalf…" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Approve on behalf of Area GM · NA?")).toBeInTheDocument();
    const confirm = dialog.getByRole("button", { name: "Approve on behalf" });
    expect(confirm).toBeDisabled();
    await user.type(dialog.getByLabelText(/Why are you approving for them/), "On leave until 12 Nov");
    await user.click(confirm);
    expect(mutate).toHaveBeenCalledWith({ quoteId: 5, version: 2, stepId: 7, reason: "On leave until 12 Nov" }, expect.anything());
  });

  it("shows nothing when no step can be approved for", () => {
    const { container } = render(<OnBehalfPanel quoteId={5} versionNumber={2} steps={[step({})]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says in the chain that Deal Desk approved on the approver's behalf", () => {
    render(
      <ApprovalReasons
        steps={[step({ status: "APPROVED", approvedOnBehalf: true, actedByEmail: "dd@wso2.com", actedAt: "2026-10-30T09:00:00Z",
          comment: "On leave until 12 Nov" })]}
      />,
    );
    const item = screen.getByRole("listitem", { name: "Area GM · NA" });
    expect(within(item).getByText(/Approved by dd@wso2.com \(Deal Desk\) on behalf of Area GM · NA/)).toBeInTheDocument();
    expect(within(item).getByText(/On leave until 12 Nov/)).toBeInTheDocument();
  });
});
