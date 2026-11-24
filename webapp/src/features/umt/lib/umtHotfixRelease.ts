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

import type { UmtUpdateBranch } from "../api/umtUpdates";
import { toWebAddress } from "./umtDocumentation";

// A hotfix is released from TestingEnvironmentCreated, gated on its Jenkins
// integration-test run: anyone may release once the run passed; a lead or
// admin may release without a pass, but only with a reason.

// The branch the hotfix's integration tests run from: its completed product
// branch. The backend triggers a run only with this branch's Jenkins job, so
// without it the tests cannot run.
export function umtHotfixProductBranch(branches: UmtUpdateBranch[] | undefined): UmtUpdateBranch | undefined {
  return branches?.find((branch) => branch.branchType === "ProductBranch" && branch.status === "Completed");
}

// The Jenkins job the hotfix's integration tests run on: the job of its
// completed product branch. The job is known once the branch is created, so it
// does not wait on a run. Empty when there is no such branch or its job is not
// an http(s) address; a branch of a Gradle repository has no Jenkins job.
export function umtHotfixJobUrl(branches: UmtUpdateBranch[] | undefined): string {
  return toWebAddress(umtHotfixProductBranch(branches)?.jenkinsJobUrl);
}

// The run's buildStatus ("success", "triggered", "unstable", "failure", ...),
// or null when no run has been started yet.
export type UmtHotfixTestStatus = string | null;

export function umtHotfixTestsPassed(status: UmtHotfixTestStatus): boolean {
  return status === "success";
}

export function umtHotfixTestsRunning(status: UmtHotfixTestStatus): boolean {
  return status === "triggered";
}

// `testsPassed` is false while the run's status is still unknown, so only a
// lead or admin can release then — and with a reason.
export function umtCanReleaseHotfix(params: {
  testsPassed: boolean;
  isAdmin: boolean;
  isProductLead: boolean;
}): boolean {
  return params.testsPassed || params.isAdmin || params.isProductLead;
}

export function umtHotfixTestStatusLabel(status: UmtHotfixTestStatus): string {
  if (status === null) return "Not triggered";
  if (umtHotfixTestsPassed(status)) return "Passed";
  if (umtHotfixTestsRunning(status)) return "Running";
  if (status === "unstable") return "Unstable";
  return "Failed";
}
