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

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import { useDebouncedValue } from "@hooks/useDebouncedValue";
import { isExpenseBackendConfigured } from "@config/apiConfig";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { StatusChip, expenseStatusMeta } from "../../components/FinanceChips";
import { describeError } from "../../util/financeError";
import { money, formatNice, startOfYearIso, endOfYearIso } from "../../util/financeFormat";
import { useExpenseAppData, useExpenseClaims } from "../useExpense";
import { ExpenseClaimDetailsDialog } from "../ExpenseClaimDetailsDialog";
import {
  EXPENSE_FILTERABLE_STATUSES,
  type ExpenseClaim,
  type ExpenseClaimStatus,
} from "../expenseTypes";

// The Expense tab of Claims. The page frame is the Claims shell's now, but this
// tab still reports its own backend's connectivity: the screen spans two
// backends and either may be missing, so the notice belongs per tab.
export default function ExpenseClaimsTab() {
  if (!isExpenseBackendConfigured()) {
    return (
      <Alert severity="info">
        Expense claims aren&apos;t connected yet. Set{" "}
        <code>ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL</code> in <code>public/config.js</code> and
        reload.
      </Alert>
    );
  }
  return <HistoryBody />;
}
export function ExpenseFinanceHistoryPage() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.claims}
      title="Expense claim history"
      subtitle="What you've claimed and where each one has got to."
      configured={isExpenseBackendConfigured()}
      configKey="ONE_WSO2_EXPENSE_CLAIMS_BACKEND_URL"
    >
      <HistoryBody />
    </FinanceShell>
  );
}

// Match the source app's default: "Latest 100" sends limit=100 with NO date
// filter (so claims across all years show); a specific year narrows via a
// startDate/endDate range.
const LATEST = "latest";
const CUSTOM = "custom";
type Range = typeof LATEST | typeof CUSTOM | number;

function HistoryBody() {
  const appData = useExpenseAppData();
  const currentYear = new Date().getFullYear();
  const [range, setRange] = useState<Range>(LATEST);
  const [selected, setSelected] = useState<ExpenseClaim | null>(null);
  // FilterHolder.tsx:175-178,249 — the employee's own view filters by status
  // and by claim id as well as by period.
  const [status, setStatus] = useState<ExpenseClaimStatus | "All">("All");
  const [claimId, setClaimId] = useState("");
  // FilterHolder.tsx:20,111-172 — an arbitrary start/end span, not just a
  // whole calendar year. Native date inputs stand in for the source's
  // react-date-range calendar popover — same query, lighter dependency.
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  // Debounced before it reaches the query: useExpenseClaims keys on the whole
  // payload, so the raw value would fire a search per keystroke — and on the
  // finance view that search spans the company. The source batches the same
  // fields behind an Apply button (FilterHolder.tsx:53,81-82).
  const claimIdFilter = useDebouncedValue(claimId.trim());

  const customRangeReady = range === CUSTOM && Boolean(customStart) && Boolean(customEnd);
  const email = appData.data?.userInfo.workEmail ?? undefined;
  const claims = useExpenseClaims(
    {
      email,
      ...(range === LATEST
        ? { limit: 100 }
        : range === CUSTOM
          ? { startDate: customStart, endDate: customEnd }
          : { startDate: startOfYearIso(range), endDate: endOfYearIso(range) }),
      // tableSlice.ts:47,51 — both are omitted rather than sent empty.
      ids: claimIdFilter ? [claimIdFilter] : undefined,
      status: status === "All" ? undefined : [status],
    },
    Boolean(email) && (range !== CUSTOM || customRangeReady),
  );

  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) out.push(y);
    return out;
  }, [currentYear]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Show</Typography>
        <FormControl size="small">
          <Select<Range>
            value={range}
            onChange={(e) => setRange(e.target.value === LATEST ? LATEST : Number(e.target.value))}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value={LATEST}>Latest 100</MenuItem>
            {years.map((y) => (
              <MenuItem key={y} value={y}>
                {y}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM}>Custom range…</MenuItem>
          </Select>
        </FormControl>

        {range === CUSTOM && (
          <>
            <TextField
              size="small"
              type="date"
              label="From"
              slotProps={{ inputLabel: { shrink: true } }}
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              sx={{ minWidth: 150 }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              slotProps={{ inputLabel: { shrink: true } }}
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              sx={{ minWidth: 150 }}
            />
          </>
        )}

        <FormControl size="small">
          <InputLabel id="expense-status">Status</InputLabel>
          <Select
            labelId="expense-status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ExpenseClaimStatus | "All")}
            sx={{ minWidth: 170 }}
          >
            <MenuItem value="All">All</MenuItem>
            {EXPENSE_FILTERABLE_STATUSES.map((st) => (
              <MenuItem key={st} value={st}>
                {expenseStatusMeta(st).label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          label="Filter by claim ID"
          value={claimId}
          onChange={(e) => setClaimId(e.target.value)}
          sx={{ minWidth: 200 }}
        />
      </Stack>

      {range === CUSTOM && !customRangeReady ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          Pick a start and end date to see claims in that range.
        </Typography>
      ) : appData.isLoading || claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : appData.isError || claims.isError ? (
        <Alert severity="error">Couldn't load your claims. {describeError(appData.error ?? claims.error)}</Alert>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          {range === LATEST
            ? "No expense claims on record."
            : range === CUSTOM
              ? `No expense claims on record between ${customStart} and ${customEnd}.`
              : `No expense claims on record for ${range}.`}
        </Typography>
      ) : (
        <ClaimsTable claims={claims.data!} onView={setSelected} />
      )}

      <ExpenseClaimDetailsDialog
        claim={selected}
        onClose={() => setSelected(null)}
        appData={appData.data}
      />
    </Box>
  );
}

// ClaimTable.tsx:79-94,116-137 — the row a decision was just made on
// highlights green/red and fades out over ~1.5s rather than just vanishing
// the instant the list refetches without it. Only Approvals passes this.
export interface ReviewedRow {
  id: string;
  decision: "approve" | "reject";
}

// Shared table also used by the approvals screens (with a `userColumn`).
export function ClaimsTable({
  claims,
  onView,
  userColumn,
  actionLabel = "View",
  actionVariant = "outlined",
  reviewedRow,
}: {
  claims: ExpenseClaim[];
  onView: (c: ExpenseClaim) => void;
  userColumn?: boolean;
  actionLabel?: string;
  actionVariant?: "outlined" | "contained";
  reviewedRow?: ReviewedRow | null;
}) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden" }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": { fontSize: 11, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.04em" } }}>
            <TableCell>Claim ID</TableCell>
            {userColumn && <TableCell>User</TableCell>}
            <TableCell>Submitted</TableCell>
            <TableCell align="right">Amount</TableCell>
            {!userColumn && <TableCell>Status</TableCell>}
            <TableCell align="right">&nbsp;</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {claims.map((c) => (
            <ClaimTableRow
              key={c.id}
              claim={c}
              userColumn={userColumn}
              actionLabel={actionLabel}
              actionVariant={actionVariant}
              onView={onView}
              reviewed={reviewedRow?.id === c.id ? reviewedRow : null}
            />
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function ClaimTableRow({
  claim: c,
  onView,
  userColumn,
  actionLabel,
  actionVariant,
  reviewed,
}: {
  claim: ExpenseClaim;
  onView: (c: ExpenseClaim) => void;
  userColumn?: boolean;
  actionLabel: string;
  actionVariant: "outlined" | "contained";
  reviewed?: ReviewedRow | null;
}) {
  const meta = expenseStatusMeta(c.statusDetails.status);
  // Mounts at full opacity, then flips a tick later so the opacity change is
  // a transition rather than the row appearing pre-faded.
  const [fading, setFading] = useState(false);
  useEffect(() => {
    if (!reviewed) return;
    const t = setTimeout(() => setFading(true), 20);
    return () => clearTimeout(t);
  }, [reviewed]);

  return (
    <TableRow
      hover
      sx={
        reviewed
          ? {
              backgroundColor: reviewed.decision === "approve" ? "success.light" : "error.light",
              opacity: fading ? 0 : 1,
              transition: "opacity 1.5s ease",
            }
          : undefined
      }
    >
      <TableCell sx={{ fontSize: 12.5, fontFamily: "monospace" }}>{c.id}</TableCell>
      {userColumn && <TableCell sx={{ fontSize: 12.5 }}>{c.employeeEmail}</TableCell>}
      <TableCell sx={{ fontSize: 12.5 }}>{formatNice(c.createdDate)}</TableCell>
      <TableCell align="right" sx={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
        {money(c.totalAmount, c.currencyCode ?? "LKR")}
      </TableCell>
      {!userColumn && (
        <TableCell>
          <StatusChip label={meta.label} color={meta.color} />
        </TableCell>
      )}
      <TableCell align="right">
        <Button
          size="small"
          variant={actionVariant}
          disabled={Boolean(reviewed)}
          onClick={() => onView(c)}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {actionLabel}
        </Button>
      </TableCell>
    </TableRow>
  );
}
