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
    expect(computeUmtDemoteActions("files-analysis", "PRAnalyzed", false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "Development" },
    ]);
  });

  it("returns no demote buttons for files-analysis while the update is in Development", () => {
    expect(computeUmtDemoteActions("files-analysis", "Development", false)).toEqual([]);
  });

  it("returns only Demote to PRAnalyzed for description-instruction", () => {
    expect(computeUmtDemoteActions("description-instruction", "ProductAnalyzed", false)).toEqual([
      { label: "Demote to PRAnalyzed", targetLifecycleState: "PRAnalyzed" },
    ]);
  });

  it("returns Demote to Staging for file-approval only when isAdmin", () => {
    expect(computeUmtDemoteActions("file-approval", "WaitingFileApproval", true)).toEqual([
      { label: "Demote to Staging", targetLifecycleState: "Staging" },
    ]);
    expect(computeUmtDemoteActions("file-approval", "WaitingFileApproval", false)).toEqual([]);
  });

  it("returns Demote to Development for testing and validate, via DemoteStagingRequested from Staging", () => {
    expect(computeUmtDemoteActions("testing", "Staging", false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "DemoteStagingRequested" },
    ]);
    expect(computeUmtDemoteActions("validate", "Staging", false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "DemoteStagingRequested" },
    ]);
    expect(computeUmtDemoteActions("testing", "TestingEnvironmentCreated", false)).toEqual([
      { label: "Demote to Development", targetLifecycleState: "Development" },
    ]);
  });

  it("returns Demote to Testing for verifying at UATStaging only when isAdmin", () => {
    expect(computeUmtDemoteActions("verifying", "UATStaging", true)).toEqual([
      { label: "Demote to Testing", targetLifecycleState: "Staging" },
    ]);
    expect(computeUmtDemoteActions("verifying", "UATStaging", false)).toEqual([]);
  });

  it("returns a styled Reopen action for verifying at OnHold", () => {
    expect(computeUmtDemoteActions("verifying", "OnHold", false)).toEqual([
      { label: "Reopen", targetLifecycleState: "Development", color: "error" },
    ]);
  });

  it("returns no demote buttons for other verifying-family states", () => {
    for (const state of ["Released", "UAT", "UATRequested"] as const) {
      expect(computeUmtDemoteActions("verifying", state, false)).toEqual([]);
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
      expect(computeUmtDemoteActions(stepId, null, true)).toEqual([]);
    }
  });
});
