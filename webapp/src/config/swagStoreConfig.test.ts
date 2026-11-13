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

const BASE = "https://api.example.com/swag-store-api/v1.0";

async function loadWith(config: Record<string, unknown> | undefined) {
  vi.resetModules();
  (window as unknown as { config?: Record<string, unknown> }).config = config;
  return import("@config/apiConfig");
}

afterEach(() => {
  delete (window as { config?: unknown }).config;
});

describe("the Swag Store backend", () => {
  it("is not configured when the key is missing, blank, or there is no config at all", async () => {
    for (const config of [undefined, {}, { ONE_WSO2_SWAG_STORE_BACKEND_URL: "" }]) {
      expect((await loadWith(config)).isSwagStoreBackendConfigured()).toBe(false);
    }
  });

  it("is configured once its URL is set, and drops trailing slashes", async () => {
    const c = await loadWith({ ONE_WSO2_SWAG_STORE_BACKEND_URL: `${BASE}//` });
    expect(c.isSwagStoreBackendConfigured()).toBe(true);
    expect(c.swagStoreBackendUrl).toBe(BASE);
  });

  it("appends resource paths with no /api prefix", async () => {
    const c = await loadWith({ ONE_WSO2_SWAG_STORE_BACKEND_URL: BASE });
    expect(c.swagStoreServiceUrls.me).toBe(`${BASE}/users/me`);
    expect(c.swagStoreServiceUrls.wallets).toBe(`${BASE}/wallets`);
    expect(c.swagStoreServiceUrls.cartSummary).toBe(`${BASE}/cart/summary`);
    expect(c.swagStoreServiceUrls.admin.dashboard).toBe(`${BASE}/admin/dashboard`);
    expect(c.swagStoreServiceUrls.admin.order("SS-1/2")).toBe(`${BASE}/admin/orders/SS-1%2F2`);
    expect(c.swagStoreServiceUrls.admin.orderNotes("SS-10482")).toBe(`${BASE}/admin/orders/SS-10482/notes`);
    expect(c.swagStoreServiceUrls.admin.pickupOffice("a b")).toBe(`${BASE}/admin/pickup-offices/a%20b`);
    expect(c.swagStoreServiceUrls.admin.productVariant("p/1", "v 2")).toBe(`${BASE}/admin/products/p%2F1/variants/v%202`);
    expect(c.swagStoreServiceUrls.admin.stockMovements("v-1")).toBe(`${BASE}/admin/variants/v-1/stock-movements`);
    expect(c.swagStoreServiceUrls.admin.removalImpact("p-1")).toBe(`${BASE}/admin/products/p-1/removal-impact`);
  });

  it("encodes every path segment it is given", async () => {
    const c = await loadWith({ ONE_WSO2_SWAG_STORE_BACKEND_URL: BASE });
    expect(c.swagStoreServiceUrls.product("a/b?c")).toBe(`${BASE}/products/a%2Fb%3Fc`);
    expect(c.swagStoreServiceUrls.cartLine("x y")).toBe(`${BASE}/cart/lines/x%20y`);
    expect(c.swagStoreServiceUrls.order("SS-10482")).toBe(`${BASE}/orders/SS-10482`);
    expect(c.swagStoreServiceUrls.orderPayments("SS-1/2")).toBe(`${BASE}/orders/SS-1%2F2/payments`);
    expect(c.swagStoreServiceUrls.stockAlert("a&b")).toBe(`${BASE}/stock-alerts/a%26b`);
  });

  it("works against the local dev proxy, which has no host", async () => {
    const c = await loadWith({ ONE_WSO2_SWAG_STORE_BACKEND_URL: "/swag-store-backend" });
    expect(c.swagStoreServiceUrls.me).toBe("/swag-store-backend/users/me");
  });
});
