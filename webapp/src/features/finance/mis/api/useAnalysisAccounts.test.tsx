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

// The two reads behind ARR Analysis: the account table, and the one figure
// above it.
//
// Both go through `useColumnQueries`, which ARR Analysis has no columns for —
// the same trade `useDrillDownCustomers` makes. What it wants from that engine
// is everything that has nothing to do with columns: the body as the cache key
// (a POST that is a read has no URL to key on), sub-scoping, `httpRetry`, the
// identity-error fold, and a clean idle state when there is nothing to ask.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "user-under-test" }, retry: () => {} }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: {
    accounts: "https://mis.example/accounts",
    exitArrSearch: "https://mis.example/exit-arr/search",
  },
}));

// A 4xx, which `httpRetry` refuses to retry — so a failing case is the hook's
// answer rather than a race with a backoff. `useColumnQueries` sets its own
// `retry`, so the client's `retry: false` does not reach it.
const answers = new Map<string, unknown>();
// The BODY is forwarded, not just the URL. Without it the pair test below
// could not see what either call actually asked for, and would have passed on
// any two requests whatsoever.
const authedPost = vi.fn(async (url: string, body?: unknown) => {
  void body;
  const answer = answers.get(url);
  if (answer instanceof Error) throw answer;
  return answer;
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, _token: string, body: unknown) => authedPost(url, body),
  };
});

const { useAnalysisAccounts, useAnalysisSummaryArr } = await import("./useAnalysisAccounts");
const { defaultAnalysisFilters } = await import("../util/misAnalysisFilters");

const ON = { year: 2026, month: 9, day: 21 };
const ACCOUNTS = "https://mis.example/accounts";
const EXIT_ARR = "https://mis.example/exit-arr/search";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
  >
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  authedPost.mockClear();
  answers.clear();
});

describe("the account table's read", () => {
  it("turns the response into rows", async () => {
    answers.set(ACCOUNTS, [{ id: "001", name: "Northwind", arrGrandTotal: 10 }]);
    const { result } = renderHook(
      () => useAnalysisAccounts(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows.map((row) => row.accountName)).toEqual(["Northwind"]);
  });

  // The Ballerina service answers with a bare array, so the envelope branch is
  // unreachable against the real backend — and is exactly what a gateway in
  // front of it would make reachable. `misResponseArray` states the case.
  it("reads a wrapped list as well as a bare one", async () => {
    answers.set(ACCOUNTS, { data: [{ id: "001", name: "Northwind" }] });
    const { result } = renderHook(
      () => useAnalysisAccounts(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
  });

  it("says so, with a retry, when the read fails", async () => {
    answers.set(ACCOUNTS, new HttpError("https://mis.example", 403, ""));
    const { result } = renderHook(
      () => useAnalysisAccounts(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.rows).toEqual([]);
    expect(result.current.errorMessage).not.toBe("");
  });

  it("asks nothing while it is disabled", () => {
    renderHook(() => useAnalysisAccounts(defaultAnalysisFilters(ON), ON, false), { wrapper });
    expect(authedPost).not.toHaveBeenCalled();
  });
});

describe("the summary figure's read", () => {
  // `POST /exit-arr/search` returns a bare `decimal`
  // (`arr-backend/service.bal:266`), which is the whole reason this needs its
  // own hook rather than another `arrayIn` caller: the payload is a NUMBER, and
  // a list coercion over it yields `[]` and a figure of nothing.
  it("reads the bare number the endpoint answers with", async () => {
    answers.set(EXIT_ARR, 4_250_000.5);
    const { result } = renderHook(
      () => useAnalysisSummaryArr(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.arr).toBe(4_250_000.5);
  });

  // A `decimal` is the Ballerina type most likely to be serialised as a string
  // when precision matters, and `Number("4250000.50")` is the whole fix.
  it("reads a figure that arrived as a string", async () => {
    answers.set(EXIT_ARR, "4250000.50");
    const { result } = renderHook(
      () => useAnalysisSummaryArr(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.arr).toBe(4_250_000.5);
  });

  // Zero and "we could not ask" are different answers, and a card showing
  // `$0` for the second is the worst of the three outcomes — it reads as "the
  // company earns nothing" rather than as "this did not load".
  it("has no figure at all when the read failed, rather than zero", async () => {
    answers.set(EXIT_ARR, new HttpError("https://mis.example", 403, ""));
    const { result } = renderHook(
      () => useAnalysisSummaryArr(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.arr).toBeUndefined();
  });

  it("reads a 200 that is not a number as no figure", async () => {
    answers.set(EXIT_ARR, "<html>gateway</html>");
    const { result } = renderHook(
      () => useAnalysisSummaryArr(defaultAnalysisFilters(ON), ON),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.arr).toBeUndefined();
  });
});

// The load-bearing one for the pair. The table and the figure above it are two
// calls, and a reader comparing them has to be able to assume they answered the
// same question — so they are built from ONE filter set through the two
// builders, never narrowed independently.
describe("the table and the figure above it", () => {
  it("are asked of the same narrowing", async () => {
    answers.set(ACCOUNTS, []);
    answers.set(EXIT_ARR, 0);
    const filters = { ...defaultAnalysisFilters(ON), salesRegions: ["EMEA"] };
    renderHook(
      () => {
        useAnalysisAccounts(filters, ON);
        useAnalysisSummaryArr(filters, ON);
      },
      { wrapper },
    );
    await waitFor(() => expect(authedPost).toHaveBeenCalledTimes(2));

    // The narrowing itself, on BOTH bodies. A call count alone would have
    // passed on any two requests, which is what this test's name promises it
    // does not do.
    const bodyFor = (url: string) =>
      authedPost.mock.calls.find(([called]) => called === url)?.[1] as Record<string, unknown>;
    expect(bodyFor(ACCOUNTS).salesRegions).toEqual(["EMEA"]);
    expect(bodyFor(EXIT_ARR).salesRegions).toEqual(["EMEA"]);
    expect(bodyFor(ACCOUNTS).endDate).toBe(bodyFor(EXIT_ARR).endDate);
  });
});
