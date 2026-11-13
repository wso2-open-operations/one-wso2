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

import { HttpError } from "@api/http";
import { describeError, httpRetry } from "@api/errors";

/** The store's wording for the backend error codes a shopper or a store admin can meet. None names a balance or a person. */
const MESSAGES: Readonly<Record<string, string>> = {
  insufficient_funds: "This wallet doesn't have enough O2C for this order.",
  limit_reached: "You've reached the limit for this item.",
  payments_paused: "Payments are paused for a moment. Your coins are safe. Try again later.",
  hr_unavailable: "We can't check your employee record right now. Try again in a minute.",
  coins_unavailable: "Your wallets can't be reached right now. Try again in a minute.",
  not_active_employee: "Only current employees can place orders. Contact the store team if this looks wrong.",
  quote_changed: "Your cart changed. Check the updated total and try again.",
  wallet_not_owned: "That wallet isn't one of yours. Pick another and try again.",
  payment_failed: "The payment was refused. No coins were taken.",
  unsupported_image: "Use a JPEG, PNG or WebP photo.",
  assets_not_configured: "Photos aren't set up in this environment.",
  assets_unavailable: "Photo storage can't be reached right now. Try again in a minute.",
};

/** The `errorCode` of a failed store request, or undefined when the body carries none. */
export function errorCodeOf(err: unknown): string | undefined {
  if (!(err instanceof HttpError) || !err.responseBody) return undefined;
  try {
    const parsed = JSON.parse(err.responseBody) as { errorCode?: unknown };
    return typeof parsed?.errorCode === "string" && parsed.errorCode ? parsed.errorCode : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What to tell a shopper about a failed store request: the store's wording for
 * a known `errorCode`, else the server's own message, else a status line.
 * Never the raw body.
 */
export function messageFor(err: unknown): string {
  const code = errorCodeOf(err);
  if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) return MESSAGES[code];
  return describeError(err);
}

/**
 * Why a FAILED order failed, from its `failureCode`. A payment that couldn't be
 * matched is the one case where coins may have moved, so it never says they didn't.
 */
export function orderFailureMessage(code: string | null): string {
  switch (code) {
    case "insufficient_funds":
    case "wallet_not_owned":
      return `${MESSAGES[code]} No coins were taken.`;
    case "payment_mismatch":
      return "We couldn't confirm this payment. The store team is checking it and will contact you.";
    default:
      return "The payment didn't go through. No coins were taken.";
  }
}

/** A quote problem in the store's words when it has them, else the backend's own message. */
export function problemMessage(problem: { code: string; message: string }): string {
  return Object.prototype.hasOwnProperty.call(MESSAGES, problem.code) ? MESSAGES[problem.code] : problem.message;
}

/** True for the backend's refusal of someone outside WSO2 (403 `not_wso2`): a denial, not a failure. */
export function isOutsideWso2(err: unknown): boolean {
  return err instanceof HttpError && err.status === 403 && errorCodeOf(err) === "not_wso2";
}

/** Query retry for store reads: no retry on 4xx, one retry otherwise. */
export const swagStoreRetry = httpRetry;
