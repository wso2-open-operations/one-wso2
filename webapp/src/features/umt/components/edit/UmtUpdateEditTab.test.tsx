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

// The Edit tab keeps a client-side step pointer per update, and each readiness
// check applies only while its own step is showing. The backend checks nothing
// on ProductAnalyzed → StagingRequested, so a pointer left from another state,
// or a product left without a description, must not get through Proceed.
// Step bodies are stubbed: only the shell's gating is under test.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UmtUpdateProduct, UmtUpdateSummary } from "../../api/umtUpdates";

const state = vi.hoisted(() => ({
  transition: vi.fn<(next: string) => Promise<void>>(async () => undefined),
  isAdmin: false,
  isProductLead: false,
  additionalFileOperations: [] as unknown[],
  stagingResults: [] as unknown[],
}));

vi.mock("../../api/useUmtUpdateViewData", () => ({
  useUmtPullRequestAnalysis: () => ({
    isSuccess: true,
    data: { additionalFileOperations: state.additionalFileOperations },
  }),
  useUmtProductAnalysis: () => ({ isSuccess: true, data: {} }),
}));

vi.mock("../../api/useUmtTesting", () => ({
  useUmtStagingTestResults: () => ({ isSuccess: true, data: state.stagingResults }),
}));

vi.mock("../../api/useUmtPrAnalysis", () => ({
  useUmtIsAdvancingToPrAnalyzed: () => false,
}));

// Two log entries: the stay a saved pointer belongs to is the lifecycle state
// plus the length of this log.
vi.mock("../../api/useUmtLifecycleHistory", () => ({
  useUmtLifecycleHistory: () => ({ isSuccess: true, data: [{}, {}] }),
}));

vi.mock("../../api/useUmtHotfixRelease", () => ({
  useUmtHotfixTestStatus: () => ({ isSuccess: true, isPending: false, data: null }),
  useUmtReleaseHotfix: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock("./hotfix-release/UmtHotfixReleaseStep", () => ({
  default: () => <div data-testid="step-hotfix-release" />,
}));

vi.mock("../../api/useUmtGate", () => ({
  useUmtGate: () => ({
    isAuthorized: true,
    isUser: true,
    isAdmin: state.isAdmin,
    isProductLead: state.isProductLead,
    hasRole: () => true,
    isResolving: false,
    isError: false,
    retry: () => {},
  }),
}));

vi.mock("../../api/useUmtLifecycleTransition", () => ({
  useUmtLifecycleTransition: () => ({ isPending: false, mutateAsync: state.transition }),
}));

vi.mock("@context/notifications/NotificationsContext", () => ({
  useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn() }),
}));

vi.mock("./files-analysis/UmtFilesAnalysisStep", () => ({
  default: () => <div data-testid="step-files-analysis" />,
}));
vi.mock("./description-instruction/UmtDescriptionInstructionStep", () => ({
  default: () => <div data-testid="step-description-instruction" />,
}));
vi.mock("./security-advisory/UmtSecurityAdvisoryStep", () => ({
  default: () => <div data-testid="step-security-advisory" />,
}));
vi.mock("./integration-tests/UmtIntegrationTestsStep", () => ({
  default: () => <div data-testid="step-integration-tests" />,
}));
vi.mock("./testing/UmtTestingStep", () => ({
  default: () => <div data-testid="step-testing" />,
}));
vi.mock("./validate/UmtValidateStep", () => ({
  default: () => <div data-testid="step-validate" />,
}));
vi.mock("./file-approval/UmtFileApprovalStep", () => ({
  default: () => <div data-testid="step-file-approval" />,
}));
vi.mock("./verifying/UmtVerifyingStep", () => ({
  default: () => <div data-testid="step-verifying" />,
}));
vi.mock("./verifying/UmtCompleteUpdateDialog", () => ({
  default: () => null,
}));

const { default: UmtUpdateEditTab } = await import("./UmtUpdateEditTab");

const COMPLETE: UmtUpdateProduct = {
  productId: 1,
  product: { name: "wso2am", version: "4.2.0.15.full" },
  description: "Fixes the token refresh.",
  instruction: "Restart the server.",
  testPr: "https://github.com/wso2-support/product-apim/pull/1",
};

// Added after the description step was passed (e.g. through a demote and a
// fresh analysis elsewhere): no description, but a Test PR, so Integration
// Tests' own check alone would let it through.
const UNDESCRIBED: UmtUpdateProduct = {
  productId: 2,
  product: { name: "wso2is", version: "7.0.0.3.full" },
  description: "",
  instruction: "",
  testPr: "https://github.com/wso2-support/product-is/pull/2",
};

function makeUpdate(overrides: Partial<UmtUpdateSummary> = {}): UmtUpdateSummary {
  return {
    id: 42,
    lifecycle: "UpdateLifecycle",
    lifecycleState: "ProductAnalyzed",
    promoteStages: ["StagingRequested"],
    isHotfix: false,
    products: [COMPLETE],
    ...overrides,
  };
}

const PERSISTED_STEP_KEY = "one-wso2.umt-edit-step.v2.42";

// Saved as reached in the current stay of `lifecycleState`, so only the run
// rules decide whether it is honoured; pass a different `stayKey` to save it
// under another stay instead.
function persistStep(stepId: string, lifecycleState = "ProductAnalyzed", stayKey = `${lifecycleState}#2`) {
  window.localStorage.setItem(PERSISTED_STEP_KEY, JSON.stringify({ stayKey, stepId }));
}

function renderTab(update: UmtUpdateSummary) {
  return render(<UmtUpdateEditTab id="42" update={update} />);
}

// Whatever the forward button is called on the current step.
function forwardButton() {
  return screen.getByRole("button", { name: /^(Next|Proceed|Approve and Proceed|Complete Update)$/ });
}

beforeEach(() => {
  window.localStorage.clear();
  state.transition.mockClear();
  state.isAdmin = false;
  state.isProductLead = false;
  state.additionalFileOperations = [];
  state.stagingResults = [];
});

describe("a step pointer saved under another lifecycle state", () => {
  // A "validate" saved during an earlier Staging visit survives a demotion
  // made elsewhere. Validate's Proceed has no check of its own for this state
  // and would send promoteStages[0], skipping descriptions, the security
  // advisory and Test PRs on the way out of ProductAnalyzed.
  it("lands on the backend's step instead", () => {
    persistStep("validate");
    renderTab(makeUpdate({ products: [COMPLETE, UNDESCRIBED] }));

    expect(screen.queryByTestId("step-validate")).not.toBeInTheDocument();
    expect(screen.getByTestId("step-description-instruction")).toBeInTheDocument();
  });

  it("never promotes out of ProductAnalyzed", async () => {
    persistStep("validate");
    renderTab(makeUpdate({ products: [COMPLETE, UNDESCRIBED] }));

    const button = forwardButton();
    if (!button.hasAttribute("disabled")) await userEvent.click(button);

    expect(state.transition).not.toHaveBeenCalled();
  });

  it("is dropped, so it doesn't come back on the next visit", () => {
    persistStep("validate");
    renderTab(makeUpdate());

    expect(window.localStorage.getItem(PERSISTED_STEP_KEY)).toBeNull();
  });

  it("from a later state also leaves Files Analysis alone", () => {
    persistStep("integration-tests", "PRAnalyzed");
    renderTab(makeUpdate({ lifecycleState: "PRAnalyzed", promoteStages: ["ProductAnalyzed"] }));

    expect(screen.getByTestId("step-files-analysis")).toBeInTheDocument();
  });
});

describe("a step pointer saved in another stay of the same state", () => {
  // The update left this state and came back since, so the pointer says
  // nothing about where it is now, though the step is within the state's run.
  it("is not restored", () => {
    persistStep("integration-tests", "ProductAnalyzed", "ProductAnalyzed#1");
    renderTab(makeUpdate());

    expect(screen.queryByTestId("step-integration-tests")).not.toBeInTheDocument();
    expect(screen.getByTestId("step-description-instruction")).toBeInTheDocument();
  });
});

describe("a step pointer within the current state's run", () => {
  it("is still honoured under ProductAnalyzed", () => {
    persistStep("integration-tests");
    renderTab(makeUpdate());

    expect(screen.getByTestId("step-integration-tests")).toBeInTheDocument();
  });

  it("is still honoured under Staging", () => {
    persistStep("validate", "Staging");
    renderTab(makeUpdate({ lifecycleState: "Staging", promoteStages: ["UATStaging"] }));

    expect(screen.getByTestId("step-validate")).toBeInTheDocument();
  });
});

describe("descriptions on the way out of a state", () => {
  it("are required by Description and Instruction's own Next", () => {
    renderTab(makeUpdate({ products: [COMPLETE, UNDESCRIBED] }));

    expect(forwardButton()).toBeDisabled();
  });

  // A product can be added, or lose its description, after the description
  // step was passed.
  it("are re-checked by Integration Tests' Proceed (ProductAnalyzed → StagingRequested)", () => {
    persistStep("integration-tests");
    renderTab(makeUpdate({ products: [COMPLETE, UNDESCRIBED] }));

    expect(forwardButton()).toBeDisabled();
    expect(screen.getByText(/Every product needs a description and instruction/)).toBeInTheDocument();
  });

  it("are re-checked by Validate's Proceed at Staging", () => {
    persistStep("validate", "Staging");
    renderTab(
      makeUpdate({ lifecycleState: "Staging", promoteStages: ["UATStaging"], products: [COMPLETE, UNDESCRIBED] }),
    );

    expect(forwardButton()).toBeDisabled();
  });

  it("let Integration Tests promote once every product is described", async () => {
    persistStep("integration-tests");
    renderTab(makeUpdate());

    await userEvent.click(forwardButton());

    expect(state.transition).toHaveBeenCalledWith("StagingRequested");
  });

  it("aren't asked for again at WaitingFileApproval, where only the files are approved", async () => {
    state.additionalFileOperations = [{ file: "repository/components/dropins/a.jar", operation: "Added" }];
    state.isProductLead = true;
    renderTab(
      makeUpdate({ lifecycleState: "WaitingFileApproval", promoteStages: ["UATStaging"], products: [UNDESCRIBED] }),
    );

    await userEvent.click(forwardButton());

    expect(state.transition).toHaveBeenCalledWith("UATStaging");
  });
});

describe("a step with no usable next lifecycle state", () => {
  it("says why Proceed is disabled when the backend sends none", () => {
    persistStep("integration-tests");
    renderTab(makeUpdate({ promoteStages: [] }));

    expect(forwardButton()).toBeDisabled();
    expect(screen.getByText(/didn't provide a usable next lifecycle state/)).toBeInTheDocument();
  });

  it("says why Proceed is disabled when the backend sends a state it doesn't know", () => {
    persistStep("integration-tests");
    renderTab(makeUpdate({ promoteStages: ["SomeFutureState"] }));

    expect(forwardButton()).toBeDisabled();
    expect(screen.getByText(/didn't provide a usable next lifecycle state/)).toBeInTheDocument();
  });
});

describe("the Testing step's demote while it waits", () => {
  const demoteButton = () => screen.queryByRole("button", { name: "Demote to Development" });

  it("offers none while staging is being requested", () => {
    renderTab(makeUpdate({ lifecycleState: "StagingRequested", promoteStages: [] }));

    expect(screen.getByTestId("step-testing")).toBeInTheDocument();
    expect(demoteButton()).not.toBeInTheDocument();
  });

  it("offers none to a hotfix while its test environment is being requested", () => {
    renderTab(makeUpdate({ lifecycleState: "TestingEnvironmentRequested", isHotfix: true, promoteStages: [] }));

    expect(demoteButton()).not.toBeInTheDocument();
  });

  it("is there once the update is at Staging", () => {
    renderTab(makeUpdate({ lifecycleState: "Staging", promoteStages: ["UATStaging"] }));

    expect(demoteButton()).toBeInTheDocument();
  });
});
