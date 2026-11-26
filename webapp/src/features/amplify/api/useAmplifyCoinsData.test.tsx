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

// Reads behind My points & Coins, Celebrate's tiles, the review buttons and Amplify Admin's settings.

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
    myPoints: "/me/points",
    pointValues: "/point-values",
    poSettings: "/po/settings",
    adminSettings: "/admin/settings",
    pointsHistory: (id: string) => `/team/${encodeURIComponent(id)}/history`,
  },
  isAmplifyBackendConfigured: () => true,
}));

import { authedGet } from "@api/http";
import type { LedgerEntry, PointsHistory } from "./amplifyTypes";
import {
  ACTIVITY_PAGE_SIZE,
  myPointsPeriod,
  nextHistoryPage,
  useAmplifySettings,
  useMyActivity,
  useMyPoints,
  usePointValues,
} from "./useAmplifyData";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const row = (reference: string): LedgerEntry => ({
  reference,
  employeeId: "e-1",
  sourceType: "ENGAGEMENT",
  action: "REPOST",
  points: 2,
  createdAt: "2026-11-01T00:00:00Z",
});

const page = (n: number, count: number, total: number): PointsHistory => ({
  employeeId: "e-1",
  page: n,
  size: ACTIVITY_PAGE_SIZE,
  total,
  items: Array.from({ length: count }, (_, i) => row(`P${n}-${i}`)),
});

beforeEach(() => {
  vi.mocked(authedGet).mockReset();
});

describe("myPointsPeriod", () => {
  it("sends ALL for all time, and this month as YYYY-MM in UTC", () => {
    expect(myPointsPeriod("ALL")).toBe("ALL");
    expect(myPointsPeriod("MONTH", new Date("2026-03-15T12:00:00Z"))).toBe("2026-03");
    // Still November in UTC, though it is December 1st east of UTC.
    expect(myPointsPeriod("MONTH", new Date("2026-11-30T23:30:00Z"))).toBe("2026-11");
    expect(myPointsPeriod("MONTH", new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});

describe("useMyPoints", () => {
  it("asks /me/points for all time", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ period: "ALL", standing: { points: 1240 } });
    const { result } = renderHook(() => useMyPoints("ALL"), { wrapper });
    await waitFor(() => expect(result.current.data?.period).toBe("ALL"));
    expect(authedGet).toHaveBeenCalledWith("/me/points?period=ALL", "token");
  });

  it("asks for this month by its YYYY-MM period", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ period: myPointsPeriod("MONTH") });
    renderHook(() => useMyPoints("MONTH"), { wrapper });
    await waitFor(() => expect(authedGet).toHaveBeenCalledWith(`/me/points?period=${myPointsPeriod("MONTH")}`, "token"));
    expect(myPointsPeriod("MONTH")).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("usePointValues", () => {
  it("reads the points each action earns today", async () => {
    vi.mocked(authedGet).mockResolvedValueOnce({ values: { OWN_POST: 12, OWN_POST_AMPLIFIED: 30 } });
    const { result } = renderHook(() => usePointValues(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ OWN_POST: 12, OWN_POST_AMPLIFIED: 30 }));
    expect(authedGet).toHaveBeenCalledWith("/point-values", "token");
  });
});

describe("useAmplifySettings", () => {
  it.each([
    ["po", "/po/settings"],
    ["admin", "/admin/settings"],
  ] as const)("reads the %s settings from %s", async (scope, url) => {
    vi.mocked(authedGet).mockResolvedValueOnce({ settings: [{ key: "coin.block_points", value: 100, version: 3 }] });
    const { result } = renderHook(() => useAmplifySettings(scope), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(authedGet).toHaveBeenCalledWith(url, "token");
  });

  it("asks nothing when it isn't enabled", async () => {
    renderHook(() => useAmplifySettings("admin", false), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
  });
});

describe("nextHistoryPage", () => {
  it("asks for the next page only while there are more rows", () => {
    const full = page(0, ACTIVITY_PAGE_SIZE, 60);
    expect(nextHistoryPage(full, [full])).toBe(1);
    const second = page(1, ACTIVITY_PAGE_SIZE, 60);
    expect(nextHistoryPage(second, [full, second])).toBe(2);
    const last = page(2, 10, 60);
    expect(nextHistoryPage(last, [full, second, last])).toBeUndefined();
    const exact = page(0, ACTIVITY_PAGE_SIZE, ACTIVITY_PAGE_SIZE);
    expect(nextHistoryPage(exact, [exact])).toBeUndefined();
  });
});

describe("useMyActivity", () => {
  it("asks nothing until the caller's id is known", async () => {
    renderHook(() => useMyActivity(undefined), { wrapper });
    await act(async () => undefined);
    expect(authedGet).not.toHaveBeenCalled();
  });

  it("reads the caller's history a page at a time", async () => {
    vi.mocked(authedGet)
      .mockResolvedValueOnce(page(0, ACTIVITY_PAGE_SIZE, 30))
      .mockResolvedValueOnce(page(1, 5, 30));
    const { result } = renderHook(() => useMyActivity("e-1"), { wrapper });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(vi.mocked(authedGet).mock.calls.map((c) => c[0])).toEqual([
      `/team/e-1/history?page=0&size=${ACTIVITY_PAGE_SIZE}`,
      `/team/e-1/history?page=1&size=${ACTIVITY_PAGE_SIZE}`,
    ]);
  });
});
