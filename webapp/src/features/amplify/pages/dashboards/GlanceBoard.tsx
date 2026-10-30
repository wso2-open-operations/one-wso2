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

import { Box, Typography } from "@wso2/oxygen-ui";
import type { DashboardGlance, GroupBoardEntry, LeaderboardEntry } from "../../api/amplifyTypes";
import { useAmplifyLeaderboard } from "../../api/useAmplifyData";
import { useAmplifyPeople, type PeopleByEmail } from "../../api/useAmplifyPeople";
import { useDashboardGlance, useGroupBoard } from "../../api/useAmplifyDashboards";
import { nameOrUnknown, type PersonRef } from "../../api/usePersonLookup";
import AmplifyShell from "../../components/AmplifyShell";
import PersonLink from "../../components/PersonLink";
import { Block, BoardState, Empty, MedalRank, StatCard } from "../../components/DashboardParts";
import { updatedStamp, changePercent, monthLabel, num, percentOf } from "../../util/dashboardFormat";

function MonthlyLine({ monthly }: { monthly: DashboardGlance["monthly"] }) {
  if (monthly.length === 0) return <Empty>No reposts recorded yet.</Empty>;
  const max = Math.max(1, ...monthly.map((w) => w.reposts));
  const step = monthly.length > 1 ? 500 / (monthly.length - 1) : 0;
  const pts = monthly.map((w, i) => [10 + i * step, 130 - (w.reposts / max) * 108] as const);
  const last = pts[pts.length - 1];
  const label = monthly.map((w) => `${monthLabel(w.monthStart)}: ${w.reposts}`).join(", ");
  return (
    <>
      <svg
        viewBox="0 0 520 150"
        role="img"
        aria-label={`Monthly reposts. ${label}`}
        style={{ width: "100%", height: "auto" }}
      >
        <line x1="0" y1="130" x2="520" y2="130" stroke="currentColor" strokeOpacity="0.25" />
        <polyline
          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="#60A5FA"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last[0]} cy={last[1]} r="6" fill="#FF7300" />
      </svg>
      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "text.secondary" }}>
        <span>{monthLabel(monthly[0].monthStart)}</span>
        <span>This month · {num(monthly[monthly.length - 1].reposts)}</span>
      </Box>
    </>
  );
}

function RankedList({ rows }: { rows: { id: string; rank: number; name: string; points: number; person?: PersonRef }[] }) {
  return (
    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1.5 }}>
      {rows.map((r) => (
        <Box component="li" key={r.id} sx={{ display: "flex", gap: 1.5 }}>
          <Box sx={{ flex: "0 0 40px" }}>
            <MedalRank rank={r.rank} />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>{r.person ? <PersonLink person={r.person}>{r.name}</PersonLink> : r.name}</Box>
          <Box sx={{ fontWeight: 600 }}>{num(r.points)}</Box>
        </Box>
      ))}
    </Box>
  );
}

const NO_DIRECTORY: PeopleByEmail = new Map();

/** At a glance: the one screen for a leadership check-in. */
export function GlanceBoard({
  data,
  people,
  teams,
  directory = NO_DIRECTORY,
}: {
  data: DashboardGlance;
  people: LeaderboardEntry[];
  teams: GroupBoardEntry[];
  /** Names from the employee directory, keyed by work email (the leaderboard rows carry an id and a fallback name). */
  directory?: PeopleByEmail;
}) {
  const t = data.campaignsReachingTarget;
  const success = data.shareSuccess;
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {updatedStamp(data.asOf)} · {data.month}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "stretch" }}>
        <Box sx={{ flex: "2 1 520px", minWidth: 0 }}>
          <Block title="Employee reposts of WSO2 posts">
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 1.5 }}>
              <Typography sx={{ fontSize: 52, fontWeight: 600, lineHeight: 1 }}>{num(data.reposts.thisMonth)}</Typography>
              <Typography color="text.secondary">
                this month, {changePercent(data.reposts.thisMonth, data.reposts.previousMonth)} on last month (
                {num(data.reposts.previousMonth)})
              </Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              <MonthlyLine monthly={data.monthly} />
            </Box>
          </Block>
        </Box>
        <Box sx={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <StatCard
            label="Employees participating"
            value={num(data.participants)}
            detail={
              data.headcount
                ? `of ${num(data.headcount)} · ${percentOf(data.participants, data.headcount)} of the company`
                : undefined
            }
          />
          <StatCard
            label="Posts live"
            value={num(data.campaignsLive)}
            detail={`${num(t.reached)} of ${num(t.live)} reached ${t.thresholdPercent}% of connected`}
          />
          <StatCard
            label="Share success, this month"
            value={percentOf(success.published, success.attempts)}
            detail={`${num(success.published)} of ${num(success.attempts)} attempts published`}
          />
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "stretch" }}>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Block title="Top 3 people · all time">
            {people.length === 0 ? (
              <Empty>No points yet.</Empty>
            ) : (
              <RankedList
                rows={people.slice(0, 3).map((p) => ({
                  id: p.employeeId,
                  rank: p.rank,
                  name: nameOrUnknown(directory.get(p.email.toLowerCase())?.name, p.displayName),
                  points: p.points,
                  person: { employeeId: p.employeeId, displayName: p.displayName, email: p.email },
                }))}
              />
            )}
          </Block>
        </Box>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Block title="Top 3 teams">
            {teams.length === 0 ? (
              <Empty>No teams to show.</Empty>
            ) : (
              <RankedList rows={teams.slice(0, 3).map((e) => ({ id: e.key, rank: e.rank, name: e.name, points: e.points }))} />
            )}
          </Block>
        </Box>
        <Box sx={{ flex: "1 1 320px", minWidth: 0 }}>
          <Block title="Best post this month">
            {data.bestCampaign ? (
              <>
                <Typography sx={{ fontSize: 17 }}>{data.bestCampaign.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {data.bestCampaign.categoryLabel}
                  {data.bestCampaign.isPriority ? " · priority" : ""}
                </Typography>
                <Typography sx={{ fontSize: 30, fontWeight: 600, mt: 1.5 }}>
                  {num(data.bestCampaign.reposts)}{" "}
                  <Typography component="span" color="text.secondary">
                    reposts
                  </Typography>
                </Typography>
              </>
            ) : (
              <Empty>No reposts this month yet.</Empty>
            )}
          </Block>
        </Box>
      </Box>
    </Box>
  );
}

export default function GlancePage() {
  const glance = useDashboardGlance();
  const board = useAmplifyLeaderboard();
  const teams = useGroupBoard("TEAM");
  const directory = useAmplifyPeople();
  return (
    <AmplifyShell title="At A Glance" subtitle="One screen for the leadership check-in.">
      <BoardState queries={[glance]}>
        {glance.data && (
          <GlanceBoard data={glance.data} people={board.data?.company ?? []} teams={teams.data?.entries ?? []} directory={directory} />
        )}
      </BoardState>
    </AmplifyShell>
  );
}
