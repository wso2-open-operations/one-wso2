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
  Alert,
  Box,
  DataGrid,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import { FINANCE_GRID_SX } from "../../util/financeGridSx";
import { isCcBackendConfigured } from "@config/apiConfig";
import FinanceShell from "../../components/FinanceShell";
import { describeError } from "../../util/financeError";
import { bareAmount, daysAgoIso, formatNice } from "../../util/financeFormat";
import { CcTxnDetailsDialog } from "../CcTxnDetailsDialog";
import { ReceiptViewer } from "../../components/ReceiptViewer";
import { StatusChip, ccStatusMeta } from "../../components/FinanceChips";
import { fetchBase64Attachment, type ReceiptSource } from "../../util/financeReceipts";
import { ccServiceUrls } from "@config/apiConfig";
import { useAccessToken } from "@hooks/useAccessToken";
import { useCcTransactions, useCcUserInfo, useCreditCards } from "../useCc";
import { type CcAttachmentType, type CcTransaction, ccHasAccess } from "../ccTypes";
import { CcHistoryFilters, CcHistoryFilterChips } from "../CcHistoryFilterPopover";
import {
  CC_HISTORY_ALL_TIME_DAYS,
  CC_HISTORY_PERIODS,
  ccHistoryActiveFilters,
  ccHistoryCardOptions,
  ccHistoryFieldsShown,
  ccHistoryResetAll,
  type CcHistoryFilterState,
} from "../ccHistoryFilters";
import { EyeIcon, FileTextIcon, ReceiptTextIcon } from "@wso2/oxygen-ui-icons-react";
import { ToolbarWithExport as HistoryToolbar } from "../ccGridToolbar";
import { FINANCE_EYEBROW } from "@constants/financeApps";

// FILTER_ALL in submission-history/index.tsx.
const ALL = "all";

// submission-history/index.tsx uses three distinct placeholders and they are
// not interchangeable: an approver who has not been assigned is a different
// state from a field nobody filled in, and a date that has not happened yet is
// a third. The port had collapsed all of it to "(not provided)".
const NOT_ASSIGNED = "(Not assigned)";   // :281, :289 — approver columns
const NOT_AVAILABLE = "(Not Available)"; // :297 onward — category, units, region
const NO_DATE = "N/A";                   // :348, :357, :366 — the three dates

// :559-571 — ten columns off at the start. `employeeEmail` is not in here: the
// source gates it on the viewer being a lead or finance (:560), so it is set
// per render below.
const HIDDEN_BY_DEFAULT: Record<string, boolean> = {
  financeApproverEmail: false,
  financeApprovedDate: false,
  expenseCategoryLabel: false,
  expenseTypeLabel: false,
  productUnit: false,
  businessUnit: false,
  travelJobNumber: false,
  subRegion: false,
  leadEmail: false,
  leadApprovedDate: false,
};

export default function CcHistoryPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.cc}
      title="Expense Submissions History"
      subtitle="Your past card submissions, filterable by status and period."
      configured={isCcBackendConfigured()}
      configKey="ONE_WSO2_CC_EXPENSES_BACKEND_URL"
      fill
    >
      <HistoryBody />
    </FinanceShell>
  );
}

function HistoryBody() {
  const userInfo = useCcUserInfo();
  // One object rather than five useStates: a chip clears exactly one filter and
  // the Reset button clears them all, so every change is a patch.
  const [filters, setFilters] = useState<CcHistoryFilterState>(ccHistoryResetAll());
  const patch = (p: Partial<CcHistoryFilterState>) => setFilters((prev) => ({ ...prev, ...p }));
  const { status, user, card, lead, days } = filters;
  const [selected, setSelected] = useState<CcTransaction | null>(null);

  const email = userInfo.data?.workEmail;
  const isFinance = ccHasAccess(userInfo.data, "finance");
  const canSeeOthers = ccHasAccess(userInfo.data, "lead") || isFinance;
  const viewer = { canSeeOthers, isFinance };
  // The period control exists only while the status is `submitted`, and its
  // chip is gated on the same rule. Carrying `days` into the query once it is
  // hidden leaves an invisible window narrowing the list with nothing on screen
  // to say so, and nothing to clear it with: pick "Last 30 Days" on Completed,
  // switch to Pending Lead, and older rows silently vanish. `dateFrom` is
  // required by the backend, so the alternative is the whole history, not none.
  const effectiveDays = ccHistoryFieldsShown(filters, viewer).period
    ? days
    : CC_HISTORY_ALL_TIME_DAYS;
  // The same trap as `effectiveDays`, on the other filter that comes and goes.
  // Lead is finance's alone and only while the status could have one, and
  // `ccHistoryActiveFilters` gates its chip on exactly that — so applying
  // `lead` once the control is hidden narrows the list with nothing on screen
  // saying so and nothing to clear it with. Pick a lead on Completed, switch to
  // Pending Lead, and rows belonging to every other lead silently vanish.
  //
  // Gated rather than cleared on the way out, so switching back to Completed
  // returns the lead you had chosen instead of quietly dropping it — which is
  // how the period already behaves.
  const effectiveLead = ccHistoryFieldsShown(filters, viewer).lead ? lead : ALL;
  const txns = useCcTransactions({
    dateFrom: daysAgoIso(effectiveDays),
    includeInactive: true,
  });
  const activeCount = ccHistoryActiveFilters(filters, viewer).length;
  // Named in the empty message, because "nothing here" is a question and the
  // window is usually the answer: the screen opens on Completed transactions
  // from the last seven days, which for most people is genuinely empty.
  // Lower-cased, because it is read mid-sentence — the source hardcodes
  // "No submitted transactions for last 7 days" and this says the same for
  // whichever window is actually in force.
  const periodLabel = (
    CC_HISTORY_PERIODS.find((p) => p.days === effectiveDays)?.label ??
    `last ${effectiveDays} days`
  ).toLowerCase();

  const all = useMemo(() => txns.data ?? [], [txns.data]);

  // :98-113 — the option lists come from what is actually on screen, so they
  // never offer a person or card with nothing to show.
  const users = useMemo(
    () => [...new Set(all.map((t) => t.employeeEmail))].sort(),
    [all],
  );
  // Cards including closed ones, so a transaction on a closed card can say so.
  const cards_all = useCreditCards(true);
  // :200-221 — the options are that person's cards, marked when closed.
  const cards = useMemo(
    () => ccHistoryCardOptions(cards_all.data ?? [], user),
    [cards_all.data, user],
  );
  const leads = useMemo(
    () =>
      [...new Set(all.flatMap((t) => (t.leadEmail ?? "").split(",").map((l) => l.trim())))]
        .filter(Boolean)
        .sort(),
    [all],
  );

  const getAccessToken = useAccessToken();
  // A loader, not a loaded source: ReceiptViewer fetches when it opens, and
  // setState needs the extra arrow or it would treat the thunk as an updater.
  const [load, setLoad] = useState<(() => Promise<ReceiptSource>) | null>(null);
  const cardStatus = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cards_all.data ?? []) m.set(c.ccNumber, c.status ?? "");
    return m;
  }, [cards_all.data]);

  const columns = useMemo<DataGrid.GridColDef<CcTransaction>[]>(() => {
    // A loader, not a loaded source: ReceiptViewer fetches when it opens, and
    // setState needs the extra arrow or it would treat the thunk as an updater.
    const view = (id: number, attachmentType: CcAttachmentType) => {
      setLoad(() => async () =>
        fetchBase64Attachment(ccServiceUrls.attachment(id, attachmentType), await getAccessToken()),
      );
    };
    const dateCol = (field: string, headerName: string): DataGrid.GridColDef<CcTransaction> => ({
      field,
      headerName,
      flex: 0.05,
      align: "center",
      headerAlign: "center",
      // :348 — a date that has not happened reads N/A, not blank.
      renderCell: (p) => (p.value ? formatNice(p.value as string) : NO_DATE),
    });
    const orNotAvailable = (field: string, headerName: string): DataGrid.GridColDef<CcTransaction> => ({
      field,
      headerName,
      flex: 0.05,
      renderCell: (p) => (p.value as string | null) ?? NOT_AVAILABLE,
    });

    return [
      { field: "id", headerName: "ID", flex: 0.05 },
      // :231 — not sortable in the source either.
      { field: "reportSequenceNumber", headerName: "NetSuite Report No.", flex: 0.1, sortable: false },
      { field: "txnDescription", headerName: "Description", flex: 0.1 },
      dateCol("txnDate", "Date"),
      {
        field: "txnAmount",
        headerName: "Amount($)",
        type: "number",
        flex: 0.05,
        // Bare, because the header says ($) — as the source does.
        renderCell: (p) => bareAmount(p.value as number),
      },
      {
        field: "ccNumber",
        headerName: "CC Number",
        flex: 0.05,
        align: "center",
        headerAlign: "center",
        // :262-269 — a transaction on a closed card says so on the row. The
        // port only marked it in the card picker, so history gave no sign.
        renderCell: (p) => {
          const status = cardStatus.get(p.value as string);
          // Normalised, because useCc.ts:76 decides "active" case-insensitively
          // and an exact compare here would mark an "ACTIVE" card inactive.
          const active = (status ?? "").toUpperCase() === "ACTIVE";
          return `${p.value}${status && !active ? " (Inactive)" : ""}`;
        },
      },
      { field: "employeeEmail", headerName: "Submitted User", flex: 0.05 },
      {
        field: "leadEmail",
        headerName: "Lead Approver",
        flex: 0.05,
        renderCell: (p) => (p.value as string | null) ?? NOT_ASSIGNED,
      },
      {
        field: "financeApproverEmail",
        headerName: "Finance Approver",
        flex: 0.05,
        renderCell: (p) => (p.value as string | null) ?? NOT_ASSIGNED,
      },
      orNotAvailable("expenseCategoryLabel", "Expense Category"),
      orNotAvailable("expenseTypeLabel", "Expense Type"),
      orNotAvailable("productUnit", "Product Unit"),
      orNotAvailable("businessUnit", "Business Unit"),
      orNotAvailable("travelJobNumber", "Job Number"),
      orNotAvailable("subRegion", "Sub Region"),
      dateCol("empPostedDate", "Submitted Date"),
      dateCol("leadApprovedDate", "Lead Approved Date"),
      dateCol("financeApprovedDate", "Finance Approved Date"),
      {
        field: "attachments",
        headerName: "Attachments",
        width: 150,
        align: "center",
        headerAlign: "center",
        sortable: false,
        filterable: false,
        // :404-413 — two icons, always both, and the tooltip is what tells you
        // whether there is anything behind them. The port showed a text button
        // per attached file and an em-dash otherwise, so a row with a receipt
        // and no contract said nothing at all about the contract.
        renderCell: (p) => (
          <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ height: "100%" }}>
            <AttachmentIcon
              label="Receipt"
              fileName={p.row.receiptFileName}
              onView={() => view(p.row.id, "receipt")}
            />
            <AttachmentIcon
              label="Contract"
              fileName={p.row.contractFileName}
              onView={() => view(p.row.id, "contract")}
            />
          </Stack>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.05,
        align: "center",
        headerAlign: "center",
        renderCell: (p) => {
          const meta = ccStatusMeta(p.row.status);
          return <StatusChip label={meta.label} color={meta.color} />;
        },
      },
      {
        // :410 — the source's own details column, which is what the dialog is.
        field: "details",
        headerName: "View Details",
        flex: 0.05,
        sortable: false,
        filterable: false,
        align: "right",
        headerAlign: "right",
        // :415-428 — an eye, not the word "Details". The column header already
        // says View Details; repeating it once per row spends the width of a
        // column on a label the reader has read at the top.
        renderCell: (p) => (
          <Tooltip title="View Details">
            <IconButton
              size="small"
              aria-label="view details"
              onClick={() => setSelected(p.row)}
              sx={{ color: "text.secondary" }}
            >
              <EyeIcon size={17} />
            </IconButton>
          </Tooltip>
        ),
      },
    ];
  }, [cardStatus, getAccessToken]);

  /**
   * Every header carries its own full name on hover.
   *
   * Twenty-one columns share the width of the page, so most headers truncate —
   * "NetSuite Report ..." tells nobody anything. The grid only titles a header
   * it has measured as overflowing, which it cannot do for a header it has
   * re-laid-out since; naming every one is both simpler and never wrong.
   */
  const titled = useMemo(
    () =>
      columns.map((c) => ({
        ...c,
        renderHeader: () => (
          <Tooltip title={c.headerName ?? ""}>
            <Box component="span" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.headerName}
            </Box>
          </Tooltip>
        ),
      })),
    [columns],
  );

  const rows = useMemo(() => {
    let list = all;
    if (!canSeeOthers) list = list.filter((t) => t.employeeEmail === email);
    if (status !== "all") list = list.filter((t) => t.status === status);
    if (user !== ALL) list = list.filter((t) => t.employeeEmail === user);
    if (card !== ALL) list = list.filter((t) => t.ccNumber === card);
    // :152 — a card can carry several leads, so match within the list.
    if (effectiveLead !== ALL)
      list = list.filter((t) =>
        (t.leadEmail ?? "").split(",").map((l) => l.trim()).includes(effectiveLead),
      );
    return list;
  }, [all, status, canSeeOthers, email, user, card, effectiveLead]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ mb: 1 }}>
        <CcHistoryFilters
          state={filters}
          viewer={viewer}
          users={users}
          leads={leads}
          cards={cards}
          onChange={patch}
        />
      </Stack>

      {/* :516-549 — the same chips the popover shows, on the page as well, so
          what is narrowing the list is readable without opening anything. */}
      <Box sx={{ mb: 2 }}>
        <CcHistoryFilterChips state={filters} viewer={viewer} onChange={patch} />
      </Box>

      {userInfo.isLoading || txns.isLoading ? (
        <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 1.5 }} />
      ) : userInfo.isError || txns.isError ? (
        <Alert severity="error">Couldn't load history. {describeError(userInfo.error ?? txns.error)}</Alert>
      ) : (
        // `minHeight` as well as `flex`, so the grid always has a height to
        // lay itself out in. `flex: 1` alone depends on every ancestor up to
        // the shell passing one down; anywhere that chain is absent the box
        // collapses to nothing and the grid renders no toolbar, no headers and
        // no rows — silently, because zero height is not an error.
        <Box sx={{ flex: 1, minHeight: 420, width: "100%" }}>
          {/*
            The source's own grid, column for column (submission-history
            /index.tsx:221-415). It defines twenty-one and hides ten by
            default (:557-572), so the reader opens on a short table and
            reaches the rest through the column picker.

            The toolbar is the source's, assembled from the v6-era
            GridToolbar* components that still ship: Columns, Density and
            Export with their names beside them, and the search box.
          */}
          <DataGrid.DataGrid
            rows={rows}
            columns={titled}
            // :43-61 — Columns, Density and Export with their names beside
            // them, and the search box. `showToolbar` gives bare icons and a
            // Filters button the source does not have.
            slots={{
              toolbar: HistoryToolbar,
              noRowsOverlay: () => <NoRows filtered={activeCount > 0} period={periodLabel} />,
            }}
            showToolbar
            density="compact"
            disableRowSelectionOnClick
            initialState={{
              columns: {
                // :560 — Submitted User only for someone who can see other
                // people's spend. For everyone else the list is their own
                // already, so the column would repeat the same address on
                // every row.
                columnVisibilityModel: { ...HIDDEN_BY_DEFAULT, employeeEmail: canSeeOthers },
              },
              pagination: { paginationModel: { pageSize: 20, page: 0 } },
            }}
            pageSizeOptions={[5, 10, 20, 25, 50]}
            sx={FINANCE_GRID_SX}
          />
        </Box>
      )}

      <CcTxnDetailsDialog txn={selected} onClose={() => setSelected(null)} />
      <ReceiptViewer title="Attachment" load={load} onClose={() => setLoad(null)} />
    </Box>
  );
}

/**
 * What an empty grid says — `CustomNoRowsOverlay`, index.tsx:432-450.
 *
 * The source distinguishes two cases and the difference is the whole point:
 * "nothing matched" is the reader's own filters talking and is fixed by
 * widening them, where an empty queue is simply an empty queue. Collapsing both
 * into one line, as the port did, sends someone hunting for missing data that
 * was never missing.
 */
function NoRows({ filtered, period }: { filtered: boolean; period: string }) {
  return (
    <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", p: 2 }}>
      <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
        {filtered
          ? "No transactions match the selected filters"
          : `No submitted transactions for ${period}`}
      </Typography>
    </Stack>
  );
}

/**
 * One attachment, as an icon whose tooltip says whether it is there.
 *
 * `AttachmentButton.tsx:294-336` in its `isOnlyIcon` form: the button is
 * disabled when there is no file, and the `Tooltip` wraps a `<span>` so it
 * still opens on hover — a disabled button swallows pointer events, and the
 * tooltip is the only thing that distinguishes "no receipt" from "a receipt you
 * cannot click".
 */
function AttachmentIcon({
  label,
  fileName,
  onView,
}: {
  label: string;
  fileName: string | null;
  onView: () => void;
}) {
  const has = Boolean(fileName);
  return (
    <Tooltip title={has ? `View ${label}` : `No ${label}`}>
      <span>
        <IconButton
          size="small"
          aria-label={`${label.toLowerCase()}-attachment`}
          disabled={!has}
          onClick={onView}
          sx={{ color: has ? "primary.main" : "text.disabled" }}
        >
          {label === "Receipt" ? <ReceiptTextIcon size={16} /> : <FileTextIcon size={16} />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
