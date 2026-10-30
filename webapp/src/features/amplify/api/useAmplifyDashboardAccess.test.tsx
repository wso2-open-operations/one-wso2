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
import { useAmplifyDashboardAccess, useAmplifyEditorAccess } from "./useAmplifyEditorAccess";

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
