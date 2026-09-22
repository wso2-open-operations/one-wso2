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
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpError } from "@api/http";
import type { FlashAccountsQuery } from "./misFlashTypes";

// The GL accounts behind one Flash figure, and the one write MIS makes against
// them — ticket 16.
//
// Two things are pinned here and nowhere else. What each book is ASKED —
// which endpoint, which parameters, spelled how — because a wrong one answers
// with an empty list rather than an error. And what a write does to the cache
// on each outcome, because that is where spec §10.16 is won or lost: a failed
// PATCH must leave nothing behind that a screen could read as saved.

vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
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
  isMisFlashConfigured: () => true,
  misFlashServiceUrls: {
    incomeAccounts: "https://flash.example/income-accounts",
    costOfSalesAccounts: "https://flash.example/cost-of-sales-accounts",
  },
}));

/** What each GET answers, by URL. Unset answers an empty list. */
const lists = new Map<string, unknown>();
const authedGet = vi.fn(async (url: string) => {
  const answer = lists.get(url);
  if (answer instanceof Error) throw answer;
  return answer ?? [];
});
/** What the next PATCH does: answer (`null`, the backend's empty 200) or throw. */
const patchOutcome = { value: null as Error | null };
const authedPatch = vi.fn<(url: string, token: string, body: unknown) => Promise<null>>(
  async () => {
    if (patchOutcome.value) throw patchOutcome.value;
    return null;
  },
);
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedGet: (url: string) => authedGet(url),
    authedPatch: (url: string, token: string, body: unknown) => authedPatch(url, token, body),
  };
});

const { flashAccountsUrl, useFlashAccounts, useWriteFlashForecast } = await import(
  "./useFlashAccounts"
);

const RECURRING: FlashAccountsQuery = {
  book: "income",
  accountCategory: "Recurring Revenue",
  businessUnit: "IAM",
  month: "2026-08",
};
const INFRA: FlashAccountsQuery = {
  book: "cost-of-sales",
  accountCategory: "Recurring Revenue COS",
  accountSubCategory: "Infra/IT",
  businessUnit: "Integration-Software",
  month: "2026-08",
};
const RECURRING_URL =
  "https://flash.example/income-accounts?accountCategory=Recurring+Revenue&month=2026-08&businessUnit=IAM";
const ACCOUNT = { id: 41, accountName: "4010 Subscriptions", amount: 1000, budgetedValue: 1200 };

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const wrapperFor =
  (client: QueryClient) =>
  ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

function renderAccounts(query: FlashAccountsQuery | null, client = newClient()) {
  return renderHook(({ q }: { q: FlashAccountsQuery | null }) => useFlashAccounts(q), {
    wrapper: wrapperFor(client),
    initialProps: { q: query },
  });
}

/** The list and the write together, the way an account view holds them. */
function renderAccountView(client = newClient()) {
  return renderHook(
    () => ({ list: useFlashAccounts(RECURRING), update: useWriteFlashForecast() }),
    { wrapper: wrapperFor(client) },
  );
}

beforeEach(() => {
  lists.clear();
  authedGet.mockClear();
  authedPatch.mockClear();
  patchOutcome.value = null;
});

describe("what an account view asks each book", () => {
  // `MonthlyViewTable.js:383-407`, parameter for parameter and in its order.
  // Spaces go as `+`: the source builds this with `URLSearchParams` and its
  // `encodeURI` leaves a `+` alone — unlike the P&L's hand-built query, which is
  // why `balanceStatementUrl` sends `%20` and this does not.
  it("asks the income book by category, month and unit", () => {
    expect(flashAccountsUrl(RECURRING)).toBe(RECURRING_URL);
  });

  // Spec §7. The backend renamed this parameter `expenseType` →
  // `accountSubCategory` on 2023-11-20 (`ec5cfa857`) and made it required; the
  // source still sends `expenseType`, which a Ballerina resource answers with a
  // 400. The port sends what the backend declares.
  it("asks the cost-of-sales book for the sub-category by the name the backend declares", () => {
    const url = new URL(flashAccountsUrl(INFRA));
    expect(url.origin + url.pathname).toBe("https://flash.example/cost-of-sales-accounts");
    expect(url.searchParams.get("accountSubCategory")).toBe("Infra/IT");
    expect(url.searchParams.has("expenseType")).toBe(false);
  });

  // "Infra/IT" and "Rent & Utilities" are real sub-categories. Encoded once:
  // the source's `encodeURI` over an already-encoded query encodes the `%`
  // again, which is a second reason its cost-of-sales view cannot answer.
  it("encodes a sub-category's slash and ampersand exactly once", () => {
    expect(flashAccountsUrl(INFRA)).toContain("accountSubCategory=Infra%2FIT&");
    expect(
      flashAccountsUrl({ ...INFRA, accountSubCategory: "Rent & Utilities" }),
    ).toContain("accountSubCategory=Rent+%26+Utilities&");
  });
});

describe("reading the accounts behind a figure", () => {
  it("asks nothing while no figure is open", () => {
    renderAccounts(null);
    expect(authedGet).not.toHaveBeenCalled();
  });

  it("lists the accounts the backend answers with", async () => {
    lists.set(RECURRING_URL, [ACCOUNT]);
    const { result } = renderAccounts(RECURRING);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts).toEqual([ACCOUNT]);
    expect(authedGet).toHaveBeenCalledWith(RECURRING_URL);
  });

  // The URL is the question, so a different month is a different read.
  it("keys each read by its own question", async () => {
    const client = newClient();
    const { result, rerender } = renderAccounts(RECURRING, client);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ q: { ...RECURRING, month: "2026-07" } });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
    expect(authedGet.mock.calls[1][0]).toContain("month=2026-07");
  });

  // An account list the backend sent as something other than a list is not
  // an empty book, but it must not reach a table as one either.
  it("reads a body that is not a list as no accounts", async () => {
    lists.set(RECURRING_URL, { message: "gateway" });
    const { result } = renderAccounts(RECURRING);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts).toEqual([]);
  });

  // A 4xx, which `httpRetry` does not retry — a 5xx would be retried once
  // after a second's back-off, and this test would be timing that instead.
  it("reports a failed read with the backend's message", async () => {
    lists.set(
      RECURRING_URL,
      new HttpError(RECURRING_URL, 403, JSON.stringify({ message: "Not a Flash reader." })),
    );
    const { result } = renderAccounts(RECURRING);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.errorMessage).toBe("Not a Flash reader.");
  });
});

describe("writing a forecast", () => {
  // `ForecastValueInput` (`types.bal:283-290`): the account's id, the value and
  // the comment, and nothing about which figure it was reached from.
  it("sends the account, the value and the comment to that account's book", async () => {
    const { result } = renderAccountView();
    await act(() =>
      result.current.update.mutateAsync({
        book: "cost-of-sales",
        input: { id: 41, value: 1500.75, comment: "Q3 true-up" },
      }),
    );
    expect(authedPatch).toHaveBeenCalledWith(
      "https://flash.example/cost-of-sales-accounts",
      "token",
      { id: 41, value: 1500.75, comment: "Q3 true-up" },
    );
  });

  it("sends a revenue account's forecast to the income book", async () => {
    const { result } = renderAccountView();
    await act(() =>
      result.current.update.mutateAsync({ book: "income", input: { id: 7, value: 0, comment: "" } }),
    );
    expect(authedPatch.mock.calls[0][0]).toBe("https://flash.example/income-accounts");
  });

  // What the screen shows after a save is the SERVER'S answer to a fresh read,
  // not the value that was sent — so if the server kept something other than
  // what was typed, that is what appears.
  it("re-reads the open account list once the server has taken it", async () => {
    lists.set(RECURRING_URL, [ACCOUNT]);
    const { result } = renderAccountView();
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    lists.set(RECURRING_URL, [{ ...ACCOUNT, budgetedValue: 1499 }]);
    await act(() =>
      result.current.update.mutateAsync({
        book: "income",
        input: { id: 41, value: 1500, comment: null },
      }),
    );
    // The re-read is done when the write resolves; React Query hands it to the
    // screen on its next tick.
    expect(authedGet).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(result.current.list.accounts[0].budgetedValue).toBe(1499));
  });

  // A forecast moves the P&L and the monthly detail as well as the list, so
  // both are marked stale — and the ones not on screen are dropped, because
  // this app does not refetch on mount and a stale P&L reopened later would be
  // served as it was.
  it("marks the P&L and the monthly detail stale, and drops the ones not on screen", async () => {
    const client = newClient();
    client.setQueryData(["mis", "balance-statement", "user-under-test", "some-range"], {});
    client.setQueryData(["mis", "account-summary", "user-under-test", { businessUnit: "All" }], {});
    const { result } = renderAccountView(client);

    await act(() =>
      result.current.update.mutateAsync({ book: "income", input: { id: 41, value: 1, comment: "" } }),
    );
    expect(client.getQueryCache().findAll({ queryKey: ["mis", "balance-statement"] })).toEqual([]);
    expect(client.getQueryCache().findAll({ queryKey: ["mis", "account-summary"] })).toEqual([]);
  });

  // Spec §10.16. The failure path changes NOTHING in the cache: no value
  // written into the list, no re-read, nothing else marked stale. Whatever a
  // screen shows afterwards is exactly what the server last said.
  it("leaves every cached figure as the server last sent it when the server refuses", async () => {
    const client = newClient();
    lists.set(RECURRING_URL, [ACCOUNT]);
    client.setQueryData(["mis", "balance-statement", "user-under-test", "some-range"], { a: 1 });
    const { result } = renderAccountView(client);
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));

    patchOutcome.value = new HttpError("https://flash.example/income-accounts", 500, "");
    await act(async () => {
      await expect(
        result.current.update.mutateAsync({
          book: "income",
          input: { id: 41, value: 999, comment: "" },
        }),
      ).rejects.toBeInstanceOf(HttpError);
    });

    expect(result.current.list.accounts).toEqual([ACCOUNT]);
    expect(authedGet).toHaveBeenCalledTimes(1);
    expect(
      client.getQueryState(["mis", "balance-statement", "user-under-test", "some-range"])
        ?.isInvalidated,
    ).toBe(false);
  });
});
