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

import { describe, expect, it } from "vitest";
import { computeUmtDemoteActions } from "./umtDemoteActions";
import type { UmtEditStepId } from "./umtEditSteps";

describe("computeUmtDemoteActions", () => {
  it("returns Demote to Development for files-analysis once the update is PRAnalyzed", () => {
    expect(computeUmtDemoteActions("files-analysis", "PRAnalyzed", false, false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "Development" },
    ]);
  });

  it("returns no demote buttons for files-analysis while the update is in Development", () => {
    expect(computeUmtDemoteActions("files-analysis", "Development", false, false)).toEqual([]);
  });

  it("returns only Demote to PRAnalyzed for description-instruction when not a hotfix", () => {
    expect(computeUmtDemoteActions("description-instruction", "ProductAnalyzed", false, false)).toEqual([
      { label: "Demote to PRAnalyzed", targetLifecycleState: "PRAnalyzed" },
    ]);
  });

  it("returns no demote buttons for description-instruction when it is a hotfix", () => {
    expect(computeUmtDemoteActions("description-instruction", "ProductAnalyzed", true, false)).toEqual([]);
  });

  it("returns Demote to Staging for file-approval only when isAdmin", () => {
    expect(computeUmtDemoteActions("file-approval", "WaitingFileApproval", false, true)).toEqual([
      { label: "Demote to Staging", targetLifecycleState: "Staging" },
    ]);
    expect(computeUmtDemoteActions("file-approval", "WaitingFileApproval", false, false)).toEqual([]);
  });

  it("returns Demote to Development for testing and validate, via DemoteStagingRequested from Staging", () => {
    expect(computeUmtDemoteActions("testing", "Staging", false, false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "DemoteStagingRequested" },
    ]);
    expect(computeUmtDemoteActions("validate", "Staging", false, false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "DemoteStagingRequested" },
    ]);
    expect(computeUmtDemoteActions("testing", "TestingEnvironmentCreated", true, false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "Development" },
    ]);
  });

  // Both states are waits: the update is on its way to Staging or to a test
  // environment, and there is nothing to demote yet.
  it("returns no demote for testing or validate while staging or a test environment is being requested", () => {
    for (const stepId of ["testing", "validate"] as const) {
      expect(computeUmtDemoteActions(stepId, "StagingRequested", false, false)).toEqual([]);
      expect(computeUmtDemoteActions(stepId, "TestingEnvironmentRequested", true, false)).toEqual([]);
      expect(computeUmtDemoteActions(stepId, "TestingEnvironmentRequested", false, true)).toEqual([]);
    }
  });

  it("returns Demote to Testing for verifying at UATStaging", () => {
    expect(computeUmtDemoteActions("verifying", "UATStaging", false, false)).toEqual([
      { label: "Demote to Testing", targetLifecycleState: "Staging" },
    ]);
  });

  it("returns a styled Reopen action for verifying at OnHold", () => {
    expect(computeUmtDemoteActions("verifying", "OnHold", false, false)).toEqual([
      { label: "Reopen", targetLifecycleState: "Development", color: "error" },
    ]);
  });

  it("returns no demote buttons for other verifying-family states", () => {
    for (const state of ["Released", "UAT", "UATRequested"] as const) {
      expect(computeUmtDemoteActions("verifying", state, false, false)).toEqual([]);
    }
  });

  it("returns no demote buttons for every step outside the legacy inventory", () => {
    const stepsWithoutDemote: UmtEditStepId[] = [
      "security-advisory",
      "integration-tests",
      "completed",
      "cloud-development",
      "cloud-released",
    ];
    for (const stepId of stepsWithoutDemote) {
      expect(computeUmtDemoteActions(stepId, null, false, true)).toEqual([]);
    }
  });
});
