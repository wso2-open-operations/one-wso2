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
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@wso2/oxygen-ui";
import { dialogPaperSx } from "@components/confirmation-dialog/dialogPaperSx";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAdjustPoints } from "../api/useAmplifyMutations";
import { describeAmplifyError, SELF_CORRECTION_MESSAGE } from "../util/amplifyError";
import { num } from "../util/dashboardFormat";
import { MAX_ADJUSTMENT_POINTS, REASON_MAX_LENGTH, parseAdjustmentPoints, signedPoints } from "../util/points";
import { CorrectionEffect, REASON_SHOWN_NOTE } from "./CorrectionParts";

const POINTS_HINT =
  `A whole number from −${num(MAX_ADJUSTMENT_POINTS)} to ${num(MAX_ADJUSTMENT_POINTS)}, not zero. ` +
  "Use a minus sign to remove points.";

/**
 * Adds or removes points for one person (POST /po/points/adjustments): signed points within ±10,000 and a reason,
 * with the effect on their total shown before it is saved.
 */
export default function AdjustPointsDialog({
  employeeId,
  personName,
  total,
  onClose,
}: {
  employeeId: string;
  personName: string;
  /** The person's all-time total now, or null when it isn't known. */
  total: number | null;
  onClose: () => void;
}) {
  const adjust = useAdjustPoints();
  const { showError, showSuccess } = useNotifications();
  const [pointsText, setPointsText] = useState("");
  const [reason, setReason] = useState("");
  const busy = adjust.isPending;
  const points = parseAdjustmentPoints(pointsText);
  const pointsInvalid = pointsText.trim() !== "" && points === null;
  const text = reason.trim();
  const canSave = points !== null && text !== "" && !busy;

  const save = () => {
    if (points === null || !text || busy) return;
    adjust.mutate(
      { employeeId, points, reason: text },
      {
        onSuccess: () => {
          showSuccess(`Saved: ${signedPoints(points)} points for ${personName}.`);
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
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Add or remove points for {personName}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Points"
            type="number"
            value={pointsText}
            onChange={(e) => setPointsText(e.target.value)}
            required
            fullWidth
            disabled={busy}
            error={pointsInvalid}
            helperText={POINTS_HINT}
            slotProps={{ htmlInput: { step: 1, min: -MAX_ADJUSTMENT_POINTS, max: MAX_ADJUSTMENT_POINTS } }}
          />
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
          <CorrectionEffect total={total} change={points} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
