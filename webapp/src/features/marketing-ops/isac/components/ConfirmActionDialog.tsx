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

import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@wso2/oxygen-ui";
import { ReactNode } from "react";
import { FS, FW } from "../theme/typeScale";

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain words — the facts the operator needs before committing. */
  children: ReactNode;
  confirmLabel: string;
  /** "warning" for long or expensive actions, "error" for irreversible ones. */
  severity?: "warning" | "error";
  /** True while the confirmed action is being started — disables both buttons. */
  confirming?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/** A confirmation step for operator actions that are long-running or irreversible.
 *
 * The Data Ingestion controls use it so a multi-hour full re-sync or a permanent
 * company-domain claim is never one accidental click away. The body is free-form
 * so each action can state its own facts (duration, what resumes it, what is
 * skipped) instead of a generic "are you sure?". */
export default function ConfirmActionDialog({
  open, title, children, confirmLabel, severity = "warning",
  confirming = false, error, onConfirm, onClose,
}: ConfirmActionDialogProps) {
  const font = "'Inter', system-ui, sans-serif";
  return (
    <Dialog open={open} onClose={confirming ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: font, fontWeight: FW.bold, fontSize: FS.title }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div" sx={{ fontFamily: font, fontSize: FS.body, color: "text.primary" }}>
          {children}
        </DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 1.5, py: 0, fontSize: FS.body }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={confirming} sx={{ textTransform: "none", fontFamily: font }}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={severity}
          disableElevation
          disabled={confirming}
          startIcon={confirming ? <CircularProgress size={12} color="inherit" /> : undefined}
          sx={{ textTransform: "none", fontFamily: font, fontWeight: FW.semibold }}
        >
          {confirming ? "Starting…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
