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

import { describe, expect, it } from "vitest";
import type { Category } from "../api/amplifyTypes";
import {
  categoryFilter,
  matchesPostFilter,
  postFilterOptions,
  postsToAmplifyTitle,
  sortForAmplify,
} from "./postFilters";

const post = (id: string, categoryCode: string, isPriority = false, opensAt = "2026-11-01T00:00:00Z") => ({
  id,
  categoryCode,
  isPriority,
  opensAt,
});

const categories: Category[] = [
  { code: "EVENTS", label: "Events", sortOrder: 2 },
  { code: "PRODUCT", label: "Product", sortOrder: 1 },
  { code: "CAREERS", label: "Careers", sortOrder: 3 },
].sort((a, b) => a.sortOrder - b.sortOrder);

describe("postsToAmplifyTitle", () => {
  it("says how many posts are waiting", () => {
    expect(postsToAmplifyTitle(9)).toBe("9 posts to amplify");
    expect(postsToAmplifyTitle(1)).toBe("1 post to amplify");
  });
});

describe("sortForAmplify", () => {
  it("puts priority posts first, then the newest", () => {
    const sorted = sortForAmplify([
      post("old", "PRODUCT", false, "2026-10-01T00:00:00Z"),
      post("new", "PRODUCT", false, "2026-11-20T00:00:00Z"),
      post("old-priority", "EVENTS", true, "2026-09-01T00:00:00Z"),
      post("new-priority", "EVENTS", true, "2026-11-10T00:00:00Z"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["new-priority", "old-priority", "new", "old"]);
  });
});

describe("postFilterOptions", () => {
  it("offers All, Priority and the categories present in the categories' order, each with its count", () => {
    const items = [post("a", "EVENTS", true), post("b", "PRODUCT"), post("c", "PRODUCT"), post("d", "EVENTS")];
    expect(postFilterOptions(items, categories)).toEqual([
      { value: "all", label: "All", count: 4 },
      { value: "priority", label: "Priority", count: 1 },
      { value: "category:PRODUCT", label: "Product", count: 2 },
      { value: "category:EVENTS", label: "Events", count: 2 },
    ]);
  });

  it("leaves Priority out when no post is, and puts an unknown category last by its code", () => {
    const items = [post("a", "PRODUCT"), post("b", "NEWS")];
    expect(postFilterOptions(items, categories).map((o) => o.label)).toEqual(["All", "Product", "NEWS"]);
    expect(postFilterOptions(items, undefined).map((o) => o.label)).toEqual(["All", "NEWS", "PRODUCT"]);
  });
});

describe("matchesPostFilter", () => {
  it("matches every post, priority posts, or one category", () => {
    const p = post("a", "EVENTS", true);
    expect(matchesPostFilter(p, "all")).toBe(true);
    expect(matchesPostFilter(p, "priority")).toBe(true);
    expect(matchesPostFilter(post("b", "EVENTS"), "priority")).toBe(false);
    expect(matchesPostFilter(p, categoryFilter("EVENTS"))).toBe(true);
    expect(matchesPostFilter(p, categoryFilter("PRODUCT"))).toBe(false);
  });
});
