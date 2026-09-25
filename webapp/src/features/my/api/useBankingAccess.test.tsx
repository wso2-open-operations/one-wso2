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

// The gate asks the banking backend what the caller may do; the query hook
// underneath is stubbed at its module boundary, so what is under test is how
// its answers (allowed / refused / failed / not there yet) map onto the gate.
const query = vi.hoisted(() => ({
  value: {} as {
    data?: { isEmployee: boolean; isPeopleOperationsAdmin: boolean; isFinanceAdmin: boolean };
    isPending: boolean;
    isError: boolean;
    error?: unknown;
    refetch: () => void;
  },
  enabledArg: undefined as boolean | undefined,
}));
vi.mock("./useBankingPrivileges", () => ({
  useBankingPrivileges: (enabled?: boolean) => {
    query.enabledArg = enabled;
    return query.value;
  },
}));

const backend = vi.hoisted(() => ({ url: "https://banking.example.com" }));
vi.mock("@config/apiConfig", () => ({
  get bankingBackendUrl() {
    return backend.url;
  },
}));

import { HttpError } from "@api/http";
import { useBankingAccess } from "./useBankingAccess";

const answer = (isEmployee: boolean) => ({
  data: { isEmployee, isPeopleOperationsAdmin: false, isFinanceAdmin: false },
  isPending: false,
  isError: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  backend.url = "https://banking.example.com";
  query.enabledArg = undefined;
  query.value = answer(true);
});

describe("useBankingAccess", () => {
  it("lets through a caller the backend says is an employee", () => {
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: true, isResolving: false, isError: false });
  });

  it("keeps out a caller the backend says is not an employee", () => {
    query.value = answer(false);
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: false, isResolving: false, isError: false });
  });

  it("fails closed, and says it is still resolving, until the backend has answered", () => {
    query.value = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: false, isResolving: true });
  });

  it("treats a 403 as a refusal, not a failure: the backend turns away callers who hold no banking role at all", () => {
    query.value = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new HttpError("https://banking.example.com/employee-privileges", 403, ""),
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: false, isResolving: false, isError: false });
  });

  it("reports any other failure as an error with a retry, not as a refusal", () => {
    const refetch = vi.fn();
    query.value = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new HttpError("https://banking.example.com/employee-privileges", 503, ""),
      refetch,
    };
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: false, isError: true });
    result.current.retry();
    expect(refetch).toHaveBeenCalled();
  });

  it("does not gate when the backend does not have the endpoint yet (404), so a rollout order cannot hide the page", () => {
    query.value = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new HttpError("https://banking.example.com/employee-privileges", 404, ""),
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: true, isResolving: false, isError: false });
  });

  // A gateway that has no such route answers without CORS headers, so the
  // browser reports a network error and never shows the 404.
  it("does not gate when the request fails without any HTTP status, which is how a missing route looks from a browser", () => {
    query.value = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new TypeError("Failed to fetch"),
      refetch: vi.fn(),
    };
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: true, isResolving: false, isError: false });
  });

  it("does not gate, or ask, when no banking backend is configured: the page itself says it is not configured", () => {
    backend.url = "";
    const { result } = renderHook(() => useBankingAccess());
    expect(result.current).toMatchObject({ canSee: true, isResolving: false, isError: false });
    expect(query.enabledArg).toBe(false);
  });

  it("passes `enabled` through, so a perspective that has no Banking entry makes no request", () => {
    renderHook(() => useBankingAccess(false));
    expect(query.enabledArg).toBe(false);
  });

  it("is not resolving while disabled, whatever the query is doing", () => {
    query.value = { data: undefined, isPending: true, isError: false, refetch: vi.fn() };
    const { result } = renderHook(() => useBankingAccess(false));
    expect(result.current.isResolving).toBe(false);
  });
});
