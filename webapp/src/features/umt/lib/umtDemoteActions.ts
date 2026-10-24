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

import type { UmtLifecycleState } from "../api/umtTypes";
import { isFilesAnalysisPrAnalyzed, type UmtEditStepId } from "./umtEditSteps";

export interface UmtDemoteAction {
  label: string;
  targetLifecycleState: UmtLifecycleState;
  color?: "error";
}

// None of these demote/reopen buttons has its own disabled condition or
// confirmation dialog. The step-id model here covers both security and
// non-security lifecycle variants uniformly, so testing/validate need no
// separate branching for them.
export function computeUmtDemoteActions(
  stepId: UmtEditStepId,
  lifecycleState: UmtLifecycleState | null | undefined,
  isHotfix: boolean,
  isAdmin: boolean,
): UmtDemoteAction[] {
  switch (stepId) {
    case "files-analysis":
      return isFilesAnalysisPrAnalyzed(lifecycleState)
        ? [{ label: "Demote to Development", targetLifecycleState: "Development" }]
        : [];
    case "description-instruction":
      // This step's demote button is gated on !isHotfix; there is no separate
      // rule for the hotfix branch.
      return isHotfix ? [] : [{ label: "Demote to PRAnalyzed", targetLifecycleState: "PRAnalyzed" }];
    case "file-approval":
      // Gated on isAdmin specifically (UMT_ADMIN role), narrower than the
      // Admin-or-Product-Lead gate on this step's own Proceed/approve action.
      // This asymmetry is intentional, not a bug.
      return isAdmin ? [{ label: "Demote to Staging", targetLifecycleState: "Staging" }] : [];
    case "testing":
    case "validate":
      // While staging or a test environment is being requested the update is
      // on its way and there is nothing to demote yet.
      if (lifecycleState === "StagingRequested" || lifecycleState === "TestingEnvironmentRequested") return [];
      // From Staging, the demotion is requested through DemoteStagingRequested,
      // which tears staging down before the update lands in Development; it
      // can't go straight to Development.
      return [
        {
          label: "Demote to Development",
          targetLifecycleState: lifecycleState === "Staging" ? "DemoteStagingRequested" : "Development",
        },
      ];
    case "verifying":
      if (lifecycleState === "UATStaging") {
        return [{ label: "Demote to Testing", targetLifecycleState: "Staging" }];
      }
      if (lifecycleState === "OnHold") {
        return [{ label: "Reopen", targetLifecycleState: "Development", color: "error" }];
      }
      return [];
    default:
      return [];
  }
}
