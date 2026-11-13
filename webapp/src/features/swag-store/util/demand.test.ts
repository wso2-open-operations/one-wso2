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
import { demandRow } from "../testing/fixtures";
import { groupDemand, restockDate } from "./demand";

describe("groupDemand", () => {
  it("groups variants by product, most wanted first, with the earliest ask and the next restock date", () => {
    const groups = groupDemand([
      demandRow({ variantId: "v-m", options: "M", pendingAlerts: 3, firstAlertAt: "2026-11-10T05:00:00Z" }),
      demandRow({
        productId: "p-speaker",
        productName: "WSO2 Bluetooth Speaker",
        variantId: "v-speaker",
        options: "",
        pendingAlerts: 4,
        firstAlertAt: "2026-11-12T00:00:00Z",
        restockEta: "2026-12-20T00:00:00Z",
      }),
      demandRow({ variantId: "v-l", options: "L", pendingAlerts: 2, firstAlertAt: "2026-11-08T00:00:00Z", restockEta: "2026-12-12T00:00:00Z" }),
    ]);
    expect(groups.map((g) => [g.productId, g.waiting, g.firstAlertAt, g.nextRestock])).toEqual([
      ["p-hoodie", 5, "2026-11-08T00:00:00Z", "2026-12-12"],
      ["p-speaker", 4, "2026-11-12T00:00:00Z", "2026-12-20"],
    ]);
    expect(groups[0].variants.map((v) => v.variantId)).toEqual(["v-m", "v-l"]);
  });

  it("breaks a tie by who has waited longest, and leaves the restock date empty when none is set", () => {
    const groups = groupDemand([
      demandRow({ productId: "p-a", pendingAlerts: 2, firstAlertAt: "2026-11-12T00:00:00Z" }),
      demandRow({ productId: "p-b", pendingAlerts: 2, firstAlertAt: "2026-11-01T00:00:00Z" }),
    ]);
    expect(groups.map((g) => g.productId)).toEqual(["p-b", "p-a"]);
    expect(groups[0].nextRestock).toBeNull();
    expect(groupDemand([])).toEqual([]);
  });
});

describe("restockDate", () => {
  it("reads the civil date out of the API's timestamp", () => {
    expect(restockDate("2026-12-12T00:00:00Z")).toBe("2026-12-12");
    expect(restockDate("2026-12-12")).toBe("2026-12-12");
    expect(restockDate(null)).toBeNull();
  });
});
