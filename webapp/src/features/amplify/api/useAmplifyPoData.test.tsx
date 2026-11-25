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

// Reads behind Submit your own post, Review own posts, Points & corrections and Amplify Admin.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@api/http", () => ({ authedGet: vi.fn() }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", () => ({
  amplifyServiceUrls: {
    myExternalShares: "/me/external-shares",
    poExternalShares: "/po/external-shares",
    poPeople: "/po/people",
    poPointRules: "/po/point-rules",
    pointsHistory: (id: string) => `/team/${encodeURIComponent(id)}/history`,
  },
  isAmplifyBackendConfigured: () => true,
}));

import { authedGet } from "@api/http";
import type { LedgerEntry } from "./amplifyTypes";
import {
  HISTORY_FETCH_SIZE,
  HISTORY_MAX_PAGES,
  readWholeHistory,
  useExternalSharesForReview,
  useMyExternalShares,
  usePoPeopleSearch,
  usePointRules,
  usePointsHistory,
  useWaitingReviewCount,
} from "./useAmplifyData";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const row = (reference: string, points = 1): LedgerEntry => ({
  reference,
  employeeId: "e-1",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points,
  createdAt: "2026-11-01T00:00:00Z",
});

beforeEach(() => {
  vi.mocked(authedGet).mockReset();
});

describe("useMyExternalShares", () => {
  it("reads the caller's own claims", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ items: [{ id: "x-1", status: "PENDING" }] });
    const { result } = renderHook(() => useMyExternalShares(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([{ id: "x-1", status: "PENDING" }]));
    expect(authedGet).toHaveBeenCalledWith("/me/external-shares", "token");
  });
});

describe("useExternalSharesForReview", () => {
  it("asks for one page of a status", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ items: [], page: 2, size: 10, total: 0 });
    renderHook(() => useExternalSharesForReview("APPROVED", 2), { wrapper });
    await waitFor(() =>
      expect(authedGet).toHaveBeenCalledWith("/po/external-shares?status=APPROVED&page=2&size=10", "token"),
    );
  });
});

describe("useWaitingReviewCount", () => {
  it("reads the total of a one-row PENDING page", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ items: [{}], page: 0, size: 1, total: 7 });
    const { result } = renderHook(() => useWaitingReviewCount(true), { wrapper });
    await waitFor(() => expect(result.current.data).toBe(7));
    expect(authedGet).toHaveBeenCalledWith("/po/external-shares?status=PENDING&page=0&size=1", "token");
  });

  it("asks nothing when it isn't enabled", async () => {
    const { result } = renderHook(() => useWaitingReviewCount(false), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("usePoPeopleSearch", () => {
  it.each(["", "a", " b "])("asks nothing for fewer than two characters (%j)", async (q) => {
    renderHook(() => usePoPeopleSearch(q), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
  });

  it("searches with the trimmed text and a limit of ten", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ items: [{ employeeId: "e-1", displayName: "Jane", email: "j@x" }] });
    const { result } = renderHook(() => usePoPeopleSearch("  ja  "), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(authedGet).toHaveBeenCalledWith("/po/people?q=ja&limit=10", "token");
  });
});

describe("readWholeHistory", () => {
  it("reads page after page until the rows run out", async () => {
    const first = Array.from({ length: HISTORY_FETCH_SIZE }, (_, i) => row(`R-${i}`));
    vi.mocked(authedGet)
      .mockResolvedValueOnce({ employeeId: "e-1", page: 0, size: 100, total: 102, items: first })
      .mockResolvedValueOnce({ employeeId: "e-1", page: 1, size: 100, total: 102, items: [row("R-100"), row("R-101")] });
    const history = await readWholeHistory("/team/e-1/history", "token");
    expect(history.complete).toBe(true);
    expect(history.items).toHaveLength(102);
    expect(vi.mocked(authedGet).mock.calls.map((c) => c[0])).toEqual([
      "/team/e-1/history?page=0&size=100",
      "/team/e-1/history?page=1&size=100",
    ]);
  });

  it("keeps a row once when a new row pushes it onto the next page", async () => {
    const first = Array.from({ length: HISTORY_FETCH_SIZE }, (_, i) => row(`R-${i}`));
    vi.mocked(authedGet)
      .mockResolvedValueOnce({ employeeId: "e-1", page: 0, size: 100, total: 101, items: first })
      .mockResolvedValueOnce({ employeeId: "e-1", page: 1, size: 100, total: 101, items: [row("R-99")] });
    const history = await readWholeHistory("/team/e-1/history", "token");
    expect(history.items).toHaveLength(100);
  });

  it("stops after the page limit and says the history is partial", async () => {
    vi.mocked(authedGet).mockImplementation(async (url: string) => {
      const page = Number(new URL(url, "http://x").searchParams.get("page"));
      return {
        employeeId: "e-1",
        page,
        size: 100,
        total: 99_999,
        items: Array.from({ length: HISTORY_FETCH_SIZE }, (_, i) => row(`P${page}-${i}`)),
      };
    });
    const history = await readWholeHistory("/team/e-1/history", "token");
    expect(history.complete).toBe(false);
    expect(authedGet).toHaveBeenCalledTimes(HISTORY_MAX_PAGES);
  });
});

describe("usePointsHistory", () => {
  it.each([null, "", "  "])("asks nothing without a person (%j)", async (id) => {
    renderHook(() => usePointsHistory(id), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
  });

  it("reads the person's history by id", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ employeeId: "e 1", page: 0, size: 100, total: 1, items: [row("R-1")] });
    const { result } = renderHook(() => usePointsHistory("e 1"), { wrapper });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    expect(authedGet).toHaveBeenCalledWith("/team/e%201/history?page=0&size=100", "token");
  });
});

describe("usePointRules", () => {
  it("reads every rule version", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ rules: [{ action: "REPOST", points: 5, inForce: true }] });
    const { result } = renderHook(() => usePointRules(), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(authedGet).toHaveBeenCalledWith("/po/point-rules", "token");
  });

  it("asks nothing when it isn't enabled", async () => {
    renderHook(() => usePointRules(false), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
  });
});
