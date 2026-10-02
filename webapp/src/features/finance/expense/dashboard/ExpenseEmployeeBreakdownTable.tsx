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

import { Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import { CELL_SX, HEAD_SX } from "../../opd/dashboard/opdDashboardTableSx";
import type { ExpenseReportEmployeeItem } from "../expenseTypes";

/** `EmployeeBreakdownTable.tsx` — one row per employee who filed a claim in
 *  the period, with the top-reimbursed row called out. */
export function ExpenseEmployeeBreakdownTable({
  items,
  currency,
}: {
  items: ExpenseReportEmployeeItem[];
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1.5 }}>
        No employees submitted claims in this period.
      </Typography>
    );
  }

  // The backend orders this breakdown by total value descending, so the
  // first row is the highest-reimbursed employee — marked only when there
  // is something to compare it against.
  const topEmail = items.length > 1 && items[0].totalValue > 0 ? items[0].employeeEmail : null;

  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={HEAD_SX}>
          <TableCell>Employee</TableCell>
          <TableCell align="right">Claims</TableCell>
          <TableCell align="right">Pending</TableCell>
          <TableCell align="right">Claims / Month</TableCell>
          <TableCell align="right">Total Value</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => {
          const isTop = item.employeeEmail === topEmail;
          return (
            <TableRow key={item.employeeEmail}>
              <TableCell sx={{ ...CELL_SX, fontWeight: isTop ? 700 : 400 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  {item.employeeName}
                  {isTop && (
                    <Chip
                      label="Top reimbursed"
                      size="small"
                      color="warning"
                      sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                    />
                  )}
                </Stack>
              </TableCell>
              <TableCell align="right" sx={{ ...CELL_SX, fontWeight: isTop ? 700 : 400 }}>
                {item.claimCount}
              </TableCell>
              <TableCell align="right" sx={{ ...CELL_SX, fontWeight: isTop ? 700 : 400 }}>
                {item.pendingCount}
              </TableCell>
              <TableCell align="right" sx={{ ...CELL_SX, fontWeight: isTop ? 700 : 400 }}>
                {item.claimsPerMonth}
              </TableCell>
              <TableCell align="right" sx={{ ...CELL_SX, fontWeight: isTop ? 700 : 400 }}>
                {money(item.totalValue, currency)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
