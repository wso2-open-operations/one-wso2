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
import { Button, Card, Skeleton, Stack, Tooltip, Typography } from "@wso2/oxygen-ui";
import { LandmarkIcon } from "@wso2/oxygen-ui-icons-react";
import { Link as RouterLink } from "react-router";
import DetailRow from "@components/detail-row/DetailRow";
import Pager from "@features/people-ops/components/Pager";
import { ACCOUNT_TYPE_LABEL } from "../api/derive";
import type { BankAccount } from "../api/types";
import { useBankingAccess } from "../api/useBankingAccess";
import {
  isBankingBackendConfigured,
  useBankAccounts,
} from "../api/useBankAccounts";

const PAGE_SIZE = 2;

// Live bank-accounts card in ConnectedServices. Reads from banking-app's
// GET /employee/accounts?employeeWorkEmail=<me>. Currently read-only —
// no add/deactivate UI (banking add-flow goes through approval workflow,
// which is a bigger surface than we've scoped for now).
export default function BankAccountsCard({ ownerEmail }: { ownerEmail?: string }) {
  const configured = isBankingBackendConfigured();
  const query = useBankAccounts(ownerEmail);
  // The Banking page is closed to anyone outside the banking group, so its
  // entry point here goes with it.
  const bankingAccess = useBankingAccess();
  const [page, setPage] = useState(0);

  // Show ACTIVE accounts only — INACTIVE are historical, REQUESTED /
  // REJECTED are pending change requests handled inside the banking app.
  const accounts = useMemo<BankAccount[]>(
    () =>
      (query.data?.bankAccounts ?? []).filter(
        (a) => a.accountStatus === "ACTIVE",
      ),
    [query.data],
  );
  const pageCount = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE));
  const clampedPage = Math.min(page, pageCount - 1);
  const visible = accounts.slice(clampedPage * PAGE_SIZE, (clampedPage + 1) * PAGE_SIZE);

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography
          sx={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "text.secondary",
            fontWeight: 600,
            flex: 1,
          }}
        >
          Bank accounts
        </Typography>
        {accounts.length > PAGE_SIZE && (
          <Pager
            total={accounts.length}
            page={clampedPage}
            pageCount={pageCount}
            onPrev={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          />
        )}
        {bankingAccess.canSee && (
          <Button size="small" component={RouterLink} to="/me/banking">
            Edit
          </Button>
        )}
      </Stack>

      {!configured ? (
        <Tooltip title="Set ONE_WSO2_BANKING_BACKEND_URL to enable this." placement="top">
          <Typography sx={{ fontSize: 12.5, color: "text.disabled", fontStyle: "italic", py: 1.5, cursor: "help" }}>
            Not configured
          </Typography>
        </Tooltip>
      ) : query.isLoading ? (
        <AccountsSkeleton />
      ) : query.isError ? (
        <Typography sx={{ fontSize: 12.5, color: "error.main", py: 1 }}>
          Couldn't load bank accounts. {query.error instanceof Error ? query.error.message : ""}
        </Typography>
      ) : accounts.length === 0 ? (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary", py: 1.5 }}>
          No active bank accounts on system.
        </Typography>
      ) : (
        visible.map((a, idx) => (
          <DetailRow
            key={a.accountId}
            icon={<LandmarkIcon size={14} />}
            title={`${a.bankName ?? "Bank"} · ${ACCOUNT_TYPE_LABEL[a.accountType] ?? a.accountType}`}
            meta={`${maskAccountNumber(a.accountNumber)}${a.branchName ? ` · ${a.branchName}` : ""}`}
            last={idx === visible.length - 1}
          />
        ))
      )}
    </Card>
  );
}

function AccountsSkeleton() {
  return (
    <Stack spacing={1.25} sx={{ py: 0.5 }}>
      <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
      <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
    </Stack>
  );
}

// Show only the last 4 digits (industry-standard PII treatment for
// account numbers). Empty / very short numbers fall back to a bare mask
// so we never accidentally leak more than 4 chars.
function maskAccountNumber(raw: string | undefined | null): string {
  if (!raw) return "••••";
  const digits = raw.replace(/\s/g, "");
  if (digits.length <= 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
}
