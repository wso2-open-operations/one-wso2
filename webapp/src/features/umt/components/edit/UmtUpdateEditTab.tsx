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

import { useEffect, useState } from "react";
import { Alert, Box, Stack, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtLifecycleState } from "../../api/umtTypes";
import type { UmtUpdateSummary } from "../../api/umtUpdates";
import { useUmtGate } from "../../api/useUmtGate";
import { useUmtHotfixTestStatus, useUmtReleaseHotfix } from "../../api/useUmtHotfixRelease";
import { useUmtLifecycleTransition } from "../../api/useUmtLifecycleTransition";
import { useUmtIsAdvancingToPrAnalyzed } from "../../api/useUmtPrAnalysis";
import { useUmtProductAnalysis, useUmtPullRequestAnalysis } from "../../api/useUmtUpdateViewData";
import {
  computeUmtEditSteps,
  isFilesAnalysisPrAnalyzed,
  resolveUmtEditActiveIndex,
  umtActiveStepIndex,
  umtHasAdditionalFileOperations,
  umtStepRequiresDescriptions,
  type UmtEditStepId,
} from "../../lib/umtEditSteps";
import { computeUmtDemoteActions } from "../../lib/umtDemoteActions";
import { umtLifecycle, umtLifecycleState } from "../../lib/umtLifecycleState";
import { readPersistedEditStep, writePersistedEditStep } from "../../lib/umtLocalState";
import { isDescriptionInstructionComplete } from "../../lib/umtDescriptionInstruction";
import { isIntegrationTestsComplete } from "../../lib/umtIntegrationTests";
import { umtHasSecurityAdvisory } from "../../lib/umtSecurityAdvisory";
import { umtCanReleaseHotfix, umtHotfixTestsPassed } from "../../lib/umtHotfixRelease";
import { UMT_UPDATE_LOCKED_MESSAGE, umtIsUpdateLocked } from "../../lib/umtUpdateLock";
import { isTestingComplete, umtTestingBlocker } from "../../lib/umtTesting";
import { useUmtStagingTestResults } from "../../api/useUmtTesting";
import { useUmtLifecycleHistory } from "../../api/useUmtLifecycleHistory";
import UmtEditStepActions from "./UmtEditStepActions";
import UmtEditStepPlaceholder from "./UmtEditStepPlaceholder";
import UmtEditStepper from "./UmtEditStepper";
import UmtUnanalyzedChangesDialog from "./UmtUnanalyzedChangesDialog";
import UmtDescriptionInstructionStep from "./description-instruction/UmtDescriptionInstructionStep";
import UmtFileApprovalStep from "./file-approval/UmtFileApprovalStep";
import UmtFilesAnalysisStep from "./files-analysis/UmtFilesAnalysisStep";
import UmtHotfixReleaseReasonDialog from "./hotfix-release/UmtHotfixReleaseReasonDialog";
import UmtHotfixReleaseStep from "./hotfix-release/UmtHotfixReleaseStep";
import UmtIntegrationTestsStep from "./integration-tests/UmtIntegrationTestsStep";
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
  const lifecycleState = umtLifecycleState(update.lifecycleState);
  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, lifecycleState);
  const productAnalysis = useUmtProductAnalysis(id, lifecycleState, { alwaysEnabled: true });
  const stagingTestResults = useUmtStagingTestResults(id, lifecycleState);
  const hotfixTestStatus = useUmtHotfixTestStatus(id, update.isHotfix ? update.lifecycleState : null);
  const gate = useUmtGate();
  const transition = useUmtLifecycleTransition(id);
  const isAdvancingToPrAnalyzed = useUmtIsAdvancingToPrAnalyzed(id);
  const releaseHotfix = useUmtReleaseHotfix(id);
  const { showSuccess, showError } = useNotifications();

  const hasFileOps = umtHasAdditionalFileOperations(pullRequestAnalysis.data, lifecycleState);
  const steps = computeUmtEditSteps(umtLifecycle(update.lifecycle), hasFileOps);
  const backendActiveIndex = umtActiveStepIndex(lifecycleState, steps);
  const backendActiveId = steps[backendActiveIndex]?.id;

  // Identifies this particular stay in the current lifecycle state: the
  // lifecycle log gains an entry on every transition, so a demotion followed
  // by a promotion back to the same state still reads as a different stay.
  // Undefined until the log has loaded.
  const lifecycleHistory = useUmtLifecycleHistory(id);
  const lifecycleStay = lifecycleHistory.isSuccess
    ? `${update.lifecycleState ?? ""}#${lifecycleHistory.data.length}`
    : undefined;

  // A small step-position override: some adjacent steps share one backend
  // lifecycleState value (see umtEditSteps.ts), so a step whose Proceed only
  // advances locally (advancesLocallyToNextStep) moves this pointer instead
  // of calling the real transition. Persisted per update id, so a refresh
  // doesn't kick the user back to the backend-derived default (the first of
  // the ambiguous steps). It is stored with the stay it was reached in and
  // restored only within that same stay, so an update that has moved since
  // (even out and back again) opens on its real step. Any change of stay
  // while the page is open clears it too.
  const [localStepOverride, setLocalStepOverride] = useState<UmtEditStepId | null>(null);
  const [overrideStay, setOverrideStay] = useState<string | undefined>(undefined);
  if (lifecycleStay !== undefined && lifecycleStay !== overrideStay) {
    const persisted = overrideStay === undefined ? readPersistedEditStep(id) : null;
    setOverrideStay(lifecycleStay);
    setLocalStepOverride(
      persisted && persisted.stayKey === lifecycleStay ? (persisted.stepId as UmtEditStepId) : null,
    );
  }
  // Persist from an effect, not from the setter: the call sites above and
  // below run during render, and a localStorage write is a side effect render
  // isn't allowed to perform — it re-runs under StrictMode's double-invoke and
  // on any render React replays. Nothing is written before the stored value
  // has been read back, so a slow log load can't clear it first.
  useEffect(() => {
    if (overrideStay === undefined) return;
    writePersistedEditStep(id, localStepOverride ? { stayKey: overrideStay, stepId: localStepOverride } : null);
  }, [id, localStepOverride, overrideStay]);

  const [lastBackendActiveId, setLastBackendActiveId] = useState(backendActiveId);
  if (backendActiveId !== lastBackendActiveId) {
    setLastBackendActiveId(backendActiveId);
    setLocalStepOverride(null);
  }
  // See resolveUmtEditActiveIndex: a persisted override behind the
  // backend-derived step, or outside the run of steps the current
  // lifecycleState spans, is stale (the update moved without this browser's
  // knowledge) and must be discarded rather than honoured. An override for a
  // step not in the list yet (File Approval before the PR analysis loads) is
  // kept until the list settles.
  const activeIndex = resolveUmtEditActiveIndex(steps, backendActiveIndex, localStepOverride, update.lifecycleState);
  const overrideIndex = localStepOverride ? steps.findIndex((step) => step.id === localStepOverride) : -1;
  const isOverrideStale = overrideIndex !== -1 && overrideIndex !== activeIndex;
  if (isOverrideStale) setLocalStepOverride(null);
  const currentStep = steps[activeIndex];

  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [securityAdvisoryDirty, setSecurityAdvisoryDirty] = useState(false);
  const [isFilesAnalysisDirty, setIsFilesAnalysisDirty] = useState(false);
  const [isUnanalyzedConfirmOpen, setIsUnanalyzedConfirmOpen] = useState(false);
  const [isHotfixReasonOpen, setIsHotfixReasonOpen] = useState(false);

  const isFileApproval = currentStep.id === "file-approval";
  const isCloudDevelopment = currentStep.id === "cloud-development";
  const isFilesAnalysis = currentStep.id === "files-analysis";
  // Files Analysis spans Development and PRAnalyzed; the product analysis
  // (and the shared step actions under it) only exists once PRAnalyzed, and
  // only once the run that promoted the update has finished its analysis.
  const isProductAnalysis = isFilesAnalysis && isFilesAnalysisPrAnalyzed(update.lifecycleState) && !isAdvancingToPrAnalyzed;
  const isIntegrationTests = currentStep.id === "integration-tests";
  const isSecurityAdvisory = currentStep.id === "security-advisory";
  const isTesting = currentStep.id === "testing";
  const isVerifying = currentStep.id === "verifying";
  const isReleasedVerifying = isVerifying && lifecycleState === "Released";
  const isTerminal = currentStep.id === "completed" || currentStep.id === "cloud-released";
  // Mid-demotion from Staging nothing here may change: no step body, no
  // Proceed, Back or demote.
  const isLocked = umtIsUpdateLocked(update.lifecycleState);
  // A hotfix's Testing step is its release step: it leaves by its own
  // transitions (released from TestingEnvironmentCreated, or marked created
  // from TestingEnvironmentFailed), never by the regular local advance to
  // Validate.
  const isHotfixTesting = isTesting && Boolean(update.isHotfix);
  const isHotfixRelease = isHotfixTesting && update.lifecycleState === "TestingEnvironmentCreated";
  const advancesLocally = Boolean(currentStep.advancesLocallyToNextStep) && !isHotfixTesting;
  const hotfixTestsPassed = hotfixTestStatus.isSuccess && umtHotfixTestsPassed(hotfixTestStatus.data ?? null);
  // Only WaitingFileApproval is the approval itself. At Staging, File
  // Approval's Proceed is the developer's hand-off: with manual files it sends
  // the update to WaitingFileApproval, where a lead or admin approves, so
  // anyone may take this step.
  const isAwaitingFileApproval = isFileApproval && update.lifecycleState === "WaitingFileApproval";
  const roleAllowed = !isAwaitingFileApproval || gate.isAdmin || gate.isProductLead;
  // Proceed here promotes lifecycle state, so it shouldn't be available
  // until the product-analysis results this step promises have actually
  // loaded.
  const productAnalysisReady = !isProductAnalysis || productAnalysis.isSuccess;
  // Proceed is disabled until every product already has a non-blank
  // description and instruction — here and on each later step that moves the
  // update out of its state (see umtStepRequiresDescriptions).
  const descriptionInstructionReady =
    !umtStepRequiresDescriptions(currentStep.id, update.lifecycleState) ||
    isDescriptionInstructionComplete(update.products);
  // Proceed is disabled here until every product already has a Test PR or
  // an ignore reason (or, for a containerized update, a non-blank Helm
  // Chart Tag). Checks only persisted state, not a sibling component's
  // in-progress local edits — the same simplification productAnalysisReady
  // above already makes.
  const integrationTestsReady =
    !isIntegrationTests || isIntegrationTestsComplete(update.products, update.isContainerizedUpdate ?? false);
  // A security update needs a saved advisory before ProductAnalyzed →
  // StagingRequested. Checked on Security Advisory's own Next and again on
  // Integration Tests' Proceed — the step that fires that transition, and
  // one a persisted step pointer can land on directly. Security Advisory's
  // Next also waits for any unsaved changes, which leaving the step would
  // discard.
  const securityAdvisoryReady =
    (update.lifecycle !== "SecurityUpdateLifecycle" ||
      !(isSecurityAdvisory || isIntegrationTests) ||
      umtHasSecurityAdvisory(update.securityAdvisories)) &&
    !(isSecurityAdvisory && securityAdvisoryDirty);
  // Proceed here requires a two-part gate: the environment must have reached
  // Staging, AND the results must be in order — at least one record, every
  // automated run successful (an admin may go past that), and every product's
  // manual test result submitted.
  const testingBlocker = stagingTestResults.isSuccess
    ? umtTestingBlocker(stagingTestResults.data, gate.isAdmin)
    : null;
  const testingReady =
    !isTesting ||
    (isHotfixTesting
      ? lifecycleState === "TestingEnvironmentFailed" ||
        (isHotfixRelease &&
          umtCanReleaseHotfix({ testsPassed: hotfixTestsPassed, isAdmin: gate.isAdmin, isProductLead: gate.isProductLead }))
      : stagingTestResults.isSuccess &&
        isTestingComplete(lifecycleState, stagingTestResults.data, { isAdmin: gate.isAdmin }));
  // Only Released has a real forward action (the Complete Update dialog);
  // every other verifying-family state (UATStaging/UAT/UATRequested/OnHold)
  // has no working transition in this pass, so Proceed stays disabled for
  // all of them uniformly.
  const verifyingReady = !isVerifying || lifecycleState === "Released";
  const stepReady =
    productAnalysisReady &&
    descriptionInstructionReady &&
    securityAdvisoryReady &&
    integrationTestsReady &&
    testingReady &&
    verifyingReady;
  // File Approval, Cloud Support's Development step, Files Analysis,
  // Description and Instruction, and Integration Tests are wired
  // (currentStep.proceedWired); every other step's Proceed is a stub. Cloud
  // Support's single transition is hardcoded to "Released"; every other
  // wired step sends the backend's own promoteStages[0] rather than a
  // value this shell invents.
  const nextLifecycleState = isCloudDevelopment ? "Released" : umtLifecycleState(update.promoteStages?.[0]);

  const isValidate = currentStep.id === "validate";
  // Back is a plain, backend-call-free control shown only on Integration
  // Tests, Security Advisory, Validate, and File Approval — not a general
  // go-back-a-step control. Reuses the same localStepOverride pointer every
  // advancesLocallyToNextStep step already moves forward with, just one
  // step earlier instead — still a local-only move, no backend call.
  const canGoBack = isIntegrationTests || isSecurityAdvisory || isValidate || isFileApproval;
  const handleBack = () => {
    const prevStep = steps[activeIndex - 1];
    if (prevStep) setLocalStepOverride(prevStep.id);
  };

  const demoteActions = computeUmtDemoteActions(currentStep.id, lifecycleState, gate.isAdmin);
  const handleDemote = async (target: UmtLifecycleState) => {
    if (isLocked) return;
    try {
      await transition.mutateAsync(target);
      showSuccess(`Update ${id} demoted to ${target}`);
    } catch (error) {
      showError(`Demote failed. ${describeError(error)}`);
    }
  };

  const handleProceed = async (confirmedUnanalyzed = false) => {
    if (isLocked || !currentStep.proceedWired || !roleAllowed || !stepReady) return;
    if (isProductAnalysis && isFilesAnalysisDirty && !confirmedUnanalyzed) {
      setIsUnanalyzedConfirmOpen(true);
      return;
    }
    setIsUnanalyzedConfirmOpen(false);
    if (isHotfixRelease) {
      // A release without passing tests needs a reason; the dialog asks.
      if (hotfixTestsPassed) void handleReleaseHotfix(null);
      else setIsHotfixReasonOpen(true);
      return;
    }
    if (advancesLocally) {
      const nextStep = steps[activeIndex + 1];
      if (nextStep) setLocalStepOverride(nextStep.id);
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

  const handleReleaseHotfix = async (reason: string | null) => {
    try {
      await releaseHotfix.mutateAsync(reason);
      setIsHotfixReasonOpen(false);
      showSuccess(`Hotfix ${id} released.`);
    } catch (error) {
      showError(`Release failed. ${describeError(error)}`);
    }
  };

  // Duplicate is a dead end: no lifecycle state leads out of it, so there is
  // no workflow left to step through.
  if (lifecycleState === "Duplicate") {
    return <Alert severity="info">This update is a duplicate, so it has no update flow to edit.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <UmtEditStepper steps={steps} activeIndex={activeIndex} />
      <Box sx={{ pt: 2 }}>
        {isLocked ? (
          <Alert severity="info">{UMT_UPDATE_LOCKED_MESSAGE}</Alert>
        ) : isTerminal ? (
          lifecycleState === "OnHold" ? (
            <Alert severity="info">This update is on hold.</Alert>
          ) : (
            <Typography variant="h6" sx={{ color: "info.main", fontWeight: 700, textAlign: "center", py: 4 }}>
              All states completed.
            </Typography>
          )
        ) : isFilesAnalysis ? (
          <UmtFilesAnalysisStep id={id} update={update} onDirtyChange={setIsFilesAnalysisDirty} />
        ) : currentStep.id === "description-instruction" ? (
          <UmtDescriptionInstructionStep id={id} update={update} />
        ) : currentStep.id === "security-advisory" ? (
          <UmtSecurityAdvisoryStep id={id} update={update} onDirtyChange={setSecurityAdvisoryDirty} />
        ) : currentStep.id === "integration-tests" ? (
          <UmtIntegrationTestsStep id={id} update={update} />
        ) : currentStep.id === "testing" ? (
          update.isHotfix ? <UmtHotfixReleaseStep id={id} update={update} /> : <UmtTestingStep id={id} update={update} />
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
      {!isTerminal && !isLocked && (!isFilesAnalysis || isProductAnalysis) && (
        <UmtEditStepActions
          proceedLabel={
            isAwaitingFileApproval
              ? "Approve and Proceed"
              : isReleasedVerifying
                ? "Complete Update"
                : isHotfixRelease
                  ? "Release Hotfix"
                  : advancesLocally
                    ? "Next"
                    : "Proceed"
          }
          proceedDisabled={
            !currentStep.proceedWired ||
            !roleAllowed ||
            !stepReady ||
            (!advancesLocally && !isReleasedVerifying && !isHotfixRelease && !nextLifecycleState)
          }
          proceedLoading={transition.isPending || releaseHotfix.isPending}
          explanation={
            !currentStep.proceedWired
              ? "This step isn't wired up yet."
              : !roleAllowed
                ? "Only UMT Admins or Product Leads can approve this step."
                : !productAnalysisReady
                  ? "Waiting for product analysis results."
                  : !descriptionInstructionReady
                    ? "Every product needs a description and instruction before proceeding."
                    : !securityAdvisoryReady
                      ? isSecurityAdvisory && securityAdvisoryDirty
                        ? "Save your security advisory changes before proceeding."
                        : "A security update needs at least one security advisory before proceeding."
                      : !integrationTestsReady
                        ? "Every product needs a Test PR or an ignore reason before proceeding (or a Helm Chart Tag for a containerized update)."
                        : !testingReady
                          ? isHotfixRelease
                            ? "The integration tests must pass before release. A lead or admin can release without a pass, with a reason."
                            : isHotfixTesting
                              ? "Waiting for the hotfix testing environment to be created."
                              : lifecycleState !== "Staging"
                                ? "Waiting for the testing environment to reach Staging before proceeding."
                                : stagingTestResults.isError
                                  ? "The test results couldn't be loaded. Refresh the page to try again."
                                  : !stagingTestResults.isSuccess
                                    ? "Loading the test results."
                                    : testingBlocker === "no-results"
                                      ? "There are no test results to review yet."
                                      : testingBlocker === "automated-run"
                                        ? "The automated tests must pass before proceeding. Only an admin can proceed without a pass."
                                        : "Every product needs a submitted test result before proceeding."
                          : !verifyingReady
                            ? "This state has no further action available yet."
                            : !advancesLocally && !isReleasedVerifying && !isHotfixRelease && !nextLifecycleState
                              ? "The backend didn't provide a usable next lifecycle state for this update."
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
      {isHotfixReasonOpen && (
        <UmtHotfixReleaseReasonDialog
          open
          loading={releaseHotfix.isPending}
          onCancel={() => setIsHotfixReasonOpen(false)}
          onRelease={(reason) => void handleReleaseHotfix(reason)}
        />
      )}
      <UmtUnanalyzedChangesDialog
        open={isUnanalyzedConfirmOpen}
        message="Pull requests, manual files, products or files were changed here but haven't been analysed yet."
        onCancel={() => setIsUnanalyzedConfirmOpen(false)}
        onConfirm={() => void handleProceed(true)}
      />
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
