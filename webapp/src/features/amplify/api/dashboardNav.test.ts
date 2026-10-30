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
