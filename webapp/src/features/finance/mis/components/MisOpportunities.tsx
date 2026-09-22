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

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from "@wso2/oxygen-ui";
import { XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import BuildTable, { type BuildCellFor } from "./BuildTable";
import {
  OPPORTUNITY_COLUMNS,
  opportunityRows,
  type OpportunityAccount,
  type OpportunityColumn,
} from "./opportunityRows";
import { MIS_VALUE_TYPES, amountUnitCaption, formatMisValue } from "../util/misMoney";
import type { MisScale } from "../util/misViewVocabulary";
import type { OpportunitiesState } from "../api/useOpportunities";

// The opportunities behind one account on the Software/Cloud Customers table.
//
// Ported from digiops-finance `arrDashboard/components/OpportunitiesDialog.js`,
// and built on the same `BuildTable` the customer drill-down beside it uses —
// twenty lead columns, no Period groups. See `opportunityRows.ts` for why the
// source's `Software` / `Cloud` group headers do not survive the port.
//
// ---- what opens it, and what does not --------------------------------------
//
// The source opens this on ANY cell click anywhere in the table, identity
// columns included (`DataGrid.js:604-626` — `onCellClicked` with no column
// test). So clicking an account's NAME opens a dialog whose date came from the
// name column, which has no date; that is one of the two paths its header-text
// scraping exists to rescue. Here only a FIGURE cell opens it, because only a
// figure cell belongs to a Period and therefore has a date to ask about — and
// the Total row opens nothing at all, having no account behind it.

export interface MisOpportunitiesProps {
  open: boolean;
  onClose: () => void;
  /** Which account, and which column — named in the title. */
  account: OpportunityAccount | null;
  /** The closing date of the column that was clicked, for the title. */
  asOf?: string;
  state: OpportunitiesState;
  scale: MisScale;
}

export default function MisOpportunities({
  open,
  onClose,
  account,
  asOf,
  state,
  scale,
}: MisOpportunitiesProps) {
  const rows = useMemo(
    () => (account ? opportunityRows(state.opportunities, account) : []),
    [state.opportunities, account],
  );

  const byRowId = useMemo(
    () => new Map(rows.map((row) => [row.rowId, row])),
    [rows],
  );

  // `BuildTable` reads a lead cell through the column's own object, so the
  // column carries its reader and this stays one lookup rather than twenty
  // comparisons.
  const leadCell = (row: { id: string }, column: OpportunityColumn): string => {
    const opportunity = byRowId.get(row.id);
    if (!opportunity) return "";
    const value = column.read(opportunity);
    return column.isFigure
      ? // Every figure here is currency, so Scale reaches all of them — the
        // same as the customers table this dialog opens from.
        formatMisValue(value as number, MIS_VALUE_TYPES.CURRENCY, { scale })
      : String(value);
  };

  // No Period groups: this table's columns are all identity and figure columns
  // of one opportunity, so there is nothing to group them by.
  const cell: BuildCellFor = () => ({ text: "" });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700, pr: 6 }}>
        Opportunities — {account?.name || account?.id || "account"}
        {asOf ? ` (as of ${asOf})` : ""}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <XIcon size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {state.isError ? (
          <ErrorNotice onRetry={state.retry}>
            Couldn&apos;t load the opportunities. {state.errorMessage}
          </ErrorNotice>
        ) : state.isLoading ? (
          <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />
        ) : rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" role="status">
            No opportunities for this account as at this date.
          </Typography>
        ) : (
          <>
            <Stack
              direction="row"
              sx={{ alignItems: "baseline", justifyContent: "space-between", mb: 0.75 }}
            >
              <Typography variant="caption" color="text.secondary">
                {rows.length} {rows.length === 1 ? "opportunity" : "opportunities"}
              </Typography>
              {/* The caption travels with the table, so a figure cropped into a
                  deck carries its units — see `amountUnitCaption`. */}
              <Typography variant="caption" color="text.secondary">
                {amountUnitCaption(scale)}
              </Typography>
            </Stack>
            <BuildTable
              // Names the table for assistive tech, the way the drill-down
              // beside it does — the dialog's own title is the heading, and
              // this is the table's.
              label="Opportunities behind this account"
              rowLabelHeader={OPPORTUNITY_COLUMNS[0].label}
              // `label` must be the FIRST column's value, not any other:
              // `BuildTable` renders `leadColumns[0]` from `row.label` rather
              // than through `leadCell`, so a mismatch puts one field under
              // another's header. Here that showed the opportunity name under
              // "Account ID", and again under "Opportunity Name".
              rows={rows.map((row) => ({ id: row.rowId, label: row.accountId }))}
              leadColumns={OPPORTUNITY_COLUMNS}
              leadCell={leadCell}
              columnGroups={[]}
              subColumns={[]}
              cell={cell}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
