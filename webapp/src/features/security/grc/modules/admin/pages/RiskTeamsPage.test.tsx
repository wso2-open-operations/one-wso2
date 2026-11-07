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
import type { AdminTeam } from "../api/adminApi";
import RiskTeamsPage from "./RiskTeamsPage";

const authFetch = vi.fn();
vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({
  useAuthApiClient: () => authFetch,
}));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));

let teams: AdminTeam[] = [];

const writes = (method: string) =>
  authFetch.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init.body)) }));

beforeEach(() => {
  authFetch.mockReset();
  authFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return new Response(JSON.stringify({ id: 99 }), { status: 201 });
    if (init?.method === "PUT") return new Response(null, { status: 204 });
    return new Response(JSON.stringify(teams), { status: 200 });
  });
});

const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Add Team/ }));
  await screen.findByLabelText("Name");
};

const chooseType = async (user: ReturnType<typeof userEvent.setup>, option: RegExp) => {
  await user.click(screen.getByRole("combobox", { name: "Team Type" }));
  await user.click(await screen.findByRole("option", { name: option }));
};

describe("RiskTeamsPage dialog — Team Type and Code", () => {
  it("asks for the Team Type before the Code", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    const type = screen.getByRole("combobox", { name: "Team Type" });
    const code = screen.getByLabelText("Code *");
    expect(type.compareDocumentPosition(code) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not ask an assignment team for a code, and sends none", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "Managed Services Team A");
    await user.type(screen.getByLabelText("Code *"), "typed-before-switching");
    await chooseType(user, /Assignment/);
    expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("POST")).toHaveLength(1));
    expect(writes("POST")[0].body).toMatchObject({ name: "Managed Services Team A", team_type: "ASSIGNMENT", code: null });
  });

  it("does not ask an assignment team for a Register Template, and sends Standard", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "Legal");
    await user.click(screen.getByRole("combobox", { name: "Register Template" }));
    await user.click(await screen.findByRole("option", { name: "Managed Services" }));
    await chooseType(user, /Assignment/);
    expect(screen.queryByRole("combobox", { name: "Register Template" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("POST")).toHaveLength(1));
    expect(writes("POST")[0].body).toMatchObject({ team_type: "ASSIGNMENT", register_template: "STANDARD" });
  });

  it("still requires a code for a register", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "WSO2 Cloud");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Code is required for a Register team.")).toBeInTheDocument();
    expect(writes("POST")).toHaveLength(0);
  });

  it("brings the code field back when the type is switched to Register", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await chooseType(user, /Assignment/);
    expect(screen.queryByLabelText(/^Code/)).not.toBeInTheDocument();
    await chooseType(user, /Register/);
    expect(screen.getByLabelText("Code *")).toBeInTheDocument();
  });

  it("keeps showing the code of an existing assignment team that has one", async () => {
    teams = [
      {
        id: 5,
        name: "Legacy Team",
        code: "LEG",
        description: null,
        team_type: "ASSIGNMENT",
        register_template: "STANDARD",
        has_risks: false,
        status: "ACTIVE",
      },
    ];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByLabelText("Code")).toHaveValue("LEG");
  });
});

describe("RiskTeamsPage dialog — Register Template lock", () => {
  const team = (over: Partial<AdminTeam>): AdminTeam => ({
    id: 7,
    name: "Managed Services",
    code: "MS",
    description: null,
    team_type: "BOTH",
    register_template: "MANAGED_SERVICES",
    has_risks: false,
    status: "ACTIVE",
    ...over,
  });
  const templateSelect = () => screen.getByRole("combobox", { name: "Register Template" });

  it("leaves the template editable while nothing uses the team", async () => {
    teams = [team({})];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByLabelText("Name");
    expect(templateSelect()).not.toHaveAttribute("aria-disabled", "true");
  });

  it("disables the template, and says why, once a risk uses the team", async () => {
    teams = [team({ has_risks: true })];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByLabelText("Name");
    expect(templateSelect()).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/risks already use this team/i)).toBeInTheDocument();
  });

  it("keeps sending the saved template for a locked team, even if its Team Type is switched", async () => {
    // An Aggregated register with risks, switched to Assignment, would be coerced
    // to Standard — a change the backend refuses. The locked value is sent as is.
    teams = [team({ id: 8, name: "WSO2 Cloud", code: "CLO", register_template: "AGGREGATED", has_risks: true })];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    await screen.findByLabelText("Name");
    await chooseType(user, /Assignment/);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("PUT")).toHaveLength(1));
    expect(writes("PUT")[0].body).toMatchObject({ register_template: "AGGREGATED" });
  });
});

describe("RiskTeamsPage dialog — Aggregated register platforms", () => {
  // Integration Platform (7) has Ballerina (9) and Micro Integrator (10).
  const lookups = [
    { id: 4, name: "Core Platform", status: "ACTIVE", in_use: false },
    { id: 7, name: "Integration Platform", status: "ACTIVE", in_use: false },
    { id: 9, name: "Ballerina", parent_id: 7, status: "ACTIVE", in_use: false },
    { id: 10, name: "Micro Integrator", parent_id: 7, status: "ACTIVE", in_use: false },
  ];

  beforeEach(() => {
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ id: 99 }), { status: 201 });
      if (init?.method === "PUT") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(String(url).endsWith("/platforms") ? lookups : teams), { status: 200 });
    });
  });

  const chooseAggregated = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("combobox", { name: "Register Template" }));
    await user.click(await screen.findByRole("option", { name: "Aggregated" }));
  };

  it("offers platforms only for the Aggregated template", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    expect(screen.queryByRole("checkbox", { name: "Integration Platform" })).not.toBeInTheDocument();
    await chooseAggregated(user);
    expect(await screen.findByRole("checkbox", { name: "Integration Platform" })).toBeInTheDocument();
  });

  it("reveals a platform's sub-platforms once it is ticked, and saves the picks", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "Integration Platform");
    await user.type(screen.getByLabelText("Code *"), "int");
    await chooseAggregated(user);

    expect(screen.queryByRole("checkbox", { name: "Ballerina" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("checkbox", { name: "Integration Platform" }));
    await user.click(screen.getByRole("checkbox", { name: "Ballerina" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(writes("POST")).toHaveLength(1));
    expect(writes("POST")[0].body).toMatchObject({ register_template: "AGGREGATED", platform_ids: [7, 9] });
  });

  it("sends no platform list for a Standard register", async () => {
    teams = [];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await openAdd(user);
    await user.type(screen.getByLabelText("Name"), "Choreo");
    await user.type(screen.getByLabelText("Code *"), "cho");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("POST")).toHaveLength(1));
    expect(writes("POST")[0].body).not.toHaveProperty("platform_ids");
  });

  it("preselects an existing register's list, and unticking everything sends an empty list", async () => {
    teams = [
      {
        id: 5,
        name: "WSO2 Cloud",
        code: "CLOUD",
        description: null,
        team_type: "BOTH",
        register_template: "AGGREGATED",
        has_risks: true,
        platform_ids: [4],
        status: "ACTIVE",
      },
    ];
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const core = await screen.findByRole("checkbox", { name: "Core Platform" });
    expect(core).toBeChecked();

    await user.click(core);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("PUT")).toHaveLength(1));
    expect(writes("PUT")[0].body).toMatchObject({ platform_ids: [] });
  });

  it("leaves the stored list alone when the platforms could not be loaded", async () => {
    teams = [
      {
        id: 5,
        name: "WSO2 Cloud",
        code: "CLOUD",
        description: null,
        team_type: "BOTH",
        register_template: "AGGREGATED",
        has_risks: true,
        platform_ids: [4],
        status: "ACTIVE",
      },
    ];
    authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") return new Response(null, { status: 204 });
      if (String(url).endsWith("/platforms")) return new Response(JSON.stringify({ message: "boom" }), { status: 500 });
      return new Response(JSON.stringify(teams), { status: 200 });
    });
    const user = userEvent.setup();
    render(<RiskTeamsPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    expect(await screen.findByText(/Couldn't load the platforms/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(writes("PUT")).toHaveLength(1));
    expect(writes("PUT")[0].body).not.toHaveProperty("platform_ids");
  });
});
