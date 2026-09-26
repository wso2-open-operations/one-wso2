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

// One `POST /accounts` per column, behind the Software/Cloud Customers table.
//
// The same shape as `useArrSummary` and for the same reasons — a column caches
// under its own body, a column that fails blanks only itself, and React Query
// owns the races the source guards with a request-id ref. What differs is that
// the source ALSO clears the whole table to `[]` on every refetch
// (`useCustomerAccounts.js`: `setData([])` before each run, commented "Clear
// previous data immediately to show loading state"). That is not ported: it
// makes a filter change blank hundreds of customer rows and re-paint them,
// where React Query keeps the previous answer visible until the new one lands.

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
  misArrServiceUrls: { accounts: "https://mis.example/accounts" },
}));

/** Keyed by endDate, so a test can answer one column differently from another. */
const answers = new Map<string, unknown>();
const authedPost = vi.fn(async (_url: string, _token: string, body: unknown) => {
  const { endDate } = body as { endDate: string };
  const answer = answers.get(endDate);
  if (answer instanceof Error) throw answer;
  return answer ?? [];
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, token: string, body: unknown) => authedPost(url, token, body),
  };
});

const { useCustomerAccounts } = await import("./useCustomerAccounts");

const CUSTOMERS = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS);
const YEAR_2025: MisDateRange = { start: "2025/01/01", end: "2025/12/31" };
const YEAR_2026: MisDateRange = { start: "2026/01/01", end: "2026/09/12" };

const account = (id: string, name: string) => ({ id, name, arrGrandTotal: 1 });

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function renderAccounts(ranges: readonly MisDateRange[], client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ r }: { r: readonly MisDateRange[] }) => useCustomerAccounts(r, CUSTOMERS),
    { wrapper, initialProps: { r: ranges } },
  );
  return { ...view, client };
}

beforeEach(() => {
  authedPost.mockClear();
  retryIdentity.mockClear();
  answers.clear();
  identity.value = { status: "ready", sub: "user-under-test" };
});

describe("asking the backend", () => {
  it("makes one call per column, closing on that column's date", async () => {
    const { result } = renderAccounts([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).toHaveBeenCalledTimes(2);
    expect(authedPost.mock.calls.map((call) => (call[2] as { endDate: string }).endDate)).toEqual([
      "2025-12-31",
      "2026-09-12",
    ]);
  });

  it("asks nobody anything when there are no columns", async () => {
    const { result } = renderAccounts([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).not.toHaveBeenCalled();
    expect(result.current.columns).toEqual([]);
  });

  it("keys each column by its own body, so re-asking one does not re-ask the rest", async () => {
    // The reason the columns are split at all. Widening Years Back adds a
    // column and leaves the others' bodies untouched, so their cache entries
    // stand — where the source's single loop re-fetches the whole table.
    const client = newClient();
    const { result, rerender } = renderAccounts([YEAR_2025], client);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).toHaveBeenCalledTimes(1);

    rerender({ r: [YEAR_2025, YEAR_2026] });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Two columns on screen, and only the new one was fetched.
    expect(result.current.columns).toHaveLength(2);
    expect(authedPost).toHaveBeenCalledTimes(2);
  });
});

describe("what comes back", () => {
  it("hands each column its own accounts, in the order the columns read", async () => {
    answers.set("2025-12-31", [account("a1", "Northwind Bank")]);
    answers.set("2026-09-12", [account("a1", "Northwind Bank"), account("a2", "Contoso")]);
    const { result } = renderAccounts([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns.map((column) => column.accounts?.length)).toEqual([1, 2]);
  });

  it("treats a response that is not a list as no accounts, rather than crashing the table", async () => {
    // The source coerces the same way — `Array.isArray(resp) ? resp : (resp?.data || [])`
    // — because this backend has been seen to answer both shapes.
    answers.set("2025-12-31", { data: [account("a1", "Northwind Bank")] });
    answers.set("2026-09-12", { unexpected: true });
    const { result } = renderAccounts([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns[0].accounts).toHaveLength(1);
    expect(result.current.columns[1].accounts).toEqual([]);
  });
});

describe("when a column fails", () => {
  it("blanks only itself, and the rest of the table still reads", async () => {
    answers.set("2025-12-31", new HttpError("https://mis.example", 400, ""));
    answers.set("2026-09-12", [account("a1", "Northwind Bank")]);
    const { result } = renderAccounts([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns[0]).toMatchObject({ isError: true, accounts: undefined });
    expect(result.current.columns[1].accounts).toHaveLength(1);
    // One bad column is the column's problem, not the table's.
    expect(result.current.isError).toBe(false);
  });

  it("is an error for the whole table only when every column failed", async () => {
    answers.set("2025-12-31", new HttpError("https://mis.example", 400, ""));
    answers.set("2026-09-12", new HttpError("https://mis.example", 400, ""));
    const { result } = renderAccounts([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).not.toBe("");
  });
});

describe("identity", () => {
  it("says so rather than painting an empty customer book when the subject fails", async () => {
    // The failure this exists to prevent is silent: with no subject every query
    // stays disabled and reports neither error nor fetch, so the table would
    // paint with no customers in it — which reads as a company with no
    // customers rather than as a question that could not be asked.
    identity.value = { status: "error", message: "no subject" };
    const { result } = renderAccounts([YEAR_2025]);
    expect(result.current).toMatchObject({ isError: true, errorMessage: "no subject" });
    expect(result.current.columns).toEqual([]);
    expect(authedPost).not.toHaveBeenCalled();
    result.current.retry();
    expect(retryIdentity).toHaveBeenCalled();
  });

  it("is still loading, not empty, while the subject is resolving", async () => {
    identity.value = { status: "resolving" };
    const { result } = renderAccounts([YEAR_2025]);
    expect(result.current.isLoading).toBe(true);
    expect(authedPost).not.toHaveBeenCalled();
  });
});
