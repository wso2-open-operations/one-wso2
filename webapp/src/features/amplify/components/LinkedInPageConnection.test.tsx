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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HttpError } from "@api/http";
import type { LinkedInPage } from "../api/amplifyTypes";

const h = vi.hoisted(() => ({
  page: undefined as unknown as Record<string, unknown>,
  start: vi.fn(),
  disconnect: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("../api/useAmplifyData", () => ({
  useLinkedInPage: () => h.page,
  useAmplifyConfig: () => ({ linkedinOrgUrn: "", privacyNoticeUrl: "", campaignLinkOrigins: ["https://www.linkedin.com"] }),
}));
vi.mock("../api/useAmplifyMutations", () => ({
  useStartLinkedInPageConnect: () => ({ mutateAsync: h.start, isPending: false }),
  useDisconnectLinkedInPage: () => ({ mutateAsync: h.disconnect, isPending: false }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showError: h.showError, showSuccess: h.showSuccess }),
}));

import LinkedInPageConnection, { CALLS_HELP, PAGE_DISCONNECTED_MESSAGE } from "./LinkedInPageConnection";
import { callsPercent, connectedByText, isPageConnectState } from "../util/pageConnect";

const status = (over: Partial<LinkedInPage> = {}): LinkedInPage => ({
  connected: true,
  connectedByName: "Ruwan Jayasinghe",
  connectedAt: "2026-11-20T08:00:00Z",
  accessExpiresAt: "2027-01-19T08:00:00Z",
  callsToday: 212,
  dailyBudget: 500,
  ...over,
});
const loaded = (data: LinkedInPage) => ({ data, isPending: false, isError: false, isFetching: false, error: null, refetch: h.refetch });
const problem = (status: number, code: string) => new HttpError("/admin/linkedin-page", status, JSON.stringify({ status, code }));

beforeEach(() => {
  h.start.mockReset();
  h.disconnect.mockReset();
  h.showError.mockReset();
  h.showSuccess.mockReset();
  window.sessionStorage.clear();
});

describe("connectedByText and callsPercent", () => {
  it("names who connected the page and when", () => {
    expect(connectedByText(status())).toBe("By Ruwan Jayasinghe (page admin), Nov 20 · read-only");
    expect(connectedByText(status({ connectedByName: null }))).toBe("By a page admin, Nov 20 · read-only");
  });

  it("caps the bar at the budget, and shows none without a budget", () => {
    expect(callsPercent(212, 500)).toBe(42);
    expect(callsPercent(900, 500)).toBe(100);
    expect(callsPercent(10, 0)).toBe(0);
  });
});

describe("LinkedInPageConnection", () => {
  it("shows who connected the page, today's calls against the budget and Disconnect", () => {
    h.page = loaded(status());
    render(<LinkedInPageConnection />);
    expect(screen.getByText("Connected to the Choreo Labs page")).toBeTruthy();
    expect(screen.getByText("By Ruwan Jayasinghe (page admin), Nov 20 · read-only")).toBeTruthy();
    expect(screen.getByText("212 of 500")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "LinkedIn calls today" }).getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText(CALLS_HELP)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Connect" })).toBeNull();
  });

  it("disconnects, and says so", async () => {
    h.page = loaded(status());
    h.disconnect.mockResolvedValue(null);
    render(<LinkedInPageConnection />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalledWith(PAGE_DISCONNECTED_MESSAGE));
  });

  it("says the page stays connected when LinkedIn couldn't confirm the disconnect", async () => {
    h.page = loaded(status());
    h.disconnect.mockRejectedValue(problem(503, "DEPENDENCY_UNAVAILABLE"));
    render(<LinkedInPageConnection />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith("LinkedIn couldn't be reached, so the page is still connected. Try again shortly."),
    );
  });

  it("offers Connect when the page was never connected", () => {
    h.page = loaded(status({ connected: false, connectedByName: null, connectedAt: null, accessExpiresAt: null }));
    render(<LinkedInPageConnection />);
    expect(screen.getByText("Not connected to the Choreo Labs page")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
  });

  it("names who connected it last and offers Connect again when it expired or was disconnected", () => {
    h.page = loaded(status({ connected: false, connectedAt: null, accessExpiresAt: null }));
    render(<LinkedInPageConnection />);
    expect(screen.getByText(/^Last connected by Ruwan Jayasinghe\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect again" })).toBeTruthy();
  });

  it("remembers the page state and goes to LinkedIn on Connect", async () => {
    h.page = loaded(status({ connected: false, connectedByName: null }));
    const state = "s".repeat(40);
    h.start.mockResolvedValue({ authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization?x=1", state, expiresAt: "x" });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      render(<LinkedInPageConnection />);
      fireEvent.click(screen.getByRole("button", { name: "Connect" }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith("https://www.linkedin.com/oauth/v2/authorization?x=1"));
      expect(isPageConnectState(state)).toBe(true);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("won't follow an authorization URL outside LinkedIn", async () => {
    h.page = loaded(status({ connected: false, connectedByName: null }));
    h.start.mockResolvedValue({ authorizationUrl: "https://evil.test/oauth", state: "s".repeat(40), expiresAt: "x" });
    render(<LinkedInPageConnection />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith("Something went wrong, please try again."));
    expect(isPageConnectState("s".repeat(40))).toBe(false);
  });

  it("explains a failed start", async () => {
    h.page = loaded(status({ connected: false, connectedByName: null }));
    h.start.mockRejectedValue(problem(503, "DEPENDENCY_UNAVAILABLE"));
    render(<LinkedInPageConnection />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith("LinkedIn couldn't be reached. Try again shortly."));
  });

  it("offers a retry when the status fails to load", () => {
    h.page = { data: undefined, isPending: false, isError: true, isFetching: false, error: new Error("down"), refetch: h.refetch };
    render(<LinkedInPageConnection />);
    expect(screen.getByText(/Couldn't load the page connection/)).toBeTruthy();
  });
});
