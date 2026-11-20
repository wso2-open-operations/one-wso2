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
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RiskLayout from "./RiskLayout";
import * as api from "../dashboard-agent/dashboardAgentApi";

vi.mock("@features/security/grc/shim/useAuthApiClient", () => ({ useAuthApiClient: () => vi.fn() }));
vi.mock("@features/security/grc/shim/apiConfig", () => ({ BACKEND_BASE_URL: "http://backend.test" }));
vi.mock("../dashboard-agent/dashboardAgentApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../dashboard-agent/dashboardAgentApi")>()),
  fetchStarters: vi.fn(),
}));

const fetchStarters = vi.mocked(api.fetchStarters);

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="risk" element={<RiskLayout />}>
          <Route path="dashboard" element={<div>Dashboard page</div>} />
          <Route path="registers" element={<div>Registers page</div>} />
          <Route path="add" element={<div>Add Risk page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchStarters.mockResolvedValue([]);
});

describe("RiskLayout", () => {
  it.each([
    ["/risk/dashboard", "Dashboard page"],
    ["/risk/registers", "Registers page"],
    ["/risk/add", "Add Risk page"],
  ])("shows the agent button on %s", async (path, text) => {
    renderAt(path);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /ask ai/i })).toBeInTheDocument();
  });

  it("shows the page but no button when the agent is not available to the user", async () => {
    fetchStarters.mockResolvedValue(null);
    renderAt("/risk/registers");
    expect(screen.getByText("Registers page")).toBeInTheDocument();
    await vi.waitFor(() => expect(fetchStarters).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /ask ai/i })).not.toBeInTheDocument();
  });
});
