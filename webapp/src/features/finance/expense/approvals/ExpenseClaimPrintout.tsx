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

import { Box, GlobalStyles } from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import type { ReceiptSource } from "../../util/financeReceipts";
import { approvalDateTime } from "./expenseApprovalFormat";
import type { ApprovalClaim } from "./expenseApprovalTypes";

/**
 * The claim as finance prints it — `ReportTemplate.tsx`, rendered as a page
 * rather than built with `@react-pdf/renderer`.
 *
 * That library is what the source uses, and it is not a dependency here: it
 * appears in `node_modules` but in neither `package.json` nor the lockfile, so
 * importing it would work on one machine and fail every clean install. The
 * browser's own print dialog reaches the same destination — "Save as PDF" —
 * without taking a megabyte of renderer into the bundle, and it is the only
 * printing machinery this app has ever had.
 *
 * Contents follow the source's report exactly, including what it leaves out:
 * no employee, no status, no approval dates. Just the claim, its lines and its
 * receipts.
 */

/**
 * Hides the app and shows only this document while printing. There is no other
 * print stylesheet in the project, so this establishes the pattern: a single
 * `@media print` block scoped by id, injected with the component rather than
 * left in a global sheet that every page pays for.
 */
const PRINT_STYLES = (
  <GlobalStyles
    styles={{
      "#expense-claim-printout": { display: "none" },
      "@media print": {
        "body > *": { display: "none !important" },
        "#expense-claim-printout": {
          display: "block !important",
          position: "static",
          padding: "0",
          color: "#000",
        },
        "#expense-claim-printout .printout-item": { breakInside: "avoid" },
        "#expense-claim-printout .printout-receipt": { breakBefore: "page" },
      },
    }}
  />
);

export function ExpenseClaimPrintout({
  claim,
  receipts,
}: {
  claim: ApprovalClaim;
  /** One entry per line item, `null` where the receipt could not be fetched. */
  receipts: (ReceiptSource | null)[] | null;
}) {
  const currency = claim.currencyCode ?? "LKR";
  return (
    <>
      {PRINT_STYLES}
      {/* Mounted at the end of the body by the browser's normal flow; the
          stylesheet above is what makes it the only visible thing on paper. */}
      <Box id="expense-claim-printout" sx={{ fontSize: 12 }}>
        <Box sx={{ border: "1px solid #999", borderRadius: "6px", p: 1.5, mb: 2 }}>
          <PrintRow label="Netsuite Ref" value={claim.id} />
          <PrintRow
            label="Total Reimbursement Amount"
            value={money(claim.totalAmount, currency)}
          />
          <PrintRow label="Submitted Date" value={approvalDateTime(claim.createdDate)} />
        </Box>

        {claim.transactions.map((t, i) => (
          <Box key={i} className="printout-item" sx={{ mb: 2 }}>
            <Box
              sx={{
                textAlign: "center",
                p: 1,
                border: "1px solid #999",
                bgcolor: "#eee",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Claim Item {i + 1}
            </Box>
            <PrintCell label="Bill Date" value={t.date} />
            <PrintCell label="Job Number" value={t.travelJobNumber || "N/A"} />
            <PrintCell label="Expense Type" value={t.expenseType} />
            <PrintCell label="Bill Amount" value={money(t.amount, t.currency)} />
            <PrintCell
              label="Reimbursement Amount"
              value={`${money(t.reimbursementAmount, t.reimbursementCurrency)} (conversion rate: ${t.currencyConversionRate})`}
            />
            <PrintCell label="Comment" value={t.comment ?? ""} />
          </Box>
        ))}

        {/* One receipt per page, as the source's report lays them out. A line
            whose receipt failed to load simply has no page — the numbering
            gap is the source's behaviour too. */}
        {(receipts ?? []).map((src, i) =>
          src && src.type.startsWith("image/") ? (
            <Box key={i} className="printout-receipt" sx={{ pt: 2 }}>
              <Box sx={{ textAlign: "center", fontSize: 15, pb: 1 }}>Claim Item {i + 1} Receipt</Box>
              <Box
                component="img"
                src={src.url}
                alt={`Receipt for claim item ${i + 1}`}
                sx={{ display: "block", maxWidth: "100%", mx: "auto" }}
              />
            </Box>
          ) : null,
        )}
      </Box>
    </>
  );
}

function PrintRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", py: 0.5 }}>
      <Box sx={{ flex: 1, fontWeight: 700 }}>{label}</Box>
      <Box sx={{ flex: 2 }}>{value}</Box>
    </Box>
  );
}

function PrintCell({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", borderLeft: "1px solid #999", borderBottom: "1px solid #999" }}>
      <Box sx={{ flex: 1, p: 1, bgcolor: "#f3f6f9" }}>{label}</Box>
      <Box sx={{ flex: 2.2, p: 1, borderLeft: "1px solid #999", borderRight: "1px solid #999", lineHeight: 1.5 }}>
        {value}
      </Box>
    </Box>
  );
}
