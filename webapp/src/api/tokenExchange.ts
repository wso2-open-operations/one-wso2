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

  constructor(status: number, code: string, description: string) {
    super(`Token exchange failed (${status} ${code})${description ? `: ${description}` : ""}`);
    this.name = "TokenExchangeError";
    this.status = status;
    this.code = code;
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

async function exchange(request: TokenExchangeRequest, getSubjectToken: () => Promise<string>): Promise<Exchanged> {
  const subjectToken = await getSubjectToken();
  if (!subjectToken) throw new Error("No access token to exchange.");
  try {
    return await requestExchange(subjectToken, request);
  } catch (error) {
    // Renew this app's own session only when its token really has expired.
    // Any other refusal is a setup problem that signing in again cannot fix.
    const subjectExpired = classifyToken(subjectToken).kind === "expired";
    if (!(error instanceof TokenExchangeError) || !subjectExpired) throw error;
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
