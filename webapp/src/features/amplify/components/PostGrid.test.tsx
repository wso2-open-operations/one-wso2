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

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { Campaign, Category } from "../api/amplifyTypes";

vi.mock("../api/useAmplifyData", () => ({ isAmplifyBackendConfigured: () => true }));

import PostGrid from "./PostGrid";

const categories: Category[] = [
  { code: "PRODUCT", label: "Product", sortOrder: 1 },
  { code: "EVENTS", label: "Events", sortOrder: 2 },
];

const campaign = (n: number, categoryCode: string, isPriority = false): Campaign => ({
  id: `c-${n}`,
  resourceUrn: `urn:li:share:${n}`,
  title: `Post ${n}`,
  categoryCode,
  isPriority,
  tags: [],
  // Higher n opens later, so it is newer.
  opensAt: new Date(Date.UTC(2026, 10, n)).toISOString(),
  closesAt: "2026-12-31T00:00:00Z",
  status: "OPEN",
  version: 1,
});

// Nine posts: two priority (Post 1 and Post 2), five Product and four Events.
const nine = [
  campaign(1, "EVENTS", true),
  campaign(2, "PRODUCT", true),
  ...[3, 4, 5, 6].map((n) => campaign(n, "PRODUCT")),
  ...[7, 8, 9].map((n) => campaign(n, "EVENTS")),
];

function renderGrid(items: Campaign[] = nine) {
  return render(
    <PostGrid items={items} categories={categories} renderItem={(c) => <article aria-label={c.title} />} />,
  );
}

const cards = () => screen.queryAllByRole("article").map((a) => a.getAttribute("aria-label"));
const chip = (name: string) => screen.getByRole("button", { name });

describe("PostGrid", () => {
  it("says how many posts are waiting and shows six, priority first then newest", () => {
    renderGrid();
    expect(screen.getByRole("region", { name: "9 posts to amplify" })).toBeTruthy();
    expect(cards()).toEqual(["Post 2", "Post 1", "Post 9", "Post 8", "Post 7", "Post 6"]);
  });

  it("offers All, Priority and one chip per category present, each with its count", () => {
    renderGrid();
    const chips = within(screen.getByRole("group", { name: "Filter posts" })).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual(["All 9", "Priority 2", "Product 5", "Events 4"]);
    expect(chip("All 9").getAttribute("aria-pressed")).toBe("true");
  });

  it("filters by priority and by category", () => {
    renderGrid();
    fireEvent.click(chip("Priority 2"));
    expect(cards()).toEqual(["Post 2", "Post 1"]);
    expect(chip("Priority 2").getAttribute("aria-pressed")).toBe("true");
    expect(chip("All 9").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip("Events 4"));
    expect(cards()).toEqual(["Post 1", "Post 9", "Post 8", "Post 7"]);
    // The title still counts every waiting post.
    expect(screen.getByRole("region", { name: "9 posts to amplify" })).toBeTruthy();
  });

  it("shows the rest with Show all and folds them back with Show less", () => {
    renderGrid();
    const showAll = screen.getByRole("button", { name: "Show all 9 posts" });
    expect(showAll.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(showAll);
    expect(cards()).toHaveLength(9);
    const showLess = screen.getByRole("button", { name: "Show less" });
    expect(showLess.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(showLess);
    expect(cards()).toHaveLength(6);
  });

  it("counts Show all within the filter, and drops it when the filter fits", () => {
    renderGrid([...nine, ...[10, 11, 12].map((n) => campaign(n, "PRODUCT"))]);
    fireEvent.click(chip("Product 8"));
    expect(screen.getByRole("button", { name: "Show all 8 posts" })).toBeTruthy();
    fireEvent.click(chip("Events 4"));
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("starts folded again when the filter changes", () => {
    renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Show all 9 posts" }));
    fireEvent.click(chip("Product 5"));
    fireEvent.click(chip("All 9"));
    expect(cards()).toHaveLength(6);
  });

  it("has no Show all when six or fewer posts are waiting", () => {
    renderGrid(nine.slice(0, 6));
    expect(cards()).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("shows everything again when the filtered posts are all gone", () => {
    const { rerender } = renderGrid();
    fireEvent.click(chip("Priority 2"));
    const rest = nine.filter((c) => !c.isPriority);
    rerender(<PostGrid items={rest} categories={categories} renderItem={(c) => <article aria-label={c.title} />} />);
    expect(screen.getByRole("region", { name: "7 posts to amplify" })).toBeTruthy();
    expect(cards()).toHaveLength(6);
    expect(screen.queryByRole("button", { name: /^Priority/ })).toBeNull();
  });
});
