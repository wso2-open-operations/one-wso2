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

import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import { CELL_SX, HEAD_SX } from "../../opd/dashboard/opdDashboardTableSx";
import { formatPercentage, percentageColor } from "./expenseDashboardUtils";
import type { ExpenseReportEntityItem } from "../expenseTypes";

/** `BusinessEntityTable.tsx` — one row per legal entity, reusing the SAME
 *  table chrome every other finance dashboard draws its breakdowns with. */
export function ExpenseEntityBreakdownTable({
  items,
  currency,
}: {
  items: ExpenseReportEntityItem[];
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1.5 }}>
        No business entities to show for the selected filters.
      </Typography>
    );
  }

  // Several subsidiaries share a legal name, so the entity code is shown
  // alongside it whenever a name appears more than once in this breakdown.
  const labelFor = (item: ExpenseReportEntityItem): string =>
    items.filter((other) => other.legalName === item.legalName).length > 1
      ? `${item.legalName} (${item.businessEntity})`
      : item.legalName;

  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={HEAD_SX}>
          <TableCell>Business Entity</TableCell>
          <TableCell align="right">Count</TableCell>
          <TableCell align="right">Total Value</TableCell>
          <TableCell align="right">Avg. Value</TableCell>
          <TableCell align="right">vs Prior Period</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.businessEntity}>
            <TableCell sx={{ ...CELL_SX, color: item.claimCount === 0 ? "text.disabled" : "text.primary" }}>
              {labelFor(item)}
            </TableCell>
            <TableCell align="right" sx={CELL_SX}>
              {item.claimCount}
            </TableCell>
            <TableCell align="right" sx={CELL_SX}>
              {money(item.totalValue, currency)}
            </TableCell>
            <TableCell align="right" sx={CELL_SX}>
              {money(item.averageClaimValue, currency)}
            </TableCell>
            <TableCell
              align="right"
              sx={{
                ...CELL_SX,
                color: item.claimCount === 0 ? "text.disabled" : percentageColor(item.totalValueChangePercentage),
              }}
            >
              {item.claimCount === 0 ? "—" : formatPercentage(item.totalValueChangePercentage)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
