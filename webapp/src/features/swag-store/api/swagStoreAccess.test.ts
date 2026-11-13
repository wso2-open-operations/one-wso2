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
import { me } from "../testing/fixtures";
import { swagStoreAccess } from "./swagStoreAccess";

describe("swagStoreAccess", () => {
  it("is a shopper with no store role", () => {
    expect(swagStoreAccess(me())).toEqual({ isCatalogManager: false, isFulfilmentOps: false, isAdmin: false });
  });

  it("reads each store role, and either one makes an admin", () => {
    expect(swagStoreAccess(me({ roles: ["catalog_manager"] }))).toEqual({
      isCatalogManager: true,
      isFulfilmentOps: false,
      isAdmin: true,
    });
    expect(swagStoreAccess(me({ roles: ["fulfilment_ops"] }))).toEqual({
      isCatalogManager: false,
      isFulfilmentOps: true,
      isAdmin: true,
    });
  });

  it("grants nothing before the answer arrives", () => {
    expect(swagStoreAccess(undefined).isAdmin).toBe(false);
  });
});
