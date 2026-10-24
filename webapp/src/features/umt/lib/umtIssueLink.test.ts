// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { describe, expect, it } from "vitest";
import { umtIssueLink } from "./umtIssueLink";

describe("how a GitHub issue field links", () => {
  it("labels a GitHub issue as repository#number, whatever the repository is named", () => {
    expect(umtIssueLink("https://github.com/wso2-enterprise/security-internals/issues/99")).toEqual({
      href: "https://github.com/wso2-enterprise/security-internals/issues/99",
      label: "security-internals#99",
    });
    expect(umtIssueLink("https://github.com/wso2/api-manager/issues/34/")?.label).toBe("api-manager#34");
  });

  it("labels a GitHub issue whatever the case of its address", () => {
    expect(umtIssueLink("https://GitHub.com/wso2/api-manager/issues/34")?.label).toBe("api-manager#34");
    expect(umtIssueLink("HTTPS://github.com/wso2/api-manager/issues/34")?.label).toBe("api-manager#34");
  });

  it("labels any other web address by the address itself", () => {
    expect(umtIssueLink("https://example.com/tracker/7")).toEqual({
      href: "https://example.com/tracker/7",
      label: "https://example.com/tracker/7",
    });
  });

  it("ignores surrounding whitespace", () => {
    expect(umtIssueLink("  https://github.com/wso2/api-manager/issues/34  ")?.href).toBe(
      "https://github.com/wso2/api-manager/issues/34",
    );
  });

  it("holds no link for an empty value, N/A, or anything that is not a web address", () => {
    for (const value of [undefined, null, "", "   ", "N/A", "javascript:alert(1)", "github.com/wso2/api-manager/issues/1"]) {
      expect(umtIssueLink(value)).toBeNull();
    }
  });
});
