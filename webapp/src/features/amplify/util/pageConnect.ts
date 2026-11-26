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

/** "2 hours ago": how long before `now` the sync last ran, in the largest whole unit. */
export function agoText(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (minutes < 1) return "just now";
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return unit(hours, "hour");
  return unit(Math.floor(hours / 24), "day");
}

/** "By Ruwan Jayasinghe (page admin), Nov 20 · read-only · last sync 2 hours ago" for a connected page. */
export function connectedByText(
  page: Pick<LinkedInPage, "connectedByName" | "connectedAt" | "lastSyncAt">,
  now: Date = new Date(),
): string {
  let who = page.connectedByName ? `By ${page.connectedByName} (page admin)` : "By a page admin";
  if (page.connectedAt) who += `, ${shortDate(page.connectedAt)}`;
  const sync = page.lastSyncAt ? `last sync ${agoText(page.lastSyncAt, now)}` : "not synced yet";
  return `${who} · read-only · ${sync}`;
}

/** The share of today's budget used, 0–100; 0 when there is no budget. */
export function callsPercent(calls: number, budget: number): number {
  if (budget <= 0) return 0;
  return Math.min(100, Math.round((calls / budget) * 100));
}
