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
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { money, formatNice } from "../../util/financeFormat";
import { claimantName } from "./opdApprovals";
import type { OpdClaim, OpdEmployee } from "../opdTypes";

/**
 * The queue — `ClaimTable.tsx` in its finance shape.
 *
 * Carries the User column the submitter's own history does not: this is
 * everybody's claims, and whose it is decides whether it is yours to approve.
 * The status column is absent because the tab IS the status.
 */
export function OpdApprovalsTable({
  claims,
  employees,
  onReview,
}: {
  claims: OpdClaim[];
  employees: OpdEmployee[] | undefined;
  onReview: (claim: OpdClaim) => void;
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
            <TableRow key={claim.id} hover>
              <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>{claim.id}</TableCell>
              <TableCell sx={{ fontSize: 12.5 }}>
                {/* The address in the tooltip: two people can share a display
                    name, and the address is what the claim is actually keyed on. */}
                <Typography sx={{ fontSize: 12.5 }} title={claim.employeeEmail}>
                  {claimantName(claim.employeeEmail, employees)}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: 12.5 }}>{formatNice(claim.createdDate)}</TableCell>
              <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                {money(claim.totalAmount)}
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" justifyContent="flex-end">
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onReview(claim)}
                    aria-label={`Review claim ${claim.id}`}
                    sx={{ textTransform: "none" }}
                  >
                    Review
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
