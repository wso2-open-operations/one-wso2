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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@api/http", () => ({
  authedPost: vi.fn(async () => ({ run: "STARTED" })),
  authedPatch: vi.fn(async () => ({})),
  authedDelete: vi.fn(async () => undefined),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({ useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" } }) }));

import { authedDelete, authedPost } from "@api/http";
import {
  useAdjustPoints,
  useApproveExternalShare,
  useArchiveCampaign,
  useClaimOwnPost,
  useDeclineExternalShare,
  useFeatureExternalShare,
  useRegisterCampaign,
  useRemoveLinkedInConnection,
  useRetryAnnouncement,
  useReversePoints,
  useSendAnnouncement,
  useSetPointRule,
} from "./useAmplifyMutations";
import type { CampaignDraft } from "./amplifyTypes";

// The app's QueryClient sets refetchOnMount: false, so a list that no page is showing must be refetched by the
// mutation itself, or Current Posts keeps its old rows after New Post saves.
describe("saving a post", () => {
  it("refetches a cached campaigns list that no page is showing, before the mutation settles", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnMount: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const loadList = vi.fn(async () => ({ items: [] }));
    await qc.fetchQuery({ queryKey: ["amplify", "campaigns", "sub-1", "all"], queryFn: loadList });
    expect(loadList).toHaveBeenCalledTimes(1);

    const { result } = renderHook(() => useRegisterCampaign(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ draft: {} as CampaignDraft, shareNow: true });
    });

    expect(loadList).toHaveBeenCalledTimes(2);
  });
});

// The Choreo API proxy's CORS allow-list has no Idempotency-Key, so a POST that
// sends one is blocked in the browser after its preflight passes.
describe("a POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends no Idempotency-Key header", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnMount: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRegisterCampaign(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ draft: {} as CampaignDraft, shareNow: false });
    });

    const call = vi.mocked(authedPost).mock.calls[0] as unknown[];
    expect(call).toHaveLength(3);
  });
});

describe("removing the LinkedIn connection", () => {
  it("sends DELETE /connections/linkedin and refetches the caller's /me status", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnMount: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const loadMe = vi.fn(async () => ({ linkedin: { status: "ACTIVE" } }));
    await qc.fetchQuery({ queryKey: ["amplify", "me", "sub-1"], queryFn: loadMe });

    const { result } = renderHook(() => useRemoveLinkedInConnection(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(vi.mocked(authedDelete).mock.calls[0][0]).toMatch(/\/connections\/linkedin$/);
    expect(loadMe).toHaveBeenCalledTimes(2);
  });
});

describe("deleting a post", () => {
  it("sends DELETE for the campaign and refetches the campaigns lists", async () => {
    vi.clearAllMocks();
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnMount: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const loadList = vi.fn(async () => ({ items: [] }));
    await qc.fetchQuery({ queryKey: ["amplify", "campaigns", "sub-1", "open"], queryFn: loadList });

    const { result } = renderHook(() => useArchiveCampaign(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "c-1" });
    });

    expect(vi.mocked(authedDelete).mock.calls[0][0]).toContain("c-1");
    expect(loadList).toHaveBeenCalledTimes(2);
  });
});

describe("re-queuing an announcement", () => {
  it.each([
    ["retry", useRetryAnnouncement],
    ["send", useSendAnnouncement],
  ])("%s shows the post as Queued at once and reloads the Operations board", async (_name, useHook) => {
    const qc = new QueryClient({ defaultOptions: { queries: { refetchOnMount: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const board = (status: "FAILED" | "NONE") => ({
      campaigns: [
        { campaignId: "c1", announcement: { status } },
        { campaignId: "c2", announcement: { status: "SENT" } },
      ],
    });
    type Board = ReturnType<typeof board>;
    // The first load seeds the cache; the refetch the mutation triggers waits on `release`, so the cache can be read
    // while the board is still reloading.
    let release: (b: Board) => void = () => {};
    const load = vi
      .fn<() => Promise<Board>>()
      .mockResolvedValueOnce(board("FAILED"))
      .mockImplementationOnce(() => new Promise<Board>((resolve) => (release = resolve)));
    const key = ["amplify", "dashboard-operations", "sub-1"];
    await qc.fetchQuery({ queryKey: key, queryFn: load });
    const { result } = renderHook(() => useHook(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ campaignId: "c1" });
    });
    // POST accepted, refetch still pending: c1 already reads QUEUED, c2 is untouched.
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    const queued = qc.getQueryData<Board>(key);
    expect(queued?.campaigns[0].announcement.status).toBe("QUEUED");
    expect(queued?.campaigns[1].announcement.status).toBe("SENT");
    // The refetch then replaces it with the server's answer.
    await act(async () => release({ campaigns: [{ campaignId: "c1", announcement: { status: "SENT" } }, { campaignId: "c2", announcement: { status: "SENT" } }] }));
    await waitFor(() => expect(qc.getQueryData<Board>(key)?.campaigns[0].announcement.status).toBe("SENT"));
  });
});

// Seeds a cached query no page is showing; the mutation must refetch it itself (refetchOnMount is off).
async function setupWithCached(...keys: unknown[][]) {
  const qc = new QueryClient({ defaultOptions: { queries: { refetchOnMount: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const loads = keys.map(() => vi.fn(async () => ({})));
  for (const [i, queryKey] of keys.entries()) await qc.fetchQuery({ queryKey, queryFn: loads[i] });
  return { wrapper, loads };
}

describe("submitting an own post", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the claim to POST /external-shares and refetches the caller's own claims", async () => {
    const { wrapper, loads } = await setupWithCached(["amplify", "my-external-shares", "sub-1"]);
    const { result } = renderHook(() => useClaimOwnPost(), { wrapper });
    const claim = { evidenceUrl: "https://www.linkedin.com/posts/x-activity-1-a", certified: true as const, note: "Hi" };
    await act(async () => {
      await result.current.mutateAsync(claim);
    });
    expect(vi.mocked(authedPost).mock.calls[0]).toEqual(["/external-shares", "token", claim]);
    expect(loads[0]).toHaveBeenCalledTimes(2);
  });
});

describe("review decisions", () => {
  beforeEach(() => vi.clearAllMocks());

  const lists = [
    ["amplify", "external-shares-review", "sub-1", "PENDING", 0],
    ["amplify", "external-shares-review", "sub-1", "PENDING", "count"],
    ["amplify", "points-history", "sub-1", "e-9"],
  ];

  it("approves by id, then refetches the review lists, the waiting count and the person's points", async () => {
    const { wrapper, loads } = await setupWithCached(...lists);
    const { result } = renderHook(() => useApproveExternalShare(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "x 1", employeeId: "e-9" });
    });
    expect(vi.mocked(authedPost).mock.calls[0][0]).toBe("/po/external-shares/x%201/approve");
    for (const load of loads) expect(load).toHaveBeenCalledTimes(2);
  });

  it("features by id, then refetches the same", async () => {
    const { wrapper, loads } = await setupWithCached(...lists);
    const { result } = renderHook(() => useFeatureExternalShare(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "x-1", employeeId: "e-9" });
    });
    expect(vi.mocked(authedPost).mock.calls[0][0]).toBe("/po/external-shares/x-1/amplified");
    for (const load of loads) expect(load).toHaveBeenCalledTimes(2);
  });

  it("declines with the reason in the body", async () => {
    const { wrapper, loads } = await setupWithCached(lists[0]);
    const { result } = renderHook(() => useDeclineExternalShare(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "x-1", reason: "Other — not a post" });
    });
    expect(vi.mocked(authedPost).mock.calls[0]).toEqual([
      "/po/external-shares/x-1/reject",
      "token",
      { reason: "Other — not a post" },
    ]);
    expect(loads[0]).toHaveBeenCalledTimes(2);
  });
});

describe("points corrections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reverses a row by reference with the reason, then refetches that person's history", async () => {
    const { wrapper, loads } = await setupWithCached(["amplify", "points-history", "sub-1", "e-9"]);
    const { result } = renderHook(() => useReversePoints(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reference: "ENG-1", employeeId: "e-9", reason: "Duplicate" });
    });
    expect(vi.mocked(authedPost).mock.calls[0]).toEqual(["/po/points/ENG-1/reverse", "token", { reason: "Duplicate" }]);
    expect(loads[0]).toHaveBeenCalledTimes(2);
  });

  it("adds a signed correction for the person, then refetches their history", async () => {
    const { wrapper, loads } = await setupWithCached(["amplify", "points-history", "sub-1", "e-9"]);
    const { result } = renderHook(() => useAdjustPoints(), { wrapper });
    const body = { employeeId: "e-9", points: -2, reason: "Double count" };
    await act(async () => {
      await result.current.mutateAsync(body);
    });
    expect(vi.mocked(authedPost).mock.calls[0]).toEqual(["/po/points/adjustments", "token", body]);
    expect(loads[0]).toHaveBeenCalledTimes(2);
  });
});

describe("point values", () => {
  it("posts the new value for one action and refetches the rules", async () => {
    vi.clearAllMocks();
    const { wrapper, loads } = await setupWithCached(["amplify", "point-rules", "sub-1"]);
    const { result } = renderHook(() => useSetPointRule(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ action: "REPOST", points: 6 });
    });
    expect(vi.mocked(authedPost).mock.calls[0]).toEqual(["/po/point-rules", "token", { action: "REPOST", points: 6 }]);
    expect(loads[0]).toHaveBeenCalledTimes(2);
  });
});
