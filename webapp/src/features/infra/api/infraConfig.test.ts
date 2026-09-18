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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalConfig = window.config;

async function load(infraBackendUrl?: string) {
  vi.resetModules();
  window.config = {
    ...(window.config ?? {}),
    ONE_WSO2_INFRA_BACKEND_URL: infraBackendUrl,
  } as Window["config"];

  return import("@config/apiConfig");
}

beforeEach(() => vi.resetModules());

afterEach(() => {
  window.config = originalConfig;
});

describe("Infra Portal API configuration", () => {
  it("is unconfigured when the backend URL is absent", async () => {
    const config = await load();

    expect(config.infraBackendUrl).toBe("");
    expect(config.isInfraBackendConfigured()).toBe(false);
  });

  it("normalizes the backend URL and builds the user-info URL", async () => {
    const config = await load("https://infra.example.com///");

    expect(config.infraBackendUrl).toBe("https://infra.example.com");
    expect(config.isInfraBackendConfigured()).toBe(true);
    expect(config.infraServiceUrls.userInfo).toBe(
      "https://infra.example.com/user-info",
    );
  });
});