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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@config/authConfig", () => ({ authConfig: { baseUrl: "https://idp.example/t/org/" } }));
const refreshAccessToken = vi.fn();
vi.mock("@api/authBridge", () => ({ refreshAccessToken: (...args: unknown[]) => refreshAccessToken(...args) }));

import {
  EXPIRY_MARGIN_MS,
  TokenExchangeError,
  clearExchangedTokens,
  exchangeAccessToken,
  exchangeTokens,
} from "./tokenExchange";

/** An unsigned JWT expiring `secondsFromNow` from the mocked clock. */
function jwt(secondsFromNow: number): string {
  const seg = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${seg({ alg: "RS256" })}.${seg({ exp: Math.floor(Date.now() / 1000) + secondsFromNow })}.sig`;
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const request = { clientId: "csm-client", scopes: ["openid", "roles"] };
const fetchMock = vi.fn();
let subject: string;
const getSubjectToken = vi.fn(async () => subject);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  vi.stubGlobal("fetch", fetchMock);
  subject = jwt(3600);
});

afterEach(() => {
  clearExchangedTokens();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("exchangeAccessToken", () => {
  it("sends the token exchange grant for the requested client, with no secret", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "exchanged", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("exchanged");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://idp.example/t/org/oauth2/token");
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    const body = init.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      client_id: "csm-client",
      subject_token: subject,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: "openid roles",
    });
  });

  it("returns the exchanged id token with the access token, from cache too", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "access", id_token: "id", expires_in: 3600 }));

    await expect(exchangeTokens(request, getSubjectToken)).resolves.toEqual({ accessToken: "access", idToken: "id" });
    await expect(exchangeTokens(request, getSubjectToken)).resolves.toEqual({ accessToken: "access", idToken: "id" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves the id token out when the identity provider issues none", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "access", expires_in: 3600 }));

    await expect(exchangeTokens(request, getSubjectToken)).resolves.toEqual({ accessToken: "access", idToken: undefined });
  });

  it("reuses the exchanged token until shortly before it expires", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: "first", expires_in: 3600 }))
      .mockResolvedValueOnce(ok({ access_token: "second", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("first");
    vi.advanceTimersByTime(3600_000 - EXPIRY_MARGIN_MS - 1);
    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("first");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the token's own exp when the response has no expires_in", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: jwt(600) })).mockResolvedValueOnce(ok({ access_token: "second" }));

    const first = await exchangeAccessToken(request, getSubjectToken);
    vi.advanceTimersByTime(600_000 - EXPIRY_MARGIN_MS - 1000);
    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe(first);
    vi.advanceTimersByTime(2000);
    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("second");
  });

  it("makes one exchange for concurrent callers", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "shared", expires_in: 3600 }));

    const tokens = await Promise.all([
      exchangeAccessToken(request, getSubjectToken),
      exchangeAccessToken(request, getSubjectToken),
      exchangeAccessToken(request, getSubjectToken),
    ]);

    expect(tokens).toEqual(["shared", "shared", "shared"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a separate token per client", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: "for-csm", expires_in: 3600 }))
      .mockResolvedValueOnce(ok({ access_token: "for-leave", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("for-csm");
    await expect(exchangeAccessToken({ ...request, clientId: "leave-client" }, getSubjectToken)).resolves.toBe("for-leave");
    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("for-csm");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exchanges again when the cached token was rejected by a backend", async () => {
    fetchMock
      .mockResolvedValueOnce(ok({ access_token: "first", expires_in: 3600 }))
      .mockResolvedValueOnce(ok({ access_token: "second", expires_in: 3600 }));

    await exchangeAccessToken(request, getSubjectToken);
    await expect(exchangeAccessToken({ ...request, rejectedToken: "first" }, getSubjectToken)).resolves.toBe("second");
  });

  it("reports the identity provider's refusal and does not cache it", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthorized_client", error_description: "Grant not allowed" }), {
          status: 400,
        }),
      )
      .mockResolvedValueOnce(ok({ access_token: "later", expires_in: 3600 }));

    const failure = await exchangeAccessToken(request, getSubjectToken).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(TokenExchangeError);
    expect(failure).toMatchObject({ status: 400, code: "unauthorized_client" });
    expect((failure as Error).message).toContain("Grant not allowed");
    // A live subject token means signing in again would not help.
    expect(refreshAccessToken).not.toHaveBeenCalled();

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("later");
  });

  it.each([
    ["long ago", -3600],
    // Inside the allowance classifyToken makes for a fast clock, where the
    // token still reads as live but the identity provider already refuses it.
    ["a few seconds ago", -5],
  ])("renews this app's session before exchanging when its own token expired %s", async (_label, seconds) => {
    subject = jwt(seconds);
    const renewed = jwt(3600);
    refreshAccessToken.mockResolvedValueOnce(renewed);
    fetchMock.mockResolvedValueOnce(ok({ access_token: "exchanged", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("exchanged");

    expect(refreshAccessToken).toHaveBeenCalledWith(subject);
    // One request only: the expired token is never sent.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("subject_token")).toBe(renewed);
  });

  it("renews and retries once when its own token runs out while the request is on its way", async () => {
    subject = jwt(2);
    const renewed = jwt(3600);
    refreshAccessToken.mockResolvedValueOnce(renewed);
    fetchMock
      .mockImplementationOnce(async () => {
        vi.advanceTimersByTime(3000);
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      })
      .mockResolvedValueOnce(ok({ access_token: "exchanged", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("exchanged");

    expect(refreshAccessToken).toHaveBeenCalledWith(subject);
    const retryBody = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as URLSearchParams;
    expect(retryBody.get("subject_token")).toBe(renewed);
  });

  // Taken from a recording: the token had 38 minutes left by its `exp`, and
  // every exchange was refused because the identity provider had revoked it.
  it("renews this app's session and retries once when its own token was revoked before it expired", async () => {
    const renewed = jwt(3600);
    refreshAccessToken.mockResolvedValueOnce(renewed);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "invalid_request",
            error_description: "Invalid Subject Token. Subject token is not ACTIVE.",
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(ok({ access_token: "exchanged", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("exchanged");

    // Passed as the refused token, so the renewal does not hand it back.
    expect(refreshAccessToken).toHaveBeenCalledWith(subject);
    const retryBody = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as URLSearchParams;
    expect(retryBody.get("subject_token")).toBe(renewed);
  });

  it("gives up after that one retry, reporting the refusal", async () => {
    refreshAccessToken.mockResolvedValueOnce(jwt(3600));
    const refusal = () =>
      new Response(
        JSON.stringify({ error: "invalid_request", error_description: "Invalid Subject Token. Subject token is not ACTIVE." }),
        { status: 400 },
      );
    fetchMock.mockResolvedValueOnce(refusal()).mockResolvedValueOnce(refusal());

    await expect(exchangeAccessToken(request, getSubjectToken)).rejects.toBeInstanceOf(TokenExchangeError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it("gets a new token for the other application once its cached one and this app's own have both expired", async () => {
    fetchMock.mockResolvedValueOnce(ok({ access_token: "first", expires_in: 3600 }));
    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("first");

    // An hour inside the other application: nothing renewed this app's token.
    vi.advanceTimersByTime(3600_000);
    const renewed = jwt(3600);
    refreshAccessToken.mockResolvedValueOnce(renewed);
    fetchMock.mockResolvedValueOnce(ok({ access_token: "second", expires_in: 3600 }));

    await expect(exchangeAccessToken(request, getSubjectToken)).resolves.toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("subject_token")).toBe(renewed);
  });
});
