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
import { defaultAppliedFilters } from "../util/misViewState";
import { MIS_PERIODS, MIS_TABLES, type MisDateRange } from "../util/misViewVocabulary";

// One POST per column behind each Exit ARR summary.
//
// The same `useColumnQueries` engine the Build and the customer book run on, so
// what is pinned here is what these two hooks add to it: the "As of" column
// header, the object coercion, and — for the Region Summary alone — the Sales
// Region / Sub Region cut travelling in the BODY, which is what makes the two
// cuts two cache entries rather than one.
//
// The engine's own behaviour (a failed column blanking only itself, an identity
// error not painting an empty table) is pinned in `useArrSummary.test.tsx` and
// `useCustomerAccounts.test.tsx`; only the first is re-checked here, because it
// is the one these tables' error copy depends on.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
const retryIdentity = vi.fn();
const identity = {
  value: { status: "ready", sub: "user-under-test" } as
    | { status: "ready"; sub: string }
    | { status: "error"; message: string }
    | { status: "resolving" },
};
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: identity.value, retry: retryIdentity }),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@config/apiConfig", () => ({
  isMisArrConfigured: () => true,
  misArrServiceUrls: {
    regionExit: "https://mis.example/arr-summary/region-exit",
    buExit: "https://mis.example/arr-summary/bu-exit",
  },
}));

/** Keyed by url and endDate, so a test can answer one column differently from another. */
const answers = new Map<string, unknown>();
const authedPost = vi.fn(async (url: string, _token: string, body: unknown) => {
  const { endDate } = body as { endDate: string };
  const answer = answers.get(`${url}|${endDate}`);
  if (answer instanceof Error) throw answer;
  return answer ?? {};
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, token: string, body: unknown) => authedPost(url, token, body),
  };
});

const { useExitArrByRegion, useExitArrByBU } = await import("./useExitArr");

const REGION_URL = "https://mis.example/arr-summary/region-exit";
const BU_URL = "https://mis.example/arr-summary/bu-exit";

const REGION_FILTERS = defaultAppliedFilters(
  MIS_PERIODS.ANNUALLY,
  MIS_TABLES.EXIT_ARR_BY_REGION,
);
const BU_FILTERS = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.EXIT_ARR_BY_BU);

const YEAR_2025: MisDateRange = { start: "2025/01/01", end: "2025/12/31" };
const YEAR_2026: MisDateRange = { start: "2026/01/01", end: "2026/09/12" };

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderRegion(
  ranges: readonly MisDateRange[],
  bySalesRegion = true,
  client = newClient(),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ sales }: { sales: boolean }) => useExitArrByRegion(ranges, REGION_FILTERS, sales),
    { wrapper, initialProps: { sales: bySalesRegion } },
  );
  return { ...view, client };
}

function renderBu(ranges: readonly MisDateRange[], client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useExitArrByBU(ranges, BU_FILTERS), { wrapper });
}

beforeEach(() => {
  authedPost.mockClear();
  retryIdentity.mockClear();
  answers.clear();
  identity.value = { status: "ready", sub: "user-under-test" };
});

describe("asking the backend", () => {
  it("makes one call per column, closing on that column's date", async () => {
    const { result } = renderRegion([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost.mock.calls.map((call) => (call[2] as { endDate: string }).endDate)).toEqual([
      "2025-12-31",
      "2026-09-12",
    ]);
  });

  it("asks each summary at its own endpoint", async () => {
    const region = renderRegion([YEAR_2026]);
    await waitFor(() => expect(region.result.current.isLoading).toBe(false));
    expect(authedPost.mock.calls[0][0]).toBe(REGION_URL);

    authedPost.mockClear();
    const bu = renderBu([YEAR_2026]);
    await waitFor(() => expect(bu.result.current.isLoading).toBe(false));
    expect(authedPost.mock.calls[0][0]).toBe(BU_URL);
  });

  it("asks nobody anything when there are no columns", async () => {
    const { result } = renderBu([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).not.toHaveBeenCalled();
    expect(result.current.columns).toEqual([]);
  });

  it("re-asks the Region Summary when the reader switches to Sub Region", async () => {
    // The cut is in the BODY, and the body is the cache key — so this is not a
    // client-side regrouping of figures already held. A Sub Region read is a
    // different question and gets a different answer.
    const { result, rerender } = renderRegion([YEAR_2026], true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).toHaveBeenCalledTimes(1);
    expect(authedPost.mock.calls[0][2]).toMatchObject({ isSalesRegionSummary: true });

    rerender({ sales: false });
    await waitFor(() => expect(authedPost).toHaveBeenCalledTimes(2));
    expect(authedPost.mock.calls[1][2]).toMatchObject({ isSalesRegionSummary: false });
  });
});

describe("the header above each column", () => {
  it("names the date the column closes on", async () => {
    const { result } = renderRegion([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns.map((column) => column.label)).toEqual([
      "As of 2025/12/31",
      "As of 2026/09/12",
    ]);
  });
});

describe("what comes back", () => {
  it("hands each column its own answer, in the order the columns read", async () => {
    answers.set(`${REGION_URL}|2025-12-31`, { NA: { apim: 1 } });
    answers.set(`${REGION_URL}|2026-09-12`, { NA: { apim: 2 }, EU: { apim: 3 } });
    const { result } = renderRegion([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns[0].response).toEqual({ NA: { apim: 1 } });
    expect(Object.keys(result.current.columns[1].response ?? {})).toEqual(["NA", "EU"]);
  });

  it("treats a response that is not an object as an empty one", async () => {
    // A column that answered with nothing is a column that ANSWERED, so every
    // lookup on it should read as absent rather than as still loading.
    answers.set(`${BU_URL}|2026-09-12`, null);
    const { result } = renderBu([YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns[0].response).toEqual({});
  });

  it("treats a list as an empty one, rather than reading its indices as regions", async () => {
    // `/region-exit` answers with a MAP. An array reaching the row builder
    // would otherwise give rows named "0" and "1".
    answers.set(`${REGION_URL}|2026-09-12`, [{ apim: 1 }]);
    const { result } = renderRegion([YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns[0].response).toEqual({});
  });
});

describe("when a column fails", () => {
  it("blanks only itself, and the rest of the table still reads", async () => {
    answers.set(`${BU_URL}|2025-12-31`, new HttpError("https://mis.example", 400, ""));
    answers.set(`${BU_URL}|2026-09-12`, { apim: 5 });
    const { result } = renderBu([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns[0]).toMatchObject({ isError: true, response: undefined });
    expect(result.current.columns[1].response).toEqual({ apim: 5 });
    expect(result.current.isError).toBe(false);
  });

  it("is an error for the whole table only when every column failed", async () => {
    answers.set(`${BU_URL}|2025-12-31`, new HttpError("https://mis.example", 400, ""));
    answers.set(`${BU_URL}|2026-09-12`, new HttpError("https://mis.example", 400, ""));
    const { result } = renderBu([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).not.toBe("");
  });
});
