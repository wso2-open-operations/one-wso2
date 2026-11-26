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

describe("Amplify Dashboards menu", () => {
  it("is one group whose children run At A Glance first", async () => {
    const { PERSPECTIVES } = await load();
    const amplify = PERSPECTIVES.find((p) => p.key === "amplify");
    const group = amplify?.sections?.find((s) => s.label === "Dashboards");
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

  it("puts New Post and Current Posts under Marketing and Team under People Operations, in that order", async () => {
    const { PERSPECTIVES } = await load();
    const sections = PERSPECTIVES.find((p) => p.key === "amplify")?.sections ?? [];
    expect(sections.map((s) => s.label)).toEqual(["Celebrate", "Marketing", "People Operations", "Dashboards"]);
    const marketing = sections.find((s) => s.label === "Marketing");
    expect(marketing?.alwaysGroup).toBe(true);
    expect(marketing?.children?.map((c) => [c.label, c.path])).toEqual([
      ["New Post", "/amplify/new-post"],
      ["Current Posts", "/amplify/current-posts"],
    ]);
    const people = sections.find((s) => s.label === "People Operations");
    expect(people?.alwaysGroup).toBe(true);
    expect(people?.children?.map((c) => [c.label, c.path])).toEqual([["Team", "/amplify/dashboards/team"]]);
  });

  it("claims every board id so the role gate answers for them", async () => {
    const m = await load();
    const group = m.PERSPECTIVES.find((p) => p.key === "amplify")?.sections?.find((s) => s.label === "Dashboards");
    for (const child of group?.children ?? []) expect(m.AMPLIFY_DASHBOARD_ITEM_IDS.has(child.id)).toBe(true);
    expect(m.AMPLIFY_DASHBOARD_ITEM_IDS.size).toBe(5);
    // The Team board moved to People Operations and has its own grant, so the dashboard gate no longer claims it.
    expect(m.AMPLIFY_DASHBOARD_ITEM_IDS.has("amplify-dashboard-team")).toBe(false);
    expect([...m.AMPLIFY_PEOPLE_OPS_ITEM_IDS]).toEqual(["amplify-dashboard-team"]);
  });
});
