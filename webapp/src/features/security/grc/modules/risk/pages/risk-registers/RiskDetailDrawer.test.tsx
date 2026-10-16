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

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiskPrivilege } from "../../privileges";
import { ActionFooter, RegisterDetails } from "./RiskDetailDrawer";
import { aggregatedRisk, riskDetail, standardRisk } from "./riskDetailFixture";
import { canCancelRisk } from "./utils";

// Heavy children of the drawer reach for the network; these tests only render
// the pieces below, which do not.
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({ useAuthApiClient: () => vi.fn() }));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

describe("RegisterDetails", () => {
  it("shows a Managed Services risk's customer, deployment type, products and environments", () => {
    render(<RegisterDetails detail={riskDetail({ environments: ["PRODUCTION", "NON_PRODUCTION", "DR"] })} />);
    expect(screen.getByText("Managed Services Details")).toBeInTheDocument();
    expect(screen.getByText("Bank One Sub (BANKONESUB)")).toBeInTheDocument();
    expect(screen.getByText("Private Cloud")).toBeInTheDocument();
    expect(screen.getByText("API Manager")).toBeInTheDocument();
    // A deactivated product still shows on the risk that carries it.
    expect(screen.getByText("Identity Server")).toBeInTheDocument();
    for (const env of ["Production", "Non-Production", "DR"]) expect(screen.getByText(env)).toBeInTheDocument();
  });

  it("shows an Aggregated risk's platforms", () => {
    render(<RegisterDetails detail={aggregatedRisk()} />);
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Choreo")).toBeInTheDocument();
    expect(screen.queryByText("Customer")).not.toBeInTheDocument();
  });

  it("says so when an Aggregated risk has no platform recorded", () => {
    render(<RegisterDetails detail={{ ...aggregatedRisk(), platforms: [] }} />);
    expect(screen.getByText("No platform recorded.")).toBeInTheDocument();
  });

  it("shows nothing for a Standard risk", () => {
    const { container } = render(<RegisterDetails detail={standardRisk()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("canCancelRisk", () => {
  it("allows cancelling while awaiting the first owner approval", () => {
    expect(canCancelRisk("PENDING_RISK_OWNER_APPROVAL", null)).toBe(true);
  });

  it("allows cancelling a rejected risk only if no owner has ever approved it", () => {
    expect(canCancelRisk("PENDING_REVISION", null)).toBe(true);
    expect(canCancelRisk("PENDING_REVISION", "")).toBe(true);
    expect(canCancelRisk("PENDING_REVISION", "2026-09-01T10:00:00Z")).toBe(false);
  });

  it("allows nothing once the risk is live", () => {
    for (const status of ["APPROVED", "PENDING_COMPLIANCE_REVIEW", "CLOSED", "PENDING_AMENDMENT"]) {
      expect(canCancelRisk(status, null)).toBe(false);
    }
  });
});

describe("ActionFooter in PENDING_REVISION", () => {
  const actions = {
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onResubmit: vi.fn(),
  } as unknown as Parameters<typeof ActionFooter>[0]["actions"];

  const footer = (props: { ownerFirstApprovedAt: string | null; privileges?: string[]; isAssigner?: boolean }) =>
    render(
      <ActionFooter
        status="PENDING_REVISION"
        ownerFirstApprovedAt={props.ownerFirstApprovedAt}
        actions={actions}
        disabled={false}
        can={(p) =>
          (props.privileges ?? [RiskPrivilege.UpdateRisk, RiskPrivilege.SubmitRisk, RiskPrivilege.CancelRisk]).includes(
            p,
          )
        }
        actionPlans={[]}
        isOverdue={false}
        isRiskOwner={false}
        isRiskAssigner={props.isAssigner ?? true}
        isManagementApprover={false}
        hasOpenEscalation={false}
      />,
    );

  it("offers Cancel Risk next to Edit and Resubmit when the risk was never owner-approved", () => {
    footer({ ownerFirstApprovedAt: null });
    expect(screen.getByRole("button", { name: "Cancel Risk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Risk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resubmit" })).toBeInTheDocument();
  });

  it("does not offer it once an owner has approved the risk", () => {
    footer({ ownerFirstApprovedAt: "2026-09-01T10:00:00Z" });
    expect(screen.queryByRole("button", { name: "Cancel Risk" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resubmit" })).toBeInTheDocument();
  });

  it("does not offer it without the cancel privilege, or to someone who is not the assigner", () => {
    const { unmount } = footer({
      ownerFirstApprovedAt: null,
      privileges: [RiskPrivilege.UpdateRisk, RiskPrivilege.SubmitRisk],
    });
    expect(screen.queryByRole("button", { name: "Cancel Risk" })).not.toBeInTheDocument();
    unmount();
    footer({ ownerFirstApprovedAt: null, isAssigner: false });
    expect(screen.queryByRole("button", { name: "Cancel Risk" })).not.toBeInTheDocument();
  });
});
