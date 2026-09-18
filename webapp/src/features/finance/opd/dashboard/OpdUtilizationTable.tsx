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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { money } from "../../util/financeFormat";
import { CELL_SX, HEAD_SX } from "./opdDashboardTableSx";
import {
  utilizationName,
  utilizationPercent,
  utilizationTone,
  type OpdUtilizationRow,
} from "./opdDashboardTypes";

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

/** The colour for each band — `ClaimUtilizationTable.tsx:86`, in portal tokens. */
const TONE_COLOR = {
  high: "error.dark",
  medium: "warning.main",
  normal: undefined,
} as const;

/**
 * How much of their limit each employee has spent.
 *
 * `ClaimUtilizationTable.tsx` — paginated, because this is every employee who
 * has claimed this year and finance reads it looking for the ones near the top
 * of the list.
 */
export function OpdUtilizationTable({ rows }: { rows: OpdUtilizationRow[] }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

  // Clamped at render rather than corrected in an effect. A refetch can return
  // fewer rows than the page the reader is standing on — somebody's claims were
  // withdrawn, or a filter narrowed upstream — and the stored page would then
  // slice past the end and show an empty table under a non-zero row count.
  // Doing it here means no second render and no setState during an effect.
  const lastPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
  const safePage = Math.min(page, lastPage);
  const paged = rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage);

  return (
    <>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={HEAD_SX}>
              <TableCell>Employee</TableCell>
              <TableCell align="right">Submitted</TableCell>
              <TableCell align="right">% Used</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell sx={CELL_SX} colSpan={3} align="center">
                  No claims submitted this year
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => {
                // Banded on the value the reader sees, not the raw one: 89.6
                // prints as 90%, and a band read off 89.6 would colour it amber
                // while the figure beside it says 90.
                const percent = utilizationPercent(row.percentUsed);
                return (
                  <TableRow key={row.employeeEmail} hover>
                    <TableCell sx={CELL_SX}>
                      <Typography sx={{ fontSize: 13 }} title={row.employeeEmail}>
                        {utilizationName(row)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ ...CELL_SX, fontVariantNumeric: "tabular-nums" }} align="right">
                      {money(row.submittedAmount)}
                    </TableCell>
                    <TableCell
                      sx={{
                        ...CELL_SX,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: TONE_COLOR[utilizationTone(percent)],
                      }}
                      align="right"
                    >
                      {percent}%
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Only when there is something to page through — a pager under three
          rows is a control that can never do anything. */}
      {rows.length > 0 && (
        <TablePagination
          component="div"
          count={rows.length}
          page={safePage}
          onPageChange={(_e, next) => setPage(next)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            // Back to the first page: the row that was at the top of page 3
            // is somewhere else entirely once the page size changes.
            setPage(0);
          }}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        />
      )}
    </>
  );
}
