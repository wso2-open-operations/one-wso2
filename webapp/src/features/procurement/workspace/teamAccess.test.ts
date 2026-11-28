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
import { renderHook } from "@testing-library/react";
import { PROCUREMENT_WORKSPACE_ITEM } from "@constants/procurementApps";
import { hasAdminRole, hasTeamRole, procurementTeamVisibility, useProcurementTeamRailGate } from "./teamAccess";

const me = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../api/useProcurement", () => ({ useProcurementMe: () => me.current }));
vi.mock("../api/procurementApi", () => ({ isProcurementAvailable: () => true }));

describe("the Procurement team's access", () => {
  it("is for Procurement users and admins only", () => {
    expect(hasTeamRole(["procurement_user"])).toBe(true);
    expect(hasTeamRole(["procurement_admin"])).toBe(true);
    expect(hasTeamRole([])).toBe(false);
    expect(hasTeamRole(["someone_else"])).toBe(false);
  });

  it("gives settings to Procurement admins only", () => {
    expect(hasAdminRole(["procurement_admin"])).toBe(true);
    expect(hasAdminRole(["procurement_user"])).toBe(false);
    expect(hasAdminRole([])).toBe(false);
  });

  it("shows the rail row only to the team, and carries a failure to the rail", () => {
    const retry = () => undefined;
    expect(procurementTeamVisibility({ canSee: true, isAdmin: false, isResolving: false, error: undefined, retry }).canSee("any")).toBe(true);
    expect(procurementTeamVisibility({ canSee: false, isAdmin: false, isResolving: true, error: undefined, retry }).resolving).toBe(true);
    expect(procurementTeamVisibility({ canSee: false, isAdmin: false, isResolving: false, error: "Could not read your roles.", retry }).error).toBe("Could not read your roles.");
  });

  it("shows the settings row only to an admin, and the other rows to the whole team", () => {
    const retry = () => undefined;
    const team = procurementTeamVisibility({ canSee: true, isAdmin: false, isResolving: false, error: undefined, retry });
    expect(team.canSee(PROCUREMENT_WORKSPACE_ITEM.settings)).toBe(false);
    expect(team.canSee(PROCUREMENT_WORKSPACE_ITEM.queue)).toBe(true);
    const admin = procurementTeamVisibility({ canSee: true, isAdmin: true, isResolving: false, error: undefined, retry });
    expect(admin.canSee(PROCUREMENT_WORKSPACE_ITEM.settings)).toBe(true);
  });

  it("shows the row for a read that worked, and hides it while the read is out or after a refresh failed", () => {
    const gate = () => renderHook(() => useProcurementTeamRailGate(true)).result.current;
    me.current = { data: { roles: ["procurement_user"] }, isPending: false, isError: false, refetch: vi.fn() };
    expect(gate()).toMatchObject({ canSee: true, isAdmin: false });
    me.current = { data: { roles: ["procurement_admin"] }, isPending: false, isError: false, refetch: vi.fn() };
    expect(gate()).toMatchObject({ canSee: true, isAdmin: true });
    me.current = { data: { roles: ["procurement_user"] }, isPending: false, isError: true, error: new Error("down"), refetch: vi.fn() };
    expect(gate()).toMatchObject({ canSee: false, error: "down" });
    me.current = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
    expect(gate()).toMatchObject({ canSee: false, isResolving: true });
  });
});
