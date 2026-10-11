/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Alert, Box, Stack, Typography } from "@wso2/oxygen-ui";
import { useOpdUserInfo } from "../opd/useOpd";
import { OPD_ROLE, opdHasRole } from "../opd/opdTypes";
import { useOpdDashboardSummary } from "../opd/dashboard/useOpdDashboard";
import { OpdStatCard, OpdSubmittersTable } from "../opd/dashboard/OpdDashboardParts";
import { DashboardPanel } from "../components/DashboardPanel";
import { money } from "../util/financeFormat";
import { describeError } from "../util/financeError";

/**
 * Finance → Overview's "Default" tab, OPD Claims half. Same idea as CC and
 * Expense Claims above it — the four headline stat cards (Claims processed /
 * Claims pending / Value processed / Value pending) plus the "Employees who
 * submitted OPD claims" table. Not the Claim limit utilization table — that
 * stays on the full dashboard, which "OPD Claims" in the same Overview
 * dropdown still opens.
 *
 * Gated the same way the full dashboard is: the OPD finance-approver role
 * from `/user-info`. A reader without it sees nothing here, same reasoning
 * as `OverviewExpenseSummary` — reaching the Default tab at all already
 * means some other app gave them a reason to be here.
 */
export default function OverviewOpdSummary() {
  const userInfo = useOpdUserInfo();
  const hasFinanceRole = opdHasRole(userInfo.data, OPD_ROLE.FINANCE_APPROVER);
  const summary = useOpdDashboardSummary(hasFinanceRole);

  if (!userInfo.isLoading && !hasFinanceRole) {
    return null;
  }

  if (summary.isError) {
    return (
      <Stack spacing={2}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>OPD Claims</Typography>
        <Alert severity="error">{describeError(summary.error)}</Alert>
      </Stack>
    );
  }

  const data = summary.data;
  if (!data) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>OPD Claims</Typography>
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

      <DashboardPanel title="Employees who submitted OPD claims">
        <OpdSubmittersTable
          submittedThisYear={data.employeesSubmittedThisYear}
          submittedLastYear={data.employeesSubmittedLastYear}
          fullyUtilisedThisYear={data.employeesFullyUtilizedThisYear}
          fullyUtilisedLastYear={data.employeesFullyUtilizedLastYear}
        />
      </DashboardPanel>
    </Stack>
  );
}
