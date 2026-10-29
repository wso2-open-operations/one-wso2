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
import { opdServiceUrls } from "@config/apiConfig";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { StatusChip, opdStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { describeError } from "../util/financeError";
import { money, formatNice } from "../util/financeFormat";
import { fetchReceiptObjectUrl, type ReceiptSource } from "../util/financeReceipts";
import { useOpdClaimStatus } from "./useOpdMutations";
import type { OpdClaim } from "./opdTypes";

// Claim detail slide-over used by both History (read-only) and Approvals
// (with Approve/Reject). Lists the bills, lets a reviewer open each receipt,
// and — when `review` — carries the finance decision actions.
export function OpdClaimDetailsDialog({
  claim,
  onClose,
  review = false,
  onResubmit,
}: {
  claim: OpdClaim | null;
  onClose: () => void;
  review?: boolean;
  /**
   * Offered on the employee's own rejected claim — ClaimDetails.tsx:101-114,307.
   * Absent in the finance review view, which never resubmits.
   */
  onResubmit?: (claim: OpdClaim) => void;
}) {
  const getAccessToken = useAccessToken();
  const { showError, showSuccess } = useNotifications();
  const status = useOpdClaimStatus();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [receiptLoad, setReceiptLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  // The dialog stays mounted between claims, so reset its transient state
  // whenever the target claim changes — otherwise a typed rejection reason
  // (and the open reject panel / receipt viewer) would leak into the next
  // claim opened.
  const claimId = claim?.id;
  const [prevClaimId, setPrevClaimId] = useState(claimId);
  if (prevClaimId !== claimId) {
    setPrevClaimId(claimId);
    setRejecting(false);
    setReason("");
    setReceiptLoad(null);
  }

  const meta = opdStatusMeta(claim?.statusDetails.status);
  const isPending =
    claim?.statusDetails.status === "PENDING" || claim?.statusDetails.status === "PENDING_OLD";

  const openReceipt = (fileName: string) => {
    // Bind the loader to this file; the ReceiptViewer runs it on open.
    setReceiptLoad(() => async () => {
      const accessToken = await getAccessToken();
      return fetchReceiptObjectUrl(opdServiceUrls.receiptFile(fileName), accessToken);
    });
  };

  const decide = (decision: "APPROVED" | "REJECTED") => {
    if (!claim) return;
    status.mutate(
      { claimId: claim.id, body: { status: decision, reason: decision === "REJECTED" ? reason.trim() : undefined } },
      {
        onSuccess: () => {
          showSuccess(decision === "APPROVED" ? "Claim approved" : "Claim rejected");
          setRejecting(false);
          setReason("");
          onClose();
        },
        onError: (err) => showError(describeError(err)),
      },
    );
  };

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
              <Meta label="Total" value={money(claim.totalAmount)} />
            </Box>
            {claim.statusDetails.financeRejectedReason && (
              <Typography sx={{ fontSize: 12.5, color: "error.main" }}>
                Rejection reason: {claim.statusDetails.financeRejectedReason}
              </Typography>
            )}
            <Divider />
            <Stack spacing={1}>
              {claim.transactions.map((t, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>
                      {t.comment}
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>{formatNice(t.date)}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {money(t.amount)}
                  </Typography>
                  {t.receiptUrl && (
                    <Button size="small" variant="text" onClick={() => openReceipt(t.receiptUrl!)} sx={{ textTransform: "none" }}>
                      Receipt
                    </Button>
                  )}
                </Box>
              ))}
            </Stack>

            {review && isPending && rejecting && (
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
        {review && isPending ? (
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
                onClick={() => decide("REJECTED")}
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
              <Button size="small" color="success" variant="contained" onClick={() => decide("APPROVED")} disabled={status.isPending}>
                {status.isPending ? "Approving…" : "Approve"}
              </Button>
            </>
          )
        ) : (
          <>
            <Button size="small" onClick={onClose}>
              Close
            </Button>
            {/* :195-196 — only a rejected claim can be taken up again. */}
            {onResubmit && claim && claim.statusDetails.status === "REJECTED" && (
              <Button size="small" variant="contained" onClick={() => onResubmit(claim)}>
                Resubmit as New Claim
              </Button>
            )}
          </>
        )}
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
