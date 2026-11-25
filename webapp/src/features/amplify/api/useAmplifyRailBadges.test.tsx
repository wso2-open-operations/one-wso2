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
import { renderHook } from "@testing-library/react";

const h = vi.hoisted(() => ({
  access: { hasAccess: true, isResolving: false, retry: () => undefined },
  count: 3 as number | undefined,
  countAsked: [] as boolean[],
  accessAsked: [] as boolean[],
}));

vi.mock("./useAmplifyEditorAccess", () => ({
  useAmplifyReviewAccess: (enabled: boolean) => {
    h.accessAsked.push(enabled);
    return h.access;
  },
}));
vi.mock("./useAmplifyData", () => ({
  useWaitingReviewCount: (enabled: boolean) => {
    h.countAsked.push(enabled);
    return { data: h.count };
  },
}));

import { useAmplifyRailBadges, waitingReviewBadge } from "./useAmplifyRailBadges";

beforeEach(() => {
  h.access = { hasAccess: true, isResolving: false, retry: () => undefined };
  h.count = 3;
  h.countAsked.length = 0;
  h.accessAsked.length = 0;
});

describe("waitingReviewBadge", () => {
  it("spells out the count up to 99", () => {
    expect(waitingReviewBadge(1)).toEqual({ label: "1", reason: "1 post waiting for review" });
    expect(waitingReviewBadge(99).label).toBe("99");
    expect(waitingReviewBadge(140)).toEqual({ label: "99+", reason: "140 posts waiting for review" });
  });
});

describe("useAmplifyRailBadges", () => {
  it("badges Review own posts with the waiting count for a reviewer", () => {
    const { result } = renderHook(() => useAmplifyRailBadges(true));
    expect(result.current).toEqual({ "amplify-review": { label: "3", reason: "3 posts waiting for review" } });
    expect(h.countAsked).toEqual([true]);
  });

  it("shows no badge when nothing is waiting", () => {
    h.count = 0;
    expect(renderHook(() => useAmplifyRailBadges(true)).result.current).toEqual({});
  });

  it("never asks for the count without the review grant", () => {
    h.access = { hasAccess: false, isResolving: false, retry: () => undefined };
    expect(renderHook(() => useAmplifyRailBadges(true)).result.current).toEqual({});
    expect(h.countAsked).toEqual([false]);
  });

  it("asks nothing off the Amplify perspective, even with a cached count", () => {
    expect(renderHook(() => useAmplifyRailBadges(false)).result.current).toEqual({});
    expect(h.accessAsked).toEqual([false]);
    expect(h.countAsked).toEqual([false]);
  });
});
