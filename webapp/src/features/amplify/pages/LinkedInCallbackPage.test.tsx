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
import { render, screen, waitFor } from "@testing-library/react";
import { HttpError } from "@api/http";

const h = vi.hoisted(() => ({
  params: new URLSearchParams(),
  navigate: vi.fn(),
  completeMember: vi.fn(),
  completePage: vi.fn(),
  completeReach: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock("react-router", () => ({
  useSearchParams: () => [h.params],
  useNavigate: () => h.navigate,
}));
vi.mock("../api/useAmplifyMutations", () => ({
  useCompleteLinkedInConnect: () => ({ mutateAsync: h.completeMember }),
  useCompleteLinkedInPageConnect: () => ({ mutateAsync: h.completePage }),
  useCompleteReachConnect: () => ({ mutateAsync: h.completeReach }),
}));
vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: h.showSuccess, showError: vi.fn() }),
}));

import LinkedInCallbackPage, { PAGE_CONNECTED_MESSAGE, REACH_ON_MESSAGE } from "./LinkedInCallbackPage";
import { isPageConnectState, rememberPageConnect } from "../util/pageConnect";

const STATE = "s".repeat(40);
const redirectUri = `${window.location.origin}${window.location.pathname}`;

beforeEach(() => {
  h.navigate.mockReset();
  h.completeMember.mockReset();
  h.completePage.mockReset();
  h.completeReach.mockReset();
  h.showSuccess.mockReset();
  window.sessionStorage.clear();
  h.params = new URLSearchParams({ code: "code-1", state: STATE });
});

describe("LinkedInCallbackPage", () => {
  it("completes an employee's own link and returns to where it started", async () => {
    h.completeMember.mockResolvedValue({ status: "ACTIVE", returnTo: "/amplify/celebrate?share=c-1" });
    render(<LinkedInCallbackPage />);
    expect(screen.getByText("Linking your LinkedIn account…")).toBeTruthy();
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/amplify/celebrate?share=c-1", { replace: true }));
    expect(h.completeMember).toHaveBeenCalledWith({ code: "code-1", state: STATE, redirectUri });
    expect(h.completePage).not.toHaveBeenCalled();
  });

  it("completes the page connection this tab started, then returns to Amplify Admin", async () => {
    rememberPageConnect(STATE);
    h.completePage.mockResolvedValue({ connected: true });
    render(<LinkedInCallbackPage />);
    expect(screen.getByText("Connecting the Choreo Labs page…")).toBeTruthy();
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/amplify/admin", { replace: true }));
    expect(h.completePage).toHaveBeenCalledWith({ code: "code-1", state: STATE, redirectUri });
    expect(h.completeMember).not.toHaveBeenCalled();
    expect(h.showSuccess).toHaveBeenCalledWith(PAGE_CONNECTED_MESSAGE);
    // A state is single-use.
    expect(isPageConnectState(STATE)).toBe(false);
  });

  it("explains a page admin check that failed, with a way back to Amplify Admin", async () => {
    rememberPageConnect(STATE);
    h.completePage.mockRejectedValue(new HttpError("/x", 403, JSON.stringify({ status: 403, code: "NOT_PAGE_ADMIN" })));
    render(<LinkedInCallbackPage />);
    expect(
      await screen.findByText(
        "Your LinkedIn account isn't an administrator of the Choreo Labs page. Ask a page admin to connect it.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to Amplify Admin" })).toBeTruthy();
  });

  it("says an expired page sign-in starts again from Amplify Admin", async () => {
    rememberPageConnect(STATE);
    h.completePage.mockRejectedValue(new HttpError("/x", 409, JSON.stringify({ status: 409, code: "OAUTH_STATE_INVALID" })));
    render(<LinkedInCallbackPage />);
    expect(await screen.findByText("That LinkedIn sign-in expired or was already used. Start again from Amplify Admin.")).toBeTruthy();
  });

  it("says the page wasn't connected when the admin cancels at LinkedIn", () => {
    rememberPageConnect(STATE);
    h.params = new URLSearchParams({ error: "user_cancelled_authorize", state: STATE });
    render(<LinkedInCallbackPage />);
    expect(screen.getByText("The Choreo Labs page wasn't connected. You can try again from Amplify Admin.")).toBeTruthy();
    expect(h.completePage).not.toHaveBeenCalled();
  });

  it("says LinkedIn wasn't linked when an employee cancels", () => {
    h.params = new URLSearchParams({ error: "user_cancelled_authorize", state: STATE });
    render(<LinkedInCallbackPage />);
    expect(screen.getByText("LinkedIn wasn't linked. You can try again any time.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to Celebrate" })).toBeTruthy();
  });

  it("completes a Reach consent (a reach- state), then returns to My points & Coins", async () => {
    const reachState = `reach-${"r".repeat(40)}`;
    h.params = new URLSearchParams({ code: "code-1", state: reachState });
    h.completeReach.mockResolvedValue({ connected: true, status: "CONNECTED" });
    render(<LinkedInCallbackPage />);
    expect(screen.getByText("Turning on reach…")).toBeTruthy();
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/amplify/my-points", { replace: true }));
    expect(h.completeReach).toHaveBeenCalledWith({ code: "code-1", state: reachState, redirectUri });
    expect(h.completeMember).not.toHaveBeenCalled();
    expect(h.completePage).not.toHaveBeenCalled();
    expect(h.showSuccess).toHaveBeenCalledWith(REACH_ON_MESSAGE);
  });

  it("explains a Reach grant without the analytics scope", async () => {
    h.params = new URLSearchParams({ code: "code-1", state: "reach-x" });
    h.completeReach.mockRejectedValue(new HttpError("/x", 422, JSON.stringify({ status: 422, code: "REACH_SCOPE_MISSING" })));
    render(<LinkedInCallbackPage />);
    expect(await screen.findByText("LinkedIn didn't allow Amplify to read your posts' reach. Try again and allow it.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to My points & Coins" })).toBeTruthy();
  });

  it("says reach wasn't turned on when the employee cancels", () => {
    h.params = new URLSearchParams({ error: "user_cancelled_authorize", state: "reach-x" });
    render(<LinkedInCallbackPage />);
    expect(screen.getByText("Reach wasn't turned on. You can allow it any time from My points & Coins.")).toBeTruthy();
  });
});
