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
import { BANKING_ITEM_IDS, ME_APPS } from "./meApps";

describe("BANKING_ITEM_IDS", () => {
  it("covers every item of the Banking app, so the rail gates each of them on the banking group", () => {
    const bankingItems = ME_APPS.find((app) => app.key === "banking")?.items ?? [];
    expect(bankingItems.length).toBeGreaterThan(0);
    expect([...BANKING_ITEM_IDS].sort()).toEqual(bankingItems.map((it) => it.id).sort());
  });

  it("is disjoint from the Leave ids, which have their own gate", () => {
    const leaveItems = ME_APPS.find((app) => app.key === "leave")?.items ?? [];
    for (const it of leaveItems) expect(BANKING_ITEM_IDS.has(it.id)).toBe(false);
  });
});
