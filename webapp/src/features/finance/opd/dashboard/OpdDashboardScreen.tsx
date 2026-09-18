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

import { Alert, Box, Skeleton, Stack } from "@wso2/oxygen-ui";
import { isOpdBackendConfigured } from "@config/apiConfig";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { FINANCE_EYEBROW } from "@constants/financeApps";
import FinanceShell from "../../components/FinanceShell";
import { money } from "../../util/financeFormat";
import { useOpdUserInfo } from "../useOpd";
import { OPD_ROLE, opdHasRole } from "../opdTypes";
import { useOpdDashboardSummary } from "./useOpdDashboard";
import { OpdDashboardPanel, OpdStatCard, OpdSubmittersTable } from "./OpdDashboardParts";
import { OpdUtilizationTable } from "./OpdUtilizationTable";
import { claimLimitOf } from "./opdDashboardTypes";

export default function OpdDashboardScreen() {
  return (
    <FinanceShell
      eyebrow={FINANCE_EYEBROW.opd}
      title="OPD analytics"
      subtitle="How much of the OPD allowance the company has used this year, and who has claimed."
      configured={isOpdBackendConfigured()}
      configKey="ONE_WSO2_OPD_BACKEND_URL"
    >
      <DashboardBody />
    </FinanceShell>
  );
}

function DashboardBody() {
  const userInfo = useOpdUserInfo();
  const summary = useOpdDashboardSummary();

  // `routes.tsx:20-24` puts this screen behind View.FINANCE — it is every
  // employee's spend, not your own, so the approver role is what opens it.
  //
  // `isError` is excluded deliberately: a failed lookup leaves `data`
  // undefined, which reads as "no role", and telling a finance approver they
  // lack access because a request failed is worse than showing them a retry.
  if (!userInfo.isLoading && !userInfo.isError && !opdHasRole(userInfo.data, OPD_ROLE.FINANCE_APPROVER)) {
    return (
      <Alert severity="info">
        OPD analytics is limited to the finance team who review these claims.
      </Alert>
    );
  }

  if (userInfo.isLoading || summary.isLoading) {
    return (
      <Stack spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </Stack>
    );
  }

  if (userInfo.isError || summary.isError) {
    return (
      <ErrorNotice
        error={userInfo.error ?? summary.error}
        onRetry={() => {
          if (userInfo.isError) void userInfo.refetch();
          if (summary.isError) void summary.refetch();
        }}
        retrying={userInfo.isFetching || summary.isFetching}
      >
        Couldn&apos;t load the OPD analytics.
      </ErrorNotice>
    );
  }

  const data = summary.data;
  if (!data) return null;

  const limit = claimLimitOf(data.utilization);

  return (
    <Box>
      {/* Four across on a wide screen, two on a tablet, stacked on a phone —
          `Dashboard.tsx:52`. */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: 2,
        }}
      >
        <OpdStatCard title="Claims processed" value={data.claimsProcessed.toLocaleString("en-US")} />
        <OpdStatCard title="Claims pending" value={data.claimsPending.toLocaleString("en-US")} />
        <OpdStatCard title="Value processed" value={money(data.valueProcessed)} />
        <OpdStatCard title="Value pending" value={money(data.valuePending)} />
      </Box>

      <OpdDashboardPanel title="Employees who submitted OPD claims">
        <OpdSubmittersTable
          submittedThisYear={data.employeesSubmittedThisYear}
          submittedLastYear={data.employeesSubmittedLastYear}
          fullyUtilisedThisYear={data.employeesFullyUtilizedThisYear}
          fullyUtilisedLastYear={data.employeesFullyUtilizedLastYear}
        />
      </OpdDashboardPanel>

      <OpdDashboardPanel
        title="Claim limit utilization"
        // Read off the first row, as the source does: the limit is the same for
        // everyone, and with no rows there is no limit to quote.
        aside={limit === null ? undefined : `(Limit: ${money(limit)} per employee)`}
      >
        <OpdUtilizationTable rows={data.utilization} />
      </OpdDashboardPanel>
    </Box>
  );
}
