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
import { legalBodies, legalTitle, volumeChangeLines, volumeTitle, type AdminChange } from "./changeLog";

const change = (o: Partial<AdminChange>): AdminChange => ({
  id: 1, area: "VOLUME_DISCOUNT_TABLE", item: "3", action: "CHANGED", before: null, after: null,
  changedByEmail: "admin@wso2.com", changedAt: "2026-11-14T10:00:00Z", ...o,
});
const table = (name: string, products: string[], tiers: [number, string][]) => ({
  name, products, tiers: tiers.map(([fromQuantity, ceilingPercent]) => ({ fromQuantity, ceilingPercent })),
});

// D172: the change log in words.
describe("changeLog", () => {
  it("says what changed in a volume discount table", () => {
    const c = change({
      before: table("Gateway", ["SH-API-GW", "OLD"], [[1, "0"], [101, "27.34"], [501, "30"]]),
      after: table("API Gateway", ["SH-API-GW", "C-API-GW"], [[1, "0"], [101, "40"], [1001, "56.66"]]),
    });
    expect(volumeTitle(c)).toBe("API Gateway");
    expect(volumeChangeLines(c)).toEqual([
      "Name: Gateway → API Gateway",
      "Products added: C-API-GW",
      "Products removed: OLD",
      "From 101: 27.34% → 40.00%",
      "From 501: removed (was 30.00%)",
      "From 1001: added at 56.66%",
    ]);
  });

  it("sums up a created or deleted table, named as it was", () => {
    const t = table("Portal", ["SH-API-PORTAL"], [[1, "0"], [2, "2.08"]]);
    expect(volumeChangeLines(change({ action: "CREATED", after: t }))).toEqual(["2 tiers, products SH-API-PORTAL"]);
    const deleted = change({ action: "DELETED", before: t });
    expect(volumeTitle(deleted)).toBe("Portal");
    expect(volumeChangeLines(deleted)).toEqual(["Had 2 tiers, products SH-API-PORTAL"]);
  });

  it("names a legal text by its label and a notice by its title", () => {
    const label = (k: string) => (k === "TERMS_SAAS_DIRECT" ? "SaaS, direct" : k);
    expect(legalTitle(change({ area: "LEGAL_TEXT", item: "TERMS_SAAS_DIRECT" }), label)).toBe("SaaS, direct");
    const notice = change({ area: "LEGAL_NOTICE", item: "4", before: { title: "GDPR", body: "Old." }, after: null });
    expect(legalTitle(notice, label)).toBe("Notice: GDPR");
    expect(legalBodies(notice)).toEqual({ before: "Old.", after: null });
  });
});
