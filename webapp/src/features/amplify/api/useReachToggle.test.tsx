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
import { act, renderHook } from "@testing-library/react";
import { HttpError } from "@api/http";

const h = vi.hoisted(() => ({ start: vi.fn(), disconnect: vi.fn(), showError: vi.fn(), showSuccess: vi.fn() }));
vi.mock("./useAmplifyMutations", () => ({
  useStartReachConnect: () => ({ mutateAsync: h.start, isPending: false }),
  useDisconnectReach: () => ({ mutateAsync: h.disconnect, isPending: false }),
}));
vi.mock("./useAmplifyData", () => ({
  useAmplifyConfig: () => ({ linkedinOrgUrn: "", privacyNoticeUrl: "", campaignLinkOrigins: ["https://www.linkedin.com"] }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: h.showError, showSuccess: h.showSuccess }),
}));

import { REACH_OFF_MESSAGE, REACH_OFF_UNAVAILABLE, useReachToggle } from "./useReachToggle";

const problem = (status: number, code: string) => new HttpError("/me/connections/reach", status, JSON.stringify({ status, code }));

beforeEach(() => {
  h.start.mockReset();
  h.disconnect.mockReset();
  h.showError.mockReset();
  h.showSuccess.mockReset();
});

describe("useReachToggle", () => {
  it("goes to LinkedIn to turn reach on", async () => {
    h.start.mockResolvedValue({ authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization?x", state: "reach-1", expiresAt: "x" });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      const { result } = renderHook(() => useReachToggle());
      await act(() => result.current.turnOn());
      expect(assign).toHaveBeenCalledWith("https://www.linkedin.com/oauth/v2/authorization?x");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("won't follow an authorization URL outside LinkedIn", async () => {
    h.start.mockResolvedValue({ authorizationUrl: "https://evil.test/", state: "reach-1", expiresAt: "x" });
    const { result } = renderHook(() => useReachToggle());
    await act(() => result.current.turnOn());
    expect(h.showError).toHaveBeenCalledWith("Something went wrong, please try again.");
  });

  it("explains a start LinkedIn couldn't serve", async () => {
    h.start.mockRejectedValue(problem(503, "DEPENDENCY_UNAVAILABLE"));
    const { result } = renderHook(() => useReachToggle());
    await act(() => result.current.turnOn());
    expect(h.showError).toHaveBeenCalledWith("LinkedIn couldn't be reached. Try again shortly.");
  });

  it("turns reach off and says so, or says it stays on when LinkedIn couldn't confirm", async () => {
    h.disconnect.mockResolvedValue(null);
    const { result } = renderHook(() => useReachToggle());
    await act(() => result.current.turnOff());
    expect(h.showSuccess).toHaveBeenCalledWith(REACH_OFF_MESSAGE);
    h.disconnect.mockRejectedValue(problem(503, "DEPENDENCY_UNAVAILABLE"));
    await act(() => result.current.turnOff());
    expect(h.showError).toHaveBeenCalledWith(REACH_OFF_UNAVAILABLE);
  });
});
