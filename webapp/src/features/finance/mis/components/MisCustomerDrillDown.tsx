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

import { useMemo } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import BuildTable from "./BuildTable";
import MisAppliedFilterChips from "./MisAppliedFilterChips";
import { drillDownColumns, drillDownRows, type DrillDownColumn } from "./drillDownColumns";
import type { MisFilterChip } from "../util/misAppliedFilterChips";
import type { DrillDownState } from "../api/useDrillDownCustomers";

// Who is inside this number.
//
// Ported from digiops-finance
// `arrDashboard/components/ArrSummaryCustomersDialog.js`. Opened by clicking a
// figure in the Build; the row and the Period decide both the question asked of
// the backend and the columns shown back.
//
// ---- it renders through BuildTable, with no Periods at all ------------------
//
// A flat list of eleven or thirteen columns. That looks like a job for a plain
// table until the volume is considered: `/arr-summary/customers` takes no
// limit and no offset, so a Closing drill-down on every business unit returns
// the entire customer book in one payload. The source gets row virtualisation
// free from ag-grid. Here it comes from `BuildTable`, which already windows —
// along with the frozen first column, the sticky header and horizontal scroll
// at thirteen columns. It is handed no `columnGroups`, which is why that table
// now renders a single header row when there are no figure columns.
//
// ---- the CSV button is NOT ported ------------------------------------------
//
// The source has one. This port's export story is ticket 11 — one set of
// shared ExcelJS builders, written once and consumed by the Build and by
// Flash — and a bespoke CSV here would be the second export path that ticket
// exists to prevent. Noted on ticket 11 rather than dropped.

export interface MisCustomerDrillDownProps {
  open: boolean;
  onClose: () => void;
  /** The Build row that was opened. Decides the columns — see `drillDownColumns`. */
  rowId: string;
  /** That row's label, for the title. */
  rowLabel: string;
  /** The column's header, for the title. */
  periodColumn: string;
  /** The Build's Applied filters, shown but not editable. */
  chips: readonly MisFilterChip[];
  state: DrillDownState;
}

export default function MisCustomerDrillDown({
  open,
  onClose,
  rowId,
  rowLabel,
  periodColumn,
  chips,
  state,
}: MisCustomerDrillDownProps) {
  const columns = useMemo(() => drillDownColumns(rowId), [rowId]);
  const rows = useMemo(() => drillDownRows(state.customers), [state.customers]);
  // Zipped by POSITION rather than keyed by account id. `drillDownRows`
  // suffixes a repeated id so two customers cannot share a DOM id, which means
  // the row id is no longer always the account id — and looking the customer up
  // by it would hand the same one to both rows.
  const byRowId = useMemo(
    () => new Map(rows.map((row, index) => [row.id, state.customers[index]])),
    [rows, state.customers],
  );

  // The source's title exactly: the row, a middle dot, the column. It is the
  // only thing tying the list back to the cell the reader clicked.
  const title = `${rowLabel} · ${periodColumn}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pr: 6 }}>
        {title}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {/* Below the title rather than inside it: the dialog's accessible name
            should be the figure it is explaining, and a chip strip folded into
            the title reads out as part of that name.

            No onRemove, which is what makes the strip read-only. These are the
            Build's filters, and changing one from in here would leave the list
            describing a different figure from the one it was opened from. */}
        <MisAppliedFilterChips chips={chips} />
        <DrillDownBody state={state} rows={rows} columns={columns} byRowId={byRowId} />
      </DialogContent>
    </Dialog>
  );
}

function DrillDownBody({
  state,
  rows,
  columns,
  byRowId,
}: {
  state: DrillDownState;
  rows: ReturnType<typeof drillDownRows>;
  columns: readonly DrillDownColumn[];
  byRowId: ReadonlyMap<string, Parameters<DrillDownColumn["value"]>[0] | undefined>;
}) {
  if (state.isLoading) {
    // A fixed height in every branch, so the dialog does not jump when the
    // answer lands — the source holds 520px the same way.
    return (
      <Box sx={{ height: 420, display: "grid", placeItems: "center", gap: 1 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // The source cannot reach this state — its error is discarded three times
  // over, so a failed drill-down renders an empty grid there. On a screen whose
  // purpose is to explain a figure, that reads as "this number is made of
  // nobody". Deviation recorded in mis.md §7.
  if (state.isError) {
    return (
      <ErrorNotice onRetry={state.retry} sx={{ my: 2 }}>
        Couldn&apos;t load the customers behind this figure. {state.errorMessage}
      </ErrorNotice>
    );
  }

  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        No customers behind this figure.
      </Typography>
    );
  }

  return (
    <BuildTable
      label="Customers behind this figure"
      rowLabelHeader={columns[0].label}
      leadColumns={columns}
      leadCell={(row, column) => {
        const customer = byRowId.get(row.id);
        return customer ? column.value(customer) : "";
      }}
      columnGroups={[]}
      subColumns={[]}
      rows={rows}
      // No figures: every column of this table is identity. Required by the
      // component and never called.
      cell={() => ({ text: "" })}
      maxBodyHeight={420}
    />
  );
}
