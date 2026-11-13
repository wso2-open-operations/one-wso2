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

import { describe, expect, it } from "vitest";
import { HttpError } from "@api/http";
import {
  errorCodeOf,
  isOutsideWso2,
  messageFor,
  orderFailureMessage,
  problemMessage,
  swagStoreRetry,
} from "./swagStoreError";

const failure = (status: number, body: unknown) =>
  new HttpError("https://store.example/x", status, typeof body === "string" ? body : JSON.stringify(body));

describe("errorCodeOf", () => {
  it("reads the backend's errorCode", () => {
    expect(errorCodeOf(failure(402, { message: "m", errorCode: "insufficient_funds" }))).toBe("insufficient_funds");
  });

  it("is undefined for a body with no code, a non-JSON body, or a non-HTTP error", () => {
    expect(errorCodeOf(failure(500, { message: "m" }))).toBeUndefined();
    expect(errorCodeOf(failure(502, "<html>gateway</html>"))).toBeUndefined();
    expect(errorCodeOf(new Error("Failed to fetch"))).toBeUndefined();
  });
});

describe("messageFor", () => {
  it("maps a known code to the store's own wording, whatever the message says", () => {
    expect(messageFor(failure(402, { message: "balance 12.5 < 40", errorCode: "insufficient_funds" }))).toBe(
      "This wallet doesn't have enough O2C for this order.",
    );
  });

  it("falls back to the server's message for a code it does not know", () => {
    expect(messageFor(failure(409, { message: "Not enough stock left.", errorCode: "out_of_stock" }))).toBe(
      "Not enough stock left.",
    );
    expect(messageFor(failure(400, { message: "Bad quantity." }))).toBe("Bad quantity.");
  });

  it("never shows a raw body", () => {
    expect(messageFor(failure(502, "<html>stack trace</html>"))).toBe("Something went wrong (HTTP 502).");
  });
});

describe("isOutsideWso2", () => {
  it("is true only for the 403 not_wso2 answer", () => {
    expect(isOutsideWso2(failure(403, { message: "m", errorCode: "not_wso2" }))).toBe(true);
    expect(isOutsideWso2(failure(403, { message: "Forbidden" }))).toBe(false);
    expect(isOutsideWso2(failure(503, { message: "m", errorCode: "not_wso2" }))).toBe(false);
  });
});

describe("swagStoreRetry", () => {
  it("never retries a 4xx, and retries a 5xx once", () => {
    expect(swagStoreRetry(0, failure(404, {}))).toBe(false);
    expect(swagStoreRetry(0, failure(503, {}))).toBe(true);
    expect(swagStoreRetry(1, failure(503, {}))).toBe(false);
  });
});

describe("problemMessage", () => {
  it("uses the store's wording for a known code, else the backend's message", () => {
    expect(problemMessage({ code: "insufficient_funds", message: "balance below total" })).toBe(
      "This wallet doesn't have enough O2C for this order.",
    );
    expect(problemMessage({ code: "office_unavailable", message: "Choose an open pickup office." })).toBe(
      "Choose an open pickup office.",
    );
  });
});

describe("orderFailureMessage", () => {
  it("says no coins were taken for a refused payment", () => {
    expect(orderFailureMessage("insufficient_funds")).toBe(
      "This wallet doesn't have enough O2C for this order. No coins were taken.",
    );
    expect(orderFailureMessage("payment_failed")).toBe("The payment didn't go through. No coins were taken.");
    expect(orderFailureMessage(null)).toBe("The payment didn't go through. No coins were taken.");
  });

  it("never says so for a payment that couldn't be matched", () => {
    expect(orderFailureMessage("payment_mismatch")).not.toMatch(/No coins were taken/);
  });
});
