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

// The Edit tab's step rules. The step shown must follow the update's
// lifecycleState, and the demote buttons must fit that state.

import { describe, expect, it } from "vitest";
import { computeUmtEditSteps, umtActiveStepId } from "../lib/umtEditSteps";
import { computeUmtDemoteActions } from "../lib/umtDemoteActions";
import { isTestingComplete } from "../lib/umtTesting";
import {
  isIntegrationTestsComplete,
  isIntegrationTestsSaveDisabled,
  umtTestPrError,
} from "../lib/umtIntegrationTests";
import { isCompleteUpdateValid } from "../lib/umtVerifying";
import { umtHasSecurityAdvisory } from "../lib/umtSecurityAdvisory";
import { umtCanReleaseHotfix, umtHotfixTestStatusLabel } from "../lib/umtHotfixRelease";

const NORMAL = computeUmtEditSteps("UpdateLifecycle", false);
const NORMAL_WITH_FILES = computeUmtEditSteps("UpdateLifecycle", true);
const CLOUD = computeUmtEditSteps("CloudSupportLifecycle", false);

function demoteTargets(...args: Parameters<typeof computeUmtDemoteActions>): string[] {
  return computeUmtDemoteActions(...args).map((action) => action.targetLifecycleState);
}

describe("lifecycle state → step mapping", () => {
  it("maps the core states", () => {
    expect(umtActiveStepId("Development", NORMAL)).toBe("files-analysis");
    expect(umtActiveStepId("PRAnalyzed", NORMAL)).toBe("files-analysis");
    expect(umtActiveStepId("ProductAnalyzed", NORMAL)).toBe("description-instruction");
    expect(umtActiveStepId("Staging", NORMAL)).toBe("testing");
    expect(umtActiveStepId("WaitingFileApproval", NORMAL_WITH_FILES)).toBe("file-approval");
    expect(umtActiveStepId("Released", NORMAL)).toBe("verifying");
  });

  // DemoteStagingRequested has no forward action: the update is still on its
  // way out of Staging, so it stays on Testing, where the Edit tab shows it
  // locked.
  it("keeps DemoteStagingRequested on the Testing step, not Files Analysis", () => {
    expect(umtActiveStepId("DemoteStagingRequested", NORMAL)).toBe("testing");
  });

  // Cloud Support's Development step proceeds to Released, a move that is not
  // available from Completed or OnHold, so those states have no step that
  // proceeds.
  it("keeps a Completed or OnHold Cloud Support update off its Development step", () => {
    expect(umtActiveStepId("Development", CLOUD)).toBe("cloud-development");
    expect(umtActiveStepId("Completed", CLOUD)).toBe("cloud-released");
    expect(umtActiveStepId("OnHold", CLOUD)).toBe("cloud-released");
  });
});

describe("demote actions", () => {
  it("offers Development from Files Analysis at PRAnalyzed, and only PRAnalyzed from Description", () => {
    expect(demoteTargets("files-analysis", "PRAnalyzed", false)).toEqual(["Development"]);
    expect(demoteTargets("description-instruction", "ProductAnalyzed", false)).toEqual(["PRAnalyzed"]);
  });

  it("lets an admin send a UATStaging update back to Staging, and offers Reopen on OnHold", () => {
    expect(demoteTargets("verifying", "UATStaging", true)).toEqual(["Staging"]);
    expect(demoteTargets("verifying", "OnHold", false)).toEqual(["Development"]);
  });

  // Moving an update out of UATStaging is an administrator's move.
  it("hides UATStaging's Demote to Testing from anyone but an admin", () => {
    expect(demoteTargets("verifying", "UATStaging", false)).toEqual([]);
  });

  // A demotion from Staging goes through DemoteStagingRequested, which tears
  // staging down; it can't go straight to Development.
  it("demotes Testing/Validate at Staging via DemoteStagingRequested", () => {
    expect(demoteTargets("testing", "Staging", false)).toEqual(["DemoteStagingRequested"]);
    expect(demoteTargets("validate", "Staging", false)).toEqual(["DemoteStagingRequested"]);
  });
});

describe("Testing step gate at Staging", () => {
  it("is closed before Staging and while a failed row has no comment", () => {
    expect(isTestingComplete("StagingRequested", [{ productId: 1, manualTestResult: "success" }])).toBe(false);
    expect(isTestingComplete("Staging", [{ productId: 1, manualTestResult: "failure", manualTestComment: " " }])).toBe(
      false,
    );
  });

  it("opens at Staging once every row has a passing result", () => {
    expect(
      isTestingComplete("Staging", [{ productId: 1, manualTestResult: "success", automatedTestResult: "success" }]),
    ).toBe(true);
  });

  it("stays closed when there are no test records, since nothing has been reviewed", () => {
    expect(isTestingComplete("Staging", [])).toBe(false);
    expect(isTestingComplete("Staging", null)).toBe(false);
    expect(isTestingComplete("Staging", undefined)).toBe(false);
  });

  it("stays closed until every automated run has succeeded", () => {
    for (const automatedTestResult of ["failure", "building", "pending", undefined]) {
      expect(isTestingComplete("Staging", [{ productId: 1, manualTestResult: "success", automatedTestResult }])).toBe(
        false,
      );
    }
    expect(
      isTestingComplete("Staging", [
        { productId: 1, manualTestResult: "success", automatedTestResult: "success" },
        { productId: 2, manualTestResult: "success", automatedTestResult: "failure" },
      ]),
    ).toBe(false);
  });

  it("lets an admin proceed past an automated run that has not succeeded", () => {
    expect(
      isTestingComplete("Staging", [{ productId: 1, manualTestResult: "success", automatedTestResult: "failure" }], {
        isAdmin: true,
      }),
    ).toBe(true);
  });

  it("still needs every manual result and at least one record for an admin", () => {
    expect(isTestingComplete("Staging", [], { isAdmin: true })).toBe(false);
    expect(
      isTestingComplete("Staging", [{ productId: 1, manualTestResult: "failure", manualTestComment: "" }], {
        isAdmin: true,
      }),
    ).toBe(false);
  });
});

describe("Integration Tests gate", () => {
  it("needs a Test PR or an ignore reason for every product", () => {
    expect(isIntegrationTestsComplete([{ productId: 1, testPr: "https://github.com/a/b/pull/1" }], false)).toBe(true);
    expect(isIntegrationTestsComplete([{ productId: 1, ignoreTestReason: "No tests" }], false)).toBe(true);
    expect(
      isIntegrationTestsComplete(
        [
          { productId: 1, testPr: "https://github.com/a/b/pull/1" },
          { productId: 2, testPr: "", ignoreTestReason: "" },
        ],
        false,
      ),
    ).toBe(false);
  });

  // A containerized update doesn't apply across products the way the other
  // updates do, so one Helm Chart Tag — read from the first product — is the
  // whole answer. Confirmed as intended; not a gap.
  it("reads a containerized update's Helm Chart Tag from the first product only", () => {
    expect(
      isIntegrationTestsComplete(
        [
          { productId: 1, helmChartTag: "v1.0.0" },
          { productId: 2, helmChartTag: "" },
        ],
        true,
      ),
    ).toBe(true);
    expect(isIntegrationTestsComplete([{ productId: 1, helmChartTag: " " }], true)).toBe(false);
  });
});

describe("hotfix release gate", () => {
  it("lets anyone release on a pass, and only a lead or admin otherwise", () => {
    expect(umtCanReleaseHotfix({ testsPassed: true, isAdmin: false, isProductLead: false })).toBe(true);
    expect(umtCanReleaseHotfix({ testsPassed: false, isAdmin: false, isProductLead: false })).toBe(false);
    expect(umtCanReleaseHotfix({ testsPassed: false, isAdmin: false, isProductLead: true })).toBe(true);
    expect(umtCanReleaseHotfix({ testsPassed: false, isAdmin: true, isProductLead: false })).toBe(true);
  });

  it("labels the Jenkins status", () => {
    expect(umtHotfixTestStatusLabel(null)).toBe("Not triggered");
    expect(umtHotfixTestStatusLabel("success")).toBe("Passed");
    expect(umtHotfixTestStatusLabel("triggered")).toBe("Running");
    expect(umtHotfixTestStatusLabel("unstable")).toBe("Unstable");
    expect(umtHotfixTestStatusLabel("failure")).toBe("Failed");
  });
});

describe("security advisory requirement", () => {
  it("counts only advisories with a name", () => {
    expect(umtHasSecurityAdvisory([{ securityAdvisoryName: "WSO2-2026-1234" }])).toBe(true);
    expect(umtHasSecurityAdvisory([{ securityAdvisoryName: "  " }, { securityAdvisoryName: null }])).toBe(false);
    expect(umtHasSecurityAdvisory([])).toBe(false);
    expect(umtHasSecurityAdvisory(null)).toBe(false);
  });
});

// The Test PRs asked for before StagingRequested live in wso2-support; only
// the format is checked here.
describe("Test PR — a pull request under https://github.com/wso2-support/", () => {
  it("accepts a wso2-support pull request", () => {
    expect(umtTestPrError("https://github.com/wso2-support/product-apim/pull/12")).toBeUndefined();
    expect(umtTestPrError("  https://github.com/wso2-support/product-is/pull/3  ")).toBeUndefined();
  });

  it("rejects other orgs, look-alike orgs, non-PR links and other hosts", () => {
    for (const value of [
      "https://github.com/wso2/product-apim/pull/12",
      "https://github.com/wso2-enterprise/product-apim/pull/12",
      "https://github.com/wso2-support-fork/product-apim/pull/12",
      "https://github.com/ballerina-platform/ballerina-lang/pull/1",
      "https://github.com/wso2-support/product-apim/issues/12",
      "https://github.com/wso2-support/product-apim/pull/12/files",
      "http://github.com/wso2-support/product-apim/pull/12",
      "https://gitlab.com/wso2-support/product-apim/pull/12",
      "product-apim#12",
    ]) {
      expect(umtTestPrError(value), value).toBeDefined();
    }
  });

  it("leaves a blank value to the required-field check", () => {
    expect(umtTestPrError("")).toBeUndefined();
  });

  it("holds Integration Tests' Save on an invalid Test PR, but not on an ignored row", () => {
    const base = { isDirty: true, isContainerizedUpdate: false, helmChartTag: "" };
    expect(
      isIntegrationTestsSaveDisabled({
        ...base,
        rows: [{ testPr: "https://github.com/someone/fork/pull/1", isIgnored: false, ignoreReason: "" }],
      }),
    ).toBe(true);
    expect(
      isIntegrationTestsSaveDisabled({
        ...base,
        rows: [{ testPr: "https://github.com/wso2-support/product-apim/pull/1", isIgnored: false, ignoreReason: "" }],
      }),
    ).toBe(false);
    expect(
      isIntegrationTestsSaveDisabled({
        ...base,
        rows: [{ testPr: "", isIgnored: true, ignoreReason: "No tests for this change" }],
      }),
    ).toBe(false);
  });
});

describe("Complete Update", () => {
  it("needs exactly one of public PRs or a reason", () => {
    expect(isCompleteUpdateValid({ publicPullRequests: ["https://github.com/wso2/carbon/pull/1"], reason: "" })).toBe(
      true,
    );
    expect(isCompleteUpdateValid({ publicPullRequests: [], reason: "Not applicable" })).toBe(true);
    expect(isCompleteUpdateValid({ publicPullRequests: [], reason: " " })).toBe(false);
    expect(
      isCompleteUpdateValid({ publicPullRequests: ["https://github.com/wso2/carbon/pull/1"], reason: "both" }),
    ).toBe(false);
  });

  // The PRs asked for on Released → Completed are public ones, under
  // https://github.com/wso2/.
  it("accepts only pull requests under https://github.com/wso2/", () => {
    expect(isCompleteUpdateValid({ publicPullRequests: ["https://example.com/x"], reason: "" })).toBe(false);
    expect(
      isCompleteUpdateValid({ publicPullRequests: ["https://github.com/wso2/carbon/issues/1"], reason: "" }),
    ).toBe(false);
    expect(
      isCompleteUpdateValid({ publicPullRequests: ["https://github.com/wso2-support/carbon/pull/1"], reason: "" }),
    ).toBe(false);
  });

  // An already-saved link may predate the rule, and the dialog can't edit it.
  it("counts an already-saved public PR without re-checking it", () => {
    expect(
      isCompleteUpdateValid({
        existingPullRequests: ["https://github.com/someone/fork/pull/1"],
        publicPullRequests: [""],
        reason: "",
      }),
    ).toBe(true);
    expect(
      isCompleteUpdateValid({
        existingPullRequests: ["https://github.com/wso2/carbon/pull/1"],
        publicPullRequests: [],
        reason: "Also a reason",
      }),
    ).toBe(false);
  });
});
