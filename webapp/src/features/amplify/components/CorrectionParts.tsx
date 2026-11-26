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

import type { ReactNode } from "react";
import { Box, Button, Divider, TextField, Typography } from "@wso2/oxygen-ui";
import { CORRECTION_REASONS, correctionNoteMaxLength, effectPreview, signedPoints } from "../util/points";
import { AMPLIFY_RADIUS } from "../util/radius";

/** Under the effect: what happens to points that already became Coins. */
export const COINS_KEPT_NOTE =
  "Already converted to Coins? Coins are never taken back; the points come off the next conversion instead.";

/**
 * What a correction does to a person's all-time total, e.g. "All-time points 1,040 → 1,038". With no known total,
 * only the change.
 */
export function CorrectionEffect({ total, change }: { total: number | null; change: number | null }) {
  if (change === null) return null;
  return (
    <Box role="status" sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "baseline" }}>
      <Typography variant="body2" color="text.secondary">
        All-time points
      </Typography>
      <Typography sx={{ fontWeight: 700 }}>
        {total === null ? `${signedPoints(change)} points` : effectPreview(total, change)}
      </Typography>
    </Box>
  );
}

/** The Reason drop-down (required) and the optional note the person sees. */
export function ReasonFields({
  idPrefix,
  reason,
  onReason,
  note,
  onNote,
  firstName,
  disabled,
}: {
  idPrefix: string;
  reason: string;
  onReason: (r: string) => void;
  note: string;
  onNote: (n: string) => void;
  /** For "Note for Nimal"; null says "Note". */
  firstName: string | null;
  disabled: boolean;
}) {
  return (
    <>
      <Box>
        <Typography component="label" htmlFor={`${idPrefix}-reason`} variant="body2" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
          Reason
        </Typography>
        <TextField
          id={`${idPrefix}-reason`}
          select
          fullWidth
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          disabled={disabled}
          required
          slotProps={{ select: { native: true } }}
        >
          <option value="" disabled>
            Choose a reason
          </option>
          {CORRECTION_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </TextField>
      </Box>
      <Box>
        <Typography component="label" htmlFor={`${idPrefix}-note`} variant="body2" sx={{ display: "block", mb: 0.75 }}>
          <Box component="span" sx={{ fontWeight: 700 }}>
            {firstName ? `Note for ${firstName}` : "Note"}
          </Box>{" "}
          <Box component="span" sx={{ color: "text.secondary" }}>
            (shown in their history)
          </Box>
        </Typography>
        <TextField
          id={`${idPrefix}-note`}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          multiline
          minRows={3}
          maxRows={8}
          fullWidth
          disabled={disabled}
          slotProps={{ htmlInput: { maxLength: correctionNoteMaxLength(reason || CORRECTION_REASONS[0]) } }}
        />
      </Box>
    </>
  );
}

/**
 * The side panel a correction opens beside the person's activity: a title, the fields, the effect on their total, the
 * note on Coins, and Cancel with the confirm button.
 */
export function CorrectionPanel({
  title,
  children,
  effect,
  confirmLabel,
  onConfirm,
  confirmDisabled,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  effect: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled: boolean;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        border: "2px solid",
        borderColor: "primary.dark",
        borderRadius: AMPLIFY_RADIUS,
        p: 2.5,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        bgcolor: "background.paper",
      }}
    >
      <Typography component="h2" sx={{ fontWeight: 700, fontSize: 18 }}>
        {title}
      </Typography>
      {children}
      <Divider />
      {effect}
      <Typography variant="body2" color="text.secondary">
        {COINS_KEPT_NOTE}
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, flexWrap: "wrap" }}>
        <Button variant="outlined" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" onClick={onConfirm} disabled={confirmDisabled || busy}>
          {confirmLabel}
        </Button>
      </Box>
    </Box>
  );
}
