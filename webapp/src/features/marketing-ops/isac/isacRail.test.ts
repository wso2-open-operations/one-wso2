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

import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_CONFIG = window.config;

async function marketingRail(config: Record<string, unknown>) {
  vi.resetModules();
  window.config = { ...(ORIGINAL_CONFIG ?? {}), ...config } as Window["config"];
  const { PERSPECTIVES } = await import("@constants/perspectives");
  return PERSPECTIVES.find((perspective) => perspective.key === "marketing")?.sections ?? [];
}

afterEach(() => {
  window.config = ORIGINAL_CONFIG;
});

describe("the ISAC row of the Marketing Ops rail", () => {
  it("stays an outbound link while the isac preview flag is off", async () => {
    const rail = await marketingRail({
      ONE_WSO2_PREVIEW_FEATURES: {},
      ONE_WSO2_MARKETINGOPS_ISAC_URL: "https://isac.example",
    });
    const row = rail.find((section) => section.id === "mops-isac");
    expect(row?.externalUrl).toBe("https://isac.example");
    expect(row?.children).toBeUndefined();
  });

  it("is absent with the flag off and no link configured", async () => {
    const rail = await marketingRail({ ONE_WSO2_PREVIEW_FEATURES: {}, ONE_WSO2_MARKETINGOPS_ISAC_URL: "" });
    expect(rail.find((section) => section.id === "mops-isac")).toBeUndefined();
  });

  it("becomes a group of in-app screens when the flag is on", async () => {
    const rail = await marketingRail({
      ONE_WSO2_PREVIEW_FEATURES: { isac: true },
      ONE_WSO2_MARKETINGOPS_ISAC_URL: "https://isac.example",
    });
    const row = rail.find((section) => section.id === "mops-isac");
    expect(row?.externalUrl).toBeUndefined();
    expect(row?.children?.map((child) => child.label)).toEqual([
      "Dashboard",
      "Ask AI",
      "Companies",
      "Leads",
      "Advanced Search",
      "Reo Leads",
      "G2 Intelligence",
      "Data Ingestion",
      "Signal Data",
      "Administration",
    ]);
    expect(row?.children?.every((child) => child.path?.startsWith("/marketing-ops/isac/"))).toBe(true);
  });

  it("gives every rail item a route", async () => {
    vi.resetModules();
    const [{ ISAC_RAIL_ITEMS }, { isacRoutes }, { ISAC_PATH }] = await Promise.all([
      import("./isacRail"),
      import("./routes"),
      import("./paths"),
    ]);
    const children = (isacRoutes.props as { children: { props: { path?: string } }[] }).children;
    const routed = new Set(children.map((route) => route.props.path).filter(Boolean));
    for (const item of ISAC_RAIL_ITEMS) {
      expect(routed).toContain(item.path.slice(ISAC_PATH.length + 1));
    }
  });
});
