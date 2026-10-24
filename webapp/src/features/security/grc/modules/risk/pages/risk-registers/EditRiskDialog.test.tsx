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

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RiskDetail, RiskTeam, UpdateRiskPayload } from "../../api/riskApi";
import EditRiskDialog from "./EditRiskDialog";
import { aggregatedRisk, riskDetail } from "./riskDetailFixture";

const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

const lookups: Record<string, unknown> = {
  "/risks/platforms": [
    { id: 1, name: "Choreo", status: "ACTIVE" },
    { id: 2, name: "Asgardeo", status: "ACTIVE" },
  ],
  "/risks/products": [
    { id: 1, name: "API Manager", status: "ACTIVE" },
    { id: 2, name: "Identity Server", status: "INACTIVE" },
    { id: 3, name: "Old Product", status: "INACTIVE" },
  ],
  "/risks/deployment-types": [
    { id: 1, name: "Private Cloud", status: "ACTIVE" },
    { id: 2, name: "SaaS", status: "ACTIVE" },
  ],
};

const requested = (): string[] =>
  authFetch.mock.calls.map(([u]) => String(u).replace("http://backend.test/api/v1", ""));

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: string) => {
    const path = String(input).replace("http://backend.test/api/v1", "");
    return new Response(JSON.stringify(path in lookups ? lookups[path] : []), { status: 200 });
  });
});

const sreTeam: RiskTeam = {
  id: 20,
  name: "Managed Services Team A",
  code: null,
  description: null,
  team_type: "ASSIGNMENT",
  register_template: "MANAGED_SERVICES",
  status: "ACTIVE",
};

function renderDialog(detail: RiskDetail, mode: "full" | "restricted" = "full") {
  const onSave = vi.fn<(payload: UpdateRiskPayload) => Promise<void>>().mockResolvedValue();
  render(
    <EditRiskDialog
      open
      detail={detail}
      mode={mode}
      assignmentTeams={[sreTeam]}
      users={[]}
      riskScores={[]}
      complianceRefs={[{ id: 1, name: "ISO 27001", description: null }]}
      onClose={() => {}}
      onSave={onSave}
    />,
  );
  return onSave;
}

const save = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole("button", { name: "Save Changes" }));
};

describe("EditRiskDialog — Managed Services risk (full edit)", () => {
  it("shows the customer read-only, with why, and no Compliance References", async () => {
    renderDialog(riskDetail());
    const customer = await screen.findByLabelText("Customer Name");
    expect(customer).toBeDisabled();
    expect(customer).toHaveValue("Bank One Sub (BANKONESUB)");
    expect(screen.getByText(/part of the risk code/i)).toBeInTheDocument();
    expect(screen.queryAllByText("Compliance References")).toHaveLength(0);
  });

  it("loads every product and deployment type, inactive ones included", async () => {
    renderDialog(riskDetail());
    await screen.findByRole("button", { name: "API Manager" });
    expect(requested()).toContain("/risks/products");
    expect(requested()).toContain("/risks/deployment-types");
  });

  it("keeps a product the risk already has after it was deactivated, marked, and offers no other inactive one", async () => {
    renderDialog(riskDetail());
    expect(await screen.findByRole("button", { name: "Identity Server (inactive)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API Manager" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Old Product/ })).not.toBeInTheDocument();
  });

  it("sends no template fields when none changed, and never compliance references", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(riskDetail());
    await screen.findByRole("button", { name: "API Manager" });
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    for (const key of [
      "platform_ids",
      "deployment_type_id",
      "product_ids",
      "environments",
      "compliance_reference_ids",
    ]) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it("sends the new sets for the fields that changed", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(riskDetail());
    await screen.findByRole("button", { name: "API Manager" });
    await user.click(screen.getByRole("button", { name: "Non-Production" }));
    await user.click(screen.getByRole("button", { name: "Identity Server (inactive)" })); // drop it
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    expect(payload.environments?.slice().sort()).toEqual(["NON_PRODUCTION", "PRODUCTION"]);
    expect(payload.product_ids).toEqual([1]);
    expect(payload).not.toHaveProperty("deployment_type_id");
  });

  it("changes the deployment type", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(riskDetail());
    await screen.findByRole("button", { name: "API Manager" });
    // The select isn't labelled for the accessibility tree, so find it by what it shows.
    await user.click(screen.getAllByRole("combobox").find((el) => /Private Cloud/.test(el.textContent ?? ""))!);
    await user.click(await screen.findByRole("option", { name: "SaaS" }));
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].deployment_type_id).toBe(2);
  });

  it("will not save with a required list emptied", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(riskDetail());
    await screen.findByRole("button", { name: "API Manager" });
    await user.click(screen.getByRole("button", { name: "Production" }));
    await save(user);
    expect(await screen.findByText("Select at least one environment")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("EditRiskDialog — other templates and modes", () => {
  it("shows Platform and Compliance References for an Aggregated risk, and sends changed platforms", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(aggregatedRisk());
    await screen.findByRole("button", { name: "Asgardeo" });
    expect(screen.queryByLabelText("Customer Name")).not.toBeInTheDocument();
    expect(screen.getAllByText("Compliance References").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Asgardeo" }));
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const payload = onSave.mock.calls[0][0];
    expect(payload.platform_ids?.slice().sort()).toEqual([1, 2]);
    expect(payload.compliance_reference_ids).toEqual([1]);
  });

  it("shows no template fields for a Standard risk, and fetches no lookups", async () => {
    const onSave = renderDialog(
      riskDetail({
        register_template: "STANDARD",
        customer: null,
        deployment_type: null,
        products: [],
        environments: [],
      }),
    );
    expect((await screen.findAllByText("Compliance References")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Customer Name")).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Platforms" })).not.toBeInTheDocument();
    expect(requested().filter((u) => u.startsWith("/risks/"))).toEqual([]);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("offers none of the template fields in restricted mode, after the owner has approved", async () => {
    renderDialog(
      riskDetail({ owner_first_approved_at: "2026-06-01", workflow_status: "APPROVED" }),
      "restricted",
    );
    expect((await screen.findAllByText("Implementation Date")).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Customer Name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Production" })).not.toBeInTheDocument();
    expect(requested().filter((u) => u.startsWith("/risks/"))).toEqual([]);
  });
});

describe("EditRiskDialog — Accepted By", () => {
  const acceptorSelect = () => screen.getByRole("combobox", { name: "Accepted By" });

  it("says a risk with no acceptor is not set yet, and sends nothing for it when saved untouched", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(riskDetail({ risk_acceptor: null }));
    await screen.findByRole("button", { name: "API Manager" });
    expect(screen.getByText(/Not set yet/)).toBeInTheDocument();
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].risk_acceptor).toBeUndefined();
  });

  it("sends the acceptor that was chosen", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(riskDetail({ risk_acceptor: null }));
    await screen.findByRole("button", { name: "API Manager" });
    await user.click(acceptorSelect());
    await user.click(await screen.findByRole("option", { name: "WSO2" }));
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].risk_acceptor).toBe("WSO2");
  });

  it("shows the recorded acceptor and no not-set hint", async () => {
    renderDialog(riskDetail({ risk_acceptor: "CUSTOMER" }));
    await screen.findByRole("button", { name: "API Manager" });
    expect(acceptorSelect()).toHaveTextContent("Customer");
    expect(screen.queryByText(/Not set yet/)).not.toBeInTheDocument();
  });

  it("is editable in restricted mode, after the owner has approved", async () => {
    const user = userEvent.setup();
    const onSave = renderDialog(
      riskDetail({ owner_first_approved_at: "2026-06-01", workflow_status: "APPROVED", risk_acceptor: null }),
      "restricted",
    );
    await user.click(await screen.findByRole("combobox", { name: "Accepted By" }));
    await user.click(await screen.findByRole("option", { name: "Customer" }));
    await save(user);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].risk_acceptor).toBe("CUSTOMER");
  });
});
