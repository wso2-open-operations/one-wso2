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

import { Box, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import { CELL_SX, HEAD_SX } from "../../opd/dashboard/opdDashboardTableSx";
import type { ExpenseReportMonthlyItem } from "../expenseTypes";

/** `MonthlyBreakdownTable.tsx` — one row per month, one column per expense
 *  category, with a Total column and a totals row underneath. */
export function ExpenseMonthlyBreakdownTable({
  expenseTypeColumns,
  items,
  currency,
}: {
  expenseTypeColumns: string[];
  items: ExpenseReportMonthlyItem[];
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1.5 }}>
        No claims in this period.
      </Typography>
    );
  }

  const amountFor = (item: ExpenseReportMonthlyItem, expenseType: string): number =>
    item.amounts.find((amount) => amount.expenseType === expenseType)?.amount ?? 0;
  const columnTotal = (expenseType: string): number =>
    items.reduce((sum, item) => sum + amountFor(item, expenseType), 0);
  const periodTotal = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={HEAD_SX}>
          <TableCell>Month</TableCell>
          {expenseTypeColumns.map((expenseType) => (
            <TableCell key={expenseType} align="right">
              <Tooltip title={expenseType} arrow>
                <Box
                  component="span"
                  sx={{
                    display: "inline-block",
                    maxWidth: 150,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    verticalAlign: "bottom",
                  }}
                >
                  {expenseType}
                </Box>
              </Tooltip>
            </TableCell>
          ))}
          <TableCell align="right">Total</TableCell>
          <TableCell align="right">%</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.month}>
            <TableCell sx={{ ...CELL_SX, whiteSpace: "nowrap" }}>{item.label}</TableCell>
            {expenseTypeColumns.map((expenseType) => (
              <TableCell key={expenseType} align="right" sx={CELL_SX}>
                {money(amountFor(item, expenseType), currency)}
              </TableCell>
            ))}
            <TableCell align="right" sx={CELL_SX}>
              {money(item.total, currency)}
            </TableCell>
            <TableCell align="right" sx={CELL_SX}>
              {item.percentageOfTotal}%
            </TableCell>
          </TableRow>
        ))}
        <TableRow sx={{ "& td": { fontWeight: 700, border: 0, bgcolor: "action.hover" } }}>
          <TableCell sx={CELL_SX}>Total</TableCell>
          {expenseTypeColumns.map((expenseType) => (
            <TableCell key={expenseType} align="right" sx={CELL_SX}>
              {money(columnTotal(expenseType), currency)}
            </TableCell>
          ))}
          <TableCell align="right" sx={CELL_SX}>
            {money(periodTotal, currency)}
          </TableCell>
          <TableCell align="right" sx={CELL_SX}>
            100%
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
