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

// The update's two GitHub issue fields show whichever issue was given when the
// update was created, as a link to it.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { UmtUpdateSummary } from "../api/umtUpdates";

vi.mock("../api/useUmtWorstCaseEstimateLog", () => ({
  useUmtWorstCaseEstimateLog: () => ({ data: [], isPending: false, isError: false, refetch: vi.fn() }),
}));

const { default: UmtUpdateDetailsGrid } = await import("./UmtUpdateDetailsGrid");

function renderGrid(update: Partial<UmtUpdateSummary>) {
  render(
    <UmtUpdateDetailsGrid
      id="42"
      update={{ id: 42, lifecycleState: "Development", ...update }}
      loading={false}
      canEdit={false}
    />,
  );
}

// The field's value sits next to its label in the same grid cell.
function valueOf(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe("GitHub issue fields on the update's details", () => {
  it("links the security internal issue given at creation, whatever the repository is named", () => {
    const issue = "https://github.com/wso2-enterprise/security-internals/issues/99";
    renderGrid({ lifecycle: "SecurityUpdateLifecycle", securityInternalGitIssue: issue });

    const link = valueOf("Security Internal GitHub Issue").querySelector("a");
    expect(link).toHaveAttribute("href", issue);
    expect(link).toHaveTextContent("security-internals#99");
  });

  it("links the internal issue", () => {
    const issue = "https://github.com/wso2-enterprise/wso2-apim-internal/issues/12";
    renderGrid({ internalGitIssue: issue });

    const link = valueOf("Internal GitHub Issue").querySelector("a");
    expect(link).toHaveAttribute("href", issue);
    expect(link).toHaveTextContent("wso2-apim-internal#12");
  });

  it("shows N/A, without a link, for an issue that does not apply", () => {
    renderGrid({ internalGitIssue: "https://github.com/wso2-enterprise/wso2-apim-internal/issues/12", securityInternalGitIssue: "N/A" });

    const field = valueOf("Security Internal GitHub Issue");
    expect(field).toHaveTextContent("N/A");
    expect(field.querySelector("a")).toBeNull();
  });

  it("shows N/A when no issue is held", () => {
    renderGrid({ securityInternalGitIssue: null });

    expect(valueOf("Security Internal GitHub Issue")).toHaveTextContent("N/A");
  });

  it("shows a value that is not a web address as text, without a link", () => {
    renderGrid({ securityInternalGitIssue: "javascript:alert(1)" });

    const field = valueOf("Security Internal GitHub Issue");
    expect(field).toHaveTextContent("javascript:alert(1)");
    expect(field.querySelector("a")).toBeNull();
  });
});
