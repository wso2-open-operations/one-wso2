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

// Finance MIS is the first app here to speak to more than one backend, so it is
// the first that can be PARTLY configured — and the partly-configured case is
// not hypothetical, it is the correct configuration today. The Admin service is
// deprecated and its Production deployment is suspended, and its staging URL is
// on a choreoapis.dev host the CSP blocks, so the right value for it is empty
// while ARR and Flash are live. See docs/ported-apps/mis.md §2.5 and §11.2.
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

// The staging configuration, verbatim from public/config.js.
const STAGING = {
  ONE_WSO2_MIS_ARR_BACKEND_URL:
    "https://apis-stg.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1.0",
  ONE_WSO2_MIS_FLASH_BACKEND_URL:
    "https://apis-stg.wso2.com/dvig/mis-flash-backend/endpoint-9090-803/v1.0",
  ONE_WSO2_MIS_ADMIN_BACKEND_URL: "",
};

describe("the three Finance MIS backends", () => {
  // The rule this file exists to protect. Collapsing these into one
  // isMisConfigured() would read as a tidy-up and would take the ARR Build
  // down with a backend that has been suspended since before the port began.
  it("are configured independently, so an unset Admin URL does not disable ARR", async () => {
    const c = await loadWith(STAGING);
    expect(c.isMisArrConfigured()).toBe(true);
    expect(c.isMisFlashConfigured()).toBe(true);
    expect(c.isMisAdminConfigured()).toBe(false);
  });

  it("each report unconfigured when nothing is set at all", async () => {
    const c = await loadWith(undefined);
    expect(c.isMisArrConfigured()).toBe(false);
    expect(c.isMisFlashConfigured()).toBe(false);
    expect(c.isMisAdminConfigured()).toBe(false);
  });

  // The version segment belongs to the configured URL and differs by
  // environment — /v1 in production, /v1.0 in staging (mis.md §11.2) — so an
  // operator is pasting a path-like tail, which is exactly the value someone
  // ends with a slash. Unstripped it produces `//user-info`, and whether that
  // 404s is up to the gateway. Same reasoning as marketingOpsBackendUrl.
  it("tolerate a trailing slash on a pasted URL", async () => {
    const c = await loadWith({
      ONE_WSO2_MIS_ARR_BACKEND_URL: "https://apis.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1/",
    });
    expect(c.misArrServiceUrls.userInfo).toBe(
      "https://apis.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1/user-info",
    );
  });

  // /user-info is the call ticket 01 exists to make. It must go to the ARR
  // service: the Flash and Admin services do not serve it, and privileges for
  // BOTH dashboards come back from this one endpoint (arr-backend
  // service.bal:55-69 pushes 987 and 789 into the same array).
  it("serve /user-info from the ARR backend, which answers for Flash too", async () => {
    const c = await loadWith(STAGING);
    expect(c.misArrServiceUrls.userInfo).toBe(
      "https://apis-stg.wso2.com/dvig/mis-arr-backend/endpoint-9090-803/v1.0/user-info",
    );
  });

  // Tickets 15 and 16. The P&L, its two detail reads and the account books go
  // to the FLASH service, and the mistake worth guarding is the tidy one: these
  // sit beside the ARR map in the same file, and a builder written against
  // `misArrBackendUrl` would compile, would resolve, and would 404 at a gateway
  // that has never heard of /balance-statement — or, for a write, would 404 a
  // forecast Finance believes they just saved.
  it("serve the Flash reads and writes from the Flash backend, not the ARR one", async () => {
    const c = await loadWith(STAGING);
    const flash = "https://apis-stg.wso2.com/dvig/mis-flash-backend/endpoint-9090-803/v1.0";
    expect(c.misFlashServiceUrls).toEqual({
      balanceStatement: `${flash}/balance-statement`,
      customerSummary: `${flash}/customer-summary`,
      accountSummary: `${flash}/account-summary`,
      subRegions: `${flash}/sub-regions`,
      incomeAccounts: `${flash}/income-accounts`,
      costOfSalesAccounts: `${flash}/cost-of-sales-accounts`,
    });
  });
});
