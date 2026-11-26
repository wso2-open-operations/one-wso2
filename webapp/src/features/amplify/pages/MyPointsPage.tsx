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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  LinearProgress,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@wso2/oxygen-ui";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import type { CoinConversion, ExternalShare, HistoryItem, LedgerEntry } from "../api/amplifyTypes";
import { useAmplifyMe, useMyActivity, useMyExternalShares, useMyPoints } from "../api/useAmplifyData";
import { useCaptureCoinsWallet } from "../api/useAmplifyMutations";
import AmplifyShell from "../components/AmplifyShell";
import { CoinMark, PlainStatus, SoftPill, warmSurfaceSx } from "../components/AmplifyTone";
import { SectionLabel } from "../components/DashboardParts";
import FilterChips from "../components/FilterChips";
import { OwnPostLink } from "../components/OwnPostParts";
import SubmitOwnPostDialog from "../components/SubmitOwnPostDialog";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_STATUS_LABELS,
  activityStatus,
  activityText,
  conversionStatusText,
  conversionText,
  historyRows,
  isCoinConversion,
  isCorrection,
  matchesActivityFilter,
  type ActivityFilter,
  type ActivityStatus,
} from "../util/activity";
import { amplifyProblemCode } from "../util/amplifyError";
import {
  WALLETS_OFF_NOTE,
  coinsText,
  convertedPoints,
  nextConversion,
  progressFraction,
  rateSentence,
  walletLine,
  type WalletCheck,
} from "../util/coins";
import { num, shortDate } from "../util/dashboardFormat";
import { OWN_POST_STATUS_LABELS } from "../util/ownPosts";
import { signedPoints } from "../util/points";

/** The line under the activity list. */
export const ACTIVITY_FOOTNOTE = "Something look wrong? Ask the PO team. Reactions and comments appear within 24 hours.";

/**
 * My points & Coins (every employee): the caller's Coins and progress at the top, then everything they did, the
 * points it earned and where those points stand, newest first. Submit your own post sits at the top right.
 */
export default function MyPointsPage() {
  const [submitting, setSubmitting] = useState(false);
  const walletCheck = useWalletCheckOnVisit();
  return (
    <AmplifyShell
      title="My points & Coins"
      subtitle="Everything you've done, the points it earned, and the Coins those points became."
      action={
        <Button variant="outlined" onClick={() => setSubmitting(true)}>
          Submit your own post
        </Button>
      }
    >
      <CoinsBand walletCheck={walletCheck} />
      <ActivityPanel />
      <SubmitOwnPostDialog open={submitting} onClose={() => setSubmitting(false)} />
    </AmplifyShell>
  );
}

/**
 * Captures the caller's WSO2 Coins wallet once per visit to the page (POST /me/coins/wallet), so a wallet set up since
 * the last visit is picked up before the next conversion. It never holds up the page; a failure only changes the
 * wallet line. The ref keeps it to one call when React runs the effect twice in development.
 */
function useWalletCheckOnVisit(): WalletCheck {
  const capture = useCaptureCoinsWallet();
  const { mutate } = capture;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);
  if (capture.isSuccess) return "captured";
  if (capture.isError) return amplifyProblemCode(capture.error) === "NO_WALLET" ? "no-wallet" : "unavailable";
  return "checking";
}

/** One line of the band's right column: a label and its number. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
      <Typography component="dt" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ fontWeight: 700, m: 0 }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Coins received, progress to the next Coins and the rule, and all-time points, converted points and the next run. */
function CoinsBand({ walletCheck }: { walletCheck: WalletCheck }) {
  const all = useMyPoints("ALL");
  if (all.isError) {
    return (
      <ErrorNotice error={all.error} onRetry={() => void all.refetch()} sx={{ mb: 3 }}>
        Couldn&apos;t load your Coins.
      </ErrorNotice>
    );
  }
  if (!all.data) return <Skeleton variant="rounded" height={140} sx={{ mb: 3 }} />;
  const { coins, standing } = all.data;
  const allTime = standing.points ?? 0;
  const wallet = walletLine(coins.wallet, walletCheck);
  return (
    <Box
      component="section"
      aria-label="Your Coins"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr)" },
        alignItems: "center",
        gap: 3,
        border: "1px solid",
        borderRadius: 2,
        p: 3,
        mb: 3,
        ...warmSurfaceSx,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <CoinMark size={48} />
        <Box>
          <Typography component="p" sx={{ fontSize: 36, fontWeight: 700, lineHeight: 1.1 }}>
            {coinsText(coins.coinsReceived)}
          </Typography>
          <Typography variant="body2" sx={{ color: "warning.dark" }}>
            {coins.walletsEnabled ? "Sent to your WSO2 Coins wallet" : WALLETS_OFF_NOTE}
          </Typography>
          {wallet && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
              {wallet}
            </Typography>
          )}
        </Box>
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>
          {num(coins.pointsTowardNext)} of {num(coins.blockPoints)} points toward your next {coinsText(coins.blockCoins)}
        </Typography>
        <LinearProgress
          variant="determinate"
          color="warning"
          value={Math.round(progressFraction(coins.pointsTowardNext, coins.blockPoints) * 100)}
          aria-label="Progress to your next Coins"
          sx={{ height: 10, borderRadius: 5 }}
        />
        <Typography variant="body2" sx={{ color: "warning.dark", mt: 1 }}>
          {rateSentence(coins.blockPoints, coins.blockCoins)}
        </Typography>
      </Box>
      <Box component="dl" sx={{ m: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
        <Fact label="All-time points" value={num(allTime)} />
        <Fact label="Converted to Coins" value={num(convertedPoints(allTime, coins.heldPoints, coins.carryPoints))} />
        <Fact label="Next conversion" value={shortDate(nextConversion(coins.schedule).toISOString())} />
      </Box>
    </Box>
  );
}

/**
 * A row of the list: a ledger row or a Coins conversion from the history, or an own post that's waiting or was
 * declined (no ledger row yet).
 */
type ActivityItem = { kind: "history"; entry: HistoryItem } | { kind: "claim"; claim: ExternalShare };

const itemDate = (i: ActivityItem) => Date.parse(i.kind === "history" ? i.entry.createdAt : i.claim.createdAt) || 0;

/**
 * The list's rows, newest first: the ledger rows loaded so far, and the own posts waiting for review or declined.
 * While older ledger pages remain, a claim older than the oldest loaded row waits for its page, so the order holds.
 */
function activityItems(rows: HistoryItem[], claims: ExternalShare[], complete: boolean): ActivityItem[] {
  const oldest = rows.length ? Math.min(...rows.map((r) => Date.parse(r.createdAt) || 0)) : 0;
  const shownClaims = claims.filter(
    (c) =>
      (c.status === "PENDING" || c.status === "REJECTED") &&
      (complete || c.status === "PENDING" || (Date.parse(c.createdAt) || 0) >= oldest),
  );
  return [
    ...shownClaims.map((claim) => ({ kind: "claim" as const, claim })),
    ...rows.map((entry) => ({ kind: "history" as const, entry })),
  ].sort((a, b) => itemDate(b) - itemDate(a));
}

function itemMatches(item: ActivityItem, filter: ActivityFilter): boolean {
  if (item.kind === "claim") return filter === "all" || filter === "own-posts";
  return matchesActivityFilter(item.entry, filter);
}

/** The caller's activity: the title and filter chips, then a table of rows, a page of history at a time. */
function ActivityPanel() {
  const me = useAmplifyMe();
  const activity = useMyActivity(me.data?.employee.employeeId);
  const claims = useMyExternalShares();
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const rows = useMemo(() => historyRows(activity.data?.pages ?? []), [activity.data]);
  const items = useMemo(
    () => activityItems(rows, claims.data ?? [], !activity.hasNextPage),
    [rows, claims.data, activity.hasNextPage],
  );
  const shown = items.filter((i) => itemMatches(i, filter));

  const body = () => {
    if (me.isError) {
      return (
        <ErrorNotice error={me.error} onRetry={() => void me.refetch()} retrying={me.isFetching} sx={{ mx: 2 }}>
          Couldn&apos;t load your activity.
        </ErrorNotice>
      );
    }
    if (me.isPending || activity.isPending) return <Skeleton variant="rounded" height={200} sx={{ mx: 2 }} />;
    if (activity.isError) {
      return (
        <ErrorNotice
          error={activity.error}
          onRetry={() => void activity.refetch()}
          retrying={activity.isFetching}
          sx={{ mx: 2 }}
        >
          Couldn&apos;t load your activity.
        </ErrorNotice>
      );
    }
    return (
      <>
        {claims.isError && (
          <ErrorNotice
            error={claims.error}
            onRetry={() => void claims.refetch()}
            severity="warning"
            sx={{ mx: 2, mb: 1.5 }}
          >
            Couldn&apos;t load the own posts you sent for review.
          </ErrorNotice>
        )}
        {shown.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1 }}>
            {emptyText(filter, items.length === 0, activity.hasNextPage)}
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table aria-label="Your activity" sx={{ "& td, & th": { verticalAlign: "top" } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Activity</TableCell>
                  <TableCell>Post</TableCell>
                  <TableCell align="right">Points</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((item) =>
                  item.kind === "claim" ? (
                    <ClaimRow key={`claim-${item.claim.id}`} claim={item.claim} />
                  ) : isCoinConversion(item.entry) ? (
                    <ConversionRow key={item.entry.reference} conversion={item.entry} />
                  ) : (
                    <LedgerRow key={item.entry.reference} entry={item.entry} />
                  ),
                )}
              </TableBody>
            </Table>
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
    <Box
      component="section"
      aria-label="Activity"
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, pt: 2, pb: 2, mb: 3 }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.5,
          flexWrap: "wrap",
          px: 2,
          mb: 1.5,
        }}
      >
        <SectionLabel>Activity</SectionLabel>
        <FilterChips options={ACTIVITY_FILTERS} value={filter} onChange={setFilter} ariaLabel="Filter activity" />
      </Box>
      {body()}
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, mt: 2 }}>
        {ACTIVITY_FOOTNOTE}
      </Typography>
    </Box>
  );
}

/** What an empty list says: nothing yet, or nothing of this kind among the activity loaded so far. */
function emptyText(filter: ActivityFilter, noActivity: boolean, more: boolean): string {
  if (noActivity) return "No points yet. Amplify a post on Celebrate to earn your first.";
  if (filter === "all") return "No points activity yet.";
  return more ? "Nothing of this kind in the activity shown so far." : "Nothing of this kind yet.";
}

/** A status as drawn: quiet bold text, or a soft pill for the ones that need an eye (waiting, Coins sent). */
function StatusCell({ status }: { status: ActivityStatus | "PENDING_CLAIM" | "DECLINED" | null }) {
  if (status === null) return null;
  if (status === "PENDING_CLAIM") return <SoftPill>{OWN_POST_STATUS_LABELS.PENDING}</SoftPill>;
  if (status === "DECLINED") return <PlainStatus muted>{OWN_POST_STATUS_LABELS.REJECTED}</PlainStatus>;
  if (status === "PAID" || status === "ACTION_REQUIRED") return <SoftPill>{ACTIVITY_STATUS_LABELS[status]}</SoftPill>;
  return <PlainStatus muted={status !== "HELD"}>{ACTIVITY_STATUS_LABELS[status]}</PlainStatus>;
}

/** The layout every row shares. */
function Row({
  date,
  what,
  sub,
  post,
  points,
  status,
}: {
  date: string;
  what: ReactNode;
  /** A second line under the activity: the reason on a correction or a decline. */
  sub?: string | null;
  post: ReactNode;
  points: string;
  status: ReactNode;
}) {
  return (
    <TableRow>
      <TableCell sx={{ whiteSpace: "nowrap", color: "text.secondary" }}>{date}</TableCell>
      <TableCell sx={{ minWidth: 180 }}>
        {what}
        {sub && (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {sub}
          </Typography>
        )}
      </TableCell>
      <TableCell sx={{ minWidth: 200, overflowWrap: "anywhere" }}>{post}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
        {points}
      </TableCell>
      <TableCell>{status}</TableCell>
    </TableRow>
  );
}

/** One ledger row: the post it was for, and the PO team's reason on a correction. */
function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const reason = isCorrection(entry) ? entry.reason?.trim() : undefined;
  return (
    <Row
      date={shortDate(entry.createdAt)}
      what={activityText(entry)}
      sub={reason}
      post={entry.campaignTitle?.trim() || "—"}
      points={signedPoints(entry.points)}
      status={<StatusCell status={activityStatus(entry)} />}
    />
  );
}

/**
 * A Coins conversion: "Converted to Coins" with "800 points → 80 Coins" under it, the points it took, and an
 * "80 Coins sent" pill (a grey "Sending 80 Coins" while the transfer isn't confirmed).
 */
function ConversionRow({ conversion }: { conversion: CoinConversion }) {
  const sent = conversion.conversionStatus === "SENT";
  return (
    <Row
      date={shortDate(conversion.createdAt)}
      what={<Box component="span" sx={{ fontWeight: 700 }}>Converted to Coins</Box>}
      sub={conversionText(conversion)}
      post="—"
      points={signedPoints(-Math.abs(conversion.points))}
      status={<SoftPill tone={sent ? "warning" : "neutral"}>{conversionStatusText(conversion)}</SoftPill>}
    />
  );
}

/** An own post the marketing team hasn't approved: waiting for review (no points yet), or declined with a reason. */
function ClaimRow({ claim }: { claim: ExternalShare }) {
  const declined = claim.status === "REJECTED";
  return (
    <Row
      date={shortDate(claim.createdAt)}
      what={declined ? "Own post declined" : "Own post submitted"}
      sub={declined ? claim.decisionReason?.trim() : null}
      post={
        <>
          {claim.note?.trim() && <Box>{claim.note.trim()}</Box>}
          <OwnPostLink share={claim} />
        </>
      }
      points="—"
      status={<StatusCell status={declined ? "DECLINED" : "PENDING_CLAIM"} />}
    />
  );
}
