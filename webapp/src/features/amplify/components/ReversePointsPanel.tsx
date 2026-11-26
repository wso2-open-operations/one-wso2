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
import { Box, Typography } from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import type { LedgerEntry } from "../api/amplifyTypes";
import { useReversePoints } from "../api/useAmplifyMutations";
import { activityText } from "../util/activity";
import { describeAmplifyError, SELF_CORRECTION_MESSAGE } from "../util/amplifyError";
import { shortDate } from "../util/dashboardFormat";
import { correctionReasonText, signedPoints } from "../util/points";
import { CorrectionEffect, CorrectionPanel, ReasonFields } from "./CorrectionParts";

/**
 * "Reverse this activity" (POST /po/points/{reference}/reverse), beside the person's activity: the row, a reason
 * from the list and an optional note for the person, and what their total becomes before it is confirmed.
 */
export default function ReversePointsPanel({
  entry,
  personName,
  firstName,
  total,
  onClose,
}: {
  entry: LedgerEntry;
  personName: string;
  /** For "Note for Nimal"; null when unknown. */
  firstName: string | null;
  /** The person's all-time total now, or null when it isn't known. */
  total: number | null;
  onClose: () => void;
}) {
  const reverse = useReversePoints();
  const { showError, showSuccess } = useNotifications();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const busy = reverse.isPending;
  const change = -entry.points;
  const what = activityText(entry, { forPerson: true });
  const post = entry.campaignTitle?.trim();

  const confirm = () => {
    if (!reason || busy) return;
    reverse.mutate(
      { reference: entry.reference, employeeId: entry.employeeId, reason: correctionReasonText(reason, note) },
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
    <CorrectionPanel
      title="Reverse this activity"
      effect={<CorrectionEffect total={total} change={change} />}
      confirmLabel={busy ? "Reversing…" : `Reverse · ${signedPoints(change)}`}
      onConfirm={confirm}
      confirmDisabled={!reason}
      onCancel={onClose}
      busy={busy}
    >
      <Box sx={{ bgcolor: "action.hover", borderRadius: 2, px: 2, py: 1.5 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {what} · {signedPoints(entry.points)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {post ? `${post} · ` : ""}
          {shortDate(entry.createdAt)}
        </Typography>
      </Box>
      <ReasonFields
        idPrefix={`reverse-${entry.reference}`}
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
