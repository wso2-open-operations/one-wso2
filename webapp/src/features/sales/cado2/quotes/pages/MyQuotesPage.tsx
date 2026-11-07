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
  CircularProgress,
  Dialog,
  DialogContent,
  InputAdornment,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import {
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import EmptyState from "@features/sales/cado2/components/empty-state/EmptyState";
import PageHeader from "@features/sales/cado2/components/page-header/PageHeader";
import { useDocumentTitle } from "@hooks/useDocumentTitle";
import {
  useQuoteList,
  useQuoteVersion,
} from "@features/sales/cado2/quotes/api/useQuoteApi";
import DeleteDraftDialog from "@features/sales/cado2/quotes/components/detail/DeleteDraftDialog";
import PrimaryDialog from "@features/sales/cado2/quotes/components/detail/PrimaryDialog";
import QuoteActionsMenu from "@features/sales/cado2/quotes/components/detail/QuoteActionsMenu";
import StatusChip from "@features/sales/cado2/components/status-chip/StatusChip";
import PrimaryStar from "@features/sales/cado2/components/primary-star/PrimaryStar";
import type {
  QuoteListItem,
  QuoteScope,
} from "@features/sales/cado2/quotes/api/quoteTypes";
import {
  STATUS_COLOR,
  quoteLabel,
  quoteStatusLabel,
} from "@features/sales/cado2/quotes/lifecycle/lifecycle";
import { formatDate } from "@features/sales/cado2/quotes/form/draftForm";
import {
  DEFAULT_SORT,
  changedAgo,
  filterQuotes,
  groupQuotes,
  sortQuotes,
  type QuoteLayout,
  type QuoteSort,
  type QuoteSortKey,
} from "@features/sales/cado2/quotes/list/quoteListModel";
import { cado2Paths } from "@features/sales/cado2/cado2Paths";
import SortableHead from "@features/sales/cado2/components/list-table/SortableHead";
import BranchRow from "@features/sales/cado2/components/list-table/BranchRow";
import LayoutControls from "@features/sales/cado2/components/list-table/LayoutControls";
import {
  LIST_CELL,
  layoutFrom,
  storeLayout,
  type ListColumn,
} from "@features/sales/cado2/components/list-table/listTable";
import { cado2Access, useCado2Me } from "@features/sales/cado2/api/useCado2Me";

/** The last layout chosen, for next time. */
const LAYOUT_KEY = "cado2.quotes.layout";

const CELL = LIST_CELL;
const day = (iso: string) => formatDate(iso.slice(0, 10));

/**
 * A row's actions, behind "⋯" so a destructive one isn't a click away from
 * opening the quote: Make primary / Remove primary (D68) and Delete draft,
 * for whoever may change the quote (D69). The quote page's menu component
 * (same icons, order and red destructive part, 2026-10-13), with a smaller
 * set on purpose: Recall, Revise and Close quote are done on the quote page.
 * Rendered only when `q.canEdit`, so "Draft" here is the quote page's
 * "Draft and CLOSE allowed".
 */
function RowMenu({ q }: { q: QuoteListItem }): JSX.Element {
  const [deleting, setDeleting] = useState(false);
  const [primary, setPrimary] = useState(false);
  return (
    <>
      <QuoteActionsMenu
        inRow
        label={`Actions for ${quoteLabel(q.quoteNumber, q.accountName, q.opportunityName)}`}
        actions={[
          { label: q.isPrimary ? "Remove primary" : "Make primary", icon: <StarIcon size={16} />, onClick: () => setPrimary(true) },
        ]}
        destructive={
          q.status === "DRAFT" ? [{ label: "Delete draft", icon: <Trash2Icon size={16} />, onClick: () => setDeleting(true) }] : []
        }
      />
      {deleting ? (
        <DeleteFromList q={q} onClose={() => setDeleting(false)} />
      ) : null}
      {primary ? (
        <PrimaryDialog
          quoteId={q.id}
          opportunityId={q.sfOpportunityId}
          isPrimary={q.isPrimary}
          onClose={() => setPrimary(false)}
        />
      ) : null}
    </>
  );
}

/**
 * The list doesn't carry what the confirmation needs (the draft's exact save
 * time, the version before it), so the draft is loaded first.
 */
function DeleteFromList({
  q,
  onClose,
}: {
  q: QuoteListItem;
  onClose: () => void;
}): JSX.Element {
  const version = useQuoteVersion(q.id, q.versionNumber);
  if (version.data) {
    return (
      <DeleteDraftDialog
        quote={version.data.quote}
        name={quoteLabel(
          version.data.quote.quoteNumber,
          version.data.version.accountName,
          version.data.version.opportunityName,
        )}
        versionNumber={version.data.version.versionNumber}
        updatedAt={version.data.version.updatedAt}
        onClose={onClose}
        onDeleted={onClose}
      />
    );
  }
  return (
    <Dialog open onClose={onClose} aria-label="Loading the draft">
      <DialogContent>
        {version.error ? (
          <ErrorNotice
            error={version.error}
            onRetry={() => void version.refetch()}
            retrying={version.isFetching}
          >
            Couldn&apos;t load the draft.
          </ErrorNotice>
        ) : (
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading the draft…</Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The quote's number (★ if primary), a link to its page. Every quote has one since D71. */
function QuoteCell({ q }: { q: QuoteListItem }): JSX.Element {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      {q.isPrimary ? (
        <Tooltip title="Primary quote">
          <Box component="span" sx={{ display: "inline-flex" }}>
            <PrimaryStar />
          </Box>
        </Tooltip>
      ) : (
        <Box component="span" sx={{ width: 14 }} />
      )}
      <Link
        component={RouterLink}
        to={cado2Paths.quote(q.id)}
        underline="hover"
        color="inherit"
        onClick={(e) => e.stopPropagation()}
        sx={{
          fontWeight: 600,
          fontFamily: q.quoteNumber ? "monospace" : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {q.quoteNumber ?? "—"}
      </Link>
    </Stack>
  );
}

function StatusCell({ q }: { q: QuoteListItem }): JSX.Element {
  return (
    <StatusChip
      color={STATUS_COLOR[q.status]}
      label={quoteStatusLabel(q.status, q.versionNumber)}
    />
  );
}

/** A column: its header, and the key it sorts on (D70). */
type Column = ListColumn<QuoteSortKey>;

/** A quote's row; clicking anywhere on it opens the quote. */
function QuoteTableRow({
  q,
  now,
  cells,
}: {
  q: QuoteListItem;
  now: Date;
  cells: ReactNode;
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <TableRow
      hover
      onClick={() => navigate(cado2Paths.quote(q.id))}
      sx={{ cursor: "pointer", "& td": CELL }}
    >
      {cells}
      <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
        {day(q.createdAt)}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>
        {changedAgo(q.updatedAt, now)}
      </TableCell>
      <TableCell align="right" sx={{ width: 48 }}>
        {q.canEdit ? <RowMenu q={q} /> : null}
      </TableCell>
    </TableRow>
  );
}

function OwnerCell({ q }: { q: QuoteListItem }): JSX.Element {
  return (
    <TableCell sx={{ color: "text.secondary", maxWidth: 220 }}>
      <Typography variant="body2" noWrap>
        {q.ownerEmail}
      </Typography>
    </TableCell>
  );
}

const DATES: readonly Column[] = [
  { label: "Created", sort: "created" },
  { label: "Updated", sort: "updated" },
];

interface LayoutProps {
  readonly rows: readonly QuoteListItem[];
  readonly now: Date;
  readonly showOwner: boolean;
  readonly sort: QuoteSort;
  readonly onSort: (s: QuoteSort) => void;
}

/** List layout: one compact row per quote. */
function ListLayout({
  rows,
  now,
  showOwner,
  sort,
  onSort,
}: LayoutProps): JSX.Element {
  const columns: Column[] = [
    { label: "Quote", sort: "quote" },
    { label: "Account", sort: "account" },
    { label: "Opportunity", sort: "opportunity" },
    { label: "Status", sort: "status" },
    ...(showOwner ? [{ label: "Owner", sort: "owner" as const }] : []),
    ...DATES,
  ];
  return (
    <Table size="small" aria-label="Quotes">
      <SortableHead columns={columns} sort={sort} onSort={onSort} actionsColumn />
      <TableBody>
        {rows.map((q) => (
          <QuoteTableRow
            key={q.id}
            q={q}
            now={now}
            cells={
              <>
                <TableCell>
                  <QuoteCell q={q} />
                </TableCell>
                <TableCell sx={{ maxWidth: 240 }}>
                  <Typography variant="body2" noWrap>
                    {q.accountName ?? "No account"}
                  </Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 280 }}>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {q.opportunityName ?? "No opportunity"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusCell q={q} />
                </TableCell>
                {showOwner ? <OwnerCell q={q} /> : null}
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
 * search opens every branch with a match. The rows arrive sorted, so branches
 * follow the sort too. Organises rows only; nothing is added up (D70).
 */
function TreeLayout({
  rows,
  now,
  showOwner,
  sort,
  onSort,
  collapsed,
  toggle,
  searching,
}: LayoutProps & {
  collapsed: ReadonlySet<string>;
  toggle: (key: string) => void;
  searching: boolean;
}): JSX.Element {
  const columns: Column[] = [
    { label: "Quote", sort: "quote" },
    { label: "Status", sort: "status" },
    ...(showOwner ? [{ label: "Owner", sort: "owner" as const }] : []),
    ...DATES,
  ];
  const span = columns.length + 1;
  const isOpen = (key: string) => searching || !collapsed.has(key);
  // Plain render helpers, not components: a component declared here would be a
  // new type on every render, remounting the rows and closing an open menu.
  const quoteRow = (q: QuoteListItem) => (
    <QuoteTableRow
      key={q.id}
      q={q}
      now={now}
      cells={
        <>
          <TableCell sx={{ pl: "56px !important" }}>
            <QuoteCell q={q} />
          </TableCell>
          <TableCell>
            <StatusCell q={q} />
          </TableCell>
          {showOwner ? <OwnerCell q={q} /> : null}
        </>
      }
    />
  );
  return (
    <Table size="small" aria-label="Quotes by account and opportunity">
      <SortableHead columns={columns} sort={sort} onSort={onSort} actionsColumn />
      <TableBody>
        {groupQuotes(rows).map((a) => (
          <Fragment key={a.accountId}>
            <BranchRow
              depth={0}
              open={isOpen(a.accountId)}
              onToggle={() => toggle(a.accountId)}
              title={a.accountName}
              span={span}
            />
            {isOpen(a.accountId)
              ? a.opportunities.map((o) => {
                  const key = `${a.accountId}/${o.opportunityId}`;
                  return (
                    <Fragment key={key}>
                      <BranchRow
                        depth={1}
                        open={isOpen(key)}
                        onToggle={() => toggle(key)}
                        title={o.opportunityName}
                        detail={
                          o.primary
                            ? `★ ${o.primary.quoteNumber ?? "A draft"} is primary`
                            : undefined
                        }
                        span={span}
                      />
                      {isOpen(key) ? o.quotes.map(quoteRow) : null}
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

/** A tab's label: icon, name and its count as a badge. */
function ScopeLabel({ icon, label, count, on }: { icon: ReactNode; label: string; count?: number; on: boolean }): JSX.Element {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {icon}
      <span>{label}</span>
      {count !== undefined ? (
        <Chip size="small" label={count} color={on ? "primary" : "default"} sx={{ height: 20, fontWeight: 600 }} />
      ) : null}
    </Stack>
  );
}

/**
 * The Quotes page, the landing page (My Quotes 2026-09-25; D70). One card:
 * its toolbar has the tabs for the caller's quotes and everyone's (drafts
 * included, D69), each with its count, then search (owners too, on All
 * quotes) and the List / Tree icons; the table is right under it, so the
 * tabs read as being about the table (2026-10-15: Sales hadn't noticed
 * them; the status chips were removed). Every column sorts. Loaded once and
 * searched, sorted and grouped in the browser. The tab and layout are in the
 * URL, so a link or Back keeps them; the layout is also remembered.
 */
export default function MyQuotesPage(): JSX.Element {
  useDocumentTitle("Quotes");
  const [params, setParams] = useSearchParams();
  // D127: Deal Desk without the Sales role owns no quotes and starts none,
  // so it sees All quotes only and no New Quote.
  const { canQuote } = cado2Access(useCado2Me().data);
  const scope: QuoteScope = !canQuote || params.get("scope") === "all" ? "all" : "mine";
  const layout: QuoteLayout = layoutFrom(params.get("layout"), LAYOUT_KEY);
  const setParam = (key: string, value: string, fallback: string) =>
    setParams(
      (cur) => {
        const next = new URLSearchParams(cur);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<QuoteSort>(DEFAULT_SORT);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // Both tabs show their count, so both lists load.
  const mineList = useQuoteList("", "mine");
  const allList = useQuoteList("", "all");
  const { data, error, isPending, isFetching, refetch } =
    scope === "all" ? allList : mineList;
  const now = new Date();
  const mine = scope === "mine";

  const items = data?.items ?? [];
  const shown = sortQuotes(filterQuotes(items, search), sort);
  const searching = search.trim() !== "";
  const accountIds = [...new Set(shown.map((q) => q.sfAccountId))];
  const allCollapsed =
    accountIds.length > 0 && accountIds.every((id) => collapsed.has(id));
  const toggleBranch = (key: string) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Stack spacing={2} sx={{ maxWidth: 1400 }}>
      <PageHeader
        title="Quotes"
        actions={
          canQuote ? (
            <Button
              variant="contained"
              component={RouterLink}
              to={cado2Paths.newQuote}
              startIcon={<PlusIcon size={18} />}
            >
              New Quote
            </Button>
          ) : null
        }
      />

      {/* The tabs, search and layout sit on the table's own card (2026-10-15). */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{ px: 2, columnGap: 2, flexWrap: "wrap", borderBottom: 1, borderColor: "divider" }}
        >
          <Tabs
            value={scope}
            onChange={(_, v: QuoteScope) => {
              setSearch("");
              setParam("scope", v, "mine");
            }}
            aria-label="Whose quotes"
            sx={{
              order: 1,
              minHeight: 56,
              "& .MuiTabs-indicator": { height: 3 },
              "& .MuiTab-root": { minHeight: 56, textTransform: "none", fontSize: "0.95rem", fontWeight: 600 },
            }}
          >
            {canQuote ? (
              <Tab
                value="mine"
                label={<ScopeLabel icon={<UserIcon size={18} />} label="My quotes" count={mineList.data?.total} on={mine} />}
              />
            ) : null}
            <Tab
              value="all"
              label={<ScopeLabel icon={<UsersIcon size={18} />} label="All quotes" count={allList.data?.total} on={!mine} />}
            />
          </Tabs>
          {/* Wide: beside the tabs. Narrow: its own line, full width. */}
          <TextField
            size="small"
            placeholder={mine ? "Search quote, account or opportunity" : "Search quote, account, opportunity or owner"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ order: { xs: 3, md: 2 }, ml: { md: "auto" }, width: { xs: "100%", md: 340 }, mb: { xs: 1.5, md: 0 } }}
            slotProps={{
              htmlInput: { "aria-label": "Search quotes" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon size={16} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Box sx={{ order: { xs: 2, md: 3 }, ml: { xs: "auto", md: 0 } }}>
            <LayoutControls
              layout={layout}
              onLayout={(v) => {
                storeLayout(LAYOUT_KEY, v);
                setParam("layout", v, "");
              }}
              treeLabel="account › opportunity › quote"
              allCollapsed={allCollapsed}
              onCollapseAll={(collapse) => setCollapsed(collapse ? new Set(accountIds) : new Set())}
            />
          </Box>
        </Stack>

        {error ? (
          <Box sx={{ p: 2 }}>
            <ErrorNotice error={error} onRetry={() => void refetch()} retrying={isFetching}>
              Couldn&apos;t load the quotes.
            </ErrorNotice>
          </Box>
        ) : isPending ? (
          <Box sx={{ p: 2 }} aria-label="Loading the quotes">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={36} sx={{ my: 1 }} />
            ))}
          </Box>
        ) : items.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<FileTextIcon size={28} />}
              title={mine ? "No quotes yet" : "No quotes"}
              body="Start from a Salesforce opportunity: QuickQuote prices it from the price book and keeps every version."
              action={
                <Button variant="contained" component={RouterLink} to={cado2Paths.newQuote} startIcon={<PlusIcon size={16} />}>
                  {mine ? "Create your first quote" : "Create a quote"}
                </Button>
              }
            />
          </Box>
        ) : shown.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<SearchIcon size={28} />}
              title="No quotes match"
              body="Try another search term."
              action={<Button onClick={() => setSearch("")}>Clear search</Button>}
            />
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            {layout === "tree" ? (
              <TreeLayout
                rows={shown}
                now={now}
                showOwner={!mine}
                sort={sort}
                onSort={setSort}
                collapsed={collapsed}
                toggle={toggleBranch}
                searching={searching}
              />
            ) : (
              <ListLayout rows={shown} now={now} showOwner={!mine} sort={sort} onSort={setSort} />
            )}
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
