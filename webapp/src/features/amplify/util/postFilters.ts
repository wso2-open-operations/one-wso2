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

import type { Campaign, Category } from "../api/amplifyTypes";

/** How many post cards Celebrate shows before "Show all". */
export const POST_GRID_SIZE = 6;

/** A post filter: every post, priority posts, or one category (`category:<code>`). */
export type PostFilter = "all" | "priority" | `category:${string}`;

/** One post filter chip: what it selects, its label and how many posts it shows. */
export interface PostFilterOption {
  value: PostFilter;
  label: string;
  count: number;
}

/** The filter for one category. */
export function categoryFilter(code: string): PostFilter {
  return `category:${code}`;
}

/** "1 post to amplify" or "9 posts to amplify". */
export function postsToAmplifyTitle(count: number): string {
  return `${count} ${count === 1 ? "post" : "posts"} to amplify`;
}

function openedAt(c: Pick<Campaign, "opensAt">): number {
  const t = Date.parse(c.opensAt);
  return Number.isNaN(t) ? 0 : t;
}

/** Posts in Celebrate's order: priority first, then newest. Returns a new array. */
export function sortForAmplify<T extends Pick<Campaign, "isPriority" | "opensAt">>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || openedAt(b) - openedAt(a));
}

/** Whether a post shows under `filter`. */
export function matchesPostFilter(c: Pick<Campaign, "isPriority" | "categoryCode">, filter: PostFilter): boolean {
  if (filter === "all") return true;
  if (filter === "priority") return c.isPriority;
  return filter === categoryFilter(c.categoryCode);
}

/**
 * The chips for `items`: All, Priority (when any post is), then one per category present, in the categories' order
 * (a code the list doesn't know goes last, labelled with its code). Each carries its count.
 */
export function postFilterOptions(
  items: readonly Pick<Campaign, "isPriority" | "categoryCode">[],
  categories: readonly Category[] | undefined,
): PostFilterOption[] {
  const counts = new Map<string, number>();
  for (const c of items) counts.set(c.categoryCode, (counts.get(c.categoryCode) ?? 0) + 1);
  const known = (categories ?? []).filter((cat) => counts.has(cat.code));
  const knownCodes = new Set(known.map((cat) => cat.code));
  const unknown = [...counts.keys()].filter((code) => !knownCodes.has(code)).sort();
  const priority = items.filter((c) => c.isPriority).length;
  return [
    { value: "all", label: "All", count: items.length },
    ...(priority > 0 ? [{ value: "priority" as const, label: "Priority", count: priority }] : []),
    ...known.map((cat) => ({ value: categoryFilter(cat.code), label: cat.label, count: counts.get(cat.code) ?? 0 })),
    ...unknown.map((code) => ({ value: categoryFilter(code), label: code, count: counts.get(code) ?? 0 })),
  ];
}
