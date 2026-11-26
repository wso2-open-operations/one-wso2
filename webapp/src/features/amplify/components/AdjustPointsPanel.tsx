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
import { Box, TextField, Typography } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useAdjustPoints } from "../api/useAmplifyMutations";
import { describeAmplifyError, SELF_CORRECTION_MESSAGE } from "../util/amplifyError";
import { num } from "../util/dashboardFormat";
import { MAX_ADJUSTMENT_POINTS, correctionReasonText, parseAdjustmentPoints, signedPoints } from "../util/points";
import { CorrectionEffect, CorrectionPanel, ReasonFields } from "./CorrectionParts";

const POINTS_HINT =
  `A whole number from −${num(MAX_ADJUSTMENT_POINTS)} to ${num(MAX_ADJUSTMENT_POINTS)}, not zero. ` +
  "Use a minus sign to remove points.";

/**
 * "Add or remove points" (POST /po/points/adjustments), beside the person's activity: signed points within ±10,000,
 * a reason from the list and an optional note for the person, with the effect on their total before it is saved.
 */
export default function AdjustPointsPanel({
  employeeId,
  personName,
  firstName,
  total,
  onClose,
}: {
  employeeId: string;
  personName: string;
  /** For "Note for Nimal"; null when unknown. */
  firstName: string | null;
  /** The person's all-time total now, or null when it isn't known. */
  total: number | null;
  onClose: () => void;
}) {
  const adjust = useAdjustPoints();
  const { showError, showSuccess } = useNotifications();
  const [pointsText, setPointsText] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const busy = adjust.isPending;
  const points = parseAdjustmentPoints(pointsText);
  const pointsInvalid = pointsText.trim() !== "" && points === null;

  const save = () => {
    if (points === null || !reason || busy) return;
    adjust.mutate(
      { employeeId, points, reason: correctionReasonText(reason, note) },
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
    <CorrectionPanel
      title="Add or remove points"
      effect={<CorrectionEffect total={total} change={points} />}
      confirmLabel={busy ? "Saving…" : "Save"}
      onConfirm={save}
      confirmDisabled={points === null || !reason}
      onCancel={onClose}
      busy={busy}
    >
      <Box>
        <Typography component="label" htmlFor={`adjust-${employeeId}-points`} variant="body2" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
          Points
        </Typography>
        <TextField
          id={`adjust-${employeeId}-points`}
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
      </Box>
      <ReasonFields
        idPrefix={`adjust-${employeeId}`}
        reason={reason}
        onReason={setReason}
        note={note}
        onNote={setNote}
        firstName={firstName}
        disabled={busy}
      />
    </CorrectionPanel>
  );
}
