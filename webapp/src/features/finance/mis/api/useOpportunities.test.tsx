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

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@api/http";

// `GET /opportunities` — the one MIS read that is a GET with query parameters.
//
// What is worth pinning is the DATE it sends. The source recovers that by
// scraping the clicked column and then, failing that, by running two regexes
// over the column's rendered header text; the port has the range structurally
// and simply uses it. These assert the date on the wire, because that is the
// whole of the difference.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
// Spread over the real module, not replacing it: `foldIdentityError` lives
// here too and is the thing under test on a failure, so a mock that dropped it
// would leave the hook calling `undefined`. `useMisAppConfigs.test.tsx` does
// the same, for the same reason.
vi.mock("@hooks/useAsgardeoSub", async () => {
  const actual = await vi.importActual<typeof import("@hooks/useAsgardeoSub")>(
    "@hooks/useAsgardeoSub",
  );
  return {
    ...actual,
    useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
  };
});
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: { opportunities: "https://mis.example/opportunities" },
}));

const answer = { value: undefined as unknown };
// The URL is the subject here — these tests assert the two query parameters —
// so it is recorded by the spy rather than discarded.
const authedGet = vi.fn(async (url: string) => {
  void url;
  if (answer.value instanceof Error) throw answer.value;
  return answer.value;
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return { ...actual, authedGet: (url: string) => authedGet(url) };
});

const { opportunitiesRequest, useOpportunities } = await import("./useOpportunities");

const RANGE = { start: "2026/01/01", end: "2026/06/30" };

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
  >
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  authedGet.mockClear();
  answer.value = [{ id: "OPP-1", name: "Renewal FY26" }];
});

describe("opportunitiesRequest", () => {
  // The date comes off the clicked column's own range. The source reaches the
  // same answer by parsing the header it printed — `as of 2025-06-30` — which
  // is a round trip through the presentation layer that returns null when the
  // wording changes.
  it("sends the closing date of the column that was clicked", () => {
    expect(opportunitiesRequest("ACC-1", RANGE)).toEqual({
      accountId: "ACC-1",
      endDate: "2026-06-30",
    });
  });

  it("asks nothing without an account, or without a column", () => {
    expect(opportunitiesRequest(undefined, RANGE)).toBeNull();
    expect(opportunitiesRequest("ACC-1", undefined)).toBeNull();
  });

  // `startDate` is accepted by the source's hook, documented "(Deprecated/
  // ignored)", and never sent; the backend declares two parameters.
  it("sends the two parameters the backend declares and no more", () => {
    expect(Object.keys(opportunitiesRequest("ACC-1", RANGE)!).sort()).toEqual([
      "accountId",
      "endDate",
    ]);
  });
});

describe("the read", () => {
  it("puts both parameters on the URL", async () => {
    const { result } = renderHook(
      () => useOpportunities({ accountId: "ACC 1", endDate: "2026-06-30" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const url = authedGet.mock.calls[0]?.[0] ?? "";
    // Encoded, not concatenated: an account id with a space in it would
    // otherwise produce a URL the gateway rejects.
    expect(url).toContain("accountId=ACC+1");
    expect(url).toContain("endDate=2026-06-30");
  });

  it("hands back the opportunities", async () => {
    const { result } = renderHook(
      () => useOpportunities({ accountId: "ACC-1", endDate: "2026-06-30" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.opportunities).toHaveLength(1);
  });

  // The dialog is shut. Nothing to ask, and nothing that reads as loading.
  it("asks nothing, and is not loading, with no request", () => {
    const { result } = renderHook(() => useOpportunities(null), { wrapper });
    expect(authedGet).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.opportunities).toEqual([]);
  });

  // The source shows "Select an account under a date range to view
  // opportunities" for every failure, because `err?.message` off a string is
  // always undefined — a sentence blaming the reader for a gateway timeout.
  it("surfaces the backend's message rather than blaming the reader", async () => {
    answer.value = new HttpError("https://mis.example", 403, "");
    const { result } = renderHook(
      () => useOpportunities({ accountId: "ACC-1", endDate: "2026-06-30" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).not.toBe("");
    expect(result.current.errorMessage).not.toMatch(/select an account/i);
  });

  it("reads a wrapped list as well as a bare one", async () => {
    answer.value = { data: [{ id: "OPP-1" }] };
    const { result } = renderHook(
      () => useOpportunities({ accountId: "ACC-1", endDate: "2026-06-30" }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.opportunities).toHaveLength(1);
  });

  // Two accounts are two questions, and the URL is this read's cache key.
  it("asks again for a different account", async () => {
    const { rerender, result } = renderHook(
      ({ accountId }) => useOpportunities({ accountId, endDate: "2026-06-30" }),
      { wrapper, initialProps: { accountId: "ACC-1" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ accountId: "ACC-2" });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
  });
});
