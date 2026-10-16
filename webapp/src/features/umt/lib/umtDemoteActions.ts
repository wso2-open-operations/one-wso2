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
import type { UmtEditStepId } from "./umtEditSteps";
import { umtLifecycleState } from "./umtLifecycleState";

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
  demoteStages: readonly string[] | null | undefined,
): UmtDemoteAction[] {
  switch (stepId) {
    case "product-analysis":
      return [{ label: "Demote to Development", targetLifecycleState: "Development" }];
    case "description-instruction":
      // Both of this step's demote buttons are gated on !isHotfix; there is
      // no separate rule for the hotfix branch.
      return isHotfix
        ? []
        : [
            { label: "Demote to PRAnalyzed", targetLifecycleState: "PRAnalyzed" },
            { label: "Demote to Development", targetLifecycleState: "Development" },
          ];
    case "file-approval":
      // Gated on isAdmin specifically (UMT_ADMIN role), narrower than the
      // Admin-or-Product-Lead gate on this step's own Proceed/approve action.
      // This asymmetry is intentional, not a bug.
      return isAdmin ? [{ label: "Demote to Staging", targetLifecycleState: "Staging" }] : [];
    case "testing":
    case "validate":
      // The valid targets differ across the testing states (Staging, for one,
      // can only request a demotion), so they come from the backend.
      return (demoteStages ?? []).flatMap((stage) => {
        const targetLifecycleState = umtLifecycleState(stage);
        return targetLifecycleState
          ? [{ label: umtDemoteStageLabel(targetLifecycleState), targetLifecycleState }]
          : [];
      });
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

// A staging demotion is requested rather than applied directly; the update
// ends up back in Development once it completes, which is what the user asked
// for.
function umtDemoteStageLabel(stage: UmtLifecycleState): string {
  if (stage === "DemoteStagingRequested") return "Demote to Development";
  if (stage === "OnHold") return "Change to On Hold";
  return `Demote to ${stage}`;
}
