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
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
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
  amplifyServiceUrls: { myShares: "/me/shares", leaderboard: "/leaderboard", leaderboardTop: "/leaderboard/top" },
  isAmplifyBackendConfigured: () => true,
}));

import { authedGet } from "@api/http";
import type { Share } from "./amplifyTypes";
import {
  QUEUED_SHARE_POLL_MS,
  pollWhileQueued,
  sharePublishedSince,
  sharesFailedSince,
  useAmplifyLeaderboard,
  useAmplifyTopBoard,
  useMyShares,
} from "./useAmplifyData";

const share = (id: string, status: Share["status"]): Share => ({ id, campaignId: "c-" + id, status });

describe("sharePublishedSince", () => {
  it("is true only for a share that went from QUEUED to PUBLISHED", () => {
    expect(sharePublishedSince([share("s1", "QUEUED")], [share("s1", "PUBLISHED")])).toBe(true);
    expect(sharePublishedSince([share("s1", "PUBLISHED")], [share("s1", "PUBLISHED")])).toBe(false);
    expect(sharePublishedSince([share("s1", "QUEUED")], [share("s1", "FAILED")])).toBe(false);
    expect(sharePublishedSince([share("s1", "QUEUED")], [share("s1", "QUEUED")])).toBe(false);
    expect(sharePublishedSince(undefined, [share("s1", "PUBLISHED")])).toBe(false);
  });
});

describe("sharesFailedSince", () => {
  it("lists only shares that went from QUEUED to FAILED", () => {
    const failed = { ...share("s1", "FAILED"), failureReason: "NEEDS_RECONNECT" as const };
    expect(sharesFailedSince([share("s1", "QUEUED")], [failed])).toEqual([failed]);
    expect(sharesFailedSince([share("s1", "FAILED")], [failed])).toEqual([]);
    expect(sharesFailedSince(undefined, [failed])).toEqual([]);
  });
});

describe("pollWhileQueued", () => {
  it("polls every 30 s while a share is queued, and stops once none is", () => {
    expect(pollWhileQueued([share("s1", "PUBLISHED"), share("s2", "QUEUED")])).toBe(QUEUED_SHARE_POLL_MS);
    expect(QUEUED_SHARE_POLL_MS).toBe(30_000);
    expect(pollWhileQueued([share("s1", "PUBLISHED"), share("s2", "FAILED")])).toBe(false);
    expect(pollWhileQueued(undefined)).toBe(false);
  });
});

// A repost is queued (202) and its points are awarded when Amplify Jobs publishes it. Staging, 5 Nov: the podium
// kept the old points after a repost; the boards are refetched as soon as the queued share comes back PUBLISHED.
describe("useMyShares", () => {
  beforeEach(() => {
    vi.mocked(authedGet).mockReset();
  });

  function setup() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnMount: false, refetchOnWindowFocus: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { qc, wrapper };
  }

  it("refetches the leaderboard and the top board when a queued share is published", async () => {
    const { qc, wrapper } = setup();
    const loadBoard = vi.fn(async () => ({}));
    const loadTop = vi.fn(async () => ({}));
    await qc.fetchQuery({ queryKey: ["amplify", "leaderboard", "sub-1"], queryFn: loadBoard });
    await qc.fetchQuery({ queryKey: ["amplify", "leaderboard-top", "sub-1"], queryFn: loadTop });
    vi.mocked(authedGet)
      .mockResolvedValueOnce({ items: [share("s1", "QUEUED")] })
      .mockResolvedValueOnce({ items: [share("s1", "PUBLISHED")] });

    const { result } = renderHook(() => useMyShares(), { wrapper });
    await waitFor(() => expect(result.current.data?.items[0].status).toBe("QUEUED"));
    expect(loadBoard).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(loadBoard).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(loadTop).toHaveBeenCalledTimes(2));
  });

  it("checks again every 30 s while a share is queued, and stops once it is published", async () => {
    vi.useFakeTimers();
    const { wrapper } = setup();
    vi.mocked(authedGet).mockResolvedValue({ items: [share("s1", "QUEUED")] });
    const { unmount } = renderHook(() => useMyShares(), { wrapper });
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(authedGet).toHaveBeenCalledTimes(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(QUEUED_SHARE_POLL_MS);
      });
      expect(authedGet).toHaveBeenCalledTimes(2);

      vi.mocked(authedGet).mockResolvedValue({ items: [share("s1", "PUBLISHED")] });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(QUEUED_SHARE_POLL_MS);
      });
      expect(authedGet).toHaveBeenCalledTimes(3);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(QUEUED_SHARE_POLL_MS * 4);
      });
      expect(authedGet).toHaveBeenCalledTimes(3);
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("refetches /me when a queued share fails NEEDS_RECONNECT", async () => {
    const { qc, wrapper } = setup();
    const loadMe = vi.fn(async () => ({}));
    await qc.fetchQuery({ queryKey: ["amplify", "me", "sub-1"], queryFn: loadMe });
    vi.mocked(authedGet)
      .mockResolvedValueOnce({ items: [share("s1", "QUEUED")] })
      .mockResolvedValueOnce({ items: [{ ...share("s1", "FAILED"), failureReason: "NEEDS_RECONNECT" }] });

    const { result } = renderHook(() => useMyShares(), { wrapper });
    await waitFor(() => expect(result.current.data?.items[0].status).toBe("QUEUED"));
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(loadMe).toHaveBeenCalledTimes(2));
  });

  it("leaves /me alone when a share fails for another reason", async () => {
    const { qc, wrapper } = setup();
    const loadMe = vi.fn(async () => ({}));
    await qc.fetchQuery({ queryKey: ["amplify", "me", "sub-1"], queryFn: loadMe });
    vi.mocked(authedGet)
      .mockResolvedValueOnce({ items: [share("s1", "QUEUED")] })
      .mockResolvedValueOnce({ items: [{ ...share("s1", "FAILED"), failureReason: "PROVIDER_REJECTED" }] });

    const { result } = renderHook(() => useMyShares(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    await act(async () => {
      await result.current.refetch();
    });

    expect(loadMe).toHaveBeenCalledTimes(1);
  });

  it("leaves the boards alone when nothing was published", async () => {
    const { qc, wrapper } = setup();
    const loadBoard = vi.fn(async () => ({}));
    await qc.fetchQuery({ queryKey: ["amplify", "leaderboard", "sub-1"], queryFn: loadBoard });
    vi.mocked(authedGet)
      .mockResolvedValueOnce({ items: [share("s1", "PUBLISHED")] })
      .mockResolvedValueOnce({ items: [share("s1", "PUBLISHED")] });

    const { result } = renderHook(() => useMyShares(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    await act(async () => {
      await result.current.refetch();
    });

    expect(loadBoard).toHaveBeenCalledTimes(1);
  });
});

// The app's QueryClient turns refetchOnMount and refetchOnWindowFocus off; the two Celebrate boards turn them back on,
// so other people's reposts show when Celebrate is opened again or its tab regains focus.
describe("the Celebrate boards", () => {
  const TEN_MINUTES_AGO = () => Date.now() - 10 * 60 * 1000;
  const boards = [
    { name: "the leaderboard", key: ["amplify", "leaderboard", "sub-1"], useBoard: useAmplifyLeaderboard },
    { name: "the top board", key: ["amplify", "leaderboard-top", "sub-1"], useBoard: useAmplifyTopBoard },
  ];

  beforeEach(() => {
    vi.mocked(authedGet).mockReset();
    vi.mocked(authedGet).mockResolvedValue({ fresh: true });
  });

  function setup() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnMount: false, refetchOnWindowFocus: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { qc, wrapper };
  }

  it.each(boards)("$name reloads stale data when the page opens", async ({ key, useBoard }) => {
    const { qc, wrapper } = setup();
    qc.setQueryData(key, { cached: true }, { updatedAt: TEN_MINUTES_AGO() });
    const { result, unmount } = renderHook(() => useBoard(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual({ fresh: true }));
    expect(authedGet).toHaveBeenCalledTimes(1);
    unmount();
  });

  it.each(boards)("$name reloads stale data when the tab regains focus", async ({ key, useBoard }) => {
    const { qc, wrapper } = setup();
    const { unmount } = renderHook(() => useBoard(), { wrapper });
    await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(1));
    qc.setQueryData(key, { fresh: true }, { updatedAt: TEN_MINUTES_AGO() });
    try {
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await waitFor(() => expect(authedGet).toHaveBeenCalledTimes(2));
    } finally {
      focusManager.setFocused(undefined);
      unmount();
    }
  });
});
