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

import type { UmtPullRequestAnalysis } from "../api/umtUpdates";

export type UmtEditStepId =
  | "pr-analysis"
  | "product-analysis"
  | "description-instruction"
  | "security-advisory"
  | "integration-tests"
  | "testing"
  | "validate"
  | "file-approval"
  | "verifying"
  | "completed"
  | "cloud-development"
  | "cloud-released";

export interface UmtEditStepDefinition {
  id: UmtEditStepId;
  label: string;
  // True only for the steps whose Proceed action is real, wired-up
  // behavior in this pass (File Approval, Cloud Support's Development step,
  // Product Analysis, Description and Instruction, Security Advisory,
  // Integration Tests, and Testing). Every other step is a placeholder
  // pending its own future implementation.
  proceedWired: boolean;
  // True only for a step whose own Proceed action is a local-only advance to
  // the next step in the array (no backend call) rather than a real
  // lifecycle transition — needed because some adjacent steps share one
  // backend lifecycleState value (see LIFECYCLE_STATE_TO_STEP below).
  // Meaningful only when proceedWired is also true; inert otherwise.
  advancesLocallyToNextStep?: boolean;
}

const NORMAL_STEPS_BASE: UmtEditStepDefinition[] = [
  { id: "pr-analysis", label: "PR Analysis", proceedWired: false },
  { id: "product-analysis", label: "Product Analysis", proceedWired: true },
  {
    id: "description-instruction",
    label: "Description and Instruction",
    proceedWired: true,
    advancesLocallyToNextStep: true,
  },
  { id: "integration-tests", label: "Integration Tests", proceedWired: true },
  { id: "testing", label: "Testing", proceedWired: true, advancesLocallyToNextStep: true },
  // advancesLocallyToNextStep is computed below, in computeUmtEditSteps: it
  // depends on whether File Approval ends up in the list, not on lifecycle
  // alone.
  { id: "validate", label: "Validate", proceedWired: true },
  // Never a local-advance step: Released opens the Complete Update dialog,
  // and every other verifying-family state (UATStaging/UAT/UATRequested/
  // OnHold) has no real forward action in this pass, so Proceed stays
  // disabled with an explanation for them instead.
  { id: "verifying", label: "Verifying", proceedWired: true },
  { id: "completed", label: "Completed", proceedWired: false },
];

const SECURITY_ADVISORY_STEP: UmtEditStepDefinition = {
  id: "security-advisory",
  label: "Security Advisory",
  proceedWired: true,
  advancesLocallyToNextStep: true,
};

const FILE_APPROVAL_STEP: UmtEditStepDefinition = {
  id: "file-approval",
  label: "File Approval",
  proceedWired: true,
};

const CLOUD_SUPPORT_STEPS: UmtEditStepDefinition[] = [
  { id: "cloud-development", label: "Development", proceedWired: true },
  { id: "cloud-released", label: "Released", proceedWired: false },
];

// Cloud Support replaces the whole stepper with its own 2-step flow. A
// security update inserts Security Advisory right after Description and
// Instruction; an update with unreviewed additional files (from PR analysis,
// or already `WaitingFileApproval`) inserts File Approval right before
// Verifying. Both insertions can apply independently of each other.
export function computeUmtEditSteps(
  lifecycle: string | null | undefined,
  hasAdditionalFileOperations: boolean,
): UmtEditStepDefinition[] {
  if (lifecycle === "CloudSupportLifecycle") {
    return CLOUD_SUPPORT_STEPS.map((step) => ({ ...step }));
  }

  const steps = NORMAL_STEPS_BASE.map((step) => ({ ...step }));

  if (lifecycle === "SecurityUpdateLifecycle") {
    const descriptionIndex = steps.findIndex((step) => step.id === "description-instruction");
    steps.splice(descriptionIndex + 1, 0, { ...SECURITY_ADVISORY_STEP });
  }

  if (hasAdditionalFileOperations) {
    const verifyingIndex = steps.findIndex((step) => step.id === "verifying");
    steps.splice(verifyingIndex, 0, { ...FILE_APPROVAL_STEP });
  }

  // Validate is the last step of the shared Staging-state run (see
  // LIFECYCLE_STATE_TO_STEP's comment) only when File Approval isn't ahead of
  // it, i.e. only when `!hasAdditionalFileOperations`. Unlike every other
  // advancesLocallyToNextStep step, this can't be a static per-lifecycle
  // flag: whether File Approval is present depends on this specific update's
  // PR-analysis result, not its lifecycle alone.
  const validateStep = steps.find((step) => step.id === "validate");
  if (validateStep) {
    validateStep.advancesLocallyToNextStep = steps.some((step) => step.id === "file-approval");
  }

  return steps;
}

// (additionalFileOperations?.length ?? 0) > 0 OR lifecycleState is already
// WaitingFileApproval — the latter forces the File Approval step into the
// list even before/without a fresh PR-analysis result.
export function umtHasAdditionalFileOperations(
  pullRequestAnalysis: UmtPullRequestAnalysis | null | undefined,
  lifecycleState: string | null | undefined,
): boolean {
  return (
    (pullRequestAnalysis?.additionalFileOperations?.length ?? 0) > 0 ||
    lifecycleState === "WaitingFileApproval"
  );
}

// Backend lifecycleState -> step id, for the normal/security workflows.
// ProductAnalyzed and the Staging-state family each cover a run of several
// steps that share one backend state (Description-and-Instruction, and for
// SecurityUpdateLifecycle updates also Security Advisory, both under
// ProductAnalyzed before Integration Tests; Testing/Validate under the
// Staging family); each ambiguous state defaults to the first step of its
// run, then the shell (UmtUpdateEditTab.tsx) tracks a local, non-persisted
// step-position override to move within it — every step but the last in the
// run only advances that local override (advancesLocallyToNextStep), and the
// real backend transition fires only once the LAST step in the run
// (Integration Tests for the ProductAnalyzed run; Validate, for the Staging
// run — unless File Approval is also present, in which case File Approval is
// the true last step and Validate is local-only too, see
// computeUmtEditSteps) has its own Proceed clicked. Validate has no entry in
// this map, same as Integration Tests and Security Advisory: it's only ever
// reached via the local override from Testing's Proceed, never restored
// directly from a backend lifecycleState on reload.
// TestingEnvironmentRequested/Created/Failed all map to "testing" so the step
// doesn't get stuck at its default.
const LIFECYCLE_STATE_TO_STEP: Record<string, UmtEditStepId> = {
  Development: "pr-analysis",
  PRAnalyzed: "product-analysis",
  ProductAnalyzed: "description-instruction",
  TestingEnvironmentRequested: "testing",
  TestingEnvironmentCreated: "testing",
  TestingEnvironmentFailed: "testing",
  StagingRequested: "testing",
  Staging: "testing",
  WaitingFileApproval: "file-approval",
  Released: "verifying",
  UATStaging: "verifying",
  UAT: "verifying",
  UATRequested: "verifying",
  OnHold: "verifying",
  Completed: "completed",
};

const CLOUD_SUPPORT_STATE_TO_STEP: Record<string, UmtEditStepId> = {
  Development: "cloud-development",
  Released: "cloud-released",
};

export function umtActiveStepId(
  lifecycleState: string | null | undefined,
  steps: UmtEditStepDefinition[],
): UmtEditStepId {
  const isCloudSupport = steps.some((step) => step.id === "cloud-development");
  const table = isCloudSupport ? CLOUD_SUPPORT_STATE_TO_STEP : LIFECYCLE_STATE_TO_STEP;
  const fallback: UmtEditStepId = isCloudSupport ? "cloud-development" : "pr-analysis";

  const mapped = lifecycleState ? table[lifecycleState] : undefined;
  if (mapped && steps.some((step) => step.id === mapped)) return mapped;
  return fallback;
}

export function umtActiveStepIndex(
  lifecycleState: string | null | undefined,
  steps: UmtEditStepDefinition[],
): number {
  const activeId = umtActiveStepId(lifecycleState, steps);
  const index = steps.findIndex((step) => step.id === activeId);
  return index === -1 ? 0 : index;
}

// Resolves the Edit tab's displayed step: a persisted `localStepOverride`
// (see UmtUpdateEditTab.tsx) only ever means "further along than the backend
// knows about" — an advancesLocallyToNextStep step moving the pointer ahead
// of a shared lifecycleState. If the persisted override is *behind* the
// backend-derived step instead (the update was promoted elsewhere, or by
// someone else, while this browser still had an older step persisted for
// it), the backend position must win.
export function resolveUmtEditActiveIndex(
  steps: UmtEditStepDefinition[],
  backendActiveIndex: number,
  overrideId: UmtEditStepId | null,
): number {
  if (!overrideId) return backendActiveIndex;
  const overrideIndex = steps.findIndex((step) => step.id === overrideId);
  if (overrideIndex === -1 || overrideIndex < backendActiveIndex) return backendActiveIndex;
  return overrideIndex;
}
