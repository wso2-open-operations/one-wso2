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

// Location state a page passes when it links to an update, so the update
// page's back arrow can return to it (with whatever that page needs to
// restore) instead of the updates list.
export interface UmtBackLinkState {
  backTo: string;
  backState?: unknown;
}

export const UMT_UPDATES_LIST_PATH = "/umt/updates";

// Only in-app UMT paths are honoured: location state can be set by anything
// that navigates here, so it must not be able to point the arrow elsewhere.
export function umtBackLink(state: unknown): UmtBackLinkState {
  if (state && typeof state === "object" && "backTo" in state) {
    const { backTo, backState } = state as { backTo: unknown; backState?: unknown };
    if (typeof backTo === "string" && backTo.startsWith("/umt/")) return { backTo, backState };
  }
  return { backTo: UMT_UPDATES_LIST_PATH };
}
