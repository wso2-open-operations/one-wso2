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


import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ApprovalStep } from "@features/sales/cado2/approvals/api/approvalTypes";
import YourApprovalPanel from "./YourApprovalPanel";
import ApprovalReasons from "./ApprovalReasons";

const step = (over: Partial<ApprovalStep>): ApprovalStep => ({
  stepId: 1, role: "AREA_GM", roleLabel: "Area GM", branches: ["DISCOUNT", "COMMERCIAL"], dependsOn: [], triggers: [],
  status: "PENDING", requestedAt: null, actedAt: null, actedByEmail: null, comment: null, canAct: true, cantActReason: null, ...over,
});

// The Area GM example: v2 lowers the discount to 12%; the short term is unchanged.
const agm = step({
  triggers: [
    { rule: "DISCOUNT", branch: "DISCOUNT", lineNumber: 1,
      reason: "Line 1 · API Manager (Platform products): 12% discount is above the Regional Director's 10% limit",
      note: "Asked again: the discounts changed since v1 (line 1: 15% → 12%)" },
    { rule: "SHORT_TERM_NEW_CUSTOMER", branch: "COMMERCIAL", lineNumber: 0,
      reason: "New-customer term of 9 months is under 12 months", carriedFromVersion: 1 },
  ],
});
const cro = step({
  stepId: 2, role: "CRO", roleLabel: "CRO", branches: ["COMMERCIAL"], status: "APPROVED", canAct: false,
  actedAt: "2026-10-28T09:00:00Z", actedByEmail: "cro@wso2.com",
  carriedFrom: { versionNumber: 1, actedAt: "2026-10-28T09:00:00Z", actedByEmail: "cro@wso2.com" },
  triggers: [{ rule: "SHORT_TERM_NEW_CUSTOMER", branch: "COMMERCIAL", lineNumber: 0,
    reason: "New-customer term of 9 months is under 12 months", carriedFromVersion: 1 }],
});

// D119: a resubmission asks only what changed, and says so.
describe("resubmission carry-over", () => {
  it("asks the Area GM for the discount only, with why, and lists what they already approved", () => {
    render(<YourApprovalPanel steps={[agm, cro]} actionable={[agm]} onDecide={vi.fn()} />);
    const why = screen.getByRole("list", { name: "Why Area GM approves" });
    expect(within(why).getByText("Line 1 · API Manager")).toBeInTheDocument();
    expect(within(why).getByText("Asked again: the discounts changed since v1 (line 1: 15% → 12%)")).toBeInTheDocument();
    expect(within(why).queryByText(/9 months/)).toBeNull();

    expect(screen.getByText("Already approved in v1")).toBeInTheDocument();
    const done = screen.getByRole("list", { name: "Already approved" });
    expect(within(done).getByText(/New-customer term of 9 months is under 12 months/)).toBeInTheDocument();
  });

  it("tells Deal Desk what changed since the earlier version", () => {
    const dd = step({
      role: "DEAL_DESK", roleLabel: "Deal Desk", branches: [],
      triggers: [{ rule: "DEAL_DESK_REVIEW", branch: "ROOT", lineNumber: 0, reason: "Deal Desk reviews every quote",
        note: "Resubmitted after v1: the discounts changed" }],
    });
    render(<YourApprovalPanel steps={[dd, { ...agm, status: "WAITING", canAct: false }, cro]} actionable={[dd]} onDecide={vi.fn()} />);
    expect(screen.getByText("Resubmitted after v1: the discounts changed")).toBeInTheDocument();
    // The carried CRO and the Area GM's carried reason aren't points to check.
    expect(screen.queryByText(/9 months/)).toBeNull();
  });

  it("marks a carried step and a carried reason in the chain", () => {
    render(<ApprovalReasons steps={[{ ...agm, canAct: false }, cro]} />);
    const croItem = screen.getByRole("listitem", { name: "CRO" });
    expect(within(croItem).getByText("Already approved")).toBeInTheDocument();
    expect(within(croItem).getByText(/Carried over from v1 · approved by cro@wso2.com/)).toBeInTheDocument();

    const agmItem = screen.getByRole("listitem", { name: "Area GM" });
    expect(within(agmItem).getByText("· already approved in v1")).toBeInTheDocument();
    expect(within(agmItem).getByText("Asked again: the discounts changed since v1 (line 1: 15% → 12%)")).toBeInTheDocument();
  });
});
