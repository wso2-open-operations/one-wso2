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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>("@hooks/useAsgardeoSub");
  return {
    ...actual,
    useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const authedGet = vi.fn();
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (...args: unknown[]) => authedGet(...(args as [])) };
});

(window as unknown as { config: Record<string, string> }).config = {
  ONE_WSO2_UMT_BACKEND_URL: "https://umt.example.com",
};

const { useUmtUpdatesByLifecycleState } = await import("./useUmtUpdates");
const { umtServiceUrls } = await import("@config/apiConfig");

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  authedGet.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useUmtUpdatesByLifecycleState", () => {
  // A whole lifecycle state in one request, with no page parameters. Asking
  // the paginated search endpoint for one large page instead caps the answer
  // at that page size, which silently makes "is this product already in UAT?"
  // wrong as soon as a state grows past it.
  it("GETs every update in the state, with the state in the query string", async () => {
    authedGet.mockResolvedValue({ recordsTotal: 2, recordsFiltered: 2, data: [{ id: 1 }, { id: 2 }] });

    const { result } = renderHook(() => useUmtUpdatesByLifecycleState("UAT"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(authedGet).toHaveBeenCalledWith(umtServiceUrls.updatesByLifecycleState("UAT"), "token");
    expect(umtServiceUrls.updatesByLifecycleState("UAT")).toContain("?lifecycleState=UAT");
    expect(result.current.data?.data).toHaveLength(2);
  });

  // The list goes stale whenever an update moves between lifecycle states, is
  // locked into a chunk, or is demoted back out of one. Every mutation that
  // does so already invalidates "umt-updates", so sharing that prefix is what
  // keeps this list current rather than each of them having to know about it.
  it("shares the umt-updates key prefix, so existing invalidations reach it", async () => {
    authedGet.mockResolvedValue({ recordsTotal: 0, recordsFiltered: 0, data: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    renderHook(() => useUmtUpdatesByLifecycleState("UATStaging"), { wrapper: Wrapper });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(1));

    await client.invalidateQueries({ queryKey: ["umt-updates"] });

    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
  });

  it("fetches again on every mount, although the app's client sets refetchOnMount: false", async () => {
    authedGet.mockResolvedValue({ recordsTotal: 0, recordsFiltered: 0, data: [] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnMount: false } } });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useUmtUpdatesByLifecycleState("UAT"), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();
    expect(authedGet).toHaveBeenCalledTimes(1);

    renderHook(() => useUmtUpdatesByLifecycleState("UAT"), { wrapper: Wrapper });

    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
  });

  it("keeps each lifecycle state's result separate", async () => {
    authedGet.mockResolvedValue({ recordsTotal: 0, recordsFiltered: 0, data: [] });
    const Wrapper = wrapper();

    renderHook(() => useUmtUpdatesByLifecycleState("UATStaging"), { wrapper: Wrapper });
    renderHook(() => useUmtUpdatesByLifecycleState("UAT"), { wrapper: Wrapper });

    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
    expect(authedGet.mock.calls.map((call) => call[0])).toEqual([
      umtServiceUrls.updatesByLifecycleState("UATStaging"),
      umtServiceUrls.updatesByLifecycleState("UAT"),
    ]);
  });
});
