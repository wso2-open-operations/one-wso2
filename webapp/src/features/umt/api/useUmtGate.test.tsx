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

const userInfo: {
  data?: { roles: number[] };
  isPending: boolean;
  isError: boolean;
  error?: unknown;
  refetch: ReturnType<typeof vi.fn>;
} = {
  isPending: false,
  isError: false,
  refetch: vi.fn(),
};

vi.mock("./useUmtUserInfo", () => ({
  useUmtUserInfo: () => userInfo,
}));

const { useUmtGate } = await import("./useUmtGate");
const gate = () => renderHook(() => useUmtGate()).result.current;

beforeEach(() => {
  userInfo.data = undefined;
  userInfo.isPending = false;
  userInfo.isError = false;
  userInfo.error = undefined;
  userInfo.refetch.mockReset();
});

describe("UMT role mapping", () => {
  it.each([
    [444, "UMT_USER", "isUser"],
    [555, "UMT_ADMIN", "isAdmin"],
    [666, "PRODUCT_LEAD", "isProductLead"],
  ] as const)("maps role id %i to %s", (id, role, flag) => {
    userInfo.data = { roles: [id] };
    const result = gate();
    expect(result.isAuthorized).toBe(true);
    expect(result.hasRole(role)).toBe(true);
    expect(result[flag]).toBe(true);
  });

  it("keeps independent roles when the backend returns more than one", () => {
    userInfo.data = { roles: [444, 555, 666] };
    const result = gate();
    expect(result.isUser).toBe(true);
    expect(result.isAdmin).toBe(true);
    expect(result.isProductLead).toBe(true);
  });

  it("denies access when no recognized UMT role is present", () => {
    userInfo.data = { roles: [123, 999] };
    expect(gate().isAuthorized).toBe(false);
  });
});

describe("gate states", () => {
  it("waits for the identity and user-info decision", () => {
    userInfo.isPending = true;
    expect(gate().isResolving).toBe(true);
  });

  it("reports a failed lookup separately from a denial", () => {
    userInfo.isError = true;
    userInfo.error = new Error("gateway unavailable");
    const result = gate();
    expect(result.isError).toBe(true);
    expect(result.errorMessage).toBe("gateway unavailable");
    expect(result.isAuthorized).toBe(false);
  });

  it("retries the underlying user-info query", () => {
    gate().retry();
    expect(userInfo.refetch).toHaveBeenCalledOnce();
  });
});
