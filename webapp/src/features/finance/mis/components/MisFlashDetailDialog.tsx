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

import { useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import BuildTable, { type BuildCellFor } from "./BuildTable";
import MisFlashAccountsDialog from "./MisFlashAccountsDialog";
import { flashAccountsQuery, flashDetailRows } from "./flashDetailRows";
import { flashSectionIds } from "./flashRowIds";
import type { FlashUnitColumn } from "./flashPnlRows";
import {
  flashDetailColumns,
  flashMonthLabel,
  flashRangeLabel,
  type FlashMonthlyRange,
} from "../util/misFlashPeriods";
import { amountUnitCaption, formatMisValue } from "../util/misMoney";
import type { MisScale } from "../util/misViewVocabulary";
import type { FlashDetailState } from "../api/useFlashDetail";
import type { FlashAccountsQuery } from "../api/misFlashTypes";

// One business unit's P&L, month by month.
//
// Ported from `flashConsole/tableView.js/MonthlyViewDialog.js` and
// `MonthlyViewTable.js`. Opened from a business-unit column header on the
// Flash, which is where the source opens it from too — its column headers ARE
// the buttons.
//
// ---- what it does besides read ---------------------------------------------
//
// Ticket 16: a Revenue line or a Cost of Sales sub-category is a sum of GL
// accounts, and its figures open the list of them — `MisFlashAccountsDialog`,
// where forecasts are written. Which figures, and what each asks, is
// `flashDetailRows`' to say; this dialog only puts the question on the cell.
// Comments (ticket 17) and the Export button (ticket 18) are still to come, and
// each adds to this dialog rather than replacing it.
//
// ---- which month a column is ----------------------------------------------
//
// Each column is one month, asked for as `[last of M−1, last of M]` and headed
// M. That pair is the one both halves of the backend read as M — the financial
// accounts sum a range under its END month, ARR reads its two dates as instants
// — and it is what the source sends from Colombo. From any other zone the
// source sends something else, because it builds the dates through a local
// `Date`; the port writes the Colombo answer out as arithmetic. Spec §8, and
// `flashMonthlyRanges` for the primary sources.
//
// Ticket 15 sent `[first of M, first of M+1]` and headed it by the start, which
// put every financial-account figure here one month late under its header.
// Ticket 16 found it, because an account view has to name the month a figure
// covers.
//
// The oldest month IS reproduced as the source has it: **fetched and not
// drawn**. See `flashDetailColumns`.

const COLUMN_WIDTH = 116;
const ROW_LABEL_WIDTH = 240;

export interface MisFlashDetailDialogProps {
  open: boolean;
  onClose: () => void;
  /** Which column was opened. Its label titles the dialog. */
  unit: FlashUnitColumn | null;
  /** Every month asked for, oldest first. All but the first are drawn. */
  ranges: readonly FlashMonthlyRange[];
  state: FlashDetailState;
  scale: MisScale;
}

export default function MisFlashDetailDialog({
  open,
  onClose,
  unit,
  ranges,
  state,
  scale,
}: MisFlashDetailDialogProps) {
  const title = unit ? `Monthly View — ${unit.label}` : "Monthly View";
  // The figure whose accounts are open, if any. Nothing resets it when this
  // dialog shuts, and nothing needs to: the account view is modal over this
  // one, so this one cannot be shut while it is open.
  const [accountsQuery, setAccountsQuery] = useState<FlashAccountsQuery | null>(null);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pr: 6 }}>
        {title}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", right: 12, top: 12, color: "text.secondary" }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack
          direction="row"
          sx={{
            alignItems: "baseline",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1,
            mb: 1,
          }}
        >
          {/* The span the source puts on its one tab, which names the months
              DRAWN rather than the months fetched. */}
          <Typography variant="body2" color="text.secondary">
            {flashRangeLabel(ranges)}
          </Typography>
          {/* The caption travels with the table, not with the control that set
              it — Finance crops these into decks. */}
          <Typography variant="caption" color="text.secondary">
            {amountUnitCaption(scale)}
          </Typography>
        </Stack>
        <DetailBody
          ranges={ranges}
          state={state}
          scale={scale}
          unit={unit}
          onOpenAccounts={setAccountsQuery}
        />
      </DialogContent>
      {/* Mounted only while a figure is open, so its list is never read for a
          figure nobody opened, and a view opened again starts from a fresh read
          and an empty form rather than from the last one's. */}
      {accountsQuery && (
        <MisFlashAccountsDialog
          query={accountsQuery}
          unitLabel={unit?.label ?? ""}
          onClose={() => setAccountsQuery(null)}
        />
      )}
    </Dialog>
  );
}

function DetailBody({
  ranges,
  state,
  scale,
  unit,
  onOpenAccounts,
}: {
  ranges: readonly FlashMonthlyRange[];
  state: FlashDetailState;
  scale: MisScale;
  unit: FlashUnitColumn | null;
  onOpenAccounts: (query: FlashAccountsQuery) => void;
}) {
  const unitLabel = unit?.label ?? "";
  const { rows, figures } = useMemo(
    () => flashDetailRows(state.sales, state.accounts),
    [state.sales, state.accounts],
  );
  const columns = useMemo(() => flashDetailColumns(ranges), [ranges]);
  const columnGroups = useMemo(
    () =>
      columns.map((column) => ({
        // Keyed by the response index, which is what the cell reads. The month
        // label is not unique enough to key on in principle and the index is
        // exactly what identifies the column.
        key: String(column.index),
        // Headed by the month its figures cover. See the note above.
        label: flashMonthLabel(column.range.month),
        width: COLUMN_WIDTH,
      })),
    [columns],
  );
  /** Each drawn column's month, by the response index its key carries. */
  const monthAt = useMemo(
    () => new Map(columns.map((column) => [column.index, column.range.month])),
    [columns],
  );
  const cell: BuildCellFor = (row, group) => {
    const held = figures.get(row.id);
    // The column's key IS the index it reads — see `columnGroups` above.
    const index = Number(group.key);
    const month = monthAt.get(index);
    if (!held || !month) return { text: "" };
    const raw = held.values[index] ?? null;
    // The month on the header, which is the month the backend summed here —
    // so the accounts listed are the ones this figure is the sum of.
    const accounts = unit ? flashAccountsQuery(held.accounts, unit, month) : null;
    return {
      // Through ticket 05, so Scale reaches currency and nothing else. Gross
      // Margin is a percentage here exactly as it is on the P&L, and
      // `formatMisValue` reads `scale` in the currency branch alone.
      text: formatMisValue(raw, held.valueType, { scale }),
      negative: typeof raw === "number" && raw < 0,
      ...(accounts ? { onActivate: () => onOpenAccounts(accounts) } : {}),
    };
  };

  if (state.isLoading) {
    // A fixed height in every branch, so the dialog does not jump when the
    // answer lands. The drill-down holds 420px the same way.
    return (
      <Box sx={{ height: 460, display: "grid", placeItems: "center" }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (state.isError) {
    return (
      <ErrorNotice onRetry={state.retry} sx={{ my: 2 }}>
        Couldn&apos;t load the monthly detail{unitLabel ? ` for ${unitLabel}` : ""}.{" "}
        {state.errorMessage}
      </ErrorNotice>
    );
  }

  if (!columnGroups.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        No months in this range to break down.
      </Typography>
    );
  }

  return (
    <BuildTable
      label={`Monthly detail${unitLabel ? ` for ${unitLabel}` : ""}`}
      // Named, where the source leaves it blank — see MisFlashPage.
      rowLabelHeader="Line"
      columnGroups={columnGroups}
      // No sub-division: one figure column per month. See BuildTable.
      subColumns={[]}
      rows={rows}
      cell={cell}
      defaultExpandedIds={flashSectionIds(rows)}
      rowLabelWidth={ROW_LABEL_WIDTH}
      maxBodyHeight={460}
    />
  );
}
