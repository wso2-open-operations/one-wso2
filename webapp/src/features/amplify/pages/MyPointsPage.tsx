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

import { useMemo, useState, type ReactNode } from "react";
import { Alert, Box, Button, Skeleton, Typography } from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { ExternalShare, LedgerEntry } from "../api/amplifyTypes";
import { useAmplifyMe, useMyActivity, useMyExternalShares, useMyPoints } from "../api/useAmplifyData";
import AmplifyShell, { AmplifyPanel } from "../components/AmplifyShell";
import { StateChip } from "../components/DashboardParts";
import FilterChips from "../components/FilterChips";
import { OwnPostLink, OwnPostStatusChip } from "../components/OwnPostParts";
import PointsTiles from "../components/PointsTiles";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_STATUS_LABELS,
  activityStatus,
  activityText,
  historyRows,
  isCorrection,
  matchesActivityFilter,
  type ActivityFilter,
  type ActivityStatus,
} from "../util/activity";
import { WALLETS_OFF_NOTE, conversionSentence } from "../util/coins";
import { fullDate } from "../util/dashboardFormat";
import { signedPoints } from "../util/points";

const STATUS_TONE: Readonly<Record<ActivityStatus, "default" | "primary" | "warning" | "info">> = {
  HELD: "info",
  PAID: "primary",
  ACTION_REQUIRED: "warning",
  REVERSED: "default",
};

/**
 * My points & Coins (every employee): the caller's Coins and points at the top, the conversion rate in plain words,
 * then everything they earned points for, newest first, with own posts still waiting for review above it.
 */
export default function MyPointsPage() {
  return (
    <AmplifyShell
      title="My points & Coins"
      subtitle="Your Amplify points, the WSO2 Coins they become, and what you earned them for."
    >
      <PointsTiles />
      <CoinsRate />
      <ActivityPanel />
    </AmplifyShell>
  );
}

/** The conversion rate and schedule in plain words, and a note while Coins aren't sent yet. */
function CoinsRate() {
  const all = useMyPoints("ALL");
  if (!all.data) return null;
  const { coins } = all.data;
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="body2">
        {conversionSentence(coins.blockPoints, coins.blockCoins, coins.schedule)}
      </Typography>
      {!coins.walletsEnabled && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          {WALLETS_OFF_NOTE}
        </Alert>
      )}
    </Box>
  );
}

/** The caller's activity: filter chips, own posts waiting for review, then their history a page at a time. */
function ActivityPanel() {
  const me = useAmplifyMe();
  const activity = useMyActivity(me.data?.employee.employeeId);
  const claims = useMyExternalShares();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const rows = useMemo(() => historyRows(activity.data?.pages ?? []), [activity.data]);
  const shown = rows.filter((e) => matchesActivityFilter(e, filter));
  const waiting =
    filter === "all" || filter === "own-posts" ? (claims.data ?? []).filter((c) => c.status === "PENDING") : [];

  const body = () => {
    if (me.isError) {
      return (
        <ErrorNotice error={me.error} onRetry={() => void me.refetch()} retrying={me.isFetching}>
          Couldn&apos;t load your activity.
        </ErrorNotice>
      );
    }
    if (me.isPending || activity.isPending) return <Skeleton variant="rounded" height={200} />;
    if (activity.isError) {
      return (
        <ErrorNotice error={activity.error} onRetry={() => void activity.refetch()} retrying={activity.isFetching}>
          Couldn&apos;t load your activity.
        </ErrorNotice>
      );
    }
    const nothing = shown.length === 0 && waiting.length === 0;
    return (
      <>
        {claims.isError && (
          <ErrorNotice error={claims.error} onRetry={() => void claims.refetch()} severity="warning" sx={{ mb: 1.5 }}>
            Couldn&apos;t load the own posts you sent for review.
          </ErrorNotice>
        )}
        {nothing ? (
          <Typography variant="body2" color="text.secondary">
            {emptyText(filter, rows.length === 0, activity.hasNextPage)}
          </Typography>
        ) : (
          <Box component="ul" aria-label="Your activity" sx={{ listStyle: "none", p: 0, m: 0 }}>
            {waiting.map((claim) => (
              <WaitingClaimRow key={claim.id} claim={claim} />
            ))}
            {shown.map((entry) => (
              <ActivityRow key={entry.reference} entry={entry} />
            ))}
          </Box>
        )}
        {activity.hasNextPage && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => void activity.fetchNextPage()}
              disabled={activity.isFetchingNextPage}
            >
              {activity.isFetchingNextPage ? "Loading…" : "Show more activity"}
            </Button>
          </Box>
        )}
      </>
    );
  };

  return (
    <AmplifyPanel title="Your activity">
      <Box sx={{ mb: 1.5 }}>
        <FilterChips options={ACTIVITY_FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter activity" />
      </Box>
      {body()}
    </AmplifyPanel>
  );
}

/** What an empty list says: nothing yet, or nothing of this kind among the activity loaded so far. */
function emptyText(filter: ActivityFilter, noActivity: boolean, more: boolean): string {
  if (noActivity) return "No points yet. Amplify a post on Celebrate to earn your first.";
  if (filter === "all") return "No points activity yet.";
  return more ? "Nothing of this kind in the activity shown so far." : "Nothing of this kind yet.";
}

/** The layout every activity row shares: date, what happened, the post or reason, points and status. */
function RowLayout({
  date,
  what,
  detail,
  points,
  status,
}: {
  date: string;
  what: string;
  detail?: ReactNode;
  points: string;
  /** The status pill, if any. */
  status: ReactNode;
}) {
  return (
    <Box
      component="li"
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: { xs: 1, sm: 2 },
        flexWrap: "wrap",
        py: 1.25,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ width: 104, flexShrink: 0 }}>
        {date}
      </Typography>
      <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {what}
        </Typography>
        {detail}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: "auto" }}>
        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 48, textAlign: "right" }}>
          {points}
        </Typography>
        {status}
      </Box>
    </Box>
  );
}

/** One ledger row: the post it was for, or the PO team's reason on a correction. */
function ActivityRow({ entry }: { entry: LedgerEntry }) {
  const reason = isCorrection(entry) ? entry.reason?.trim() : undefined;
  const status = activityStatus(entry);
  const title = entry.campaignTitle?.trim();
  return (
    <RowLayout
      date={fullDate(entry.createdAt)}
      what={activityText(entry)}
      detail={
        <>
          {title && (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {title}
            </Typography>
          )}
          {reason && (
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              Reason: {reason}
            </Typography>
          )}
        </>
      }
      points={signedPoints(entry.points)}
      status={status && <StateChip label={ACTIVITY_STATUS_LABELS[status]} tone={STATUS_TONE[status]} />}
    />
  );
}

/** An own post the PO team hasn't decided on yet: no points until it's approved. */
function WaitingClaimRow({ claim }: { claim: ExternalShare }) {
  return (
    <RowLayout
      date={fullDate(claim.createdAt)}
      what="You sent your own post for review"
      detail={<OwnPostLink share={claim} />}
      points={signedPoints(0)}
      status={<OwnPostStatusChip status={claim.status} />}
    />
  );
}
