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

import type { LinkedInPage } from "../api/amplifyTypes";
import { shortDate } from "./dashboardFormat";

/**
 * Amplify Admin's page connection and an employee's own LinkedIn link both come back to /amplify/connect/callback.
 * The page flow's state is kept in this tab's session storage when it starts, so the callback page knows which of
 * the two to complete. Storage that can't be used (private mode, blocked site data) falls back to the employee flow.
 */
const PAGE_CONNECT_STATE_KEY = "amplify.linkedinPageConnectState";

/** Remembers `state` as a page connection's, just before the browser leaves for LinkedIn. */
export function rememberPageConnect(state: string): void {
  try {
    window.sessionStorage.setItem(PAGE_CONNECT_STATE_KEY, state);
  } catch {
    // Without storage the callback treats it as the employee flow, which the API answers with OAUTH_STATE_INVALID.
  }
}

/** True when `state` is the page connection this tab started. */
export function isPageConnectState(state: string | null): boolean {
  if (!state) return false;
  try {
    return window.sessionStorage.getItem(PAGE_CONNECT_STATE_KEY) === state;
  } catch {
    return false;
  }
}

/** Forgets the page connection's state once the callback has used it (a state is single-use). */
export function forgetPageConnect(): void {
  try {
    window.sessionStorage.removeItem(PAGE_CONNECT_STATE_KEY);
  } catch {
    // Nothing to forget.
  }
}

/** "By Ruwan Jayasinghe (page admin), Nov 20 · read-only" for a connected page. */
export function connectedByText(page: Pick<LinkedInPage, "connectedByName" | "connectedAt">): string {
  const parts = [page.connectedByName ? `By ${page.connectedByName} (page admin)` : "By a page admin"];
  if (page.connectedAt) parts[0] += `, ${shortDate(page.connectedAt)}`;
  return `${parts[0]} · read-only`;
}

/** The share of today's budget used, 0–100; 0 when there is no budget. */
export function callsPercent(calls: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((calls / budget) * 100));
}
