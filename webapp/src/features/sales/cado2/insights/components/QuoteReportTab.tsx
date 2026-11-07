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

import { useCallback, useState, type JSX, type ReactNode } from "react";
import {
  Button,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from "@wso2/oxygen-ui";
import { DownloadIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import { useCado2Toast } from "@features/sales/cado2/components/toast/toastContext";
import { STATUS_COLOR, STATUS_LABEL } from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { useQuoteReport, useReportExportFetch } from "../api/useInsights";
import type { QuoteReport, ReportFilters, ReportRow, ReportSort } from "../api/insightsTypes";
import { dealLabel } from "../utils/reportFilters";
import { EXPORT_MAX_ROWS, saveReport } from "../utils/reportExport";
import ReportFilterBar from "./ReportFilterBar";
import QuoteSummaryPanel, { PANEL_WIDTH } from "./QuoteSummaryPanel";
import MoneyNote from "./MoneyNote";

const PAGE_SIZE = 50;


/**
 * The Quote Report (D106): every quote (its latest version), filtered, in
 * pages, with every matching row exportable to CSV or Excel.
 */
export default function QuoteReportTab({
  filters,
  onChange,
}: {
  readonly filters: ReportFilters;
  readonly onChange: (patch: Partial<ReportFilters>) => void;
}): JSX.Element {
  const report = useQuoteReport(filters, PAGE_SIZE);
  // The quote open in the side panel; another row switches it.
  const [selected, setSelected] = useState<number | null>(null);
  const close = useCallback(() => setSelected(null), []);
  // Any filter change goes back to page 1.
  const change = (patch: Partial<ReportFilters>) => onChange({ page: 1, ...patch });

  return (
    // Room for the panel on wide screens, so it doesn't cover the results.
    <Stack spacing={2} sx={{ pr: { lg: selected !== null ? `${PANEL_WIDTH}px` : 0 }, transition: "padding 150ms" }}>
      <ReportFilterBar
        filters={filters}
        onChange={change}
        actions={<ExportButton filters={filters} total={report.data?.total ?? 0} disabled={!report.data || report.data.total === 0} />}
      />
      {report.error ? (
        <ErrorNotice error={report.error} onRetry={() => void report.refetch()} retrying={report.isFetching}>
          Couldn&apos;t load the report.
        </ErrorNotice>
      ) : report.isPending ? (
        <Skeleton variant="rounded" height={360} aria-label="Loading the report" />
      ) : (
        <ReportTable report={report.data} filters={filters} onChange={onChange} selected={selected} onSelect={setSelected} />
      )}
      <QuoteSummaryPanel quoteId={selected} onClose={close} />
    </Stack>
  );
}

const SORTABLE: Partial<Record<string, ReportSort>> = {
  account: "ACCOUNT",
  value: "VALUE",
  created: "CREATED",
  submitted: "SUBMITTED",
  approved: "APPROVED",
  days: "DAYS_IN_APPROVAL",
};

function ReportTable({
  report,
  filters,
  onChange,
  selected,
  onSelect,
}: {
  readonly report: QuoteReport;
  readonly filters: ReportFilters;
  readonly onChange: (patch: Partial<ReportFilters>) => void;
  readonly selected: number | null;
  readonly onSelect: (quoteId: number) => void;
}): JSX.Element {
  const cur = report.currency;
  // One date column: the date the period applies to (Submitted by default).
  const dateKey = ({ CREATED: "created", SUBMITTED: "submitted", APPROVED: "approved" } as const)[filters.dateField];
  const dateHeading = ({ CREATED: "Created", SUBMITTED: "Submitted", APPROVED: "Approved" } as const)[filters.dateField];
  const header = (key: string, label: string, align?: "right") => {
    const sort = SORTABLE[key];
    if (!sort) return <TableCell align={align}>{label}</TableCell>;
    const active = filters.sort === sort;
    return (
      <TableCell align={align} sortDirection={active ? filters.order : false} sx={{ whiteSpace: "nowrap" }}>
        <TableSortLabel
          active={active}
          direction={active ? filters.order : "desc"}
          onClick={() =>
            onChange({ sort, order: active && filters.order === "desc" ? "asc" : "desc", page: 1 })
          }
        >
          {label}
        </TableSortLabel>
      </TableCell>
    );
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ flexGrow: 1 }}>
          <strong>{report.total.toLocaleString("en-US")}</strong> {report.total === 1 ? "quote" : "quotes"}
          {report.truncated ? " (only the newest 20,000 read: narrow the filters)" : ""}
        </Typography>
      </Stack>

      <Paper variant="outlined" sx={{ overflowX: "auto", borderRadius: 3 }}>
        <Table size="small" aria-label="Quote report">
          <TableHead>
            <TableRow>
              <TableCell>Quote</TableCell>
              {header("account", "Account")}
              <TableCell>Status</TableCell>
              <TableCell>Deal</TableCell>
              {header("value", `TCV (${cur})`, "right")}
              {header(dateKey, dateHeading)}
              {header("days", "Days in approval", "right")}
            </TableRow>
          </TableHead>
          <TableBody>
            {report.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                    No quotes match these filters.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              report.rows.map((r) => (
                <Row key={r.quoteId} r={r} dateField={filters.dateField} selected={selected === r.quoteId} onSelect={onSelect} />
              ))
            )}
          </TableBody>
        </Table>
      </Paper>
      <TablePagination
        component="div"
        count={report.total}
        page={report.page - 1}
        rowsPerPage={PAGE_SIZE}
        rowsPerPageOptions={[PAGE_SIZE]}
        onPageChange={(_, page) => onChange({ page: page + 1 })}
      />
      <MoneyNote meta={report} />
    </Stack>
  );
}

/** A secondary line under a cell's main value. */
function Sub({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <Typography variant="caption" color="text.secondary" component="div" noWrap>
      {children}
    </Typography>
  );
}

function Row({
  r,
  dateField,
  selected,
  onSelect,
}: {
  r: ReportRow;
  dateField: ReportFilters["dateField"];
  selected: boolean;
  onSelect: (quoteId: number) => void;
}): JSX.Element {
  const nowrap = { whiteSpace: "nowrap" } as const;
  const num = { whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" } as const;
  const shownDate = { CREATED: r.createdAt, SUBMITTED: r.submittedAt, APPROVED: r.approvedAt }[dateField];
  const channel = r.channel === "PARTNER" ? "Partner" : r.channel === "DIRECT" ? "Direct" : null;
  return (
    <TableRow
      hover
      selected={selected}
      onClick={() => onSelect(r.quoteId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(r.quoteId);
        }
      }}
      tabIndex={0}
      aria-label={`Show ${r.quoteNumber ?? `quote ${r.quoteId}`} in the side panel`}
      sx={{ cursor: "pointer" }}
    >
      <TableCell sx={nowrap}>
        {/* Plain text: the row opens the side panel; "Open full quote" is there. */}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {r.quoteNumber ?? `Quote ${r.quoteId}`}
        </Typography>
        {r.versionNumber > 1 ? <Sub>Version {r.versionNumber}</Sub> : null}
      </TableCell>
      <TableCell sx={{ maxWidth: 260 }}>
        <Typography variant="body2" noWrap title={r.accountName ?? undefined}>
          {r.accountName ?? "—"}
        </Typography>
        {r.opportunityName ? <Sub>{r.opportunityName}</Sub> : null}
      </TableCell>
      <TableCell sx={nowrap}>
        <StatusChip color={STATUS_COLOR[r.status]} label={STATUS_LABEL[r.status]} />
        {r.waitingOn.length ? <Sub>Waiting on {r.waitingOn.join(", ")}</Sub> : null}
      </TableCell>
      <TableCell sx={nowrap}>
        <Typography variant="body2">{dealLabel(r)}</Typography>
        <Sub>{[r.region, channel].filter(Boolean).join(" · ") || "—"}</Sub>
      </TableCell>
      <TableCell align="right" sx={{ ...num, fontWeight: 600 }}>
        <span title={`${r.currency ?? ""} ${formatMoney(r.tcv)}`}>{formatMoney(r.tcvConverted)}</span>
      </TableCell>
      <TableCell sx={nowrap}>{shownDate ? formatDate(shownDate.slice(0, 10)) : "—"}</TableCell>
      <TableCell align="right" sx={num}>
        {r.daysInApproval ?? "—"}
      </TableCell>
    </TableRow>
  );
}

/** Export every matching row (up to the cap) to CSV or Excel. */
function ExportButton({
  filters,
  total,
  disabled,
}: {
  readonly filters: ReportFilters;
  readonly total: number;
  readonly disabled: boolean;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const fetchAll = useReportExportFetch();
  const notify = useCado2Toast();

  const run = async (format: "csv" | "xlsx") => {
    setAnchor(null);
    setBusy(true);
    try {
      const all = await fetchAll(filters, EXPORT_MAX_ROWS);
      const asOf = all.ratesAsOf ? ` of ${formatDate(all.ratesAsOf.slice(0, 10))}` : "";
      const note = all.ratesAvailable
        ? `Amounts in ${all.currency} at Salesforce's exchange rates${asOf}, on the day each quote was submitted.`
        : "Salesforce's exchange rates couldn't be read: converted amounts are empty.";
      await saveReport(all.rows, all.currency, note, format);
      notify(
        total > all.rows.length
          ? `Exported the first ${all.rows.length.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} quotes`
          : `Exported ${all.rows.length.toLocaleString("en-US")} quotes`,
      );
    } catch {
      notify("Couldn't export the report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="inherit"
        startIcon={<DownloadIcon size={16} />}
        disabled={disabled || busy}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        sx={{ height: 40, textTransform: "none", fontWeight: 600, bgcolor: "text.primary", color: "background.paper", "&:hover": { bgcolor: "text.primary" } }}
      >
        {busy ? "Exporting…" : "Export"}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => void run("xlsx")}>Excel (.xlsx)</MenuItem>
        <MenuItem onClick={() => void run("csv")}>CSV (.csv)</MenuItem>
      </Menu>
    </>
  );
}
