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

const h = vi.hoisted(() => ({ me: undefined as unknown }));

vi.mock("@api/http", () => ({
  authedGet: vi.fn(),
  authedPost: vi.fn(),
  authedDelete: vi.fn(async () => undefined),
}));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => ({ isSignedIn: true }) }));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({
  useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" }, retry: vi.fn() }),
  foldIdentityError: (query: unknown) => query,
}));
vi.mock("@config/apiConfig", () => ({
  amplifyServiceUrls: {
    me: "/me",
    myNativeIntents: "/me/native-intents",
    nativeIntent: (id: string) => `/campaigns/${id}/native-intent`,
    linkedinPage: "/admin/linkedin-page",
    linkedinPageConnectStart: "/admin/linkedin-page/connect/start",
    linkedinPageConnectComplete: "/admin/linkedin-page/connect/complete",
    poPointsActionRequired: "/po/points/action-required",
    poPointsSettlement: (reference: string) => `/po/points/${reference}/settlement`,
  },
  isAmplifyBackendConfigured: () => true,
}));

import { authedDelete, authedGet, authedPost } from "@api/http";
import type { NativeIntent } from "./amplifyTypes";
import {
  NATIVE_LOOKING_POLL_MS,
  pollWhileLooking,
  useActionRequired,
  useLinkedInPage,
  useMyNativeIntents,
  useNativeRepostEnabled,
} from "./useAmplifyData";
import {
  useClearActionRequired,
  useCompleteLinkedInPageConnect,
  useDisconnectLinkedInPage,
  useRecordNativeIntent,
  useStartLinkedInPageConnect,
} from "./useAmplifyMutations";

const intent = (campaignId: string, nativeStatus: NativeIntent["nativeStatus"]): NativeIntent => ({
  campaignId,
  openedAt: "2026-11-20T10:00:00Z",
  detectedAt: null,
  nativeStatus,
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnMount: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, wrapper };
}

beforeEach(() => {
  vi.mocked(authedGet).mockReset();
  vi.mocked(authedPost).mockReset();
  vi.mocked(authedDelete).mockClear();
  vi.mocked(authedGet).mockImplementation(async (url: string) => {
    if (url === "/me") return h.me;
    if (url === "/me/native-intents") return { items: [intent("c-1", "LOOKING")] };
    if (url === "/admin/linkedin-page") return { connected: false, callsToday: 0, dailyBudget: 500 };
    throw new Error(`unexpected ${url}`);
  });
});

describe("pollWhileLooking", () => {
  it("checks every two minutes while Amplify is looking for a repost, and stops once none is", () => {
    expect(pollWhileLooking([intent("c-1", "DETECTED"), intent("c-2", "LOOKING")])).toBe(NATIVE_LOOKING_POLL_MS);
    expect(NATIVE_LOOKING_POLL_MS).toBe(120_000);
    expect(pollWhileLooking([intent("c-1", "DETECTED"), intent("c-2", "NOT_FOUND")])).toBe(false);
    expect(pollWhileLooking(undefined)).toBe(false);
  });
});

describe("useNativeRepostEnabled", () => {
  it("is on only when /me says so", async () => {
    h.me = { config: { nativeRepostDefault: true } };
    const on = setup();
    const { result } = renderHook(() => useNativeRepostEnabled(), { wrapper: on.wrapper });
    await waitFor(() => expect(result.current).toBe(true));

    h.me = { config: { linkedinOrgUrn: "", privacyNoticeUrl: "", campaignLinkOrigins: [] } };
    const off = setup();
    const { result: offResult } = renderHook(() => useNativeRepostEnabled(), { wrapper: off.wrapper });
    await waitFor(() => expect(vi.mocked(authedGet)).toHaveBeenCalledTimes(2));
    expect(offResult.current).toBe(false);
  });
});

describe("useMyNativeIntents", () => {
  it("lists the caller's intents", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useMyNativeIntents(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([intent("c-1", "LOOKING")]));
    expect(vi.mocked(authedGet)).toHaveBeenCalledWith("/me/native-intents", "token");
  });

  it("asks nothing while the button is off", () => {
    const { wrapper } = setup();
    renderHook(() => useMyNativeIntents(false), { wrapper });
    expect(vi.mocked(authedGet)).not.toHaveBeenCalled();
  });
});

describe("useRecordNativeIntent", () => {
  it("posts the click and puts the answer first in the caller's intents", async () => {
    const { qc, wrapper } = setup();
    qc.setQueryData(["amplify", "native-intents", "sub-1"], [intent("c-2", "NOT_FOUND"), intent("c-3", "DETECTED")]);
    vi.mocked(authedPost).mockResolvedValue(intent("c-2", "LOOKING"));
    // The refetch after the write answers what the server now has.
    vi.mocked(authedGet).mockResolvedValue({ items: [intent("c-2", "LOOKING"), intent("c-3", "DETECTED")] });
    const { result } = renderHook(() => useRecordNativeIntent(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ campaignId: "c-2" });
    });
    expect(vi.mocked(authedPost)).toHaveBeenCalledWith("/campaigns/c-2/native-intent", "token", {});
    expect(qc.getQueryData<NativeIntent[]>(["amplify", "native-intents", "sub-1"])?.map((i) => i.nativeStatus)).toEqual([
      "LOOKING",
      "DETECTED",
    ]);
  });
});

describe("the page connection hooks", () => {
  it("reads the page status", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useLinkedInPage(), { wrapper });
    await waitFor(() => expect(result.current.data?.dailyBudget).toBe(500));
  });

  it("asks nothing for a caller without CAN_ADMIN", () => {
    const { wrapper } = setup();
    renderHook(() => useLinkedInPage(false), { wrapper });
    expect(vi.mocked(authedGet)).not.toHaveBeenCalled();
  });

  it("starts the page flow with an empty body", async () => {
    const { wrapper } = setup();
    vi.mocked(authedPost).mockResolvedValue({ authorizationUrl: "https://www.linkedin.com/oauth", state: "s", expiresAt: "x" });
    const { result } = renderHook(() => useStartLinkedInPageConnect(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(vi.mocked(authedPost)).toHaveBeenCalledWith("/admin/linkedin-page/connect/start", "token", {});
  });

  it("completes the page flow and refetches the page status", async () => {
    const { qc, wrapper } = setup();
    const load = vi.fn(async () => ({ connected: false }));
    await qc.fetchQuery({ queryKey: ["amplify", "linkedin-page", "sub-1"], queryFn: load });
    vi.mocked(authedPost).mockResolvedValue({ connected: true });
    const { result } = renderHook(() => useCompleteLinkedInPageConnect(), { wrapper });
    const body = { code: "c", state: "s", redirectUri: "https://one.test/amplify/connect/callback" };
    await act(async () => {
      await result.current.mutateAsync(body);
    });
    expect(vi.mocked(authedPost)).toHaveBeenCalledWith("/admin/linkedin-page/connect/complete", "token", body);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("disconnects with DELETE and refetches the page status", async () => {
    const { qc, wrapper } = setup();
    const load = vi.fn(async () => ({ connected: true }));
    await qc.fetchQuery({ queryKey: ["amplify", "linkedin-page", "sub-1"], queryFn: load });
    const { result } = renderHook(() => useDisconnectLinkedInPage(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(vi.mocked(authedDelete)).toHaveBeenCalledWith("/admin/linkedin-page", "token");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("action required", () => {
  it("clears a row with status HELD and refetches the list and the person's history", async () => {
    const { qc, wrapper } = setup();
    const loadList = vi.fn(async () => ({ items: [], page: 0, size: 10, total: 0 }));
    const loadHistory = vi.fn(async () => ({ items: [] }));
    await qc.fetchQuery({ queryKey: ["amplify", "action-required", "sub-1", 0], queryFn: loadList });
    await qc.fetchQuery({ queryKey: ["amplify", "points-history", "sub-1", "e-1", 0, 5], queryFn: loadHistory });
    vi.mocked(authedPost).mockResolvedValue({});
    const { result } = renderHook(() => useClearActionRequired(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ reference: "ENG-1", employeeId: "e-1" });
    });
    expect(vi.mocked(authedPost)).toHaveBeenCalledWith("/po/points/ENG-1/settlement", "token", { status: "HELD" });
    expect(loadList).toHaveBeenCalledTimes(2);
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });

  it("asks for one page of the list", async () => {
    vi.mocked(authedGet).mockResolvedValue({ items: [], page: 1, size: 10, total: 12 });
    const { wrapper } = setup();
    const { result } = renderHook(() => useActionRequired(1), { wrapper });
    await waitFor(() => expect(result.current.data?.total).toBe(12));
    expect(vi.mocked(authedGet)).toHaveBeenCalledWith("/po/points/action-required?page=1&size=10", "token");
  });
});
