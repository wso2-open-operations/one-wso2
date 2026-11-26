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
  NOT_WSO2_RESOURCE: "That post isn't on the Choreo Labs company page.",
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
  COMMENTARY_NOT_OWN_WORDS:
    "Add a few more words of your own. Words copied from the post don't count. Or share it without thoughts.",
  FEATURE_DISABLED: "Sharing is paused right now. Try again later.",
  OAUTH_STATE_INVALID: "That LinkedIn link expired. Start again from Celebrate.",
  MEMBER_ALREADY_LINKED: "That LinkedIn account is already linked to another employee.",
  MISSING_SCOPE: "LinkedIn didn't grant sharing permission. Try again and allow it.",
  DEPENDENCY_UNAVAILABLE: "Something went wrong, please try again.",
  EVIDENCE_ALREADY_CLAIMED: "This post has already been submitted.",
  DAILY_LIMIT_REACHED: "You've reached today's limit for submitting your own posts. Try again tomorrow.",
  CERTIFICATION_REQUIRED: "Confirm that you wrote this post yourself and that it's about Choreo Labs.",
  INVALID_EVIDENCE_URL: "That doesn't look like a LinkedIn post link.",
  EVIDENCE_URL_NOT_HTTPS: "Use the post's https:// link.",
  SELF_REVIEW: "You can't decide on your own post; another marketing team member will.",
  NOT_PENDING: "Someone has already decided on this post. Reload to see where it is now.",
  NOT_APPROVED: "Approve the post before featuring it.",
  ALREADY_AMPLIFIED: "This post is already featured.",
  REASON_REQUIRED: "Add a reason.",
  ALREADY_REVERSED: "This activity has already been reversed.",
  CANNOT_REVERSE_REVERSAL: "A reversal can't be reversed.",
  INVALID_LEDGER_REFERENCE: "That activity can't be found. Reload and try again.",
  INVALID_POINTS: "Check the points and try again.",
  RULE_VERSION_EXISTS: "Someone has just changed this value. Reload and try again.",
  INVALID_SETTING: "Check the values and try again.",
  UNKNOWN_SETTING: "That setting can't be changed here.",
  NOT_PAGE_ADMIN:
    "Your LinkedIn account isn't an administrator of the Choreo Labs page. Ask a page admin to connect it.",
  NOT_REMOVABLE: "Only a LinkedIn activity can be removed. Reverse or adjust this one instead.",
  ALREADY_PAID: "These points have already become Coins. Reload to see where they are now.",
  PAID_NOT_ALLOWED: "Points become Coins only through the conversion.",
  OAUTH_REDIRECT_MISMATCH: "This LinkedIn sign-in didn't come back to Amplify's page. Start again.",
};

/** What the page connection's failures mean on Amplify Admin, checked before the shared messages. */
export const PAGE_CONNECTION_MESSAGES: Readonly<Record<string, string>> = {
  OAUTH_STATE_INVALID: "That LinkedIn sign-in expired or was already used. Start again from Amplify Admin.",
  DEPENDENCY_UNAVAILABLE: "LinkedIn couldn't be reached. Try again shortly.",
};

/** What `DEPENDENCY_UNAVAILABLE` means on Disconnect: LinkedIn didn't confirm the revoke, so the page stays connected. */
export const PAGE_DISCONNECT_UNAVAILABLE =
  "LinkedIn couldn't be reached, so the page is still connected. Try again shortly.";

/** What the removal's failures mean on Points & corrections, checked before the shared messages. */
export const REMOVAL_MESSAGES: Readonly<Record<string, string>> = {
  SELF_REVIEW: "You can't remove your own activity.",
  ALREADY_REVERSED: "This activity has already been reversed or removed. Reload to see where it is now.",
  REASON_REQUIRED: "Pick a reason, and add a note when it's Other.",
};

/** What `SELF_REVIEW` means on Points & corrections, where the refused change is to the caller's own points. */
export const SELF_CORRECTION_MESSAGE = "You can't correct your own points.";

/** What `VERSION_CONFLICT` means on Amplify Admin's settings, which show the latest values once it happens. */
export const SETTINGS_CONFLICT_MESSAGE =
  "Someone else changed these settings just now. The latest values are shown; check them and save again.";

/**
 * A sentence a person can act on, for a failed Amplify call.
 *
 * @param overrides - copy for codes whose meaning depends on the screen (`SELF_REVIEW` on Points & corrections),
 *   checked before the shared messages
 */
export function describeAmplifyError(err: unknown, overrides?: Readonly<Record<string, string>>): string {
  const code = amplifyProblemCode(err);
  if (code && overrides?.[code]) return overrides[code];
  if (code && MESSAGES[code]) return MESSAGES[code];
  return "Something went wrong, please try again.";
}

/** React Query retry: never retry a 4xx (a final answer), retry other failures once. */
export function amplifyRetry(failureCount: number, err: unknown): boolean {
  if (err instanceof HttpError && err.status >= 400 && err.status < 500) return false;
  return failureCount < 1;
}
