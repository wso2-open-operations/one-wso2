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

import { refreshAccessToken } from "@api/authBridge";
import { classifyToken } from "@api/tokenExpiry";
import { authConfig } from "@config/authConfig";

/**
 * Token exchange (RFC 8693): swaps this app's own access token for one issued
 * to another application's client id, so each backend only ever sees a token
 * meant for it and this app's token opens none of them.
 *
 * The exchanged tokens are kept here, in memory, until shortly before they
 * expire. Memory rather than browser storage on purpose: a reload costs one
 * extra exchange, and nothing outlives the tab.
 */

export interface TokenExchangeRequest {
  /** Client id of the application the token is for. */
  clientId: string;
  scopes: readonly string[];
  /**
   * A token from an earlier call that a backend has just refused. It is
   * dropped from the cache, so the answer is never that same token again.
   */
  rejectedToken?: string;
}

/** The identity provider refused the exchange. */
export class TokenExchangeError extends Error {
  readonly status: number;
  /** The OAuth error code, e.g. "invalid_grant" or "unauthorized_client". */
  readonly code: string;
  /** The identity provider's own wording, or "" when it gave none. */
  readonly description: string;

  constructor(status: number, code: string, description: string) {
    super(`Token exchange failed (${status} ${code})${description ? `: ${description}` : ""}`);
    this.name = "TokenExchangeError";
    this.status = status;
    this.code = code;
    this.description = description;
  }
}

/** A token this close to expiring is replaced rather than handed out. */
export const EXPIRY_MARGIN_MS = 60_000;

const TOKEN_ENDPOINT = `${authConfig.baseUrl.replace(/\/+$/, "")}/oauth2/token`;

/** What an exchange yields for the other application. */
export interface ExchangedTokens {
  accessToken: string;
  /** Present when the identity provider issued one, which needs the `openid` scope. */
  idToken?: string;
}

interface Exchanged {
  token: string;
  idToken?: string;
  /** Epoch milliseconds. 0 when unknown, which means "do not reuse". */
  expiresAt: number;
}

const cache = new Map<string, Exchanged>();
// One exchange per application at a time: a page that fires ten requests at
// once must not make ten trips to the identity provider.
const inFlight = new Map<string, Promise<Exchanged>>();

function keyFor(request: TokenExchangeRequest): string {
  return `${request.clientId} ${[...request.scopes].sort().join(" ")}`;
}

async function requestExchange(subjectToken: string, request: TokenExchangeRequest): Promise<Exchanged> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      client_id: request.clientId,
      subject_token: subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      scope: request.scopes.join(" "),
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    id_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new TokenExchangeError(response.status, body.error ?? "unknown_error", body.error_description ?? "");
  }

  // `expires_in` is what the server promises; the token's own `exp` is the
  // fallback. With neither, the token is used once and never reused.
  const fromClaim = classifyToken(body.access_token);
  const expiresAt =
    typeof body.expires_in === "number"
      ? Date.now() + body.expires_in * 1000
      : fromClaim.kind === "unknown"
        ? 0
        : fromClaim.expiresAt;
  return { token: body.access_token, idToken: body.id_token, expiresAt };
}

/**
 * Whether the token's own `exp` has passed, to the second.
 *
 * Stricter than `classifyToken`, which keeps calling a token live for a short
 * while after `exp` to allow for a clock that runs fast. The identity provider
 * makes no such allowance, so a token in that window is refused as a subject.
 */
function pastExpiry(token: string): boolean {
  const status = classifyToken(token);
  return status.kind !== "unknown" && status.expiresAt <= Date.now();
}

/**
 * Whether the identity provider refused the subject token itself, as opposed to
 * the client, the grant or the scopes.
 *
 * It answers this way for a token it has revoked before its `exp`: "Invalid
 * Subject Token. Subject token is not ACTIVE." That happens when this app's
 * session was renewed somewhere else, such as another tab, leaving this tab
 * holding the token the renewal replaced. Nothing in the token shows it, so the
 * wording is the only sign. The error code is no help: it is `invalid_request`,
 * the same as for a malformed request.
 */
function refusedSubjectToken(error: TokenExchangeError): boolean {
  return /subject token/i.test(error.description);
}

async function exchange(request: TokenExchangeRequest, getSubjectToken: () => Promise<string>): Promise<Exchanged> {
  const subjectToken = await getSubjectToken();
  if (!subjectToken) throw new Error("No access token to exchange.");

  // The other application's token usually outlives this app's own, because it
  // was issued later. So by the time it needs replacing, this app's token has
  // often expired too, and while the user is inside the other application
  // nothing here has renewed it. Renew first rather than send a token the
  // identity provider is certain to refuse.
  if (pastExpiry(subjectToken)) {
    return requestExchange(await refreshAccessToken(subjectToken), request);
  }

  try {
    return await requestExchange(subjectToken, request);
  } catch (error) {
    // Reached with a token that looked live here. Renew this app's session and
    // try once more when the token is what was refused: it ran out while the
    // request was on its way, or the identity provider had already revoked it.
    // Any other refusal is a setup problem that signing in again cannot fix.
    if (!(error instanceof TokenExchangeError)) throw error;
    if (!pastExpiry(subjectToken) && !refusedSubjectToken(error)) throw error;
    return requestExchange(await refreshAccessToken(subjectToken), request);
  }
}

function toTokens(exchanged: Exchanged): ExchangedTokens {
  return { accessToken: exchanged.token, idToken: exchanged.idToken };
}

/**
 * Tokens for another application, exchanged from this app's own access token.
 *
 * Returns the cached ones while the access token is still good, and otherwise
 * exchanges again. `getSubjectToken` supplies this app's current access token.
 */
export function exchangeTokens(
  request: TokenExchangeRequest,
  getSubjectToken: () => Promise<string>,
): Promise<ExchangedTokens> {
  const key = keyFor(request);

  const cached = cache.get(key);
  if (cached) {
    const usable = cached.token !== request.rejectedToken && cached.expiresAt - EXPIRY_MARGIN_MS > Date.now();
    if (usable) return Promise.resolve(toTokens(cached));
    cache.delete(key);
  }

  let pending = inFlight.get(key);
  if (!pending) {
    pending = exchange(request, getSubjectToken)
      .then((exchanged) => {
        cache.set(key, exchanged);
        return exchanged;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, pending);
  }
  return pending.then(toTokens);
}

/** Just the access token from {@link exchangeTokens}. */
export function exchangeAccessToken(
  request: TokenExchangeRequest,
  getSubjectToken: () => Promise<string>,
): Promise<string> {
  return exchangeTokens(request, getSubjectToken).then((tokens) => tokens.accessToken);
}

/** Forgets every exchanged token. */
export function clearExchangedTokens(): void {
  cache.clear();
  inFlight.clear();
}
