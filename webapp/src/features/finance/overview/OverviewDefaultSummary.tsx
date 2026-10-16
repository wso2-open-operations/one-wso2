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
import { useNavigate } from "react-router";
import { useCcTransactionSummary } from "../cc/useCc";
import { Stat, PendingByAge } from "../cc/pages/CcDashboardPage";
import { wholeAmount } from "../util/financeFormat";
import { describeError } from "../util/financeError";
import { ccPaths } from "../cc/ccPaths";
import OverviewExpenseSummary from "./OverviewExpenseSummary";
import OverviewOpdSummary from "./OverviewOpdSummary";

const CURRENCY = "USD";

/**
 * Finance → Overview's "Default" landing tab. A quick glance per app, each
 * just its own headline tiles — CC's four (Total Amount / Total
 * Transactions / Avg Days / Pending by Age), Expense Claims' own (Claim
 * Count / Total Value / Average Claim Value / Claims by Status), then OPD
 * Claims' own (Claims processed / Claims pending / Value processed / Value
 * pending, plus who submitted). Nothing else — no Cardholders Details, no
 * Submitted Expenses by Category, no Claim limit utilization table, no
 * period/view-mode selectors or filters. Picking an app by name from this
 * same dropdown still opens its full dashboard.
 */
export default function OverviewDefaultSummary() {
  const summary = useCcTransactionSummary(undefined, false, undefined);
  const current = summary.data?.current;
  const buckets = Object.values(summary.data?.ageBuckets ?? {});
  const navigate = useNavigate();

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: "text.primary" }}>Credit Card</Typography>
      {summary.isError ? (
        <Alert severity="error">{describeError(summary.error)}</Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
            alignItems: "stretch",
          }}
        >
          <Stat
            title="Total Amount Pending Submission"
            value={`${CURRENCY} ${wholeAmount(current?.amount ?? 0)}`}
            loading={summary.isLoading}
            linkTitle="New transaction"
            onLinkClick={() => navigate(ccPaths.newTransactions)}
          />
          <Stat
            title="Total Transactions Pending Submission"
            value={String(current?.count ?? 0)}
            loading={summary.isLoading}
          />
          <Stat
            title="Avg. Days Taken to Submit"
            value={current?.avgDaysToSubmit != null ? current.avgDaysToSubmit.toFixed(1) : "-"}
            unit="days"
            loading={summary.isLoading}
          />
          <PendingByAge buckets={buckets} loading={summary.isLoading} />
        </Box>
      )}

      <OverviewExpenseSummary />
      <OverviewOpdSummary />
    </Stack>
  );
}
