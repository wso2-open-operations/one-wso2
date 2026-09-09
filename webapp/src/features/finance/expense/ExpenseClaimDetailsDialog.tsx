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
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { useAccessToken } from "@hooks/useAccessToken";
import { expenseServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip, expenseStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { describeError } from "../util/financeError";
import { money, formatNice } from "../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../util/financeReceipts";
import {
  useExpenseClaimStatus,
  useExpenseReceiptUpload,
  useResubmitExpenseClaim,
} from "./useExpenseMutations";
import { AddExpenseDialog, type DraftLine } from "./ExpenseLineDialog";
import { nextStatus, type ApproverView, type ExpenseAppData, type ExpenseClaim } from "./expenseTypes";

// Expense claim detail slide-over — read-only for History, or with
// stage-appropriate Approve/Reject for Lead / Finance approvals.
export function ExpenseClaimDetailsDialog({
  claim,
  onClose,
  review,
  appData,
}: {
  claim: ExpenseClaim | null;
  onClose: () => void;
  review?: ApproverView;
  /**
   * App data, needed only to correct a line while resubmitting. Absent in the
   * approver views, which never resubmit.
   */
  appData?: ExpenseAppData;
}) {
  const getAccessToken = useAccessToken();
  const { showError, showSuccess } = useNotifications();
  const status = useExpenseClaimStatus();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  // ClaimDetails.tsx:120-128 — a rejected claim is reopened for correction and
  // resubmitted under its own id, so the working copy starts as its lines.
  const resubmit = useResubmitExpenseClaim();
  const receiptUpload = useExpenseReceiptUpload();
  const [lines, setLines] = useState<DraftLine[] | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmingResubmit, setConfirmingResubmit] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Reset transient state when the target claim changes — the dialog stays
  // mounted, so a typed reason / open reject panel would otherwise carry
  // over into the next claim.
  const claimId = claim?.id;
  useEffect(() => {
    setRejecting(false);
    setReason("");
    setReceiptLoad(null);
    setLines(null);
    setEditingIndex(null);
    setConfirmingResubmit(false);
    setConfirmingDiscard(false);
  }, [claimId]);

  // ClaimDetails.tsx:120-124 — the employee's own view of a claim rejected at
  // either stage. Not offered to an approver looking at the same claim.
  const canResubmit =
    !review &&
    Boolean(appData) &&
    (claim?.statusDetails.status === "LEAD_REJECTED" ||
      claim?.statusDetails.status === "FINANCE_REJECTED");
  const shownLines: DraftLine[] =
    lines ??
    (claim?.transactions ?? []).map((t) => ({
      date: t.date,
      amount: t.amount,
      currency: t.currency,
      expenseTypeId: t.expenseTypeId,
      comment: t.comment ?? null,
      receiptUrl: t.receiptUrl ?? null,
      travelJobNumber: t.travelJobNumber ?? null,
      reimbursementAmount: t.reimbursementAmount,
      reimbursementCurrency: t.reimbursementCurrency,
      expenseType: t.expenseType,
    }));
  const edited = lines !== null;

  const meta = expenseStatusMeta(claim?.statusDetails.status);
  const pendingForView =
    review === "LEAD"
      ? claim?.statusDetails.status === "PENDING_LEAD"
      : review === "FINANCE"
        ? claim?.statusDetails.status === "PENDING_FINANCE"
        : false;

  const openReceipt = (fileName: string) => {
    setReceiptLoad(() => async () => {
      const accessToken = await getAccessToken();
      return fetchReceiptObjectUrl(expenseServiceUrls.receiptFile(fileName), accessToken);
    });
  };

  const decide = (decision: "approve" | "reject") => {
    if (!claim || !review) return;
    status.mutate(
      {
        claimId: claim.id,
        body: {
          status: nextStatus(review, decision),
          reason: decision === "reject" ? reason.trim() : undefined,
        },
      },
      {
        onSuccess: () => {
          showSuccess(decision === "approve" ? "Claim approved" : "Claim rejected");
          setRejecting(false);
          setReason("");
          onClose();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

  const cur = claim?.currencyCode ?? "LKR";

  return (
    <>
    <Dialog open={!!claim} onClose={status.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
        <span>Claim {claim?.id}</span>
        <StatusChip label={meta.label} color={meta.color} />
      </DialogTitle>
      <DialogContent dividers>
        {claim && (
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              <Meta label="Employee" value={claim.employeeEmail} />
              <Meta label="Submitted" value={formatNice(claim.createdDate)} />
              <Meta label="Total" value={money(claim.totalAmount, cur)} />
            </Box>
            {claim.statusDetails.leadRejectedReason && (
              <Typography sx={{ fontSize: 12.5, color: "error.main" }}>
                Lead rejection: {claim.statusDetails.leadRejectedReason}
              </Typography>
            )}
            <Divider />
            <Stack spacing={1}>
              {shownLines.map((t, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                      {t.expenseType || t.comment || "Expense"}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }} noWrap>
                      {formatNice(t.date)}
                      {t.travelJobNumber ? ` · ${t.travelJobNumber}` : ""}
                      {t.comment ? ` · ${t.comment}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {money(t.reimbursementAmount, t.reimbursementCurrency)}
                    </Typography>
                    {t.currency !== t.reimbursementCurrency && (
                      <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
                        {money(t.amount, t.currency)}
                      </Typography>
                    )}
                  </Box>
                  {t.receiptUrl && (
                    <Button size="small" variant="text" onClick={() => openReceipt(t.receiptUrl!)} sx={{ textTransform: "none" }}>
                      Receipt
                    </Button>
                  )}
                  {canResubmit && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => {
                        setLines(shownLines);
                        setEditingIndex(i);
                      }}
                      sx={{ textTransform: "none" }}
                    >
                      Edit
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>

            {pendingForView && rejecting && (
              <TextField
                size="small"
                fullWidth
                multiline
                minRows={2}
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for rejection…"
                sx={{ mt: 1 }}
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {pendingForView ? (
          rejecting ? (
            <>
              <Button size="small" onClick={() => setRejecting(false)} disabled={status.isPending}>
                Back
              </Button>
              <Button
                size="small"
                color="error"
                variant="contained"
                disabled={status.isPending || reason.trim().length === 0}
                onClick={() => decide("reject")}
              >
                {status.isPending ? "Rejecting…" : "Confirm reject"}
              </Button>
            </>
          ) : (
            <>
              <Button size="small" onClick={onClose} disabled={status.isPending}>
                Close
              </Button>
              <Button size="small" color="error" onClick={() => setRejecting(true)} disabled={status.isPending}>
                Reject
              </Button>
              <Button size="small" color="success" variant="contained" onClick={() => decide("approve")} disabled={status.isPending}>
                {status.isPending ? "Approving…" : "Approve"}
              </Button>
            </>
          )
        ) : (
          <>
            <Button
              size="small"
              onClick={() => {
                // ClaimDetails.tsx:174 — unsaved corrections are confirmed away
                // rather than dropped on a stray click.
                if (edited) {
                  setConfirmingDiscard(true);
                  return;
                }
                onClose();
              }}
            >
              Close
            </Button>
            {canResubmit && (
              <Button
                size="small"
                variant="contained"
                onClick={() => setConfirmingResubmit(true)}
                disabled={resubmit.isPending}
              >
                {resubmit.isPending ? "Resubmitting…" : "Resubmit"}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>

    {/* One corrected line. The same form the New Claim screen uses, as the
        source reuses ExpenseForm between NewClaim and ClaimDetails. */}
    {editingIndex !== null && appData && (
      <AddExpenseDialog
        appData={appData}
        editing={shownLines[editingIndex]}
        restrictionFrom={claim?.createdDate}
        uploading={receiptUpload.isPending}
        // A correction often exists *because* the receipt was the problem, so
        // the replace control has to work here — it is the same form, and it
        // offers one either way. Uploads go against the claim's owner, which
        // for a resubmission is the signed-in user.
        onUpload={(file) =>
          receiptUpload.mutateAsync({ email: claim?.employeeEmail ?? "", file })
        }
        onClose={() => setEditingIndex(null)}
        onAdd={(line) => {
          setLines(shownLines.map((it, j) => (j === editingIndex ? line : it)));
          setEditingIndex(null);
        }}
      />
    )}

    {/* ClaimDetails.tsx:379-390. The wording changes when nothing was altered,
        because resubmitting an unchanged claim is usually a mistake. */}
    <Dialog open={confirmingResubmit} onClose={() => setConfirmingResubmit(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Claim Resubmission Confirmation</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13.5 }}>
          {edited
            ? "Are you sure you want to resubmit the claim?"
            : "You haven't changed any claim items. Are you sure you want to resubmit?"}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={() => setConfirmingResubmit(false)}>
          Cancel
        </Button>
        <Button
          size="small"
          color="success"
          variant="contained"
          disabled={resubmit.isPending}
          onClick={() => {
            if (!claim) return;
            resubmit.mutate(
              {
                id: claim.id,
                transactions: shownLines.map((l) => ({
                  date: l.date,
                  amount: l.amount,
                  currency: l.currency,
                  expenseTypeId: l.expenseTypeId,
                  comment: l.comment,
                  receiptUrl: l.receiptUrl,
                  travelJobNumber: l.travelJobNumber ?? null,
                })),
              },
              {
                onSuccess: () => {
                  showSuccess("Claim resubmitted successfully");
                  setConfirmingResubmit(false);
                  onClose();
                },
                onError: (err) => showError(describeError(err)),
              },
            );
          }}
        >
          Resubmit
        </Button>
      </DialogActions>
    </Dialog>

    {/* :399-400 */}
    <Dialog open={confirmingDiscard} onClose={() => setConfirmingDiscard(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Edit Discard Confirmation</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 13.5 }}>Your edit changes will be discarded</Typography>
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={() => setConfirmingDiscard(false)}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            setConfirmingDiscard(false);
            setLines(null);
            onClose();
          }}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
    <ReceiptViewer load={receiptLoad} onClose={() => setReceiptLoad(null)} />
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 10, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
