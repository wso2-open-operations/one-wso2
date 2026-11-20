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
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { RejectFailure } from "../api/useMeddpiccMutations";
import type { DealField, RejectProposalRequest, RejectReason } from "../types";
import { formatFieldValue } from "../util/meddpiccFormat";

const NOTE_LIMIT = 1000;

/** The contract's reasons, in the AM's words. */
const REASONS: readonly { value: RejectReason; label: string }[] = [
  { value: "WRONG_VALUE", label: "Wrong value" },
  { value: "WRONG_PERSON", label: "Wrong person" },
  { value: "NOT_SUPPORTED", label: "Quote doesn't show it" },
  { value: "OUTDATED", label: "Out of date" },
  { value: "OTHER", label: "Other" },
];

/**
 * Turn down one field's suggestion: why, and a note if the reason needs one. Nothing is
 * written to Salesforce; the suggestion goes from the deal until a later call changes it.
 * The deal page owns the request, so this only collects the answer and shows the outcome.
 */
export default function RejectProposalDialog({
  field,
  open,
  pending,
  failure,
  onClose,
  onConfirm,
  onRefresh,
}: {
  /** The field whose suggestion is being rejected; null while closed. */
  field: DealField | null;
  open: boolean;
  pending: boolean;
  failure: RejectFailure | null;
  onClose: () => void;
  onConfirm: (request: RejectProposalRequest) => void;
  /** Read the deal again, for a failure that says the page is out of date. */
  onRefresh: () => void;
}) {
  const [reason, setReason] = useState<RejectReason | "">("");
  const [note, setNote] = useState("");

  // Cleared once the dialog has gone, so the next field starts fresh.
  const reset = () => {
    setReason("");
    setNote("");
  };

  return (
    <Dialog
      open={open}
      // Not while the request is in flight: its answer still needs somewhere to land.
      onClose={pending ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ transition: { onExited: reset } }}
    >
      <DialogTitle>Reject this suggestion?</DialogTitle>
      <DialogContent>
        {field && (
          <Typography variant="body2" sx={{ mb: 1.5, overflowWrap: "anywhere" }}>
            <Box component="span" sx={{ fontWeight: 600 }}>
              {field.label}:
            </Box>{" "}
            {formatFieldValue(field.proposal?.value)}
          </Typography>
        )}
        <FormControl component="fieldset" disabled={pending} fullWidth>
          <FormLabel component="legend" sx={{ typography: "body2", fontWeight: 600, mb: 0.25 }}>
            What&apos;s wrong with it?
          </FormLabel>
          <RadioGroup value={reason} onChange={(event) => setReason(event.target.value as RejectReason)}>
            {REASONS.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio size="small" />}
                label={option.label}
                slotProps={{ typography: { variant: "body2" } }}
              />
            ))}
          </RadioGroup>
        </FormControl>
        <TextField
          size="small"
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          label="Note (optional)"
          value={note}
          disabled={pending}
          onChange={(event) => setNote(event.target.value)}
          slotProps={{ htmlInput: { maxLength: NOTE_LIMIT } }}
          helperText={`${note.length}/${NOTE_LIMIT}`}
          sx={{ mt: 1.5 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Nothing changes in Salesforce. Echo won&apos;t suggest this again unless a later call says something
          different.
        </Typography>
        {failure && (
          <Alert
            severity={failure.stale ? "warning" : "error"}
            sx={{ mt: 1.5 }}
            action={
              failure.stale ? (
                <Button size="small" color="inherit" onClick={onRefresh}>
                  Refresh
                </Button>
              ) : undefined
            }
          >
            {failure.message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={reason === "" || pending}
          onClick={() => {
            if (reason === "") return;
            const trimmed = note.trim();
            onConfirm({ reason, note: trimmed ? trimmed : null });
          }}
          startIcon={pending ? <CircularProgress size={14} color="inherit" /> : undefined}
        >
          Reject
        </Button>
      </DialogActions>
    </Dialog>
  );
}
