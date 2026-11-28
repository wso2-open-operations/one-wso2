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
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import TeamOnlyRoute from "./TeamOnlyRoute";

const me = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../api/useProcurement", () => ({ useProcurementMe: () => me.current }));

const renderRoute = (adminOnly: boolean) =>
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<TeamOnlyRoute adminOnly={adminOnly} />}>
          <Route index element={<p>The screen</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const asRoles = (roles: string[]) => {
  me.current = { data: { roles }, isPending: false, isError: false, refetch: vi.fn() };
};

describe("TeamOnlyRoute", () => {
  it("opens the screen to the whole team, and tells anyone else", () => {
    asRoles(["procurement_user"]);
    const { unmount } = renderRoute(false);
    expect(screen.getByText("The screen")).toBeInTheDocument();
    unmount();
    asRoles([]);
    renderRoute(false);
    expect(screen.queryByText("The screen")).toBeNull();
    expect(screen.getByText(/for the Procurement team/)).toBeInTheDocument();
  });

  it("opens an admin-only screen to admins, and tells a user who is not one", () => {
    asRoles(["procurement_admin"]);
    const { unmount } = renderRoute(true);
    expect(screen.getByText("The screen")).toBeInTheDocument();
    unmount();
    asRoles(["procurement_user"]);
    renderRoute(true);
    expect(screen.queryByText("The screen")).toBeNull();
    expect(screen.getByText(/for Procurement admins/)).toBeInTheDocument();
  });
});
