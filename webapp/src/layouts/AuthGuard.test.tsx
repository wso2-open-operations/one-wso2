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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable so each test sets the SDK state it needs before rendering.
const auth = vi.hoisted(() => ({ isSignedIn: false, isLoading: false, signIn: vi.fn() }));
vi.mock("@asgardeo/react", () => ({ useAsgardeo: () => auth }));

import { registerAuthAccessors, SDK_SESSION_PICKUP_MS } from "@api/authBridge";
import AuthGuard from "./AuthGuard";
import { SIGN_IN_LOOP_WINDOW_MS, SIGN_IN_REDIRECT_KEY } from "./signInLoopGuard";

// What the SDK answers when asked for a token: a session it still holds, or a
// refusal. AuthBridgeMount registers the real one in the app.
const sdkGetAccessToken = vi.fn<() => Promise<string>>();

function guarded(path = "/me") {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route path="/me" element={<div>the app</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
const renderAt = (path = "/me") => render(guarded(path));

const redirectedAgo = (ms: number) => sessionStorage.setItem(SIGN_IN_REDIRECT_KEY, String(Date.now() - ms));

beforeEach(() => {
  sessionStorage.clear();
  auth.isSignedIn = false;
  auth.isLoading = false;
  auth.signIn.mockReset();
  sdkGetAccessToken.mockReset();
  sdkGetAccessToken.mockRejectedValue(new Error("not authenticated"));
  registerAuthAccessors({
    getIdToken: () => Promise.resolve("id-token"),
    getAccessToken: sdkGetAccessToken,
    signInSilently: vi.fn(),
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AuthGuard before it redirects", () => {
  // On reload with an expired access token the SDK renews it with the refresh
  // token, and the context says signed out until that finishes. Redirecting in
  // that window was a needless trip to the IdP.
  it("does not redirect while the SDK still holds a session", async () => {
    sdkGetAccessToken.mockResolvedValue("renewed-token");
    const { rerender } = renderAt();

    await waitFor(() => expect(sdkGetAccessToken).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20)); // let the check's answer land
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)).toBeNull();

    // The provider catches up on its next check.
    auth.isSignedIn = true;
    rerender(guarded());
    expect(screen.getByText("the app")).toBeInTheDocument();
  });

  it("redirects once the SDK confirms there is no session", async () => {
    renderAt();

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledTimes(1));
  });

  // The SDK and the provider disagreeing for good must not leave the spinner
  // up forever. The redirect still goes through the loop guard.
  it("redirects anyway if the provider never picks that session up", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    sdkGetAccessToken.mockResolvedValue("renewed-token");
    renderAt();

    await vi.advanceTimersByTimeAsync(SDK_SESSION_PICKUP_MS - 1);
    expect(auth.signIn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)).not.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("never picked up"));
  });

  it("does not redirect when the provider picks the session up within the wait", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    sdkGetAccessToken.mockResolvedValue("renewed-token");
    const { rerender } = renderAt();
    await vi.advanceTimersByTimeAsync(1_000);

    auth.isSignedIn = true;
    rerender(guarded());
    await vi.advanceTimersByTimeAsync(SDK_SESSION_PICKUP_MS);

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByText("the app")).toBeInTheDocument();
  });
});

describe("AuthGuard and the sign-in loop", () => {
  it("sends a signed-out user to sign in, and records that it did", async () => {
    renderAt();

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)).not.toBeNull();
  });

  // THE loop: back from a sign-in moments ago and still signed out. Another
  // redirect would bounce straight back through a live SSO session, forever.
  it("does not redirect again when the user came back still signed out", () => {
    redirectedAgo(2_000);
    renderAt();

    expect(auth.signIn).not.toHaveBeenCalled();
    expect(screen.getByText(/couldn.t sign you in/i)).toBeInTheDocument();
  });

  it("signs in again only when the user asks", () => {
    redirectedAgo(2_000);
    renderAt();

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it("redirects as usual once the last sign-in is outside the window", async () => {
    redirectedAgo(SIGN_IN_LOOP_WINDOW_MS + 1_000);
    renderAt();

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledTimes(1));
  });

  // Otherwise signing out soon after signing in would be refused its redirect.
  it("clears the record once signed in", () => {
    redirectedAgo(2_000);
    auth.isSignedIn = true;
    renderAt();

    expect(screen.getByText("the app")).toBeInTheDocument();
    expect(sessionStorage.getItem(SIGN_IN_REDIRECT_KEY)).toBeNull();
  });

  // The page load that came back from sign-in stays open, and the session is
  // lost later (the refresh token revoked at the IdP). That is not a loop.
  it("redirects when a page that signed in fine loses the session later", async () => {
    redirectedAgo(2_000);
    auth.isSignedIn = true;
    const { rerender } = renderAt();
    expect(screen.getByText("the app")).toBeInTheDocument();

    auth.isSignedIn = false;
    rerender(guarded());

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/couldn.t sign you in/i)).toBeNull();
  });

  // The SDK is still exchanging the code on the returning page load. That is a
  // sign-in in progress, not a failed one.
  it("waits while the SDK is still loading instead of calling it a loop", () => {
    redirectedAgo(2_000);
    auth.isLoading = true;
    renderAt();

    expect(screen.queryByText(/couldn.t sign you in/i)).toBeNull();
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
