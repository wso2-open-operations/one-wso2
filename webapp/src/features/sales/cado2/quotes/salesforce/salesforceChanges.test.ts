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
import type { SalesforceChange } from "@features/sales/cado2/quotes/api/quoteTypes";
import { changeLabel, changeLine, groupChanges } from "./salesforceChanges";

const change = (o: Partial<SalesforceChange>): SalesforceChange => ({
  group: "ACCOUNT", subject: "", field: "Sales region", before: "NA", after: "EU", effect: null, ...o,
});

// D173: Salesforce changes in words.
describe("salesforceChanges", () => {
  it("groups the changes in a fixed order, leaving out empty groups", () => {
    const groups = groupChanges([
      change({ group: "PRODUCT", subject: "WSO2 Gateway", field: "List price" }),
      change({}),
      change({ group: "CONTACT", subject: "Billing contact", field: "Email" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Account", "Contacts", "Products"]);
  });

  it("names a change within its subject, and says when a value is gone", () => {
    expect(changeLabel(change({}))).toBe("Sales region");
    expect(changeLabel(change({ group: "PRODUCT", subject: "WSO2 Gateway", field: "List price" }))).toBe("WSO2 Gateway · list price");
    expect(changeLine(change({ after: null }))).toBe("Sales region: NA → —");
  });
});
