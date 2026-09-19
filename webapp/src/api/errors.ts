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

// Shared error helpers, next to HttpError. Feature slices previously carried
// byte-identical private copies (leave + finance) that had already begun to
// drift — this is the one place that logic lives now.

import { HttpError } from "@api/http";

// Translate a thrown value into a user-facing string. Prefers a well-formed
// `{message: "..."}` body; never returns the raw responseBody (which can
// carry stack traces / gateway HTML that shouldn't reach a UI banner).
export function describeError(err: unknown): string {
  if (err instanceof HttpError) {
    if (err.responseBody) {
      try {
        const parsed = JSON.parse(err.responseBody) as {
          message?: unknown;
          error?: { message?: unknown };
        };
        if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
          return parsed.message;
        }
        // Some backends (e.g. UMT) nest the message under `error` instead of
        // returning it flat.
        if (parsed?.error && typeof parsed.error.message === "string" && parsed.error.message.trim()) {
          return parsed.error.message;
        }
      } catch {
        // non-JSON body — fall through
      }
    }
    return `Something went wrong (HTTP ${err.status}).`;
  }
  if (err instanceof Error && err.message) return err.message;
  // Asgardeo's exception type is a plain class — no `extends Error`, no
  // toString — so `instanceof Error` misses it and String() on it yields
  // "[object Object]". The readable text is on `name`, an identifier on `code`.
  // `message` is deliberately not read: it holds the underlying error, which
  // for a decode failure can carry the token that failed to parse.
  if (typeof err === "object" && err !== null) {
    const { name, code } = err as { name?: unknown; code?: unknown };
    if (typeof name === "string" && name.trim()) return name;
    if (typeof code === "string" && code.trim()) return `Something went wrong (${code}).`;
  }
  return "Something went wrong.";
}

// React Query retry predicate: skip 4xx (won't improve on retry), retry once
// otherwise.
export function httpRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}
