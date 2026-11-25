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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Perspectives = typeof import("@constants/perspectives");

async function load(): Promise<Perspectives> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: { amplify: true },
  } as Window["config"];
  return import("@constants/perspectives");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

describe("Amplify Dashboarding menu", () => {
  it("is one group whose children run At A Glance first", async () => {
    const { PERSPECTIVES } = await load();
    const amplify = PERSPECTIVES.find((p) => p.key === "amplify");
    const group = amplify?.sections?.find((s) => s.label === "Dashboarding");
    expect(group?.children?.map((c) => c.label)).toEqual([
      "At A Glance",
      "Operations",
      "Post Performance",
      "Participation",
      "Scorecard",
    ]);
    expect(group?.children?.map((c) => c.path)).toEqual([
      "/amplify/dashboards/glance",
      "/amplify/dashboards/operations",
      "/amplify/dashboards/posts",
      "/amplify/dashboards/participation",
      "/amplify/dashboards/scorecard",
    ]);
  });

  it("claims every board id so the role gate answers for them", async () => {
    const m = await load();
    const group = m.PERSPECTIVES.find((p) => p.key === "amplify")?.sections?.find((s) => s.label === "Dashboarding");
    for (const child of group?.children ?? []) expect(m.AMPLIFY_DASHBOARD_ITEM_IDS.has(child.id)).toBe(true);
    expect(m.AMPLIFY_DASHBOARD_ITEM_IDS.size).toBe(5);
  });
});

describe("Amplify PO team rows", () => {
  it("sit after Current Posts, with Amplify Admin last, each on its own path", async () => {
    const m = await load();
    const amplify = m.PERSPECTIVES.find((p) => p.key === "amplify");
    expect(amplify?.sections?.map((s) => s.label)).toEqual([
      "Celebrate",
      "My points & Coins",
      "New Post",
      "Current Posts",
      "Review own posts",
      "Points & corrections",
      "Dashboarding",
      "Amplify Admin",
    ]);
    const byId = new Map((amplify?.sections ?? []).map((s) => [s.id, s.path]));
    expect(byId.get(m.AMPLIFY_REVIEW_ITEM_ID)).toBe("/amplify/review");
    expect(byId.get(m.AMPLIFY_POINTS_ITEM_ID)).toBe("/amplify/points");
    expect(byId.get(m.AMPLIFY_ADMIN_ITEM_ID)).toBe("/amplify/admin");
  });
});

describe("Amplify My points & Coins row", () => {
  it("sits after Celebrate on its own path, apart from the PO team's Points & corrections", async () => {
    const m = await load();
    const amplify = m.PERSPECTIVES.find((p) => p.key === "amplify");
    const row = amplify?.sections?.find((s) => s.id === m.AMPLIFY_MY_POINTS_ITEM_ID);
    expect(row?.label).toBe("My points & Coins");
    expect(row?.path).toBe("/amplify/my-points");
    expect(m.AMPLIFY_MY_POINTS_PATH).not.toBe(m.AMPLIFY_POINTS_PATH);
  });
});
