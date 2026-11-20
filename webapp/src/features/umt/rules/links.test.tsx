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
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

// The view page's link lists: public PRs live under wso2 or wso2-extensions,
// integration test PRs under https://github.com/wso2-support/, and nothing can
// be added or deleted while the update is locked mid-demotion.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UmtUpdateSummary } from "../api/umtUpdates";

const state = vi.hoisted(() => ({
  isAdmin: true,
  savePublicPrs: vi.fn<(next: string[]) => Promise<void>>(async () => undefined),
  saveTestPrs: vi.fn<(next: string[]) => Promise<void>>(async () => undefined),
}));

vi.mock("../api/useUmtGate", () => ({
  useUmtGate: () => ({
    isAuthorized: true,
    isUser: true,
    isAdmin: state.isAdmin,
    isProductLead: false,
    hasRole: () => true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

vi.mock("../api/useUmtUpdateActions", () => ({
  useUmtSaveIssues: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useUmtSavePublicPullRequests: () => ({ isPending: false, mutateAsync: state.savePublicPrs }),
  useUmtSaveTestPullRequests: () => ({ isPending: false, mutateAsync: state.saveTestPrs }),
}));

const pendingQuery = { isPending: true, isError: false, data: undefined, error: null, refetch: () => {} };
vi.mock("../api/useUmtUpdateViewData", () => ({
  useUmtUpdateViewData: () => ({
    pullRequestAnalysis: pendingQuery,
    productAnalysis: pendingQuery,
    dependencies: pendingQuery,
    hotfixInfo: pendingQuery,
  }),
}));

vi.mock("../components/UmtUpdateAnalysisSections", () => ({
  ProductAnalysisSection: () => null,
  PullRequestAnalysisSection: () => null,
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

const { default: UmtUpdateViewSections } = await import("../components/UmtUpdateViewSections");

const UPDATE: UmtUpdateSummary = {
  id: 42,
  lifecycleState: "Development",
  issues: ["https://github.com/wso2/api-manager/issues/1"],
  publicPullRequests: ["https://github.com/wso2/carbon-apimgt/pull/10"],
  testPullRequests: ["https://github.com/wso2-support/product-apim/pull/20"],
};

// Opens a section's Add dialog and pastes `value` into it.
async function openAddWith(fieldLabel: string, value: string) {
  await userEvent.click(screen.getByRole("button", { name: `Add ${fieldLabel.toLowerCase()}` }));
  await userEvent.click(screen.getByLabelText(fieldLabel));
  await userEvent.paste(value);
}

const addButton = () => screen.getByRole("button", { name: "Add" });

beforeEach(() => {
  state.isAdmin = true;
  state.savePublicPrs.mockClear();
  state.saveTestPrs.mockClear();
});

describe("public pull requests", () => {
  it("refuses a pull request outside wso2 and wso2-extensions", async () => {
    render(<UmtUpdateViewSections id="42" update={UPDATE} />);

    await openAddWith("Public Pull Request", "https://github.com/someone/carbon-apimgt/pull/11");

    expect(addButton()).toBeDisabled();
    expect(screen.getByText(/must be a link like https:\/\/github.com\/wso2\/<repo>\/pull\/<number>/)).toBeInTheDocument();
  });

  it("adds a wso2 public pull request", async () => {
    render(<UmtUpdateViewSections id="42" update={UPDATE} />);

    await openAddWith("Public Pull Request", "https://github.com/wso2/carbon-apimgt/pull/11");
    await userEvent.click(addButton());

    await waitFor(() => expect(state.savePublicPrs).toHaveBeenCalled());
    expect(state.savePublicPrs).toHaveBeenCalledWith([
      "https://github.com/wso2/carbon-apimgt/pull/10",
      "https://github.com/wso2/carbon-apimgt/pull/11",
    ]);
  });
});

describe("integration test pull requests", () => {
  it("refuses a pull request outside https://github.com/wso2-support/", async () => {
    render(<UmtUpdateViewSections id="42" update={UPDATE} />);

    await openAddWith("Integration Test Pull Request", "https://github.com/wso2/product-apim/pull/21");

    expect(addButton()).toBeDisabled();
    expect(screen.getByText(/must be a pull request under https:\/\/github.com\/wso2-support\//)).toBeInTheDocument();
  });

  it("adds a wso2-support integration test pull request", async () => {
    render(<UmtUpdateViewSections id="42" update={UPDATE} />);

    await openAddWith("Integration Test Pull Request", "https://github.com/wso2-support/product-apim/pull/21");
    await userEvent.click(addButton());

    await waitFor(() => expect(state.saveTestPrs).toHaveBeenCalled());
    expect(state.saveTestPrs).toHaveBeenCalledWith([
      "https://github.com/wso2-support/product-apim/pull/20",
      "https://github.com/wso2-support/product-apim/pull/21",
    ]);
  });
});

describe("while the update is locked mid-demotion", () => {
  it("offers no add or delete on any list, even to an admin", () => {
    render(<UmtUpdateViewSections id="42" update={{ ...UPDATE, lifecycleState: "DemoteStagingRequested" }} readOnly />);

    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^Delete / }).filter((button) => !button.hasAttribute("disabled")))
      .toHaveLength(0);
  });
});
