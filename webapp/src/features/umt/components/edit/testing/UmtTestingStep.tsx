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
import { Alert, Box, Button, Divider, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from "@wso2/oxygen-ui";
import { describeError } from "@api/errors";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { UmtStagingTestResultRecord, UmtStagingTestResultRequest, UmtUpdateSummary } from "../../../api/umtUpdates";
import { UmtPartialTestingSaveError, useUmtSaveTestingResults, useUmtStagingTestResults } from "../../../api/useUmtTesting";
import {
  UMT_TESTING_RESULT_OPTIONS,
  umtAutomatedTestResultColor,
  umtAutomatedTestResultLabel,
  umtTestingResultRequiresComment,
} from "../../../lib/umtTesting";

interface Draft {
  result: string;
  comment: string;
}

function emptyStateMessage(lifecycleState: string | null | undefined): { severity: "info" | "error"; text: string } {
  switch (lifecycleState) {
    case "TestingEnvironmentRequested":
      return { severity: "info", text: "Provisioning the testing environment…" };
    case "TestingEnvironmentCreated":
      return { severity: "info", text: "Testing environment created. Waiting for test results…" };
    case "TestingEnvironmentFailed":
      return { severity: "error", text: "The testing environment failed to provision." };
    case "StagingRequested":
      return { severity: "info", text: "Processing test request…" };
    default:
      return { severity: "info", text: "No products to review yet." };
  }
}

export default function UmtTestingStep({ id, update }: { id: string; update: UmtUpdateSummary }) {
  const { showSuccess, showError } = useNotifications();
  const stagingTestResults = useUmtStagingTestResults(id, update.lifecycleState);
  const saveMutation = useUmtSaveTestingResults(id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  if (stagingTestResults.isPending) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading testing results…
      </Typography>
    );
  }

  if (stagingTestResults.isError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={() => void stagingTestResults.refetch()}>
            Retry
          </Button>
        }
      >
        Failed to load testing results.
      </Alert>
    );
  }

  const rows = stagingTestResults.data ?? [];

  if (rows.length === 0) {
    const { severity, text } = emptyStateMessage(update.lifecycleState);
    return <Alert severity={severity}>{text}</Alert>;
  }

  function updateDraft(row: UmtStagingTestResultRecord, patch: Partial<Draft>) {
    const productId = String(row.productId);
    setDrafts((prev) => ({
      ...prev,
      [productId]: {
        result: prev[productId]?.result ?? row.manualTestResult ?? "",
        comment: prev[productId]?.comment ?? row.manualTestComment ?? "",
        ...patch,
      },
    }));
  }

  const touchedProductIds = Object.keys(drafts);
  const isSaveDisabled =
    touchedProductIds.length === 0 ||
    touchedProductIds.some((productId) => {
      const draft = drafts[productId];
      return !draft.result || (umtTestingResultRequiresComment(draft.result) && !draft.comment.trim());
    });

  async function handleSave() {
    // A background refetch can drop a row (e.g. the staging results poll)
    // while its draft is still held locally; skip it instead of crashing.
    const payload: UmtStagingTestResultRequest[] = touchedProductIds.flatMap((productId) => {
      const row = rows.find((r) => String(r.productId) === productId);
      if (!row) return [];
      const draft = drafts[productId];
      return [
        {
          productId: row.productId,
          productName: row.productName ?? "",
          baseVersion: row.baseVersion ?? "",
          manualTestResult: draft.result,
          manualTestComment: draft.comment,
          channel: "full",
        },
      ];
    });
    const sentProductIds = new Set(payload.map((row) => String(row.productId)));
    try {
      await saveMutation.mutateAsync(payload);
      showSuccess("Test results saved.");
      // Only clear drafts that were actually sent — a product dropped by a
      // background poll between the edit and this click (L109-111) never
      // made it into `payload`, so its draft must survive in case the poll
      // brings the row back.
      setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([productId]) => !sentProductIds.has(productId))));
    } catch (error) {
      if (error instanceof UmtPartialTestingSaveError) {
        const failedIds = new Set(error.failedRows.map((row) => String(row.productId)));
        setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([productId]) => failedIds.has(productId))));
        showError(
          `Saved ${payload.length - error.failedRows.length} of ${payload.length} row(s). ${error.failedRows.length} failed — retry below.`,
        );
      } else {
        showError(`Failed to save test results. ${describeError(error)}`);
      }
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h5">Testing</Typography>
      <Stack spacing={2}>
        {rows.map((row) => {
          const key = String(row.productId);
          const draft = drafts[key];
          const currentResult = draft?.result ?? row.manualTestResult ?? "";
          const currentComment = draft?.comment ?? row.manualTestComment ?? "";
          return (
            <Paper key={key} variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="h6">
                  {row.productName ?? "N/A"} - {row.baseVersion ?? "N/A"}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    Automated Test Result:
                  </Typography>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: umtAutomatedTestResultColor(row.automatedTestResult),
                    }}
                  />
                  <Typography variant="body2">{umtAutomatedTestResultLabel(row.automatedTestResult)}</Typography>
                </Stack>
                <RadioGroup row value={currentResult} onChange={(event) => updateDraft(row, { result: event.target.value })}>
                  {UMT_TESTING_RESULT_OPTIONS.map((option) => (
                    <FormControlLabel
                      key={option.value}
                      value={option.value}
                      control={<Radio size="small" />}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>
                {umtTestingResultRequiresComment(currentResult) && (
                  <TextField
                    label="Comment"
                    value={currentComment}
                    onChange={(event) => updateDraft(row, { comment: event.target.value })}
                    fullWidth
                    multiline
                    rows={1}
                  />
                )}
              </Stack>
            </Paper>
          );
        })}
      </Stack>

      <Divider />

      <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
        <Button variant="contained" disabled={isSaveDisabled} loading={saveMutation.isPending} onClick={() => void handleSave()}>
          Save
        </Button>
      </Stack>
    </Stack>
  );
}
