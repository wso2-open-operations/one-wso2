/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, expect, it } from "vitest";
import { isMarketingCategory, isTravelCategory } from "./ccTypes";

describe("isTravelCategory", () => {
  it("is Travel only, matched exactly", () => {
    expect(isTravelCategory("Travel")).toBe(true);
    expect(isTravelCategory("Travel Insurance")).toBe(false);
  });

  it("is false for no category", () => {
    expect(isTravelCategory(null)).toBe(false);
    expect(isTravelCategory(undefined)).toBe(false);
  });
});

describe("isMarketingCategory", () => {
  it("is Marketing and its sub-categories, which share its sub region rule", () => {
    expect(isMarketingCategory("Marketing")).toBe(true);
    expect(isMarketingCategory("Marketing - Digital")).toBe(true);
    expect(isMarketingCategory("Infra")).toBe(false);
  });

  it("is false for no category", () => {
    expect(isMarketingCategory(null)).toBe(false);
    expect(isMarketingCategory("")).toBe(false);
  });
});
