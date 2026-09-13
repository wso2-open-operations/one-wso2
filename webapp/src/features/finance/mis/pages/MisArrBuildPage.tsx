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
import { Box, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import MisShell from "../components/MisShell";
import BuildTable, { type BuildCellFor } from "../components/BuildTable";
import {
  ARR_BUILD_SECTION_IDS,
  arrBuildFieldFor,
  arrBuildRows,
  type ArrSummaryResponse,
} from "../components/arrBuildRows";
import { useArrSummary, type ArrSummaryColumn } from "../api/useArrSummary";
import { pacificAnnualRanges, buildColumnRanges } from "../util/misPeriods";
import { amountUnitCaption, formatMisValue, misValueTypeForRow } from "../util/misMoney";
import type { MisViewState } from "../util/useMisViewState";
import type { MisScale } from "../util/misViewVocabulary";
import { useMisViewState } from "../util/useMisViewState";
import { useMisScale } from "../util/useMisScale";
import { MIS_PERIODS, MIS_TABLES, MIS_TABLE_LABELS, typeValueOf } from "../util/misViewVocabulary";
import { useCustomerAccounts } from "../api/useCustomerAccounts";
import {
  CUSTOMER_SUB_COLUMNS,
  CUSTOMER_SUB_COLUMN_BY_KEY,
  customerAccountRows,
  customerFigure,
  customerLeadColumns,
  type AccountsResponse,
  type CustomerLeadColumn,
} from "../components/customerAccountRows";
import { useMisAppConfigs } from "../api/useMisAppConfigs";
import MisFilterBar from "../components/MisFilterBar";
import MisTableTabs from "../components/MisTableTabs";

// ARR Build — the annual recurring-revenue Build, on live figures.
//
// This is the slice that proves the fetch-to-render path end to end, so that
// the tables after it are variation rather than invention. Everything on screen
// is assembled from parts that were built and tested on their own:
//
//   the view      `useMisViewState` (02) reads the Period from the route and
//                 everything else from the query string
//   the columns   `pacificAnnualRanges` (05) cuts them in Pacific Time
//   the rows      `arrBuildRows` names them and says which field each reads
//   the figures   `useArrSummary` fetches one column per query
//   the money     `formatMisValue` (05) decides what Scale may touch
//   the table     `BuildTable` (03) renders it
//   the filters   `MisFilterBar` (09) writes every one of them through the
//                 SAME `useMisViewState` instance, so there is one view and not
//                 a bar's copy of it beside the grid's
//
// Windowing is `BuildTable`'s (07). The drill-down dialog is still ticket 10's
// and is not here yet.

export default function MisArrBuildPage() {
  useDocumentTitle("ARR Build");

  return (
    <MisShell
      gateId="mis-arr-build"
      title="ARR Build"
      subtitle="Annual recurring revenue from an opening balance to a closing balance, one column per period."
    >
      <ArrBuild />
    </MisShell>
  );
}

/** Inside the shell, so it is only mounted once the gate has said yes. */
function ArrBuild() {
  const view = useMisViewState(MIS_PERIODS.ANNUALLY, { annualRangesFor: pacificAnnualRanges });
  const scale = useMisScale(view);
  // The menus for the nine list filters. Fetched here rather than inside the
  // bar so the bar stays a function of its props, and so a screen that grows a
  // second filtered surface asks once.
  const configs = useMisAppConfigs();

  return (
    <Box>
      <MisFilterBar
        view={view}
        scale={scale}
        options={configs.options}
        optionsLoading={configs.isLoading}
        // Only when the lists actually FAILED. A bar still loading them says so
        // in the menus themselves, which is not worth a warning above the bar.
        optionsErrorMessage={configs.isError ? configs.errorMessage : ""}
        onRetryOptions={configs.retry}
      />
      <MisTableTabs table={view.table} onChange={(table) => view.setView({ table })} />
      <BuildForTable view={view} scale={scale.scale} />
    </Box>
  );
}

/**
 * Whichever of the four tables the address names.
 *
 * Two of them are not ported yet, and they say so rather than falling through
 * to the Build. The distinction matters and is not pedantry: `region-summary`
 * is a RECOGNISED Table — ticket 02 parses it, and the filter rules already key
 * off it — so showing the Subscription Build instead would hand the reader a
 * different report than the one they asked for, under a heading saying
 * Subscription and an address saying Region Summary. An UNRECOGNISED value is
 * the other case, and that still degrades to the Build, which is 02's contract
 * and its test.
 */
function BuildForTable({ view, scale }: { view: MisViewState; scale: MisScale }) {
  if (view.table === MIS_TABLES.SOFTWARE_CLOUD_CUSTOMERS) {
    return <CustomersGrid view={view} scale={scale} />;
  }
  if (view.table !== MIS_TABLES.SUBSCRIPTION) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        {MIS_TABLE_LABELS[view.table]} has not been ported yet. Choose Subscription or Customers.
      </Typography>
    );
  }
  return <ArrBuildGrid view={view} scale={scale} />;
}

/**
 * The figures, below the bar.
 *
 * Split from the bar's own component so the bar survives every state this part
 * can be in — loading, failed, empty. A reader whose filters returned nothing
 * has to be able to change them, and a bar inside the early return below would
 * have vanished with the grid.
 */
function ArrBuildGrid({ view, scale }: { view: MisViewState; scale: MisScale }) {

  // Drawn from the ranges the URL contract already hydrated into the Applied
  // set, so the columns and the filters cannot disagree about which Periods are
  // on screen. Sliced, because on a Calendar Window this particular table shows
  // one fewer than the Applied set carries — see buildColumnRanges.
  const ranges = useMemo(
    () => buildColumnRanges(view.viewWindow, view.filters),
    [view.viewWindow, view.filters],
  );
  const summary = useArrSummary(ranges, view.filters);

  const rows = useMemo(
    () => arrBuildRows(view.filters.channelDirect),
    [view.filters.channelDirect],
  );
  // Not memoised, deliberately: `summary.columns` is rebuilt on every render,
  // so a useMemo over it would never hit — and babel-plugin-react-compiler
  // already handles what genuinely can be.
  const byColumn = responsesByColumn(summary.columns);
  const cell: BuildCellFor = (row, group) => {
    const field = arrBuildFieldFor(row.id);
    const raw = field ? byColumn.get(group.key)?.[field] : undefined;
    return {
      text: formatMisValue(raw, misValueTypeForRow(row.label), { scale }),
      negative: typeof raw === "number" && raw < 0,
    };
  };

  if (summary.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5, mt: 1.5 }} />;
  }

  // Only when EVERY column failed. One bad column blanks itself and the Build
  // still reads — see useArrSummary.
  if (summary.isError) {
    return (
      <ErrorNotice onRetry={summary.retry} sx={{ mt: 1.5 }}>
        Couldn't load the Build. {summary.errorMessage}
      </ErrorNotice>
    );
  }

  if (!summary.columns.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        No periods to show. Widen Years Back, or choose at least one business unit.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Above the grid rather than beside the control, because Finance's
          workflow is to crop a table into a slide deck: a figure that has left
          the screen it was set on has to carry its own units. */}
      <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {amountUnitCaption(scale)}
        </Typography>
      </Stack>
      <BuildTable
        label="ARR Build — Subscription"
        rowLabelHeader="Summary"
        columnGroups={summary.columns.map(({ label }) => ({ key: label, label }))}
        subColumns={SUB_COLUMNS}
        rows={rows}
        cell={cell}
        // All five open. A Subscription Build IS the summary — there are no
        // customer lines under it to hold back — so opening it collapsed would
        // hide the whole table behind five clicks.
        defaultExpandedIds={ARR_BUILD_SECTION_IDS}
      />
    </Box>
  );
}

/**
 * The Software/Cloud Customers table.
 *
 * The same shell as the Build above — loading, every-column-failed, no columns
 * — over a table that is the Build's opposite shape. There the rows are the
 * fixed metric lines and the figures arrive as columns; here every row is a
 * customer and there are hundreds of them, which is why this is the first
 * screen where `BuildTable`'s row windowing (07) actually runs.
 *
 * Its columns are `buildColumnRanges`, the same slice the Subscription Build
 * takes. The source is confusing here and ticket 10 got it wrong first time
 * round: this table FETCHES `generateFullYearRanges(-yearsBack, 0)` — a year
 * more than Subscription — while its COLUMN definition (`tableUtils.js:1091`)
 * is `-(yearsBack - 1)`, identical to Subscription's. So the source asks for a
 * year it never renders, and reading the fetch as if it were the column list
 * put six Periods on screen where the source shows five.
 */
function CustomersGrid({ view, scale }: { view: MisViewState; scale: MisScale }) {
  const ranges = useMemo(
    () => buildColumnRanges(view.viewWindow, view.filters),
    [view.viewWindow, view.filters],
  );
  const book = useCustomerAccounts(ranges, view.filters);
  // Seventeen identity columns, or eighteen on a Delayed type — the source
  // spreads Delayed Day Count in only there.
  const leadColumns = customerLeadColumns(typeValueOf(view.filters));

  // Not memoised, for the same reason the Build's `byColumn` is not:
  // `book.columns` is rebuilt every render, so a useMemo over it never hits.
  const { rows, accountById } = customerAccountRows(
    book.columns.map((column) => column.accounts ?? []),
  );
  const byColumn = new Map<string, ReadonlyMap<string, AccountsResponse>>(
    book.columns.map((column) => [
      column.label,
      new Map((column.accounts ?? []).map((account) => [account.id, account])),
    ]),
  );

  // The column hands back its own reader — `BuildTable` is generic over the
  // caller's column type, so this is the very object `leadColumns` holds and
  // not a key to look one up by. On a windowed 3,000-row table that is the
  // difference between one call and seventeen comparisons per identity cell.
  const leadCell = (row: { id: string }, column: CustomerLeadColumn) => {
    const account = accountById.get(row.id);
    return account ? column.value(account) : "";
  };

  const cell: BuildCellFor = (row, group, subColumn) => {
    // A Map, not a scan: `BuildTable` takes plain `BuildSubColumn`s, so the
    // figure's own definition has to be found by key, and this table renders
    // twelve of them under every Period.
    const definition = CUSTOMER_SUB_COLUMN_BY_KEY.get(subColumn.key)!;
    const raw = customerFigure(byColumn.get(group.key)?.get(row.id), definition);
    return {
      // Every figure here is currency, so the Scale applies to all of them —
      // unlike the Build, where counts and percentages share the column.
      text: formatMisValue(raw, "currency", { scale }),
      negative: typeof raw === "number" && raw < 0,
      muted: raw === undefined,
    };
  };

  if (book.isLoading) {
    return <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 1.5, mt: 1.5 }} />;
  }

  if (book.isError) {
    return (
      <ErrorNotice onRetry={book.retry} sx={{ mt: 1.5 }}>
        Couldn't load the customers. {book.errorMessage}
      </ErrorNotice>
    );
  }

  if (!book.columns.length || !rows.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        No customers to show. Widen Years Back, or loosen the filters.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "flex-end", mb: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {amountUnitCaption(scale)}
        </Typography>
      </Stack>
      <BuildTable
        label="ARR Build — Software/Cloud Customers"
        rowLabelHeader="Account Name"
        leadColumns={leadColumns}
        leadCell={leadCell}
        columnGroups={book.columns.map(({ label }) => ({ key: label, label }))}
        subColumns={CUSTOMER_SUB_COLUMNS.map(({ key, label }) => ({ key, label, width: 150 }))}
        rows={rows}
        cell={cell}
      />
    </Box>
  );
}

/**
 * One figure per Period, not a pair.
 *
 * `BuildTable` repeats its sub-columns under every Period so that a table can
 * put an Amount beside a % of Opening. The Subscription Build has no such pair:
 * the percentages are rows of their own, further down. So there is one
 * sub-column, and it names what the figure IS — which is worth a line of header
 * given the Period above it only says which dates it covers.
 */
const SUB_COLUMNS = [{ key: "amount", label: "ARR", width: 170 }] as const;

/**
 * A column's header is its identity — no two columns close on the same date —
 * so it is what `BuildTable` groups by and what `cell` looks a figure up with.
 */
const responsesByColumn = (
  columns: readonly ArrSummaryColumn[],
): ReadonlyMap<string, ArrSummaryResponse | undefined> =>
  new Map(columns.map((column) => [column.label, column.response]));
