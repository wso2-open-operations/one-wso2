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
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import BuildTable, { type BuildCellFor } from "./BuildTable";
import { flashDetailRows } from "./flashDetailRows";
import { flashSectionIds } from "./flashRowIds";
import type { FlashUnitColumn } from "./flashPnlRows";
import {
  flashDetailColumns,
  flashMonthLabel,
  flashRangeLabel,
  type MisFlashRange,
} from "../util/misFlashPeriods";
import { amountUnitCaption, formatMisValue } from "../util/misMoney";
import type { MisScale } from "../util/misViewVocabulary";
import type { FlashDetailState } from "../api/useFlashDetail";

// One business unit's P&L, month by month.
//
// Ported from `flashConsole/tableView.js/MonthlyViewDialog.js` and
// `MonthlyViewTable.js`. Opened from a business-unit column header on the
// Flash, which is where the source opens it from too — its column headers ARE
// the buttons.
//
// ---- what ticket 15 takes, and what it leaves ------------------------------
//
// Read-only. The source's version of this dialog is also where budget and
// forecast values are edited (ticket 16), where comments hang off every cell
// (ticket 17), and where its own Export button is (ticket 18). Each of those
// adds to this dialog rather than replacing it.
//
// ---- the two off-by-one months in the source, and what is done about each --
//
// The columns here are NOT the columns the source draws, and both differences
// are defects rather than decisions. Spec §8 records them:
//
//   1. Its monthly ranges are built by round-tripping ISO dates through a local
//      `Date`, which in California lands every one of them a month early. The
//      port computes months in Pacific and does not shift — spec §3, §10.8.
//   2. Its column header reads `period.endDate`, and a range runs from the
//      first of its month to the first of the NEXT, so September's figures are
//      headed "Oct 2025". The port heads a column with the month it COVERS.
//
// Both are corrections rather than ADR 0003 reproductions, because a column of
// figures under the wrong month is not a disagreement a reconciler could settle
// — it is the two apps describing different months while appearing to describe
// the same one.
//
// The third oddity IS reproduced: **the oldest month is fetched and not
// drawn**. See `flashDetailColumns`.

const COLUMN_WIDTH = 116;
const ROW_LABEL_WIDTH = 240;

export interface MisFlashDetailDialogProps {
  open: boolean;
  onClose: () => void;
  /** Which column was opened. Its label titles the dialog. */
  unit: FlashUnitColumn | null;
  /** Every month asked for, oldest first. All but the first are drawn. */
  ranges: readonly MisFlashRange[];
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
        <DetailBody ranges={ranges} state={state} scale={scale} unitLabel={unit?.label ?? ""} />
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({
  ranges,
  state,
  scale,
  unitLabel,
}: {
  ranges: readonly MisFlashRange[];
  state: FlashDetailState;
  scale: MisScale;
  unitLabel: string;
}) {
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
        // Headed by the month it COVERS — its start. See the note above.
        label: flashMonthLabel(column.range.startDate),
        width: COLUMN_WIDTH,
      })),
    [columns],
  );
  const cell: BuildCellFor = (row, group) => {
    const held = figures.get(row.id);
    // The column's key IS the index it reads — see `columnGroups` above.
    const index = Number(group.key);
    if (!held || !Number.isInteger(index)) return { text: "" };
    const raw = held.values[index] ?? null;
    return {
      // Through ticket 05, so Scale reaches currency and nothing else. Gross
      // Margin is a percentage here exactly as it is on the P&L, and
      // `formatMisValue` reads `scale` in the currency branch alone.
      text: formatMisValue(raw, held.valueType, { scale }),
      negative: typeof raw === "number" && raw < 0,
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
