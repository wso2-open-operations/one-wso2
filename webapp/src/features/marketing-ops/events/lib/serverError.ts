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

// What the Marketing Ops backend said went wrong. Its Events routes answer a refusal as
// FastAPI does, `{detail: {code, message}}`, which the shared describeError doesn't read
// — so "The list changed while it was being checked" would show as "Something went
// wrong (HTTP 409)".

import { describeError } from "@api/errors";
import { HttpError } from "@api/http";

/** The server's `detail` as {code, message}, when the body carries one. */
export function serverDetail(err: unknown): { code?: string; message?: string } | undefined {
  if (!(err instanceof HttpError) || !err.responseBody) return undefined;
  try {
    const detail = (JSON.parse(err.responseBody) as { detail?: unknown }).detail;
    if (!detail || typeof detail !== "object") return undefined;
    const { code, message } = detail as { code?: unknown; message?: unknown };
    return {
      code: typeof code === "string" ? code : undefined,
      message: typeof message === "string" && message.trim() ? message : undefined,
    };
  } catch {
    return undefined;
  }
}

/** describeError, preferring the message an Events route put in `detail`. */
export function describeEventsError(err: unknown): string {
  return serverDetail(err)?.message ?? describeError(err);
}
