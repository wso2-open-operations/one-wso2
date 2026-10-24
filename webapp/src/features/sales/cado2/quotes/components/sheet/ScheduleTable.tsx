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

import type { JSX } from "react";
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import type { PricingYear } from "@features/sales/cado2/quotes/api/quoteTypes";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { yearOpportunity, type SheetLine } from "@features/sales/cado2/quotes/sheet/sheetModel";
import { formatMoney } from "@features/sales/cado2/utils/money";

const num = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

/**
 * A multi-year quote's schedule: each product per contract year (net, with
 * gross − discount and the share of the year it covers), then each year's
 * total and what is billed. Each year's heading says which Salesforce
 * opportunity it belongs to.
 */
export default function ScheduleTable({
  years,
  lines,
  netOfCommission = false,
}: {
  years: readonly PricingYear[];
  lines: readonly SheetLine[];
  /** A partner-led quote: "Billed" is what WSO2 invoices, after the commission (A6). */
  netOfCommission?: boolean;
}): JSX.Element {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
      <Table size="small" aria-label="Yearly schedule">
        <TableHead>
          <TableRow>
            <TableCell />
            {years.map((y) => (
              <TableCell key={y.yearNumber} align="right">
                Year {y.yearNumber}
                <Typography variant="caption" display="block" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  {formatDate(y.periodStart)} – {formatDate(y.periodEnd)}
                </Typography>
                <Typography variant="caption" display="block" color={y.yearNumber === 1 ? "primary.main" : "text.secondary"}>
                  {yearOpportunity(y.yearNumber)}
                </Typography>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {/* Year by year (a step per year), whenever each line was added. */}
          {[...lines]
            .sort((a, b) => a.yearNumber - b.yearNumber)
            .map((l, i, sorted) => (
            <TableRow
              key={l.number}
              sx={i > 0 && sorted[i - 1].yearNumber !== l.yearNumber ? { "& td": { borderTop: 2, borderTopColor: "divider" } } : undefined}
            >
              <TableCell>
                {l.number}. {l.productName}
              </TableCell>
              {years.map((y) => {
                const row = l.schedule.find((r) => r.yearNumber === y.yearNumber);
                return (
                  <TableCell key={y.yearNumber} align="right" sx={num}>
                    {row ? (
                      <>
                        {formatMoney(row.net)}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {formatMoney(row.gross)} − {formatMoney(row.discount)} · {Number(row.yearFraction).toFixed(3)} yr
                        </Typography>
                      </>
                    ) : null}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
            {years.map((y) => (
              <TableCell key={y.yearNumber} align="right" sx={{ ...num, fontWeight: 700 }}>
                {formatMoney(y.net)}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell sx={{ borderBottom: 0 }}>{netOfCommission ? "Billed, net of commission" : "Billed"}</TableCell>
            {years.map((y) => (
              <TableCell key={y.yearNumber} align="right" sx={{ ...num, borderBottom: 0 }}>
                {formatMoney(netOfCommission ? (y.netBilling ?? y.billing) : y.billing)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
