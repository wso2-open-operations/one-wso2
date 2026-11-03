/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/** The prefix of the per-user key that records a dismissed guide, followed by the user's Asgardeo `sub`. */
const STORAGE_KEY_BASE = "one-wso2.cc-autofill-guide.v1";

/**
 * Whether this user has dismissed the autofill guide. An unknown user or blocked storage reads as not dismissed, so the
 * guide shows.
 */
export function isAutofillGuideDismissed(sub: string | undefined): boolean {
  if (!sub) return false;
  try {
    return localStorage.getItem(`${STORAGE_KEY_BASE}.${sub}`) === "true";
  } catch {
    return false;
  }
}

/** Remembers that this user dismissed the autofill guide. Nothing is kept for an unknown user or blocked storage. */
export function dismissAutofillGuide(sub: string | undefined): void {
  if (!sub) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_BASE}.${sub}`, "true");
  } catch {
    // Dismissed for this visit only.
  }
}
