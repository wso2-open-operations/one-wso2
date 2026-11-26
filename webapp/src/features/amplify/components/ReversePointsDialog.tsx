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
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { LedgerEntry } from "../api/amplifyTypes";
import { useReversePoints } from "../api/useAmplifyMutations";
import { describeAmplifyError, SELF_CORRECTION_MESSAGE } from "../util/amplifyError";
import { shortDate } from "../util/dashboardFormat";
import { REASON_MAX_LENGTH, ledgerActionLabel, signedPoints } from "../util/points";
import { CorrectionEffect, REASON_SHOWN_NOTE } from "./CorrectionParts";

/**
 * Reverses one ledger row (POST /po/points/{reference}/reverse): a reason is required, and the dialog shows what
 * the person's total becomes before it is confirmed.
 */
export default function ReversePointsDialog({
  entry,
  personName,
  total,
  onClose,
}: {
  entry: LedgerEntry;
  personName: string;
  /** The person's all-time total now, or null when it isn't known. */
  total: number | null;
  onClose: () => void;
}) {
  const reverse = useReversePoints();
  const { showError, showSuccess } = useNotifications();
  const [reason, setReason] = useState("");
  const busy = reverse.isPending;
  const text = reason.trim();
  const change = -entry.points;

  const confirm = () => {
    if (!text || busy) return;
    reverse.mutate(
      { reference: entry.reference, employeeId: entry.employeeId, reason: text },
      {
        onSuccess: () => {
          showSuccess(`Reversed: ${signedPoints(change)} points for ${personName}.`);
          onClose();
        },
        onError: (err) => showError(describeAmplifyError(err, { SELF_REVIEW: SELF_CORRECTION_MESSAGE })),
      },
    );
  };

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: dialogPaperSx } }}
    >
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Reverse this activity</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2">
            {ledgerActionLabel(entry)} on {shortDate(entry.createdAt)} ({signedPoints(entry.points)} points) for{" "}
            {personName}.
          </Typography>
          <TextField
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            disabled={busy}
            helperText={`${REASON_SHOWN_NOTE} ${reason.length} / ${REASON_MAX_LENGTH}`}
            slotProps={{ htmlInput: { maxLength: REASON_MAX_LENGTH } }}
          />
          <CorrectionEffect total={total} change={change} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={!text || busy}>
          {busy ? "Reversing…" : "Reverse"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
