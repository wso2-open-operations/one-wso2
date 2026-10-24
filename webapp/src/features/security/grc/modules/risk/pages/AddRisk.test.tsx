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

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AddRisk from "./AddRisk";

// The page talks to the backend only through the shim's fetch, so a fake of it
// stands in for the whole backend and records every request.
const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));

const registers = [
  { id: 1, name: "Asgardeo", code: "ASG", register_template: "STANDARD" },
  { id: 2, name: "Managed Services", code: "MS", register_template: "MANAGED_SERVICES" },
  { id: 3, name: "WSO2 Cloud", code: "WSO2CLOUD", register_template: "AGGREGATED" },
].map((t) => ({ ...t, description: null, team_type: "BOTH", status: "ACTIVE" }));

const sreTeam = {
  id: 20,
  name: "Managed Services Team A",
  code: null,
  description: null,
  team_type: "ASSIGNMENT",
  register_template: "MANAGED_SERVICES",
  status: "ACTIVE",
};
const legalTeam = {
  id: 21,
  name: "Legal",
  code: null,
  description: null,
  team_type: "ASSIGNMENT",
  register_template: "STANDARD",
  status: "ACTIVE",
};

const answers: Record<string, unknown> = {
  "/risks/teams?type=SOURCE_REGISTER": registers,
  "/risks/scores": [],
  "/risks/compliance-references": [{ id: 1, name: "ISO 27001", description: null }],
  "/risks/categories": [{ id: 1, name: "Secrets", description: null }],
  "/risks/platforms?status=ACTIVE": [
    { id: 1, name: "Choreo", status: "ACTIVE" },
    { id: 2, name: "Asgardeo", status: "ACTIVE" },
  ],
  "/risks/customers?status=ACTIVE": [{ id: 1, name: "Bank One Sub", code: "BANKONESUB", status: "ACTIVE" }],
  "/risks/products?status=ACTIVE": [{ id: 1, name: "API Manager", status: "ACTIVE" }],
  "/risks/deployment-types?status=ACTIVE": [{ id: 1, name: "Private Cloud", status: "ACTIVE" }],
  "/me/profile": { user_id: 7, first_name: "Test", last_name: "User" },
};

const urls = (): string[] => authFetch.mock.calls.map(([u]) => String(u).replace("http://backend.test/api/v1", ""));
const callsMatching = (fragment: string): string[] => urls().filter((u) => u.includes(fragment));

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockImplementation(async (input: string) => {
    const path = String(input).replace("http://backend.test/api/v1", "");
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (path.startsWith("/risks/teams?type=SOURCE_REGISTER")) return json(registers);
    if (path.startsWith("/risks/teams?type=ASSIGNMENT")) {
      return json([sreTeam, legalTeam]);
    }
    if (path.startsWith("/risks/next-sequence-id"))
      return json({ next_sequence_id: path.includes("customer_id=1") ? 4 : 2 });
    return json(path in answers ? answers[path] : []);
  });
});

async function chooseRegister(user: ReturnType<typeof userEvent.setup>, name: RegExp): Promise<void> {
  const trigger = screen
    .getAllByRole("combobox")
    .find((el) => /select a register|asgardeo|managed services|wso2 cloud/i.test(el.textContent ?? ""));
  if (!trigger) throw new Error("source register select not found");
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name }));
}

describe("Add Risk — register templates", () => {
  it("shows the original fields for a Standard register, with Compliance Reference", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /Asgardeo/);
    expect(screen.getByRole("button", { name: "ISO 27001" })).toBeInTheDocument();
    expect(screen.queryByText("Customer Name")).not.toBeInTheDocument();
    expect(screen.queryByText("Platform")).not.toBeInTheDocument();
  });

  it("shows Platform for an Aggregated register", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /WSO2 Cloud/);
    expect(await screen.findByRole("button", { name: "Choreo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ISO 27001" })).toBeInTheDocument();
    expect(screen.queryByText("Customer Name")).not.toBeInTheDocument();
  });

  it("shows the Managed Services fields and drops Compliance Reference", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /Managed Services/);
    expect(await screen.findByText("Customer Name")).toBeInTheDocument();
    expect(screen.getByText("Deployment Type")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "API Manager" })).toBeInTheDocument();
    for (const env of ["Production", "Non-Production", "DR"]) {
      expect(screen.getByRole("button", { name: env })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "ISO 27001" })).not.toBeInTheDocument();
  });

  it("says so when the assignment teams fail to load", async () => {
    const ok = authFetch.getMockImplementation()!;
    authFetch.mockImplementation(async (input: string) =>
      String(input).includes("type=ASSIGNMENT") ? new Response("{}", { status: 500 }) : ok(input),
    );
    render(<AddRisk />);
    expect(await screen.findByText("Failed to load assignment teams. Please refresh the page.")).toBeInTheDocument();
  });

  it("fetches one assignment team list for every register, not one per register", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await waitFor(() => expect(callsMatching("type=ASSIGNMENT")).toHaveLength(1));
    await chooseRegister(user, /Managed Services/);
    expect(callsMatching("type=ASSIGNMENT")).toHaveLength(1);
    expect(callsMatching("for_register")).toHaveLength(0);
  });

  it("asks for the customer before it shows the risk code, since the code contains it", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /Managed Services/);
    const customer = await screen.findByText("Customer Name");
    const code = screen.getByText(/-MS-CUSTOMER-Q\d-####/);
    expect(customer.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Choose a customer above/)).toBeInTheDocument();
  });

  it("previews the risk code per customer, asking the backend only once a customer is chosen", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /Managed Services/);
    await screen.findByText("Customer Name");
    expect(callsMatching("next-sequence-id")).toHaveLength(0);
    expect(screen.getByText(/-MS-CUSTOMER-Q\d-####/)).toBeInTheDocument();

    const customer = screen.getAllByRole("combobox").find((el) => /select a customer/i.test(el.textContent ?? ""))!;
    await user.click(customer);
    await user.click(await screen.findByRole("option", { name: /Bank One Sub/ }));
    await waitFor(() => expect(callsMatching("next-sequence-id")).toHaveLength(1));
    expect(callsMatching("next-sequence-id")[0]).toContain("source_register_id=2");
    expect(callsMatching("next-sequence-id")[0]).toContain("customer_id=1");
    expect(await screen.findByText(/-MS-BANKONESUB-Q\d-0004/)).toBeInTheDocument();
  });

  it("clears the previous register's fields when the register changes", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });

    // A compliance reference picked while the register is still undecided...
    await user.click(screen.getByRole("button", { name: "ISO 27001" }));
    expect(screen.getByRole("button", { name: "ISO 27001" })).toHaveAttribute("aria-pressed", "true");

    // ...does not survive moving to Managed Services, which has none.
    await chooseRegister(user, /Managed Services/);
    await screen.findByText("Customer Name");
    await user.click(screen.getAllByRole("combobox").find((el) => /select a customer/i.test(el.textContent ?? ""))!);
    await user.click(await screen.findByRole("option", { name: /Bank One Sub/ }));
    await user.click(screen.getByRole("button", { name: "Production" }));

    // Back to a Standard register: the template fields are gone, and the
    // compliance reference comes back unselected rather than carried over.
    await chooseRegister(user, /Asgardeo/);
    await waitFor(() => expect(screen.queryByText("Customer Name")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "ISO 27001" })).toHaveAttribute("aria-pressed", "false");

    // And back again: the customer and environment are not remembered.
    await chooseRegister(user, /Managed Services/);
    await screen.findByText("Customer Name");
    expect(screen.getByRole("button", { name: "Production" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("combobox").some((el) => /select a customer/i.test(el.textContent ?? ""))).toBe(true);
    // Several register switches through a heavy form: give it room.
  }, 30000);

  it("will not leave Step 1 with a template field missing", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /Managed Services/);
    await screen.findByText("Customer Name");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Customer is required")).toBeInTheDocument();
    expect(screen.getByText("Deployment type is required")).toBeInTheDocument();
    expect(screen.getByText("Select at least one product")).toBeInTheDocument();
    expect(screen.getByText("Select at least one environment")).toBeInTheDocument();
    // Still on Step 1.
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("will not leave Step 1 without saying who accepted the risk", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Please select who accepted this risk")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("opens the add-customer dialog from the link under Customer Name", async () => {
    const user = userEvent.setup();
    render(<AddRisk />);
    await screen.findByRole("button", { name: "ISO 27001" });
    await chooseRegister(user, /Managed Services/);
    await user.click(await screen.findByRole("button", { name: "Add new customer" }));
    const dialog = await screen.findByRole("dialog", { name: "Add new customer" });
    expect(within(dialog).getByLabelText(/Customer name/)).toBeInTheDocument();
  });
});
