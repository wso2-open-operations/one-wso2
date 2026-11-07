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

import type { JSX } from "react";
import { Box, Skeleton, Stack, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import { formatMoney } from "@features/sales/cado2/utils/money";
import { useApprovalOperations } from "../api/useInsights";
import type { ApprovalOperations } from "../api/insightsTypes";
import { splitCompactMoney, splitHours } from "../utils/format";
import { useInsightsPalette } from "./insightsPalette";
import KpiCard from "./KpiCard";
import InsightsCard from "./InsightsCard";
import RegionSwitch from "./RegionSwitch";
import SlaDonut from "./SlaDonut";
import WaitingByRole from "./WaitingByRole";
import ApprovalSpeed from "./ApprovalSpeed";
import WaitingTime from "./WaitingTime";
import AttentionTable, { ATTENTION_TOP } from "./AttentionTable";
import MoneyNote from "./MoneyNote";

/**
 * Approval Operations (D106, v2 design 2026-10-22): what's in approval now,
 * where it waits, how fast each role decides, and what's late. Live,
 * refreshed every minute; Global or one region.
 */
export default function ApprovalOperationsTab({
  region,
  onRegionChange,
}: {
  readonly region: string;
  readonly onRegionChange: (region: string) => void;
}): JSX.Element {
  const ops = useApprovalOperations(region);
  const c = useInsightsPalette();

  return (
    <Stack spacing={2.25}>
      <Stack direction="row" useFlexGap spacing={1.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <RegionSwitch value={region} onChange={onRegionChange} />
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: c.ok }} />
          <Typography variant="caption" color="text.secondary">
            Live · refreshed every minute
          </Typography>
        </Stack>
      </Stack>

      {ops.error ? (
        <ErrorNotice error={ops.error} onRetry={() => void ops.refetch()} retrying={ops.isFetching}>
          Couldn&apos;t load Approval Operations.
        </ErrorNotice>
      ) : ops.isPending ? (
        <Skeleton variant="rounded" height={520} aria-label="Loading Approval Operations" />
      ) : (
        <Operations data={ops.data} />
      )}
    </Stack>
  );
}

function Operations({ data }: { data: ApprovalOperations }): JSX.Element {
  const cur = data.currency;
  const value = splitCompactMoney(data.inApprovalValue, cur);
  const average = splitHours(data.averageApprovalHours);
  const sla = data.byRole.reduce(
    (t, r) => ({ onTrack: t.onTrack + r.onTrack, dueSoon: t.dueSoon + r.dueSoon, overdue: t.overdue + r.overdue }),
    { onTrack: 0, dueSoon: 0, overdue: 0 },
  );
  return (
    <Stack spacing={2}>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        <KpiCard label="Quotes in approval" value={data.inApproval} hint={`${data.submittedLastDay} submitted in the last day`} />
        <KpiCard
          label="Value in approval"
          value={value.value}
          unit={value.unit}
          title={data.inApprovalValue ? `${cur} ${formatMoney(data.inApprovalValue)}` : undefined}
          hint={`Total contract value, one quote per opportunity, in ${cur}`}
        />
        <KpiCard
          label="Overdue approvals"
          value={data.overdueSteps}
          alert={data.overdueSteps > 0}
          hint={data.dueSoonSteps > 0 ? `${data.dueSoonSteps} more due within hours` : "None due soon"}
        />
        <KpiCard
          label="Average approval time"
          value={average.value}
          unit={average.unit}
          hint={`Submission to approval, last ${data.approvalWindowDays} days`}
        />
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "320px 1fr" } }}>
        <InsightsCard title="SLA health" hint="Approvals waiting on someone right now">
          <SlaDonut {...sla} />
        </InsightsCard>
        <InsightsCard title="Where quotes are waiting" hint="Approvals waiting, per approver role">
          <WaitingByRole data={data.byRole} />
        </InsightsCard>
      </Box>

      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
        <InsightsCard
          title="Approval time by role"
          hint={`Average time from a quote reaching the approver to their decision, last ${data.approvalWindowDays} days`}
        >
          <ApprovalSpeed data={data.speed} days={data.approvalWindowDays} />
        </InsightsCard>
        <InsightsCard title="Waiting time" hint={`The ${data.inApproval} quotes in approval, by time since submission`}>
          <WaitingTime buckets={data.aging} oldest={data.oldest} currency={cur} />
        </InsightsCard>
      </Box>

      <InsightsCard
        title="Needs attention"
        hint={
          data.attention.length > ATTENTION_TOP
            ? `Overdue first, then the largest deals · ${ATTENTION_TOP} of ${data.attention.length} shown`
            : "Overdue first, then the largest deals"
        }
      >
        <AttentionTable items={data.attention} currency={cur} />
      </InsightsCard>

      <MoneyNote meta={data} />
    </Stack>
  );
}
