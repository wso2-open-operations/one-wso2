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

// Finance MIS's ARR service — the one MIS backend One WSO2 is configured for.
// MIS has two more, Flash and Admin, which serve only the Flash Dashboard; it
// stays in the MIS app (docs/adr/0005-flash-dashboard-stays-in-mis.md), so
// nothing here reads their URLs.
//
// Every URL in apiConfig is read at MODULE LOAD, so window.config has to be in
// place before the import — hence resetModules + dynamic import per case, the
// same shape WaffleOverlay.external.test.tsx uses.

type MisConfig = Record<string, unknown>;

async function loadWith(config: MisConfig | undefined) {
  vi.resetModules();
  (window as unknown as { config?: MisConfig }).config = config;
  return import("@config/apiConfig");
}

afterEach(() => {
  delete (window as { config?: unknown }).config;
});

// A staging configuration as deployments carried it while the Flash was being
// ported, Flash and Admin keys included — which is what makes the last case
// below able to fail.
const STAGING = {
  ONE_WSO2_MIS_ARR_BACKEND_URL:
    "https://apis-stg.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1.0",
  ONE_WSO2_MIS_FLASH_BACKEND_URL:
    "https://apis-stg.wso2.com/dvig/mis-flash-backend/endpoint-9090-803/v1.0",
  ONE_WSO2_MIS_ADMIN_BACKEND_URL: "",
};

describe("the Finance MIS backend", () => {
  it("is configured once its ARR URL is set", async () => {
    const c = await loadWith(STAGING);
    expect(c.isMisArrConfigured()).toBe(true);
  });

  it("reports unconfigured when nothing is set at all", async () => {
    const c = await loadWith(undefined);
    expect(c.isMisArrConfigured()).toBe(false);
  });

  // The version segment belongs to the configured URL and differs by
  // environment — /v1 in production, /v1.0 in staging (mis.md §11.2) — so an
  // operator is pasting a path-like tail, which is exactly the value someone
  // ends with a slash. Unstripped it produces `//user-info`, and whether that
  // 404s is up to the gateway. Same reasoning as marketingOpsBackendUrl.
  it("tolerates a trailing slash on a pasted URL", async () => {
    const c = await loadWith({
      ONE_WSO2_MIS_ARR_BACKEND_URL: "https://apis.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1/",
    });
    expect(c.misArrServiceUrls.userInfo).toBe(
      "https://apis.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1/user-info",
    );
  });

  // /user-info is the call ticket 01 exists to make, and it lives on the ARR
  // service: arr-backend service.bal:55-69 pushes both of MIS's privilege
  // numbers into one array there.
  it("serves /user-info from the ARR backend", async () => {
    const c = await loadWith(STAGING);
    expect(c.misArrServiceUrls.userInfo).toBe(
      "https://apis-stg.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1.0/user-info",
    );
  });

  // ADR 0005. A deployment still carrying the Flash and Admin keys configures
  // nothing from them: no guard and no service map is built for either.
  it("reads no Flash or Admin URL, even where a config still carries them", async () => {
    const c = (await loadWith(STAGING)) as Record<string, unknown>;
    for (const name of [
      "isMisFlashConfigured",
      "misFlashServiceUrls",
      "isMisAdminConfigured",
      "misAdminBackendUrl",
    ]) {
      expect(c[name], name).toBeUndefined();
    }
  });
});
