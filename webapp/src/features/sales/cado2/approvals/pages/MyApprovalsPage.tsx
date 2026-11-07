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

import { Fragment, useState, type JSX, type ReactNode } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router";
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { SearchIcon, ShieldCheckIcon } from "@wso2/oxygen-ui-icons-react";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import SortableHead from "@features/sales/cado2/components/list-table/SortableHead";
import BranchRow from "@features/sales/cado2/components/list-table/BranchRow";
import LayoutControls from "@features/sales/cado2/components/list-table/LayoutControls";
import {
  LIST_CELL,
  layoutFrom,
  storeLayout,
  type ListColumn,
  type ListLayout,
} from "@features/sales/cado2/components/list-table/listTable";
import SlaChip from "@features/sales/cado2/approvals/components/SlaChip";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { Choice } from "@features/sales/cado2/insights/components/ReportFilterBar";
import { useApprovalInbox } from "@features/sales/cado2/approvals/api/useApprovalApi";
import type { ApprovalInboxItem } from "@features/sales/cado2/approvals/api/approvalTypes";
import {
  DEADLINE_FILTERS,
  DEFAULT_INBOX_SORT,
  filterByDeadline,
  groupInbox,
  searchInbox,
  sortInbox,
  type DeadlineFilter,
  type InboxSort,
  type InboxSortKey,
} from "@features/sales/cado2/approvals/model/inboxList";
import { changedAgo } from "@features/sales/cado2/quotes/list/quoteListModel";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import { formatMoney } from "@features/sales/cado2/utils/money";

/** The last layout chosen, for next time. */
const LAYOUT_KEY = "cado2.approvals.layout";

type Column = ListColumn<InboxSortKey>;

/** "2 d", "5 min", "just now", or the date a week or more back. */
function waited(iso: string, now: Date): string {
  const ago = changedAgo(iso, now);
  return ago.endsWith(" ago") ? ago.slice(0, -4) : ago;
}

/** The quote's page, with a back link to My Approvals. */
const quotePath = (it: ApprovalInboxItem) => cado2Paths.quote(it.quoteId, "quote", true);

/** The quote's number (and its version past v1), a link to its page. */
function QuoteCell({ it, indent = false }: { it: ApprovalInboxItem; indent?: boolean }): JSX.Element {
  return (
    <TableCell sx={indent ? { pl: "56px !important" } : undefined}>
      <Stack direction="row" spacing={0.75} alignItems="baseline">
        <Link
          component={RouterLink}
          to={quotePath(it)}
          underline="hover"
          color="inherit"
          onClick={(e) => e.stopPropagation()}
          sx={{ fontWeight: 600, fontFamily: "monospace", whiteSpace: "nowrap" }}
        >
          {it.quoteNumber}
        </Link>
        {it.versionNumber > 1 ? (
          <Typography variant="caption" color="text.secondary">
            v{it.versionNumber}
          </Typography>
        ) : null}
      </Stack>
    </TableCell>
  );
}

/** A step's row; clicking anywhere on it opens the quote. */
function InboxRow({ it, now, cells }: { it: ApprovalInboxItem; now: Date; cells: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  return (
    <TableRow hover onClick={() => navigate(quotePath(it))} sx={{ cursor: "pointer", "& td": LIST_CELL }}>
      {cells}
      <TableCell>
        <StatusChip color="primary" label={it.roleLabel} />
      </TableCell>
      <TableCell sx={{ color: "text.secondary", maxWidth: 220 }}>
        <Typography variant="body2" noWrap>
          {it.submittedByEmail ?? "—"}
        </Typography>
      </TableCell>
      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {it.currencyIsoCode ? `${it.currencyIsoCode} ${formatMoney(it.tcv)}` : formatMoney(it.tcv)}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {it.slaState && it.dueAt ? <SlaChip state={it.slaState} dueAt={it.dueAt} now={now} /> : "—"}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
        {it.requestedAt ? waited(it.requestedAt, now) : "—"}
      </TableCell>
    </TableRow>
  );
}

/** The columns after the ones a layout puts first. */
const STEP_COLUMNS: readonly Column[] = [
  { label: "Approving as", sort: "role" },
  { label: "Submitted by", sort: "submitter" },
  { label: "Value (TCV)", sort: "value", align: "right" },
  { label: "Deadline", sort: "deadline" },
  { label: "Waiting", sort: "waiting" },
];

interface LayoutProps {
  readonly rows: readonly ApprovalInboxItem[];
  readonly now: Date;
  readonly sort: InboxSort;
  readonly onSort: (s: InboxSort) => void;
}

/** List layout: one compact row per step. */
function InboxList({ rows, now, sort, onSort }: LayoutProps): JSX.Element {
  const columns: Column[] = [
    { label: "Quote", sort: "quote" },
    { label: "Account", sort: "account" },
    { label: "Opportunity", sort: "opportunity" },
    ...STEP_COLUMNS,
  ];
  return (
    <Table size="small" aria-label="Waiting for your approval">
      <SortableHead columns={columns} sort={sort} onSort={onSort} />
      <TableBody>
        {rows.map((it) => (
          <InboxRow
            key={it.stepId}
            it={it}
            now={now}
            cells={
              <>
                <QuoteCell it={it} />
                <TableCell sx={{ maxWidth: 240 }}>
                  <Typography variant="body2" noWrap>
                    {it.accountName ?? "No account"}
                  </Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {it.opportunityName ?? "No opportunity"}
                  </Typography>
                </TableCell>
              </>
            }
          />
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Tree layout: account › opportunity › quote, each branch collapsible. A
 * search opens every branch with a match. The rows arrive sorted, so the
 * branches follow the sort too. Nothing is added up (as D70).
 */
function InboxTree({
  rows,
  now,
  sort,
  onSort,
  collapsed,
  toggle,
  searching,
}: LayoutProps & { collapsed: ReadonlySet<string>; toggle: (key: string) => void; searching: boolean }): JSX.Element {
  const columns: Column[] = [{ label: "Quote", sort: "quote" }, ...STEP_COLUMNS];
  const span = columns.length;
  const isOpen = (key: string) => searching || !collapsed.has(key);
  return (
    <Table size="small" aria-label="Waiting for your approval, by account and opportunity">
      <SortableHead columns={columns} sort={sort} onSort={onSort} />
      <TableBody>
        {groupInbox(rows).map((a) => (
          <Fragment key={a.accountId}>
            <BranchRow depth={0} open={isOpen(a.accountId)} onToggle={() => toggle(a.accountId)} title={a.accountName} span={span} />
            {isOpen(a.accountId)
              ? a.opportunities.map((o) => {
                  const key = `${a.accountId}/${o.opportunityId}`;
                  return (
                    <Fragment key={key}>
                      <BranchRow depth={1} open={isOpen(key)} onToggle={() => toggle(key)} title={o.opportunityName} span={span} />
                      {isOpen(key)
                        ? o.items.map((it) => <InboxRow key={it.stepId} it={it} now={now} cells={<QuoteCell it={it} indent />} />)
                        : null}
                    </Fragment>
                  );
                })
              : null}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * My Approvals: the steps whose turn it is, for every approval role the
 * caller holds. Any member of the role's group may act; quotes the caller
 * submitted are left out, because they can't approve their own.
 *
 * Laid out like the Quotes list (D144): one card whose toolbar has the
 * count, the deadline filter, search and the List / Tree icons; every column
 * sorts, most urgent first by default. Searched, filtered, sorted and grouped
 * in the browser. The layout is in the URL and remembered.
 */
export default function MyApprovalsPage(): JSX.Element {
  const inbox = useApprovalInbox();
  useDocumentTitle("My Approvals");
  const [params, setParams] = useSearchParams();
  const layout = layoutFrom(params.get("layout"), LAYOUT_KEY);
  const [search, setSearch] = useState("");
  const [deadline, setDeadline] = useState<DeadlineFilter>("ALL");
  const [sort, setSort] = useState<InboxSort>(DEFAULT_INBOX_SORT);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const now = new Date();

  const items = inbox.data ?? [];
  const shown = sortInbox(filterByDeadline(searchInbox(items, search), deadline), sort);
  const searching = search.trim() !== "";
  const accountIds = [...new Set(shown.map((it) => it.sfAccountId))];
  const allCollapsed = accountIds.length > 0 && accountIds.every((id) => collapsed.has(id));
  const toggleBranch = (key: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const setLayout = (v: ListLayout) => {
    storeLayout(LAYOUT_KEY, v);
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        next.set("layout", v);
        return next;
      },
      { replace: true },
    );
  };
  const clearFilters = () => {
    setSearch("");
    setDeadline("ALL");
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 1400 }}>
      {/* No role or region chips beside the title (2026-11-07: they meant nothing to readers). */}
      <PageHeader title="My Approvals" />
      {inbox.isPending ? (
        // A list loads as skeleton rows, like the Quotes list (2026-10-13).
        <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }} aria-label="Loading your approvals">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={36} sx={{ my: 1 }} />
          ))}
        </Paper>
      ) : inbox.error ? (
        <ErrorNotice error={inbox.error} onRetry={() => void inbox.refetch()} retrying={inbox.isFetching}>
          Couldn&apos;t load your approvals.
        </ErrorNotice>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldCheckIcon size={26} />}
          title="Nothing is waiting for you"
          body="Quotes appear here when it is your role's turn to approve them."
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Stack
            direction="row"
            alignItems="center"
            useFlexGap
            sx={{ px: 2, py: 1.25, columnGap: 2, rowGap: 1.25, flexWrap: "wrap", borderBottom: 1, borderColor: "divider" }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Waiting for you
              </Typography>
              <Chip size="small" color="primary" label={items.length} sx={{ height: 20, fontWeight: 600 }} />
            </Stack>
            <Choice label="Deadline" value={deadline} options={DEADLINE_FILTERS} onChange={setDeadline} width={150} />
            {/* Wide: on the right. Narrow: its own line, full width. */}
            <TextField
              size="small"
              placeholder="Search quote, account, opportunity or submitter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ order: { xs: 3, md: 0 }, ml: { md: "auto" }, width: { xs: "100%", md: 360 } }}
              slotProps={{
                htmlInput: { "aria-label": "Search approvals" },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon size={16} />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Box sx={{ ml: { xs: "auto", md: 0 } }}>
              <LayoutControls
                layout={layout}
                onLayout={setLayout}
                treeLabel="account › opportunity › quote"
                allCollapsed={allCollapsed}
                onCollapseAll={(collapse) => setCollapsed(collapse ? new Set(accountIds) : new Set())}
              />
            </Box>
          </Stack>

          {shown.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<SearchIcon size={28} />}
                title="No approvals match"
                body="Try another search or deadline."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            </Box>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              {layout === "tree" ? (
                <InboxTree
                  rows={shown}
                  now={now}
                  sort={sort}
                  onSort={setSort}
                  collapsed={collapsed}
                  toggle={toggleBranch}
                  searching={searching}
                />
              ) : (
                <InboxList rows={shown} now={now} sort={sort} onSort={setSort} />
              )}
            </Box>
          )}
        </Paper>
      )}
    </Stack>
  );
}
