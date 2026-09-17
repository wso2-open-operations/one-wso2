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

import { Box, DataGrid, Typography } from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "../util/financeGridSx";
import { money, formatNice } from "../util/financeFormat";
import type { CcNewTransaction } from "./ccTypes";

// StatementDataGrid.tsx:43 — the source writes N/A here, not a dash.
const NOT_AVAILABLE = "N/A";

// StatementDataGrid.tsx:38-67, in its order and its wording. Lead Email is
// the column that says who each row will go to for approval.
const STATEMENT_COLUMNS: DataGrid.GridColDef<CcNewTransaction>[] = [
  { field: "txnReferenceNo", headerName: "Reference No", flex: 1, minWidth: 130 },
  {
    field: "employeeEmail",
    headerName: "Card Owner",
    flex: 1,
    minWidth: 180,
    renderCell: (p) => (p.value as string) || NOT_AVAILABLE,
  },
  { field: "ccNumber", headerName: "Card Number", flex: 1, minWidth: 130 },
  {
    field: "leadEmail",
    headerName: "Lead Email",
    flex: 1.5,
    minWidth: 200,
    renderCell: (p) => (p.value as string) || NOT_AVAILABLE,
  },
  {
    field: "txnDate",
    headerName: "Transaction Date",
    flex: 1,
    minWidth: 150,
    renderCell: (p) => formatNice(p.value as string),
  },
  { field: "txnDescription", headerName: "Description", flex: 1.5, minWidth: 180 },
  {
    field: "txnAmount",
    headerName: "Amount",
    flex: 0.8,
    minWidth: 110,
    type: "number",
    // Not bare here: the source's header is "Amount" with no currency, and
    // a statement row carries its own txnCurrency.
    renderCell: (p) => money(p.value as number, p.row.txnCurrency),
  },
];

/**
 * One tab's worth of a parsed statement.
 *
 * `StatementDataGrid.tsx:70-95` — the same grid renders all three groups, so
 * new, duplicate and invalid rows are read the same way; only the rows differ.
 * It carries the all-in-one toolbar the source gives it: columns, filters,
 * density, quick filter and export. Export is offered here where it is
 * withheld on the transaction grids — this is finance reconciling a statement
 * it uploaded itself.
 */
export function CcStatementGrid({ rows }: { rows: CcNewTransaction[] }) {
  if (rows.length === 0) {
    return (
      <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
        None in this group.
      </Typography>
    );
  }

  return (
    // A fixed height, the way the source's own grid is sized: ten rows plus
    // its toolbar and pagination, with no dependence on the page frame.
    <Box sx={{ height: 460, width: "100%" }}>
      <DataGrid.DataGrid
        rows={rows}
        columns={STATEMENT_COLUMNS}
        getRowId={(r) => r.txnReferenceNo}
        showToolbar
        density="compact"
        disableRowSelectionOnClick
        initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
        pageSizeOptions={[10, 25, 50, 100]}
        sx={FINANCE_GRID_SX}
      />
    </Box>
  );
}
