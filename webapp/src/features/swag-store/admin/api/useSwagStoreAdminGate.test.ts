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

import { describe, expect, it } from "vitest";
import { swagStoreAccess } from "../../api/swagStoreAccess";
import { me } from "../../testing/fixtures";
import { SWAG_STORE_ADMIN_GROUP_ID, SWAG_STORE_ADMIN_ITEM } from "../swagStoreAdminItems";
import { swagStoreAdminAllows, swagStoreAdminCanSee } from "./useSwagStoreAdminGate";

const catalog = swagStoreAccess(me({ roles: ["catalog_manager"] }));
const fulfilment = swagStoreAccess(me({ roles: ["fulfilment_ops"] }));
const both = swagStoreAccess(me({ roles: ["catalog_manager", "fulfilment_ops"] }));
const shopper = swagStoreAccess(me());

describe("swagStoreAdminCanSee", () => {
  it.each([
    [SWAG_STORE_ADMIN_GROUP_ID, true, true, false],
    [SWAG_STORE_ADMIN_ITEM.dashboard, true, true, false],
    [SWAG_STORE_ADMIN_ITEM.orders, false, true, false],
    [SWAG_STORE_ADMIN_ITEM.products, true, false, false],
    [SWAG_STORE_ADMIN_ITEM.demand, true, false, false],
    [SWAG_STORE_ADMIN_ITEM.settings, false, true, false],
  ])("%s: catalog %s, fulfilment %s, shopper %s", (id, forCatalog, forFulfilment, forShopper) => {
    expect(swagStoreAdminCanSee(id, catalog)).toBe(forCatalog);
    expect(swagStoreAdminCanSee(id, fulfilment)).toBe(forFulfilment);
    expect(swagStoreAdminCanSee(id, shopper)).toBe(forShopper);
    expect(swagStoreAdminCanSee(id, both)).toBe(true);
  });

  it("hides an id it doesn't know from everyone", () => {
    expect(swagStoreAdminCanSee("swag-store-admin-unknown", both)).toBe(false);
  });
});

describe("swagStoreAdminAllows", () => {
  it("lets each role through only to what it may use", () => {
    expect(swagStoreAdminAllows("ANY", catalog)).toBe(true);
    expect(swagStoreAdminAllows("ANY", shopper)).toBe(false);
    expect(swagStoreAdminAllows("CATALOG_MANAGER", fulfilment)).toBe(false);
    expect(swagStoreAdminAllows("FULFILMENT_OPS", fulfilment)).toBe(true);
  });
});
