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

import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import { approvalDate } from "./expenseApprovalFormat";
import { isOnBehalfOfClaim, type ApprovalClaim } from "./expenseApprovalTypes";

/**
 * The approver's queue — ClaimTable.tsx in its lead/finance shape.
 *
 * Its own table rather than the `ClaimsTable` the Me-side screens share: that
 * one makes the User and Status columns mutually exclusive, and this screen
 * needs a specific pair of columns that no other screen wants.
 *
 * There is no Status column here, and that matches the source
 * (`ClaimTable.tsx:103,106`): the lead/finance views swap it for User. Within a
 * tab every row carries the same status anyway, so the column would only repeat
 * the tab's name back at the reader.
 */
export function ExpenseApprovalTable({
  claims,
  nameFor,
  actionLabel,
  onOpen,
  decidedId,
}: {
  claims: ApprovalClaim[];
  /** Resolves a work email to a display name; the address stays in a tooltip. */
  nameFor: (email: string | null | undefined) => string;
  /** "Review" on the pending queue, "View" once a claim has been decided. */
  actionLabel: "Review" | "View";
  onOpen: (claim: ApprovalClaim) => void;
  /**
   * The claim just decided, if it is still on screen. The source fades the
   * reviewed row out before dropping it (`ClaimTable.tsx:80-95`); here the
   * refetch is what removes it, and the fade covers the wait.
   */
  decidedId?: string | null;
}) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow
            sx={{
              "& th": {
                fontSize: 11,
                fontWeight: 700,
                color: "text.secondary",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              },
            }}
          >
            <TableCell>Claim ID</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Submitted Date</TableCell>
            <TableCell align="right">Total Amount</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((claim) => (
            <TableRow
              key={claim.id}
              hover
              sx={{
                opacity: decidedId === claim.id ? 0 : 1,
                transition: "opacity 600ms ease-out",
              }}
            >
              <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <span>{claim.id}</span>
                  {/* utils.ts#isOnBehalfOfClaim — filed by somebody other than
                      the person it belongs to, so the approver knows the spend
                      and the filing are two different people. */}
                  {isOnBehalfOfClaim(claim) && (
                    <Tooltip describeChild arrow title={claim.submittedBy ?? ""}>
                      <Chip
                        label="On behalf"
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: 10, fontFamily: "inherit" }}
                      />
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
              <TableCell sx={{ fontSize: 12.5 }}>
                {/* UserCard.tsx — the name on screen, the address in a tooltip.
                    Falls back to the address until /employees has arrived. */}
                <Tooltip describeChild arrow title={claim.employeeEmail}>
                  <Typography component="span" sx={{ fontSize: 12.5 }}>
                    {nameFor(claim.employeeEmail)}
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ fontSize: 12.5 }}>{approvalDate(claim.createdDate)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                {money(claim.totalAmount, claim.currencyCode ?? "LKR")}
              </TableCell>
              <TableCell align="right">
                {/* A Button in the cell, never a click handler on the row — a
                    <tr> takes no focus, so a row-click queue is unreachable
                    from the keyboard. */}
                <Button
                  size="small"
                  variant={actionLabel === "Review" ? "contained" : "outlined"}
                  onClick={() => onOpen(claim)}
                  sx={{ textTransform: "none", fontWeight: 600, minWidth: 96 }}
                >
                  {actionLabel}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
