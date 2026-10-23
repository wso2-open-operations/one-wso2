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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import type { UmtUpdateFilters } from "../api/umtUpdates";

// The Updates list keeps its filters and its page across a trip to an update
// and back, whether by the browser's Back or the update page's back arrow, and
// nowhere else. Two halves make that up:
//
// - The view itself lives here, in memory, so a page refresh drops it. History
//   state would survive the refresh, which is the one case that must start
//   clean.
// - The way back carries a marker in its location state: the list's own
//   history entry is stamped with it, and links to an update hand it to the
//   back arrow. A visit without it (the rail, another page) starts clean.
export interface UmtUpdatesView {
  filters: UmtUpdateFilters;
  page: number;
  pageSize: number;
}

let remembered: UmtUpdatesView | null = null;

export const UMT_UPDATES_RETURN_STATE = { umtUpdatesReturn: true } as const;

export function isUmtUpdatesReturn(state: unknown): boolean {
  return Boolean(state && typeof state === "object" && "umtUpdatesReturn" in state && state.umtUpdatesReturn === true);
}

export function readRememberedUmtUpdatesView(): UmtUpdatesView | null {
  return remembered;
}

export function rememberUmtUpdatesView(view: UmtUpdatesView): void {
  remembered = view;
}
