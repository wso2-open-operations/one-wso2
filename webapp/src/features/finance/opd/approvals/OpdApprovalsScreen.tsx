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
import { Alert, Box, Skeleton, Stack, Tab, Tabs, Typography } from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { OpdClaimDetailsDialog } from "../OpdClaimDetailsDialog";
import { useOpdClaims, useOpdEmployees, useOpdUserInfo } from "../useOpd";
import { OPD_ROLE, opdHasRole, type OpdClaim } from "../opdTypes";
import { OpdApprovalsFilters } from "./OpdApprovalsFilters";
import { OpdApprovalsTable } from "./OpdApprovalsTable";
import {
  OPD_APPROVAL_TABS,
  emptyApprovalFilters,
  toApprovalSearchPayload,
  type OpdApprovalFilters,
  type OpdApprovalTab,
} from "./opdApprovals";

export default function OpdApprovalsScreen() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="OPD claim approval"
      subtitle="OPD claims waiting on finance, and the ones already decided."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
    >
      <ApprovalsBody />
    </FinanceShell>
  );
}

function ApprovalsBody() {
  const userInfo = useOpdUserInfo();
  const employees = useOpdEmployees();
  const [tab, setTab] = useState<OpdApprovalTab>("pending");
  const [filters, setFilters] = useState<OpdApprovalFilters>(() => emptyApprovalFilters());
  const [reviewing, setReviewing] = useState<OpdClaim | null>(null);

  // `routes.tsx:20-24` — approving is the finance view's, not the submitter's.
  //
  // `isError` is excluded deliberately: a failed lookup leaves `data`
  // undefined, which reads as "no role", and telling an approver they lack
  // access because a request failed is worse than showing them a retry.
  const canApprove = opdHasRole(userInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const refused = !userInfo.isLoading && !userInfo.isError && !canApprove;

  const payload = useMemo(() => toApprovalSearchPayload(tab, filters), [tab, filters]);
  const claims = useOpdClaims(payload, canApprove);

  if (refused) {
    return <Alert severity="info">OPD claim approval is limited to the finance team.</Alert>;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-end" }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        {/* :64-95 — each tab is a different question asked of the backend, so
            switching one clears the filters the previous answer was narrowed by. */}
        <Tabs
          value={tab}
          onChange={(_e, next) => {
            setTab(next as OpdApprovalTab);
            setFilters(emptyApprovalFilters());
          }}
          aria-label="Claim queues"
          sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, textTransform: "none" } }}
        >
          {OPD_APPROVAL_TABS.map((t) => (
            <Tab key={t.segment} value={t.segment} label={t.label} />
          ))}
        </Tabs>

        <OpdApprovalsFilters tab={tab} filters={filters} onChange={setFilters} />
      </Stack>

      {userInfo.isLoading || claims.isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
          ))}
        </Stack>
      ) : userInfo.isError || claims.isError ? (
        <ErrorNotice
          error={userInfo.error ?? claims.error}
          onRetry={() => {
            if (userInfo.isError) void userInfo.refetch();
            if (claims.isError) void claims.refetch();
          }}
          retrying={userInfo.isFetching || claims.isFetching}
        >
          Couldn&apos;t load the claims.
        </ErrorNotice>
      ) : (claims.data?.length ?? 0) === 0 ? (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 3 }}>
          No claims found.
        </Typography>
      ) : (
        <OpdApprovalsTable
          claims={claims.data!}
          employees={employees.data}
          onReview={setReviewing}
        />
      )}

      {/* The existing dialog: it already reads a claim in full and carries the
          approve/reject decision with its reason. */}
      <OpdClaimDetailsDialog claim={reviewing} onClose={() => setReviewing(null)} />
    </Box>
  );
}
