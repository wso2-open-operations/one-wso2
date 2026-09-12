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

// One query per Build column, each keyed by its own request body.
//
// The source loops the columns inside one hand-rolled fetch, guarded by a
// request-id ref. Splitting them gives each column its own cache entry, which
// is what makes widening Years Back cost one request instead of all of them.

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
  misArrServiceUrls: { arrSummary: "https://mis.example/arr-summary" },
}));

/** Keyed by endDate, so a test can answer one column differently from another. */
const answers = new Map<string, unknown>();
const authedPost = vi.fn(async (_url: string, _token: string, body: unknown) => {
  const { endDate } = body as { endDate: string };
  const answer = answers.get(endDate);
  if (answer instanceof Error) throw answer;
  return answer ?? { openingArr: 0 };
});
vi.mock("@api/http", async () => {
  const actual = await vi.importActual<typeof import("@api/http")>("@api/http");
  return {
    ...actual,
    authedPost: (url: string, token: string, body: unknown) => authedPost(url, token, body),
  };
});

const { useArrSummary } = await import("./useArrSummary");

const DEFAULTS = defaultAppliedFilters(MIS_PERIODS.ANNUALLY, MIS_TABLES.SUBSCRIPTION);
const YEAR_2025: MisDateRange = { start: "2025/01/01", end: "2025/12/31" };
const YEAR_2026: MisDateRange = { start: "2026/01/01", end: "2026/09/12" };
const YEAR_2024: MisDateRange = { start: "2024/01/01", end: "2024/12/31" };

function renderSummary(ranges: readonly MisDateRange[], client = newClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(({ r }: { r: readonly MisDateRange[] }) => useArrSummary(r, DEFAULTS), {
    wrapper,
    initialProps: { r: ranges },
  });
  return { ...view, client };
}

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

beforeEach(() => {
  authedPost.mockClear();
  retryIdentity.mockClear();
  answers.clear();
  identity.value = { status: "ready", sub: "user-under-test" };
});

describe("asking the backend", () => {
  it("makes one call per column", async () => {
    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).toHaveBeenCalledTimes(2);
  });

  it("gives each column its own body, closing on its own date", async () => {
    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const sent = authedPost.mock.calls.map(([, , body]) => (body as { endDate: string }).endDate);
    expect(sent.sort()).toEqual(["2025-12-31", "2026-09-12"]);
  });

  it("hands each column back under the header it is shown with", async () => {
    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns.map((column) => column.label)).toEqual([
      "2024/12/31 - 2025/12/31",
      "2025/12/31 - 2026/09/12",
    ]);
  });
});

describe("widening the Build", () => {
  it("re-asks only for the columns whose request actually changed", async () => {
    // This is what per-column keys buy. Widening Years Back prepends an older
    // column; the columns to its right are unaffected and come back from cache.
    //
    // TWO columns are asked for, not one, and the second is not an accident:
    // `isFirstColumn` says "there is nothing to your left", so the column that
    // used to be leftmost has a genuinely different request now. Its figures
    // are compared against a real neighbour instead of against itself a year
    // back. Caching it under the old body would show a y/y figure measured
    // against the wrong window.
    const { result, rerender } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).toHaveBeenCalledTimes(2);

    rerender({ r: [YEAR_2024, YEAR_2025, YEAR_2026] });
    await waitFor(() => expect(result.current.columns).toHaveLength(3));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const reAsked = authedPost.mock.calls
      .slice(2)
      .map(([, , body]) => (body as { endDate: string }).endDate);
    expect(reAsked.sort()).toEqual(["2024-12-31", "2025-12-31"]);
    // The rightmost column's request did not change, so it was never re-sent.
    expect(reAsked).not.toContain("2026-09-12");
  });
});

describe("a column the backend refuses", () => {
  it("blanks that column and leaves the others reading", async () => {
    // The source does the same on a per-column error. A Build missing one year
    // is still worth reading; failing the whole table because one column timed
    // out is not.
    answers.set("2025-12-31", new HttpError("https://mis.example", 400, ""));
    answers.set("2026-09-12", { openingArr: 12 });

    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.columns[0].response).toBeUndefined();
    expect(result.current.columns[0].isError).toBe(true);
    expect(result.current.columns[1].response).toEqual({ openingArr: 12 });
    expect(result.current.isError).toBe(false);
  });

  it("is an error for the whole Build only when every column fails", async () => {
    answers.set("2025-12-31", new HttpError("https://mis.example", 400, ""));
    answers.set("2026-09-12", new HttpError("https://mis.example", 400, ""));

    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("a Build with no columns to ask for", () => {
  it("asks for nothing and reports nothing loading", async () => {
    const { result } = renderSummary([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(authedPost).not.toHaveBeenCalled();
    expect(result.current.columns).toEqual([]);
  });
});

// The hazard a blank Build presents: every cell empty reads as "the company
// earned nothing", not as "we could not ask". `useAsgardeoSub` states the rule
// that every sub-keyed query folds an identity failure into its own result;
// this hook returns a shape `foldIdentityError` cannot take, so it folds by hand.
describe("before the caller's identity is known", () => {
  it("holds the page rather than painting an empty Build", async () => {
    identity.value = { status: "resolving" };
    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    await waitFor(() => expect(authedPost).not.toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
  });
});

describe("when identity fails outright", () => {
  it("reports a real error instead of waiting forever", () => {
    // The queries stay disabled, so they never error on their own. Left
    // unfolded this is a Build of blank cells with no spinner and no message.
    identity.value = { status: "error", message: "Couldn't verify your session." };
    const { result } = renderSummary([YEAR_2025, YEAR_2026]);
    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).toBe("Couldn't verify your session.");
    expect(result.current.isLoading).toBe(false);
  });

  it("offers a retry that retries IDENTITY, not the doomed request", () => {
    identity.value = { status: "error", message: "Couldn't verify your session." };
    renderSummary([YEAR_2025]).result.current.retry();
    expect(retryIdentity).toHaveBeenCalled();
    expect(authedPost).not.toHaveBeenCalled();
  });
});
