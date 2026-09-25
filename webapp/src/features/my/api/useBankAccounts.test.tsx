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
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  bankingBackendUrl: "https://banking.example.com",
  bankingServiceUrls: { employeeAccounts: (email: string) => `https://banking.example.com/accounts?${email}` },
}));
const authedGet = vi.hoisted(() => vi.fn());
vi.mock("@api/http", () => ({ authedGet, defaultQueryRetry: () => false }));

import { useBankAccounts } from "./useBankAccounts";

// Same shape as the app's client: nothing refetches on mount by default.
function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { refetchOnMount: false, refetchOnWindowFocus: false } },
  });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedGet.mockReset();
  authedGet.mockResolvedValue({ bankAccounts: [], count: 0 });
});

describe("useBankAccounts", () => {
  it("fetches once for a caller that just reads the list, and reuses it when remounted", async () => {
    const client = makeClient();
    const first = renderHook(() => useBankAccounts("me@wso2.com"), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
    first.unmount();

    const second = renderHook(() => useBankAccounts("me@wso2.com"), { wrapper: wrapperFor(client) });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(authedGet).toHaveBeenCalledTimes(1);
  });

  describe("with refetchWhenOpened", () => {
    it("does not fetch twice on a cold open", async () => {
      const client = makeClient();
      const view = renderHook(() => useBankAccounts("me@wso2.com", { refetchWhenOpened: true }), {
        wrapper: wrapperFor(client),
      });
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(authedGet).toHaveBeenCalledTimes(1);
    });

    it("refetches when reopened with a fresh cache, even though the caller's email only arrives after mount", async () => {
      const client = makeClient();
      const first = renderHook(() => useBankAccounts("me@wso2.com", { refetchWhenOpened: true }), {
        wrapper: wrapperFor(client),
      });
      await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
      first.unmount();
      expect(authedGet).toHaveBeenCalledTimes(1);

      // A tab opening fresh: the sign-in token has not been decoded yet, so the
      // email is undefined at mount and shows up a moment later.
      const identity: { email?: string } = {};
      const second = renderHook(() => useBankAccounts(identity.email, { refetchWhenOpened: true }), {
        wrapper: wrapperFor(client),
      });
      identity.email = "me@wso2.com";
      second.rerender();

      await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
    });

    it("refetches once per opening, not on every later render", async () => {
      const client = makeClient();
      const view = renderHook(() => useBankAccounts("me@wso2.com", { refetchWhenOpened: true }), {
        wrapper: wrapperFor(client),
      });
      await waitFor(() => expect(view.result.current.isSuccess).toBe(true));
      view.rerender();
      view.rerender();
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(authedGet).toHaveBeenCalledTimes(1);
    });
  });
});
