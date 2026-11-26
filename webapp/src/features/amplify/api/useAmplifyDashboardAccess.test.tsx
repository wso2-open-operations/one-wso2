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
import { renderHook } from "@testing-library/react";
import type { AmplifyGrant } from "./amplifyTypes";
import {
  useAmplifyAdminAccess,
  useAmplifyAnyGrant,
  useAmplifyDashboardAccess,
  useAmplifyEditorAccess,
  useAmplifyPointsAccess,
  useAmplifyReviewAccess,
} from "./useAmplifyEditorAccess";

const meState = vi.hoisted(() => ({
  configured: true,
  value: {
    data: undefined as { grants: string[] } | undefined,
    isPending: false,
    isError: false,
    error: null as Error | null,
    refetch: () => Promise.resolve(),
  },
}));

vi.mock("./useAmplifyData", () => ({
  isAmplifyBackendConfigured: () => meState.configured,
  useAmplifyMe: () => meState.value,
}));

function setGrants(grants: AmplifyGrant[] | undefined, isPending = false) {
  meState.value = {
    data: grants ? { grants } : undefined,
    isPending,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}

beforeEach(() => {
  meState.configured = true;
  setGrants(["EMPLOYEE"]);
});

describe("useAmplifyDashboardAccess", () => {
  it("lets CAN_DASHBOARD in", () => {
    setGrants(["EMPLOYEE", "CAN_DASHBOARD"]);
    expect(renderHook(() => useAmplifyDashboardAccess()).result.current.hasAccess).toBe(true);
  });

  it("keeps a plain employee out, and CAN_CAMPAIGN alone isn't enough", () => {
    expect(renderHook(() => useAmplifyDashboardAccess()).result.current.hasAccess).toBe(false);
    setGrants(["EMPLOYEE", "CAN_CAMPAIGN"]);
    expect(renderHook(() => useAmplifyDashboardAccess()).result.current.hasAccess).toBe(false);
  });

  it("answers no access, not resolving, when disabled", () => {
    setGrants(["EMPLOYEE", "CAN_DASHBOARD"]);
    const r = renderHook(() => useAmplifyDashboardAccess(false)).result.current;
    expect(r).toMatchObject({ hasAccess: false, isResolving: false });
  });

  it("answers no access, not resolving, when amplify-api isn't configured", () => {
    meState.configured = false;
    setGrants(undefined, true);
    const r = renderHook(() => useAmplifyDashboardAccess()).result.current;
    expect(r).toMatchObject({ hasAccess: false, isResolving: false });
  });

  it("is resolving, with no access, until /me answers", () => {
    setGrants(undefined, true);
    const r = renderHook(() => useAmplifyDashboardAccess()).result.current;
    expect(r).toMatchObject({ hasAccess: false, isResolving: true });
  });

  it("reports a failed /me as an error, not as no access to explain", () => {
    meState.value = { ...meState.value, data: undefined, isError: true, error: new Error("boom") };
    const r = renderHook(() => useAmplifyDashboardAccess()).result.current;
    expect(r.hasAccess).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe("useAmplifyEditorAccess", () => {
  it("follows CAN_CAMPAIGN", () => {
    setGrants(["EMPLOYEE", "CAN_CAMPAIGN"]);
    expect(renderHook(() => useAmplifyEditorAccess()).result.current.hasAccess).toBe(true);
    setGrants(["EMPLOYEE", "CAN_DASHBOARD", "CAN_ADMIN"]);
    expect(renderHook(() => useAmplifyEditorAccess()).result.current.hasAccess).toBe(false);
  });
});

describe("the PO screens' access", () => {
  it.each([
    ["Review own posts", "CAN_REVIEW_SHARES", useAmplifyReviewAccess],
    ["Points & corrections", "CAN_ADJUST_POINTS", useAmplifyPointsAccess],
    ["Amplify Admin", "CAN_POINT_RULES", useAmplifyAdminAccess],
  ] as const)("%s follows %s alone", (_screen, grant, useAccess) => {
    setGrants(["EMPLOYEE", grant]);
    expect(renderHook(() => useAccess()).result.current.hasAccess).toBe(true);
    setGrants(["EMPLOYEE", "CAN_DASHBOARD", "CAN_CAMPAIGN"]);
    expect(renderHook(() => useAccess()).result.current.hasAccess).toBe(false);
  });

  it("opens Amplify Admin to CAN_ADMIN as well, for the Coins and Own posts sections", () => {
    setGrants(["EMPLOYEE", "CAN_ADMIN"]);
    expect(renderHook(() => useAmplifyAdminAccess()).result.current.hasAccess).toBe(true);
    setGrants(["EMPLOYEE", "CAN_REVIEW_SHARES", "CAN_ADJUST_POINTS", "CAN_DASHBOARD"]);
    expect(renderHook(() => useAmplifyAdminAccess()).result.current.hasAccess).toBe(false);
  });

  it("answers no access, not resolving, off the Amplify perspective", () => {
    setGrants(["EMPLOYEE", "CAN_REVIEW_SHARES", "CAN_ADJUST_POINTS", "CAN_POINT_RULES"]);
    for (const useAccess of [useAmplifyReviewAccess, useAmplifyPointsAccess, useAmplifyAdminAccess]) {
      expect(renderHook(() => useAccess(false)).result.current).toMatchObject({ hasAccess: false, isResolving: false });
    }
  });
});

describe("useAmplifyAnyGrant", () => {
  it("lets in a caller with any one of the grants", () => {
    setGrants(["EMPLOYEE", "CAN_ADMIN"]);
    expect(renderHook(() => useAmplifyAnyGrant(["CAN_POINT_RULES", "CAN_ADMIN"])).result.current.hasAccess).toBe(true);
    expect(renderHook(() => useAmplifyAnyGrant(["CAN_POINT_RULES"])).result.current.hasAccess).toBe(false);
    expect(renderHook(() => useAmplifyAnyGrant([])).result.current.hasAccess).toBe(false);
  });

  it("is resolving, with no access, until /me answers", () => {
    setGrants(undefined, true);
    expect(renderHook(() => useAmplifyAnyGrant(["CAN_ADMIN"])).result.current).toMatchObject({
      hasAccess: false,
      isResolving: true,
    });
  });
});
