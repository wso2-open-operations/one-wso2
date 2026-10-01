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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Event Platform is behind a preview flag, so the registry depends on
// `window.config` and has to be imported fresh per state rather than once at
// the top of the file.
type MarketingOpsApps = typeof import("./marketingOpsApps");

async function load(preview: { eventPlatform?: boolean } = {}): Promise<MarketingOpsApps> {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_PREVIEW_FEATURES: preview,
  } as Window["config"];
  return import("./marketingOpsApps");
}

const originalConfig = window.config;
beforeEach(() => vi.resetModules());
afterEach(() => {
  window.config = originalConfig;
});

const keys = (apps: readonly { key: string }[]) => apps.map((a) => a.key);

describe("the Event Platform rail group", () => {
  // Production's config says nothing, so this is what production gets.
  it("is absent when no flag is set", async () => {
    const { MARKETING_OPS_APPS } = await load();
    expect(keys(MARKETING_OPS_APPS)).not.toContain("event-platform");
  });

  it("is present, after Events, when the flag is on", async () => {
    const { MARKETING_OPS_APPS } = await load({ eventPlatform: true });
    const order = keys(MARKETING_OPS_APPS);
    expect(order.indexOf("event-platform")).toBe(order.indexOf("events") + 1);
  });

  // The eyebrow is a literal, so the module must still load with the app gone.
  it("keeps its eyebrow when the flag is off", async () => {
    const { MARKETING_OPS_EYEBROW } = await load();
    expect(MARKETING_OPS_EYEBROW.eventPlatform.label).toBe("Event Platform");
  });

  it("leaves the other apps alone", async () => {
    const off = keys((await load()).MARKETING_OPS_APPS);
    const on = keys((await load({ eventPlatform: true })).MARKETING_OPS_APPS);
    expect(on.filter((k) => k !== "event-platform")).toEqual(off);
  });
});
