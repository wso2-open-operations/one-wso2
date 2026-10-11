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
import { useExpenseAppData } from "../expense/useExpense";
import { useExpenseClaimsReport } from "../expense/dashboard/useExpenseDashboard";
import { ExpenseStatTile } from "../expense/dashboard/ExpenseDashboardParts";
import { DashboardPanel } from "../components/DashboardPanel";
import { expenseStatusMeta } from "../components/FinanceChips";
import { money, toIso } from "../util/financeFormat";
import { describeError } from "../util/financeError";

/**
 * Finance → Overview's "Default" tab, Expense Claims half. Same idea as the
 * CC tiles above it on that page: just the three all-time, unfiltered
 * headline numbers (Claim Count / Total Value / Average Claim Value) plus
 * the Claims by Status breakdown — no filters, no entity/monthly/employee
 * breakdown tables. Picking "Expense Claims" from the Overview dropdown
 * still opens the full dashboard with all of that.
 *
 * Gated the same way the full dashboard is: `enableFinanceView` from
 * `/app-data`. A reader without it sees nothing here rather than a denial
 * notice — the Overview "Default" tab reaching this component at all
 * already means `useFinanceGate` found a reason to show them *something*,
 * which might be CC or OPD rather than this.
 */
export default function OverviewExpenseSummary() {
  const appData = useExpenseAppData();
  const hasFinanceView = appData.data?.enableFinanceView === true;
  const report = useExpenseClaimsReport({ endDate: toIso(new Date()) }, hasFinanceView);

  if (!hasFinanceView) {
    return null;
  }

  if (report.isError) {
    return (
      <Stack spacing={2}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Expense Claims</Typography>
        <Alert severity="error">{describeError(report.error)}</Alert>
      </Stack>
    );
  }

  if (!report.data || report.data.current.claimCount === 0) {
    return null;
  }

  const currency = report.data.reportingCurrency;

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Expense Claims</Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        <ExpenseStatTile label="Claim Count" value={report.data.current.claimCount.toLocaleString("en-US")} />
        <ExpenseStatTile label="Total Value" value={money(report.data.current.totalValue, currency)} />
        <ExpenseStatTile
          label="Average Claim Value"
          value={money(report.data.current.averageClaimValue, currency)}
        />
      </Box>

      <DashboardPanel title="Claims by Status">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {report.data.statusBreakdown.map((item) => (
            <ExpenseStatTile
              key={item.status}
              label={expenseStatusMeta(item.status).label}
              value={item.count.toLocaleString("en-US")}
              caption={`Avg ${item.averageDaysPending} days`}
            />
          ))}
        </Box>
      </DashboardPanel>
    </Stack>
  );
}
