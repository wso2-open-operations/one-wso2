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
import type { LedgerEntry, RemovalReason } from "../api/amplifyTypes";
import { useRemoveActivity } from "../api/useAmplifyMutations";
import { activityText } from "../util/activity";
import { REMOVAL_MESSAGES, describeAmplifyError } from "../util/amplifyError";
import { shortDate } from "../util/dashboardFormat";
import { signedPoints } from "../util/points";
import { REMOVAL_NOTE_MAX_LENGTH, REMOVAL_REASONS, REMOVED_AFTER_REVIEW, removalReady } from "../util/removal";
import { CorrectionEffect, CorrectionPanel } from "./CorrectionParts";

/** Under the reason: what the removal does, and what the person reads. */
export const REMOVAL_HELP =
  `The points come off and the activity leaves the dashboards and is never scored again. ` +
  `They see "${REMOVED_AFTER_REVIEW}", not the reason or the note.`;

/**
 * "Remove invalid activity" (POST /po/points/{reference}/remove), beside the person's activity, for a LinkedIn
 * engagement that shouldn't count: the row, a reason code, a note for the PO team (required for Other), and what
 * their total becomes before it is confirmed.
 */
export default function RemoveActivityPanel({
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
  const remove = useRemoveActivity();
  const { showError, showSuccess } = useNotifications();
  const [code, setCode] = useState<RemovalReason | "">("");
  const [note, setNote] = useState("");
  const busy = remove.isPending;
  const change = -entry.points;
  const what = activityText(entry, { forPerson: true });
  const post = entry.campaignTitle?.trim();
  const ready = removalReady(code, note);
  const id = `remove-${entry.reference}`;

  const confirm = () => {
    if (!removalReady(code, note) || busy) return;
    const text = note.trim();
    remove.mutate(
      { reference: entry.reference, employeeId: entry.employeeId, reasonCode: code, ...(text ? { note: text } : {}) },
      {
        onSuccess: () => {
          showSuccess(`Removed: ${signedPoints(change)} points for ${personName}.`);
          onClose();
        },
        onError: (err) => showError(describeAmplifyError(err, REMOVAL_MESSAGES)),
      },
    );
  };

  return (
    <CorrectionPanel
      title="Remove invalid activity"
      effect={<CorrectionEffect total={total} change={change} />}
      confirmLabel={busy ? "Removing…" : `Remove · ${signedPoints(change)}`}
      onConfirm={confirm}
      confirmDisabled={!ready}
      onCancel={onClose}
      busy={busy}
    >
      <Box sx={{ bgcolor: "action.hover", borderRadius: 1, px: 2, py: 1.5 }}>
        <Typography sx={{ fontWeight: 700 }}>
          {what} · {signedPoints(entry.points)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {post ? `${post} · ` : ""}
          {shortDate(entry.createdAt)}
        </Typography>
      </Box>
      <Box>
        <Typography component="label" htmlFor={`${id}-reason`} variant="body2" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
          Reason
        </Typography>
        <TextField
          id={`${id}-reason`}
          select
          fullWidth
          value={code}
          onChange={(e) => setCode(e.target.value as RemovalReason | "")}
          disabled={busy}
          required
          slotProps={{ select: { native: true } }}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {REMOVAL_REASONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </TextField>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {REMOVAL_HELP}
        </Typography>
      </Box>
      <Box>
        <Typography component="label" htmlFor={`${id}-note`} variant="body2" sx={{ display: "block", mb: 0.75 }}>
          <Box component="span" sx={{ fontWeight: 700 }}>
            Note
          </Box>{" "}
          <Box component="span" sx={{ color: "text.secondary" }}>
            {code === "OTHER" ? "(required for Other; PO team only)" : "(optional; PO team only)"}
          </Box>
        </Typography>
        <TextField
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
          disabled={busy}
          error={code === "OTHER" && note.trim() === ""}
          slotProps={{ htmlInput: { maxLength: REMOVAL_NOTE_MAX_LENGTH } }}
        />
      </Box>
    </CorrectionPanel>
  );
}
