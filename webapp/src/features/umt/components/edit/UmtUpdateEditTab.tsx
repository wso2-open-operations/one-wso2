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

import { useState } from "react";
import { Box, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtUpdateSummary } from "../../api/umtUpdates";
import { useUmtGate } from "../../api/useUmtGate";
import { useUmtLifecycleTransition } from "../../api/useUmtLifecycleTransition";
import { useUmtProductAnalysis, useUmtPullRequestAnalysis } from "../../api/useUmtUpdateViewData";
import {
  computeUmtEditSteps,
  resolveUmtEditActiveIndex,
  umtActiveStepIndex,
  umtHasAdditionalFileOperations,
  type UmtEditStepId,
} from "../../lib/umtEditSteps";
import { computeUmtDemoteActions } from "../../lib/umtDemoteActions";
import { readPersistedEditStep, writePersistedEditStep } from "../../lib/umtLocalState";
import { isDescriptionInstructionComplete } from "../../lib/umtDescriptionInstruction";
import { isIntegrationTestsComplete } from "../../lib/umtIntegrationTests";
import { isTestingComplete } from "../../lib/umtTesting";
import { useUmtStagingTestResults } from "../../api/useUmtTesting";
import UmtEditStepActions from "./UmtEditStepActions";
import UmtEditStepPlaceholder from "./UmtEditStepPlaceholder";
import UmtEditStepper from "./UmtEditStepper";
import UmtDescriptionInstructionStep from "./description-instruction/UmtDescriptionInstructionStep";
import UmtFileApprovalStep from "./file-approval/UmtFileApprovalStep";
import UmtIntegrationTestsStep from "./integration-tests/UmtIntegrationTestsStep";
import UmtPrAnalysisStep from "./pr-analysis/UmtPrAnalysisStep";
import UmtProductAnalysisStep from "./product-analysis/UmtProductAnalysisStep";
import UmtSecurityAdvisoryStep from "./security-advisory/UmtSecurityAdvisoryStep";
import UmtTestingStep from "./testing/UmtTestingStep";
import UmtValidateStep from "./validate/UmtValidateStep";
import UmtCompleteUpdateDialog from "./verifying/UmtCompleteUpdateDialog";
import UmtVerifyingStep from "./verifying/UmtVerifyingStep";

export default function UmtUpdateEditTab({
  id,
  update,
}: {
  id: string;
  update: UmtUpdateSummary;
}) {
  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, update.lifecycleState);
  const productAnalysis = useUmtProductAnalysis(id, update.lifecycleState, { alwaysEnabled: true });
  const stagingTestResults = useUmtStagingTestResults(id, update.lifecycleState);
  const gate = useUmtGate();
  const transition = useUmtLifecycleTransition(id);
  const { showSuccess, showError } = useNotifications();

  const hasFileOps = umtHasAdditionalFileOperations(pullRequestAnalysis.data, update.lifecycleState);
  const steps = computeUmtEditSteps(update.lifecycle, hasFileOps);
  const backendActiveIndex = umtActiveStepIndex(update.lifecycleState, steps);
  const backendActiveId = steps[backendActiveIndex]?.id;

  // A small step-position override: some adjacent steps share one backend
  // lifecycleState value (see umtEditSteps.ts), so a step whose Proceed only
  // advances locally (advancesLocallyToNextStep) moves this pointer instead
  // of calling the real transition. Persisted per update id, so a refresh
  // doesn't kick the user back to the backend-derived default (the first of
  // the ambiguous steps). Reset
  // whenever the backend-derived step id itself changes — that only happens
  // after a real transition actually fires.
  const [localStepOverride, setLocalStepOverride] = useState<UmtEditStepId | null>(
    () => readPersistedEditStep(id) as UmtEditStepId | null,
  );
  const applyLocalStepOverride = (next: UmtEditStepId | null) => {
    setLocalStepOverride(next);
    writePersistedEditStep(id, next);
  };
  const [lastBackendActiveId, setLastBackendActiveId] = useState(backendActiveId);
  if (backendActiveId !== lastBackendActiveId) {
    setLastBackendActiveId(backendActiveId);
    applyLocalStepOverride(null);
  }
  // See resolveUmtEditActiveIndex: a persisted override behind the
  // backend-derived step is stale (the update moved on without this
  // browser's knowledge) and must be discarded rather than honoured.
  const activeIndex = resolveUmtEditActiveIndex(steps, backendActiveIndex, localStepOverride);
  const overrideIndex = localStepOverride ? steps.findIndex((step) => step.id === localStepOverride) : -1;
  const isOverrideStale = overrideIndex !== -1 && overrideIndex < backendActiveIndex;
  if (isOverrideStale) applyLocalStepOverride(null);
  const currentStep = steps[activeIndex];

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);

  const isFileApproval = currentStep.id === "file-approval";
  const isCloudDevelopment = currentStep.id === "cloud-development";
  const isProductAnalysis = currentStep.id === "product-analysis";
  const isDescriptionInstruction = currentStep.id === "description-instruction";
  const isIntegrationTests = currentStep.id === "integration-tests";
  const isSecurityAdvisory = currentStep.id === "security-advisory";
  const isTesting = currentStep.id === "testing";
  const isVerifying = currentStep.id === "verifying";
  const isReleasedVerifying = isVerifying && update.lifecycleState === "Released";
  const isTerminal = currentStep.id === "completed" || currentStep.id === "cloud-released";
  const roleAllowed = !isFileApproval || gate.isAdmin || gate.isProductLead;
  // Proceed here promotes lifecycle state, so it shouldn't be available
  // until the product-analysis results this step promises have actually
  // loaded.
  const productAnalysisReady = !isProductAnalysis || productAnalysis.isSuccess;
  // Proceed is disabled here until every product already has a non-blank
  // description and instruction.
  const descriptionInstructionReady =
    !isDescriptionInstruction || isDescriptionInstructionComplete(update.products);
  // Proceed is disabled here until every product already has a Test PR or
  // an ignore reason (or, for a containerized update, a non-blank Helm
  // Chart Tag). Checks only persisted state, not a sibling component's
  // in-progress local edits — the same simplification productAnalysisReady
  // above already makes.
  const integrationTestsReady =
    !isIntegrationTests || isIntegrationTestsComplete(update.products, update.isContainerizedUpdate ?? false);
  // Proceed here requires a two-part gate: the environment/backend side
  // must have reached Staging, AND every product's manual test result must
  // already be submitted.
  const testingReady =
    !isTesting || (stagingTestResults.isSuccess && isTestingComplete(update.lifecycleState, stagingTestResults.data));
  // Only Released has a real forward action (the Complete Update dialog);
  // every other verifying-family state (UATStaging/UAT/UATRequested/OnHold)
  // has no working transition in this pass, so Proceed stays disabled for
  // all of them uniformly.
  const verifyingReady = !isVerifying || update.lifecycleState === "Released";
  const stepReady =
    productAnalysisReady && descriptionInstructionReady && integrationTestsReady && testingReady && verifyingReady;
  // File Approval, Cloud Support's Development step, Product Analysis,
  // Description and Instruction, and Integration Tests are wired
  // (currentStep.proceedWired); every other step's Proceed is a stub. Cloud
  // Support's single transition is hardcoded to "Released"; every other
  // wired step sends the backend's own promoteStages[0] rather than a
  // value this shell invents.
  const nextLifecycleState = isCloudDevelopment ? "Released" : update.promoteStages?.[0];

  const isValidate = currentStep.id === "validate";
  // Back is a plain, backend-call-free control shown only on Integration
  // Tests, Security Advisory, Validate, and File Approval — not a general
  // go-back-a-step control. Reuses the same localStepOverride pointer every
  // advancesLocallyToNextStep step already moves forward with, just one
  // step earlier instead — still a local-only move, no backend call.
  const canGoBack = isIntegrationTests || isSecurityAdvisory || isValidate || isFileApproval;
  const handleBack = () => {
    const prevStep = steps[activeIndex - 1];
    if (prevStep) applyLocalStepOverride(prevStep.id);
  };

  const demoteActions = computeUmtDemoteActions(
    currentStep.id,
    update.lifecycleState,
    update.isHotfix ?? false,
    gate.isAdmin,
  );
  const handleDemote = async (target: string) => {
    try {
      await transition.mutateAsync(target);
      showSuccess(`Update ${id} demoted to ${target}`);
    } catch (error) {
      showError(`Demote failed. ${describeError(error)}`);
    }
  };

  const handleProceed = async () => {
    if (!currentStep.proceedWired || !roleAllowed || !stepReady) return;
    if (currentStep.advancesLocallyToNextStep) {
      const nextStep = steps[activeIndex + 1];
      if (nextStep) applyLocalStepOverride(nextStep.id);
      return;
    }
    if (isReleasedVerifying) {
      setCompleteDialogOpen(true);
      return;
    }
    if (!nextLifecycleState) return;
    try {
      await transition.mutateAsync(nextLifecycleState);
      showSuccess(`Update ${id} advanced to ${nextLifecycleState}`);
    } catch (error) {
      showError(`Proceed failed. ${describeError(error)}`);
    }
  };

  return (
    <Stack spacing={3}>
      <UmtEditStepper steps={steps} activeIndex={activeIndex} />
      <Box sx={{ pt: 2 }}>
        {isTerminal ? (
          <Typography variant="h6" sx={{ color: "info.main", fontWeight: 700, textAlign: "center", py: 4 }}>
            All states completed.
          </Typography>
        ) : currentStep.id === "pr-analysis" ? (
          <UmtPrAnalysisStep id={id} update={update} />
        ) : currentStep.id === "product-analysis" ? (
          <UmtProductAnalysisStep id={id} update={update} />
        ) : currentStep.id === "description-instruction" ? (
          <UmtDescriptionInstructionStep id={id} update={update} />
        ) : currentStep.id === "security-advisory" ? (
          <UmtSecurityAdvisoryStep id={id} update={update} />
        ) : currentStep.id === "integration-tests" ? (
          <UmtIntegrationTestsStep id={id} update={update} />
        ) : currentStep.id === "testing" ? (
          <UmtTestingStep id={id} update={update} />
        ) : currentStep.id === "validate" ? (
          <UmtValidateStep id={id} update={update} />
        ) : currentStep.id === "file-approval" ? (
          <UmtFileApprovalStep id={id} update={update} />
        ) : currentStep.id === "verifying" ? (
          <UmtVerifyingStep id={id} update={update} />
        ) : currentStep.id === "cloud-development" ? (
          // Cloud Support Development step has no body beyond the
          // stepper and Proceed button (update-edit-view/index.tsx:1446-1466) —
          // there's nothing here to be "not implemented yet", so this renders
          // nothing rather than reusing the placeholder built for genuinely
          // unbuilt steps.
          null
        ) : (
          <UmtEditStepPlaceholder stepLabel={currentStep.label} />
        )}
      </Box>
      {!isTerminal && currentStep.id !== "pr-analysis" && (
        <UmtEditStepActions
          proceedLabel={
            isFileApproval
              ? "Approve and Proceed"
              : isReleasedVerifying
                ? "Complete Update"
                : currentStep.advancesLocallyToNextStep
                  ? "Next"
                  : "Proceed"
          }
          proceedDisabled={
            !currentStep.proceedWired ||
            !roleAllowed ||
            !stepReady ||
            (!currentStep.advancesLocallyToNextStep && !isReleasedVerifying && !nextLifecycleState)
          }
          proceedLoading={transition.isPending}
          explanation={
            !currentStep.proceedWired
              ? "This step isn't wired up yet."
              : !roleAllowed
                ? "Only UMT Admins or Product Leads can approve this step."
                : !productAnalysisReady
                  ? "Waiting for product analysis results."
                  : !descriptionInstructionReady
                    ? "Every product needs a description and instruction before proceeding."
                    : !integrationTestsReady
                      ? "Every product needs a Test PR or an ignore reason before proceeding (or a Helm Chart Tag for a containerized update)."
                      : !testingReady
                        ? update.lifecycleState !== "Staging"
                          ? "Waiting for the testing environment to reach Staging before proceeding."
                          : "Every product needs a submitted test result before proceeding."
                        : !verifyingReady
                          ? "This state has no further action available yet."
                          : undefined
          }
          onProceed={() => void handleProceed()}
          onBack={canGoBack ? handleBack : undefined}
          demoteActions={demoteActions.map((action) => ({
            label: action.label,
            color: action.color,
            onClick: () => void handleDemote(action.targetLifecycleState),
          }))}
          demoteLoading={transition.isPending}
        />
      )}
      {isVerifying && (
        <UmtCompleteUpdateDialog
          id={id}
          update={update}
          open={completeDialogOpen}
          onClose={() => setCompleteDialogOpen(false)}
        />
      )}
    </Stack>
  );
}
