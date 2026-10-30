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
import type { AmplifyProblem } from "../api/amplifyTypes";

/** The stable `code` from an amplify-api problem body, or undefined for anything else. */
export function amplifyProblemCode(err: unknown): string | undefined {
  if (!(err instanceof HttpError) || !err.responseBody) return undefined;
  try {
    const body = JSON.parse(err.responseBody) as Partial<AmplifyProblem>;
    return typeof body.code === "string" ? body.code : undefined;
  } catch {
    return undefined;
  }
}

// Copy for the codes these screens can hit. Anything else falls back to a
// generic line: `detail` is for logs, not people.
const MESSAGES: Record<string, string> = {
  ROLE_NOT_PERMITTED: "You don't have access to do that.",
  CAMPAIGN_ALREADY_REGISTERED: "That post is already in Amplify.",
  NOT_WSO2_RESOURCE: "That post isn't on the WSO2 company page.",
  INVALID_POST_URN: "That doesn't look like a LinkedIn post link.",
  INVALID_CAMPAIGN: "Check the post details and try again.",
  INVALID_WINDOW: "The tracking end date has to be after the post date.",
  VALIDATION_FAILED: "Check the post details and try again.",
  VERSION_CONFLICT: "Someone else changed this post. Reload and try again.",
  CAMPAIGN_ARCHIVED: "This post was archived.",
  CAMPAIGN_CLOSED: "This post isn't open for sharing anymore.",
  LINKEDIN_NOT_CONNECTED: "Link your LinkedIn account first.",
  NEEDS_RECONNECT: "Your LinkedIn link expired. Link it again to keep sharing.",
  DUPLICATE_ACTION: "You've already shared this post.",
  FEATURE_DISABLED: "Sharing is paused right now. Try again later.",
  OAUTH_STATE_INVALID: "That LinkedIn link expired. Start again from Celebrate.",
  MEMBER_ALREADY_LINKED: "That LinkedIn account is already linked to another employee.",
  MISSING_SCOPE: "LinkedIn didn't grant sharing permission. Try again and allow it.",
  DEPENDENCY_UNAVAILABLE: "Something went wrong, please try again.",
};

/** A sentence a person can act on, for a failed Amplify call. */
export function describeAmplifyError(err: unknown): string {
  const code = amplifyProblemCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  return "Something went wrong, please try again.";
}

/** React Query retry: never retry a 4xx (a final answer), retry other failures once. */
export function amplifyRetry(failureCount: number, err: unknown): boolean {
  if (err instanceof HttpError && err.status >= 400 && err.status < 500) return false;
  return failureCount < 1;
}
