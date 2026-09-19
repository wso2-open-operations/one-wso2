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
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DataGrid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PlusIcon, TrashIcon } from "@wso2/oxygen-ui-icons-react";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtBundleInfoChange, UmtFileOperation, UmtPullRequestAnalysisItem, UmtUpdateSummary } from "../../../api/umtUpdates";
import type { UmtUpdateType } from "../../../api/umtTypes";
import { useUmtPullRequestAnalysis } from "../../../api/useUmtUpdateViewData";
import {
  UmtPartialProceedError,
  useUmtPrAnalysisStatus,
  useUmtProceedFromPrAnalysis,
  useUmtStartPullRequestAnalysis,
} from "../../../api/useUmtPrAnalysis";
import {
  bundleInfoApplies,
  GITHUB_PR_REGEX,
  isPrAnalyzeDisabled,
  pluginsFileHasMatchingBundleInfo,
  prAnalysisStatusMessage,
} from "../../../lib/umtPrAnalysis";
import {
  readPersistedBundleInfoChanges,
  readPersistedManualFiles,
  readPersistedPullRequests,
  writePersistedBundleInfoChanges,
  writePersistedManualFiles,
  writePersistedPullRequests,
} from "../../../lib/umtLocalState";
import UmtAddManualFilesSection from "./UmtAddManualFilesSection";
import UmtPrAnalysisResults from "./UmtPrAnalysisResults";

const { DataGrid: DataGridComponent } = DataGrid;

export default function UmtPrAnalysisStep({ id, update }: { id: string; update: UmtUpdateSummary }) {
  const { showSuccess, showError } = useNotifications();
  const pullRequestAnalysis = useUmtPullRequestAnalysis(id, update.lifecycleState, { alwaysEnabled: true });
  const isDevelopment = update.lifecycleState === "Development";
  const status = useUmtPrAnalysisStatus(id, update.praStatus, isDevelopment);
  const startAnalysis = useUmtStartPullRequestAnalysis(id);
  const proceed = useUmtProceedFromPrAnalysis(id);
  const [isProceedWarningOpen, setIsProceedWarningOpen] = useState(false);

  const [updateType, setUpdateType] = useState<UmtUpdateType>("generalUpdate");
  // Drafts are persisted to localStorage scoped by update id, so rows from
  // one update's PR Analysis step never leak into another's.
  const [pullRequests, setPullRequestsState] = useState<UmtPullRequestAnalysisItem[]>(() =>
    readPersistedPullRequests(id),
  );
  const [manualFiles, setManualFilesState] = useState<UmtFileOperation[]>(() => readPersistedManualFiles(id));
  const [bundlesInfoChanges, setBundlesInfoChangesState] = useState<UmtBundleInfoChange[]>(() =>
    readPersistedBundleInfoChanges(id),
  );
  const setPullRequests = (rows: UmtPullRequestAnalysisItem[]) => {
    setPullRequestsState(rows);
    writePersistedPullRequests(id, rows);
  };
  const setManualFiles = (rows: UmtFileOperation[]) => {
    setManualFilesState(rows);
    writePersistedManualFiles(id, rows);
  };
  const setBundlesInfoChanges = (rows: UmtBundleInfoChange[]) => {
    setBundlesInfoChangesState(rows);
    writePersistedBundleInfoChanges(id, rows);
  };
  const [hasNewInputs, setHasNewInputs] = useState(true);

  const [isPrDialogOpen, setIsPrDialogOpen] = useState(false);
  const [prUrl, setPrUrl] = useState("");
  const [preferredVersion, setPreferredVersion] = useState("");
  const [prError, setPrError] = useState<string | undefined>();
  const [deletePr, setDeletePr] = useState<string | null>(null);
  const [missingBundleInfoFiles, setMissingBundleInfoFiles] = useState<UmtFileOperation[]>([]);

  const markDirty = () => setHasNewInputs(true);

  const isInFlight = status.data === "QUEUED" || status.data === "PROCESSING";
  const isCompleted = status.data === "COMPLETED";

  // Disable inputs from the moment Analyze is clicked (the mutation's own
  // isPending), not just once the server confirms QUEUED. No separate "awaiting confirmation" grace flag
  // is needed once the mutation resolves: the backend commits praStatus to
  // QUEUED synchronously before the start-analysis POST even returns
  // (verified against the backend source), so the query invalidation the
  // mutation fires on success is guaranteed to refetch an already-QUEUED
  // status — isInFlight picks it up immediately, no race to bridge.
  const isBusy = isInFlight || startAnalysis.isPending;

  if (!isDevelopment && !isCompleted) {
    return <Alert severity="info">PR Analysis can only be done in Development.</Alert>;
  }

  function addPullRequest() {
    const trimmed = prUrl.trim();
    if (!GITHUB_PR_REGEX.test(trimmed)) {
      setPrError("Invalid Pull Request URL");
      return;
    }
    if (pullRequests.some((row) => row.pr === trimmed)) {
      setPrError("This pull request has already been added.");
      return;
    }
    const normalizedVersion = preferredVersion.trim().toLowerCase() === "auto" ? "" : preferredVersion.trim();
    setPullRequests([...pullRequests, { pr: trimmed, preferredVersion: normalizedVersion }]);
    markDirty();
    setPrUrl("");
    setPreferredVersion("");
    setPrError(undefined);
    setIsPrDialogOpen(false);
  }

  function confirmDeletePr() {
    if (!deletePr) return;
    setPullRequests(pullRequests.filter((row) => row.pr !== deletePr));
    markDirty();
    setDeletePr(null);
  }

  // Blocks Analyze (with a "Missing Bundle Info Paths" dialog) when a
  // /plugins/ Added or Removed file has no corresponding bundle-info entry,
  // since validating only at add time would let a file added before its
  // bundle info (or one whose entry was later deleted) reach the backend
  // unguarded. Only General Update collects manual files/bundle info at all.
  function handleAnalyzeClick() {
    if (updateType === "generalUpdate") {
      const missing = manualFiles.filter(
        (file) =>
          bundleInfoApplies(file.file ?? "", file.operation) &&
          !pluginsFileHasMatchingBundleInfo(file.file ?? "", bundlesInfoChanges),
      );
      if (missing.length > 0) {
        setMissingBundleInfoFiles(missing);
        return;
      }
    }
    void handleAnalyze();
  }

  async function handleAnalyze() {
    try {
      // Only General Update collects manual files/bundle info, and Instructions
      // Only collects neither — send empty arrays rather than whatever is left
      // over in state from a previously-selected update type.
      await startAnalysis.mutateAsync({
        updateId: id,
        pullRequests: updateType === "instructionsOnlyUpdate" ? [] : pullRequests,
        additionalFileOperations: updateType === "generalUpdate" ? manualFiles : [],
        bundlesInfoChanges: updateType === "generalUpdate" ? bundlesInfoChanges : [],
        isInstructionsOnly: updateType === "instructionsOnlyUpdate",
        isContainerizedUpdate: updateType === "containerizedProductUpdate",
      });
      setHasNewInputs(false);
      showSuccess("PR analysis started.");
    } catch (error) {
      showError(`Failed to start PR analysis. ${describeError(error)}`);
    }
  }

  // Warns before proceeding that added/modified files will be copied into
  // all applicable products during the next step.
  const hasAddedOrModifiedFiles = (pullRequestAnalysis.data?.additionalFileOperations ?? []).some(
    (op) => op.operation?.toLowerCase() === "added" || op.operation?.toLowerCase() === "modified",
  );

  function handleProceedClick() {
    if (hasAddedOrModifiedFiles) {
      setIsProceedWarningOpen(true);
      return;
    }
    void handleProceed();
  }

  async function handleProceed() {
    setIsProceedWarningOpen(false);
    try {
      await proceed.mutateAsync();
      showSuccess(`Update ${id} advanced to PRAnalyzed.`);
    } catch (error) {
      if (error instanceof UmtPartialProceedError) {
        showError(error.message);
      } else {
        showError(`Proceed failed. ${describeError(error)}`);
      }
    }
  }

  const statusMessage = prAnalysisStatusMessage(status.data);
  const statusColor =
    statusMessage.tone === "error" ? "error.main" : statusMessage.tone === "success" ? "success.main" : "text.primary";
  const analyzeDisabled = isPrAnalyzeDisabled({
    status: status.data,
    hasNewInputsSinceLastAnalysis: hasNewInputs,
    updateType,
    pullRequestCount: pullRequests.length,
    // Same guard as the submitted payload: manual files only count for
    // General Update, so leftover files from a prior type selection can't
    // make this look non-empty for a type that won't actually send them.
    manualFileCount: updateType === "generalUpdate" ? manualFiles.length : 0,
  });

  return (
    <Stack spacing={3}>
      {isDevelopment && (
        <Box>
          <Typography variant="h6">Update Type</Typography>
          <RadioGroup
            row
            value={updateType}
            onChange={(e) => {
              setUpdateType(e.target.value as UmtUpdateType);
              markDirty();
            }}
            sx={{ opacity: isBusy ? 0.5 : 1, pointerEvents: isBusy ? "none" : "auto" }}
          >
            <FormControlLabel value="generalUpdate" control={<Radio />} label="General Update" />
            <FormControlLabel value="instructionsOnlyUpdate" control={<Radio />} label="Instructions Only Update" />
            <FormControlLabel
              value="containerizedProductUpdate"
              control={<Radio />}
              label="Containerized Product Update"
            />
          </RadioGroup>
          <Divider sx={{ mt: 2 }} />

          {updateType !== "instructionsOnlyUpdate" && (
            <Box sx={{ opacity: isBusy ? 0.5 : 1, pointerEvents: isBusy ? "none" : "auto" }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 2 }}>
                <Typography variant="h6">Pull Requests</Typography>
                <IconButton aria-label="Add pull request" size="small" onClick={() => setIsPrDialogOpen(true)}>
                  <PlusIcon size={18} />
                </IconButton>
              </Stack>
              {pullRequests.length > 0 ? (
                <DataGridComponent
                  autoHeight
                  columnHeaderHeight={40}
                  disableColumnMenu
                  disableRowSelectionOnClick
                  getRowHeight={() => "auto"}
                  getRowId={(row: UmtPullRequestAnalysisItem) => row.pr ?? ""}
                  hideFooter
                  rows={pullRequests}
                  sx={{ mt: 2 }}
                  columns={[
                    {
                      field: "pr",
                      headerName: "Pull Request",
                      flex: 3,
                      sortable: false,
                      renderCell: (params: { row: UmtPullRequestAnalysisItem }) => (
                        <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                          {params.row.pr && (
                            <Link href={params.row.pr} target="_blank" rel="noopener noreferrer" underline="hover">
                              {params.row.pr}
                            </Link>
                          )}
                        </Stack>
                      ),
                    },
                    {
                      field: "preferredVersion",
                      headerName: "Preferred Version",
                      flex: 1,
                      sortable: false,
                      renderCell: (params: { row: UmtPullRequestAnalysisItem }) => (
                        <Stack sx={{ justifyContent: "center", minHeight: "100%", py: 0.75, width: "100%" }}>
                          {params.row.preferredVersion}
                        </Stack>
                      ),
                    },
                    {
                      field: "delete",
                      headerName: "",
                      width: 52,
                      sortable: false,
                      renderCell: (params: { row: UmtPullRequestAnalysisItem }) => (
                        <Stack sx={{ justifyContent: "center", minHeight: "100%", width: "100%" }}>
                          <IconButton
                            aria-label="Delete pull request"
                            size="small"
                            onClick={() => setDeletePr(params.row.pr ?? null)}
                          >
                            <TrashIcon size={16} />
                          </IconButton>
                        </Stack>
                      ),
                    },
                  ]}
                />
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Add a pull request to analyze.
                </Typography>
              )}
            </Box>
          )}

          {updateType === "generalUpdate" && (
            <>
              <Divider sx={{ my: 2 }} />
              <UmtAddManualFilesSection
                updateId={id}
                disabled={isBusy}
                files={manualFiles}
                onFilesChange={setManualFiles}
                bundlesInfoChanges={bundlesInfoChanges}
                onBundlesInfoChanged={setBundlesInfoChanges}
                onDirty={markDirty}
              />
            </>
          )}

          <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "flex-end", mt: 3 }}>
            {isBusy && <CircularProgress size={22} />}
            {updateType !== "instructionsOnlyUpdate" && (
              <Stack sx={{ flex: 1, minWidth: 0 }}>
                {startAnalysis.isPending ? (
                  <Typography variant="body2" color="text.primary">
                    Starting analysis…
                  </Typography>
                ) : (
                  statusMessage.lines.map((line, index) => (
                    <Typography key={index} variant="body2" color={statusColor} sx={{ wordBreak: "break-word" }}>
                      {line}
                    </Typography>
                  ))
                )}
              </Stack>
            )}
            <Button
              variant="contained"
              disabled={analyzeDisabled}
              loading={startAnalysis.isPending}
              onClick={handleAnalyzeClick}
            >
              Analyze
            </Button>
          </Stack>
          <Divider sx={{ mt: 3 }} />
        </Box>
      )}

      {isCompleted && pullRequestAnalysis.data && <UmtPrAnalysisResults result={pullRequestAnalysis.data} />}

      {isCompleted && (
        <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
          <Button variant="contained" loading={proceed.isPending} onClick={handleProceedClick}>
            Proceed
          </Button>
        </Stack>
      )}

      <Dialog open={isPrDialogOpen} onClose={() => setIsPrDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Pull Request</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Pull Request URL"
              value={prUrl}
              onChange={(e) => {
                setPrUrl(e.target.value);
                setPrError(undefined);
              }}
              error={Boolean(prError)}
              helperText={prError}
            />
            <TextField
              fullWidth
              label="Preferred Version (Optional)"
              placeholder="Auto"
              value={preferredVersion}
              onChange={(e) => setPreferredVersion(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsPrDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!prUrl.trim()} onClick={addPullRequest}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deletePr)} onClose={() => setDeletePr(null)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this pull request?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletePr(null)}>Cancel</Button>
          <Button variant="contained" onClick={confirmDeletePr}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isProceedWarningOpen} onClose={() => setIsProceedWarningOpen(false)}>
        <DialogTitle>Added and Modified Files</DialogTitle>
        <DialogContent>
          <DialogContentText>
            There are modified and added files in this update.
            <br />
            UMT will copy the added files into all the applicable products in the next section.
            <br />
            If you want to exclude the added files going into applicable products, please remove the added files
            from this update and create a separate update with the added files.
            <br />
            Do you need to proceed without excluding the added files?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void handleProceed()}>Yes Proceed</Button>
          <Button onClick={() => setIsProceedWarningOpen(false)}>No</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={missingBundleInfoFiles.length > 0} onClose={() => setMissingBundleInfoFiles([])}>
        <DialogTitle>Missing Bundle Info Paths</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>
            The following /plugins/ files need a corresponding Bundle Info Changes entry before this update can
            be analyzed:
          </DialogContentText>
          <Stack spacing={0.5}>
            {missingBundleInfoFiles.map((file, index) => (
              <Typography key={index} variant="body2" sx={{ fontFamily: "monospace" }}>
                {file.operation}: {file.file}
              </Typography>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setMissingBundleInfoFiles([])}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
