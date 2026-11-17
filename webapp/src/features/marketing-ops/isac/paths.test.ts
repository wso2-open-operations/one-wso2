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

import { describe, expect, it, vi } from "vitest";

vi.mock("@config/apiConfig", () => ({ salesforceBaseUrl: "https://sf.example" }));

import { isacPath, sfRecordUrl } from "./paths";

describe("isacPath", () => {
  it("places an ISAC screen under the Marketing Ops prefix, query string included", () => {
    expect(isacPath("/companies/42?tab=contacts")).toBe("/marketing-ops/isac/companies/42?tab=contacts");
  });
});

describe("sfRecordUrl", () => {
  it("links to the record in Salesforce Lightning", () => {
    expect(sfRecordUrl("Account", "001 A/b")).toBe("https://sf.example/lightning/r/Account/001%20A%2Fb/view");
  });

  it("is null when the record has no Salesforce id", () => {
    expect(sfRecordUrl("Lead", null)).toBeNull();
    expect(sfRecordUrl("Contact", "")).toBeNull();
  });
});
