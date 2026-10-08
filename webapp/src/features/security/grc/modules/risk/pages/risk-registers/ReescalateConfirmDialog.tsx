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

import { useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from "@wso2/oxygen-ui";
import type { JSX } from "react";
import { dialogPaperSx } from "../cardStyles";

interface ReescalateConfirmDialogProps {
  open: boolean;
  riskCode: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

// ReescalateConfirmDialog is what the Escalate button opens instead of
// escalating when the risk already has an OPEN escalation — the backend
// rejects a second escalate outright (one risk, one open escalation at a
// time), so clicking Escalate again used to silently do nothing visible.
// Confirming here does not create a new escalation or change the risk's
// workflow status; it resends the same escalation email the original
// escalation sent, to the same recipients (severity-gated Management
// Approver included), as a nudge.
//
// Self-contained error/saving state, same pattern as
// EscalationCommentDialog: a failure renders inline and keeps the dialog
// open rather than relying on the page-level alert, which sits behind this
// dialog (and behind the risk drawer under it) and would otherwise go
// unnoticed.
export default function ReescalateConfirmDialog({
  open,
  riskCode,
  onClose,
  onConfirm,
}: ReescalateConfirmDialogProps): JSX.Element {
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  const handleConfirm = async () => {
    setSending(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to resend the escalation notification.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="xs" fullWidth PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle>
        <Typography component="span" variant="h6" fontWeight={700} sx={{ display: "block" }}>
          Already Escalated
        </Typography>
        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {riskCode}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <DialogContentText>
          This risk has already been escalated and is awaiting a response. Would you like to resend the
          escalation notification to the same people?
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          Go Back
        </Button>
        <Button variant="contained" onClick={handleConfirm} disabled={sending}>
          {sending ? "Sending…" : "Resend Notification"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
