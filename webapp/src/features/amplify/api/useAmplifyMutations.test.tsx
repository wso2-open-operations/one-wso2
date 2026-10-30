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

import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@api/http", () => ({
  authedPost: vi.fn(async () => ({ run: "STARTED" })),
  authedPatch: vi.fn(async () => ({})),
  authedDelete: vi.fn(async () => undefined),
}));
vi.mock("@hooks/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("@hooks/useAsgardeoSub", () => ({ useAsgardeoSub: () => ({ state: { status: "ready", sub: "sub-1" } }) }));

import { authedDelete } from "@api/http";
import { useRegisterCampaign, useRemoveLinkedInConnection } from "./useAmplifyMutations";
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
