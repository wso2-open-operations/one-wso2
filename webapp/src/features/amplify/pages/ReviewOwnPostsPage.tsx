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

import { useState } from "react";
import { Navigate, Outlet } from "react-router";
import { Avatar, Box, Button, Paper, Skeleton, TablePagination, Typography } from "@wso2/oxygen-ui";
import { CheckIcon, StarIcon, XIcon } from "@wso2/oxygen-ui-icons-react";
import ErrorNotice from "@components/error-notice/ErrorNotice";
import RoutedTabs from "@components/routed-tabs/RoutedTabs";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { AMPLIFY_REVIEW_PATH } from "@constants/perspectives";
import type { ExternalShare, ExternalShareStatus } from "../api/amplifyTypes";
import {
  REVIEW_PAGE_SIZE,
  useAmplifyMe,
  useExternalSharesForReview,
  useWaitingReviewCount,
} from "../api/useAmplifyData";
import { useApproveExternalShare, useFeatureExternalShare } from "../api/useAmplifyMutations";
import { UNKNOWN_EMPLOYEE, usePersonLookup, type ResolvedPerson } from "../api/usePersonLookup";
import { waitingReviewBadge } from "../api/useAmplifyRailBadges";
import AmplifyShell from "../components/AmplifyShell";
import DeclineOwnPostDialog from "../components/DeclineOwnPostDialog";
import { OwnPostLink, OwnPostStatusChip } from "../components/OwnPostParts";
import { describeAmplifyError } from "../util/amplifyError";
import { fullDate, initialsOf } from "../util/dashboardFormat";
import {
  OWN_POST_APPROVED_POINTS,
  OWN_POST_FEATURED_POINTS,
  OWN_POST_FEATURE_TOP_UP,
  REVIEW_TABS,
} from "../util/ownPosts";

/** The error when Feature approved a post but couldn't feature it. */
export const FEATURE_AFTER_APPROVE_FAILED =
  "The post was approved, but it couldn't be featured. You can feature it from the Approved tab.";

/** Shown in place of the buttons on the reviewer's own post. */
export const OWN_CLAIM_NOTE = "This is your own post; another PO team member will decide on it.";

const EMPTY_TEXT: Readonly<Record<ExternalShareStatus, string>> = {
  PENDING: "Nothing is waiting for review.",
  APPROVED: "No approved posts.",
  AMPLIFIED: "No featured posts.",
  REJECTED: "No declined posts.",
};

/**
 * Review own posts (CAN_REVIEW_SHARES, checked by AmplifyReviewRoute): posts employees wrote about Choreo Labs,
 * one tab per status. The Waiting tab carries the waiting count.
 */
export default function ReviewOwnPostsPage() {
  const waiting = useWaitingReviewCount(true);
  const tabs = REVIEW_TABS.map((t) =>
    t.status === "PENDING" && waiting.data ? { ...t, badge: waitingReviewBadge(waiting.data) } : t,
  );
  return (
    <AmplifyShell
      title="Review own posts"
      subtitle={
        "Posts employees wrote themselves about Choreo Labs. " +
        "Approve them for points, feature the best ones, or decline with a reason."
      }
    >
      <RoutedTabs basePath={AMPLIFY_REVIEW_PATH} tabs={tabs} ariaLabel="Review own posts" />
      <Outlet />
    </AmplifyShell>
  );
}

/** `/amplify/review` itself opens the Waiting tab. */
export function ReviewIndexRedirect() {
  return <Navigate to={`${AMPLIFY_REVIEW_PATH}/${REVIEW_TABS[0].segment}`} replace />;
}

/** One tab: a page of claims in `status`, oldest first. */
export function ReviewTab({ status }: { status: ExternalShareStatus }) {
  const [page, setPage] = useState(0);
  const list = useExternalSharesForReview(status, page);
  const me = useAmplifyMe();
  const lookup = usePersonLookup();
  const myId = me.data?.employee.employeeId;
  const items = list.data?.items ?? [];

  // A decision moves the card off this list; when it was the last one on a later page, step back a page.
  const afterDecision = () => setPage((p) => (items.length === 1 && p > 0 ? p - 1 : p));

  if (list.isPending) return <Skeleton variant="rounded" height={180} />;
  if (list.isError) {
    return (
      <ErrorNotice error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching}>
        Couldn&apos;t load these posts.
      </ErrorNotice>
    );
  }
  // A later page can empty while it's open (another reviewer decided its posts); offer the way back.
  if (items.length === 0 && page > 0) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">
          This page is empty now.
        </Typography>
        <Button size="small" onClick={() => setPage(0)}>
          Back to the first page
        </Button>
      </Box>
    );
  }
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {EMPTY_TEXT[status]}
      </Typography>
    );
  }
  return (
    <Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {items.map((share) => (
          <ReviewCard
            key={share.id}
            share={share}
            who={lookup({ employeeId: share.employeeId })}
            isOwn={myId !== undefined && share.employeeId === myId}
            onDecided={afterDecision}
          />
        ))}
      </Box>
      {list.data.total > REVIEW_PAGE_SIZE && (
        <TablePagination
          component="div"
          count={list.data.total}
          page={page}
          rowsPerPage={REVIEW_PAGE_SIZE}
          rowsPerPageOptions={[REVIEW_PAGE_SIZE]}
          onPageChange={(_, p) => setPage(p)}
        />
      )}
    </Box>
  );
}

/** One claim: who sent it, their note, when, the link, and the decision buttons its status allows. */
function ReviewCard({
  share,
  who,
  isOwn,
  onDecided,
}: {
  share: ExternalShare;
  who: ResolvedPerson;
  isOwn: boolean;
  onDecided: () => void;
}) {
  const approve = useApproveExternalShare();
  const feature = useFeatureExternalShare();
  const { showError, showSuccess } = useNotifications();
  const [working, setWorking] = useState(false);
  const [declining, setDeclining] = useState(false);
  const known = who.name !== UNKNOWN_EMPLOYEE;
  const name = known ? who.name : "An employee";
  const target = { id: share.id, employeeId: share.employeeId };
  const decidable = !isOwn && (share.status === "PENDING" || share.status === "APPROVED");

  const run = async (step: () => Promise<void>) => {
    setWorking(true);
    try {
      await step();
    } finally {
      setWorking(false);
    }
  };

  const approveOnly = () =>
    run(async () => {
      try {
        await approve.mutateAsync(target);
      } catch (err) {
        showError(describeAmplifyError(err));
        return;
      }
      showSuccess(`Approved: +${OWN_POST_APPROVED_POINTS} points for ${name}.`);
      onDecided();
    });

  // From Waiting: approve, then feature. The two are separate calls, so a failure after the approval says so.
  const approveAndFeature = () =>
    run(async () => {
      try {
        await approve.mutateAsync(target);
      } catch (err) {
        showError(describeAmplifyError(err));
        return;
      }
      onDecided();
      try {
        await feature.mutateAsync(target);
      } catch {
        showError(FEATURE_AFTER_APPROVE_FAILED);
        return;
      }
      showSuccess(`Featured: +${OWN_POST_FEATURED_POINTS} points for ${name}.`);
    });

  const featureApproved = () =>
    run(async () => {
      try {
        await feature.mutateAsync(target);
      } catch (err) {
        showError(describeAmplifyError(err));
        return;
      }
      showSuccess(`Featured: +${OWN_POST_FEATURE_TOP_UP} more points for ${name}.`);
      onDecided();
    });

  return (
    <Paper variant="outlined" component="article" aria-label={`Post from ${name}`} sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexWrap: "wrap" }}>
        <Avatar src={who.photoUrl ?? undefined} alt="" sx={{ width: 40, height: 40, fontSize: 15 }}>
          {known ? initialsOf(who.name) : "?"}
        </Avatar>
        <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{name}</Typography>
          {!known && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "break-all" }}>
              Employee ID: {share.employeeId}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Submitted {fullDate(share.createdAt)}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <OwnPostStatusChip status={share.status} />
          <OwnPostLink share={share} />
        </Box>
      </Box>

      {share.note?.trim() && (
        <Box
          sx={{ mt: 1.5, pl: 1.5, borderLeft: "3px solid", borderColor: "divider" }}
          aria-label="Note for the reviewer"
        >
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {share.note}
          </Typography>
        </Box>
      )}

      {share.status === "REJECTED" && share.decisionReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Declined {fullDate(share.decidedAt)}: {share.decisionReason}
        </Typography>
      )}
      {share.status === "AMPLIFIED" && share.amplifiedAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Featured {fullDate(share.amplifiedAt)}
        </Typography>
      )}
      {share.status === "APPROVED" && share.decidedAt && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Approved {fullDate(share.decidedAt)}
        </Typography>
      )}

      {isOwn && (share.status === "PENDING" || share.status === "APPROVED") && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {OWN_CLAIM_NOTE}
        </Typography>
      )}

      {decidable && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
          {share.status === "PENDING" ? (
            <>
              <Button
                variant="contained"
                size="small"
                startIcon={<CheckIcon size={14} />}
                onClick={() => void approveOnly()}
                disabled={working}
              >
                Approve (+{OWN_POST_APPROVED_POINTS})
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<StarIcon size={14} />}
                onClick={() => void approveAndFeature()}
                disabled={working}
              >
                Feature (+{OWN_POST_FEATURED_POINTS})
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<XIcon size={14} />}
                onClick={() => setDeclining(true)}
                disabled={working}
              >
                Decline
              </Button>
            </>
          ) : (
            <Button
              variant="outlined"
              size="small"
              startIcon={<StarIcon size={14} />}
              onClick={() => void featureApproved()}
              disabled={working}
            >
              Feature (+{OWN_POST_FEATURE_TOP_UP})
            </Button>
          )}
        </Box>
      )}

      {declining && (
        <DeclineOwnPostDialog
          share={share}
          submitterName={name}
          onClose={() => setDeclining(false)}
          onDeclined={onDecided}
        />
      )}
    </Paper>
  );
}
