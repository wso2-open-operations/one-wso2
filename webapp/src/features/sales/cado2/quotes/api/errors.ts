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
import type { ValidationProblem } from "./quoteTypes";

/** The 422 body of a failed request, if it was one. */
export function problemOf(err: unknown): ValidationProblem | null {
  if (!(err instanceof HttpError) || err.status !== 422 || !err.responseBody) return null;
  try {
    const parsed = JSON.parse(err.responseBody) as ValidationProblem;
    return Array.isArray(parsed.issues) ? parsed : null;
  } catch {
    return null;
  }
}

/** Whether a failed save was a 409 (changed elsewhere, or no longer a draft). */
export function isConflict(err: unknown): boolean {
  return err instanceof HttpError && err.status === 409;
}

/** The backend's own words for a refused request ({"message": …}), or null. */
export function messageOf(err: unknown): string | null {
  if (!(err instanceof HttpError) || !err.responseBody) return null;
  try {
    const parsed = JSON.parse(err.responseBody) as { message?: unknown };
    return typeof parsed.message === "string" ? parsed.message : null;
  } catch {
    return null;
  }
}
