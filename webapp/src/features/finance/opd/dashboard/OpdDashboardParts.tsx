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

import { Card, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import { CELL_SX, HEAD_SX } from "./opdDashboardTableSx";

/** A section of the dashboard: a titled panel, as the source draws each block. */
export function OpdDashboardPanel({
  title,
  aside,
  children,
}: {
  title: string;
  /** Sits beside the title in lighter type — the source's limit note. */
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <Card variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography sx={{ fontSize: 14.5, fontWeight: 600, mb: 1 }}>
        {title}
        {aside && (
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 400, color: "text.secondary", ml: 1 }}>
            {aside}
          </Typography>
        )}
      </Typography>
      {children}
    </Card>
  );
}

/** One of the four figures across the top. `StatCard.tsx`. */
export function OpdStatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{title}</Typography>
      <Typography
        sx={{ fontSize: 24, fontWeight: 700, color: "text.secondary", mt: 0.5, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Typography>
    </Card>
  );
}


/**
 * This year against last, on the two counts the source compares.
 *
 * `SubmittersComparisonTable.tsx` — a two-row table rather than four more stat
 * cards, because the point of it is the comparison between the columns.
 */
export function OpdSubmittersTable({
  submittedThisYear,
  submittedLastYear,
  fullyUtilisedThisYear,
  fullyUtilisedLastYear,
}: {
  submittedThisYear: number;
  submittedLastYear: number;
  fullyUtilisedThisYear: number;
  fullyUtilisedLastYear: number;
}) {
  const rows: [string, number, number][] = [
    ["Employees submitted", submittedThisYear, submittedLastYear],
    // "utilised" with an s: the source's spelling, and the portal's.
    ["Fully utilised limit", fullyUtilisedThisYear, fullyUtilisedLastYear],
  ];
  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={HEAD_SX}>
          {/* Empty: the row labels below are what this column holds. */}
          <TableCell />
          <TableCell align="right">This Year</TableCell>
          <TableCell align="right">Last Year</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(([label, thisYear, lastYear]) => (
          <TableRow key={label}>
            <TableCell sx={CELL_SX}>{label}</TableCell>
            <TableCell sx={{ ...CELL_SX, fontVariantNumeric: "tabular-nums" }} align="right">
              {thisYear}
            </TableCell>
            <TableCell sx={{ ...CELL_SX, fontVariantNumeric: "tabular-nums" }} align="right">
              {lastYear}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

