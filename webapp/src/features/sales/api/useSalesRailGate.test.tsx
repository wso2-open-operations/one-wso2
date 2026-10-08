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
import { HttpError } from "@api/http";

// The data hook is stubbed so the gate is tested on its own: what it does with each answer
// meet-app can give, not how that answer is fetched.
const state: {
  configured: boolean;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
} = {
  configured: true,
  isPending: false,
  isLoading: false,
  isError: false,
  error: null,
};
const refetch = vi.fn();
const enabledSeen: boolean[] = [];

vi.mock("./useSalesData", () => ({
  isSalesBackendConfigured: () => state.configured,
  useSalesUserInfo: (enabled: boolean) => {
    enabledSeen.push(enabled);
    return {
      isPending: state.isPending,
      isLoading: state.isLoading,
      isError: state.isError,
      error: state.error,
      refetch,
    };
  },
}));

import { renderHook } from "@testing-library/react";
import { useSalesRailGate } from "./useSalesGate";

const gate = (enabled = true) => renderHook(() => useSalesRailGate(enabled)).result.current;
const httpError = (status: number) => new HttpError("https://x/user-info", status, "");
const fail = (status: number) => {
  state.isError = true;
  state.error = httpError(status);
};

beforeEach(() => {
  state.configured = true;
  state.isPending = false;
  state.isLoading = false;
  state.isError = false;
  state.error = null;
  enabledSeen.length = 0;
  refetch.mockClear();
});

describe("useSalesRailGate", () => {
  it("shows the Echo row to a caller meet-app lets in", () => {
    expect(gate().canSee("sales-meetings")).toBe(true);
  });

  // The whole point: the row must not sit beside a "Nothing here for you yet" card.
  it("hides it from a caller meet-app refuses (403)", () => {
    fail(403);
    const g = gate();
    expect(g.canSee("sales-meetings")).toBe(false);
    // A 403 is an answer, not a failure: nothing to retry.
    expect(g.isError).toBe(false);
  });

  it("holds it back while the answer is in flight, so it never flashes in for someone refused", () => {
    state.isPending = true;
    state.isLoading = true;
    const g = gate();
    expect(g.canSee("sales-meetings")).toBe(false);
    expect(g.isResolving).toBe(true);
  });

  // Before the caller's identity resolves, the query is disabled: React Query reports it as
  // pending but NOT loading. That window must hide the row too, or it flashes in and out.
  it("holds it back while identity is still resolving (query pending but not loading)", () => {
    state.isPending = true;
    state.isLoading = false;
    const g = gate();
    expect(g.canSee("sales-meetings")).toBe(false);
    expect(g.isResolving).toBe(true);
  });

  // Fails closed on an outage, like useMarketingOpsGate and useSecurityGate -- but reports it as
  // a failure (with a retry), so it is never presented as "you have no access".
  it("hides it when the check itself fails, and reports the failure with a retry", () => {
    fail(503);
    const g = gate();
    expect(g.canSee("sales-meetings")).toBe(false);
    expect(g.isError).toBe(true);
    expect(g.errorMessage).toBeTruthy();
    g.retry();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // With no backend URL the page explains what is missing; hiding the row would bury that.
  it("keeps it when no backend is configured", () => {
    state.configured = false;
    fail(403);
    expect(gate().canSee("sales-meetings")).toBe(true);
  });

  it("only asks meet-app while Sales is the open perspective", () => {
    const g = gate(false);
    expect(enabledSeen).toEqual([false]);
    expect(g.isResolving).toBe(false);
  });
});
