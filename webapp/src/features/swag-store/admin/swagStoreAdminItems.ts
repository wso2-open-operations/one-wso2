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

/** Where the store's admin screens live, under People Ops. */
export const SWAG_STORE_ADMIN_PATH = "/people-ops/swag-store";

/** Every admin path. The landing at the root sends each person to the first screen they may use. */
export const swagStoreAdminPaths = {
  root: SWAG_STORE_ADMIN_PATH,
  dashboard: `${SWAG_STORE_ADMIN_PATH}/dashboard`,
} as const;

/** The People Ops rail group that holds the admin screens. */
export const SWAG_STORE_ADMIN_GROUP_ID = "swag-store-admin";

/** Rail row ids, one per admin screen. Each phase adds the rows of the screens it ships. */
export const SWAG_STORE_ADMIN_ITEM = {
  dashboard: "swag-store-admin-dashboard",
  orders: "swag-store-admin-orders",
  products: "swag-store-admin-products",
  demand: "swag-store-admin-demand",
  settings: "swag-store-admin-settings",
} as const;

/** Every id the Swag Store admin gate answers for in the rail, the group included. */
export const SWAG_STORE_ADMIN_ITEM_IDS: ReadonlySet<string> = new Set([
  SWAG_STORE_ADMIN_GROUP_ID,
  ...Object.values(SWAG_STORE_ADMIN_ITEM),
]);
