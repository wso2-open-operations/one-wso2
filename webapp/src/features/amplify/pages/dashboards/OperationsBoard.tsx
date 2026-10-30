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

import { useState } from "react";
import { Box, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@wso2/oxygen-ui";
import type { DashboardOperations } from "../../api/amplifyTypes";
import { useDashboardOperations } from "../../api/useAmplifyDashboards";
import AmplifyShell from "../../components/AmplifyShell";
import { Block, BoardState, Empty, PriorityPill, StackedBar, StatCard, StateChip } from "../../components/DashboardParts";
import { announcementLabel, commentedReposts, plainReposts, updatedStamp, deltaText, num, percentOf, windowText } from "../../util/dashboardFormat";

const ANNOUNCEMENT_TONE = { SENT: "info", QUEUED: "warning", FAILED: "error", NONE: "default" } as const;

type PointsPeriod = "month" | "year";
const POINTS_PERIODS: { key: PointsPeriod; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

/** Points awarded, switchable between this month and this year (UTC). */
function PointsTile({ kpis }: { kpis: DashboardOperations["kpis"] }) {
  const [period, setPeriod] = useState<PointsPeriod>("month");
  const value = { month: kpis.pointsThisMonth, year: kpis.pointsThisYear }[period];
  return (
    <StatCard
      label="Points awarded"
      value={num(value)}
      detail={`${num(kpis.peopleWithPoints)} people have points`}
      action={
        <Box role="group" aria-label="Points period" sx={{ display: "flex", gap: 0.5 }}>
          {POINTS_PERIODS.map((p) => (
            <Chip
              key={p.key}
              size="small"
              label={p.label}
              color={period === p.key ? "primary" : "default"}
              variant={period === p.key ? "filled" : "outlined"}
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
            />
          ))}
        </Box>
      }
    />
  );
}

/** The operations board: what's live, who's sharing, whether anything is stuck. */
export function OperationsBoard({ data }: { data: DashboardOperations }) {
  const { kpis, connections, shareHealth } = data;
  const connectedOf =
    data.headcount != null ? `${percentOf(kpis.peopleConnected, data.headcount)} of ${num(data.headcount)} employees` : undefined;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {updatedStamp(data.asOf)}
      </Typography>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
        <StatCard
          label="Posts live"
          value={num(kpis.campaignsLive)}
          detail={`${num(kpis.campaignsLivePriority)} priority · ${num(kpis.campaignsClosingWithin7Days)} closing within 7 days`}
        />
        <StatCard
          label="Reposts / Reposts with Comments"
          value={`${num(plainReposts({ reposts: kpis.repostsThisMonth, repostsWithCommentary: kpis.repostsThisMonthWithCommentary }))} / ${num(
            commentedReposts({ reposts: kpis.repostsThisMonth, repostsWithCommentary: kpis.repostsThisMonthWithCommentary }),
          )}`}
          detail={deltaText(kpis.repostsThisMonth, kpis.repostsPrevMonth, "last month")}
        />
        <StatCard
          label="Employees connected"
          value={num(kpis.peopleConnected)}
          detail={[connectedOf, `${num(kpis.connectionsExpired)} expired`].filter(Boolean).join(" · ")}
        />
        <PointsTile kpis={kpis} />
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "stretch" }}>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Block title="Share health, this month">
            <StackedBar
              label={`${shareHealth.published} published, ${shareHealth.queued} queued, ${shareHealth.failed} failed`}
              segments={[
                { label: "published", value: shareHealth.published, color: "#60A5FA" },
                { label: "queued", value: shareHealth.queued, color: "#94A3B8" },
                { label: "failed", value: shareHealth.failed, color: "#F9A8D4" },
              ]}
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5, fontSize: 13 }}>
              <span>{num(shareHealth.published)} published</span>
              <span>{num(shareHealth.queued)} queued</span>
              <span>{num(shareHealth.failed)} failed</span>
            </Box>
            {shareHealth.failed > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {Object.entries(shareHealth.failedByReason)
                  .filter(([, n]) => n > 0)
                  .map(([reason, n]) => `${num(n)} ${reason.toLowerCase().replace(/_/g, " ")}`)
                  .join(" · ")}
              </Typography>
            )}
          </Block>
        </Box>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Block title="Connections">
            <StackedBar
              label={`${connections.active} active, ${connections.expiring} expiring, ${connections.expired} expired, ${connections.revoked} revoked`}
              segments={[
                { label: "active", value: connections.active, color: "#60A5FA" },
                { label: "expiring", value: connections.expiring, color: "#FF7300" },
                { label: "expired", value: connections.expired, color: "#F9A8D4" },
                { label: "revoked", value: connections.revoked, color: "#94A3B8" },
              ]}
            />
            <Box sx={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 1, mt: 1.5, fontSize: 13 }}>
              <span>{num(connections.active)} active</span>
              <span>{num(connections.expiring)} expiring</span>
              <span>{num(connections.expired)} expired</span>
              {connections.revoked > 0 && <span>{num(connections.revoked)} revoked</span>}
            </Box>
            {connections.neverConnected != null && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {num(connections.neverConnected)} employees have never connected
              </Typography>
            )}
          </Block>
        </Box>
      </Box>

      <Block title="Posts">
        {data.campaigns.length === 0 ? (
          <Empty>No posts are live or were closed in the last 30 days.</Empty>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 620 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Post</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Window</TableCell>
                  <TableCell align="right">Reposts</TableCell>
                  <TableCell align="right">Reposts/Comments</TableCell>
                  <TableCell>Novera</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.campaigns.map((p) => (
                  <TableRow key={p.campaignId}>
                    <TableCell>
                      {p.title}
                      {p.isPriority && <PriorityPill />}
                    </TableCell>
                    <TableCell>{p.categoryLabel}</TableCell>
                    <TableCell>{windowText(p.opensAt, p.closesAt)}</TableCell>
                    <TableCell align="right">{num(plainReposts(p))}</TableCell>
                    <TableCell align="right">{num(commentedReposts(p))}</TableCell>
                    <TableCell>
                      <StateChip label={announcementLabel(p.announcement)} tone={ANNOUNCEMENT_TONE[p.announcement?.status ?? "NONE"]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Block>
    </Box>
  );
}

export default function OperationsPage() {
  const q = useDashboardOperations();
  return (
    <AmplifyShell title="Operations" subtitle="What's live, who's sharing, and whether anything is stuck.">
      <BoardState queries={[q]}>{q.data && <OperationsBoard data={q.data} />}</BoardState>
    </AmplifyShell>
  );
}
