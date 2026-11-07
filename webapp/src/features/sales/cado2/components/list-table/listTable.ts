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

// What the Quotes and My Approvals lists share (D70, D144): compact cells,
// sortable columns, and the list / tree layout, remembered per page.

/** One row each, or the account › opportunity › row tree. */
export type ListLayout = "list" | "tree";

/** A column: its header, the key it sorts on, and its alignment. */
export interface ListColumn<K extends string> {
  readonly label: string;
  readonly sort: K;
  readonly align?: "left" | "right";
}

/** Sorted on one column, either way. */
export interface ListSort<K extends string> {
  readonly key: K;
  readonly dir: "asc" | "desc";
}

// Compact rows (2026-10-12 feedback: "everything is a little bit bigger than it should be").
export const LIST_CELL = { py: 1, px: 1.5 } as const;

/** The layout last chosen on a page, for next time; the page works without storage. */
export function storedLayout(key: string): ListLayout {
  try {
    return localStorage.getItem(key) === "tree" ? "tree" : "list";
  } catch {
    return "list";
  }
}

export function storeLayout(key: string, layout: ListLayout): void {
  try {
    localStorage.setItem(key, layout);
  } catch {
    // Not remembered: the page works the same.
  }
}

/** The layout from the URL (?layout=), else the one remembered. */
export function layoutFrom(param: string | null, key: string): ListLayout {
  return param === "tree" || param === "list" ? param : storedLayout(key);
}
