/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import type { ApproverView } from "../expenseTypes";
import type { ApprovalDecision } from "./useExpenseApprovals";

/** utils/constants.ts:5 — the same cap the claim form puts on a comment. */
const REASON_MAX = 100;

/**
 * ConfirmationDialog.tsx as the approvals screen uses it. A decision sends the
 * claim on to somebody else — or back to the person who filed it — so it is
 * confirmed rather than taken on one click.
 *
 * **A reason is asked for at the lead stage only** (`ClaimDetails.tsx:408`).
 * The backend records `leadRejectedReason` and carries no finance equivalent,
 * so a reason typed at the finance stage could be neither stored nor ever
 * shown back to the employee — asking for one would be a promise the data
 * cannot keep.
 */
export function ExpenseApprovalDecisionDialog({
  stage,
  decision,
  open,
  pending,
  onCancel,
  onConfirm,
}: {
  stage: ApproverView;
  decision: ApprovalDecision;
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | undefined) => void;
}) {
  const [reason, setReason] = useState("");

  const approving = decision === "approve";
  const wantsReason = stage === "LEAD" && decision === "reject";
  // `getConfirmationContent("confirmation")` — the copy names the hat the
  // approver is wearing, which is the whole point of a two-stage review.
  const body =
    stage === "FINANCE"
      ? "You're performing this action as a Finance lead. Are you sure you want to proceed?"
      : approving
        ? "You're performing this action as a Lead. Are you sure you want to proceed?"
        : "You're performing this action as a Lead";

  const close = () => {
    setReason("");
    onCancel();
  };

  return (
    // Unlike the source's, this dialog closes on Esc and on a backdrop click.
    // The source passes no `onClose` at all, so a decision dialog opened by
    // accident can only be left through Cancel.
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>
        {approving ? "Approve Confirmation" : "Reject Confirmation"}
      </DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13.5 }}>{body}</Typography>
        {wantsReason && (
          <TextField
            multiline
            minRows={3}
            fullWidth
            autoComplete="off"
            disabled={pending}
            placeholder="Provide a Reason for Rejecting the Expense Claim"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
            helperText={`${reason.length}/${REASON_MAX}`}
            // Controlled, where the source's is not: theirs keeps the previous
            // attempt's text after a cancel because only the store is cleared.
            slotProps={{ formHelperText: { sx: { textAlign: "right", fontSize: 10 } } }}
            sx={{ mt: 2 }}
            inputProps={{ "aria-label": "Rejection reason" }}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={close} disabled={pending}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          color={approving ? "success" : "error"}
          // A lead's rejection is the only place the employee is ever told why,
          // so it cannot be sent empty.
          disabled={pending || (wantsReason && reason.trim().length === 0)}
          onClick={() => {
            onConfirm(wantsReason ? reason : undefined);
            setReason("");
          }}
        >
          {pending ? (approving ? "Approving…" : "Rejecting…") : approving ? "Approve" : "Reject"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
