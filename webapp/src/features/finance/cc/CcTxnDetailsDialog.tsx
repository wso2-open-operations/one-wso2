/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
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
  Box,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { CirclePlusIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import { useAccessToken } from "@hooks/useAccessToken";
import { ccServiceUrls } from "@config/apiConfig";
import { StatusChip, ccStatusMeta } from "../components/FinanceChips";
import { ReceiptViewer } from "../components/ReceiptViewer";
import { fetchBase64Attachment, type ReceiptSource } from "../util/financeReceipts";
import { money, formatNice } from "../util/financeFormat";
import type { CcAttachmentType, CcTransaction } from "./ccTypes";

// What a submitted transaction became — ported from
// view/submission-history/components/TransactionDetailsDialog.tsx.
//
// The port already carried leadApprovedDate, financeApprovedDate,
// financeApproverEmail and reportSequenceNumber on its DTO and rendered none of
// them, so there was no way to see who approved a transaction or when.
export function CcTxnDetailsDialog({
  txn,
  onClose,
}: {
  txn: CcTransaction | null;
  onClose: () => void;
}) {
  const getAccessToken = useAccessToken();
  const [load, setLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);

  if (!txn) return null;
  const meta = ccStatusMeta(txn.status);

  const view = (attachmentType: CcAttachmentType) =>
    setLoad(() => async () =>
      // fetchBase64Attachment, not fetchReceiptObjectUrl: this endpoint returns
      // the file as base64 TEXT (`{body: fileContent.toBase64()}`,
      // service.bal:592), so reading it as a binary blob produced a "file"
      // whose contents were the base64 string itself and the preview showed
      // nothing. The blob reader is for expense and OPD, which stream bytes.
      // The grid's Files column already used this one — the two surfaces read
      // the same endpoint two different ways.
      fetchBase64Attachment(ccServiceUrls.attachment(txn.id, attachmentType), await getAccessToken()),
    );

  const isTravel = txn.expenseCategoryLabel === "Travel";
  const isMarketing = (txn.expenseCategoryLabel ?? "").startsWith("Marketing");

  return (
    <>
      {/* TransactionDetailsDialog.tsx — `maxWidth="md"`, because the fields are
          laid out two across and a small dialog wraps every one of them. */}
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        {/* :108-153 — a banded header carrying the id, the description, and the
            date and amount on one line beneath. The port put the description in
            a plain title and dropped the id entirely, so nothing on screen said
            which transaction this was. */}
        <Box sx={{ bgcolor: "action.hover", m: 2, mb: 0, p: 2, borderRadius: 1.5 }}>
          <Stack direction="row" alignItems="flex-start" spacing={1.5}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 700 }}>
                ID: {txn.id} - {txn.txnDescription}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
                Date : {formatNice(txn.txnDate)} | Amount : {money(txn.txnAmount, "USD")}
              </Typography>
            </Box>
            <IconButton size="small" aria-label="close" onClick={onClose}>
              <XIcon size={16} />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent>
          <Stack spacing={1.5}>
            {/* :155-189 — two across, with Comment spanning both. Job Number is
                a travel field and Sub Region a marketing one; the source shows
                each only where it means something, rather than a column of
                "(not Provided)" on every other transaction. */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <Detail label="Expense Category" value={txn.expenseCategoryLabel} />
              <Detail label="Expense Type" value={txn.expenseTypeLabel} />
              <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
                <Detail label="Comment" value={txn.txnComment} />
              </Box>
              <Detail label="Product Unit" value={txn.productUnit} />
              <Detail label="Business Unit" value={txn.businessUnit} />
              {isTravel && <Detail label="Job Number" value={txn.travelJobNumber} />}
              {isMarketing && <Detail label="Sub Region" value={txn.subRegion} />}
              {/* :169-188 — the attachments sit in the same grid, as fields
                  rather than as an afterthought under a divider. */}
              <Attachment label="Receipt" fileName={txn.receiptFileName} onView={() => view("receipt")} />
              <Attachment label="Contract" fileName={txn.contractFileName} onView={() => view("contract")} />
            </Box>

            {/* :192-194 — the chip sits IN the divider, so the trail below it
                reads as the story of how the row reached that status. */}
            <Divider sx={{ pt: 1 }}>
              <StatusChip label={meta.label} color={meta.color} />
            </Divider>

            {/* :196-345 — six cells, three across, centred. */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2, pb: 1 }}>
              <Trail label="Submitted User" value={txn.employeeEmail || NOT_PROVIDED} />
              {/* :232 — leadEmail is a comma-separated list of the card's
                  assigned leads, so only the first is shown; the whole list
                  would read as though several people had approved it. */}
              <Trail label="Lead approver" value={txn.leadEmail?.split(",")[0]?.trim() || NOT_PROVIDED} />
              <Trail label="Finance approver" value={txn.financeApproverEmail || NOT_PROVIDED} />
              <Trail
                label="Submitted Date"
                value={txn.empPostedDate ? formatNice(txn.empPostedDate) : "(not submitted)"}
              />
              <Trail
                label="Lead Approved Date"
                value={txn.leadApprovedDate ? formatNice(txn.leadApprovedDate) : NOT_APPROVED}
              />
              <Trail
                label="Finance Approved Date"
                value={txn.financeApprovedDate ? formatNice(txn.financeApprovedDate) : NOT_APPROVED}
              />
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
      <ReceiptViewer title="Attachment" load={load} onClose={() => setLoad(null)} />
    </>
  );
}

const NOT_PROVIDED = "(not provided)";
const NOT_APPROVED = "(not approved)";

/**
 * One field, in the dashed box the source draws it in (`StyledList`,
 * TransactionDetailsDialog.tsx:44-61).
 *
 * The fallback is `(not Provided)` — capital P, which is the source's, and
 * different again from the `(not provided)` its approval trail uses. Two
 * spellings of the same phrase in one dialog is odd, but they are what is on
 * screen in the app this is replacing, and a reader comparing the two would
 * notice a tidy-up sooner than they would notice the inconsistency.
 */
function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Box sx={{ border: "1.5px dashed", borderColor: "divider", borderRadius: 1.5, px: 1.75, py: 1.25, minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: value ? 600 : 400, color: value ? "text.primary" : "text.disabled" }} noWrap title={value ?? undefined}>
        {value || "(not Provided)"}
      </Typography>
    </Box>
  );
}

/**
 * An attachment, as a field of its own rather than a button under a divider —
 * :169-188 puts both in the same grid as everything else. Solid-bordered where
 * the read-only fields are dashed, because this one can be pressed.
 */
function Attachment({ label, fileName, onView }: { label: string; fileName: string | null; onView: () => void }) {
  const has = Boolean(fileName);
  return (
    <Box
      component={has ? "button" : "div"}
      type={has ? "button" : undefined}
      onClick={has ? onView : undefined}
      aria-label={has ? `View ${label}` : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        width: "100%",
        textAlign: "left",
        font: "inherit",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        px: 1.75,
        py: 1.25,
        bgcolor: "transparent",
        cursor: has ? "pointer" : "default",
        color: has ? "text.primary" : "text.disabled",
      }}
    >
      <Typography sx={{ fontSize: 13.5 }}>{label}</Typography>
      <CirclePlusIcon size={18} style={{ opacity: has ? 0.8 : 0.35, flexShrink: 0 }} />
    </Box>
  );
}

/** One cell of the approval trail — centred, label above value (`:196-345`). */
function Trail({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ textAlign: "center", minWidth: 0 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }} noWrap title={value}>
        {value}
      </Typography>
    </Box>
  );
}
