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

import { useState } from "react";
import {
  Avatar,
  Box,
  Chip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { useMeProfile } from "../../api/useMeProfile";
import { isBankingBackendConfigured, useBankAccounts } from "../../api/useBankAccounts";
import { display, formatDate } from "../../api/derive";
import type { AccountStatus, AccountType } from "../../api/types";

type ChipColor = "default" | "success" | "warning" | "error";

// Same colour assignments as the source app's Summary grid: Salary green,
// Consultancy orange, Reimbursement neutral; Active green, Requested orange,
// Rejected red, Inactive neutral.
const ACCOUNT_TYPE_COLOR: Record<AccountType, ChipColor> = {
  SALARY: "success",
  CONSULTANCY: "warning",
  REIMBURSEMENT: "default",
};

const ACCOUNT_STATUS_COLOR: Record<AccountStatus, ChipColor> = {
  ACTIVE: "success",
  REQUESTED: "warning",
  REJECTED: "error",
  INACTIVE: "default",
};

const ROWS_PER_PAGE_OPTIONS = [7, 10, 25, 50];

const COLUMNS = [
  "Account Types",
  "Effected From",
  "Account No",
  "Name",
  "Changed Bank",
  "Payment Method",
  "Status",
] as const;

// The Banking page's second tab — ported from digiops-hr's banking webapp
// "Summary" tab: the employee's whole bank-account change history, every
// Account Type and every status, from the same unfiltered accounts fetch
// the My Accounts tab already makes (react-query shares the cached result).
// Rows keep the order the backend returns them in.
export default function SummaryTab() {
  const profile = useMeProfile();
  const accounts = useBankAccounts(profile.data?.employee.workEmail);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

  if (!isBankingBackendConfigured()) {
    return (
      <Tooltip title="Set ONE_WSO2_BANKING_BACKEND_URL to enable this." placement="top">
        <Typography sx={{ color: "text.disabled", fontStyle: "italic", cursor: "help" }}>
          Not configured
        </Typography>
      </Tooltip>
    );
  }

  if (profile.isLoading || accounts.isLoading) {
    return <Skeleton variant="rectangular" height={280} sx={{ borderRadius: 1.5 }} />;
  }

  if (profile.isError) {
    return (
      <ErrorNotice error={profile.error} onRetry={() => profile.refetch()}>
        Couldn&apos;t load your profile.
      </ErrorNotice>
    );
  }

  if (accounts.isError) {
    return (
      <ErrorNotice error={accounts.error} onRetry={() => accounts.refetch()}>
        Couldn&apos;t load your bank accounts.
      </ErrorNotice>
    );
  }

  const rows = accounts.data?.bankAccounts ?? [];

  if (rows.length === 0) {
    return (
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography sx={{ fontWeight: 600 }}>No account history found</Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
          Bank account changes you request will appear here.
        </Typography>
      </Box>
    );
  }

  const visible = rows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            {COLUMNS.map((label) => (
              <TableCell key={label} sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                {label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((a) => (
            <TableRow key={a.accountId} hover>
              <TableCell>
                <Chip
                  label={a.accountType}
                  color={ACCOUNT_TYPE_COLOR[a.accountType]}
                  size="small"
                  avatar={<Avatar sx={{ bgcolor: "common.white" }}>{a.accountType[0]}</Avatar>}
                />
              </TableCell>
              <TableCell>{formatDate(a.effectiveFrom)}</TableCell>
              <TableCell>{display(a.accountNumber)}</TableCell>
              <TableCell>{display(a.accountName)}</TableCell>
              <TableCell>{display(a.bankName)}</TableCell>
              {/* Records that predate Payment Method (Salary/Reimbursement)
                  carry none; the source app shows those as Bank Transfer. */}
              <TableCell>{a.paymentMethod || "Bank Transfer"}</TableCell>
              <TableCell>
                <Chip
                  label={a.accountStatus}
                  color={ACCOUNT_STATUS_COLOR[a.accountStatus]}
                  variant="outlined"
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
      />
    </TableContainer>
  );
}
